import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ACTION_PLAN,
  HARD_LIMITS,
  R206_API_URL,
  R206_APPLICATION_ORIGIN,
  R206_CACHE_NAME,
  R206_MIGRATION_VERSIONS,
  R206_PAGES_RUN_ID,
  R206_PRIVATE_EVIDENCE_DIR,
  R206_PRIVATE_LEDGER_NAME,
  R206_PROJECT_REF,
  R206_PUBLIC_EVIDENCE_DIR,
  R206_RELEASE_MARKER,
  R206_RUNTIME_SHA,
  R206StopError,
  assertAllowedRpc,
  assertPublicEvidenceSafe,
  assertSafePrivateEvidencePath,
  assertSyntheticEmail,
  isPathInside,
  sha256,
} from "./r206_synthetic_runner_core.mjs";

const AUTHORIZATION_SCHEMA_VERSION = 1;
const PREFLIGHT_SCHEMA_VERSION = 1;
const PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const R206_AUTHORIZATION_CONSUMPTION_NAME =
  "R2-06_AUTHORIZATION_CONSUMPTION.json";

function readJson(file, label) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new R206StopError(`${label} is unavailable`, {
      code: `${label.toUpperCase().replaceAll(" ", "_")}_UNAVAILABLE`,
    });
  }
  try {
    return { value: JSON.parse(raw), raw };
  } catch {
    throw new R206StopError(`${label} is not valid JSON`, {
      code: `${label.toUpperCase().replaceAll(" ", "_")}_INVALID`,
    });
  }
}

function exactObjectMatches(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function validateTimestamp(value, { now, maxAgeMs, label }) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new R206StopError(`${label} timestamp is invalid`, {
      code: "AUTHORIZATION_OR_PREFLIGHT_TIMESTAMP_INVALID",
    });
  }
  if (timestamp > now.getTime() + FUTURE_CLOCK_SKEW_MS) {
    throw new R206StopError(`${label} timestamp is in the future`, {
      code: "AUTHORIZATION_OR_PREFLIGHT_TIMESTAMP_INVALID",
    });
  }
  if (maxAgeMs != null && now.getTime() - timestamp > maxAgeMs) {
    throw new R206StopError(`${label} is stale`, {
      code: "PREFLIGHT_ARTIFACT_STALE",
    });
  }
  return timestamp;
}

function validateAuthorizationArtifact(artifact, config, now) {
  const expectedPrivatePath = path.resolve(config.privateEvidenceDir);
  if (
    artifact?.schemaVersion !== AUTHORIZATION_SCHEMA_VERSION
    || artifact.authorizationId == null
    || artifact.approvedBy !== "David"
    || artifact.executionMode !== "production"
    || artifact.approvedRunnerSha !== config.targetRef
    || artifact.projectRef !== R206_PROJECT_REF
    || artifact.apiUrl !== R206_API_URL
    || artifact.applicationOrigin !== R206_APPLICATION_ORIGIN
    || artifact.runtimeSourceSha !== R206_RUNTIME_SHA
    || artifact.actionCount !== ACTION_PLAN.length
    || !exactObjectMatches(artifact.hardLimits, HARD_LIMITS)
    || path.resolve(artifact.privateEvidenceDir || "") !== expectedPrivatePath
    || artifact.browserExecutionAuthorized !== true
    || artifact.releaseCloseoutApproved !== false
  ) {
    throw new R206StopError("production authorization artifact does not match the reviewed runner scope", {
      code: "PRODUCTION_AUTHORIZATION_ARTIFACT_MISMATCH",
    });
  }
  validateTimestamp(artifact.authorizedAt, { now, label: "authorization" });
  const expiresAt = Date.parse(artifact.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    throw new R206StopError("production authorization artifact is expired", {
      code: "PRODUCTION_AUTHORIZATION_EXPIRED",
    });
  }
  return true;
}

function validatePreflightArtifact(artifact, config, now) {
  if (
    artifact?.schemaVersion !== PREFLIGHT_SCHEMA_VERSION
    || artifact.source !== "supabase_production_readonly-2"
    || artifact.approvedRunnerSha !== config.targetRef
    || artifact.projectRef !== R206_PROJECT_REF
    || artifact.apiUrl !== R206_API_URL
    || artifact.applicationOrigin !== R206_APPLICATION_ORIGIN
    || artifact.runtimeSourceSha !== R206_RUNTIME_SHA
    || artifact.pagesRunId !== R206_PAGES_RUN_ID
    || artifact.releaseMarker !== R206_RELEASE_MARKER
    || artifact.cacheName !== R206_CACHE_NAME
    || !exactObjectMatches(artifact.migrationVersions, R206_MIGRATION_VERSIONS)
  ) {
    throw new R206StopError("production preflight artifact does not match the reviewed target", {
      code: "PRODUCTION_PREFLIGHT_ARTIFACT_MISMATCH",
    });
  }
  validateTimestamp(artifact.capturedAt, {
    now,
    maxAgeMs: PREFLIGHT_MAX_AGE_MS,
    label: "preflight",
  });
  return true;
}

