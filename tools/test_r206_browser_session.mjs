import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  R206_BROWSER_SESSION_TIMEOUTS,
  closeR206BrowserSession,
  establishR206BrowserSession,
} from "./r206_browser_session.mjs";
import { createDisposableAdapter } from "./r206_synthetic_disposable_adapter.mjs";
import {
  R206StopError,
  createFailureEnvelope,
  executeSyntheticVerification,
} from "./r206_synthetic_runner_core.mjs";
import { run } from "./run_r206_synthetic_verification.mjs";

function timeoutError(code = "PLAYWRIGHT_TIMEOUT") {
  const error = new Error("synthetic timeout with hidden private detail");
  error.name = "TimeoutError";
  error.code = code;
  return error;
}

class FakePage extends EventEmitter {
  constructor(scenario = {}) {
    super();
    this.scenario = scenario;
    this.currentUrl = "about:blank";
    this.storageChecks = 0;
    this.sessionChecks = 0;
    this.closed = false;
  }

  async goto(url) {
    if (this.scenario.navigationTimeout) throw timeoutError();
    this.currentUrl = url;
    this.emit("domcontentloaded");
  }

  async waitForFunction(callback) {
    const source = String(callback);
    if (source.includes("document.readyState") && this.scenario.applicationMissing) {
      throw timeoutError();
    }
    if (source.includes("window.supabase") && this.scenario.supabaseMissing) {
      throw timeoutError();
    }
  }

  locator(selector) {
    return {
      waitFor: async () => {
        if (selector === '[data-action="sign-out"]') {
          if (!this.scenario.authenticatedApp) throw timeoutError();
          return;
        }
        if (this.scenario.authUiMissing) throw timeoutError();
      },
      fill: async () => {
        if (this.scenario.submitFailure) throw new Error("synthetic fill failure");
      },
      click: async () => {
        if (this.scenario.submitFailure) throw new Error("synthetic click failure");
        queueMicrotask(() => {
          const url = `${this.scenario.authOrigin}/auth/v1/token?grant_type=password`;
          this.emit("request", { url: () => url });
          if (this.scenario.authRequestTimeout) return;
          this.scenario.authRequestCompleted = true;
          this.emit("response", {
            url: () => url,
            ok: () => !this.scenario.authRejected,
          });
          if (!this.scenario.authRejected) {
            this.scenario.storageAvailable = this.scenario.storageNever !== true;
            this.scenario.sessionAvailable = this.scenario.sessionNever !== true;
            this.scenario.authenticatedApp = this.scenario.authenticatedAppMissing !== true;
          }
        });
      },
    };
  }

  async evaluate(callback) {
    const source = String(callback);
    if (source.includes("localStorage.length")) {
      this.storageChecks += 1;
      const delayed = this.scenario.storageDelayChecks || 0;
      const present = this.scenario.storageAvailable && this.storageChecks > delayed;
      return present
        ? { present: true, accessToken: "synthetic-access", refreshToken: "synthetic-refresh" }
        : { present: false };
    }
    if (source.includes("createClient")) {
      this.sessionChecks += 1;
      if (this.scenario.sessionLookupHangs) return new Promise(() => {});
      const delayed = this.scenario.sessionDelayChecks || 0;
      return {
        available: this.scenario.sessionAvailable && this.sessionChecks > delayed,
        clientReady: true,
        lookupError: this.scenario.sessionLookupError === true,
      };
    }
    throw new Error("unexpected fake page evaluation");
  }

  async waitForURL(predicate) {
    if (this.scenario.redirectMissing) throw timeoutError();
    const redirected = `${this.currentUrl}?authenticated=1`;
    if (!predicate(new URL(redirected))) throw timeoutError();
    this.currentUrl = redirected;
  }

  url() {
    return this.currentUrl;
  }

  async reload() {}
}

class FakeContext {
  constructor(page, scenario = {}) {
    this.page = page;
    this.scenario = scenario;
    this.closed = false;
  }

  pages() {
    return this.scenario.forceNewPage ? [] : [this.page];
  }

  async newPage() {
    if (this.scenario.pageCreateFailure) throw new Error("synthetic page creation failure");
    return this.page;
  }

  async cookies() {
    return this.scenario.cookiesPresent ? [{ name: "safe-test-cookie" }] : [];
  }

  async close() {
    if (this.scenario.contextCloseFailure) throw new Error("synthetic context close failure");
    this.closed = true;
    this.page.closed = true;
    this.page.emit("close");
  }
}

