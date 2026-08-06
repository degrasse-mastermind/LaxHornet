import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const baselineSha = "adb9c4b91d9243534080f84f288d7f68bf446757";
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "release", "laxhornet-release-manifest.json"), "utf8"),
);
const control = manifest.r206ReleaseControl;
const synthetic = control.syntheticVerification;
const reconciliation = control.evidenceReconciliation;
const actions = reconciliation.actions;
const approvalPath = path.join(
  root,
  "review-evidence",
  "r2-06-durable-game-tombstones-release",
  "R2-06_RELEASE_CLOSEOUT_APPROVAL.md",
);
const approval = fs.readFileSync(approvalPath, "utf8");
const tickets = fs.readFileSync(path.join(root, "TICKETS.md"), "utf8");
const currentState = fs.readFileSync(path.join(root, "REPO_CURRENT_STATE.md"), "utf8");
const checklist = fs.readFileSync(
  path.join(root, "docs", "LAXHORNET_ROLLOUT_CHECKLIST.md"),
  "utf8",
);
const historicalCloseoutSha = "f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37";
const historicalManifest = JSON.parse(
  execFileSync(
    "git",
    ["show", `${historicalCloseoutSha}:release/laxhornet-release-manifest.json`],
    { cwd: root, encoding: "utf8" },
  ),
);
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

test("approved baseline SHA matches R2-06Q merge", () => {
  assert.equal(reconciliation.approvedCloseoutBaselineSha, baselineSha);
  assert.equal(reconciliation.reviewedThroughMergeSha, baselineSha);
});

test("mixed-evidence acceptance is explicit", () => {
  assert.equal(synthetic.historicProductionEvidenceReconciled, true);
  assert.equal(synthetic.mixedEvidenceAccepted, true);
  assert.equal(synthetic.completionModel, "approved_mixed_evidence");
  assert.equal(synthetic.syntheticVerificationCloseoutStatus, "approved_mixed_evidence");
  assert.equal(synthetic.completed, false);
});

test("release closeout approval is true and authority-bound", () => {
  assert.equal(control.releaseCloseoutApproved, true);
  assert.equal(reconciliation.approvalAuthority, "David");
  assert.equal(reconciliation.approvalDate, "2026-08-01");
  assert.equal(
    reconciliation.status,
    "R2-06 RELEASE CLOSEOUT APPROVED — MIXED EVIDENCE ACCEPTED",
  );
  for (const document of [approval, tickets, currentState, checklist]) {
    assert.match(document, /R2-06 RELEASE CLOSEOUT APPROVED — MIXED EVIDENCE ACCEPTED/);
  }
  assert.match(tickets, /R2-06 is closed\./);
  assert.match(checklist, /No further R2-06 production run is required\./);
});

test("production actions 1 through 14 remain production verified", () => {
  assert.equal(actions.length, 21);
  assert.ok(
    actions.slice(0, 14)
      .every((entry, index) => entry.action === index + 1 && entry.status === "PRODUCTION VERIFIED"),
  );
});

test("historic action 15 remains an invalid verifier result", () => {
  const action15 = actions[14];
  assert.equal(action15.action, 15);
  assert.equal(action15.status, "INVALID HISTORIC VERIFIER RESULT");
  assert.equal(action15.originalProductionActionPassed, false);
});

test("corrected action 15 remains disposable and remediation verified", () => {
  assert.equal(actions[14].correctedVerification.status, "DISPOSABLE/REMEDIATION VERIFIED");
  assert.deepEqual(actions[14].correctedVerification.verificationLayers, [
    "raw_canonical_persistence",
    "application_state",
    "rendered_ui",
    "zero_resurrection_writes",
  ]);
});

test("action 16 remains partially production verified", () => {
  const action16 = actions[15];
  assert.equal(action16.action, 16);
  assert.equal(action16.status, "PRODUCTION PARTIALLY VERIFIED");
  assert.equal(action16.fullPostHydrationDisclosureSequence, "NOT REACHED");
});

test("actions 17 through 21 remain independently cleanup attested", () => {
  assert.ok(
    actions.slice(16)
      .every(
        (entry, index) => entry.action === index + 17
          && entry.status === "INDEPENDENT CLEANUP ATTESTED",
      ),
  );
});

test("cleanup approval is based on independent attestation", () => {
  assert.equal(control.cleanupApproved, true);
  assert.equal(synthetic.cleanupAttested, true);
  assert.equal(reconciliation.cleanupAttestation.status, "INDEPENDENT CLEANUP ATTESTED");
  assert.equal(reconciliation.cleanupAttestation.authoritativeSupplementalRecord, true);
  assert.equal(reconciliation.cleanupAttestation.manualCleanupRequired, false);
  assert.ok(
    Object.values(reconciliation.cleanupAttestation.mutableResidueCounts)
      .every((count) => Number.isInteger(count) && count === 0),
  );
});

