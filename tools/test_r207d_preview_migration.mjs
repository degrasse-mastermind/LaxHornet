import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrations = [
  "20260723000000_laxhornet_legacy_baseline.sql", "20260723010000_trust_spine_release_1.sql",
  "20260723020000_minimum_necessary_disclosure.sql", "20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
  "20260723040000_event_pipeline_capabilities.sql", "20260727000000_tracked_playing_time_operations.sql",
  "20260728193942_v284_public_event_semantic_boundary.sql", "20260730134439_durable_game_tombstones.sql",
  "20260730151714_durable_game_tombstone_concurrency.sql", "20260806143128_r207a_dormant_concurrency_foundation.sql",
  "20260809155442_r207b_controlled_preview_integration.sql", "20260809164435_r207b_qualify_preview_game_update.sql",
  "20260809173500_r207c_versioned_event_corrections.sql", "20260809201608_r207d_conflict_resolution_foundation.sql",
];
const ACCOUNT = "00000000-0000-4000-8000-00000000000a";
const TRACKER = "00000000-0000-4000-8000-00000000000b";
const OTHER = "00000000-0000-4000-8000-00000000000c";
const containers = new Set();
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; console.log(`PASS: ${label}`); };
const read = (folder, file) => fs.readFileSync(path.join(root, "supabase", folder, file), "utf8");
function docker(args, options = {}) {
  const result = spawnSync("docker", args, { cwd: root, encoding: "utf8", input: options.input, timeout: 180000 });
  if (result.status !== 0 && !options.allowFailure) throw new Error(`${result.stdout}\n${result.stderr}`);
  return result;
}
function psql(container, sql, allowFailure = false) {
  const result = docker(["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: sql, allowFailure });
  result.stdout = result.stdout.trim(); result.stderr = result.stderr.trim(); return result;
}
const bootstrap = `
create role anon nologin; create role authenticated nologin; create schema auth; create schema extensions;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
grant usage on schema auth, extensions to anon, authenticated; grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
create publication supabase_realtime;
${migrations.map((file) => read("migrations", file)).join("\n")}`;
async function start(name) {
  const container = `laxhornet-r207d-${name}-${process.pid}`; containers.add(container);
  docker(["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=synthetic-only", "postgres:17-alpine"]);
  let consecutiveReady = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (docker(["exec", container, "pg_isready", "-U", "postgres"], { allowFailure: true }).status === 0) consecutiveReady += 1;
    else consecutiveReady = 0;
    if (consecutiveReady >= 3) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(consecutiveReady >= 3, "disposable PostgreSQL target did not become ready");
  psql(container, bootstrap); return container;
}
const claims = (id) => `select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', false); set role authenticated;`;
const parse = (text) => JSON.parse(text.split(/\r?\n/).reverse().find((line) => line.startsWith("{")));
const hash = (seed) => String(seed).padEnd(64, String(seed).slice(-1) || "a").slice(0, 64).replace(/[^0-9a-f]/g, "a");
const gameOperation = ({ id, game, base, changes, actor = ACCOUNT }) => ({
  actor, request: {
    client_operation_id: id, game_id: game, operation_type: "metadata_patch", field_group: "metadata",
    base_version: base, changed_fields: Object.keys(changes).sort(), changes, request_hash: hash(id),
    client_created_at: "2026-08-09T12:00:00Z",
  },
});
const gameCall = (container, operation) => parse(psql(container, `${claims(operation.actor)} select public.laxhornet_sync_game_v2($json$${JSON.stringify(operation.request)}$json$::jsonb)::text; reset role;`).stdout);
const readCall = (container, actor, game) => parse(psql(container, `${claims(actor)} select public.laxhornet_read_game_conflicts_v1('{"game_id":"${game}"}'::jsonb)::text; reset role;`).stdout);
const resolutionCall = (container, actor, request) => parse(psql(container, `${claims(actor)} select public.laxhornet_resolve_game_conflict_v1($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).stdout);
function makeConflict(container, game, suffix, actor = ACCOUNT) {
  const accepted = gameCall(container, gameOperation({ id: `${suffix}-accepted`, game, base: 1, changes: { opponent: `${suffix}-current` }, actor }));
  assert.equal(accepted.outcome, "accepted");
  const conflict = gameCall(container, gameOperation({ id: `${suffix}-conflict`, game, base: 1, changes: { opponent: `${suffix}-proposed` }, actor }));
  assert.equal(conflict.outcome, "conflicted");
  return readCall(container, actor, game).conflicts[0];
}
const resolution = (conflict, id, action, patch = {}) => ({
  client_resolution_operation_id: id,
  conflict_id: conflict.conflict_id,
  game_id: conflict.game_id,
  action,
  expected_versions: conflict.server_versions,
  patch,
  client_created_at: "2026-08-09T12:05:00Z",
  request_hash: hash(id),
});

try {
  const main = await start("main");
  psql(main, `
    insert into auth.users(id,email) values
      ('${ACCOUNT}','owner@example.invalid'),('${TRACKER}','tracker@example.invalid'),('${OTHER}','other@example.invalid');
    insert into public.games(id,user_id,share_code,opponent,game_date,status,lifecycle_state) values
      ('keep-game','${ACCOUNT}','KEEP0001','Initial','2026-08-09','in-progress','active'),
      ('apply-game','${ACCOUNT}','APPLY001','Initial','2026-08-09','in-progress','active'),
      ('patch-game','${ACCOUNT}','PATCH001','Initial','2026-08-09','in-progress','active'),
      ('dismiss-game','${ACCOUNT}','DISMISS1','Initial','2026-08-09','in-progress','active'),
      ('stale-game','${ACCOUNT}','STALE001','Initial','2026-08-09','in-progress','active'),
      ('patch-stale-game','${ACCOUNT}','PSTALE01','Initial','2026-08-09','in-progress','active'),
      ('delete-game','${ACCOUNT}','DELETE01','Initial','2026-08-09','in-progress','active'),
      ('revoked-game','${ACCOUNT}','REVOKE01','Initial','2026-08-09','in-progress','active');
  `);
  check(readCall(main, ACCOUNT, "keep-game").code === "r207_not_activated", "R2-07D conflict read remains dormant by migration default");
  psql(main, read("", "seed.sql"));

  const keep = makeConflict(main, "keep-game", "keep");
  const keepRequest = resolution(keep, "resolve-keep", "keep_server");
  const kept = resolutionCall(main, ACCOUNT, keepRequest);
  check(kept.code === "resolution_kept" && psql(main, "select opponent from public.games where id='keep-game';").stdout === "keep-current", "keep_server appends a terminal resolution without mutating the game");
  const keepReplay = resolutionCall(main, ACCOUNT, keepRequest);
  check(keepReplay.replay === true && psql(main, "select count(*) from public.game_conflict_resolutions where conflict_id='" + keep.conflict_id + "';").stdout === "1", "identical resolution replay is idempotent");

  const apply = makeConflict(main, "apply-game", "apply");
  const applied = resolutionCall(main, ACCOUNT, resolution(apply, "resolve-apply", "apply_proposed"));
  check(applied.code === "resolution_applied" && psql(main, "select opponent from public.games where id='apply-game';").stdout === "apply-proposed", "apply_proposed reapplies the bounded proposal at the current version");

  const patchConflict = makeConflict(main, "patch-game", "patch");
  const patched = resolutionCall(main, ACCOUNT, resolution(patchConflict, "resolve-patch", "apply_patch", { location: "Synthetic Field" }));
  check(patched.code === "resolution_applied" && psql(main, "select location from public.games where id='patch-game';").stdout === "Synthetic Field", "apply_patch accepts only a bounded allowlisted correction");
  const invalidPatchConflict = makeConflict(main, "dismiss-game", "invalid-patch");
  const invalidPatch = resolutionCall(main, ACCOUNT, resolution(invalidPatchConflict, "resolve-invalid-patch", "apply_patch", { note: "private" }));
  check(invalidPatch.code === "invalid_resolution_patch", "unknown or private patch fields fail closed");
  const dismissed = resolutionCall(main, ACCOUNT, resolution(invalidPatchConflict, "resolve-dismiss", "dismiss"));
  check(dismissed.code === "resolution_dismissed"
    && psql(main, "select opponent||'|'||coalesce(location,'') from public.games where id='dismiss-game';").stdout === "invalid-patch-current|",
  "dismiss is a distinct terminal append-only action with no semantic game mutation");

  const stale = makeConflict(main, "stale-game", "stale");
  const remote = gameCall(main, gameOperation({ id: "stale-remote", game: "stale-game", base: 2, changes: { opponent: "newer-current" } }));
  assert.equal(remote.outcome, "accepted");
  const staleResult = resolutionCall(main, ACCOUNT, resolution(stale, "resolve-stale", "apply_proposed"));
  check(staleResult.code === "resolution_stale" && psql(main, "select opponent from public.games where id='stale-game';").stdout === "newer-current", "stale resolution cannot overwrite newer evidence");
  check(psql(main, `select count(*) from public.game_conflicts where parent_conflict_id='${stale.conflict_id}';`).stdout === "1", "stale resolution creates one linked immutable conflict");

  const stalePatch = makeConflict(main, "patch-stale-game", "patch-stale");
  const newerPatchBase = gameCall(main, gameOperation({ id: "patch-stale-remote", game: "patch-stale-game", base: 2, changes: { opponent: "newer-patch-current" } }));
  assert.equal(newerPatchBase.outcome, "accepted");
  const stalePatchResult = resolutionCall(main, ACCOUNT, resolution(stalePatch, "resolve-patch-stale", "apply_patch", { location: "Must Not Apply" }));
  check(stalePatchResult.code === "resolution_stale"
    && psql(main, "select opponent||'|'||coalesce(location,'') from public.games where id='patch-stale-game';").stdout === "newer-patch-current|",
  "apply_patch requires exact current versions and cannot overwrite a newer value");

  const revoked = makeConflict(main, "revoked-game", "revoked");
  psql(main, `update public.games set user_id='${OTHER}' where id='revoked-game';`);
  const revokedRead = readCall(main, ACCOUNT, "revoked-game");
  const revokedResolve = resolutionCall(main, ACCOUNT, resolution(revoked, "resolve-revoked", "keep_server"));
  check(revokedRead.code === "authorization_denied" && revokedResolve.code === "authorization_denied", "loss of current personal authority blocks read and resolution without conflict disclosure");
  check(psql(main, `${claims(ACCOUNT)} select count(*) from public.game_conflicts where game_id='revoked-game'; reset role;`).stdout.split(/\r?\n/).at(-1) === "0", "direct-table RLS matches revoked-authority RPC denial");

  psql(main, `
    insert into public.teams(id,name,invite_code,created_by) values ('team-r207d','Synthetic Adult Team','TEAM-D07','${ACCOUNT}');
    insert into public.team_members(id,team_id,user_id,role) values ('member-r207d','team-r207d','${TRACKER}','member');
    insert into public.roster_players(id,team_id,name,number) values ('roster-r207d','team-r207d','Synthetic Adult','00');
    insert into public.player_claims(id,team_id,roster_player_id,user_id) values ('claim-r207d','team-r207d','roster-r207d','${TRACKER}');
    insert into public.games(id,user_id,share_code,opponent,game_date,status,lifecycle_state,team_id,roster_player_id)
      values ('team-game','${ACCOUNT}','TEAMGAME','Initial','2026-08-09','in-progress','active','team-r207d','roster-r207d');
  `);
  const teamConflict = makeConflict(main, "team-game", "team", TRACKER);
  psql(main, "delete from public.player_claims where id='claim-r207d';");
  check(readCall(main, TRACKER, "team-game").code === "authorization_denied"
    && resolutionCall(main, TRACKER, resolution(teamConflict, "team-revoked", "keep_server")).code === "authorization_denied",
  "revoked team tracking authority blocks conflict read and resolution");
  check(readCall(main, ACCOUNT, "team-game").code === "authorization_denied", "copied team-game owner identity does not substitute for current roster authority");

  const deleted = makeConflict(main, "delete-game", "delete");
  psql(main, `delete from public.games where id='delete-game'; insert into public.legacy_game_tombstones(
    game_id,owner_user_id,deleted_by,deletion_id,device_id,deleted_at
  ) values ('delete-game','${ACCOUNT}','${ACCOUNT}','delete-r207d','synthetic-device',statement_timestamp());`);
  check(psql(main, `select action||'|'||outcome_code from public.game_conflict_resolutions where conflict_id='${deleted.conflict_id}';`).stdout === "superseded_by_delete|superseded_by_delete", "game deletion appends the terminal superseded_by_delete resolution");
  check(readCall(main, ACCOUNT, "delete-game").code === "game_deleted"
    && resolutionCall(main, ACCOUNT, resolution(deleted, "resolve-deleted", "apply_proposed")).code === "game_deleted",
  "tombstone precedence blocks private conflict disclosure and resurrection");
  check(psql(main, `${claims(ACCOUNT)} select count(*) from public.game_conflicts where game_id='delete-game'; reset role;`).stdout.split(/\r?\n/).at(-1) === "0", "direct app-role conflict SELECT exposes no deleted-game values");

  const grants = psql(main, "select has_table_privilege('authenticated','public.game_conflicts','select')::text||','||has_table_privilege('authenticated','public.game_conflicts','insert')::text||','||has_table_privilege('anon','public.game_conflicts','select')::text;").stdout;
  check(grants === "true,false,false", "explicit Data API grants permit authenticated SELECT only and keep anon/private DML closed");
  check(psql(main, "select relrowsecurity::text||','||relforcerowsecurity::text from pg_class where oid='public.game_conflicts'::regclass;").stdout === "true,true", "conflict evidence remains protected by enabled and forced RLS");
  const unsafeInsert = psql(main, `insert into public.game_conflicts(
    account_id,game_id,actor_user_id,operation_id,conflict_type,field_group,client_base_version,current_server_version,
    overlapping_fields,current_values,proposed_values
  ) select '${ACCOUNT}','keep-game','${ACCOUNT}',operation_id,'field_overlap','metadata',1,2,array['opponent'],
    '{"note":"private"}'::jsonb,'{"opponent":"safe"}'::jsonb from public.game_sync_operations limit 1;`, true);
  check(unsafeInsert.status !== 0 && /game_conflicts_bounded_values_r207d_check/.test(unsafeInsert.stderr), "conflict storage rejects unknown private values");
  check(psql(main, `select lh_sync_private.r207_conflict_values_valid('roster_context','{"player_id":null}'::jsonb);`).stdout === "t", "unselected roster context remains a valid bounded conflict value");
  const rollbackRefusal = psql(main, "update public.r207_preview_control set preview_enabled=false where control_id;" + read("rollback", "20260809201608_r207d_conflict_resolution_foundation_rollback.sql"), true);
  check(rollbackRefusal.status !== 0 && /r207d_rollback_refused/.test(rollbackRefusal.stderr), "rollback refuses after append-only resolution evidence");

  const empty = await start("empty");
  psql(empty, "update public.r207_preview_control set preview_enabled=false where control_id;" + read("rollback", "20260809201608_r207d_conflict_resolution_foundation_rollback.sql"));
  check(psql(empty, "select public.laxhornet_read_game_conflicts_v1('{}'::jsonb)->>'code';").stdout === "authentication_required", "zero-evidence rollback restores the dormant authenticated contract");
  console.log(`R2-07D Preview migration: ${checks}/${checks} passed`);
} finally {
  for (const container of containers) docker(["rm", "-f", container], { allowFailure: true });
  const residue = docker(["ps", "-a", "--filter", "name=laxhornet-r207d-", "--format", "{{.Names}}"], { allowFailure: true }).stdout.trim();
  assert.equal(residue, "", `R2-07D container residue: ${residue}`);
}
