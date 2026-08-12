import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const historicalSha = "f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("release/laxhornet-release-manifest.json"));
const historicalManifest = JSON.parse(execFileSync(
  "git",
  ["show", `${historicalSha}:release/laxhornet-release-manifest.json`],
  { cwd: root, encoding: "utf8" },
));
const stabilization = manifest.postR206Stabilization;
const control = manifest.r206ReleaseControl;
const reconciliation = control.evidenceReconciliation;
const checklist = read("docs/LAXHORNET_ROLLOUT_CHECKLIST.md");
const tickets = read("TICKETS.md");
const app = read("app.js");
const worker = read("service-worker.js");
const currentVersion = JSON.parse(read("version.json")).version;
const evidence = read(stabilization.releaseEvidence);
const audit = read(stabilization.auditEvidence);
const tests = [];

function test(name, callback) {
  try {
    callback();
    tests.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    tests.push({ name, status: "FAIL" });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function normalizedSha(file) {
  const normalized = read(file).replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

function normalizedShaAtRef(ref, file) {
  const normalized = execFileSync("git", ["show", `${ref}:${file}`], { cwd: root, encoding: "utf8" })
    .replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

function protectedR206FactsMatch(candidate) {
  return JSON.stringify(candidate.r206ReleaseControl) === JSON.stringify(historicalManifest.r206ReleaseControl);
}

test("historical R2-06 evidence and hashes remain unchanged", () => {
  assert.deepEqual(control, historicalManifest.r206ReleaseControl);
});

test("R2-06 remains closed", () => {
  assert.equal(control.releaseCloseoutApproved, true);
  assert.match(checklist, /Mark R2-06 implementation[\s\S]*?release closeout complete/);
});

test("R2-06 closeout remains approved with mixed evidence", () => {
  assert.equal(reconciliation.status, "R2-06 RELEASE CLOSEOUT APPROVED — MIXED EVIDENCE ACCEPTED");
  assert.equal(control.cleanupApproved, true);
});

test("no new R2-06 production authorization exists", () => {
  assert.equal(control.syntheticVerification.authorized, false);
  assert.equal(reconciliation.newProductionAuthorizationCreated, false);
  assert.equal(reconciliation.newProductionAuthorizationCreatedDuringCloseout, false);
});

test("historical v285 runtime identity remains bound to its deployed app runtime", () => {
  assert.equal(stabilization.releaseMarker, "v285");
  assert.match(
    execFileSync("git", ["show", `${stabilization.approvedAndDeployedSha}:app.js`], { cwd: root, encoding: "utf8" }),
    /const APP_VERSION = "v285";/,
  );
  assert.equal(
    stabilization.runtimeSha256["app.js"],
    normalizedShaAtRef(stabilization.approvedAndDeployedSha, "app.js"),
  );
});

test("current release identity is self-consistent without rewriting v285 history", () => {
  assert.equal(currentVersion, "v288");
  assert.equal(manifest.release, currentVersion);
  assert.match(app, new RegExp(`const APP_VERSION = "${currentVersion}";`));
  assert.match(worker, new RegExp(`const CACHE_NAME = "laxhornet-${currentVersion}";`));
  assert.equal(stabilization.releaseMarker, "v285");
});

test("historical PWA cache marker matches its deployed runtime marker", () => {
  assert.equal(stabilization.cacheMarker, `laxhornet-${stabilization.releaseMarker}`);
  assert.match(
    execFileSync("git", ["show", `${stabilization.approvedAndDeployedSha}:service-worker.js`], { cwd: root, encoding: "utf8" }),
    /const CACHE_NAME = "laxhornet-v285";/,
  );
});

test("historical service-worker assets carry their deployed release inventory marker", () => {
  const historicalWorker = execFileSync(
    "git", ["show", `${stabilization.approvedAndDeployedSha}:service-worker.js`],
    { cwd: root, encoding: "utf8" },
  );
  assert.match(historicalWorker, /\.\/app\.js\?v=285/);
  assert.match(historicalWorker, /\.\/styles\.css\?v=285/);
  assert.doesNotMatch(historicalWorker, /\.\/(?:app|styles)\.(?:js|css)\?v=284/);
});

test("both Important QA fixes are represented in release evidence", () => {
  assert.deepEqual(stabilization.importantFixes, [
    "active_game_recovery_from_home",
    "saved_review_player_alignment",
  ]);
  assert.match(evidence, /Resume Live Game/);
  assert.match(evidence, /saved[- ]review player alignment/i);
  assert.match(audit, /41\/41/);
});

test("append-only post-closeout checklist work is allowed", () => {
  assert.match(checklist, /## Post-R2-06 User-Centered Stabilization Checkpoint/);
  assert.equal(protectedR206FactsMatch(manifest), true);
});

test("removal or mutation of protected R2-06 facts is detected", () => {
  const mutated = structuredClone(manifest);
  mutated.r206ReleaseControl.releaseCloseoutApproved = false;
  assert.equal(protectedR206FactsMatch(mutated), false);
});

test("authorized automatic v285 deployment is reconciled without a second deployment", () => {
  assert.equal(stabilization.productionDeploymentAuthorized, true);
  assert.equal(stabilization.productionDeployed, true);
  assert.equal(stabilization.approvedAndDeployedSha, "9e434e33534a1b348b19e2081b91d7e0724299fc");
  assert.equal(stabilization.deploymentRunId, "31061426334");
  assert.equal(stabilization.deploymentJobResult, "success");
  assert.equal(stabilization.originalWorkflowConclusion, "failure");
  assert.equal(stabilization.secondDeploymentPerformed, false);
  assert.equal(manifest.productionRelease, "v285");
});

test("historical proposed R2-07 context remains preserved beside current activation", () => {
  assert.match(tickets, /R2-07[\s\S]*?(?:Proposed|proposed)/);
  assert.match(checklist, /Recommended next rollout ticket:[\s\S]*?proposed R2-07/);
  assert.equal(manifest.r207ForwardMigrationBActivation.productionApplied, true);
  assert.equal(manifest.r207ForwardMigrationBActivation.status, "production_database_and_runtime_active_v288_release");
});

test("no unrelated rollout stage is advanced", () => {
  assert.equal(reconciliation.unrelatedRolloutStagesChangedDuringCloseout, false);
  assert.match(evidence, /No unrelated rollout stage (?:was |is )?advanced/i);
});

test("the pre-deployment integration evidence remains immutable historical context", () => {
  assert.match(evidence, /Deployment status:[^\r\n]*not authorized/i);
  assert.match(evidence, /Production status:[^\r\n]*not accessed/i);
  assert.equal(stabilization.productionAccessed, true);
  assert.equal(stabilization.productionVerificationStatus, "PASS");
});

test("exact stabilization runtime and control hashes remain bound to the deployed SHA", () => {
  for (const inventory of [stabilization.runtimeSha256, stabilization.controlSha256]) {
    assert.ok(Object.keys(inventory).length > 0);
    for (const [file, expected] of Object.entries(inventory)) {
      assert.equal(normalizedShaAtRef(stabilization.approvedAndDeployedSha, file), expected, file);
    }
  }
});

test("v285 reconciliation records no backend, migration, production mutation, or rollback", () => {
  assert.equal(stabilization.backendOrSupabaseConfigurationChanged, false);
  assert.equal(stabilization.migrationOccurred, false);
  assert.equal(stabilization.productionDataMutated, false);
  assert.equal(stabilization.rollbackRequired, false);
  assert.equal(stabilization.productionReconciliation.deployableFileCount, 47);
  assert.equal(stabilization.productionReconciliation.matchedFileCount, 47);
  assert.equal(stabilization.productionReconciliation.productionMutationRequests, 0);
});

const failures = tests.filter((entry) => entry.status === "FAIL");
console.log(`\n${tests.length - failures.length}/${tests.length} post-R2-06 stabilization release tests passed.`);
if (failures.length) process.exitCode = 1;
