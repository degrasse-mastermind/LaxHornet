import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { R206StopError } from "./r206_synthetic_runner_core.mjs";

export const R206_BROWSER_SESSION_TIMEOUTS = Object.freeze({
  browser_context_create: 15_000,
  browser_page_create: 5_000,
  browser_navigate: 15_000,
  application_ready: 5_000,
  supabase_client_ready: 5_000,
  auth_ui_ready: 10_000,
  auth_submit: 5_000,
  auth_response_wait: 15_000,
  auth_redirect_wait: 5_000,
  auth_redirect_observe: 1_000,
  auth_session_confirm: 10_000,
  auth_persistence_confirm: 10_000,
  application_auth_bootstrap_wait: 10_000,
  application_auth_reload: 15_000,
  application_auth_bootstrap_verify: 10_000,
  authenticated_capability_verify: 5_000,
  authenticated_ui_marker_observe: 10_000,
  browser_context_close: 10_000,
  browser_profile_remove: 5_000,
});

export const R206_BROWSER_SESSION_OPERATIONS = Object.freeze([
  "browser_context_create",
  "browser_page_create",
  "browser_navigate",
  "application_ready",
  "supabase_client_ready",
  "auth_ui_ready",
  "auth_submit",
  "auth_response_wait",
  "auth_redirect_observe",
  "auth_session_confirm",
  "auth_persistence_confirm",
  "application_auth_bootstrap_wait",
  "application_auth_reload",
  "application_auth_bootstrap_verify",
  "authenticated_capability_verify",
  "authenticated_ui_marker_observe",
  "browser_session_complete",
]);

const OPERATION_FAILURE_CODES = Object.freeze({
  browser_context_create: "BROWSER_CONTEXT_CREATE_FAILED",
  browser_page_create: "BROWSER_PAGE_CREATE_FAILED",
  browser_navigate: "BROWSER_NAVIGATION_FAILED",
  application_ready: "APPLICATION_NOT_READY",
  supabase_client_ready: "SUPABASE_CLIENT_NOT_READY",
  auth_ui_ready: "AUTH_UI_NOT_READY",
  auth_submit: "AUTH_SUBMISSION_FAILED",
  auth_response_wait: "AUTH_REQUEST_FAILED",
  auth_redirect_wait: "AUTH_REDIRECT_TIMEOUT",
  auth_redirect_observe: "AUTH_REDIRECT_OBSERVATION_FAILED",
  auth_session_confirm: "AUTH_SESSION_NOT_ESTABLISHED",
  auth_persistence_confirm: "AUTH_PERSISTENCE_NOT_ESTABLISHED",
  application_auth_bootstrap_wait: "APPLICATION_AUTH_BOOTSTRAP_FAILED",
  application_auth_reload: "APPLICATION_AUTH_RELOAD_FAILED",
  application_auth_bootstrap_verify: "APPLICATION_AUTH_BOOTSTRAP_FAILED",
  authenticated_capability_verify: "AUTHENTICATED_CAPABILITY_UNAVAILABLE",
  browser_context_close: "BROWSER_CONTEXT_CLEANUP_FAILED",
  browser_profile_remove: "BROWSER_PROFILE_CLEANUP_FAILED",
});

const OPERATION_TIMEOUT_CODES = Object.freeze({
  browser_navigate: "BROWSER_NAVIGATION_TIMEOUT",
  application_ready: "APPLICATION_NOT_READY",
  supabase_client_ready: "SUPABASE_CLIENT_NOT_READY",
  auth_ui_ready: "AUTH_UI_NOT_READY",
  auth_response_wait: "AUTH_REQUEST_TIMEOUT",
  auth_redirect_wait: "AUTH_REDIRECT_TIMEOUT",
  auth_session_confirm: "AUTH_SESSION_NOT_ESTABLISHED",
  auth_persistence_confirm: "AUTH_PERSISTENCE_NOT_ESTABLISHED",
  application_auth_bootstrap_wait: "APPLICATION_AUTH_BOOTSTRAP_TIMEOUT",
  application_auth_bootstrap_verify: "APPLICATION_AUTH_BOOTSTRAP_TIMEOUT",
  application_auth_reload: "APPLICATION_AUTH_RELOAD_FAILED",
  authenticated_capability_verify: "AUTHENTICATED_CAPABILITY_UNAVAILABLE",
});

