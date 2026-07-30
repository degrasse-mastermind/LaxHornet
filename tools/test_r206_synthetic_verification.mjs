import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ACTION_PLAN,
  ALLOWED_MUTATION_RPCS,
  CleanupLedger,
  ExecutionStateMachine,
  HARD_LIMITS,
  HardLimitGuard,
  R206_API_URL,
  R206_APPLICATION_ORIGIN,
  R206_CACHE_NAME,
  R206_MIGRATION_VERSIONS,
  R206_PAGES_RUN_ID,
  R206_PROJECT_REF,
  R206_RELEASE_MARKER,
  R206_RUNTIME_SHA,
  R206StopError,
  assertAllowedRpc,
  assertPublicEvidenceSafe,
  createPublicEvidenceBundle,
  createSyntheticScope,
  dryRunPlan,
  executeSyntheticVerification,
} from "./r206_synthetic_runner_core.mjs";
import { validateProductionConfiguration } from "./r206_synthetic_production_adapter.mjs";
import { parseArgs } from "./run_r206_synthetic_verification.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRef = "a".repeat(40);
const fixedNow = new Date("2026-07-30T18:00:00.000Z");
const read = (name) => fs.readFileSync(path.join(repoRoot, "tools", name), "utf8");

function createProductionFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-config-"));
  const privateEvidenceDir = path.join(root, "private");
  fs.mkdirSync(privateEvidenceDir);
  const authorizationArtifact = path.join(privateEvidenceDir, "authorization.json");
  const preflightArtifact = path.join(privateEvidenceDir, "preflight.json");
  const options = {
    executionMode: "production",
    allowProduction: true,
    reviewedPrivatePathOverride: true,
    targetRef,
    projectRef: R206_PROJECT_REF,
    apiUrl: R206_API_URL,
    privateEvidenceDir,
    publicEvidenceDir: path.join(repoRoot, "review-evidence", "r2-06-durable-game-tombstones-release"),
    authorizationArtifact,
    preflightArtifact,
  };
  fs.writeFileSync(authorizationArtifact, JSON.stringify({
    schemaVersion: 1,
    authorizationId: "reviewed-r206-test",
    approvedBy: "David",
    authorizedAt: fixedNow.toISOString(),
    expiresAt: "2026-07-30T19:00:00.000Z",
    executionMode: "production",
    approvedRunnerSha: targetRef,
    projectRef: R206_PROJECT_REF,
    apiUrl: R206_API_URL,
    applicationOrigin: R206_APPLICATION_ORIGIN,
    runtimeSourceSha: R206_RUNTIME_SHA,
    actionCount: ACTION_PLAN.length,
    hardLimits: HARD_LIMITS,
    privateEvidenceDir,
    browserExecutionAuthorized: true,
    releaseCloseoutApproved: false,
  }));
  fs.writeFileSync(preflightArtifact, JSON.stringify({
    schemaVersion: 1,
    source: "supabase_production_readonly-2",
    capturedAt: fixedNow.toISOString(),
    approvedRunnerSha: targetRef,
    projectRef: R206_PROJECT_REF,
    apiUrl: R206_API_URL,
    applicationOrigin: R206_APPLICATION_ORIGIN,
    runtimeSourceSha: R206_RUNTIME_SHA,
    pagesRunId: R206_PAGES_RUN_ID,
    releaseMarker: R206_RELEASE_MARKER,
    cacheName: R206_CACHE_NAME,
    migrationVersions: R206_MIGRATION_VERSIONS,
  }));
  return { root, options };
}

function cleanupFixture(root) {
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}

test("dry run enumerates exactly 21 actions and zero mutations", () => {
  const plan = dryRunPlan({ targetRef });
  assert.equal(plan.actionCount, 21);
  assert.equal(plan.actions.length, 21);
  assert.equal(plan.networkMutationCount, 0);
  assert.equal(plan.credentialsRequired, false);
});

test("argument parser does not enable production implicitly", () => {
  assert.deepEqual(parseArgs(["--execution-mode", "production"]).allowProduction, false);
});

test("production mode fails when runtime credentials are missing", () => {
  const fixture = createProductionFixture();
  try {
    assert.throws(
      () => validateProductionConfiguration({
        repoRoot,
        options: fixture.options,
        env: {},
        now: fixedNow,
        verifyGit: false,
      }),
      (error) => error.code === "PRODUCTION_CREDENTIALS_MISSING",
    );
  } finally {
    cleanupFixture(fixture.root);
  }
});

test("production mode fails when the authorization target ref differs", () => {
  const fixture = createProductionFixture();
  try {
    fixture.options.targetRef = "b".repeat(40);
    assert.throws(
      () => validateProductionConfiguration({
        repoRoot,
        options: fixture.options,
        env: {
          R206_SUPABASE_PUBLISHABLE_KEY: "publishable-test",
          R206_SUPABASE_SECRET_KEY: "secret-test",
        },
        now: fixedNow,
        verifyGit: false,
      }),
      (error) => error.code === "PRODUCTION_AUTHORIZATION_ARTIFACT_MISMATCH",
    );
  } finally {
    cleanupFixture(fixture.root);
  }
});

