import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_APPLICATION_SHA,
  APPROVED_DEPLOYMENT_BRANCH,
  LIFECYCLE_KEYS,
  LOCAL_API_URL,
  LOCAL_DB_CONTAINER,
  LOCAL_DB_URL,
  LOCAL_PROJECT_ID,
  PRODUCTION_HOST,
  PRODUCTION_PROJECT_REF,
  SYNTHETIC_PREFIX,
  TOOLING_BRANCH,
  TOOLING_PATHS,
  assertDeploymentIsolationSnapshot,
  assertHomogeneousLifecycleBatch,
  assertSessionRevocationProof,
  assertSyntheticFixtureDescriptor,
  assertTeardownProof,
  completeLocalTeardown,
  validateLocalTarget,
  verifyApprovedApplicationIsolation,
} from "./v284_local_disclosure_fixture.mjs";

const results = [];
const runId = `${SYNTHETIC_PREFIX}unit`;
const validTarget = {
  apiUrl: LOCAL_API_URL,
  dbUrl: LOCAL_DB_URL,
  projectId: LOCAL_PROJECT_ID,
  containerName: LOCAL_DB_CONTAINER,
  fixturePrefix: SYNTHETIC_PREFIX,
};
const canonicalRecord = {
  actor_grant_id: `${runId}-admin-grant`,
  actor_user_id: "00000000-0000-4000-8000-000000000001",
  event_type: "grant_issued",
  grant_id: `${runId}-coach-grant`,
  id: `${runId}-lifecycle-1`,
  occurred_at: "2026-07-28T12:00:00.000Z",
  reason: null,
  related_grant_id: null,
  sequence: 1,
};

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

