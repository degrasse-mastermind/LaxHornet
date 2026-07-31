import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  R206_CACHE_NAME,
  R206_MIGRATION_VERSIONS,
  R206_PAGES_RUN_ID,
  R206_RELEASE_MARKER,
  R206_RUNTIME_SHA,
  R206StopError,
  attachExecutionContext,
  createFailureEnvelope,
} from "./r206_synthetic_runner_core.mjs";
import { checkR206BrowserRuntime } from "./r206_browser_runtime.mjs";
import { createProductionAdapter } from "./r206_synthetic_production_adapter.mjs";
import { run } from "./run_r206_synthetic_verification.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function temporaryRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-browser-test-"));
}

function removeTemporaryRoot(root) {
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function fakeExecutable(root) {
  const executable = path.join(root, "chromium-test-binary");
  fs.writeFileSync(executable, "synthetic test executable");
  return executable;
}

test("missing Playwright is classified before production credentials or mutation", async () => {
  const native = new Error("Cannot find package playwright");
  native.code = "ERR_MODULE_NOT_FOUND";
  await assert.rejects(
    () => checkR206BrowserRuntime({
      loadPlaywright: async () => {
        throw native;
      },
    }),
    (error) =>
      error.code === "BROWSER_RUNTIME_UNAVAILABLE"
      && error.nativeErrorCode === "ERR_MODULE_NOT_FOUND"
      && error.executionContext.mutationStarted === false,
  );
});

test("missing Chromium executable is classified before launch", async () => {
  await assert.rejects(
    () => checkR206BrowserRuntime({
      loadPlaywright: async () => ({
        chromium: {
          executablePath: () => path.join(os.tmpdir(), "missing-r206-chromium"),
          launchPersistentContext: async () => {
            throw new Error("must not launch");
          },
        },
      }),
    }),
    (error) => error.code === "BROWSER_EXECUTABLE_MISSING",
  );
});

test("browser launch failure is classified and removes the isolated profile", async () => {
  const root = temporaryRoot();
  const executable = fakeExecutable(root);
  const profiles = [];
  try {
    const native = new Error("synthetic launch failure");
    native.code = "BROWSER_LAUNCH_ERROR";
    await assert.rejects(
      () => checkR206BrowserRuntime({
        osImpl: { tmpdir: () => root },
        loadPlaywright: async () => ({
          chromium: {
            executablePath: () => executable,
            launchPersistentContext: async (profilePath) => {
              profiles.push(profilePath);
              throw native;
            },
          },
        }),
      }),
      (error) =>
        error.code === "BROWSER_LAUNCH_FAILED"
        && error.nativeErrorCode === "BROWSER_LAUNCH_ERROR",
    );
    assert.equal(profiles.length, 1);
    assert.equal(fs.existsSync(profiles[0]), false);
  } finally {
    removeTemporaryRoot(root);
  }
});

test("successful readiness uses and removes only an isolated temporary profile", async () => {
  const root = temporaryRoot();
  const executable = fakeExecutable(root);
  let profilePath = null;
  let closed = false;
  try {
    const readiness = await checkR206BrowserRuntime({
      osImpl: { tmpdir: () => root },
      loadPlaywright: async () => ({
        chromium: {
          executablePath: () => executable,
          launchPersistentContext: async (candidate) => {
            profilePath = candidate;
            return {
              async close() {
                closed = true;
              },
            };
          },
        },
      }),
    });
    assert.equal(readiness.result.code, "BROWSER_RUNTIME_READY");
    assert.equal(closed, true);
    assert.match(path.basename(profilePath), /^laxhornet-r206-readiness-/);
    assert.equal(path.dirname(profilePath), path.resolve(root));
    assert.equal(fs.existsSync(profilePath), false);
  } finally {
    removeTemporaryRoot(root);
  }
});

test("credential-free readiness command performs no production work", async () => {
  let credentialReads = 0;
  const env = new Proxy({}, {
    get() {
      credentialReads += 1;
      return undefined;
    },
  });
  const result = await run(["--check-browser-runtime"], env, {
    checkBrowserRuntime: async () => ({
      result: {
        ok: true,
        code: "BROWSER_RUNTIME_READY",
        networkMutationCount: 0,
      },
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.networkMutationCount, 0);
  assert.equal(credentialReads, 0);
});

test("production readiness failure prevents configuration, adapter, Auth, and mutation", async () => {
  const calls = { validate: 0, adapter: 0, execute: 0 };
  const native = new Error("Cannot find package playwright");
  native.code = "ERR_MODULE_NOT_FOUND";
  await assert.rejects(
    () => run(
      ["--execution-mode", "production", "--allow-production"],
      {},
      {
        checkBrowserRuntime: async () => {
          throw new R206StopError("the reviewed Playwright module is unavailable", {
            code: "BROWSER_RUNTIME_UNAVAILABLE",
            cause: native,
          });
        },
        validateProductionConfiguration: () => {
          calls.validate += 1;
        },
        createProductionAdapter: () => {
          calls.adapter += 1;
        },
        executeSyntheticVerification: async () => {
          calls.execute += 1;
        },
      },
    ),
    (error) =>
      error.code === "BROWSER_RUNTIME_UNAVAILABLE"
      && error.executionContext.mutationStarted === false,
  );
  assert.deepEqual(calls, { validate: 0, adapter: 0, execute: 0 });
});

test("failure envelope retains classified and sanitized execution context", () => {
  const error = attachExecutionContext(
    new R206StopError("reviewed browser runtime is unavailable", {
      code: "BROWSER_RUNTIME_UNAVAILABLE",
    }),
    {
      currentOperation: "browser_runtime_readiness",
      phase: "browser_readiness",
      lastSuccessfullyCompletedPhase: "preflight_verified",
      completedActionCount: 4,
      mutationStarted: true,
      cleanupOnlyStarted: true,
      cleanupCompleted: true,
      residueCounts: { authUsers: 0, games: 0, tombstones: 1 },
      privateCheckpointReference: "r206-private-opaque",
      retainedTombstone: true,
      manualCleanupRequired: false,
      authorizationConsumed: true,
    },
  );
  const envelope = createFailureEnvelope(error);
  assert.equal(envelope.code, "BROWSER_RUNTIME_UNAVAILABLE");
  assert.equal(envelope.currentOperation, "browser_runtime_readiness");
  assert.equal(envelope.phase, "browser_readiness");
  assert.equal(envelope.completedActionCount, 4);
  assert.equal(envelope.mutationStarted, true);
  assert.equal(envelope.cleanupOnlyStarted, true);
  assert.equal(envelope.cleanupCompleted, true);
  assert.deepEqual(envelope.residueCounts, { authUsers: 0, games: 0, tombstones: 1 });
  assert.equal(envelope.privateCheckpointReference, "r206-private-opaque");
  assert.equal(envelope.retainedTombstone, true);
  assert.equal(envelope.manualCleanupRequired, false);
  assert.equal(envelope.authorizationState, "failed_consumed");
  assert.equal(envelope.releaseCloseoutApproved, false);
});

test("unexpected native error keeps a safe native class and code without raw details", () => {
  const native = new SyntaxError(
    "bad JSON for person@example.com with password and 11111111-1111-4111-8111-111111111111",
  );
  native.code = "JSON_PARSE_FAILURE";
  const envelope = createFailureEnvelope(native, {
    currentOperation: "read_private_artifact",
    phase: "configuration_validation",
    privateCheckpointReference: "11111111-1111-4111-8111-111111111111",
  });
  const serialized = JSON.stringify(envelope);
  assert.equal(envelope.code, "UNEXPECTED_EXECUTION_FAILURE");
  assert.equal(envelope.nativeError.name, "SyntaxError");
  assert.equal(envelope.nativeError.code, "JSON_PARSE_FAILURE");
  assert.equal(envelope.privateCheckpointReference, null);
  assert.doesNotMatch(serialized, /person@example|password|11111111-/i);
});

function failureAdapter(fetchImpl) {
  const privateEvidenceDir = temporaryRoot();
  return {
    privateEvidenceDir,
    adapter: createProductionAdapter({
      repoRoot,
      config: {
        privateEvidenceDir,
        publicEvidenceDir: privateEvidenceDir,
        authorizationConsumptionPath: path.join(privateEvidenceDir, "consumption.json"),
        targetRef: "a".repeat(40),
      },
      authorization: { browserExecutionAuthorized: true },
      preflightArtifact: {
        runtimeSourceSha: R206_RUNTIME_SHA,
        pagesRunId: R206_PAGES_RUN_ID,
        releaseMarker: R206_RELEASE_MARKER,
        cacheName: R206_CACHE_NAME,
        migrationVersions: [...R206_MIGRATION_VERSIONS],
      },
      artifactHashes: { authorization: "b".repeat(64), preflight: "c".repeat(64) },
      secrets: { publishableKey: "publishable-test", secretKey: "secret-test" },
      browserRuntime: { chromium: {} },
      fetchImpl,
    }),
  };
}

test("production adapter classifies a native network failure safely", async () => {
  const fixture = failureAdapter(async () => {
    const error = new TypeError("synthetic network failure");
    error.code = "ECONNREFUSED";
    throw error;
  });
  try {
    await assert.rejects(
      () => fixture.adapter.preflight(),
      (error) =>
        error.code === "NETWORK_REQUEST_FAILED"
        && error.nativeErrorName === "TypeError"
        && error.nativeErrorCode === "ECONNREFUSED",
    );
  } finally {
    await fixture.adapter.close();
    removeTemporaryRoot(fixture.privateEvidenceDir);
  }
});

test("production adapter classifies successful invalid JSON safely", async () => {
  const responses = [
    {
      ok: true,
      async json() {
        throw new SyntaxError("synthetic invalid JSON");
      },
    },
    {
      ok: true,
      async text() {
        return `const CACHE = "${R206_CACHE_NAME}";`;
      },
    },
  ];
  const fixture = failureAdapter(async () => responses.shift());
  try {
    await assert.rejects(
      () => fixture.adapter.preflight(),
      (error) =>
        error.code === "JSON_PARSE_FAILURE"
        && error.nativeErrorName === "SyntaxError",
    );
  } finally {
    await fixture.adapter.close();
    removeTemporaryRoot(fixture.privateEvidenceDir);
  }
});

test("CLI emits one JSON failure envelope and preserves a classified code", () => {
  const result = spawnSync(
    process.execPath,
    ["tools/run_r206_synthetic_verification.mjs", "--unknown"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  const envelope = JSON.parse(result.stderr.trim());
  assert.equal(envelope.code, "INVALID_ARGUMENT");
  assert.equal(typeof envelope, "object");
  assert.equal(typeof envelope.message, "string");
  assert.doesNotMatch(result.stderr, /\\"ok\\"/);
});