test("production mode refuses the wrong project reference", () => {
  const fixture = createProductionFixture();
  try {
    fixture.options.projectRef = "wrong-project-ref";
    assert.throws(
      () => validateProductionConfiguration({
        repoRoot,
        options: fixture.options,
        env: {},
        now: fixedNow,
        verifyGit: false,
      }),
      (error) => error.code === "PROJECT_REF_MISMATCH",
    );
  } finally {
    cleanupFixture(fixture.root);
  }
});

test("private evidence inside the repository is rejected", () => {
  const fixture = createProductionFixture();
  try {
    fixture.options.privateEvidenceDir = path.join(repoRoot, "private-evidence");
    assert.throws(
      () => validateProductionConfiguration({
        repoRoot,
        options: fixture.options,
        env: {},
        now: fixedNow,
        verifyGit: false,
      }),
      (error) => error.code === "PRIVATE_EVIDENCE_DIR_INSIDE_REPOSITORY",
    );
  } finally {
    cleanupFixture(fixture.root);
  }
});

test("production requires an explicit separate authorization gate", () => {
  const fixture = createProductionFixture();
  try {
    fixture.options.allowProduction = false;
    assert.throws(
      () => validateProductionConfiguration({
        repoRoot,
        options: fixture.options,
        env: {},
        now: fixedNow,
        verifyGit: false,
      }),
      (error) => error.code === "PRODUCTION_EXECUTION_DISABLED",
    );
  } finally {
    cleanupFixture(fixture.root);
  }
});

test("production refuses to overwrite retained evidence", () => {
  const fixture = createProductionFixture();
  try {
    fs.writeFileSync(
      path.join(fixture.options.privateEvidenceDir, "R2-06_RETAINED_IDENTIFIERS.json"),
      "{}",
    );
    assert.throws(
      () => validateProductionConfiguration({
        repoRoot,
        options: fixture.options,
        env: {},
        now: fixedNow,
        verifyGit: false,
      }),
      (error) => error.code === "EVIDENCE_TARGET_ALREADY_EXISTS",
    );
  } finally {
    cleanupFixture(fixture.root);
  }
});

test("hard limit prevents creating more than two users", () => {
  const limits = new HardLimitGuard();
  limits.add("authUsersCreated", 2);
  assert.throws(() => limits.add("authUsersCreated"), /hard mutation limit exceeded/);
});

test("hard limit prevents creating more than one game", () => {
  const limits = new HardLimitGuard();
  limits.add("gamesCreated", 1);
  assert.throws(() => limits.add("gamesCreated"), /hard mutation limit exceeded/);
});

test("event creation is impossible under the zero limit", () => {
  assert.throws(() => new HardLimitGuard().add("eventsCreated"), /hard mutation limit exceeded/);
});

test("live-share-token creation is impossible under the zero limit", () => {
  assert.throws(
    () => new HardLimitGuard().add("liveShareTokensCreated"),
    /hard mutation limit exceeded/,
  );
});

test("arbitrary RPC calls are rejected", () => {
  assert.deepEqual(ALLOWED_MUTATION_RPCS, [
    "laxhornet_sync_game",
    "laxhornet_delete_game_durable",
  ]);
  assert.throws(() => assertAllowedRpc("arbitrary_rpc"), (error) => error.code === "RPC_NOT_ALLOWLISTED");
});

test("production adapter exposes no arbitrary SQL execution path", () => {
  const source = read("r206_synthetic_production_adapter.mjs");
  assert.doesNotMatch(source, /supabase\s+db\s+query|createClient\([^)]*database|executeSql|rawSql/i);
});