function harness(scenario = {}, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-session-test-"));
  scenario.authOrigin ||= "http://127.0.0.1:41999";
  const page = new FakePage(scenario);
  const context = new FakeContext(page, scenario);
  const chromium = {
    async launchPersistentContext() {
      if (scenario.contextCreateFailure) throw new Error("synthetic context creation failure");
      return context;
    },
  };
  const timeouts = Object.fromEntries(
    Object.keys(R206_BROWSER_SESSION_TIMEOUTS).map((operation) => [operation, 25]),
  );
  const establish = (extra = {}) => establishR206BrowserSession({
    chromium,
    applicationOrigin: "http://127.0.0.1:41998",
    authOrigin: scenario.authOrigin,
    identity: {
      email: "private-synthetic@example.invalid",
      password: "private-synthetic-password",
    },
    osImpl: { tmpdir: () => root },
    timeouts,
    ...overrides,
    ...extra,
  });
  return { root, page, context, scenario, establish, timeouts };
}

function removeHarness(root) {
  const resolved = path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
  fs.rmSync(resolved, { recursive: true, force: true });
}

async function classifiedFailure(scenario, code, extra = {}) {
  const fixture = harness(scenario);
  try {
    let captured;
    await assert.rejects(
      () => fixture.establish(extra),
      (error) => {
        captured = error;
        return error.code === code;
      },
    );
    return { error: captured, fixture };
  } catch (error) {
    removeHarness(fixture.root);
    throw error;
  }
}

test("navigation timeout is specific and preserves native TimeoutError", async () => {
  const { error, fixture } = await classifiedFailure(
    { navigationTimeout: true },
    "BROWSER_NAVIGATION_TIMEOUT",
  );
  try {
    const envelope = createFailureEnvelope(error);
    assert.equal(envelope.operation, "browser_navigate");
    assert.equal(envelope.lastCompletedOperation, "browser_page_create");
    assert.equal(envelope.nativeError.name, "TimeoutError");
    assert.equal(envelope.timeoutMilliseconds, 25);
    assert.equal(envelope.actionCount, 21);
    assert.equal(envelope.browserContextExisted, true);
    assert.equal(fixture.context.closed, true);
    assert.deepEqual(fs.readdirSync(fixture.root), []);
  } finally {
    removeHarness(fixture.root);
  }
});

test("missing application marker is distinct from auth UI readiness", async () => {
  const { error, fixture } = await classifiedFailure(
    { applicationMissing: true },
    "APPLICATION_NOT_READY",
  );
  try {
    assert.equal(createFailureEnvelope(error).operation, "application_ready");
  } finally {
    removeHarness(fixture.root);
  }
});

test("missing Supabase client marker is classified before credential submission", async () => {
  const { error, fixture } = await classifiedFailure(
    { supabaseMissing: true },
    "SUPABASE_CLIENT_NOT_READY",
  );
  try {
    const envelope = createFailureEnvelope(error);
    assert.equal(envelope.operation, "supabase_client_ready");
    assert.equal(envelope.authRequestStarted, false);
  } finally {
    removeHarness(fixture.root);
  }
});

test("auth UI readiness timeout is specific", async () => {
  const { error, fixture } = await classifiedFailure({ authUiMissing: true }, "AUTH_UI_NOT_READY");
  try {
    assert.equal(createFailureEnvelope(error).operation, "auth_ui_ready");
  } finally {
    removeHarness(fixture.root);
  }
});

test("auth request timeout records whether the request began", async () => {
  const { error, fixture } = await classifiedFailure(
    { authRequestTimeout: true },
    "AUTH_REQUEST_TIMEOUT",
  );
  try {
    const envelope = createFailureEnvelope(error);
    assert.equal(envelope.operation, "auth_response_wait");
    assert.equal(envelope.authRequestStarted, true);
    assert.equal(envelope.authSessionConfirmed, false);
  } finally {
    removeHarness(fixture.root);
  }
});

test("auth request rejection is not flattened to a generic browser failure", async () => {
  const { error, fixture } = await classifiedFailure({ authRejected: true }, "AUTH_REQUEST_REJECTED");
  try {
    assert.equal(createFailureEnvelope(error).operation, "auth_response_wait");
  } finally {
    removeHarness(fixture.root);
  }
});

test("required redirect timeout is classified, while the current no-redirect flow succeeds", async () => {
  const failed = await classifiedFailure(
    { redirectMissing: true },
    "AUTH_REDIRECT_TIMEOUT",
    { expectedRedirect: true },
  );
  removeHarness(failed.fixture.root);

  const fixture = harness({});
  try {
    const result = await fixture.establish({ expectedRedirect: false });
    assert.equal(result.diagnostics.authSessionConfirmed, true);
    assert.ok(result.diagnostics.timings.some(
      (value) => value.operation === "auth_redirect_observe",
    ));
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(fixture.root);
  }
});