function safeInteger(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function clockMilliseconds(now) {
  const value = now();
  if (value instanceof Date) return value.getTime();
  return Number(value);
}

function operationTimeout(timeoutMilliseconds) {
  const error = new Error(`browser operation exceeded its ${timeoutMilliseconds}ms limit`);
  error.name = "TimeoutError";
  error.code = "R206_OPERATION_TIMEOUT";
  return error;
}

function isTimeout(error) {
  return error?.name === "TimeoutError"
    || error?.code === "R206_OPERATION_TIMEOUT"
    || /timeout/i.test(String(error?.name || ""));
}

async function withTimeout(action, timeoutMilliseconds) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(operationTimeout(timeoutMilliseconds)), timeoutMilliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function sessionExecutionContext(state, operation, timeoutMilliseconds, elapsedMilliseconds) {
  return {
    currentOperation: operation,
    operation,
    lastCompletedOperation: state.lastCompletedOperation,
    elapsedMilliseconds: safeInteger(elapsedMilliseconds),
    timeoutMilliseconds: safeInteger(timeoutMilliseconds),
    operationTimings: [
      ...state.timings,
      {
        operation,
        elapsedMilliseconds: safeInteger(elapsedMilliseconds),
        timeoutMilliseconds: safeInteger(timeoutMilliseconds),
      },
    ],
    browserContextExisted: state.browserContextExisted,
    pageLifecycleState: state.pageLifecycleState,
    authRequestStarted: state.authRequestStarted,
    authResponseAccepted: state.authResponseAccepted,
    authSessionConfirmed: state.authSessionConfirmed,
    authSessionIdentityConfirmed: state.authSessionIdentityConfirmed,
    authPersistenceConfirmed: state.authPersistenceConfirmed,
    cookieStatePresent: state.cookieStatePresent,
    localStorageStatePresent: state.localStorageStatePresent,
    applicationAuthBootstrapConfirmed: state.applicationAuthBootstrapConfirmed,
    authenticatedCapabilityConfirmed: state.authenticatedCapabilityConfirmed,
    authenticatedUiMarkerObserved: state.authenticatedUiMarkerObserved,
    authenticatedUiMarkerElapsedMilliseconds: state.authenticatedUiMarkerElapsedMilliseconds,
    authenticatedUiMarkerType: "sign_out_action",
    uiMarkerAbsenceAffectedExecution: false,
    applicationAuthReloadAttempted: state.applicationAuthReloadAttempted,
  };
}

function classifiedSessionError(cause, state, operation, timeoutMilliseconds, elapsedMilliseconds) {
  if (cause instanceof R206StopError) {
    cause.executionContext = {
      ...(cause.executionContext || {}),
      ...sessionExecutionContext(
        state,
        operation,
        timeoutMilliseconds,
        elapsedMilliseconds,
      ),
    };
    return cause;
  }
  const timeout = isTimeout(cause);
  const code = timeout
    ? OPERATION_TIMEOUT_CODES[operation] || OPERATION_FAILURE_CODES[operation]
    : OPERATION_FAILURE_CODES[operation];
  const error = new R206StopError("isolated browser session stopped at a classified operation", {
    code: code || "BROWSER_SESSION_FAILURE",
    cause,
  });
  error.executionContext = sessionExecutionContext(
    state,
    operation,
    timeoutMilliseconds,
    elapsedMilliseconds,
  );
  return error;
}

function createOperationTracker({ now, timeouts }) {
  const state = {
    operation: "not_started",
    lastCompletedOperation: "none",
    browserContextExisted: false,
    pageLifecycleState: "not_created",
    authRequestStarted: false,
    authResponseAccepted: false,
    authSessionConfirmed: false,
    authSessionIdentityConfirmed: false,
    authPersistenceConfirmed: false,
    cookieStatePresent: false,
    localStorageStatePresent: false,
    applicationAuthBootstrapConfirmed: false,
    authenticatedCapabilityConfirmed: false,
    authenticatedUiMarkerObserved: false,
    authenticatedUiMarkerElapsedMilliseconds: null,
    applicationAuthReloadAttempted: false,
    timings: [],
  };

  const run = async (operation, action) => {
    const timeoutMilliseconds = timeouts[operation] ?? 5_000;
    const startedAt = clockMilliseconds(now);
    state.operation = operation;
    try {
      const value = await withTimeout(action, timeoutMilliseconds);
      const elapsedMilliseconds = safeInteger(clockMilliseconds(now) - startedAt);
      state.timings.push({ operation, elapsedMilliseconds, timeoutMilliseconds });
      state.lastCompletedOperation = operation;
      return value;
    } catch (cause) {
      const elapsedMilliseconds = safeInteger(clockMilliseconds(now) - startedAt);
      throw classifiedSessionError(
        cause,
        state,
        operation,
        timeoutMilliseconds,
        elapsedMilliseconds,
      );
    }
  };
  return { state, run };
}

function isAuthTokenRequest(value, authOrigin) {
  try {
    const candidate = new URL(typeof value === "string" ? value : value.url());
    return candidate.origin === authOrigin
      && candidate.pathname.endsWith("/auth/v1/token")
      && candidate.searchParams.get("grant_type") === "password";
  } catch {
    return false;
  }
}

function responseOk(response) {
  return typeof response.ok === "function" ? response.ok() : response.ok === true;
}

async function readStoredBrowserSession(page, expectedPrincipalId, nowEpochSeconds) {
  return page.evaluate(({ expectedPrincipalId: expectedId, nowEpochSeconds: currentEpoch }) => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        const container = Array.isArray(parsed) ? parsed[0] : parsed;
        const candidate = container?.currentSession ?? container?.session ?? container;
        if (candidate?.access_token && candidate?.refresh_token) {
          const expiresAt = Number(candidate.expires_at);
          return {
            present: true,
            notExpired: Number.isFinite(expiresAt) && expiresAt > currentEpoch,
            identityMatch: String(candidate.user?.id || "") === expectedId,
            accessToken: candidate.access_token,
            refreshToken: candidate.refresh_token,
          };
        }
      } catch {
        // Unrelated local values are ignored; only the expected auth shape passes.
      }
    }
    return { present: false };
  }, { expectedPrincipalId, nowEpochSeconds });
}

