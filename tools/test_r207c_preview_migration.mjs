import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
  "20260809173500_r207c_versioned_event_corrections.sql",
];
const ACCOUNT = "00000000-0000-4000-8000-00000000000a";
const OTHER = "00000000-0000-4000-8000-00000000000b";
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
function psqlAsync(container, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { cwd: root });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject); child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)));
    child.stdin.end(sql);
  });
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
  const container = `laxhornet-r207c-${name}-${process.pid}`; containers.add(container);
  docker(["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=synthetic-only", "postgres:17-alpine"]);
  let consecutiveReady = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (docker(["exec", container, "pg_isready", "-U", "postgres"], { allowFailure: true }).status === 0) {
      consecutiveReady += 1;
      if (consecutiveReady >= 3) break;
    } else {
      consecutiveReady = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(consecutiveReady >= 3, "disposable PostgreSQL target did not become ready");
  psql(container, bootstrap); return container;
}
const claims = (id) => `select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', false); set role authenticated;`;
const event = (overrides = {}) => ({ timestamp: "2026-08-09T12:00:00Z", quarter: "Q1", stat_type: "goal", stat_label: "Goal", category: "Offense", point_value: 1, tags: [], note: "", field_zone: "", ...overrides });
const operation = (id, type, eventId, base, changes = {}, extra = {}) => ({ client_operation_id: id, game_id: extra.game_id || "game-a", event_id: eventId, operation_type: type, base_event_version: base, expected_game_lifecycle: extra.lifecycle || "active", changes, client_created_at: "2026-08-09T12:00:00Z" });
const sqlCall = (id, op) => `${claims(id)} select public.laxhornet_sync_event_v2($json$${JSON.stringify(op)}$json$::jsonb)::text; reset role;`;
const parse = (text) => JSON.parse(text.split(/\r?\n/).reverse().find((line) => line.startsWith("{")));
const call = (container, id, op) => parse(psql(container, sqlCall(id, op)).stdout);