test("production adapter exposes no generic direct-table mutation method", () => {
  const source = read("r206_synthetic_production_adapter.mjs");
  assert.doesNotMatch(source, /async\s+(insertRow|updateRow|deleteRow|mutateTable|writeTable)\s*\(/);
});

test("state transitions cannot be skipped", async () => {
  const machine = new ExecutionStateMachine();
  await assert.rejects(
    () => machine.advance("users_created"),
    (error) => error.code === "INVALID_STATE_TRANSITION",
  );
});

test("cleanup ledger accepts only the reviewed owned objects", () => {
  const ledger = new CleanupLedger(createSyntheticScope(fixedNow));
  assert.throws(
    () => ledger.recordUser("unreviewed_user", { id: randomUUID() }),
    (error) => error.code === "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
  );
});

test("an execution failure after first mutation enters cleanup-only and deletes known residue", async () => {
  const deleted = [];
  const adapter = {
    async preflight() {
      return {
        projectRef: R206_PROJECT_REF,
        apiUrl: R206_API_URL,
        applicationOrigin: R206_APPLICATION_ORIGIN,
        runtimeSourceSha: R206_RUNTIME_SHA,
        pagesRunId: R206_PAGES_RUN_ID,
        releaseMarker: R206_RELEASE_MARKER,
        cacheName: R206_CACHE_NAME,
        migrationVersions: [...R206_MIGRATION_VERSIONS],
        unexpectedMigrations: 0,
        pendingMigrations: 0,
        catalogMatches: true,
        rlsMatches: true,
        grantsMatch: true,
        rpcsMatch: true,
        triggerMatches: true,
        lockOrderingMatches: true,
        startingTombstones: 0,
        startingResidue: {
          authUsers: 0, profiles: 0, sessions: 0, games: 0,
          events: 0, tombstones: 0, liveShareTokens: 0,
        },
      };
    },
    async createSyntheticUser(alias) {
      if (alias === "challenger_user") throw new R206StopError("injected", { code: "INJECTED" });
      return { id: randomUUID() };
    },
    async cleanupGameViaReviewedRpc() {
      return { outcome: "conflicted", code: "game_not_found" };
    },
    async deleteSyntheticUser(alias) {
      deleted.push(alias);
    },
    async verifyProfilesRemoved() {
      return ["owner_user"];
    },
    async finalCounts() {
      return {
        authUsers: 0, profiles: 0, sessions: 0, games: 0,
        events: 0, tombstones: 0, liveShareTokens: 0,
      };
    },
    async persistPrivateLedger(snapshot) {
      const serialized = JSON.stringify(snapshot);
      return {
        path: path.join(os.tmpdir(), "r206-partial-ledger.json"),
        sha256: createHash("sha256").update(serialized).digest("hex"),
        opaqueReference: "r206-private-partial",
      };
    },
  };
  await assert.rejects(
    () => executeSyntheticVerification({
      adapter,
      config: { executionMode: "disposable", targetRef },
      now: () => fixedNow,
    }),
    (error) => error.code === "INJECTED" && error.cleanupResults.cleanupComplete === true,
  );
  assert.deepEqual(deleted, ["owner_user"]);
});

test("one accepted durable delete permits exactly one retained tombstone", () => {
  const limits = new HardLimitGuard();
  limits.add("acceptedDurableDeletes", 1);
  limits.add("permanentTombstonesCreated", 1);
  assert.throws(
    () => limits.add("permanentTombstonesCreated", 1),
    (error) => error.code === "HARD_MUTATION_LIMIT_EXCEEDED",
  );
});

test("same-id replay cannot count as a second accepted delete", () => {
  const limits = new HardLimitGuard();
  limits.add("acceptedDurableDeletes", 1);
  assert.throws(
    () => limits.add("acceptedDurableDeletes", 1),
    (error) => error.code === "HARD_MUTATION_LIMIT_EXCEEDED",
  );
});

test("public evidence rejects identifiers and credentials", () => {
  assert.throws(() => assertPublicEvidenceSafe({ user: "person@example.com" }));
  assert.throws(() => assertPublicEvidenceSafe({ value: `Bearer ${"a".repeat(30)}` }));
  assert.throws(
    () => assertPublicEvidenceSafe({ aggregate: "opaque-private-value" }, ["opaque-private-value"]),
  );
});

test("public evidence keeps release closeout false and binds the private ledger hash", () => {
  const bundle = createPublicEvidenceBundle({
    status: "disposable_verification_complete_not_production_evidence",
    targetRef,
    privateLedgerSha256: "b".repeat(64),
    privateEvidenceReference: "r206-private-1234567890abcdef",
    operationResults: [],
    cleanupResults: { mutableResidue: 0 },
    stateHistory: [{ phase: "mutable_residue_zero", at: fixedNow.toISOString(), evidence: {} }],
    counts: {
      authUsers: 0, profiles: 0, sessions: 0, games: 0,
      events: 0, tombstones: 1, liveShareTokens: 0,
    },
  });
  assert.equal(bundle.cleanup.releaseCloseoutApproved, false);
  assert.equal(bundle.authorization.finalCloseoutApproval, false);
  assert.equal(bundle.cleanup.privateLedgerSha256, "b".repeat(64));
});

test("runner output and state never set releaseCloseoutApproved true", () => {
  const source = `${read("r206_synthetic_runner_core.mjs")}\n${read("run_r206_synthetic_verification.mjs")}`;
  assert.doesNotMatch(source, /releaseCloseoutApproved\s*:\s*true/);
});

test("secret environment variable names are never emitted by the CLI", () => {
  const source = read("run_r206_synthetic_verification.mjs");
  assert.doesNotMatch(source, /console\.(?:log|error)\([^)]*R206_SUPABASE_/);
  assert.match(source, /delete env\.R206_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source, /delete env\.R206_SUPABASE_SECRET_KEY/);
});

test("evidence schema requires false closeout flags and a SHA-256 ledger binding", () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "tools", "fixtures", "r206-synthetic-evidence-schema.json")),
  );
  assert.deepEqual(schema.properties.releaseCloseoutApproved, { const: false });
  assert.equal(schema.properties.privateLedgerSha256.pattern, "^[0-9a-f]{64}$");
});
