import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS } from "./release_containment.mjs";

const root = path.resolve(import.meta.dirname, "..");
const [
  migrationPath,
  rollbackPath,
  authorizationTestPath,
  reproductionTestPath,
] = TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS;
const manifestPath = "release/laxhornet-release-manifest.json";
const results = [];

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function reviewedTextSha256(file) {
  const canonicalCrLf = fs
    .readFileSync(path.join(root, file), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\r\n");
  return createHash("sha256")
    .update(Buffer.from(canonicalCrLf, "utf8"))
    .digest("hex");
}

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

const migration = source(migrationPath);
const rollback = source(rollbackPath);
const authorizationTest = source(authorizationTestPath);
const reproductionTest = source(reproductionTestPath);
const manifest = JSON.parse(source(manifestPath));
const reviewPackage = manifest.reviewDatabasePackages?.find(
  (entry) => entry.name === "team_members_rls_recursion",
);

test("bounded package paths exist", () => {
  for (const file of TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test("migration separates production hashes from the local blank-chain hash", () => {
  assert.match(migration, /STATE_A_CAPTURED_RECURSIVE_DEFECT/);
  assert.match(migration, /75e5d59fce7de054e5f53d7d5d73f99e/);
  assert.match(migration, /STATE_B_CANONICAL_ONLY/);
  assert.match(migration, /c4a69b0c9f9660563eb7aa8ca6e1b3b6/);
  assert.match(migration, /LOCAL_BLANK_CHAIN_ONLY/);
  assert.match(migration, /1c9c5d532c262c3b9ec850552bdf0512/);
  assert.match(migration, /not has_table_privilege\('anon'/);
  assert.match(migration, /proc\.proconfig @> array\['row_security=off'\]/);
  assert.match(migration, /policy definition drift/);
});

test("private helper is bounded and hardened", () => {
  assert.match(
    migration,
    /create or replace function lh_rls_private\.current_team_role\(check_team_id text\)/,
  );
  assert.match(migration, /security definer\s+set search_path = pg_catalog\s+set row_security = off/);
  assert.match(migration, /from public\.team_members member/);
  assert.match(migration, /where auth\.uid\(\) is not null/);
  assert.match(migration, /and member\.user_id = auth\.uid\(\)/);
  assert.match(migration, /limit 1/);
  assert.match(migration, /revoke all on schema lh_rls_private from public, anon/);
  assert.match(
    migration,
    /grant execute on function lh_rls_private\.current_team_role\(text\)\s+to authenticated, service_role/,
  );
});

test("canonical policies do not recurse", () => {
  const finalPolicies = migration.slice(
    migration.indexOf('create policy "laxhornet read team members"'),
  );
  assert.doesNotMatch(
    finalPolicies,
    /exists\s*\(\s*select 1\s+from public\.team_members member/i,
  );
  assert.match(finalPolicies, /lh_rls_private\.current_team_role\(team_id\)/);
  assert.match(finalPolicies, /user_id = auth\.uid\(\)/);
});

test("grants and RLS are least privilege", () => {
  assert.match(migration, /revoke all on table public\.team_members from public, anon/);
  assert.match(
    migration,
    /revoke truncate, references, trigger on table public\.team_members\s+from authenticated, service_role/,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.team_members\s+to authenticated/,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.team_members\s+to service_role/,
  );
  assert.match(migration, /alter table public\.team_members force row level security/);
});

test("rollback is isolated and explicitly restores the captured defect", () => {
  for (const policy of ["select", "insert", "update", "delete"]) {
    assert.match(rollback, new RegExp(`team_members_${policy}_team`));
  }
  assert.match(rollback, /EMERGENCY ROLLBACK ONLY/i);
  assert.match(rollback, /restores (?:the )?SQLSTATE 42P17/i);
  assert.doesNotMatch(rollback, /\b(?:delete|update|truncate)\s+(?:from\s+)?public\./i);
  assert.doesNotMatch(rollback, /drop table/i);
});

test("reproduction covers all four operations with SQLSTATE 42P17", () => {
  assert.match(reproductionTest, /extensions\.plan\(4\)/);
  for (const operation of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
    assert.match(reproductionTest, new RegExp(`captured ${operation} policy reproduces SQLSTATE 42P17`));
  }
  assert.equal((reproductionTest.match(/'42P17'/g) || []).length, 4);
});

test("authorization test covers the required fail-closed matrix", () => {
  assert.match(authorizationTest, /extensions\.plan\(37\)/);
  for (const phrase of [
    "same-team tracker",
    "wrong team",
    "non-member",
    "accepted parent grant alone",
    "accepted coach grant alone",
    "revoked grant",
    "expired grant",
    "pending grant",
    "malformed grant provenance",
    "team-admin grant alone",
    "remove only its own membership",
    "anonymous membership read",
    "service role retains explicit maintenance",
  ]) {
    assert.match(authorizationTest, new RegExp(phrase, "i"));
  }
});

test("manifest records exact reviewed hashes and phase", () => {
  assert.ok(reviewPackage, "team_members_rls_recursion review package is missing");
  assert.equal(reviewPackage.productionAuthorizationRequired, true);
  assert.ok(
    ["approved_pending_production", "production_applied"].includes(reviewPackage.status),
    `unexpected package status: ${reviewPackage.status}`,
  );
  assert.deepEqual(
    [
      reviewPackage.forwardMigration,
      reviewPackage.rollbackReference,
      reviewPackage.testSql,
      reviewPackage.reproductionTestSql,
    ],
    TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS,
  );
  for (const file of TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS) {
    assert.equal(reviewPackage.sha256?.[file], reviewedTextSha256(file), file);
  }
});

test("manifest production phase is internally consistent", () => {
  const pending = manifest.expectedPendingProductionMigrations || [];
  const applied = manifest.expectedRemoteAppliedMigrations || [];
  if (reviewPackage.productionApplied) {
    assert.equal(reviewPackage.status, "production_applied");
    assert.equal(pending.includes(migrationPath), false);
    assert.equal(applied.at(-1), migrationPath);
  } else {
    assert.equal(reviewPackage.status, "approved_pending_production");
    assert.deepEqual(pending, [migrationPath]);
    assert.equal(applied.includes(migrationPath), false);
  }
});

const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(
    `${result.status.padEnd(4)} ${result.name}${result.error ? `: ${result.error}` : ""}`,
  );
}
console.log(
  `\n${results.length - failures.length}/${results.length} team_members RLS remediation tests passed.`,
);
if (failures.length) process.exitCode = 1;
