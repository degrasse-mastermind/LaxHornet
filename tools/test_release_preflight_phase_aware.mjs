import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  evaluateReleaseIdentity,
  evaluateReleaseCloseoutGate,
  evaluateRuntimeMigrationDependency,
  findReleaseSurfaceFailures,
  reviewedTextSha256,
  validateManifestReleaseIdentity,
} from "./run_release_preflight.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const reconciledManifest = JSON.parse(
  fs.readFileSync(
    path.join(sourceRoot, "release", "laxhornet-release-manifest.json"),
    "utf8",
  ),
);
const base = "fc9c079d69757cfc2667dea7e1dfcc56524dce56";
const releaseHead = "1cf5d9d33a7295da8248353165a696b7b81690db";
const merge = "e2cd28a568e91232d375a8607e6376800d3a2a20";
const incidentBase = "1221f418c1e005606d54c545148944f9ec69f132";
const incidentHead = "2222222222222222222222222222222222222222";
const later = "1111111111111111111111111111111111111111";
const manifest = {
  release: "v284",
  finalMainBaseSha: base,
  preReleaseBaseSha: base,
  releaseHeadSha: releaseHead,
  releaseHeadTreeSha: "20341b66dad600d1ae19f4eed20b55bb61752fbc",
  approvedMergeSha: merge,
  incidentRemediationBaseSha: incidentBase,
};
const ancestry = new Set([
  `${base}->${releaseHead}`,
  `${base}->${merge}`,
  `${merge}->${merge}`,
  `${merge}->${later}`,
  `${incidentBase}->${incidentHead}`,
]);
const isAncestor = (older, newer) => ancestry.has(`${older}->${newer}`);
const isSameTree = (left, right) => left === releaseHead && right === merge;
const tests = [];

