import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_APPLICATION_SHA,
  PRODUCTION_PROJECT_REF,
  TOOLING_BRANCH,
} from "./v284_local_disclosure_fixture.mjs";
import {
  PRODUCTION_API_URL,
  PRODUCTION_ORIGIN,
  assertCleanupProof,
  assertPrewriteState,
  assertProductionTarget,
  parseApprovedToolingSha,
} from "./v284_production_disclosure_smoke.mjs";

const results = [];
const toolingSha = "a".repeat(40);
const validTarget = {
  projectRef: PRODUCTION_PROJECT_REF,
  apiUrl: PRODUCTION_API_URL,
  applicationOrigin: PRODUCTION_ORIGIN,
  approvedApplicationSha: APPROVED_APPLICATION_SHA,
  branch: TOOLING_BRANCH,
  headSha: toolingSha,
  approvedToolingSha: toolingSha,
  configProjectId: PRODUCTION_PROJECT_REF,
  workingTreeClean: true,
};
const validPrewrite = {
  migrationCount: 1,
  activeTokenCount: 0,
  hostedAssetsMatch: true,
  toolingAbsentFromDeployment: true,
};
const validCleanup = {
  authUsers: 0,
  authSessions: 0,
  refreshTokens: 0,
  legacyEvents: 0,
  legacyGames: 0,
  playerClaims: 0,
  teamMembers: 0,
  rosterPlayers: 0,
  teams: 0,
  userProfiles: 0,
  activeTokens: 0,
  activeGrants: 0,
  clockRows: 0,
  activeEventVersions: 0,
  activeParticipation: 0,
  pendingEventOperations: 0,
  conflictedEventOperations: 0,
  oldAccessTokenRejected: true,
  oldRefreshTokenRejected: true,
  oldPrivateRpcRejected: true,
  realDataTouched: false,
};

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

function rejects(name, callback, pattern) {
  test(name, () => assert.throws(callback, pattern));
}

test("accepts an exact approved production target", () => {
  assert.equal(assertProductionTarget(validTarget), true);
});
for (const [name, override, pattern] of [
  ["rejects a foreign Supabase project", { projectRef: "foreign" }, /project reference mismatch/],
  ["rejects a foreign API origin", { apiUrl: "https://example.invalid" }, /API origin mismatch/],
  ["rejects a foreign application origin", { applicationOrigin: "https://example.invalid" }, /application origin mismatch/],
  ["rejects application SHA drift", { approvedApplicationSha: "b".repeat(40) }, /application SHA mismatch/],
  ["rejects the wrong tooling branch", { branch: "main" }, /non-deployable tooling branch/],
  ["rejects unapproved tooling bytes", { headSha: "b".repeat(40) }, /independently approved SHA/],
  ["rejects a dirty tooling tree", { workingTreeClean: false }, /must be clean/],
  ["rejects a linked project mismatch", { configProjectId: "foreign" }, /linked Supabase project mismatch/],
]) {
  rejects(name, () => assertProductionTarget({ ...validTarget, ...override }), pattern);
}

test("requires a full explicit tooling SHA", () => {
  assert.equal(parseApprovedToolingSha(["--approved-tooling-sha", toolingSha]), toolingSha);
});
rejects("rejects a missing tooling SHA", () => parseApprovedToolingSha([]), /is required/);
rejects(
  "rejects an abbreviated tooling SHA",
  () => parseApprovedToolingSha(["--approved-tooling-sha", "abcdef0"]),
  /full Git SHA/,
);

test("accepts fail-closed prewrite state", () => {
  assert.equal(assertPrewriteState(validPrewrite), true);
});
for (const [name, override, pattern] of [
  ["rejects a missing migration", { migrationCount: 0 }, /exactly once/],
  ["rejects duplicate migration history", { migrationCount: 2 }, /exactly once/],
  ["rejects an active pre-existing share", { activeTokenCount: 1 }, /forbid synthetic production writes/],
  ["rejects hosted asset drift", { hostedAssetsMatch: false }, /hosted application bytes/],
  ["rejects deployed tooling", { toolingAbsentFromDeployment: false }, /entered the application tree/],
]) {
  rejects(name, () => assertPrewriteState({ ...validPrewrite, ...override }), pattern);
}

test("accepts exact-zero production cleanup", () => {
  assert.equal(assertCleanupProof(validCleanup), true);
});
for (const key of [
  "authUsers",
  "authSessions",
  "refreshTokens",
  "legacyEvents",
  "legacyGames",
  "playerClaims",
  "teamMembers",
  "rosterPlayers",
  "teams",
  "userProfiles",
  "activeTokens",
  "activeGrants",
  "clockRows",
  "activeEventVersions",
  "activeParticipation",
  "pendingEventOperations",
  "conflictedEventOperations",
]) {
  rejects(
    `rejects surviving ${key}`,
    () => assertCleanupProof({ ...validCleanup, [key]: 1 }),
    /survived production cleanup/,
  );
  rejects(
    `rejects unavailable ${key}`,
    () => assertCleanupProof({ ...validCleanup, [key]: null }),
    /not an integer/,
  );
}
rejects(
  "rejects usable old access token",
  () => assertCleanupProof({ ...validCleanup, oldAccessTokenRejected: false }),
  /retained authority/,
);
rejects(
  "rejects usable old refresh token",
  () => assertCleanupProof({ ...validCleanup, oldRefreshTokenRejected: false }),
  /remained usable/,
);
rejects(
  "rejects retained old private RPC authority",
  () => assertCleanupProof({ ...validCleanup, oldPrivateRpcRejected: false }),
  /private RPC authority/,
);
rejects(
  "rejects an ambiguous real-data boundary",
  () => assertCleanupProof({ ...validCleanup, realDataTouched: true }),
  /real-data boundary/,
);

test("runner contains mandatory production guards and fail-closed cleanup", () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, "v284_production_disclosure_smoke.mjs"),
    "utf8",
  );
  assert.match(source, /--approved-tooling-sha/);
  assert.match(source, /activeTokenCount/);
  assert.match(source, /PRODUCTION CLEANUP FAILED/);
  assert.match(source, /finally\s*\{/);
  assert.match(source, /tombstoneActiveEvents/);
  assert.match(source, /revokeTokens/);
  assert.match(source, /deleteAuthUsers/);
  assert.match(source, /removeMutableFixtureSql/);
  assert.match(source, /unsupported_event_semantics/);
  assert.match(source, /Legacy Participation Alias/);
  assert.match(source, /Player In at 12:34/);
  assert.doesNotMatch(source, /supabase\s+db\s+push|migration\s+repair|functions\s+deploy/i);
});

const failures = results.filter((item) => item.status === "FAIL");
for (const item of results) {
  process.stdout.write(`${item.status} ${item.name}${item.error ? `: ${item.error}` : ""}\n`);
}
if (failures.length) {
  process.stderr.write(`FAIL ${failures.length}/${results.length} production smoke safety contracts\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS ${results.length}/${results.length} production smoke safety contracts\n`);
}