async function readSupabaseSessionAvailability(page, expectedPrincipalId, nowEpochSeconds) {
  return page.evaluate(async ({ expectedPrincipalId: expectedId, nowEpochSeconds: currentEpoch }) => {
    try {
      if (!window.supabase?.createClient || typeof SUPABASE_CONFIG === "undefined") {
        return { available: false, clientReady: false, lookupError: false };
      }
      const client = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.publishableKey,
      );
      const { data, error } = await client.auth.getSession();
      const session = data?.session;
      const expiresAt = Number(session?.expires_at);
      return {
        available: Boolean(session?.access_token && session?.refresh_token),
        notExpired: Number.isFinite(expiresAt) && expiresAt > currentEpoch,
        identityMatch: String(session?.user?.id || "") === expectedId,
        clientReady: true,
        lookupError: Boolean(error),
      };
    } catch {
      return { available: false, clientReady: false, lookupError: true };
    }
  }, { expectedPrincipalId, nowEpochSeconds });
}

async function readApplicationAuthBootstrap(page, expectedPrincipalId) {
  return page.evaluate((expectedId) => {
    try {
      const requiredKeys = [
        `laxhornet.playerSettings.user.${expectedId}`,
        `laxhornet.syncOperations.v1.user.${expectedId}`,
      ];
      return {
        recognized: requiredKeys.every((key) => localStorage.getItem(key) !== null),
      };
    } catch {
      return { recognized: false };
    }
  }, expectedPrincipalId);
}

async function readAuthenticatedCapability(page, expectedPrincipalId) {
  return page.evaluate((expectedId) => {
    try {
      const raw = localStorage.getItem(`laxhornet.games.user.${expectedId}`);
      return { available: Array.isArray(JSON.parse(raw)) };
    } catch {
      return { available: false };
    }
  }, expectedPrincipalId);
}

async function boundedCheck(check, { timeoutMilliseconds, intervalMilliseconds = 100 }) {
  const attempts = Math.max(1, Math.ceil(timeoutMilliseconds / intervalMilliseconds));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await check();
    if (result?.ready) return result.value;
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMilliseconds));
    }
  }
  throw operationTimeout(timeoutMilliseconds);
}

function installLifecycleTracking(page, state) {
  state.pageLifecycleState = "created";
  page.on?.("domcontentloaded", () => {
    state.pageLifecycleState = "domcontentloaded";
  });
  page.on?.("load", () => {
    state.pageLifecycleState = "load";
  });
  page.on?.("close", () => {
    state.pageLifecycleState = "closed";
  });
  page.on?.("crash", () => {
    state.pageLifecycleState = "crashed";
  });
}