function git(repoRoot, ...args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function validateGitIdentity(repoRoot, targetRef) {
  if (!/^[0-9a-f]{40}$/.test(String(targetRef || ""))) {
    throw new R206StopError("production target ref must be a full Git SHA", {
      code: "TARGET_REF_INVALID",
    });
  }
  if (git(repoRoot, "rev-parse", "HEAD") !== targetRef) {
    throw new R206StopError("production target ref differs from runner HEAD", {
      code: "TARGET_REF_MISMATCH",
    });
  }
  if (git(repoRoot, "status", "--porcelain") !== "") {
    throw new R206StopError("production runner worktree must be clean", {
      code: "RUNNER_WORKTREE_DIRTY",
    });
  }
}

function validatePublicEvidenceDir(repoRoot, publicEvidenceDir) {
  const expected = path.resolve(repoRoot, R206_PUBLIC_EVIDENCE_DIR);
  const resolved = path.resolve(publicEvidenceDir || "");
  if (resolved !== expected || !isPathInside(repoRoot, resolved)) {
    throw new R206StopError("public evidence directory differs from the reviewed repository path", {
      code: "PUBLIC_EVIDENCE_DIR_UNREVIEWED",
    });
  }
  return resolved;
}

export function validateProductionConfiguration({
  repoRoot,
  options,
  env = process.env,
  now = new Date(),
  verifyGit = true,
}) {
  if (options.executionMode !== "production" || options.allowProduction !== true) {
    throw new R206StopError("production execution is disabled unless --allow-production is explicit", {
      code: "PRODUCTION_EXECUTION_DISABLED",
    });
  }
  if (options.projectRef !== R206_PROJECT_REF) {
    throw new R206StopError("production project reference mismatch", {
      code: "PROJECT_REF_MISMATCH",
    });
  }
  if (options.apiUrl && options.apiUrl !== R206_API_URL) {
    throw new R206StopError("production API URL mismatch", {
      code: "PROJECT_URL_MISMATCH",
    });
  }
  if (verifyGit) validateGitIdentity(repoRoot, options.targetRef);
  const privateEvidenceDir = assertSafePrivateEvidencePath({
    repoRoot,
    privateEvidenceDir: options.privateEvidenceDir,
    executionMode: "production",
    reviewedOverride: options.reviewedPrivatePathOverride === true,
  });
  const publicEvidenceDir = validatePublicEvidenceDir(repoRoot, options.publicEvidenceDir);
  fs.mkdirSync(privateEvidenceDir, { recursive: true });
  const realPrivateDir = fs.realpathSync(privateEvidenceDir);
  if (isPathInside(repoRoot, realPrivateDir)) {
    throw new R206StopError("private evidence directory resolves inside the repository", {
      code: "PRIVATE_EVIDENCE_DIR_INSIDE_REPOSITORY",
    });
  }
  const authorizationPath = path.resolve(options.authorizationArtifact || "");
  const preflightPath = path.resolve(options.preflightArtifact || "");
  const retainedLedgerPath = path.join(realPrivateDir, R206_PRIVATE_LEDGER_NAME);
  const authorizationConsumptionPath = path.join(
    realPrivateDir,
    R206_AUTHORIZATION_CONSUMPTION_NAME,
  );
  const publicResultPaths = [
    "SYNTHETIC_VERIFICATION_AUTHORIZATION.md",
    "SYNTHETIC_VERIFICATION_RESULT.md",
    "SYNTHETIC_CLEANUP_RESULT.md",
  ].map((name) => path.join(publicEvidenceDir, name));
  if (fs.existsSync(authorizationConsumptionPath)) {
    throw new R206StopError("production authorization has a separate consumption record and cannot be reused", {
      code: "PRODUCTION_AUTHORIZATION_ALREADY_CONSUMED",
    });
  }
  if (fs.existsSync(retainedLedgerPath) || publicResultPaths.some((file) => fs.existsSync(file))) {
    throw new R206StopError("reviewed evidence targets already exist and will not be overwritten", {
      code: "EVIDENCE_TARGET_ALREADY_EXISTS",
    });
  }
  if (
    !isPathInside(realPrivateDir, authorizationPath)
    || !isPathInside(realPrivateDir, preflightPath)
  ) {
    throw new R206StopError("production authorization and preflight artifacts must be in the private store", {
      code: "PRIVATE_ARTIFACT_PATH_UNSAFE",
    });
  }
  const authorization = readJson(authorizationPath, "authorization artifact");
  const preflight = readJson(preflightPath, "preflight artifact");
  validateAuthorizationArtifact(authorization.value, {
    ...options,
    privateEvidenceDir: realPrivateDir,
  }, now);
  validatePreflightArtifact(preflight.value, options, now);

  const publishableKey = env.R206_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.R206_SUPABASE_SECRET_KEY;
  if (!publishableKey || !secretKey) {
    throw new R206StopError(
      "production mode requires runtime-injected R206_SUPABASE_PUBLISHABLE_KEY and R206_SUPABASE_SECRET_KEY",
      { code: "PRODUCTION_CREDENTIALS_MISSING" },
    );
  }
  if (publishableKey === secretKey) {
    throw new R206StopError("publishable and secret credentials must be distinct", {
      code: "PRODUCTION_CREDENTIALS_INVALID",
    });
  }
  return {
    config: {
      ...options,
      apiUrl: R206_API_URL,
      applicationOrigin: R206_APPLICATION_ORIGIN,
      privateEvidenceDir: realPrivateDir,
      publicEvidenceDir,
      authorizationConsumptionPath,
      credentialSource: "process_environment",
    },
    authorization: authorization.value,
    preflight: preflight.value,
    artifactHashes: {
      authorization: sha256(authorization.raw),
      preflight: sha256(preflight.raw),
    },
    secrets: { publishableKey, secretKey },
  };
}

function safeHttpError(label, response) {
  return new R206StopError(`${label} failed with HTTP ${response.status}`, {
    code: "BOUNDED_HTTP_REQUEST_FAILED",
  });
}

function decodeSessionId(accessToken) {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
    );
    if (!/^[0-9a-f-]{36}$/i.test(payload.session_id || "")) throw new Error("missing session");
    return payload.session_id;
  } catch {
    throw new R206StopError("synthetic session did not expose a valid session identity", {
      code: "SESSION_IDENTITY_INVALID",
    });
  }
}

