import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrations = [
  "20260723000000_laxhornet_legacy_baseline.sql",
  "20260723010000_trust_spine_release_1.sql",
  "20260723020000_minimum_necessary_disclosure.sql",
  "20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
  "20260723040000_event_pipeline_capabilities.sql",
  "20260727000000_tracked_playing_time_operations.sql",
  "20260728193942_v284_public_event_semantic_boundary.sql",
  "20260730134439_durable_game_tombstones.sql",
  "20260730151714_durable_game_tombstone_concurrency.sql",
  "20260806143128_r207a_dormant_concurrency_foundation.sql",
  "20260809155442_r207b_controlled_preview_integration.sql",
  "20260809164435_r207b_qualify_preview_game_update.sql",
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
  result.stdout = result.stdout.trim();
  result.stderr = result.stderr.trim();
  return result;
}

const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
grant usage on schema auth, extensions to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
create publication supabase_realtime;
${migrations.map((file) => read("migrations", file)).join("\n")}
`;

async function start(name) {
  const container = `laxhornet-r207b-${name}-${process.pid}`;
  containers.add(container);
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
  psql(container, bootstrap);
  return container;
}

const claims = (id) => `select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', false); set role authenticated;`;
const call = (container, id, operation) => JSON.parse(psql(container, `${claims(id)} select public.laxhornet_sync_game_v2($json$${JSON.stringify(operation)}$json$::jsonb)::text; reset role;`).stdout.split(/\r?\n/).reverse().find((line) => line.startsWith("{")));
const operation = (id, base, fields, changes) => ({ client_operation_id: id, game_id: "preview-game", request_hash: "a".repeat(64), operation_type: "metadata_patch", field_group: "metadata", base_version: base, changed_fields: fields, changes });

try {
  const main = await start("main");
  psql(main, `insert into auth.users(id,email) values ('${ACCOUNT}','a@example.invalid'),('${OTHER}','b@example.invalid'); insert into public.games(id,user_id,share_code,opponent,location,game_date,status) values ('preview-game','${ACCOUNT}','PREVIEW1','Original','Field 1','2026-08-09','in-progress');`);
  const dormant = call(main, ACCOUNT, operation("dormant", 1, ["opponent"], { opponent: "Blocked" }));
  check(dormant.code === "r207_not_activated", "migration default keeps public v2 write dormant");
  check(psql(main, `${claims(ACCOUNT)} select public.laxhornet_r207_preview_capability()::text; reset role;`).stdout.includes('"enabled": false'), "authenticated capability reports disabled without private state");
  psql(main, read("", "seed.sql"));
  check(psql(main, `${claims(ACCOUNT)} select public.laxhornet_r207_preview_capability()::text; reset role;`).stdout.includes('"enabled": true'), "isolated Preview seed explicitly enables bridge");
  const first = call(main, ACCOUNT, operation("first", 1, ["opponent"], { opponent: "Device A" }));
  check(first.outcome === "accepted" && first.versions?.metadata === 2, "first same-base write is accepted with server version");
  check(first.server_game?.id === "preview-game" && first.server_game?.opponent === "Device A", "qualified Preview refresh returns the accepted canonical game without 42702");
  const stale = call(main, ACCOUNT, operation("stale", 1, ["opponent"], { opponent: "Device B" }));
  check(stale.outcome === "conflicted" && psql(main, "select opponent from public.games where id='preview-game';").stdout === "Device A", "stale overlap conflicts without overwrite");
  const merged = call(main, ACCOUNT, operation("merged", 1, ["location"], { location: "Field 2" }));
  check(merged.outcome === "merged" && psql(main, "select opponent||'|'||location from public.games where id='preview-game';").stdout === "Device A|Field 2", "stale non-overlap merges without losing accepted field");
  const denied = call(main, OTHER, operation("denied", 3, ["opponent"], { opponent: "Probe" }));
  check(denied.code === "authorization_denied" && !JSON.stringify(denied).includes("Device A"), "unauthorized actor receives bounded non-enumerating denial");
  const direct = psql(main, `${claims(ACCOUNT)} select * from public.r207_preview_control;`, true);
  check(direct.status !== 0, "authenticated clients cannot read or mutate preview control table");
  psql(main, read("rollback", "20260809164435_r207b_qualify_preview_game_update_rollback.sql"));
  check(call(main, ACCOUNT, operation("after-hotfix-rollback", 3, ["opponent"], { opponent: "Blocked" })).code === "r207_not_activated", "hotfix rollback disables the bridge instead of restoring the ambiguous wrapper");
  const rollbackRefusal = psql(main, read("rollback", "20260809155442_r207b_controlled_preview_integration_rollback.sql"), true);
  check(rollbackRefusal.status !== 0 && /rollback_refused_after_operation_evidence/.test(rollbackRefusal.stderr), "rollback refuses after operation evidence");

  const empty = await start("empty");
  psql(empty, read("rollback", "20260809164435_r207b_qualify_preview_game_update_rollback.sql"));
  psql(empty, read("rollback", "20260809155442_r207b_controlled_preview_integration_rollback.sql"));
  check(psql(empty, "select to_regclass('public.r207_preview_control') is null;").stdout === "t", "zero-evidence rollback restores dormant foundation");
  check(docker(["ps", "-a", "--filter", "name=laxhornet-r207b-", "--format", "{{.Names}}"], { allowFailure: true }).stdout.trim().length > 0, "disposable test targets are scoped to R2-07B names");
  console.log(`R2-07B Preview migration: ${checks}/${checks} passed`);
} finally {
  for (const container of containers) docker(["rm", "-f", container], { allowFailure: true });
  const residue = docker(["ps", "-a", "--filter", "name=laxhornet-r207b-", "--format", "{{.Names}}"], { allowFailure: true }).stdout.trim();
  assert.equal(residue, "", `R2-07B container residue: ${residue}`);
}