function test(name, fn) {
  try {
    fn();
    tests.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    tests.push({ name, ok: false, error });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function preparation(overrides = {}) {
  return evaluateReleaseIdentity({
    phase: "preparation",
    release: "v284",
    branch: "release/v284-tracked-playing-time",
    headSha: releaseHead,
    mainSha: base,
    manifest,
    isAncestor,
    isSameTree,
    treeOf: (ref) => ref === merge ? manifest.releaseHeadTreeSha : "",
    ...overrides,
  });
}

function production(overrides = {}) {
  return evaluateReleaseIdentity({
    phase: "production",
    release: "v284",
    branch: "main",
    headSha: merge,
    mainSha: merge,
    manifest,
    isAncestor,
    isSameTree,
    treeOf: (ref) => ref === merge ? manifest.releaseHeadTreeSha : "",
    ...overrides,
  });
}

const allPass = (rows) => rows.every((row) => row.status === "PASS");
const failed = (rows, label) =>
  rows.some((row) => row.label === label && row.status === "FAIL");

test("preparation accepts the reviewed release branch and base", () => {
  assert.equal(allPass(preparation()), true);
});

test("preparation rejects the wrong branch", () => {
  assert.equal(failed(preparation({ branch: "main" }), "Current branch"), true);
});

test("preparation rejects the wrong pre-release base", () => {
  assert.equal(
    failed(preparation({ mainSha: merge }), "Pre-release main base"),
    true,
  );
});

test("preparation accepts the approved v284 incident-remediation branch and base", () => {
  assert.equal(
    allPass(preparation({
      branch: "fix/v284-public-event-semantic-boundary",
      headSha: incidentHead,
      mainSha: incidentBase,
    })),
    true,
  );
});

test("incident remediation rejects an unapproved main base", () => {
  assert.equal(
    failed(
      preparation({
        branch: "fix/v284-public-event-semantic-boundary",
        headSha: incidentHead,
        mainSha: merge,
      }),
      "Incident-remediation main base",
    ),
    true,
  );
});

test("manifest identity drift fails closed", () => {
  assert.notEqual(
    validateManifestReleaseIdentity({ ...manifest, preReleaseBaseSha: merge }, "v284").length,
    0,
  );
});

test("reviewed migration hash drift fails closed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-preflight-hash-"));
  try {
    const reviewed = path.join(root, "reviewed.sql");
    const drifted = path.join(root, "drifted.sql");
    fs.writeFileSync(reviewed, "select 1;\n");
    fs.writeFileSync(drifted, "select 2;\n");
    assert.notEqual(reviewedTextSha256(reviewed), reviewedTextSha256(drifted));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("production fails closed while either runtime migration dependency is pending", () => {
  const dependency = evaluateRuntimeMigrationDependency({
    runtimeDatabaseDependencies: [
      "supabase/migrations/20260729120000_durable_game_tombstones.sql",
      "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
    ],
    expectedPendingProductionMigrations: [
      "supabase/migrations/20260729120000_durable_game_tombstones.sql",
      "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
    ],
  }, "production");
  assert.equal(dependency.status, "FAIL");
  assert.deepEqual(dependency.pending, [
    "supabase/migrations/20260729120000_durable_game_tombstones.sql",
    "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
  ]);
});

test("preparation reports pending runtime dependencies without authorizing production", () => {
  const dependency = evaluateRuntimeMigrationDependency({
    runtimeDatabaseDependencies: [
      "supabase/migrations/20260729120000_durable_game_tombstones.sql",
      "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
    ],
    expectedPendingProductionMigrations: [
      "supabase/migrations/20260729120000_durable_game_tombstones.sql",
      "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
    ],
  }, "preparation");
  assert.equal(dependency.status, "PASS");
  assert.equal(dependency.pending.length, 2);
});

test("production dependency gate passes only after both migrations are recorded applied", () => {
  const dependency = evaluateRuntimeMigrationDependency({
    runtimeDatabaseDependencies: [
      "supabase/migrations/20260729120000_durable_game_tombstones.sql",
      "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
    ],
    expectedPendingProductionMigrations: [],
  }, "production");
  assert.equal(dependency.status, "PASS");
  assert.deepEqual(dependency.pending, []);
});

test("approved mixed evidence satisfies the production closeout gate", () => {
  const closeout = evaluateReleaseCloseoutGate(reconciledManifest, "production", {
    evidenceExists: (file) => fs.existsSync(path.join(sourceRoot, file)),
  });
  assert.equal(closeout.runtimeDatabaseReady, true);
  assert.equal(closeout.closeoutReady, true);
  assert.equal(closeout.status, "PASS");
});

test("preparation reports the approved closeout without treating it as activation", () => {
  const closeout = evaluateReleaseCloseoutGate(reconciledManifest, "preparation", {
    evidenceExists: (file) => fs.existsSync(path.join(sourceRoot, file)),
  });
  assert.equal(closeout.closeoutReady, true);
  assert.equal(closeout.status, "PASS");
});

test("production accepts the exact approved main merge SHA", () => {
  assert.equal(allPass(production()), true);
});

test("production requires the release head to be incorporated by the merge", () => {
  assert.equal(
    failed(
      production({
        isAncestor: () => false,
        isSameTree: () => false,
        treeOf: () => "",
      }),
      "Release head incorporated by approved merge",
    ),
    true,
  );
});

test("production requires the pre-release base to be an ancestor", () => {
  const selectiveAncestor = (older, newer) =>
    older === base && newer === merge ? false : isAncestor(older, newer);
  assert.equal(
    failed(production({ isAncestor: selectiveAncestor }), "Pre-release base ancestry"),
    true,
  );
});

test("production rejects main without the approved release merge", () => {
  assert.equal(
    failed(production({ headSha: base }), "Approved production HEAD"),
    true,
  );
});

test("production rejects an unapproved commit after the release merge", () => {
  assert.equal(
    failed(production({ headSha: later }), "Approved production HEAD"),
    true,
  );
});

test("production accepts an explicitly approved rollout SHA after correction", () => {
  assert.equal(
    allPass(production({ headSha: later, approvedRolloutSha: later })),
    true,
  );
});

test("production rejects a feature branch even at approved files and SHA", () => {
  assert.equal(
    failed(production({ branch: "feature/copy" }), "Current branch"),
    true,
  );
});

test("production rejects a missing approved merge SHA", () => {
  assert.notEqual(
    validateManifestReleaseIdentity({ ...manifest, approvedMergeSha: "" }, "v284").length,
    0,
  );
});

test("production rejects v283 marker, cache, and asset surfaces", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-preflight-surfaces-"));
  try {
    fs.writeFileSync(path.join(root, "version.json"), '{"version":"v283"}\n');
    fs.writeFileSync(path.join(root, "service-worker.js"), 'const CACHE_NAME = "laxhornet-v283";\n');
    fs.writeFileSync(path.join(root, "app.html"), '<script src="app.js?v=283"></script>\n');
    assert.notEqual(findReleaseSurfaceFailures(root, "v284").length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("public Live Share SQL drift changes its reviewed identity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-preflight-public-sql-"));
  try {
    const approved = path.join(root, "approved.sql");
    const drifted = path.join(root, "drifted.sql");
    fs.writeFileSync(approved, "create function public.lh_get_public_live_game();\n");
    fs.writeFileSync(drifted, "create function public.lh_get_public_live_game_with_private_time();\n");
    assert.notEqual(reviewedTextSha256(approved), reviewedTextSha256(drifted));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const failures = tests.filter((entry) => !entry.ok);
console.log(`\n${tests.length - failures.length}/${tests.length} phase-aware preflight tests passed.`);
if (failures.length) process.exit(1);
