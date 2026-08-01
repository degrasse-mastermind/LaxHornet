import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "release", "laxhornet-release-manifest.json"), "utf8"),
);
const reconciliation = manifest.r206ReleaseControl?.evidenceReconciliation;
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

const textSha256 = (file) => createHash("sha256")
  .update(Buffer.from(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"), "utf8"))
  .digest("hex");

test("reconciliation keeps production and closeout controls fail-closed", () => {
  assert.equal(manifest.r206ReleaseControl.syntheticRunner.productionExecutionDefault, "disabled");
  assert.equal(manifest.r206ReleaseControl.syntheticVerification.authorized, false);
  assert.equal(manifest.r206ReleaseControl.syntheticVerification.completed, false);
  assert.equal(manifest.r206ReleaseControl.cleanupCompleted, false);
  assert.equal(manifest.r206ReleaseControl.releaseCloseoutApproved, false);
  assert.equal(reconciliation?.status, "CLOSEOUT REVIEW REQUIRED");
  assert.equal(reconciliation?.independentCloseoutReviewPending, true);
});

test("historic authorization and run directory are consumed and non-reusable", () => {
  assert.deepEqual(reconciliation?.historicProductionAuthorization, {
    state: "consumed",
    reusable: false,
  });
  assert.deepEqual(reconciliation?.historicProductionRunDirectory, {
    state: "consumed",
    reusable: false,
  });
  assert.equal(reconciliation?.newProductionAuthorizationCreated, false);
  assert.equal(reconciliation?.secondProductionLifecycleExecuted, false);
});

test("actions 1 through 14 are production verified with exact results", () => {
  const expected = [
    "browser_readiness_passed",
    "two_synthetic_auth_users_created",
    "two_automatic_profiles_created",
    "three_sequential_sessions_verified",
    "one_isolated_personal_game_created",
    "anonymous_denial_passed",
    "wrong_account_denial_passed",
    "guarded_update_passed",
    "newer_game_revision",
    "game_deleted",
    "tombstones_0_to_1",
    "game_delete_replayed",
    "game_already_deleted",
    "game_deleted",
  ];
  assert.deepEqual(
    reconciliation?.actions.slice(0, 14).map((entry) => entry.result),
    expected,
  );
  assert.ok(
    reconciliation?.actions.slice(0, 14)
      .every((entry, index) => entry.action === index + 1 && entry.status === "PRODUCTION VERIFIED"),
  );
});

test("action 15 preserves invalid history and separate corrected verification", () => {
  const action15 = reconciliation?.actions.find((entry) => entry.action === 15);
  assert.equal(action15?.status, "INVALID HISTORIC VERIFIER RESULT");
  assert.equal(
    action15?.result,
    "TOMBSTONE METADATA MISCLASSIFIED AS HYDRATED GAME",
  );
  assert.equal(action15?.originalProductionActionPassed, false);
  assert.equal(action15?.correctedVerification?.status, "DISPOSABLE/REMEDIATION VERIFIED");
  assert.equal(
    action15?.correctedVerification?.mergeSha,
    "cdcc357db2774cf66454f0f5c0c69d87fd14187d",
  );
});

test("action 16 remains partial and names the unreached sequence", () => {
  const action16 = reconciliation?.actions.find((entry) => entry.action === 16);
  assert.equal(action16?.status, "PRODUCTION PARTIALLY VERIFIED");
  assert.equal(action16?.fullPostHydrationDisclosureSequence, "NOT REACHED");
  assert.equal(action16?.anonymousDenialPassed, true);
  assert.equal(action16?.wrongAccountDenialPassed, true);
  assert.equal(action16?.liveShareTokensCreated, 0);
  assert.equal(action16?.finalLiveShareTokenCount, 0);
  assert.equal(action16?.unauthorizedGameDisclosureObserved, false);
});

test("actions 17 through 21 are independently cleanup-attested", () => {
  const cleanupActions = reconciliation?.actions.slice(16);
  assert.deepEqual(cleanupActions.map((entry) => entry.action), [17, 18, 19, 20, 21]);
  assert.ok(cleanupActions.every((entry) => entry.status === "INDEPENDENT CLEANUP ATTESTED"));
  assert.deepEqual(reconciliation?.cleanupAttestation?.mutableResidueCounts, {
    syntheticUsers: 0,
    profiles: 0,
    activeSessions: 0,
    games: 0,
    events: 0,
    liveShareTokens: 0,
    operationsAndRecoveries: 0,
  });
  assert.equal(reconciliation?.cleanupAttestation?.retainedDurableTombstones, 1);
  assert.equal(reconciliation?.cleanupAttestation?.retainedPrivateLedgers, 1);
  assert.equal(reconciliation?.cleanupAttestation?.manualCleanupRequired, false);
  assert.equal(reconciliation?.cleanupAttestation?.immutableConsumptionRecordCleanupCompleted, false);
});

test("all reconciliation evidence paths exist and match registered hashes", () => {
  for (const evidence of Object.values(reconciliation?.evidence || {})) {
    assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
    const absolute = path.join(root, evidence.path);
    assert.ok(fs.existsSync(absolute), `missing evidence: ${evidence.path}`);
    assert.equal(textSha256(absolute), evidence.sha256, `stale evidence hash: ${evidence.path}`);
  }
});

test("public reconciliation evidence contains no obvious private identifiers or secrets", () => {
  const publicEvidence = Object.values(reconciliation?.evidence || {})
    .map((entry) => fs.readFileSync(path.join(root, entry.path), "utf8"))
    .join("\n");
  assert.doesNotMatch(publicEvidence, /\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\b/);
  assert.doesNotMatch(publicEvidence, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/);
  assert.doesNotMatch(publicEvidence, /\b(?:service_role|sb_secret_[A-Za-z0-9_-]+)\b/i);
  assert.doesNotMatch(publicEvidence, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
});

test("evidence documents preserve the mixed status and false closeout", () => {
  const production = fs.readFileSync(
    path.join(root, reconciliation.evidence.productionReconciliation.path),
    "utf8",
  );
  const readiness = fs.readFileSync(
    path.join(root, reconciliation.evidence.closeoutReadiness.path),
    "utf8",
  );
  assert.match(production, /INVALID VERIFIER RESULT — TOMBSTONE METADATA MISCLASSIFIED AS HYDRATED GAME/);
  assert.match(production, /PARTIALLY VERIFIED IN PRODUCTION — COMPLETED BY REVIEWED DISPOSABLE DISCLOSURE AND THREE-LAYER HYDRATION EVIDENCE/);
  assert.match(production, /releaseCloseoutApproved: false/);
  assert.match(readiness, /This document does not approve release closeout\./);
  assert.match(readiness, /R2-06Q EVIDENCE RECONCILIATION READY FOR INDEPENDENT CLOSEOUT REVIEW/);
});

const failures = tests.filter((entry) => entry.status === "FAIL");
console.log(`\n${tests.length - failures.length}/${tests.length} R2-06Q reconciliation tests passed.`);
if (failures.length) process.exitCode = 1;
