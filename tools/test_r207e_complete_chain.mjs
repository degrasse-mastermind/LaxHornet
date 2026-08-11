import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(
  root,
  "review-evidence",
  "r2-07e-integrated-certification",
  "R2-07E_V2_BASELINE_MANIFEST.md",
);
const assertionPath = path.join(root, "supabase", "tests", "r207e_v2_complete_chain.sql");
const container = `laxhornet-r207e-chain-${process.pid}`;
const image = "postgres:17-alpine";

const migrations = [
  "20260723000000_laxhornet_legacy_baseline.sql",
  "20260723010000_trust_spine_release_1.sql",
  "20260723010607_remote_schema.sql",
  "20260723020000_minimum_necessary_disclosure.sql",
  "20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
  "20260723040000_event_pipeline_capabilities.sql",
  "20260727000000_tracked_playing_time_operations.sql",
  "20260728193942_v284_public_event_semantic_boundary.sql",
  "20260730004700_team_members_rls_recursion.sql",
  "20260730134439_durable_game_tombstones.sql",
  "20260730151714_durable_game_tombstone_concurrency.sql",
  "20260806143128_r207a_dormant_concurrency_foundation.sql",
  "20260809155442_r207b_controlled_preview_integration.sql",
  "20260809164435_r207b_qualify_preview_game_update.sql",
  "20260809173500_r207c_versioned_event_corrections.sql",
  "20260809201608_r207d_conflict_resolution_foundation.sql",
  "20260811010813_r207_clock_command_batch_integration.sql",
];

const rollbacks = [
  "20260723010000_trust_spine_release_1_rollback.sql",
  "20260723020000_minimum_necessary_disclosure_rollback.sql",
  "20260723040000_event_pipeline_capabilities_rollback.sql",
  "20260727000000_tracked_playing_time_operations_rollback.sql",
  "20260728193942_v284_public_event_semantic_boundary_rollback.sql",
  "20260730004700_team_members_rls_recursion_rollback.sql",
  "20260730134439_durable_game_tombstones_rollback.sql",
  "20260730151714_durable_game_tombstone_concurrency_rollback.sql",
  "20260806143128_r207a_dormant_concurrency_foundation_rollback.sql",
  "20260809155442_r207b_controlled_preview_integration_rollback.sql",
  "20260809164435_r207b_qualify_preview_game_update_rollback.sql",
  "20260809173500_r207c_versioned_event_corrections_rollback.sql",
  "20260809201608_r207d_conflict_resolution_foundation_rollback.sql",
  "20260811010813_r207_clock_command_batch_integration_rollback.sql",
];

function docker(args, input, allowFailure = false) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input,
    timeout: 180000,
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
  ], sql);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function git(args, encoding = "utf8") {
  const result = spawnSync("git", args, { cwd: root, encoding });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return result.stdout;
}

function expectedHashes() {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const baseline = manifest.match(/Certification baseline: `([0-9a-f]{40})`/i)?.[1];
  assert.ok(baseline, "certification baseline SHA is missing from the manifest");
  const values = new Map();
  for (const match of manifest.matchAll(/\| `([^`]+)` \| `([0-9a-f]{64})` \|/g)) {
    values.set(match[1].replaceAll("/", path.sep), match[2]);
  }
  return { baseline, values };
}

function verifyInventory(folder, names, baseline, hashes) {
  const actual = fs.readdirSync(path.join(root, "supabase", folder))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(actual, [...names].sort(), `${folder} inventory drifted from the 17/14 certification contract`);
  for (const name of names) {
    const relative = path.join("supabase", folder, name);
    const gitPath = relative.replaceAll(path.sep, "/");
    const bytes = git(["show", `${baseline}:${gitPath}`], null);
    assert.equal(sha256(bytes), hashes.get(relative), `${relative} Git-blob SHA-256 drifted from the baseline manifest`);
    git(["diff", "--quiet", baseline, "--", gitPath]);
  }
}

const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(
  version text primary key,
  name text not null
);
create table auth.users(
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema auth, extensions to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
create publication supabase_realtime;
`;

try {
  const { baseline, values: hashes } = expectedHashes();
  verifyInventory("migrations", migrations, baseline, hashes);
  verifyInventory("rollback", rollbacks, baseline, hashes);
  console.log("PASS: exact 17-migration and 14-rollback inventories match the baseline manifest");

  docker(["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=synthetic-only", image]);
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (docker(["exec", container, "pg_isready", "-U", "postgres", "-d", "postgres"], undefined, true).status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "fresh disposable PostgreSQL 17 target did not become ready");
  console.log(`PASS: container ${container} started from empty ${image}`);

  psql(bootstrap);
  for (const name of migrations) {
    if (name === "20260730004700_team_members_rls_recursion.sql") {
      psql(`
        revoke all privileges on table public.team_members
          from anon, authenticated, service_role;
        grant truncate, references, trigger, maintain
          on table public.team_members to anon;
        grant all privileges on table public.team_members to authenticated;
        grant truncate, references, trigger, maintain
          on table public.team_members to service_role;
      `);
      const acl = psql("select relacl::text from pg_class where oid='public.team_members'::regclass;").stdout.trim();
      console.log(`PASS: established the nonproduction Supabase ACL envelope ${acl}`);
    }
    psql(fs.readFileSync(path.join(root, "supabase", "migrations", name), "utf8"));
    const match = name.match(/^(\d+)_(.+)\.sql$/);
    assert.ok(match, `migration filename is not canonical: ${name}`);
    psql(`insert into supabase_migrations.schema_migrations(version, name) values ('${match[1]}', '${match[2]}');`);
    console.log(`PASS: applied migration ${name}`);
  }
  assert.equal(migrations.length, 17);
  console.log("PASS: complete ordered migration chain applied 17/17");

  psql(fs.readFileSync(assertionPath, "utf8"));
  console.log("PASS: final A/B/B-fix/C/D/clock schema, RLS, grants, and default-off assertions");

  for (const name of [...rollbacks].reverse()) {
    psql(fs.readFileSync(path.join(root, "supabase", "rollback", name), "utf8"));
    console.log(`PASS: executed zero-evidence rollback ${name}`);
  }
  assert.equal(rollbacks.length, 14);
  console.log("PASS: all applicable zero-evidence rollbacks executed 14/14 in reverse order");
  console.log("R2-07E V2 complete-chain disposable PostgreSQL gate: PASS");
} finally {
  docker(["stop", container], undefined, true);
  const residue = docker([
    "ps", "-a", "--filter", "name=laxhornet-r207e-chain-", "--format", "{{.Names}}",
  ], undefined, true).stdout.trim();
  assert.equal(residue, "", `R2-07E complete-chain container residue remains: ${residue}`);
  console.log("PASS: complete-chain container cleanup left zero residue");
}
