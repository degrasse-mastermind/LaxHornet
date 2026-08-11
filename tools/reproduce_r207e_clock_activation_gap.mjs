import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const container = `laxhornet-r207e-clock-gap-${process.pid}`;
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
];
const account = "00000000-0000-4000-8000-00000000000a";
let checks = 0;

function docker(args, options = {}) {
  return spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout || 180000,
  });
}

function psql(sql) {
  const result = docker([
    "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
    "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
  ], { input: sql });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log(`CONFIRMED: ${label}`);
}

try {
  const started = docker([
    "run", "-d", "--rm", "--name", container,
    "-e", "POSTGRES_PASSWORD=synthetic-only", "postgres:17-alpine",
  ]);
  if (started.status !== 0) throw new Error(started.stderr);
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const probe = docker(["exec", container, "pg_isready", "-U", "postgres"]);
    if (probe.status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "disposable PostgreSQL 17 target did not become ready");

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
${migrations.map((file) => fs.readFileSync(path.join(root, "supabase", "migrations", file), "utf8")).join("\n")}
insert into auth.users(id, email) values ('${account}', 'synthetic-adult@example.invalid');
update public.r207_preview_control set preview_enabled = true;
`;
  psql(bootstrap);

  const claims = `select set_config('request.jwt.claims', '{"sub":"${account}","role":"authenticated"}', false); set role authenticated;`;
  const command = JSON.parse(psql(`${claims} select public.lh_apply_game_clock_operation_v2('{}'::jsonb)::text; reset role;`).split(/\r?\n/).at(-1));
  const batch = JSON.parse(psql(`${claims} select public.lh_apply_game_clock_batch_v2('{}'::jsonb)::text; reset role;`).split(/\r?\n/).at(-1));
  check(command.code === "r207_not_activated", "Preview-enabled exact migration chain leaves online clock wrapper dormant");
  check(batch.code === "r207_not_activated", "Preview-enabled exact migration chain leaves offline clock-batch wrapper dormant");

  const allMigrationSource = migrations
    .map((file) => fs.readFileSync(path.join(root, "supabase", "migrations", file), "utf8"))
    .join("\n");
  const commandDefinitions = allMigrationSource.match(/create or replace function public\.lh_apply_game_clock_operation_v2\s*\(/gi) || [];
  const batchDefinitions = allMigrationSource.match(/create or replace function public\.lh_apply_game_clock_batch_v2\s*\(/gi) || [];
  check(commandDefinitions.length === 1 && batchDefinitions.length === 1,
    "No post-R2-07A migration replaces the dormant public clock wrappers");

  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
  check(!appSource.includes("lh_apply_game_clock_operation_v2")
    && !appSource.includes("lh_apply_game_clock_batch_v2"),
  "Client runtime has no R2-07 online clock-command or offline clock-batch path");

  console.log(`R2-07E material clock activation gap reproduced: ${checks}/${checks}`);
} finally {
  docker(["rm", "-f", container]);
  const residue = docker(["ps", "-a", "--filter", `name=${container}`, "--format", "{{.Names}}"]);
  assert.equal(residue.stdout.trim(), "", "disposable clock-gap container residue remains");
}
