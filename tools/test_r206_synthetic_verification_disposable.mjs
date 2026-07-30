import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HARD_LIMITS,
  assertPublicEvidenceSafe,
  createPublicEvidencePayloadBindings,
  executeSyntheticVerification,
} from "./r206_synthetic_runner_core.mjs";
import { createDisposableAdapter } from "./r206_synthetic_disposable_adapter.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-disposable-e2e-"));
const privateEvidenceDir = path.join(tempRoot, "private");
const publicEvidenceDir = path.join(tempRoot, "public");
const targetRef = "d".repeat(40);

try {
  const adapter = await createDisposableAdapter({
    repoRoot,
    privateEvidenceDir,
    publicEvidenceDir,
  });
  const result = await executeSyntheticVerification({
    adapter,
    config: {
      executionMode: "disposable",
      targetRef,
      projectRef: "local-r206-disposable",
      privateEvidenceDir,
      publicEvidenceDir,
      credentialSource: "disposable_in_memory",
      releaseCloseoutApproved: false,
    },
    now: () => new Date("2026-07-30T18:00:00.000Z"),
  });

  assert.equal(result.phase, "completed");
  assert.equal(result.actionCount, 21);
  assert.equal(result.evidenceClassification, "disposable_not_production");
  assert.match(result.status, /NOT PRODUCTION EVIDENCE/);
  assert.deepEqual(result.counts, HARD_LIMITS);
  assert.equal(result.releaseCloseoutApproved, false);

  const publicNames = fs.readdirSync(publicEvidenceDir).sort();
  assert.deepEqual(publicNames, [
    "SYNTHETIC_CLEANUP_RESULT.md",
    "SYNTHETIC_VERIFICATION_AUTHORIZATION.md",
    "SYNTHETIC_VERIFICATION_RESULT.md",
  ]);
  const publicBundle = {};
  const evidenceKeyByFile = {
    "SYNTHETIC_VERIFICATION_AUTHORIZATION.md": "authorization",
    "SYNTHETIC_VERIFICATION_RESULT.md": "operations",
    "SYNTHETIC_CLEANUP_RESULT.md": "cleanup",
  };
  for (const name of publicNames) {
    const content = fs.readFileSync(path.join(publicEvidenceDir, name), "utf8");
    assertPublicEvidenceSafe(content);
    assert.doesNotMatch(content, /verification_complete_release_closeout_review_required/);
    assert.match(content, /disposable_verification_complete_not_production_evidence/);
    const jsonBlock = content.match(/```json\n([\s\S]+)\n```/);
    assert.ok(jsonBlock);
    publicBundle[evidenceKeyByFile[name]] = JSON.parse(jsonBlock[1]);
  }

  const privateNames = fs.readdirSync(privateEvidenceDir);
  assert.deepEqual(privateNames, ["R2-06_RETAINED_IDENTIFIERS.json"]);
  const privateBytes = fs.readFileSync(result.privateEvidence.path);
  const digest = createHash("sha256").update(privateBytes).digest("hex");
  assert.equal(digest, result.privateEvidence.sha256);
  const privateLedger = JSON.parse(privateBytes.toString("utf8"));
  assert.equal(privateLedger.game.deleted, true);
  assert.equal(privateLedger.tombstone.alias, "retained_tombstone");
  assert.equal(
    Object.values(privateLedger.sessions).filter((session) => !session.revoked).length,
    0,
  );
  assert.equal(
    Object.values(privateLedger.users).filter((user) => !user.deleted).length,
    0,
  );
  assert.equal(
    Object.values(privateLedger.profiles).filter((profile) => !profile.removed).length,
    0,
  );
  assert.equal(privateLedger.browserProfileLocations.length, 2);
  assert.deepEqual(
    privateLedger.publicEvidencePayloadBindings,
    createPublicEvidencePayloadBindings(publicBundle),
  );

  process.stdout.write(
    "R2-06 disposable synthetic verification passed; result is not production evidence.\n",
  );
} finally {
  const resolved = path.resolve(tempRoot);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}