test("historic consumption cleanup flag remains false", () => {
  assert.equal(control.cleanupCompleted, false);
  assert.equal(reconciliation.cleanupAttestation.immutableConsumptionRecordCleanupCompleted, false);
  assert.match(approval, /immutable historical runner record remains `cleanupCompleted: false`/);
});

test("exactly one retained tombstone remains", () => {
  assert.equal(reconciliation.cleanupAttestation.retainedDurableTombstones, 1);
  assert.equal(reconciliation.cleanupAttestation.retainedPrivateLedgers, 1);
  assert.equal(reconciliation.retainedTombstoneChangedDuringCloseout, false);
});

test("future production authorization remains false", () => {
  assert.equal(synthetic.authorized, false);
  assert.equal(synthetic.futureAuthorizationState, "not_authorized");
  assert.equal(reconciliation.newProductionAuthorizationCreated, false);
  assert.equal(reconciliation.newProductionAuthorizationCreatedDuringCloseout, false);
});

test("public evidence makes no direct 21-of-21 production-pass claim", () => {
  const evidence = Object.values(reconciliation.evidence)
    .map((entry) => fs.readFileSync(path.join(root, entry.path), "utf8"))
    .join("\n");
  assert.doesNotMatch(
    evidence,
    /\b(?:all )?21(?:\/21| of 21|-of-21) (?:actions )?(?:passed|pass) directly in production\b/i,
  );
});

test("final closeout evidence contains no private identifiers or secrets", () => {
  assert.doesNotMatch(
    approval,
    /\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\b/,
  );
  assert.doesNotMatch(approval, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/);
  assert.doesNotMatch(approval, /\b(?:service_role|sb_secret_[A-Za-z0-9_-]+)\b/i);
  assert.doesNotMatch(approval, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  assert.doesNotMatch(approval, /(?:[A-Z]:\\|\/Users\/|\/home\/)/i);
});

test("closeout records no production access, mutation, private access, or rerun", () => {
  assert.equal(reconciliation.productionAccessDuringCloseout, false);
  assert.equal(reconciliation.productionMutationDuringCloseout, false);
  assert.equal(reconciliation.productionRerunDuringCloseout, false);
  assert.equal(reconciliation.privateEvidenceOpenedDuringCloseout, false);
  assert.equal(reconciliation.secondProductionLifecycleExecuted, false);
  assert.equal(reconciliation.noSecondProductionLifecycleRequired, true);
});

test("historical R2-06 facts remain immutable while post-closeout work is append-only", () => {
  const checklistPath = "docs/LAXHORNET_ROLLOUT_CHECKLIST.md";
  const baseline = execFileSync("git", ["show", `${baselineSha}:${checklistPath}`], {
    cwd: root,
    encoding: "utf8",
  });
  const current = fs.readFileSync(path.join(root, checklistPath), "utf8");
  assert.deepEqual(manifest.r206ReleaseControl, historicalManifest.r206ReleaseControl);
  assert.match(current, /### R2-06R final release closeout[\s\S]*?Mark R2-06 implementation[\s\S]*?release closeout complete/);
  assert.match(current, /R2-06 RELEASE CLOSEOUT APPROVED[^\r\n]*MIXED EVIDENCE ACCEPTED/);
  assert.equal(actions.find((entry) => entry.action === 15)?.status, "INVALID HISTORIC VERIFIER RESULT");
  assert.equal(actions.find((entry) => entry.action === 16)?.status, "PRODUCTION PARTIALLY VERIFIED");
  assert.equal(reconciliation.cleanupAttestation.retainedDurableTombstones, 1);
  assert.equal(reconciliation.cleanupAttestation.mutableResidueCounts.activeSessions, 0);
  assert.equal(reconciliation.noSecondProductionLifecycleRequired, true);
  assert.match(current, /## Post-R2-06 User-Centered Stabilization Checkpoint/);
  assert.notEqual(current.replace(/\r\n/g, "\n"), baseline.replace(/\r\n/g, "\n"));
  assert.equal(reconciliation.unrelatedRolloutStagesChangedDuringCloseout, false);
});

const failures = tests.filter((entry) => entry.status === "FAIL");
console.log(`\n${tests.length - failures.length}/${tests.length} R2-06R release closeout tests passed.`);
if (failures.length) process.exitCode = 1;