try {
  const main = await start("main");
  psql(main, `insert into auth.users(id,email) values ('${ACCOUNT}','a@example.invalid'),('${OTHER}','b@example.invalid'); insert into public.games(id,user_id,share_code,opponent,game_date,status,lifecycle_state) values ('game-a','${ACCOUNT}','GAMEA123','A','2026-08-09','in-progress','active'),('game-complete','${ACCOUNT}','GAMEC123','C','2026-08-09','complete','completed');`);
  check(call(main, ACCOUNT, operation("dormant", "create", "event-a", 0, event())).code === "r207_not_activated", "R2-07C RPC remains dormant by migration default");
  psql(main, read("", "seed.sql"));
  const created = call(main, ACCOUNT, operation("create-a", "create", "event-a", 0, event()));
  check(created.outcome === "accepted" && created.server_event_version === 1, "versioned event create is accepted at server version 1");
  check(psql(main, "select server_event_version||'|'||note from public.events where id='event-a';").stdout === "1|", "create writes one canonical legacy event head");
  const replay = call(main, ACCOUNT, operation("create-a", "create", "event-a", 0, event()));
  check(replay.code === "created" && psql(main, "select count(*) from public.events where id='event-a';").stdout === "1", "identical permanent operation replays without duplicate event");
  const mismatch = call(main, ACCOUNT, operation("create-a", "create", "event-a", 0, event({ note: "tamper" })));
  check(mismatch.code === "duplicate_operation_id_payload_mismatch", "same operation ID with changed payload is rejected");
  const denied = call(main, OTHER, operation("denied", "correct", "event-a", 1, { note: "probe" }));
  check(denied.code === "authorization_denied" && !JSON.stringify(denied).includes("event-a"), "current authority denial is non-enumerating");
  const first = call(main, ACCOUNT, operation("correct-a", "correct", "event-a", 1, { note: "device-a" }));
  check(first.outcome === "accepted" && first.server_event_version === 2, "first same-base event correction is accepted");
  const overlap = call(main, ACCOUNT, operation("correct-b", "correct", "event-a", 1, { note: "device-b" }));
  check(overlap.code === "same_field_conflict" && psql(main, "select note from public.events where id='event-a';").stdout === "device-a", "stale same-field correction conflicts without overwrite");
  const merged = call(main, ACCOUNT, operation("correct-c", "correct", "event-a", 1, { field_zone: "crease" }));
  check(merged.outcome === "merged" && psql(main, "select note||'|'||field_zone from public.events where id='event-a';").stdout === "device-a|crease", "stale non-overlap correction merges with journal proof");
  check(psql(main, "select count(*) from public.legacy_event_field_changes where event_id='event-a';").stdout === "3", "accepted create and corrections retain immutable field history");
  const second = call(main, ACCOUNT, operation("create-b", "create", "event-b", 0, event({ note: "independent" })));
  check(second.outcome === "accepted" && psql(main, "select count(*) from public.events where game_id='game-a';").stdout === "2", "different event identity appends independently");
  const staleDelete = call(main, ACCOUNT, operation("delete-stale", "tombstone", "event-a", 2));
  check(staleDelete.code === "stale_event_version" && psql(main, "select count(*) from public.events where id='event-a';").stdout === "1", "stale event delete conflicts without data loss");
  const deleted = call(main, ACCOUNT, operation("delete-current", "tombstone", "event-a", 3));
  check(deleted.code === "tombstoned" && deleted.server_event_version === 4, "current-base event tombstone is accepted");
  check(psql(main, "select count(*)||'|'||(select final_event_version from public.legacy_event_tombstones where event_id='event-a') from public.events where id='event-a';").stdout === "0|4", "tombstone permanently removes the effective legacy head");
  const afterDelete = call(main, ACCOUNT, operation("after-delete", "correct", "event-a", 3, { note: "resurrect" }));
  check(afterDelete.code === "event_tombstoned" && psql(main, "select count(*) from public.events where id='event-a';").stdout === "0", "tombstone outranks later correction and prevents resurrection");
  const completeCreate = call(main, ACCOUNT, operation("complete-create", "create", "event-complete", 0, event(), { game_id: "game-complete", lifecycle: "completed" }));
  check(completeCreate.code === "completed_game_event_append_rejected", "completed lifecycle rejects ordinary event append");
  const lifecycleMismatch = call(main, ACCOUNT, operation("lifecycle-mismatch", "correct", "event-b", 1, { note: "stale" }, { lifecycle: "paused" }));
  check(lifecycleMismatch.code === "lifecycle_conflict", "explicit stale lifecycle base conflicts");
  const invalid = call(main, ACCOUNT, operation("invalid", "correct", "event-b", 1, { secret_field: "no" }));
  check(invalid.code === "invalid_operation", "unknown event field is rejected by the server allowlist");
  const oversized = call(main, ACCOUNT, operation("oversized", "correct", "event-b", 1, { note: "x".repeat(2001) }));
  check(oversized.code === "invalid_operation", "oversized private event value is rejected");

  const concurrentCreateA = operation("concurrent-a", "correct", "event-b", 1, { note: "race-a" });
  const concurrentCreateB = operation("concurrent-b", "correct", "event-b", 1, { note: "race-b" });
  const race = await Promise.all([psqlAsync(main, sqlCall(ACCOUNT, concurrentCreateA)), psqlAsync(main, sqlCall(ACCOUNT, concurrentCreateB))]);
  const raceResults = race.map(parse);
  check(raceResults.filter((item) => item.outcome === "accepted").length === 1 && raceResults.filter((item) => item.outcome === "conflicted").length === 1, "Docker concurrency serializes same-event same-field corrections");
  check(psql(main, "select count(*) from public.events where id='event-b';").stdout === "1", "concurrent correction race retains one effective event head");

  psql(main, "delete from public.games where id='game-a'; insert into public.legacy_game_tombstones(game_id,owner_user_id,deleted_by,deletion_id,device_id,deleted_at) values ('game-a','00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a','synthetic-delete','synthetic-device',statement_timestamp());");
  const gameDeleted = call(main, ACCOUNT, operation("game-deleted", "correct", "event-b", 1, { note: "blocked" }));
  check(gameDeleted.code === "game_deleted", "shared game lock checks durable game tombstone before event state");
  check(psql(main, `${claims(ACCOUNT)} select * from public.legacy_event_sync_operations;`, true).status !== 0, "app role cannot directly read operation evidence");
  const rollbackRefusal = psql(main, read("rollback", "20260809173500_r207c_versioned_event_corrections_rollback.sql"), true);
  check(rollbackRefusal.status !== 0 && /r207c_rollback_refused/.test(rollbackRefusal.stderr), "rollback refuses after versioned event evidence");

  const empty = await start("empty");
  psql(empty, read("rollback", "20260809173500_r207c_versioned_event_corrections_rollback.sql"));
  check(psql(empty, "select to_regclass('public.legacy_event_sync_operations') is null and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='server_event_version');").stdout === "t", "zero-evidence rollback removes only the R2-07C surface");
  console.log(`R2-07C Preview migration: ${checks}/${checks} passed`);
} finally {
  for (const container of containers) docker(["rm", "-f", container], { allowFailure: true });
  const residue = docker(["ps", "-a", "--filter", "name=laxhornet-r207c-", "--format", "{{.Names}}"], { allowFailure: true }).stdout.trim();
  assert.equal(residue, "", `R2-07C container residue: ${residue}`);
}