function stableEvidenceMarkdown(title, value) {
  return [
    `# ${title}`,
    "",
    "```json",
    JSON.stringify(value, null, 2),
    "```",
    "",
  ].join("\n");
}

export function createProductionAdapter({
  repoRoot,
  config,
  authorization,
  preflightArtifact,
  artifactHashes,
  secrets,
  browserRuntime,
  fetchImpl = globalThis.fetch,
}) {
  let publishableKey = secrets.publishableKey;
  let secretKey = secrets.secretKey;
  let privateLedgerInitialized = false;
  const browserProfiles = new Map();
  const credentialIdentities = new Map();
  let hydrationBrowser = null;
  const privateLedgerPath = path.join(config.privateEvidenceDir, R206_PRIVATE_LEDGER_NAME);
  const authorizationConsumptionPath = config.authorizationConsumptionPath;
  let authorizationConsumptionInitialized = false;
  const chromium = browserRuntime?.chromium || null;

  const assertUrl = (url) => {
    const parsed = new URL(url);
    const allowed = [R206_API_URL, R206_APPLICATION_ORIGIN];
    if (!allowed.includes(parsed.origin)) {
      throw new R206StopError("bounded adapter refused an unreviewed network origin", {
        code: "NETWORK_ORIGIN_NOT_ALLOWLISTED",
      });
    }
    return parsed;
  };

  const request = async (url, init = {}, label = "request") => {
    assertUrl(url);
    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        redirect: "error",
        headers: {
          "content-type": "application/json",
          ...(init.headers || {}),
        },
      });
    } catch (cause) {
      throw new R206StopError("bounded network request failed", {
        code: "NETWORK_REQUEST_FAILED",
        cause,
      });
    }
    let body = null;
    if (response.status !== 204) {
      const text = await response.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch (cause) {
          if (response.ok) {
            throw new R206StopError("successful bounded response was not valid JSON", {
              code: "JSON_PARSE_FAILURE",
              cause,
            });
          }
          body = null;
        }
      }
    }
    return { ok: response.ok, status: response.status, body, headers: response.headers };
  };

  const adminHeaders = () => ({
    apikey: secretKey,
    ...(secretKey.split(".").length === 3
      ? { authorization: `Bearer ${secretKey}` }
      : {}),
  });
  const sessionHeaders = (session) => ({
    apikey: publishableKey,
    authorization: `Bearer ${session.accessToken}`,
  });
  const anonymousHeaders = () => ({ apikey: publishableKey });

  const rest = async ({ table, select = "*", filters = "", headers = adminHeaders() }) => {
    const url = `${R206_API_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`;
    const result = await request(url, { method: "GET", headers }, `read ${table}`);
    if (!result.ok || !Array.isArray(result.body)) throw safeHttpError(`read ${table}`, result);
    return result.body;
  };

  const exactCounts = async (ledger) => {
    const userIds = [...ledger.users.values()].map((item) => item.id);
    const userFilter = userIds.length
      ? `&user_id=in.(${userIds.map(encodeURIComponent).join(",")})`
      : "&user_id=eq.00000000-0000-0000-0000-000000000000";
    const gameFilter = `&id=eq.${encodeURIComponent(ledger.game.id)}`;
    const gameIdFilter = `&game_id=eq.${encodeURIComponent(ledger.game.id)}`;
    const [profiles, games, events, tokens, tombstones] = await Promise.all([
      rest({ table: "user_profiles", select: "user_id", filters: userFilter }),
      rest({ table: "games", select: "id", filters: gameFilter }),
      rest({ table: "events", select: "id", filters: gameIdFilter }),
      rest({ table: "lh_live_share_tokens", select: "token_id", filters: gameIdFilter }),
      rest({ table: "legacy_game_tombstones", select: "game_id", filters: gameIdFilter }),
    ]);
    return {
      profiles: profiles.length,
      games: games.length,
      events: events.length,
      liveShareTokens: tokens.length,
      tombstones: tombstones.length,
    };
  };

  const rpc = async (name, body, session, { mutation = true, anonymous = false } = {}) => {
    assertAllowedRpc(name, { mutation });
    const result = await request(
      `${R206_API_URL}/rest/v1/rpc/${name}`,
      {
        method: "POST",
        headers: anonymous ? anonymousHeaders() : sessionHeaders(session),
        body: JSON.stringify(body),
      },
      `RPC ${name}`,
    );
    if (!result.ok) throw safeHttpError(`RPC ${name}`, result);
    return result.body;
  };

  const signInViaHttp = async (identity) => {
    const result = await request(
      `${R206_API_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: anonymousHeaders(),
        body: JSON.stringify({ email: identity.email, password: identity.password }),
      },
      "synthetic sign-in",
    );
    if (!result.ok || !result.body?.access_token || !result.body?.refresh_token) {
      throw safeHttpError("synthetic sign-in", result);
    }
    return {
      sessionId: decodeSessionId(result.body.access_token),
      accessToken: result.body.access_token,
      refreshToken: result.body.refresh_token,
    };
  };

  const signInViaIsolatedBrowser = async (identity, alias) => {
    if (!chromium) {
      throw new R206StopError("the preflight-verified Chromium runtime is unavailable", {
        code: "BROWSER_RUNTIME_UNAVAILABLE",
      });
    }
    const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-browser-"));
    let context;
    try {
      context = await chromium.launchPersistentContext(profilePath, {
        headless: true,
        serviceWorkers: "block",
      });
    } catch (cause) {
      fs.rmSync(profilePath, { recursive: true, force: true });
      throw new R206StopError("isolated synthetic browser session could not launch", {
        code: "BROWSER_SESSION_LAUNCH_FAILED",
        cause,
      });
    }
    try {
      const page = context.pages()[0] || await context.newPage();
      const network = [];
      const consoleClasses = [];
      page.on("request", (requestEvent) => {
        const url = new URL(requestEvent.url());
        if ([R206_API_URL, R206_APPLICATION_ORIGIN].includes(url.origin)) {
          network.push({ method: requestEvent.method(), origin: url.origin, pathname: url.pathname });
        }
      });
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) consoleClasses.push(message.type());
      });
      await page.goto(`${R206_APPLICATION_ORIGIN}/app.html`, { waitUntil: "networkidle" });
      await page.locator("#authEmail").fill(identity.email);
      await page.locator("#authPassword").fill(identity.password);
      await page.locator('button[value="sign-in"]').click();
      await page.locator('[data-action="sign-out"]').waitFor({ timeout: 30_000 });
      const storedSession = await page.evaluate(() => {
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
          try {
            const parsed = JSON.parse(localStorage.getItem(key));
            const container = Array.isArray(parsed) ? parsed[0] : parsed;
            const candidate =
              container?.currentSession
              ?? container?.session
              ?? container;
            if (candidate?.access_token && candidate?.refresh_token) {
              return {
                accessToken: candidate.access_token,
                refreshToken: candidate.refresh_token,
              };
            }
          } catch {
            // Ignore unrelated local values; the expected auth record is validated below.
          }
        }
        return null;
      });
      if (!storedSession) {
        throw new R206StopError("isolated browser did not establish the required synthetic session", {
          code: "BROWSER_SESSION_UNAVAILABLE",
        });
      }
      const browserEntry = { context, page, profilePath, network, consoleClasses };
      if (alias === "owner_hydration") hydrationBrowser = browserEntry;
      browserProfiles.set(path.resolve(profilePath), browserEntry);
      return {
        sessionId: decodeSessionId(storedSession.accessToken),
        accessToken: storedSession.accessToken,
        refreshToken: storedSession.refreshToken,
        browserProfilePath: profilePath,
      };
    } catch (cause) {
      await context.close().catch(() => {});
      try {
        fs.rmSync(profilePath, { recursive: true, force: true });
      } catch (cleanupCause) {
        throw new R206StopError("failed isolated browser session profile could not be removed", {
          code: "BROWSER_READINESS_CLEANUP_FAILED",
          cause: cleanupCause,
        });
      }
      if (cause instanceof R206StopError) throw cause;
      throw new R206StopError("isolated synthetic browser session failed", {
        code: "BROWSER_SESSION_FAILURE",
        cause,
      });
    }
  };

  return {
    async recordExecutionState({
      executionStartedAt,
      mutationStarted,
      terminalOutcome,
      cleanupCompleted,
    }) {
      const value = {
        schemaVersion: 1,
        authorizationArtifactSha256: artifactHashes.authorization,
        approvedRunnerSha: config.targetRef,
        executionStartedAt,
        mutationStarted: mutationStarted === true,
        terminalOutcome,
        cleanupCompleted: cleanupCompleted === true,
        authorizationConsumed: true,
        recordedAt: new Date().toISOString(),
      };
      const serialized = `${JSON.stringify(value, null, 2)}\n`;
      if (!authorizationConsumptionInitialized) {
        fs.writeFileSync(authorizationConsumptionPath, serialized, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
        authorizationConsumptionInitialized = true;
      } else {
        const temporary = `${authorizationConsumptionPath}.tmp`;
        fs.writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o600 });
        fs.renameSync(temporary, authorizationConsumptionPath);
      }
      return {
        path: authorizationConsumptionPath,
        terminalOutcome,
        mutationStarted: mutationStarted === true,
      };
    },

    async preflight() {
      if (authorization.browserExecutionAuthorized !== true) {
        throw new R206StopError("production browser execution is not separately authorized", {
          code: "PRODUCTION_BROWSER_EXECUTION_DISABLED",
        });
      }
      let versionResponse;
      let workerResponse;
      try {
        [versionResponse, workerResponse] = await Promise.all([
          fetchImpl(`${R206_APPLICATION_ORIGIN}/version.json`, { redirect: "error" }),
          fetchImpl(`${R206_APPLICATION_ORIGIN}/service-worker.js`, { redirect: "error" }),
        ]);
      } catch (cause) {
        throw new R206StopError("live runtime identity request failed", {
          code: "NETWORK_REQUEST_FAILED",
          cause,
        });
      }
      if (!versionResponse.ok || !workerResponse.ok) {
        throw new R206StopError("live runtime marker verification failed", {
          code: "RUNTIME_IDENTITY_UNAVAILABLE",
        });
      }
      let version;
      let worker;
      try {
        version = await versionResponse.json();
        worker = await workerResponse.text();
      } catch (cause) {
        throw new R206StopError("live runtime identity response could not be parsed", {
          code: "JSON_PARSE_FAILURE",
          cause,
        });
      }
      if (
        version.version !== R206_RELEASE_MARKER
        || !worker.includes(R206_CACHE_NAME)
      ) {
        throw new R206StopError("live runtime marker or cache identity changed", {
          code: "RUNTIME_IDENTITY_MISMATCH",
        });
      }
      return { ...preflightArtifact };
    },

    async createSyntheticUser(alias, identity) {
      const role = alias === "owner_user" ? "owner" : "challenger";
      assertSyntheticEmail(identity.email, role);
      const result = await request(
        `${R206_API_URL}/auth/v1/admin/users`,
        {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify({
            email: identity.email,
            password: identity.password,
            email_confirm: true,
            user_metadata: {
              first_name: identity.firstName,
              last_name: identity.lastName,
              phone: "",
              child_jersey_number: "",
            },
            app_metadata: {
              provider: "email",
              providers: ["email"],
              r206_synthetic: true,
            },
          }),
        },
        "create synthetic user",
      );
      if (!result.ok || !/^[0-9a-f-]{36}$/i.test(result.body?.id || "")) {
        throw safeHttpError("create synthetic user", result);
      }
      credentialIdentities.set(alias, identity);
      return { id: result.body.id };
    },

    async verifyProfiles(ledger) {
      const ids = [...ledger.users.values()].map((item) => item.id);
      const rows = await rest({
        table: "user_profiles",
        select: "user_id",
        filters: `&user_id=in.(${ids.map(encodeURIComponent).join(",")})`,
      });
      return rows.length;
    },

    async signInSyntheticUser(alias, identity) {
      if (alias === "owner_hydration" || alias === "challenger_initial") {
        return signInViaIsolatedBrowser(identity, alias);
      }
      return signInViaHttp(identity);
    },

    async guardedCreate({ session, operation, ledger }) {
      const result = await rpc(
        "laxhornet_sync_game",
        { p_operation: operation },
        session,
      );
      const counts = await exactCounts(ledger);
      if (
        counts.games !== 1
        || counts.events !== 0
        || counts.liveShareTokens !== 0
        || counts.tombstones !== 0
      ) {
        throw new R206StopError("guarded create exceeded the reviewed record boundary", {
          code: "CREATE_RECORD_BOUNDARY_VIOLATION",
        });
      }
      return result;
    },

    async verifyDenials({ challengerSession, ledger, scope }) {
      const gameFilter = `?id=eq.${encodeURIComponent(ledger.game.id)}&select=id,opponent`;
      const eventFilter = `?game_id=eq.${encodeURIComponent(ledger.game.id)}&select=id`;
      const tombstoneFilter =
        `?game_id=eq.${encodeURIComponent(ledger.game.id)}&select=game_id`;
      const challengerGameRead = await request(
        `${R206_API_URL}/rest/v1/games${gameFilter}`,
        { method: "GET", headers: sessionHeaders(challengerSession) },
        "challenger game read",
      );
      const challengerTombstoneRead = await request(
        `${R206_API_URL}/rest/v1/legacy_game_tombstones${tombstoneFilter}`,
        { method: "GET", headers: sessionHeaders(challengerSession) },
        "challenger tombstone read",
      );
      const challengerEventRead = await request(
        `${R206_API_URL}/rest/v1/events${eventFilter}`,
        { method: "GET", headers: sessionHeaders(challengerSession) },
        "challenger event read",
      );
      const anonymousWrite = await request(
        `${R206_API_URL}/rest/v1/rpc/laxhornet_sync_game`,
        {
          method: "POST",
          headers: anonymousHeaders(),
          body: JSON.stringify({ p_operation: {} }),
        },
        "anonymous guarded write denial",
      );
      const anonymousDelete = await request(
        `${R206_API_URL}/rest/v1/rpc/laxhornet_delete_game_durable`,
        {
          method: "POST",
          headers: anonymousHeaders(),
          body: JSON.stringify({ p_deletion: {} }),
        },
        "anonymous durable delete denial",
      );
      const challengerPatch = await request(
        `${R206_API_URL}/rest/v1/games${gameFilter}`,
        {
          method: "PATCH",
          headers: { ...sessionHeaders(challengerSession), prefer: "return=representation" },
          body: JSON.stringify({ opponent: "r206-smoke-denial-probe" }),
        },
        "challenger direct update denial",
      );
      const challengerDelete = await request(
        `${R206_API_URL}/rest/v1/games${gameFilter}`,
        {
          method: "DELETE",
          headers: { ...sessionHeaders(challengerSession), prefer: "return=representation" },
        },
        "challenger direct delete denial",
      );
      const eventProbeId = `${scope.prefix}-denial-event`;
      const challengerEventWrite = await request(
        `${R206_API_URL}/rest/v1/events`,
        {
          method: "POST",
          headers: { ...sessionHeaders(challengerSession), prefer: "return=representation" },
          body: JSON.stringify({
            id: eventProbeId,
            game_id: ledger.game.id,
            user_id: ledger.users.get("challenger_user").id,
            timestamp: scope.createdAt,
            quarter: "Q1",
            stat_type: "note",
            stat_label: "R206 denial probe",
            category: "other",
          }),
        },
        "challenger event write denial",
      );
      const challengerTombstoneWrite = await request(
        `${R206_API_URL}/rest/v1/legacy_game_tombstones`,
        {
          method: "POST",
          headers: { ...sessionHeaders(challengerSession), prefer: "return=representation" },
          body: JSON.stringify({
            game_id: ledger.game.id,
            owner_user_id: ledger.users.get("owner_user").id,
            deleted_by: ledger.users.get("challenger_user").id,
            deletion_id: scope.game.deletionB,
            device_id: scope.game.deviceId,
            deleted_at: scope.createdAt,
          }),
        },
        "challenger tombstone write denial",
      );
      const privateHelper = await request(
        `${R206_API_URL}/rest/v1/rpc/reject_tombstoned_game_write`,
        {
          method: "POST",
          headers: sessionHeaders(challengerSession),
          body: "{}",
        },
        "private helper denial",
      );
      const counts = await exactCounts(ledger);
      const noRows = (response) =>
        response.ok && Array.isArray(response.body) && response.body.length === 0;
      const authRejected = (response) =>
        [401, 403, 404].includes(response.status)
        || (
          response.ok
          && ["rejected", "conflicted"].includes(response.body?.outcome)
        );
      const allDenied =
        noRows(challengerGameRead)
        && noRows(challengerTombstoneRead)
        && noRows(challengerEventRead)
        && authRejected(anonymousWrite)
        && authRejected(anonymousDelete)
        && (noRows(challengerPatch) || [401, 403].includes(challengerPatch.status))
        && (noRows(challengerDelete) || [401, 403].includes(challengerDelete.status))
        && (noRows(challengerEventWrite) || [401, 403].includes(challengerEventWrite.status))
        && (noRows(challengerTombstoneWrite) || [401, 403].includes(challengerTombstoneWrite.status))
        && [401, 403, 404].includes(privateHelper.status)
        && counts.games === 1
        && counts.events === 0
        && counts.tombstones === 0
        && counts.liveShareTokens === 0;
      return {
        outcome: allDenied ? "verified" : "failed",
        code: allDenied ? "authorization_denials_verified" : "unauthorized_success",
        unauthorizedSuccess: !allDenied,
        disclosure: false,
      };
    },

    async guardedUpdate({ session, operation, ledger }) {
      const result = await rpc(
        "laxhornet_sync_game",
        { p_operation: operation },
        session,
      );
      const counts = await exactCounts(ledger);
      if (
        counts.games !== (result.code === "game_deleted" ? 0 : 1)
        || counts.events !== 0
        || counts.liveShareTokens !== 0
        || counts.tombstones !== (result.code === "game_deleted" ? 1 : 0)
      ) {
        throw new R206StopError("guarded update exceeded the reviewed record boundary", {
          code: "UPDATE_RECORD_BOUNDARY_VIOLATION",
        });
      }
      return result;
    },

    async durableDelete({ session, deletion, ledger }) {
      const result = await rpc(
        "laxhornet_delete_game_durable",
        { p_deletion: deletion },
        session,
      );
      const counts = await exactCounts(ledger);
      const expectedDeleted = ["game_deleted", "game_delete_replayed", "game_already_deleted"]
        .includes(result?.code);
      const expectedTombstones = expectedDeleted ? 1 : 0;
      const expectedGames = expectedDeleted ? 0 : 1;
      if (
        counts.games !== expectedGames
        || counts.tombstones !== expectedTombstones
        || counts.events !== 0
        || counts.liveShareTokens !== 0
      ) {
        throw new R206StopError("durable delete changed an unexpected record boundary", {
          code: "DELETE_RECORD_BOUNDARY_VIOLATION",
        });
      }
      return result;
    },

    async verifyHydration({ ledger }) {
      if (!hydrationBrowser) {
        throw new R206StopError("isolated hydration browser is unavailable", {
          code: "BROWSER_SESSION_UNAVAILABLE",
        });
      }
      const { page, network, consoleClasses, profilePath } = hydrationBrowser;
      await page.waitForLoadState("networkidle");
      const tombstoneIndex = network.findIndex(
        (entry) => entry.pathname.endsWith("/legacy_game_tombstones"),
      );
      const gameIndex = network.findIndex((entry) => entry.pathname.endsWith("/games"));
      const localEvidence = await page.evaluate((gameId) => {
        const values = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          values.push(localStorage.getItem(localStorage.key(index)) || "");
        }
        return values.some((value) => value.includes(gameId));
      }, ledger.game.id);
      const body = await page.locator("body").innerText();
      const firstPassVisible = body.includes(ledger.game.id) || localEvidence;
      const beforeRefreshRequests = network.length;
      await page.reload({ waitUntil: "networkidle" });
      const afterBody = await page.locator("body").innerText();
      const afterRefreshVisible = afterBody.includes(ledger.game.id);
      const refreshRequests = network.slice(beforeRefreshRequests);
      const mutationRequests = refreshRequests.filter(
        (entry) =>
          entry.pathname.endsWith("/rpc/laxhornet_sync_game")
          || entry.pathname.endsWith("/rpc/laxhornet_delete_game_durable"),
      );
      return {
        outcome: "verified",
        code: "clean_hydration_verified",
        gameVisible: firstPassVisible || afterRefreshVisible,
        tombstoneBeforeMerge: tombstoneIndex >= 0 && gameIndex >= 0 && tombstoneIndex < gameIndex,
        retryStorm: mutationRequests.length > 0,
        applicationConsoleErrors: consoleClasses.filter((type) => type === "error").length,
        browserProfilePath: profilePath,
      };
    },

    async verifyDisclosure({ challengerSession, ledger, scope }) {
      const publicPayload = await rpc(
        "lh_public_live_share_game",
        { p_share_code: scope.game.shareCode },
        null,
        { mutation: false, anonymous: true },
      );
      const challengerRows = await rest({
        table: "legacy_game_tombstones",
        select: "game_id",
        filters: `&game_id=eq.${encodeURIComponent(ledger.game.id)}`,
        headers: sessionHeaders(challengerSession),
      });
      const anonymousGame = await rest({
        table: "games",
        select: "id",
        filters: `&id=eq.${encodeURIComponent(ledger.game.id)}`,
        headers: anonymousHeaders(),
      }).catch(() => []);
      const staticFiles = await Promise.all([
        fetchImpl(`${R206_APPLICATION_ORIGIN}/app.html`),
        fetchImpl(`${R206_APPLICATION_ORIGIN}/app.js`),
        fetchImpl(`${R206_APPLICATION_ORIGIN}/version.json`),
      ]);
      const staticBodies = await Promise.all(
        staticFiles.map((response) => response.ok ? response.text() : ""),
      );
      const counts = await exactCounts(ledger);
      const disclosed =
        publicPayload != null
        || challengerRows.length > 0
        || anonymousGame.length > 0
        || staticBodies.some((body) => body.includes(ledger.game.id));
      return {
        outcome: disclosed ? "failed" : "verified",
        code: disclosed ? "synthetic_disclosure_detected" : "disclosure_absent",
        disclosed,
        liveShareTokens: counts.liveShareTokens,
      };
    },

    async persistPrivateLedger(snapshot) {
      const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
      if (/password|access[_-]?token|refresh[_-]?token|api[_-]?key|service[_-]?role|authorization\s*[:=]\s*bearer/i.test(serialized)) {
        throw new R206StopError("private ledger contains a credential field", {
          code: "CREDENTIAL_EXPOSURE_DETECTED",
        });
      }
      if (!privateLedgerInitialized) {
        fs.writeFileSync(privateLedgerPath, serialized, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
        privateLedgerInitialized = true;
      } else {
        const temporary = `${privateLedgerPath}.tmp`;
        fs.writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o600 });
        fs.renameSync(temporary, privateLedgerPath);
      }
      const digest = createHash("sha256").update(serialized).digest("hex");
      return {
        path: privateLedgerPath,
        sha256: digest,
        opaqueReference: `r206-private-${digest.slice(0, 16)}`,
      };
    },

    async revokeSession(_alias, session) {
      const result = await request(
        `${R206_API_URL}/auth/v1/logout?scope=local`,
        { method: "POST", headers: sessionHeaders(session) },
        "revoke synthetic session",
      );
      if (!result.ok && ![401, 403].includes(result.status)) {
        throw safeHttpError("revoke synthetic session", result);
      }
    },

    async verifyRevokedAuthority(_alias, session, ledger) {
      const [userResult, refreshResult, applicationResult] = await Promise.all([
        request(
          `${R206_API_URL}/auth/v1/user`,
          { method: "GET", headers: sessionHeaders(session) },
          "revoked user probe",
        ),
        request(
          `${R206_API_URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: anonymousHeaders(),
            body: JSON.stringify({ refresh_token: session.refreshToken }),
          },
          "revoked refresh probe",
        ),
        request(
          `${R206_API_URL}/rest/v1/legacy_game_tombstones`
            + `?game_id=eq.${encodeURIComponent(ledger.game.id)}&select=game_id`,
          { method: "GET", headers: sessionHeaders(session) },
          "revoked application authority probe",
        ),
      ]);
      const refreshRejected = [400, 401, 403].includes(refreshResult.status);
      const applicationRejected =
        [401, 403].includes(applicationResult.status)
        || (Array.isArray(applicationResult.body) && applicationResult.body.length === 0);
      if (!refreshRejected || !applicationRejected) {
        throw new R206StopError("revoked synthetic credentials retained application authority", {
          code: "SESSION_REVOCATION_INCOMPLETE",
        });
      }
      // A signed JWT may remain cryptographically valid until exp. Success here
      // depends on refresh authority and retained-resource authority being gone,
      // not on treating JWT expiry as the revocation boundary.
      void userResult;
      session.accessToken = null;
      session.refreshToken = null;
      return true;
    },

    async deleteSyntheticUser(_alias, user) {
      const result = await request(
        `${R206_API_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
        { method: "DELETE", headers: adminHeaders() },
        "delete synthetic user",
      );
      if (!result.ok && result.status !== 404) {
        throw safeHttpError("delete synthetic user", result);
      }
    },

    async verifyProfilesRemoved(ledger) {
      const ids = [...ledger.users.values()].map((item) => item.id);
      const rows = await rest({
        table: "user_profiles",
        select: "user_id",
        filters: `&user_id=in.(${ids.map(encodeURIComponent).join(",")})`,
      });
      if (rows.length !== 0) {
        throw new R206StopError("synthetic profiles survived Auth cleanup", {
          code: "PROFILE_CASCADE_INCOMPLETE",
        });
      }
      return [...ledger.profiles.keys()];
    },

    async clearBrowserProfile(profilePath) {
      const resolved = path.resolve(profilePath);
      const entry = browserProfiles.get(resolved);
      if (!entry) {
        throw new R206StopError("browser cleanup attempted an unknown profile", {
          code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
        });
      }
      await entry.context.close();
      fs.rmSync(resolved, { recursive: true, force: true });
      browserProfiles.delete(resolved);
      if (hydrationBrowser?.profilePath === resolved) hydrationBrowser = null;
    },

    async finalCounts(ledger) {
      const exact = await exactCounts(ledger);
      let authUsers = 0;
      for (const user of ledger.users.values()) {
        const result = await request(
          `${R206_API_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
          { method: "GET", headers: adminHeaders() },
          "synthetic user absence probe",
        );
        if (result.ok) authUsers += 1;
        else if (result.status !== 404) throw safeHttpError("synthetic user absence probe", result);
      }
      const sessions = [...ledger.sessions.values()].filter((session) => !session.revoked).length;
      return { ...exact, authUsers, sessions };
    },

    async writePublicEvidence(bundle) {
      for (const value of Object.values(bundle)) {
        assertPublicEvidenceSafe(value);
      }
      fs.mkdirSync(config.publicEvidenceDir, { recursive: true });
      const files = [
        [
          "SYNTHETIC_VERIFICATION_AUTHORIZATION.md",
          "R2-06 synthetic verification authorization evidence",
          bundle.authorization,
        ],
        [
          "SYNTHETIC_VERIFICATION_RESULT.md",
          "R2-06 synthetic verification result",
          bundle.operations,
        ],
        [
          "SYNTHETIC_CLEANUP_RESULT.md",
          "R2-06 synthetic cleanup result",
          bundle.cleanup,
        ],
      ];
      const paths = [];
      const hashes = {};
      for (const [name, title, value] of files) {
        const content = stableEvidenceMarkdown(title, value);
        assertPublicEvidenceSafe(content);
        const file = path.join(config.publicEvidenceDir, name);
        fs.writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
        paths.push(path.relative(repoRoot, file).replaceAll("\\", "/"));
        hashes[name] = sha256(content);
      }
      return { paths, hashes };
    },

    async cleanupGameViaReviewedRpc({ ledger }) {
      const ownerSession = [...ledger.sessions.values()].find(
        (session) => session.userAlias === "owner_user" && !session.revoked,
      );
      if (!ownerSession) {
        throw new R206StopError("no active ledger-owned owner session is available for RPC cleanup", {
          code: "CLEANUP_GAME_RPC_UNAVAILABLE",
        });
      }
      const ownerId = ledger.users.get("owner_user").id;
      return rpc(
        "laxhornet_delete_game_durable",
        {
          p_deletion: {
            game_id: ledger.game.id,
            account_id: ownerId,
            deletion_id: ledger.deletions.deletion_a,
            device_id: ledger.game.deviceId,
            deleted_at: new Date().toISOString(),
            known_game_saved_at: ledger.game.savedAtT2 || ledger.game.savedAtT1,
          },
        },
        ownerSession,
      );
    },

    async close() {
      for (const [profilePath, entry] of browserProfiles) {
        await entry.context.close().catch(() => {});
        try {
          fs.rmSync(profilePath, { recursive: true, force: true });
        } catch {
          // Normal and failure cleanup report profile-removal failures. This
          // final close is a non-throwing safety net that must not mask them.
        }
      }
      browserProfiles.clear();
      hydrationBrowser = null;
      publishableKey = null;
      secretKey = null;
      for (const identity of credentialIdentities.values()) {
        identity.password = null;
        identity.email = null;
      }
      credentialIdentities.clear();
    },
  };
}