export async function closeR206BrowserSession(entry, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const now = options.now || Date.now;
  const timeouts = { ...R206_BROWSER_SESSION_TIMEOUTS, ...(options.timeouts || {}) };
  const tracker = options.tracker || createOperationTracker({ now, timeouts });
  const { state, run } = tracker;
  if (entry?.context && !entry.contextClosed) {
    await run("browser_context_close", async () => {
      await entry.context.close();
      entry.contextClosed = true;
      state.pageLifecycleState = "closed";
    });
  }
  if (entry?.profilePath && !entry.profileRemoved) {
    await run("browser_profile_remove", async () => {
      fsImpl.rmSync(entry.profilePath, { recursive: true, force: true });
      if (fsImpl.existsSync(entry.profilePath)) {
        throw new Error("temporary browser profile still exists");
      }
      entry.profileRemoved = true;
    });
  }
  return {
    contextClosed: entry?.contextClosed === true,
    profileRemoved: entry?.profileRemoved === true,
    timings: [...state.timings],
  };
}

export async function establishR206BrowserSession({
  chromium,
  applicationOrigin,
  authOrigin,
  identity,
  expectedPrincipalId,
  expectedRedirect = false,
  fsImpl = fs,
  osImpl = os,
  pathImpl = path,
  now = Date.now,
  timeouts: timeoutOverrides = {},
  onContextCreated,
  onPageCreated,
  faultInjector,
} = {}) {
  const timeouts = { ...R206_BROWSER_SESSION_TIMEOUTS, ...timeoutOverrides };
  const tracker = createOperationTracker({ now, timeouts });
  const { state, run } = tracker;
  let entry = null;
  let responseListener;
  let requestListener;
  let responsePromise;
  let originalFailure = null;

  const inject = async (operation, position) => {
    state.operation = operation;
    await faultInjector?.({ operation, position, state });
  };

  try {
    await inject("browser_context_create", "before");
    await run("browser_context_create", async () => {
      const profilePath = fsImpl.mkdtempSync(
        pathImpl.join(osImpl.tmpdir(), "laxhornet-r206-browser-"),
      );
      entry = {
        context: null,
        page: null,
        profilePath,
        contextClosed: false,
        profileRemoved: false,
      };
      entry.context = await chromium.launchPersistentContext(profilePath, {
        headless: true,
        serviceWorkers: "block",
        timeout: timeouts.browser_context_create,
      });
      state.browserContextExisted = true;
      await onContextCreated?.(entry);
    });
    await inject("browser_context_create", "after");

    await inject("browser_page_create", "before");
    await run("browser_page_create", async () => {
      entry.page = entry.context.pages()[0] || await entry.context.newPage();
      installLifecycleTracking(entry.page, state);
      await onPageCreated?.(entry.page, entry);
    });
    await inject("browser_page_create", "after");

    const page = entry.page;
    const initialUrl = `${applicationOrigin}/app.html`;
    await inject("browser_navigate", "before");
    await run("browser_navigate", async () => {
      state.pageLifecycleState = "navigating";
      await page.goto(initialUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeouts.browser_navigate,
      });
      if (state.pageLifecycleState === "navigating") {
        state.pageLifecycleState = "domcontentloaded";
      }
    });
    await inject("browser_navigate", "after");

    await run("application_ready", async () => {
      await page.waitForFunction(
        () => document.readyState !== "loading" && Boolean(document.body),
        null,
        { timeout: timeouts.application_ready },
      );
    });

    await run("supabase_client_ready", async () => {
      await page.waitForFunction(
        () => Boolean(
          window.supabase?.createClient
          && typeof SUPABASE_CONFIG !== "undefined"
          && SUPABASE_CONFIG.url
          && SUPABASE_CONFIG.publishableKey,
        ),
        null,
        { timeout: timeouts.supabase_client_ready },
      );
    });

    await inject("auth_ui_ready", "before");
    await run("auth_ui_ready", async () => {
      await page.locator('form[data-form="auth"]').waitFor({
        state: "visible",
        timeout: timeouts.auth_ui_ready,
      });
      await page.locator("#authEmail").waitFor({ state: "visible", timeout: timeouts.auth_ui_ready });
      await page.locator("#authPassword").waitFor({ state: "visible", timeout: timeouts.auth_ui_ready });
      await page.locator('button[value="sign-in"]').waitFor({
        state: "visible",
        timeout: timeouts.auth_ui_ready,
      });
    });
    await inject("auth_ui_ready", "after");

    responsePromise = new Promise((resolve) => {
      responseListener = (response) => {
        if (isAuthTokenRequest(response, authOrigin)) resolve(response);
      };
      requestListener = (request) => {
        if (isAuthTokenRequest(request, authOrigin)) state.authRequestStarted = true;
      };
      page.on?.("response", responseListener);
      page.on?.("request", requestListener);
    });

    await inject("auth_submit", "before");
    await run("auth_submit", async () => {
      await page.locator("#authEmail").fill(identity.email, { timeout: timeouts.auth_submit });
      await page.locator("#authPassword").fill(identity.password, { timeout: timeouts.auth_submit });
      await page.locator('button[value="sign-in"]').click({ timeout: timeouts.auth_submit });
    });
    await inject("auth_submit", "after");

    await inject("auth_response_wait", "before");
    await run("auth_response_wait", async () => {
      const response = await responsePromise;
      if (!responseOk(response)) {
        throw new R206StopError("synthetic authentication request was rejected", {
          code: "AUTH_REQUEST_REJECTED",
        });
      }
      state.authResponseAccepted = true;
    });
    await inject("auth_response_wait", "after");

    if (expectedRedirect) {
      await run("auth_redirect_wait", async () => {
        await page.waitForURL(
          (candidate) => candidate.toString() !== initialUrl,
          { timeout: timeouts.auth_redirect_wait },
        );
      });
    } else {
      await run("auth_redirect_observe", async () => ({ redirected: page.url() !== initialUrl }));
    }

    await inject("auth_session_confirm", "before");
    await run("auth_session_confirm", async () => {
      try {
        await boundedCheck(async () => {
          const lookup = await readSupabaseSessionAvailability(
            page,
            expectedPrincipalId,
            Math.floor(clockMilliseconds(now) / 1000),
          );
          if (lookup.lookupError) {
            throw new R206StopError("Supabase browser session lookup failed", {
              code: "AUTH_SESSION_NOT_ESTABLISHED",
            });
          }
          if (lookup.available && !lookup.identityMatch) {
            throw new R206StopError("Supabase browser session identity did not match", {
              code: "AUTH_SESSION_IDENTITY_MISMATCH",
            });
          }
          return {
            ready: lookup.available === true && lookup.notExpired === true,
            value: lookup,
          };
        }, {
          timeoutMilliseconds: timeouts.auth_session_confirm,
          intervalMilliseconds: Math.min(
            100,
            Math.max(1, Math.floor(timeouts.auth_session_confirm / 5)),
          ),
        });
      } catch (cause) {
        if (!isTimeout(cause)) throw cause;
        throw new R206StopError("Supabase browser session did not appear within the bounded check", {
          code: "AUTH_SESSION_NOT_ESTABLISHED",
          cause,
        });
      }
      state.authSessionConfirmed = true;
      state.authSessionIdentityConfirmed = true;
    });
    await inject("auth_session_confirm", "after");

    await inject("auth_persistence_confirm", "before");
    const storedSession = await run("auth_persistence_confirm", async () => {
      const value = await boundedCheck(async () => {
        const session = await readStoredBrowserSession(
          page,
          expectedPrincipalId,
          Math.floor(clockMilliseconds(now) / 1000),
        );
        if (session.present && !session.identityMatch) {
          throw new R206StopError("persisted browser session identity did not match", {
            code: "AUTH_SESSION_IDENTITY_MISMATCH",
          });
        }
        return {
          ready: session.present === true && session.notExpired === true,
          value: session,
        };
      }, {
        timeoutMilliseconds: timeouts.auth_persistence_confirm,
        intervalMilliseconds: Math.min(
          100,
          Math.max(1, Math.floor(timeouts.auth_persistence_confirm / 5)),
        ),
      });
      state.localStorageStatePresent = true;
      state.authPersistenceConfirmed = true;
      const cookies = await entry.context.cookies();
      state.cookieStatePresent = Array.isArray(cookies) && cookies.length > 0;
      return value;
    });
    await inject("auth_persistence_confirm", "after");

    await inject("application_auth_bootstrap_wait", "before");
    const bootstrapInitiallyRecognized = await run("application_auth_bootstrap_wait", async () => {
      const boundedBootstrapTimeout = Math.max(
        1,
        Math.floor(timeouts.application_auth_bootstrap_wait * 0.5),
      );
      try {
        await boundedCheck(async () => {
          const bootstrap = await readApplicationAuthBootstrap(page, expectedPrincipalId);
          return { ready: bootstrap.recognized === true, value: bootstrap };
        }, {
          timeoutMilliseconds: boundedBootstrapTimeout,
          intervalMilliseconds: Math.min(
            100,
            Math.max(1, Math.floor(boundedBootstrapTimeout / 5)),
          ),
        });
        return true;
      } catch (cause) {
        if (isTimeout(cause)) return false;
        throw new R206StopError("application authentication bootstrap check failed", {
          code: "APPLICATION_AUTH_BOOTSTRAP_FAILED",
          cause,
        });
      }
    });
    await inject("application_auth_bootstrap_wait", "after");

    if (!bootstrapInitiallyRecognized) {
      state.applicationAuthReloadAttempted = true;
      await inject("application_auth_reload", "before");
      await run("application_auth_reload", async () => {
        state.pageLifecycleState = "navigating";
        await page.reload({
          waitUntil: "domcontentloaded",
          timeout: timeouts.application_auth_reload,
        });
        if (state.pageLifecycleState === "navigating") {
          state.pageLifecycleState = "domcontentloaded";
        }
      });
      await inject("application_auth_reload", "after");
    }

    await inject("application_auth_bootstrap_verify", "before");
    await run("application_auth_bootstrap_verify", async () => {
      const boundedBootstrapTimeout = Math.max(
        1,
        Math.floor(timeouts.application_auth_bootstrap_verify * 0.5),
      );
      try {
        await boundedCheck(async () => {
          const bootstrap = await readApplicationAuthBootstrap(page, expectedPrincipalId);
          return { ready: bootstrap.recognized === true, value: bootstrap };
        }, {
          timeoutMilliseconds: boundedBootstrapTimeout,
          intervalMilliseconds: Math.min(
            100,
            Math.max(1, Math.floor(boundedBootstrapTimeout / 5)),
          ),
        });
      } catch (cause) {
        if (!isTimeout(cause)) {
          throw new R206StopError("application authentication bootstrap verification failed", {
            code: "APPLICATION_AUTH_BOOTSTRAP_FAILED",
            cause,
          });
        }
        throw new R206StopError("application authentication bootstrap did not complete", {
          code: "APPLICATION_AUTH_BOOTSTRAP_TIMEOUT",
          cause,
        });
      }
      state.applicationAuthBootstrapConfirmed = true;
    });
    await inject("application_auth_bootstrap_verify", "after");

    await inject("authenticated_capability_verify", "before");
    await run("authenticated_capability_verify", async () => {
      const capability = await readAuthenticatedCapability(page, expectedPrincipalId);
      if (!capability.available) {
        throw new R206StopError("authenticated account-scoped capability is unavailable", {
          code: "AUTHENTICATED_CAPABILITY_UNAVAILABLE",
        });
      }
      state.authenticatedCapabilityConfirmed = true;
    });
    await inject("authenticated_capability_verify", "after");

    await inject("authenticated_ui_marker_observe", "before");
    await run("authenticated_ui_marker_observe", async () => {
      const markerStartedAt = clockMilliseconds(now);
      const markerObservationTimeout = Math.max(
        1,
        Math.floor(timeouts.authenticated_ui_marker_observe * 0.5),
      );
      try {
        await page.locator('[data-action="sign-out"]').waitFor({
          state: "visible",
          timeout: markerObservationTimeout,
        });
        state.authenticatedUiMarkerObserved = true;
        state.authenticatedUiMarkerElapsedMilliseconds = safeInteger(
          clockMilliseconds(now) - markerStartedAt,
        );
      } catch {
        state.authenticatedUiMarkerObserved = false;
        state.authenticatedUiMarkerElapsedMilliseconds = null;
      }
    });
    await inject("authenticated_ui_marker_observe", "after");

    state.operation = "browser_session_complete";
    state.lastCompletedOperation = "browser_session_complete";
    return {
      entry,
      session: {
        accessToken: storedSession.accessToken,
        refreshToken: storedSession.refreshToken,
      },
      diagnostics: {
        operation: "browser_session_complete",
        lastCompletedOperation: "browser_session_complete",
        timings: [...state.timings],
        browserContextExisted: true,
        pageLifecycleState: state.pageLifecycleState,
        authRequestStarted: state.authRequestStarted,
        authResponseAccepted: state.authResponseAccepted,
        authSessionConfirmed: state.authSessionConfirmed,
        authSessionIdentityConfirmed: state.authSessionIdentityConfirmed,
        authPersistenceConfirmed: state.authPersistenceConfirmed,
        cookieStatePresent: state.cookieStatePresent,
        localStorageStatePresent: state.localStorageStatePresent,
        applicationAuthBootstrapConfirmed: state.applicationAuthBootstrapConfirmed,
        authenticatedCapabilityConfirmed: state.authenticatedCapabilityConfirmed,
        authenticatedUiMarkerObserved: state.authenticatedUiMarkerObserved,
        authenticatedUiMarkerElapsedMilliseconds: state.authenticatedUiMarkerElapsedMilliseconds,
        authenticatedUiMarkerType: "sign_out_action",
        uiMarkerAbsenceAffectedExecution: false,
        applicationAuthReloadAttempted: state.applicationAuthReloadAttempted,
      },
    };
  } catch (error) {
    originalFailure = error instanceof R206StopError
      ? error
      : classifiedSessionError(
        error,
        state,
        state.operation,
        timeouts[state.operation] || 5_000,
        0,
      );
    if (entry) {
      try {
        const cleanup = await closeR206BrowserSession(entry, { fsImpl, now, timeouts, tracker });
        originalFailure.executionContext = {
          ...(originalFailure.executionContext || {}),
          browserCleanupEntered: true,
          browserContextClosed: cleanup.contextClosed,
          browserProfileRemoved: cleanup.profileRemoved,
        };
      } catch (cleanupError) {
        cleanupError.executionContext = {
          ...(cleanupError.executionContext || {}),
          priorBrowserOperation: originalFailure.executionContext?.operation || state.operation,
        };
        throw cleanupError;
      }
    }
    throw originalFailure;
  } finally {
    if (entry?.page) {
      if (responseListener) entry.page.off?.("response", responseListener);
      if (requestListener) entry.page.off?.("request", requestListener);
    }
  }
}