test("storage and Supabase session checks allow one bounded delayed appearance", async () => {
  const fixture = harness({ storageDelayChecks: 2, sessionDelayChecks: 2 });
  try {
    const result = await fixture.establish({
      timeouts: {
        ...fixture.timeouts,
        auth_storage_verify: 200,
        auth_session_verify: 200,
      },
    });
    assert.ok(fixture.page.storageChecks >= 3);
    assert.ok(fixture.page.sessionChecks >= 3);
    assert.equal(result.diagnostics.localStorageStatePresent, true);
    assert.equal(result.diagnostics.authSessionConfirmed, true);
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(fixture.root);
  }
});

test("missing storage and missing Supabase session have separate classifications", async () => {
  const storage = await classifiedFailure({ storageNever: true }, "AUTH_STORAGE_NOT_ESTABLISHED");
  try {
    assert.equal(createFailureEnvelope(storage.error).localStorageStatePresent, false);
  } finally {
    removeHarness(storage.fixture.root);
  }

  const session = await classifiedFailure(
    { sessionNever: true },
    "AUTH_SESSION_NOT_ESTABLISHED",
    { timeouts: { auth_session_verify: 100 } },
  );
  try {
    const envelope = createFailureEnvelope(session.error);
    assert.equal(envelope.localStorageStatePresent, true);
    assert.equal(envelope.authSessionConfirmed, false);
  } finally {
    removeHarness(session.fixture.root);
  }
});

test("a hanging Supabase session lookup is bounded", async () => {
  const { error, fixture } = await classifiedFailure(
    { sessionLookupHangs: true },
    "AUTH_SESSION_VERIFICATION_TIMEOUT",
  );
  try {
    assert.equal(createFailureEnvelope(error).operation, "auth_session_verify");
  } finally {
    removeHarness(fixture.root);
  }
});

test("browser contexts, storage, and profiles are isolated across sequential sessions", async () => {
  const first = harness({});
  const second = harness({});
  try {
    const firstResult = await first.establish();
    const secondResult = await second.establish();
    assert.notEqual(firstResult.entry.context, secondResult.entry.context);
    assert.notEqual(firstResult.entry.profilePath, secondResult.entry.profilePath);
    assert.equal(first.page.storageChecks > 0, true);
    assert.equal(second.page.storageChecks > 0, true);
    await closeR206BrowserSession(firstResult.entry);
    await closeR206BrowserSession(secondResult.entry);
    assert.equal(firstResult.entry.profileRemoved, true);
    assert.equal(secondResult.entry.profileRemoved, true);
  } finally {
    removeHarness(first.root);
    removeHarness(second.root);
  }
});

test("failure envelope does not disclose credentials, tokens, IDs, URLs, or native messages", async () => {
  const { error, fixture } = await classifiedFailure(
    { authRequestTimeout: true },
    "AUTH_REQUEST_TIMEOUT",
  );
  try {
    const serialized = JSON.stringify(createFailureEnvelope(error));
    assert.doesNotMatch(serialized, /private-synthetic|synthetic-access|synthetic-refresh|example\.invalid/i);
    assert.doesNotMatch(serialized, /127\.0\.0\.1|auth\/v1|hidden private detail/i);
  } finally {
    removeHarness(fixture.root);
  }
});

test("last-completed, elapsed, and operation-specific timeout fields are reported", async () => {
  const { error, fixture } = await classifiedFailure(
    { authRequestTimeout: true },
    "AUTH_REQUEST_TIMEOUT",
  );
  try {
    const envelope = createFailureEnvelope(error);
    assert.equal(envelope.lastCompletedOperation, "auth_submit");
    assert.equal(Number.isInteger(envelope.elapsedMilliseconds), true);
    assert.equal(envelope.timeoutMilliseconds, 25);
    assert.ok(envelope.operationTimings.length >= 8);
    assert.equal(envelope.releaseCloseoutApproved, false);
  } finally {
    removeHarness(fixture.root);
  }
});

test("failure injection at each browser boundary removes the context and profile", async () => {
  const boundaries = [
    ["browser_context_create", "before"],
    ["browser_context_create", "after"],
    ["browser_page_create", "after"],
    ["auth_submit", "before"],
    ["auth_storage_verify", "before"],
    ["auth_session_verify", "after"],
  ];
  for (const [operation, position] of boundaries) {
    const fixture = harness({});
    try {
      await assert.rejects(
        () => fixture.establish({
          faultInjector: ({ operation: current, position: currentPosition }) => {
            if (current === operation && currentPosition === position) {
              throw new Error("synthetic boundary failure");
            }
          },
        }),
      );
      assert.deepEqual(fs.readdirSync(fixture.root), []);
      if (!(operation === "browser_context_create" && position === "before")) {
        assert.equal(fixture.context.closed, true);
      }
    } finally {
      removeHarness(fixture.root);
    }
  }
});

