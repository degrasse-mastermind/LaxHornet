import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "release/laxhornet-release-manifest.json"), "utf8"));
const historicalManifest = JSON.parse(execFileSync(
  "git",
  ["show", "f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37:release/laxhornet-release-manifest.json"],
  { cwd: root, encoding: "utf8" },
));
const tickets = fs.readFileSync(path.join(root, "TICKETS.md"), "utf8");
const checklist = fs.readFileSync(path.join(root, "docs/LAXHORNET_ROLLOUT_CHECKLIST.md"), "utf8");
const currentState = fs.readFileSync(path.join(root, "REPO_CURRENT_STATE.md"), "utf8");
const stabilization = manifest.postR206Stabilization;
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

function normalizedSha(file) {
  const text = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

test("current production identity records the exact automatic v285 deployment", () => {
  assert.equal(manifest.productionRelease, "v285");
  assert.equal(manifest.productionApplicationSha, "9e434e33534a1b348b19e2081b91d7e0724299fc");
  assert.equal(stabilization.deploymentRunId, "31061426334");
  assert.equal(stabilization.deploymentJobResult, "success");
  assert.equal(stabilization.originalWorkflowConclusion, "failure");
  assert.equal(stabilization.secondDeploymentPerformed, false);
});

test("successful deployment is distinguished from stale post-verification failure", () => {
  assert.equal(
    stabilization.originalWorkflowDisposition,
    "DEPLOYMENT SUCCEEDED — POST-DEPLOY VERIFICATION FAILED ON STALE EXPECTATION",
  );
  for (const document of [tickets, checklist, currentState]) {
    assert.doesNotMatch(document, /(?:failed deployment|deployment failed)[\s\S]{0,120}31061426334/i);
  }
});

test("historical R2-06 release control is byte-for-byte preserved", () => {
  assert.deepEqual(manifest.r206ReleaseControl, historicalManifest.r206ReleaseControl);
  assert.equal(manifest.r206ReleaseControl.releaseCloseoutApproved, true);
});

test("R2-07 remains proposed, unstarted, and unauthorized", () => {
  assert.match(tickets, /### R2-07[\s\S]*?Status: `PROPOSED/);
  assert.doesNotMatch(tickets, /### R2-07[\s\S]{0,220}Status: `(?:APPROVED|IN PROGRESS|COMPLETE)/i);
  assert.match(checklist, /Recommended next rollout ticket:[\s\S]*?proposed R2-07/i);
});

test("deployment evidence paths and normalized hashes match", () => {
  for (const evidence of Object.values(stabilization.productionReconciliation).filter(
    (value) => value && typeof value === "object" && typeof value.path === "string",
  )) {
    assert.ok(fs.existsSync(path.join(root, evidence.path)), evidence.path);
    assert.equal(normalizedSha(evidence.path), evidence.sha256, evidence.path);
  }
});

test("machine evidence records complete non-mutating verification", () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(root, stabilization.productionReconciliation.machineEvidence.path), "utf8"));
  assert.equal(evidence.bundleReconciliation.expectedFileCount, 47);
  assert.equal(evidence.bundleReconciliation.matchedFileCount, 47);
  assert.equal(evidence.cleanInstall.status, "PASS");
  assert.equal(evidence.existingV284ClientUpgrade.status, "PASS");
  assert.equal(evidence.productionLocalSmoke.productionMutationRequests, 0);
  assert.equal(evidence.productionLocalSmoke.hostedSupabaseRequests, 0);
  assert.equal(evidence.productionDataMutated, false);
  assert.equal(evidence.migrationOccurred, false);
  assert.equal(evidence.backendOrSupabaseConfigurationChanged, false);
  assert.equal(evidence.rollbackRequired, false);
});

const failures = tests.filter((entry) => entry.status === "FAIL");
console.log(`\n${tests.length - failures.length}/${tests.length} v285 production reconciliation tests passed.`);
if (failures.length) process.exitCode = 1;