function diagnosticHtml(scenario) {
  return `<!doctype html>
<html><body><main id="app">
<form data-form="auth">
<input id="authEmail" name="email" type="email">
<input id="authPassword" name="password" type="password">
<button type="submit" value="sign-in">Log In</button>
</form></main>
<script>
const DIAGNOSTIC_SCENARIO = ${JSON.stringify(scenario)};
const SUPABASE_CONFIG = { url: location.origin, publishableKey: "diagnostic-publishable" };
window.supabase = {
  createClient() {
    return { auth: { async getSession() {
      if (DIAGNOSTIC_SCENARIO === "missing_session") {
        return { data: { session: null }, error: null };
      }
      const raw = localStorage.getItem("sb-local-auth-token");
      return { data: { session: raw ? JSON.parse(raw) : null }, error: null };
    } } };
  }
};
function initializeAuthenticatedApplication(session) {
  if (["bootstrap_timeout", "cleanup_after_partial_session"].includes(DIAGNOSTIC_SCENARIO)) return;
  const accountId = session.user.id;
  localStorage.setItem("laxhornet.playerSettings.user." + accountId, JSON.stringify({}));
  localStorage.setItem(
    "laxhornet.syncOperations.v1.user." + accountId,
    JSON.stringify({ schemaVersion: 1, operations: [], tombstones: [] }),
  );
  if (DIAGNOSTIC_SCENARIO !== "protected_capability_failure") {
    localStorage.setItem("laxhornet.games.user." + accountId, JSON.stringify([]));
  }
}
function renderOptionalMarker() {
  if (DIAGNOSTIC_SCENARIO === "absent_optional_ui") return;
  const render = () => {
    const form = document.querySelector("form");
    if (form) form.outerHTML = '<button data-action="sign-out">Sign Out</button>';
  };
  if (DIAGNOSTIC_SCENARIO === "delayed_optional_ui") setTimeout(render, 50);
  else render();
}
const persisted = localStorage.getItem("sb-local-auth-token");
if (persisted && DIAGNOSTIC_SCENARIO === "one_reload_bootstrap_recovery") {
  const session = JSON.parse(persisted);
  initializeAuthenticatedApplication(session);
  renderOptionalMarker();
}
document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch(
    "/auth/v1/token?grant_type=password&scenario=" + encodeURIComponent(DIAGNOSTIC_SCENARIO),
    { method: "POST" },
  );
  if (!response.ok) return;
  const session = await response.json();
  localStorage.setItem("sb-local-auth-token", JSON.stringify(session));
  if (DIAGNOSTIC_SCENARIO !== "one_reload_bootstrap_recovery") {
    initializeAuthenticatedApplication(session);
    renderOptionalMarker();
  }
});
</script></body></html>`;
}

