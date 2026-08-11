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
  "20260809173500_r207c_versioned_event_corrections.sql",
  "20260809201608_r207d_conflict_resolution_foundation.sql",
  "20260811010813_r207_clock_command_batch_integration.sql",
];
const container = `laxhornet-r207e-plans-${process.pid}`;
let checks = 0;

function docker(args, input, allowFailure = false) {
  const result = spawnSync("docker", args, {
    cwd: root, encoding: "utf8", input, timeout: 180000,
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`docker ${args.join(" ")} failed\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return result;
}

function psql(sql) {
  return docker([
    "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
    "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
  ], sql).stdout.trim();
}

function check(value, message, evidence = "") {
  assert.ok(value, `${message}\n${evidence}`);
  checks += 1;
  console.log(`PASS: ${message}`);
}

const source = (name) => fs.readFileSync(path.join(root, "supabase", "migrations", name), "utf8");
const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema auth, extensions to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
create publication supabase_realtime;
${migrations.map(source).join("\n")}
`;

const plans = [
  ["operation identity", "game_sync_operations_actor_client_r207_key", "select * from public.game_sync_operations where actor_user_id='00000000-0000-4000-8000-00000000000a' and client_operation_id='op'"],
  ["field journal overlap", "game_field_changes_overlap_r207_idx", "select changed_fields from public.game_field_changes where game_id='game' and field_group='metadata' and result_version > 1"],
  ["conflict lookup", "game_conflicts_account_r207_idx", "select * from public.game_conflicts where account_id='00000000-0000-4000-8000-00000000000a' order by created_at desc limit 25"],
  ["event identity/version", "legacy_event_sync_operations_event_version_idx", "select * from public.legacy_event_sync_operations where event_id='event' and outcome_class in ('accepted','merged') order by result_event_version desc limit 1"],
  ["clock receipt", "game_clock_commands_game_r207_idx", "select * from public.game_clock_commands where game_id='game' order by result_clock_version desc limit 1"],
  ["clock batch replay", "game_clock_batches_actor_client_r207clock_idx", "select * from public.game_clock_batches where actor_user_id='00000000-0000-4000-8000-00000000000a' and client_batch_id='batch' order by command_count desc limit 1"],
];

try {
  docker(["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=synthetic-only", "postgres:17-alpine"]);
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const probe = docker(["exec", container, "pg_isready", "-U", "postgres", "-d", "postgres"], undefined, true);
    if (probe.status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  check(ready, "disposable PostgreSQL query-plan target became ready");
  psql(bootstrap);
  for (const [label, indexName, query] of plans) {
    const plan = psql(`set enable_seqscan=off; explain (format json, costs off) ${query};`);
    check(plan.includes(indexName), `${label} lookup has an executable intended index path`, plan);
  }
  const a = source("20260806143128_r207a_dormant_concurrency_foundation.sql");
  const c = source("20260809173500_r207c_versioned_event_corrections.sql");
  const clock = source("20260811010813_r207_clock_command_batch_integration.sql");
  check(
    [a, c, clock].every((sql) => sql.includes("pg_advisory_xact_lock")),
    "game, event, and clock paths retain transaction-scoped advisory locks",
  );
  console.log(`R2-07E representative query-plan checks: ${checks}/${checks} passed`);
} finally {
  docker(["stop", container], undefined, true);
  const residue = docker(["ps", "-a", "--filter", "name=laxhornet-r207e-plans-", "--format", "{{.Names}}"], undefined, true).stdout.trim();
  if (residue) throw new Error(`R2-07E query-plan container residue remains: ${residue}`);
  console.log("PASS: query-plan container cleanup left zero residue");
}
