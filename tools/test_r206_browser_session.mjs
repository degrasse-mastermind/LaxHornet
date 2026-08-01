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
    this.bootstrapChecks = 0;
    this.reloadCount = 0;
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
          if (this.scenario.uiMarkerAbsent) throw timeoutError();
          if (this.scenario.uiMarkerDelayMilliseconds) {
            await new Promise((resolve) => setTimeout(
              resolve,
              this.scenario.uiMarkerDelayMilliseconds,
            ));
          }
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
            this.scenario.bootstrapRecognized = !(
              this.scenario.bootstrapMissing
              || this.scenario.bootstrapAfterReload
            );
            this.scenario.capabilityAvailable = this.scenario.capabilityMissing !== true;
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
        ? {
            present: true,
            notExpired: this.scenario.persistenceExpired !== true,
            identityMatch: this.scenario.persistenceIdentityMismatch !== true,
            accessToken: "synthetic-access",
            refreshToken: "synthetic-refresh",
          }
        : { present: false };
    }
    if (source.includes("client.auth.getSession")) {
      this.sessionChecks += 1;
      if (this.scenario.sessionLookupHangs) return new Promise(() => {});
      const delayed = this.scenario.sessionDelayChecks || 0;
      return {
        available: this.scenario.sessionAvailable && this.sessionChecks > delayed,
        notExpired: this.scenario.sessionExpired !== true,
        identityMatch: this.scenario.sessionIdentityMismatch !== true,
        clientReady: true,
        lookupError: this.scenario.sessionLookupError === true,
      };
    }
    if (source.includes("requiredKeys")) {
      this.bootstrapChecks += 1;
      return { recognized: this.scenario.bootstrapRecognized === true };
    }
    if (source.includes("laxhornet.games.user")) {
      return { available: this.scenario.capabilityAvailable === true };
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

  async reload() {
    this.reloadCount += 1;
    if (this.scenario.reloadFailure) throw new Error("synthetic reload failure");
    if (this.scenario.bootstrapAfterReload && this.reloadCount === 1) {
      this.scenario.bootstrapRecognized = true;
    }
    this.emit("domcontentloaded");
  }
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
    expectedPrincipalId: "00000000-0000-4000-8000-000000000001",
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

test("Supabase session and persistence checks allow one bounded delayed appearance", async () => {
  const fixture = harness({ storageDelayChecks: 2, sessionDelayChecks: 2 });
  try {
    const result = await fixture.establish({
      timeouts: {
        ...fixture.timeouts,
        auth_session_confirm: 200,
        auth_persistence_confirm: 200,
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

test("missing persistence and missing Supabase session have separate classifications", async () => {
  const storage = await classifiedFailure(
    { storageNever: true },
    "AUTH_PERSISTENCE_NOT_ESTABLISHED",
  );
  try {
    assert.equal(createFailureEnvelope(storage.error).localStorageStatePresent, false);
  } finally {
    removeHarness(storage.fixture.root);
  }

  const session = await classifiedFailure(
    { sessionNever: true },
    "AUTH_SESSION_NOT_ESTABLISHED",
    { timeouts: { auth_session_confirm: 100 } },
  );
  try {
    const envelope = createFailureEnvelope(session.error);
    assert.equal(envelope.localStorageStatePresent, false);
    assert.equal(envelope.authSessionConfirmed, false);
  } finally {
    removeHarness(session.fixture.root);
  }
});

test("a hanging Supabase session lookup is bounded and specifically classified", async () => {
  const { error, fixture } = await classifiedFailure(
    { sessionLookupHangs: true },
    "AUTH_SESSION_NOT_ESTABLISHED",
  );
  try {
    assert.equal(createFailureEnvelope(error).operation, "auth_session_confirm");
  } finally {
    removeHarness(fixture.root);
  }
});

test("confirmed session with immediate authenticated UI marker succeeds", async () => {
  const fixture = harness({});
  try {
    const result = await fixture.establish();
    assert.equal(result.diagnostics.authSessionConfirmed, true);
    assert.equal(result.diagnostics.authenticatedUiMarkerObserved, true);
    assert.equal(result.diagnostics.applicationAuthReloadAttempted, false);
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(fixture.root);
  }
});

test("delayed optional UI marker succeeds after required contract passes", async () => {
  const fixture = harness({ uiMarkerDelayMilliseconds: 5 });
  try {
    const result = await fixture.establish();
    assert.equal(result.diagnostics.applicationAuthBootstrapConfirmed, true);
    assert.equal(result.diagnostics.authenticatedCapabilityConfirmed, true);
    assert.equal(result.diagnostics.authenticatedUiMarkerObserved, true);
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(fixture.root);
  }
});

test("absent optional UI marker is diagnostic only", async () => {
  const fixture = harness({ uiMarkerAbsent: true });
  try {
    const result = await fixture.establish();
    assert.equal(result.diagnostics.authSessionConfirmed, true);
    assert.equal(result.diagnostics.authPersistenceConfirmed, true);
    assert.equal(result.diagnostics.applicationAuthBootstrapConfirmed, true);
    assert.equal(result.diagnostics.authenticatedCapabilityConfirmed, true);
    assert.equal(result.diagnostics.authenticatedUiMarkerObserved, false);
    assert.equal(result.diagnostics.uiMarkerAbsenceAffectedExecution, false);
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(fixture.root);
  }
});

test("UI marker presence without a valid session fails", async () => {
  const { error, fixture } = await classifiedFailure(
    { sessionNever: true },
    "AUTH_SESSION_NOT_ESTABLISHED",
  );
  try {
    const envelope = createFailureEnvelope(error);
    assert.equal(envelope.operation, "auth_session_confirm");
    assert.equal(envelope.authSessionConfirmed, false);
  } finally {
    removeHarness(fixture.root);
  }
});

test("expected synthetic identity succeeds and wrong identity fails without disclosure", async () => {
  const success = harness({});
  try {
    const result = await success.establish();
    assert.equal(result.diagnostics.authSessionIdentityConfirmed, true);
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(success.root);
  }

  const failed = await classifiedFailure(
    { sessionIdentityMismatch: true },
    "AUTH_SESSION_IDENTITY_MISMATCH",
  );
  try {
    const serialized = JSON.stringify(createFailureEnvelope(failed.error));
    assert.doesNotMatch(serialized, /00000000|private-synthetic|example\.invalid/i);
    assert.equal(failed.fixture.context.closed, true);
    assert.deepEqual(fs.readdirSync(failed.fixture.root), []);
  } finally {
    removeHarness(failed.fixture.root);
  }
});

test("authenticated bootstrap succeeds without reload", async () => {
  const fixture = harness({});
  try {
    const result = await fixture.establish();
    assert.equal(result.diagnostics.applicationAuthBootstrapConfirmed, true);
    assert.equal(result.diagnostics.applicationAuthReloadAttempted, false);
    assert.equal(fixture.page.reloadCount, 0);
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(fixture.root);
  }
});

test("authenticated bootstrap recovers after exactly one normal reload", async () => {
  const fixture = harness({ bootstrapAfterReload: true });
  try {
    const result = await fixture.establish({
      timeouts: {
        ...fixture.timeouts,
        application_auth_bootstrap_wait: 200,
        application_auth_bootstrap_verify: 200,
      },
    });
    assert.equal(result.diagnostics.applicationAuthBootstrapConfirmed, true);
    assert.equal(result.diagnostics.applicationAuthReloadAttempted, true);
    assert.equal(fixture.page.reloadCount, 1);
    assert.ok(result.diagnostics.timings.some(
      (value) => value.operation === "application_auth_reload",
    ));
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(fixture.root);
  }
});

test("bootstrap timeout is specific and a second reload is never attempted", async () => {
  const { error, fixture } = await classifiedFailure(
    { bootstrapMissing: true },
    "APPLICATION_AUTH_BOOTSTRAP_TIMEOUT",
    {
      timeouts: {
        application_auth_bootstrap_wait: 200,
        application_auth_bootstrap_verify: 200,
      },
    },
  );
  try {
    const envelope = createFailureEnvelope(error);
    assert.equal(envelope.operation, "application_auth_bootstrap_verify");
    assert.equal(envelope.applicationAuthReloadAttempted, true);
    assert.equal(fixture.page.reloadCount, 1);
  } finally {
    removeHarness(fixture.root);
  }
});

test("reload failure is separately classified", async () => {
  const { error, fixture } = await classifiedFailure(
    { bootstrapAfterReload: true, reloadFailure: true },
    "APPLICATION_AUTH_RELOAD_FAILED",
    { timeouts: { application_auth_bootstrap_wait: 200 } },
  );
  try {
    const envelope = createFailureEnvelope(error);
    assert.equal(envelope.operation, "application_auth_reload");
    assert.equal(envelope.applicationAuthReloadAttempted, true);
    assert.equal(fixture.page.reloadCount, 1);
  } finally {
    removeHarness(fixture.root);
  }
});

test("protected capability succeeds and specific failure remains fail closed", async () => {
  const success = harness({});
  try {
    const result = await success.establish();
    assert.equal(result.diagnostics.authenticatedCapabilityConfirmed, true);
    await closeR206BrowserSession(result.entry);
  } finally {
    removeHarness(success.root);
  }

  const failed = await classifiedFailure(
    { capabilityMissing: true },
    "AUTHENTICATED_CAPABILITY_UNAVAILABLE",
  );
  try {
    const envelope = createFailureEnvelope(failed.error);
    assert.equal(envelope.operation, "authenticated_capability_verify");
    assert.equal(envelope.applicationAuthBootstrapConfirmed, true);
    assert.equal(envelope.authenticatedCapabilityConfirmed, false);
  } finally {
    removeHarness(failed.fixture.root);
  }
});

test("session success diagnostics record every required safe boolean", async () => {
  const fixture = harness({ uiMarkerAbsent: true });
  try {
    const result = await fixture.establish();
    assert.deepEqual({
      session: result.diagnostics.authSessionConfirmed,
      identity: result.diagnostics.authSessionIdentityConfirmed,
      persistence: result.diagnostics.authPersistenceConfirmed,
      bootstrap: result.diagnostics.applicationAuthBootstrapConfirmed,
      capability: result.diagnostics.authenticatedCapabilityConfirmed,
      marker: result.diagnostics.authenticatedUiMarkerObserved,
      reload: result.diagnostics.applicationAuthReloadAttempted,
    }, {
      session: true,
      identity: true,
      persistence: true,
      bootstrap: true,
      capability: true,
      marker: false,
      reload: false,
    });
    await closeR206BrowserSession(result.entry);
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
    ["auth_session_confirm", "after"],
    ["auth_persistence_confirm", "before"],
    ["application_auth_bootstrap_wait", "after"],
    ["application_auth_reload", "after"],
    ["application_auth_bootstrap_verify", "after"],
    ["authenticated_capability_verify", "after"],
    ["authenticated_ui_marker_observe", "after"],
  ];
  for (const [operation, position] of boundaries) {
    const fixture = harness(
      operation === "application_auth_reload" ? { bootstrapAfterReload: true } : {},
    );
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

test("partial bootstrap and capability failures clean all Auth/browser residue before game creation", async () => {
  const failureCases = [
    {
      code: "APPLICATION_AUTH_BOOTSTRAP_TIMEOUT",
      operation: "application_auth_bootstrap_verify",
      lastCompletedOperation: "application_auth_reload",
      bootstrapConfirmed: false,
      capabilityConfirmed: false,
      reloadAttempted: true,
    },
    {
      code: "AUTHENTICATED_CAPABILITY_UNAVAILABLE",
      operation: "authenticated_capability_verify",
      lastCompletedOperation: "application_auth_bootstrap_verify",
      bootstrapConfirmed: true,
      capabilityConfirmed: false,
      reloadAttempted: false,
    },
  ];

  for (const failure of failureCases) {
    const privateEvidenceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "laxhornet-r206-partial-private-"),
    );
    const publicEvidenceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "laxhornet-r206-partial-public-"),
    );
    const adapter = await createDisposableAdapter({
      repoRoot: process.cwd(),
      privateEvidenceDir,
      publicEvidenceDir,
    });
    const signIn = adapter.signInSyntheticUser.bind(adapter);
    const guardedCreate = adapter.guardedCreate.bind(adapter);
    let signInCount = 0;
    let guardedCreateCalled = false;
    adapter.guardedCreate = async (...arguments_) => {
      guardedCreateCalled = true;
      return guardedCreate(...arguments_);
    };
    adapter.signInSyntheticUser = async (...arguments_) => {
      const session = await signIn(...arguments_);
      signInCount += 1;
      if (signInCount === 2) {
        if (session.browserProfilePath) {
          await adapter.clearBrowserProfile(session.browserProfilePath);
        }
        const error = new R206StopError("classified partial browser session failure", {
          code: failure.code,
        });
        error.executionContext = {
          currentOperation: failure.operation,
          operation: failure.operation,
          lastCompletedOperation: failure.lastCompletedOperation,
          browserContextExisted: true,
          authRequestStarted: true,
          authResponseAccepted: true,
          authSessionConfirmed: true,
          authSessionIdentityConfirmed: true,
          authPersistenceConfirmed: true,
          applicationAuthBootstrapConfirmed: failure.bootstrapConfirmed,
          authenticatedCapabilityConfirmed: failure.capabilityConfirmed,
          applicationAuthReloadAttempted: failure.reloadAttempted,
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
          return error.code === failure.code;
        },
      );
      assert.equal(envelope.runnerOperation, "establish_sessions");
      assert.equal(envelope.operation, failure.operation);
      assert.equal(envelope.mutationStarted, true);
      assert.equal(envelope.cleanupEntered, true);
      assert.equal(envelope.cleanupCompleted, true);
      assert.equal(guardedCreateCalled, false);
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