async function listenLoopback(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

export async function diagnoseR206BrowserSession({ chromium, timeouts } = {}) {
  const expectedPrincipalId = "00000000-0000-4000-8000-000000000001";
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const applicationMatch = requestUrl.pathname.match(/^\/([a-z_]+)\/app\.html$/);
    if (applicationMatch) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(diagnosticHtml(applicationMatch[1]));
      return;
    }
    if (
      requestUrl.pathname === "/auth/v1/token"
      && requestUrl.searchParams.get("grant_type") === "password"
      && request.method === "POST"
    ) {
      const responsePrincipalId = requestUrl.searchParams.get("scenario") === "wrong_session_identity"
        ? "00000000-0000-4000-8000-000000000002"
        : expectedPrincipalId;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        access_token: ["diagnostic", "access"].join("-"),
        refresh_token: ["diagnostic", "refresh"].join("-"),
        expires_at: Math.floor(Date.now() / 1000) + 3_600,
        user: { id: responsePrincipalId },
      }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const origin = await listenLoopback(server);
  const diagnosticTimeouts = {
    ...timeouts,
    application_auth_bootstrap_wait: timeouts?.application_auth_bootstrap_wait ?? 200,
    application_auth_bootstrap_verify: timeouts?.application_auth_bootstrap_verify ?? 200,
    authenticated_ui_marker_observe: timeouts?.authenticated_ui_marker_observe ?? 200,
  };
  const scenarios = [
    { name: "normal_success", expectedCode: null },
    { name: "delayed_optional_ui", expectedCode: null },
    { name: "absent_optional_ui", expectedCode: null },
    { name: "one_reload_bootstrap_recovery", expectedCode: null },
    { name: "bootstrap_timeout", expectedCode: "APPLICATION_AUTH_BOOTSTRAP_TIMEOUT" },
    { name: "protected_capability_failure", expectedCode: "AUTHENTICATED_CAPABILITY_UNAVAILABLE" },
    { name: "missing_session", expectedCode: "AUTH_SESSION_NOT_ESTABLISHED" },
    { name: "wrong_session_identity", expectedCode: "AUTH_SESSION_IDENTITY_MISMATCH" },
    { name: "cleanup_after_partial_session", expectedCode: "APPLICATION_AUTH_BOOTSTRAP_TIMEOUT" },
  ];
  const results = [];
  try {
    for (const scenario of scenarios) {
      let established;
      try {
        established = await establishR206BrowserSession({
          chromium,
          applicationOrigin: `${origin}/${scenario.name}`,
          authOrigin: origin,
          identity: {
            email: ["diagnostic", "example.invalid"].join("@"),
            password: ["diagnostic", "password"].join("-"),
          },
          expectedPrincipalId,
          timeouts: diagnosticTimeouts,
        });
        const cleanup = await closeR206BrowserSession(established.entry, {
          timeouts: diagnosticTimeouts,
        });
        if (scenario.expectedCode) {
          throw new Error("diagnostic scenario unexpectedly succeeded");
        }
        results.push({
          scenario: scenario.name,
          outcome: "passed",
          code: "BROWSER_SESSION_COMPLETE",
          sessionConfirmed: established.diagnostics.authSessionConfirmed,
          persistenceConfirmed: established.diagnostics.authPersistenceConfirmed,
          bootstrapConfirmed: established.diagnostics.applicationAuthBootstrapConfirmed,
          protectedCapabilityConfirmed:
            established.diagnostics.authenticatedCapabilityConfirmed,
          authenticatedUiMarkerObserved:
            established.diagnostics.authenticatedUiMarkerObserved,
          reloadAttempted: established.diagnostics.applicationAuthReloadAttempted,
          contextClosed: cleanup.contextClosed,
          profileRemoved: cleanup.profileRemoved,
        });
      } catch (error) {
        if (!scenario.expectedCode || error?.code !== scenario.expectedCode) throw error;
        results.push({
          scenario: scenario.name,
          outcome: "expected_failure",
          code: error.code,
          sessionConfirmed: error.executionContext?.authSessionConfirmed === true,
          persistenceConfirmed: error.executionContext?.authPersistenceConfirmed === true,
          bootstrapConfirmed:
            error.executionContext?.applicationAuthBootstrapConfirmed === true,
          protectedCapabilityConfirmed:
            error.executionContext?.authenticatedCapabilityConfirmed === true,
          authenticatedUiMarkerObserved:
            error.executionContext?.authenticatedUiMarkerObserved === true,
          reloadAttempted:
            error.executionContext?.applicationAuthReloadAttempted === true,
          contextClosed: error.executionContext?.browserContextClosed === true,
          profileRemoved: error.executionContext?.browserProfileRemoved === true,
        });
      } finally {
        if (established?.entry && !established.entry.profileRemoved) {
          await closeR206BrowserSession(established.entry, {
            timeouts: diagnosticTimeouts,
          }).catch(() => {});
        }
      }
    }
    return {
      ok: true,
      code: "BROWSER_SESSION_DIAGNOSTIC_READY",
      scenarios: results,
      scenarioCount: results.length,
      allScenariosPassed: results.length === scenarios.length,
      productionCredentialsRequired: false,
      productionEndpointContacted: false,
      networkMutationCount: 0,
      releaseCloseoutApproved: false,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
