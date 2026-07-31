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
  auth_storage_verify: 10_000,
  auth_session_verify: 10_000,
  authenticated_app_verify: 10_000,
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
  "auth_storage_verify",
  "auth_session_verify",
  "authenticated_app_verify",
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
  auth_storage_verify: "AUTH_STORAGE_NOT_ESTABLISHED",
  auth_session_verify: "AUTH_SESSION_NOT_ESTABLISHED",
  authenticated_app_verify: "AUTHENTICATED_APP_STATE_NOT_ESTABLISHED",
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
  auth_storage_verify: "AUTH_STORAGE_NOT_ESTABLISHED",
  auth_session_verify: "AUTH_SESSION_VERIFICATION_TIMEOUT",
  authenticated_app_verify: "AUTHENTICATED_APP_STATE_NOT_ESTABLISHED",
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
    authSessionConfirmed: state.authSessionConfirmed,
    cookieStatePresent: state.cookieStatePresent,
    localStorageStatePresent: state.localStorageStatePresent,
    authenticatedApplicationState: state.authenticatedApplicationState,
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
    authSessionConfirmed: false,
    cookieStatePresent: false,
    localStorageStatePresent: false,
    authenticatedApplicationState: false,
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

async function readStoredBrowserSession(page) {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        const container = Array.isArray(parsed) ? parsed[0] : parsed;
        const candidate = container?.currentSession ?? container?.session ?? container;
        if (candidate?.access_token && candidate?.refresh_token) {
          return {
            present: true,
            accessToken: candidate.access_token,
            refreshToken: candidate.refresh_token,
          };
        }
      } catch {
        // Unrelated local values are ignored; only the expected auth shape passes.
      }
    }
    return { present: false };
  });
}

async function readSupabaseSessionAvailability(page) {
  return page.evaluate(async () => {
    try {
      if (!window.supabase?.createClient || typeof SUPABASE_CONFIG === "undefined") {
        return { available: false, clientReady: false, lookupError: false };
      }
      const client = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.publishableKey,
      );
      const { data, error } = await client.auth.getSession();
      return {
        available: Boolean(data?.session?.access_token && data?.session?.refresh_token),
        clientReady: true,
        lookupError: Boolean(error),
      };
    } catch {
      return { available: false, clientReady: false, lookupError: true };
    }
  });
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

    await inject("auth_storage_verify", "before");
    const storedSession = await run("auth_storage_verify", async () => {
      const value = await boundedCheck(async () => {
        const session = await readStoredBrowserSession(page);
        return { ready: session.present === true, value: session };
      }, {
        timeoutMilliseconds: timeouts.auth_storage_verify,
        intervalMilliseconds: Math.min(
          100,
          Math.max(1, Math.floor(timeouts.auth_storage_verify / 5)),
        ),
      });
      state.localStorageStatePresent = true;
      const cookies = await entry.context.cookies();
      state.cookieStatePresent = Array.isArray(cookies) && cookies.length > 0;
      return value;
    });
    await inject("auth_storage_verify", "after");

    await inject("auth_session_verify", "before");
    await run("auth_session_verify", async () => {
      const boundedSessionTimeout = Math.max(
        1,
        Math.floor(timeouts.auth_session_verify * 0.5),
      );
      try {
        await boundedCheck(async () => {
          const lookup = await readSupabaseSessionAvailability(page);
          if (lookup.lookupError) {
            throw new R206StopError("Supabase browser session lookup failed", {
              code: "AUTH_SESSION_NOT_ESTABLISHED",
            });
          }
          return { ready: lookup.available === true, value: lookup };
        }, {
          timeoutMilliseconds: boundedSessionTimeout,
          intervalMilliseconds: Math.min(
            100,
            Math.max(1, Math.floor(boundedSessionTimeout / 5)),
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
    });
    await inject("auth_session_verify", "after");

    await inject("authenticated_app_verify", "before");
    await run("authenticated_app_verify", async () => {
      await page.locator('[data-action="sign-out"]').waitFor({
        state: "visible",
        timeout: timeouts.authenticated_app_verify,
      });
      state.authenticatedApplicationState = true;
    });
    await inject("authenticated_app_verify", "after");

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
        authSessionConfirmed: state.authSessionConfirmed,
        cookieStatePresent: state.cookieStatePresent,
        localStorageStatePresent: state.localStorageStatePresent,
        authenticatedApplicationState: state.authenticatedApplicationState,
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

function diagnosticHtml() {
  return `<!doctype html>
<html><body><main id="app">
<form data-form="auth">
<input id="authEmail" name="email" type="email">
<input id="authPassword" name="password" type="password">
<button type="submit" value="sign-in">Log In</button>
</form></main>
<script>
const SUPABASE_CONFIG = { url: location.origin, publishableKey: "diagnostic-publishable" };
window.supabase = {
  createClient() {
    return { auth: { async getSession() {
      const raw = localStorage.getItem("sb-local-auth-token");
      return { data: { session: raw ? JSON.parse(raw) : null }, error: null };
    } } };
  }
};
document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("/auth/v1/token?grant_type=password", { method: "POST" });
  if (!response.ok) return;
  const session = await response.json();
  localStorage.setItem("sb-local-auth-token", JSON.stringify(session));
  document.querySelector("form").outerHTML = '<button data-action="sign-out">Sign Out</button>';
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
  const session = {
    access_token: ["diagnostic", "access"].join("-"),
    refresh_token: ["diagnostic", "refresh"].join("-"),
  };
  const server = http.createServer((request, response) => {
    if (request.url === "/app.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(diagnosticHtml());
      return;
    }
    if (request.url === "/auth/v1/token?grant_type=password" && request.method === "POST") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(session));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const origin = await listenLoopback(server);
  let established;
  try {
    established = await establishR206BrowserSession({
      chromium,
      applicationOrigin: origin,
      authOrigin: origin,
      identity: {
        email: ["diagnostic", "example.invalid"].join("@"),
        password: ["diagnostic", "password"].join("-"),
      },
      timeouts,
    });
    const cleanup = await closeR206BrowserSession(established.entry, { timeouts });
    return {
      ok: true,
      code: "BROWSER_SESSION_DIAGNOSTIC_READY",
      operations: established.diagnostics.timings,
      browserContextExisted: established.diagnostics.browserContextExisted,
      authRequestStarted: established.diagnostics.authRequestStarted,
      authSessionConfirmed: established.diagnostics.authSessionConfirmed,
      localStorageStatePresent: established.diagnostics.localStorageStatePresent,
      cookieStatePresent: established.diagnostics.cookieStatePresent,
      authenticatedApplicationState: established.diagnostics.authenticatedApplicationState,
      browserContextClosed: cleanup.contextClosed,
      browserProfileRemoved: cleanup.profileRemoved,
      productionCredentialsRequired: false,
      productionEndpointContacted: false,
      networkMutationCount: 0,
      releaseCloseoutApproved: false,
    };
  } finally {
    if (established?.entry && !established.entry.profileRemoved) {
      await closeR206BrowserSession(established.entry).catch(() => {});
    }
    await new Promise((resolve) => server.close(resolve));
  }
}