test("browser context cleanup failure is separately classified", async () => {
  const fixture = harness({ contextCloseFailure: true, authRequestTimeout: true });
  try {
    await assert.rejects(
      () => fixture.establish(),
      (error) => error.code === "BROWSER_CONTEXT_CLEANUP_FAILED"
        && error.executionContext.priorBrowserOperation === "auth_response_wait",
    );
    assert.ok(fs.readdirSync(fixture.root).length > 0);
  } finally {
    removeHarness(fixture.root);
  }
});

test("temporary-profile cleanup failure is separately classified", async () => {
  const fixture = harness({ authRequestTimeout: true });
  const fsImpl = {
    ...fs,
    rmSync(candidate, options) {
      if (String(candidate).includes("laxhornet-r206-browser-")) {
        throw new Error("synthetic profile removal failure");
      }
      return fs.rmSync(candidate, options);
    },
  };
  try {
    await assert.rejects(
      () => fixture.establish({ fsImpl }),
      (error) => error.code === "BROWSER_PROFILE_CLEANUP_FAILED",
    );
  } finally {
    removeHarness(fixture.root);
  }
});

test("generic fallback remains only for failures without a classified operation", () => {
  const envelope = createFailureEnvelope(new Error("unknown failure"));
  assert.equal(envelope.code, "UNEXPECTED_EXECUTION_FAILURE");
  assert.equal(envelope.operation, "unknown");
  assert.equal(envelope.releaseCloseoutApproved, false);
});

test("partial session establishment after user/profile creation enters cleanup-only and returns zero residue", async () => {
  const privateEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-partial-private-"));
  const publicEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-partial-public-"));
  const adapter = await createDisposableAdapter({
    repoRoot: process.cwd(),
    privateEvidenceDir,
    publicEvidenceDir,
  });
  const signIn = adapter.signInSyntheticUser.bind(adapter);
  let signInCount = 0;
  adapter.signInSyntheticUser = async (...arguments_) => {
    const session = await signIn(...arguments_);
    signInCount += 1;
    if (signInCount === 2) {
      if (session.browserProfilePath) {
        await adapter.clearBrowserProfile(session.browserProfilePath);
      }
      const error = new R206StopError("classified partial browser session failure", {
        code: "AUTH_SESSION_NOT_ESTABLISHED",
      });
      error.executionContext = {
        currentOperation: "auth_session_verify",
        operation: "auth_session_verify",
        lastCompletedOperation: "auth_storage_verify",
        browserContextExisted: true,
        authRequestStarted: true,
        authSessionConfirmed: false,
      };
      throw error;
    }
    return session;
  };
  try {
    let envelope;
    await assert.rejects(
      () => executeSyntheticVerification({
        adapter,
        config: {
          executionMode: "disposable",
          targetRef: "a".repeat(40),
          projectRef: "local-r206-disposable",
          privateEvidenceDir,
          publicEvidenceDir,
          credentialSource: "disposable_in_memory",
          releaseCloseoutApproved: false,
        },
      }),
      (error) => {
        envelope = createFailureEnvelope(error);
        return error.code === "AUTH_SESSION_NOT_ESTABLISHED";
      },
    );
    assert.equal(envelope.runnerOperation, "establish_sessions");
    assert.equal(envelope.operation, "auth_session_verify");
    assert.equal(envelope.mutationStarted, true);
    assert.equal(envelope.cleanupEntered, true);
    assert.equal(envelope.cleanupCompleted, true);
    assert.deepEqual(envelope.residueCounts, {
      authUsers: 0,
      profiles: 0,
      sessions: 0,
      games: 0,
      events: 0,
      tombstones: 0,
      liveShareTokens: 0,
      operations: 0,
    });
    assert.equal(envelope.authorizationState, "failed_unused");
    assert.equal(envelope.releaseCloseoutApproved, false);
  } finally {
    await adapter.close().catch(() => {});
    removeHarness(privateEvidenceDir);
    removeHarness(publicEvidenceDir);
  }
});

test("diagnostic CLI path is credential-free, production-free, and false-closeout", async () => {
  let credentialReads = 0;
  let readinessCalls = 0;
  let diagnosticCalls = 0;
  const result = await run(
    ["--diagnose-browser-session"],
    new Proxy({}, {
      get() {
        credentialReads += 1;
        return undefined;
      },
    }),
    {
      checkBrowserRuntime: async () => {
        readinessCalls += 1;
        return { chromium: { synthetic: true } };
      },
      diagnoseBrowserSession: async ({ chromium }) => {
        diagnosticCalls += 1;
        assert.equal(chromium.synthetic, true);
        return {
          ok: true,
          productionEndpointContacted: false,
          productionCredentialsRequired: false,
          releaseCloseoutApproved: false,
        };
      },
    },
  );
  assert.equal(credentialReads, 0);
  assert.equal(readinessCalls, 1);
  assert.equal(diagnosticCalls, 1);
  assert.equal(result.productionEndpointContacted, false);
  assert.equal(result.releaseCloseoutApproved, false);
});
