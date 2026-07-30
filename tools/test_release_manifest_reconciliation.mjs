import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  R206_MIGRATIONS,
  R206_RUNTIME_SHA,
  evaluateR206ReleaseControl,
} from "./release_manifest_state.mjs";

const root = path.resolve(import.meta.dirname, "..");
const sourceManifest = JSON.parse(
  fs.readFileSync(path.join(root, "release", "laxhornet-release-manifest.json"), "utf8"),
);
const clone = (value) => structuredClone(value);
const tests = [];

function test(name, callback) {
  try {
    callback();
    tests.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    tests.push({ name, status: "FAIL", error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const evaluate = (manifest) =>
  evaluateR206ReleaseControl(manifest, {
    evidenceExists: (file) => file.startsWith("test-fixtures/"),
  });

test("runtime and migrations are accepted while absent synthetic evidence blocks closeout", () => {
  const result = evaluate(sourceManifest);
  assert.equal(result.runtimeDatabaseReady, true);
  assert.equal(result.closeoutReady, false);
  assert.equal(result.releaseComplete, false);
  assert.match(result.closeoutBlockers.join("; "), /synthetic production behavior evidence/);
});

test("runtime present with one migration missing is blocked", () => {
  const manifest = clone(sourceManifest);
  manifest.expectedRemoteAppliedMigrations =
    manifest.expectedRemoteAppliedMigrations.filter((file) => file !== R206_MIGRATIONS[1]);
  manifest.expectedPendingProductionMigrations = [R206_MIGRATIONS[1]];
  const result = evaluate(manifest);
  assert.equal(result.runtimeDatabaseReady, false);
});

test("both migrations present with an old runtime is blocked", () => {
  const manifest = clone(sourceManifest);
  manifest.productionApplicationSha = manifest.productionRollbackSourceSha;
  manifest.r206ReleaseControl.runtimeSourceSha = manifest.productionRollbackSourceSha;
  const result = evaluate(manifest);
  assert.equal(result.runtimeDatabaseReady, false);
  assert.notEqual(manifest.productionApplicationSha, R206_RUNTIME_SHA);
});

test("wrong migration order is blocked", () => {
  const manifest = clone(sourceManifest);
  manifest.requiredMigrationSequence.splice(
    -2,
    2,
    R206_MIGRATIONS[1],
    R206_MIGRATIONS[0],
  );
  manifest.expectedRemoteAppliedMigrations = [...manifest.requiredMigrationSequence];
  const result = evaluate(manifest);
  assert.equal(result.runtimeDatabaseReady, false);
});

test("reviewed migration hash mismatch is blocked", () => {
  const manifest = clone(sourceManifest);
  const reviewPackage = manifest.reviewDatabasePackages.find(
    (entry) => entry.name === "durable_game_tombstones",
  );
  reviewPackage.sha256[reviewPackage.forwardMigration] = "0".repeat(64);
  const result = evaluate(manifest);
  assert.equal(result.runtimeDatabaseReady, false);
  assert.match(result.failures.join("; "), /identity is missing or altered/);
});

test("synthetic verification completion without required evidence is blocked", () => {
  const manifest = clone(sourceManifest);
  manifest.r206ReleaseControl.syntheticVerification.completed = true;
  manifest.r206ReleaseControl.releaseCloseoutApproved = true;
  const result = evaluate(manifest);
  assert.equal(result.closeoutReady, false);
  assert.equal(result.releaseComplete, false);
  assert.match(result.failures.join("; "), /cannot be completed without reviewed evidence/);
  assert.match(result.failures.join("; "), /closeout cannot be approved/);
});

test("unreviewed production state is blocked", () => {
  const manifest = clone(sourceManifest);
  manifest.r206ReleaseControl.implementationReviewed = false;
  const result = evaluate(manifest);
  assert.equal(result.runtimeDatabaseReady, false);
  assert.match(result.failures.join("; "), /reconciliation provenance/);
});

test("approved fixture evidence may advance a reconciled state to closeout-ready", () => {
  const manifest = clone(sourceManifest);
  const fixtureEvidence = (name) => ({
    path: `test-fixtures/${name}.json`,
    sha256: "a".repeat(64),
    reviewed: true,
  });
  manifest.r206ReleaseControl.syntheticVerification = {
    authorized: true,
    authorizationEvidence: fixtureEvidence("authorization"),
    completed: true,
    evidence: fixtureEvidence("synthetic-verification"),
    cleanupEvidence: fixtureEvidence("cleanup"),
  };
  manifest.r206ReleaseControl.cleanupCompleted = true;
  manifest.r206ReleaseControl.releaseCloseoutApproved = false;
  const result = evaluate(manifest);
  assert.equal(result.runtimeDatabaseReady, true);
  assert.equal(result.closeoutReady, true);
  assert.equal(result.releaseComplete, false);
  assert.deepEqual(result.failures, []);
});

const failures = tests.filter((entry) => entry.status === "FAIL");
console.log(`\n${tests.length - failures.length}/${tests.length} release-manifest reconciliation tests passed.`);
if (failures.length) process.exitCode = 1;
