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
const productionSnapshotPath =
  "review-evidence/team-members-rls-remediation/production-policy-snapshot.json";
const productionStateCSnapshotPath =
  "review-evidence/team-members-rls-remediation/production-state-c-snapshot.json";
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
const productionSnapshot = JSON.parse(source(productionSnapshotPath));
const productionStateCSnapshot = JSON.parse(source(productionStateCSnapshotPath));
const reviewPackage = manifest.reviewDatabasePackages?.find(
  (entry) => entry.name === "team_members_rls_recursion",
);

test("bounded package paths exist", () => {
  for (const file of TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test("migration recognizes State C only inside a pinned authorization envelope", () => {
  assert.match(migration, /STATE_A_CAPTURED_RECURSIVE_DEFECT/);
  assert.match(migration, /75e5d59fce7de054e5f53d7d5d73f99e/);
  assert.match(migration, /STATE_B_CANONICAL_ONLY/);
  assert.match(migration, /c4a69b0c9f9660563eb7aa8ca6e1b3b6/);
  assert.match(migration, /system_identifier = '7642734024280108049'/);
  assert.match(migration, /STATE_C_SCALAR_SUBSELECT_CANONICAL/);
  assert.match(migration, /NONPRODUCTION_BLANK_CHAIN_ONLY/);
  assert.match(migration, /1c9c5d532c262c3b9ec850552bdf0512/);
  assert.match(migration, /76611f7aba7b5501a407d96446952895/);
  assert.match(migration, /production migration history drifted/);
  assert.match(migration, /policy definition drift/);
});

test("State C fixture binds exact policy and authorization metadata", () => {
  assert.equal(
    productionStateCSnapshot.policySet.orderedNormalizedMd5,
    "1c9c5d532c262c3b9ec850552bdf0512",
  );
  assert.deepEqual(
    productionStateCSnapshot.policySet.policies.map(
      (policy) => policy.normalizedEntryMd5,
    ),
    [
      "5b663d466b2e4f10e3b9f32d24b968fb",
      "41afbec61cde932584295d287b61e3e7",
      "884b66c34975337d3e49d25c2bcf5bda",
      "49400540bdacd1b5ad883cb9e8d91c0d",
    ],
  );
  assert.equal(
    productionStateCSnapshot.table.normalizedAclMd5,
    "76611f7aba7b5501a407d96446952895",
  );
  assert.equal(
    productionStateCSnapshot.helpers.normalizedSetSha256,
    "c6e861d2c426ddf7106e3787f5c7b12629f8fb6b7ab315d377d162e0a78aa341",
  );
  assert.equal(
    productionStateCSnapshot.migrationHistory.normalizedMd5,
    "257d70e2d82670b2b727575d7173a537",
  );
  assert.equal(
    createHash("sha256")
      .update(
        productionStateCSnapshot.authorizationEnvelope.bindingLines.join("\n"),
      )
      .digest("hex"),
    productionStateCSnapshot.authorizationEnvelope.sha256,
  );
  assert.equal(productionStateCSnapshot.privateHelperSchema.exists, false);
  assert.equal(productionStateCSnapshot.realUserDataTouched, false);
});

test("production preflight pins State C relation identity and helper volatility", () => {
  assert.match(migration, /is_production_cluster and class\.oid <> 17886/);
  for (const helperOid of [18006, 18004, 18076, 18077]) {
    assert.match(migration, new RegExp(`${helperOid}::oid`));
  }
  assert.match(migration, /language\.lanname <> expected\.language_name/);
  assert.match(migration, /proc\.provolatile::text <> expected\.volatility/);
  assert.match(
    migration,
    /is_production_cluster\s+and proc\.oid <> expected\.production_oid/,
  );
  for (const helper of productionStateCSnapshot.helpers.functions) {
    assert.match(
      productionStateCSnapshot.authorizationEnvelope.bindingLines.join("\n"),
      new RegExp(`oid=${helper.oid}`),
    );
  }
});

test("production preflight pins helpers, ACLs, FORCE RLS, and schema absence", () => {
  for (const sourceHash of [
    "c2b253cf74e691f048cf29a66ddbba76",
    "f9eb8573e91bc5758f94a3b997966a4e",
    "17e2d67b8cb33781debcc01d6f1578a6",
    "bd212e46e7fe3dc8057780eddf0d9240",
  ]) {
    assert.match(migration, new RegExp(sourceHash));
  }
  assert.match(migration, /class\.relforcerowsecurity/);
  assert.match(
    migration,
    /\{postgres=arwdDxtm\/postgres,anon=arwdDxtm\/postgres,authenticated=arwdDxtm\/postgres,service_role=arwdDxtm\/postgres\}/,
  );
  assert.match(migration, /private helper schema unexpectedly exists/);
  for (const historyEntry of productionSnapshot.migrationHistoryBefore
    .orderedVersionAndName) {
    assert.match(migration, new RegExp(historyEntry.replace(/[|]/g, "\\|")));
  }
  assert.deepEqual(
    productionSnapshot.sharedStartingMetadata.tablePrivileges.authenticated,
    [
      "DELETE",
      "INSERT",
      "MAINTAIN",
      "REFERENCES",
      "SELECT",
      "TRIGGER",
      "TRUNCATE",
      "UPDATE",
    ],
  );
  assert.doesNotMatch(migration, /create schema if not exists lh_rls_private/i);
  assert.doesNotMatch(
    migration,
    /create or replace function lh_rls_private\.current_team_role/i,
  );
});

test("private helper is bounded and hardened", () => {
  assert.match(
    migration,
    /create function lh_rls_private\.current_team_role\(check_team_id text\)/,
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
    /revoke truncate, references, trigger, maintain on table public\.team_members\s+from authenticated, service_role/,
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
  assert.match(authorizationTest, /extensions\.plan\(43\)/);
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
    "private helper schema has exact owner",
    "public authorization helpers have exact owner",
    "missing earlier migration history fails",
    "unexpected lower-version migration history fails",
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
  const stateCEvidencePaths = [
    reviewPackage.stateCFixture,
    reviewPackage.stateCAdjudication,
    reviewPackage.stateCTestTool,
  ];
  assert.deepEqual(stateCEvidencePaths, [
    "review-evidence/team-members-rls-remediation/production-state-c-snapshot.json",
    "review-evidence/team-members-rls-remediation/STATE_C_ADJUDICATION.md",
    "tools/test_team_members_state_c.mjs",
  ]);
  for (const file of stateCEvidencePaths) {
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