async function testAsync(name, callback) {
  try {
    await callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

function rejects(name, callback, pattern) {
  test(name, () => assert.throws(callback, pattern));
}

function deploymentSnapshot(overrides = {}) {
  return {
    approvedSha: APPROVED_APPLICATION_SHA,
    approvedRefSha: APPROVED_APPLICATION_SHA,
    deploymentBranch: APPROVED_DEPLOYMENT_BRANCH,
    treePaths: ["app.html", "app.js", "service-worker.js", "release/laxhornet-release-manifest.json"],
    runtimeSources: {
      "app.html": "<script src=\"app.js\"></script>",
      "app.js": "console.log('app');",
      "service-worker.js": "const ASSETS = ['app.js'];",
      "release/laxhornet-release-manifest.json": "{\"release\":\"v284\"}",
    },
    workflowSources: {
      ".github/workflows/laxhornet-regression.yml": "on: [push]",
    },
    ...overrides,
  };
}

function validSessionProof(overrides = {}) {
  return {
    logoutStatus: 204,
    sessionsRemaining: 0,
    refreshTokensRemaining: 0,
    oldAuthTokenRejected: true,
    oldRefreshTokenRejected: true,
    oldPrivateRpcRejected: true,
    usersRemaining: 0,
    accessTokenFingerprint: "a1b2c3d4e5f6",
    refreshTokenFingerprint: "0f1e2d3c4b5a",
    ...overrides,
  };
}

test("accepts the exact disposable local target", () => {
  assert.equal(validateLocalTarget(validTarget), true);
});

rejects(
  "rejects the production API host",
  () => validateLocalTarget({ ...validTarget, apiUrl: `https://${PRODUCTION_HOST}` }),
  /must use HTTP|loopback|port mismatch|production host is forbidden/,
);
rejects(
  "rejects the production database host",
  () => validateLocalTarget({
    ...validTarget,
    dbUrl: `postgresql://postgres:postgres@db.${PRODUCTION_HOST}:5432/postgres`,
  }),
  /loopback|port mismatch|production host is forbidden/,
);
rejects(
  "rejects the production project reference",
  () => validateLocalTarget({ ...validTarget, projectId: PRODUCTION_PROJECT_REF }),
  /project ID mismatch|production project reference is forbidden/,
);
rejects(
  "rejects a nonstandard local API port",
  () => validateLocalTarget({ ...validTarget, apiUrl: "http://127.0.0.1:54320" }),
  /port mismatch/,
);
rejects(
  "rejects a nonstandard local database",
  () => validateLocalTarget({
    ...validTarget,
    dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/production",
  }),
  /database name mismatch/,
);
rejects(
  "rejects a mismatched container",
  () => validateLocalTarget({ ...validTarget, containerName: "supabase_db_other" }),
  /container mismatch/,
);

test("accepts one canonical nine-key lifecycle record", () => {
  const result = assertHomogeneousLifecycleBatch([canonicalRecord], runId);
  assert.equal(result.recordCount, 1);
  assert.deepEqual(result.keys, [...LIFECYCLE_KEYS].sort());
});
rejects(
  "rejects heterogeneous lifecycle record shapes",
  () => assertHomogeneousLifecycleBatch([
    canonicalRecord,
    { ...canonicalRecord, id: `${runId}-lifecycle-2`, sequence: 2, extra: true },
  ], runId),
  /heterogeneous lifecycle batch rejected/,
);
rejects(
  "rejects undefined lifecycle values before serialization",
  () => assertHomogeneousLifecycleBatch([
    { ...canonicalRecord, reason: undefined },
  ], runId),
  /undefined fixture value/,
);
rejects(
  "rejects non-synthetic lifecycle identifiers",
  () => assertHomogeneousLifecycleBatch([
    { ...canonicalRecord, grant_id: "real-team-grant" },
  ], runId),
  /non-synthetic grant_id rejected/,
);
rejects(
  "rejects credential-shaped lifecycle data",
  () => assertHomogeneousLifecycleBatch([
    { ...canonicalRecord, reason: "access_token" },
  ], runId),
  /credential-shaped value is forbidden/,
);

test("accepts a fully synthetic fixture descriptor", () => {
  assert.equal(assertSyntheticFixtureDescriptor({
    runId,
    ids: {
      team: `${runId}-team`,
      game: `${runId}-game`,
      player: `${runId}-player`,
    },
    adminEmail: `${runId}-admin@example.invalid`,
    coachEmail: `${runId}-coach@example.invalid`,
    teamName: "V284 Synthetic Team",
    playerName: "V284 Synthetic Player",
    opponent: "V284 Synthetic Opponent",
  }), true);
});
rejects(
  "rejects a realistic fixture email",
  () => assertSyntheticFixtureDescriptor({
    runId,
    ids: { team: `${runId}-team` },
    adminEmail: "coach@example.com",
    coachEmail: `${runId}-coach@example.invalid`,
    teamName: "V284 Synthetic Team",
    playerName: "V284 Synthetic Player",
    opponent: "V284 Synthetic Opponent",
  }),
  /did not match/,
);
rejects(
  "rejects realistic fixture labels",
  () => assertSyntheticFixtureDescriptor({
    runId,
    ids: { team: `${runId}-team` },
    adminEmail: `${runId}-admin@example.invalid`,
    coachEmail: `${runId}-coach@example.invalid`,
    teamName: "LaxHornet Varsity",
    playerName: "V284 Synthetic Player",
    opponent: "V284 Synthetic Opponent",
  }),
  /did not match/,
);

test("runner has no production mutation command", () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, "v284_local_disclosure_fixture.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /supabase\s+(?:link|db\s+push|migration\s+repair|functions\s+deploy)/i);
  assert.doesNotMatch(source, /--linked\b/i);
  assert.match(source, /--no-backup/);
  assert.match(source, /validateLocalTarget/);
});

test("approved main tree is isolated from the tooling branch", () => {
  const result = verifyApprovedApplicationIsolation();
  assert.equal(result.approvedSha, APPROVED_APPLICATION_SHA);
  assert.equal(result.deploymentBranch, APPROVED_DEPLOYMENT_BRANCH);
  assert.equal(result.toolingPathsAbsent, true);
});
test("accepts an isolated exact-SHA deployment snapshot", () => {
  assert.equal(assertDeploymentIsolationSnapshot(deploymentSnapshot()).toolingPathsAbsent, true);
});
for (const toolingPath of TOOLING_PATHS) {
  rejects(
    `rejects approved application tree containing ${toolingPath}`,
    () => assertDeploymentIsolationSnapshot(deploymentSnapshot({
      treePaths: [...deploymentSnapshot().treePaths, toolingPath],
    })),
    /contains tooling path/,
  );
}
rejects(
  "rejects a tooling branch as deployment source",
  () => assertDeploymentIsolationSnapshot(deploymentSnapshot({ deploymentBranch: TOOLING_BRANCH })),
  /cannot be a deployment source/,
);
rejects(
  "rejects approved main SHA drift",
  () => assertDeploymentIsolationSnapshot(deploymentSnapshot({ approvedRefSha: "f".repeat(40) })),
  /ref drifted/,
);
for (const file of ["app.html", "app.js", "service-worker.js", "release/laxhornet-release-manifest.json"]) {
  rejects(
    `rejects tooling reference in ${file}`,
    () => assertDeploymentIsolationSnapshot(deploymentSnapshot({
      runtimeSources: {
        ...deploymentSnapshot().runtimeSources,
        [file]: "tools/v284_local_disclosure_fixture.mjs",
      },
    })),
    /references non-deployable tooling/,
  );
}
rejects(
  "rejects a deployment workflow that copies from the tooling branch",
  () => assertDeploymentIsolationSnapshot(deploymentSnapshot({
    workflowSources: {
      ".github/workflows/pages.yml": `git checkout ${TOOLING_BRANCH}`,
    },
  })),
  /copies or deploys non-deployable tooling/,
);

await testAsync("accepts fully proven teardown", async () => {
  let removed = false;
  const proof = await completeLocalTeardown("C:\\synthetic\\fixture", {
    stop: async () => ({ exitCode: 0 }),
    listContainers: async () => [],
    isPortOpen: async () => false,
    removeTemporaryRoot: async () => { removed = true; },
    temporaryRootExists: () => !removed,
  });
  assert.equal(proof.disposableStackRemoved, true);
});
await testAsync("rejects stop command failure", async () => {
  await assert.rejects(
    completeLocalTeardown("C:\\synthetic\\fixture", {
      stop: async () => ({ exitCode: 1 }),
    }),
    /did not exit 0/,
  );
});
await testAsync("rejects stop command timeout", async () => {
  await assert.rejects(
    completeLocalTeardown("C:\\synthetic\\fixture", {
      stop: async () => { throw new Error("timed out"); },
    }),
    /timed out/,
  );
});
await testAsync("rejects surviving disposable container", async () => {
  await assert.rejects(
    completeLocalTeardown("C:\\synthetic\\fixture", {
      stop: async () => ({ exitCode: 0 }),
      listContainers: async () => [LOCAL_DB_CONTAINER],
    }),
    /containers survived/,
  );
});
await testAsync("rejects surviving disposable port", async () => {
  await assert.rejects(
    completeLocalTeardown("C:\\synthetic\\fixture", {
      stop: async () => ({ exitCode: 0 }),
      listContainers: async () => [],
      isPortOpen: async (port) => port === 54321,
    }),
    /ports survived/,
  );
});
await testAsync("rejects partial teardown with surviving directory", async () => {
  await assert.rejects(
    completeLocalTeardown("C:\\synthetic\\fixture", {
      stop: async () => ({ exitCode: 0 }),
      listContainers: async () => [],
      isPortOpen: async () => false,
      removeTemporaryRoot: async () => {},
      temporaryRootExists: () => true,
    }),
    /directory survived/,
  );
});
await testAsync("rejects cleanup verifier failure", async () => {
  await assert.rejects(
    completeLocalTeardown("C:\\synthetic\\fixture", {
      stop: async () => ({ exitCode: 0 }),
      listContainers: async () => { throw new Error("inventory unavailable"); },
    }),
    /inventory unavailable/,
  );
});
rejects(
  "rejects optimistic teardown success flag",
  () => assertTeardownProof({
    stopExitCode: 0,
    remainingContainers: [],
    openPorts: [],
    temporaryRootRemoved: false,
    disposableStackRemoved: true,
  }),
  /directory survived/,
);

test("accepts complete Auth session-revocation proof", () => {
  assert.equal(assertSessionRevocationProof(validSessionProof()), true);
});
for (const [name, overrides, pattern] of [
  ["rejects logout failure", { logoutStatus: 500 }, /revocation failed/],
  ["rejects surviving Auth session", { sessionsRemaining: 1 }, /session remained/],
  ["rejects surviving refresh token", { refreshTokensRemaining: 1 }, /refresh token remained/],
  ["rejects deleted user with surviving session", { usersRemaining: 0, sessionsRemaining: 1 }, /session remained/],
  ["rejects usable old access token", { oldAuthTokenRejected: false }, /old access token/],
  ["rejects usable old refresh token", { oldRefreshTokenRejected: false }, /old refresh token/],
  ["rejects retained private RPC authority", { oldPrivateRpcRejected: false }, /private RPC authority/],
  ["rejects unavailable session inspection", { sessionsRemaining: undefined }, /session remained/],
  ["rejects false zero-session cleanup report", { sessionsRemaining: "unknown" }, /session remained/],
]) {
  rejects(name, () => assertSessionRevocationProof(validSessionProof(overrides)), pattern);
}

for (const result of results) {
  process.stdout.write(`${result.status} ${result.name}${result.error ? `: ${result.error}` : ""}\n`);
}
const failed = results.filter((result) => result.status === "FAIL");
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS ${results.length}/${results.length} local fixture safety contracts\n`);
}
