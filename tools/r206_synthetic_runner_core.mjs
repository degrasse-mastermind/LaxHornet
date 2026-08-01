import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const R206_PROJECT_REF = "ulbmjcvnyznvmjgpstno";
export const R206_API_URL = `https://${R206_PROJECT_REF}.supabase.co`;
export const R206_APPLICATION_ORIGIN = "https://laxhornet.mybranford.com";
export const R206_RUNTIME_SHA = "2fcc446d5f3d06ca6d24c69bc4466a13794e02b3";
export const R206_PAGES_RUN_ID = "30559099199";
export const R206_RELEASE_MARKER = "v284";
export const R206_CACHE_NAME = "laxhornet-v284";
export const R206_PRIVATE_EVIDENCE_DIR =
  "C:\\Users\\user\\Documents\\LaxHornet-Private-Release-Evidence\\R2-06";
export const R206_RUN_ID_MAX_LENGTH = 34;
export const R206_RUN_ID_PATTERN = /^r206-[0-9]{8}t[0-9]{6}z-[0-9a-f]{12}$/;
export const R206_PRIVATE_LEDGER_NAME = "R2-06_RETAINED_IDENTIFIERS.json";
export const R206_PUBLIC_EVIDENCE_DIR =
  "review-evidence/r2-06-durable-game-tombstones-release";

export const R206_MIGRATION_VERSIONS = Object.freeze([
  "20260730134439",
  "20260730151714",
]);

export const ALLOWED_MUTATION_RPCS = Object.freeze([
  "laxhornet_sync_game",
  "laxhornet_delete_game_durable",
]);

export const ALLOWED_READ_RPCS = Object.freeze([
  "lh_public_live_share_game",
]);

export const HARD_LIMITS = Object.freeze({
  authUsersCreated: 2,
  sessionsCreated: 3,
  profilesExpected: 2,
  gamesCreated: 1,
  gameUpdates: 1,
  eventsCreated: 0,
  liveShareTokensCreated: 0,
  acceptedDurableDeletes: 1,
  permanentTombstonesCreated: 1,
  privateIdentifierRecords: 1,
});

export const ACTION_PLAN = Object.freeze([
  {
    sequence: 1,
    action: "create_owner_user",
    system: "Supabase Auth",
    objectType: "auth.users",
    maximum: 1,
    expected: "one new synthetic owner",
  },
  {
    sequence: 2,
    action: "create_challenger_user",
    system: "Supabase Auth",
    objectType: "auth.users",
    maximum: 1,
    expected: "one new synthetic challenger",
  },
  {
    sequence: 3,
    action: "verify_profiles",
    system: "Postgres",
    objectType: "public.user_profiles",
    maximum: 2,
    expected: "exactly two automatic synthetic profiles",
  },
  {
    sequence: 4,
    action: "establish_sessions",
    system: "Supabase Auth",
    objectType: "sessions",
    maximum: 3,
    expected: "three sequential synthetic sessions",
  },
  {
    sequence: 5,
    action: "guarded_create",
    system: "Postgres RPC",
    objectType: "public.games",
    maximum: 1,
    expected: "accepted / legacy_game_write_accepted",
  },
  {
    sequence: 6,
    action: "prohibit_events",
    system: "Postgres",
    objectType: "public.events",
    maximum: 0,
    expected: "zero events",
  },
  {
    sequence: 7,
    action: "verify_denials",
    system: "Postgres RPC and Data API",
    objectType: "known synthetic scope",
    maximum: 0,
    expected: "zero unauthorized reads or accepted mutations",
  },
  {
    sequence: 8,
    action: "guarded_update",
    system: "Postgres RPC",
    objectType: "public.games",
    maximum: 1,
    expected: "accepted update of the same game",
  },
  {
    sequence: 9,
    action: "stale_delete",
    system: "Postgres RPC",
    objectType: "game/tombstone",
    maximum: 0,
    expected: "conflicted / newer_game_revision",
  },
  {
    sequence: 10,
    action: "durable_delete",
    system: "Postgres RPC",
    objectType: "game/tombstone",
    maximum: 1,
    expected: "accepted / game_deleted and one tombstone",
  },
  {
    sequence: 11,
    action: "same_id_replay",
    system: "Postgres RPC",
    objectType: "retained tombstone",
    maximum: 1,
    expected: "accepted / game_delete_replayed without a second tombstone",
  },
  {
    sequence: 12,
    action: "different_id_conflict",
    system: "Postgres RPC",
    objectType: "game/tombstone",
    maximum: 0,
    expected: "conflicted / game_already_deleted",
  },
  {
    sequence: 13,
    action: "stale_write",
    system: "Postgres RPC",
    objectType: "game/tombstone",
    maximum: 0,
    expected: "conflicted / game_deleted",
  },
  {
    sequence: 14,
    action: "clean_session_hydration",
    system: "Deployed app",
    objectType: "isolated browser state",
    maximum: 1,
    expected: "tombstone fetched before merge and game absent",
  },
  {
    sequence: 15,
    action: "verify_disclosure_absent",
    system: "Public disclosure",
    objectType: "Live Share/public payload/static artifact",
    maximum: 0,
    expected: "no token or disclosure",
  },
  {
    sequence: 16,
    action: "revoke_sessions",
    system: "Supabase Auth",
    objectType: "three synthetic sessions",
    maximum: 3,
    expected: "all refresh and application authority rejected",
  },
  {
    sequence: 17,
    action: "delete_users",
    system: "Supabase Auth",
    objectType: "auth.users",
    maximum: 2,
    expected: "both ledger-owned users removed",
  },
  {
    sequence: 18,
    action: "verify_profile_cascade",
    system: "Postgres",
    objectType: "public.user_profiles",
    maximum: 2,
    expected: "both ledger-owned profiles absent",
  },
  {
    sequence: 19,
    action: "clear_browser_state",
    system: "Browser",
    objectType: "isolated profile paths",
    maximum: 2,
    expected: "all isolated local state removed",
  },
  {
    sequence: 20,
    action: "write_public_evidence",
    system: "Public repository",
    objectType: "sanitized evidence bundle",
    maximum: 3,
    expected: "authorization, operation, and cleanup evidence without identifiers",
  },
  {
    sequence: 21,
    action: "write_private_ledger",
    system: "Private evidence store",
    objectType: "retained identifier record",
    maximum: 1,
    expected: "one hash-bound private ledger without credentials",
  },
]);

export const NORMAL_PHASES = Object.freeze([
  "initialized",
  "preflight_verified",
  "credentials_available",
  "users_created",
  "initial_sessions_established",
  "game_created",
  "denials_verified",
  "game_updated",
  "stale_delete_verified",
  "durable_delete_verified",
  "replay_verified",
  "different_id_conflict_verified",
  "stale_write_verified",
  "hydration_session_established",
  "hydration_verified",
  "disclosure_verified",
  "private_ledger_written",
  "sessions_revoked",
  "users_deleted",
  "profiles_removed",
  "browser_state_cleared",
  "mutable_residue_zero",
  "evidence_written",
  "completed",
]);

export class R206StopError extends Error {
  constructor(message, { code = "R206_STOP_CONDITION", cause } = {}) {
    super(message, { cause });
    this.name = "R206StopError";
    this.code = code;
    this.nativeErrorName = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(String(cause?.name || ""))
      ? String(cause.name)
      : null;
    this.nativeErrorCode = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(String(cause?.code || ""))
      ? String(cause.code)
      : null;
  }
}

function sanitizeFailureMessage(error) {
  const fallback = error instanceof R206StopError
    ? "runner stopped on a classified R2-06 condition"
    : "runner stopped on an unexpected execution failure";
  const message = String(error?.message || fallback);
  if (
    message.length > 240
    || EMAIL_PATTERN.test(message)
    || UUID_PATTERN.test(message)
    || SECRET_PATTERN.test(message)
    || /(?:[A-Za-z]:\\|\/(?:home|Users|tmp)\/)/.test(message)
  ) {
    return fallback;
  }
  return message;
}

function sanitizedResidueCounts(counts) {
  if (!counts || typeof counts !== "object") return null;
  const allowed = new Set([
    "authUsers",
    "profiles",
    "sessions",
    "games",
    "events",
    "tombstones",
    "liveShareTokens",
    "operations",
  ]);
  return Object.fromEntries(
    Object.entries(counts)
      .filter(([key, value]) => allowed.has(key) && Number.isInteger(value))
      .map(([key, value]) => [key, value]),
  );
}

function sanitizedCheckpointReference(value) {
  const normalized = String(value || "");
  return /^r206-private-[a-z0-9-]{1,64}$/i.test(normalized) ? normalized : null;
}

function sanitizedOperation(value, fallback = null) {
  const normalized = String(value || "");
  return /^[a-z][a-z0-9_]{0,79}$/.test(normalized) ? normalized : fallback;
}

function sanitizedMilliseconds(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function sanitizedOperationTimings(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => ({
      operation: sanitizedOperation(value?.operation),
      elapsedMilliseconds: sanitizedMilliseconds(value?.elapsedMilliseconds),
      timeoutMilliseconds: sanitizedMilliseconds(value?.timeoutMilliseconds),
    }))
    .filter((value) => value.operation && value.elapsedMilliseconds != null && value.timeoutMilliseconds != null)
    .slice(0, 24);
}

export function attachExecutionContext(error, context) {
  const normalized = error instanceof R206StopError
    ? error
    : new R206StopError("runner stopped on an unexpected execution failure", {
      code: "UNEXPECTED_EXECUTION_FAILURE",
      cause: error,
    });
  normalized.executionContext = {
    ...(normalized.executionContext || {}),
    ...context,
    residueCounts: sanitizedResidueCounts(context?.residueCounts),
    authorizationConsumed: context?.authorizationConsumed === true,
  };
  return normalized;
}

export function createFailureEnvelope(error, context = {}) {
  const normalized = error instanceof R206StopError
    ? error
    : new R206StopError("runner stopped on an unexpected execution failure", {
      code: "UNEXPECTED_EXECUTION_FAILURE",
      cause: error,
    });
  const execution = {
    ...(normalized.executionContext || {}),
    ...context,
  };
  const authorizationConsumed = execution.authorizationConsumed === true;
  const completedActionCount = Number.isInteger(execution.completedActionCount)
    ? execution.completedActionCount
    : 0;
  const operation = sanitizedOperation(
    execution.operation,
    sanitizedOperation(execution.currentOperation, "unknown"),
  );
  return {
    ok: false,
    code: normalized.code || "UNEXPECTED_EXECUTION_FAILURE",
    message: sanitizeFailureMessage(normalized),
    currentOperation: operation,
    operation,
    runnerOperation: sanitizedOperation(execution.runnerOperation),
    lastCompletedOperation: sanitizedOperation(execution.lastCompletedOperation, "none"),
    phase: execution.phase || "startup",
    lastSuccessfullyCompletedPhase: execution.lastSuccessfullyCompletedPhase || "none",
    completedActionCount,
    actionCount: ACTION_PLAN.length,
    elapsedMilliseconds: sanitizedMilliseconds(execution.elapsedMilliseconds),
    timeoutMilliseconds: sanitizedMilliseconds(execution.timeoutMilliseconds),
    operationTimings: sanitizedOperationTimings(execution.operationTimings),
    browserContextExisted: execution.browserContextExisted === true,
    pageLifecycleState: sanitizedOperation(execution.pageLifecycleState, "unknown"),
    authRequestStarted: execution.authRequestStarted === true,
    authResponseAccepted: execution.authResponseAccepted === true,
    authSessionConfirmed: execution.authSessionConfirmed === true,
    authSessionIdentityConfirmed: execution.authSessionIdentityConfirmed === true,
    authPersistenceConfirmed: execution.authPersistenceConfirmed === true,
    cookieStatePresent: execution.cookieStatePresent === true,
    localStorageStatePresent: execution.localStorageStatePresent === true,
    applicationAuthBootstrapConfirmed:
      execution.applicationAuthBootstrapConfirmed === true,
    authenticatedCapabilityConfirmed:
      execution.authenticatedCapabilityConfirmed === true,
    authenticatedUiMarkerObserved: execution.authenticatedUiMarkerObserved === true,
    authenticatedUiMarkerElapsedMilliseconds: sanitizedMilliseconds(
      execution.authenticatedUiMarkerElapsedMilliseconds,
    ),
    authenticatedUiMarkerType: sanitizedOperation(
      execution.authenticatedUiMarkerType,
      "sign_out_action",
    ),
    uiMarkerAbsenceAffectedExecution: false,
    applicationAuthReloadAttempted: execution.applicationAuthReloadAttempted === true,
    browserCleanupEntered: execution.browserCleanupEntered === true,
    browserContextClosed: execution.browserContextClosed === true,
    browserProfileRemoved: execution.browserProfileRemoved === true,
    mutationStarted: execution.mutationStarted === true,
    cleanupOnlyStarted: execution.cleanupOnlyStarted === true,
    cleanupEntered: execution.cleanupOnlyStarted === true,
    cleanupCompleted: execution.cleanupCompleted === true,
    residueCounts: sanitizedResidueCounts(execution.residueCounts),
    privateCheckpointReference: sanitizedCheckpointReference(
      execution.privateCheckpointReference,
    ),
    retainedTombstone: execution.retainedTombstone === true,
    manualCleanupRequired: execution.manualCleanupRequired === true,
    authorizationConsumed,
    authorizationState: authorizationConsumed ? "failed_consumed" : "failed_unused",
    nativeError: {
      name: normalized.nativeErrorName || null,
      code: normalized.nativeErrorCode || null,
    },
    releaseCloseoutApproved: false,
  };
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isPathInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function pathEquals(left, right) {
  const normalizedLeft = path.normalize(path.resolve(left));
  const normalizedRight = path.normalize(path.resolve(right));
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function pathSegments(target) {
  const resolved = path.resolve(target);
  const parsed = path.parse(resolved);
  const segments = resolved
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  const result = [];
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    result.push(current);
  }
  return result;
}

function isWindowsReparsePoint(target) {
  const result = spawnSync(
    "fsutil",
    ["reparsepoint", "query", target],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status === 0) return true;
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status === 1 && /\b4390\b/.test(output)) return false;
  throw new R206StopError("Windows reparse-point status could not be verified", {
    code: "PRIVATE_EVIDENCE_REPARSE_POINT_UNSAFE",
    cause: result.error,
  });
}

export function assertNoUnsafePathSegments(
  target,
  {
    fsImpl = fs,
    platform = process.platform,
    reparsePointProbe = isWindowsReparsePoint,
  } = {},
) {
  for (const segment of pathSegments(target)) {
    let status;
    try {
      status = fsImpl.lstatSync(segment);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (
      status.isSymbolicLink()
      || (platform === "win32" && reparsePointProbe(segment))
    ) {
      throw new R206StopError("private evidence path contains a link or reparse point", {
        code: "PRIVATE_EVIDENCE_REPARSE_POINT_UNSAFE",
      });
    }
  }
  return true;
}

export function assertValidR206RunId(runId) {
  const value = String(runId || "");
  if (
    value.length > R206_RUN_ID_MAX_LENGTH
    || !R206_RUN_ID_PATTERN.test(value)
  ) {
    throw new R206StopError("private evidence run directory name is invalid", {
      code: "PRIVATE_EVIDENCE_RUN_DIR_INVALID",
    });
  }
  const match = value.match(
    /^r206-([0-9]{4})([0-9]{2})([0-9]{2})t([0-9]{2})([0-9]{2})([0-9]{2})z-/,
  );
  const canonicalTimestamp = match
    ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
    : "";
  const timestamp = Date.parse(canonicalTimestamp);
  if (
    !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 19) !== canonicalTimestamp.slice(0, 19)
  ) {
    throw new R206StopError("private evidence run directory timestamp is invalid", {
      code: "PRIVATE_EVIDENCE_RUN_DIR_INVALID",
    });
  }
  return value;
}

function assertOutsideWorktrees(candidate, worktreeRoots) {
  const resolvedCandidate = path.resolve(candidate);
  for (const root of worktreeRoots) {
    if (isPathInside(root, resolvedCandidate)) {
      throw new R206StopError("private evidence directory must be outside every Git worktree", {
        code: "PRIVATE_EVIDENCE_INSIDE_WORKTREE",
      });
    }
  }
}

export function assertSafePrivateEvidencePath({
  repoRoot,
  privateEvidenceDir,
  executionMode,
  reviewedOverride = false,
  approvedPrivateRoot = R206_PRIVATE_EVIDENCE_DIR,
  gitWorktreeRoots = [repoRoot],
  fsImpl = fs,
  platform = process.platform,
  reparsePointProbe = isWindowsReparsePoint,
}) {
  if (!privateEvidenceDir) {
    throw new R206StopError("private evidence directory is required", {
      code: "PRIVATE_EVIDENCE_DIR_REQUIRED",
    });
  }
  if (/(^|[\\/])\.\.([\\/]|$)/.test(String(privateEvidenceDir))) {
    throw new R206StopError("private evidence path traversal is not allowed", {
      code: "PRIVATE_EVIDENCE_PATH_ESCAPE",
    });
  }
  const resolved = path.resolve(privateEvidenceDir);
  const resolvedRoot = path.resolve(approvedPrivateRoot);
  assertOutsideWorktrees(resolvedRoot, gitWorktreeRoots);
  assertOutsideWorktrees(resolved, gitWorktreeRoots);

  if (pathEquals(resolved, resolvedRoot)) {
    throw new R206StopError("the approved private root is not an execution directory", {
      code: "PRIVATE_EVIDENCE_RUN_DIR_INVALID",
    });
  }

  if (executionMode === "production" && reviewedOverride !== true) {
    const relative = path.relative(resolvedRoot, resolved);
    if (
      relative.startsWith(`..${path.sep}`)
      || relative === ".."
      || path.isAbsolute(relative)
    ) {
      throw new R206StopError("private evidence run directory is outside the approved root", {
        code: "PRIVATE_EVIDENCE_ROOT_MISMATCH",
      });
    }
    if (!relative || relative.includes(path.sep)) {
      throw new R206StopError("private evidence run directory must be one immediate child", {
        code: "PRIVATE_EVIDENCE_RUN_DIR_INVALID",
      });
    }
    assertValidR206RunId(relative);
  }

  let rootStatus;
  try {
    rootStatus = fsImpl.lstatSync(resolvedRoot);
  } catch {
    rootStatus = null;
  }
  if (rootStatus?.isSymbolicLink()) {
    throw new R206StopError("approved private root is a link or reparse point", {
      code: "PRIVATE_EVIDENCE_REPARSE_POINT_UNSAFE",
    });
  }
  if (!rootStatus?.isDirectory()) {
    throw new R206StopError("approved private evidence root is unavailable", {
      code: "PRIVATE_EVIDENCE_ROOT_MISMATCH",
    });
  }
  let runStatus;
  try {
    runStatus = fsImpl.lstatSync(resolved);
  } catch {
    runStatus = null;
  }
  if (runStatus?.isSymbolicLink()) {
    throw new R206StopError("private evidence run directory is a link or reparse point", {
      code: "PRIVATE_EVIDENCE_REPARSE_POINT_UNSAFE",
    });
  }
  if (!runStatus?.isDirectory()) {
    throw new R206StopError("private evidence run directory is unavailable", {
      code: "PRIVATE_EVIDENCE_RUN_DIR_INVALID",
    });
  }

  assertNoUnsafePathSegments(resolvedRoot, {
    fsImpl,
    platform,
    reparsePointProbe,
  });
  assertNoUnsafePathSegments(resolved, {
    fsImpl,
    platform,
    reparsePointProbe,
  });

  const realRoot = fsImpl.realpathSync(resolvedRoot);
  const realRunDir = fsImpl.realpathSync(resolved);
  assertOutsideWorktrees(realRoot, gitWorktreeRoots);
  assertOutsideWorktrees(realRunDir, gitWorktreeRoots);
  if (
    reviewedOverride !== true
    && (
      !isPathInside(realRoot, realRunDir)
      || !pathEquals(path.dirname(realRunDir), realRoot)
    )
  ) {
    throw new R206StopError("private evidence run directory resolves outside the approved root", {
      code: "PRIVATE_EVIDENCE_PATH_ESCAPE",
    });
  }
  return realRunDir;
}

export function createR206RunId({
  now = new Date(),
  randomBytesImpl = randomBytes,
} = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new R206StopError("run-directory timestamp is invalid", {
      code: "PRIVATE_EVIDENCE_RUN_DIR_INVALID",
    });
  }
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .toLowerCase();
  const suffix = randomBytesImpl(6).toString("hex");
  return assertValidR206RunId(`r206-${timestamp}-${suffix}`);
}

export function prepareR206RunPrivateDirectory({
  repoRoot,
  approvedPrivateRoot = R206_PRIVATE_EVIDENCE_DIR,
  gitWorktreeRoots = [repoRoot],
  now = new Date(),
  randomBytesImpl = randomBytes,
  fsImpl = fs,
  platform = process.platform,
  reparsePointProbe = isWindowsReparsePoint,
} = {}) {
  const resolvedRoot = path.resolve(approvedPrivateRoot);
  let rootStatus;
  try {
    rootStatus = fsImpl.lstatSync(resolvedRoot);
  } catch {
    rootStatus = null;
  }
  if (rootStatus?.isSymbolicLink()) {
    throw new R206StopError("approved private root is a link or reparse point", {
      code: "PRIVATE_EVIDENCE_REPARSE_POINT_UNSAFE",
    });
  }
  if (!rootStatus?.isDirectory()) {
    throw new R206StopError("approved private evidence root is unavailable", {
      code: "PRIVATE_EVIDENCE_ROOT_MISMATCH",
    });
  }
  assertOutsideWorktrees(resolvedRoot, gitWorktreeRoots);
  assertNoUnsafePathSegments(resolvedRoot, {
    fsImpl,
    platform,
    reparsePointProbe,
  });
  const runId = createR206RunId({ now, randomBytesImpl });
  const privateEvidenceDir = path.join(resolvedRoot, runId);
  try {
    fsImpl.mkdirSync(privateEvidenceDir, { recursive: false, mode: 0o700 });
  } catch (cause) {
    throw new R206StopError("private evidence run directory could not be created exclusively", {
      code: cause?.code === "EEXIST"
        ? "PRIVATE_EVIDENCE_RUN_DIR_COLLISION"
        : "PRIVATE_EVIDENCE_RUN_DIR_CREATE_FAILED",
      cause,
    });
  }
  const realRunDir = assertSafePrivateEvidencePath({
    repoRoot,
    privateEvidenceDir,
    executionMode: "production",
    approvedPrivateRoot: resolvedRoot,
    gitWorktreeRoots,
    fsImpl,
    platform,
    reparsePointProbe,
  });
  return {
    ok: true,
    code: "PRIVATE_EVIDENCE_RUN_DIR_PREPARED",
    privateEvidenceDir: realRunDir,
    runId,
    networkMutationCount: 0,
    productionCredentialsRequired: false,
    releaseCloseoutApproved: false,
  };
}

export function assertAllowedRpc(name, { mutation = true } = {}) {
  const allowlist = mutation ? ALLOWED_MUTATION_RPCS : ALLOWED_READ_RPCS;
  if (!allowlist.includes(name)) {
    throw new R206StopError("RPC is not in the R2-06 allowlist", {
      code: "RPC_NOT_ALLOWLISTED",
    });
  }
  return name;
}

export function assertSyntheticEmail(email, role) {
  const expected = new RegExp(
    `^r206-smoke-${role}-[0-9]{8}t[0-9]{6}z-[a-f0-9]{32}@example\\.invalid$`,
    "i",
  );
  if (!expected.test(String(email || ""))) {
    throw new R206StopError("synthetic identity does not match the reviewed non-deliverable pattern", {
      code: "NON_SYNTHETIC_IDENTITY",
    });
  }
  return true;
}

export function createSyntheticScope(now = new Date()) {
  const compact = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").toLowerCase();
  const nonce = randomBytes(16).toString("hex");
  const prefix = `r206-smoke-${compact}-${nonce}`;
  const password = () => `R206-${randomBytes(32).toString("base64url")}!`;
  return {
    runId: randomUUID(),
    prefix,
    createdAt: now.toISOString(),
    owner: {
      alias: "owner_user",
      email: `r206-smoke-owner-${compact}-${nonce}@example.invalid`,
      password: password(),
      firstName: "R206",
      lastName: "Synthetic Owner",
    },
    challenger: {
      alias: "challenger_user",
      email: `r206-smoke-challenger-${compact}-${nonce}@example.invalid`,
      password: password(),
      firstName: "R206",
      lastName: "Synthetic Challenger",
    },
    game: {
      alias: "synthetic_game",
      id: `${prefix}-game`,
      playerId: `${prefix}-player`,
      shareCode: `R206${randomBytes(12).toString("hex").toUpperCase()}`,
      deviceId: `${prefix}-device`,
      writeA: `${prefix}-write-a`,
      writeB: `${prefix}-write-b`,
      deletionA: `${prefix}-delete-a`,
      deletionB: `${prefix}-delete-b`,
    },
  };
}

export function clearSyntheticScopeSecrets(scope) {
  if (scope?.owner) {
    scope.owner.password = null;
    scope.owner.email = null;
  }
  if (scope?.challenger) {
    scope.challenger.password = null;
    scope.challenger.email = null;
  }
}

export class HardLimitGuard {
  constructor(limits = HARD_LIMITS) {
    this.limits = { ...limits };
    this.observed = Object.fromEntries(Object.keys(limits).map((key) => [key, 0]));
  }

  add(name, amount = 1) {
    if (!Object.hasOwn(this.limits, name)) {
      throw new R206StopError("unknown mutation counter", { code: "UNKNOWN_MUTATION_COUNTER" });
    }
    if (!Number.isInteger(amount) || amount < 0) {
      throw new R206StopError("mutation counter amount must be a nonnegative integer", {
        code: "INVALID_MUTATION_COUNTER",
      });
    }
    const next = this.observed[name] + amount;
    if (next > this.limits[name]) {
      throw new R206StopError(`hard mutation limit exceeded: ${name}`, {
        code: "HARD_MUTATION_LIMIT_EXCEEDED",
      });
    }
    this.observed[name] = next;
    return next;
  }

  assertFinal() {
    for (const [name, maximum] of Object.entries(this.limits)) {
      if (this.observed[name] !== maximum) {
        throw new R206StopError(`final mutation count mismatch: ${name}`, {
          code: "FINAL_MUTATION_COUNT_MISMATCH",
        });
      }
    }
    return { ...this.observed };
  }
}

const safeEvidence = (evidence) => {
  if (evidence == null) return null;
  if (Array.isArray(evidence)) return evidence.map(safeEvidence);
  if (typeof evidence !== "object") return evidence;
  return Object.fromEntries(
    Object.entries(evidence)
      .filter(([key]) => !/password|token|authorization|api[_-]?key|secret|email|uuid|exact/i.test(key))
      .map(([key, value]) => [key, safeEvidence(value)]),
  );
};

export class ExecutionStateMachine {
  constructor({ persist = async () => {} } = {}) {
    this.phase = "initialized";
    this.cleanupOnly = false;
    this.terminal = false;
    this.history = [{
      phase: "initialized",
      at: new Date().toISOString(),
      evidence: { status: "created" },
    }];
    this.persist = persist;
  }

  async advance(next, evidence = {}) {
    if (this.terminal || this.cleanupOnly) {
      throw new R206StopError("normal execution cannot continue from terminal or cleanup-only state", {
        code: "INVALID_STATE_TRANSITION",
      });
    }
    const currentIndex = NORMAL_PHASES.indexOf(this.phase);
    const expected = NORMAL_PHASES[currentIndex + 1];
    if (next !== expected) {
      throw new R206StopError(`state transition must advance from ${this.phase} to ${expected}`, {
        code: "INVALID_STATE_TRANSITION",
      });
    }
    this.phase = next;
    this.terminal = next === "completed";
    this.history.push({
      phase: next,
      at: new Date().toISOString(),
      evidence: safeEvidence(evidence),
    });
    await this.persist(this.snapshot());
    return this.phase;
  }

  async enterCleanupOnly(reason) {
    if (this.terminal || this.cleanupOnly) {
      throw new R206StopError("cleanup-only mode cannot be entered from the current state", {
        code: "INVALID_STATE_TRANSITION",
      });
    }
    this.cleanupOnly = true;
    this.history.push({
      phase: "cleanup_only",
      at: new Date().toISOString(),
      evidence: { reasonCode: reason?.code || "R206_STOP_CONDITION" },
    });
    await this.persist(this.snapshot());
  }

  async finishFailure({ cleanupComplete, error }) {
    if (!this.cleanupOnly) {
      throw new R206StopError("failure completion requires cleanup-only mode", {
        code: "INVALID_STATE_TRANSITION",
      });
    }
    this.phase = "failed";
    this.terminal = true;
    this.history.push({
      phase: "failed",
      at: new Date().toISOString(),
      evidence: {
        cleanupComplete: cleanupComplete === true,
        errorCode: error?.code || "R206_STOP_CONDITION",
      },
    });
    await this.persist(this.snapshot());
  }

  async block(error) {
    if (this.terminal || this.cleanupOnly) {
      throw new R206StopError("blocked state is unavailable after cleanup starts", {
        code: "INVALID_STATE_TRANSITION",
      });
    }
    this.phase = "blocked";
    this.terminal = true;
    this.history.push({
      phase: "blocked",
      at: new Date().toISOString(),
      evidence: { errorCode: error?.code || "R206_STOP_CONDITION" },
    });
    await this.persist(this.snapshot());
  }

  snapshot() {
    return {
      schemaVersion: 1,
      phase: this.phase,
      cleanupOnly: this.cleanupOnly,
      terminal: this.terminal,
      history: this.history.map((entry) => ({ ...entry, evidence: safeEvidence(entry.evidence) })),
    };
  }
}

export class CleanupLedger {
  constructor(scope) {
    this.runId = scope.runId;
    this.createdAt = scope.createdAt;
    this.users = new Map();
    this.profiles = new Map();
    this.sessions = new Map();
    this.game = {
      alias: "synthetic_game",
      id: scope.game.id,
      deviceId: scope.game.deviceId,
      savedAtT1: null,
      savedAtT2: null,
      deleted: false,
    };
    this.deletions = {
      deletion_a: scope.game.deletionA,
      deletion_b: scope.game.deletionB,
    };
    this.tombstone = null;
    this.browserProfiles = new Set();
    this.publicEvidencePayloadBindings = null;
    this.privateEvidencePath = null;
    this.publicEvidencePaths = [];
  }

  recordUser(alias, { id }) {
    if (!["owner_user", "challenger_user"].includes(alias) || this.users.has(alias)) {
      throw new R206StopError("cleanup ledger rejected user ownership", {
        code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
      });
    }
    assert.match(String(id || ""), /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
    this.users.set(alias, { id, deleted: false });
    this.profiles.set(alias, { id, removed: false });
  }

  recordSession(alias, { userAlias, sessionId, accessToken, refreshToken, accountId = null }) {
    if (
      !["owner_initial", "challenger_initial", "owner_hydration"].includes(alias)
      || this.sessions.has(alias)
      || !this.users.has(userAlias)
    ) {
      throw new R206StopError("cleanup ledger rejected session ownership", {
        code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
      });
    }
    this.sessions.set(alias, {
      userAlias,
      sessionId,
      accessToken,
      refreshToken,
      accountId,
      revoked: false,
    });
  }

  markSessionRevoked(alias) {
    const session = this.sessions.get(alias);
    if (!session) {
      throw new R206StopError("cleanup attempted an unknown session", {
        code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
      });
    }
    session.revoked = true;
  }

  markUserDeleted(alias) {
    const user = this.users.get(alias);
    if (!user) {
      throw new R206StopError("cleanup attempted an unknown user", {
        code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
      });
    }
    user.deleted = true;
  }

  markProfileRemoved(alias) {
    const profile = this.profiles.get(alias);
    if (!profile) {
      throw new R206StopError("cleanup attempted an unknown profile", {
        code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
      });
    }
    profile.removed = true;
  }

  addBrowserProfile(profilePath) {
    this.browserProfiles.add(path.resolve(profilePath));
  }

  recordPublicEvidencePayloadBindings(bindings) {
    if (this.publicEvidencePayloadBindings) {
      throw new R206StopError("public evidence payload bindings were already recorded", {
        code: "PRIVATE_IDENTIFIER_RECORD_LIMIT_EXCEEDED",
      });
    }
    this.publicEvidencePayloadBindings = { ...bindings };
  }

  markGameDeleted(details = {}) {
    const normalized = typeof details === "string" ? { gameId: details } : details;
    this.game.deleted = true;
    this.tombstone = {
      alias: "retained_tombstone",
      identity: normalized.gameId || this.game.id,
      deletionId: normalized.deletionId || this.deletions.deletion_a,
      deviceId: normalized.deviceId || this.game.deviceId,
      deletedAt: normalized.deletedAt || null,
    };
  }

  exactIdentifiers() {
    return [
      ...[...this.users.values()].map((item) => item.id),
      ...[...this.sessions.values()].map((item) => item.sessionId),
      this.game.id,
      this.game.deviceId,
      this.deletions.deletion_a,
      this.deletions.deletion_b,
      this.tombstone?.identity,
    ].filter(Boolean);
  }

  privateSnapshot(state) {
    return {
      schemaVersion: 1,
      runId: this.runId,
      createdAt: this.createdAt,
      projectRef: R206_PROJECT_REF,
      runtimeSourceSha: R206_RUNTIME_SHA,
      state,
      users: Object.fromEntries(
        [...this.users].map(([alias, value]) => [alias, { id: value.id, deleted: value.deleted }]),
      ),
      profiles: Object.fromEntries(
        [...this.profiles].map(([alias, value]) => [alias, { id: value.id, removed: value.removed }]),
      ),
      sessions: Object.fromEntries(
        [...this.sessions].map(([alias, value]) => [
          alias,
          {
            userAlias: value.userAlias,
            sessionId: value.sessionId,
            accountId: value.accountId,
            revoked: value.revoked,
          },
        ]),
      ),
      game: { ...this.game },
      deletions: { ...this.deletions },
      tombstone: this.tombstone ? { ...this.tombstone } : null,
      browserProfileLocations: [...this.browserProfiles],
      publicEvidencePayloadBindings: this.publicEvidencePayloadBindings
        ? { ...this.publicEvidencePayloadBindings }
        : null,
      publicEvidencePaths: [...this.publicEvidencePaths],
    };
  }

  publicSnapshot() {
    return {
      users: [...this.users.keys()],
      profiles: [...this.profiles.keys()],
      sessions: [...this.sessions.keys()],
      game: this.game.alias,
      deletions: Object.keys(this.deletions),
      tombstone: this.tombstone?.alias || null,
      browserProfileCount: this.browserProfiles.size,
    };
  }

  destroySecrets() {
    for (const session of this.sessions.values()) {
      session.accessToken = null;
      session.refreshToken = null;
    }
  }
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const SECRET_PATTERN =
  /(?:eyJ[a-zA-Z0-9_-]{20,}|sb_(?:secret|publishable)_[a-zA-Z0-9_-]{12,}|access[_-]?token|refresh[_-]?token|authorization\s*[:=]\s*bearer|bearer\s+[a-z0-9._-]+|password|api[_-]?key|service[_-]?role)/i;

export function assertPublicEvidenceSafe(value, exactIdentifiers = []) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (EMAIL_PATTERN.test(serialized)) {
    throw new R206StopError("public evidence contains an email address", {
      code: "PUBLIC_EVIDENCE_IDENTIFIER_EXPOSURE",
    });
  }
  if (UUID_PATTERN.test(serialized)) {
    throw new R206StopError("public evidence contains a UUID", {
      code: "PUBLIC_EVIDENCE_IDENTIFIER_EXPOSURE",
    });
  }
  if (SECRET_PATTERN.test(serialized)) {
    throw new R206StopError("public evidence contains a credential or credential field", {
      code: "CREDENTIAL_EXPOSURE_DETECTED",
    });
  }
  for (const identifier of exactIdentifiers.filter(Boolean)) {
    if (serialized.includes(identifier)) {
      throw new R206StopError("public evidence contains an exact private identifier", {
        code: "PUBLIC_EVIDENCE_IDENTIFIER_EXPOSURE",
      });
    }
  }
  return true;
}

export function createPublicEvidenceBundle({
  status,
  targetRef,
  privateLedgerSha256,
  privateEvidenceReference,
  operationResults,
  cleanupResults,
  stateHistory,
  counts,
  exactIdentifiers = [],
}) {
  const base = {
    schemaVersion: 1,
    status,
    projectAlias: "production_project",
    runtimeSourceSha: R206_RUNTIME_SHA,
    runnerTargetRef: targetRef,
    privateEvidenceReference,
    privateLedgerSha256,
  };
  const authorization = {
    ...base,
    evidenceType: "authorization",
    actionCount: ACTION_PLAN.length,
    hardLimits: { ...HARD_LIMITS },
    productionExecutionDefault: "disabled",
    finalCloseoutApproval: false,
  };
  const operations = {
    ...base,
    evidenceType: "operation_results",
    results: operationResults,
    finalPhase: stateHistory.at(-1)?.phase || "unknown",
    stateTransitions: stateHistory.map((entry) => ({
      phase: entry.phase,
      at: entry.at,
      evidence: safeEvidence(entry.evidence),
    })),
  };
  const cleanup = {
    ...base,
    evidenceType: "cleanup_results",
    results: cleanupResults,
    aggregateCounts: counts,
    retainedTombstones: counts?.tombstones ?? null,
    releaseCloseoutApproved: false,
  };
  for (const evidence of [authorization, operations, cleanup]) {
    assertPublicEvidenceSafe(evidence, exactIdentifiers);
  }
  return { authorization, operations, cleanup };
}

export function createPublicEvidencePayloadBindings(bundle) {
  return Object.fromEntries(
    Object.entries(bundle).map(([name, value]) => {
      const canonical = structuredClone(value);
      delete canonical.privateEvidenceReference;
      delete canonical.privateLedgerSha256;
      return [name, sha256(JSON.stringify(canonical))];
    }),
  );
}

export function assertClassifiedResponse(result, { outcome, code }) {
  if (!result || typeof result !== "object") {
    throw new R206StopError("operation returned no classified result", {
      code: "UNCLASSIFIED_RESPONSE",
    });
  }
  if (result.outcome !== outcome || result.code !== code) {
    throw new R206StopError(`unexpected classified result; expected ${outcome} / ${code}`, {
      code: "UNCLASSIFIED_RESPONSE",
    });
  }
  return result;
}

export function assertZeroCount(value, label) {
  if (!Number.isInteger(value) || value !== 0) {
    throw new R206StopError(`${label} must be an explicit integer zero`, {
      code: "NONZERO_OR_UNTYPED_COUNT",
    });
  }
  return true;
}

export function assertExactCount(value, expected, label) {
  if (!Number.isInteger(value) || value !== expected) {
    throw new R206StopError(`${label} must equal ${expected}`, {
      code: "COUNT_MISMATCH",
    });
  }
  return true;
}

export function validatePreflightResult(result) {
  const expectedIdentity = {
    projectRef: R206_PROJECT_REF,
    apiUrl: R206_API_URL,
    applicationOrigin: R206_APPLICATION_ORIGIN,
    runtimeSourceSha: R206_RUNTIME_SHA,
    pagesRunId: R206_PAGES_RUN_ID,
    releaseMarker: R206_RELEASE_MARKER,
    cacheName: R206_CACHE_NAME,
  };
  for (const [key, expected] of Object.entries(expectedIdentity)) {
    if (result?.[key] !== expected) {
      throw new R206StopError(`preflight identity mismatch: ${key}`, {
        code: "PROJECT_OR_RUNTIME_IDENTITY_MISMATCH",
      });
    }
  }
  if (JSON.stringify(result.migrationVersions) !== JSON.stringify(R206_MIGRATION_VERSIONS)) {
    throw new R206StopError("migration state differs from the reviewed R2-06 sequence", {
      code: "MIGRATION_DRIFT",
    });
  }
  for (const key of [
    "catalogMatches",
    "rlsMatches",
    "grantsMatch",
    "rpcsMatch",
    "triggerMatches",
    "lockOrderingMatches",
  ]) {
    if (result[key] !== true) {
      throw new R206StopError(`preflight catalog gate failed: ${key}`, {
        code: "CATALOG_DRIFT",
      });
    }
  }
  assertZeroCount(result.unexpectedMigrations, "unexpected migrations");
  assertZeroCount(result.pendingMigrations, "pending migrations");
  assertZeroCount(result.startingTombstones, "starting tombstones");
  for (const [key, value] of Object.entries(result.startingResidue || {})) {
    assertZeroCount(value, `starting residue ${key}`);
  }
  const residueKeys = [
    "authUsers",
    "profiles",
    "sessions",
    "games",
    "events",
    "tombstones",
    "liveShareTokens",
  ];
  if (JSON.stringify(Object.keys(result.startingResidue || {}).sort()) !== JSON.stringify(residueKeys.sort())) {
    throw new R206StopError("preflight residue evidence is incomplete", {
      code: "PREFLIGHT_RESIDUE_EVIDENCE_INCOMPLETE",
    });
  }
  return true;
}

function gameRow(scope, ownerId, savedAt, opponentSuffix) {
  return {
    id: scope.game.id,
    player_id: scope.game.playerId,
    user_id: ownerId,
    share_code: scope.game.shareCode,
    is_shared: false,
    opponent: `r206-smoke-${opponentSuffix}`,
    game_date: savedAt.slice(0, 10),
    location: "SYNTHETIC",
    game_type: "synthetic-verification",
    period_format: "quarters",
    player_snapshot: {
      id: scope.game.playerId,
      name: "R206 Synthetic Adult",
      number: "00",
      position: "SYNTHETIC",
    },
    current_quarter: "Q1",
    status: "in-progress",
    created_at: scope.createdAt,
    saved_at: savedAt,
    ended_at: null,
    team_id: null,
    roster_player_id: null,
  };
}

function sameTimestamp(actual, expected) {
  const actualTime = Date.parse(actual);
  const expectedTime = Date.parse(expected);
  return Number.isFinite(actualTime) && actualTime === expectedTime;
}

function deletionPayload(scope, ownerId, deletionId, knownSavedAt, deletedAt) {
  return {
    game_id: scope.game.id,
    account_id: ownerId,
    deletion_id: deletionId,
    device_id: scope.game.deviceId,
    deleted_at: deletedAt,
    known_game_saved_at: knownSavedAt,
  };
}

async function persistCheckpoint(adapter, ledger, machine, limits) {
  if (!adapter.persistPrivateLedger || ledger.users.size === 0) return null;
  const snapshot = ledger.privateSnapshot(machine.snapshot());
  const result = await adapter.persistPrivateLedger(snapshot);
  if (!ledger.privateEvidencePath) {
    limits.add("privateIdentifierRecords", 1);
    ledger.privateEvidencePath = result.path;
  } else if (path.resolve(result.path) !== path.resolve(ledger.privateEvidencePath)) {
    throw new R206StopError("private checkpoint created more than one identifier record", {
      code: "PRIVATE_IDENTIFIER_RECORD_LIMIT_EXCEEDED",
    });
  }
  return result;
}

export async function cleanupAfterFailure({ adapter, ledger, machine, limits }) {
  const cleanupErrors = [];
  let residueCounts = null;
  const attempt = async (operation) => {
    try {
      await operation();
    } catch (error) {
      cleanupErrors.push(error);
    }
  };

  if (!ledger.game.deleted && adapter.cleanupGameViaReviewedRpc && ledger.users.has("owner_user")) {
    await attempt(async () => {
      const result = await adapter.cleanupGameViaReviewedRpc({
        ledger,
      });
      if (result?.outcome === "accepted" && ["game_deleted", "game_delete_replayed"].includes(result.code)) {
        if (result.code === "game_deleted") {
          limits.add("acceptedDurableDeletes", 1);
          limits.add("permanentTombstonesCreated", 1);
        }
        ledger.markGameDeleted({
          gameId: result.gameId || ledger.game.id,
          deletionId: ledger.deletions.deletion_a,
          deletedAt: result.deletedAt || null,
        });
      } else if (result?.code !== "game_not_found") {
        throw new R206StopError("reviewed cleanup RPC did not classify game cleanup safely", {
          code: "CLEANUP_GAME_RPC_FAILED",
        });
      }
    });
  }

  for (const [alias, session] of [...ledger.sessions].reverse()) {
    if (!session.revoked) {
      await attempt(async () => {
        await adapter.revokeSession(alias, session);
        ledger.markSessionRevoked(alias);
        const authorityRevoked = await adapter.verifyRevokedAuthority(alias, session, ledger);
        if (authorityRevoked !== true) {
          throw new R206StopError("cleanup could not prove revoked application authority", {
            code: "SESSION_REVOCATION_INCOMPLETE",
          });
        }
      });
    }
  }

  for (const [alias, user] of [...ledger.users].reverse()) {
    if (!user.deleted) {
      await attempt(async () => {
        await adapter.deleteSyntheticUser(alias, user);
        ledger.markUserDeleted(alias);
      });
    }
  }

  await attempt(async () => {
    const removed = await adapter.verifyProfilesRemoved(ledger);
    for (const alias of removed) ledger.markProfileRemoved(alias);
  });

  for (const profilePath of ledger.browserProfiles) {
    await attempt(() => adapter.clearBrowserProfile(profilePath));
  }

  let cleanupComplete = false;
  await attempt(async () => {
    const counts = await adapter.finalCounts(ledger);
    residueCounts = counts;
    for (const key of [
      "authUsers",
      "profiles",
      "sessions",
      "games",
      "events",
      "liveShareTokens",
    ]) {
      assertZeroCount(counts[key], `cleanup ${key}`);
    }
    if (ledger.game.deleted) assertExactCount(counts.tombstones, 1, "cleanup tombstones");
    cleanupComplete = true;
  });

  await persistCheckpoint(adapter, ledger, machine, limits).catch((error) => cleanupErrors.push(error));
  return {
    cleanupComplete: cleanupComplete && cleanupErrors.length === 0,
    cleanupErrors,
    residueCounts,
  };
}

export async function executeSyntheticVerification({
  adapter,
  config,
  logger = () => {},
  now = () => new Date(),
}) {
  assert.ok(adapter && typeof adapter === "object", "adapter is required");
  const scope = createSyntheticScope(now());
  assertSyntheticEmail(scope.owner.email, "owner");
  assertSyntheticEmail(scope.challenger.email, "challenger");
  const ledger = new CleanupLedger(scope);
  const limits = new HardLimitGuard();
  let mutationStarted = false;
  let checkpointFrozen = false;
  let privateLedger = null;
  const operationResults = [];
  let cleanupResults = null;
  let currentOperation = "preflight";
  let authorizationConsumed = false;
  let executionStartedAt = null;
  const completedActions = new Set();
  const completeAction = (action) => completedActions.add(action);

  const machine = new ExecutionStateMachine({
    persist: async () => {
      if (mutationStarted && !checkpointFrozen) {
        privateLedger = await persistCheckpoint(adapter, ledger, machine, limits);
      }
    },
  });

  const record = (action, result) => {
    const entry = {
      action,
      outcome: result?.outcome || "verified",
      code: result?.code || "verified",
    };
    if (action === "clean_session_hydration") {
      entry.hydrationVerification = {
        rawPersistenceGameVisible: result?.rawPersistenceGameVisible === true,
        applicationStateGameVisible: result?.applicationStateGameVisible === true,
        renderedGameVisible: result?.renderedGameVisible === true,
        tombstoneBeforeMerge: result?.tombstoneBeforeMerge === true,
        tombstoneSuppressionComplete: result?.tombstoneSuppressionComplete === true,
        resurrectionWriteRequests: Number(result?.resurrectionWriteRequests || 0),
        retryStorm: result?.retryStorm === true,
      };
    }
    operationResults.push(entry);
    logger({ action, status: "verified" });
  };

  try {
    const preflight = await adapter.preflight(config);
    validatePreflightResult(preflight);
    await machine.advance("preflight_verified", { gates: "all_verified" });
    currentOperation = "authorization_consumption";
    executionStartedAt = now().toISOString();
    if (adapter.recordExecutionState) {
      await adapter.recordExecutionState({
        executionStartedAt,
        mutationStarted: false,
        terminalOutcome: "execution_started",
        cleanupCompleted: false,
      });
      authorizationConsumed = config.executionMode === "production";
    }
    await machine.advance("credentials_available", { source: config.credentialSource || "disposable" });

    currentOperation = "authorization_consumption_before_first_mutation";
    if (adapter.recordExecutionState) {
      await adapter.recordExecutionState({
        executionStartedAt,
        mutationStarted: true,
        terminalOutcome: "running",
        cleanupCompleted: false,
      });
    }
    mutationStarted = true;
    currentOperation = "create_owner_user";
    const owner = await adapter.createSyntheticUser("owner_user", scope.owner);
    limits.add("authUsersCreated", 1);
    ledger.recordUser("owner_user", owner);
    completeAction("create_owner_user");
    currentOperation = "create_challenger_user";
    const challenger = await adapter.createSyntheticUser("challenger_user", scope.challenger);
    limits.add("authUsersCreated", 1);
    ledger.recordUser("challenger_user", challenger);
    completeAction("create_challenger_user");
    currentOperation = "verify_profiles";
    const profiles = await adapter.verifyProfiles(ledger);
    assertExactCount(profiles, 2, "automatic profiles");
    limits.add("profilesExpected", profiles);
    completeAction("verify_profiles");
    await machine.advance("users_created", { users: 2, profiles });

    currentOperation = "establish_sessions";
    const ownerInitial = await adapter.signInSyntheticUser("owner_initial", scope.owner, {
      expectedPrincipalId: ledger.users.get("owner_user").id,
    });
    limits.add("sessionsCreated", 1);
    ledger.recordSession("owner_initial", { userAlias: "owner_user", ...ownerInitial });
    const challengerInitial = await adapter.signInSyntheticUser(
      "challenger_initial",
      scope.challenger,
      { expectedPrincipalId: ledger.users.get("challenger_user").id },
    );
    limits.add("sessionsCreated", 1);
    ledger.recordSession("challenger_initial", {
      userAlias: "challenger_user",
      ...challengerInitial,
    });
    if (challengerInitial.browserProfilePath) {
      ledger.addBrowserProfile(challengerInitial.browserProfilePath);
    }
    scope.challenger.password = null;
    scope.challenger.email = null;
    completeAction("establish_sessions");
    await machine.advance("initial_sessions_established", {
      sessions: 2,
      challengerBrowserSession: challengerInitial.browserSessionEvidence || null,
    });

    currentOperation = "guarded_create";
    const t1 = new Date(now().getTime() + 1_000).toISOString();
    const createResult = await adapter.guardedCreate({
      session: ledger.sessions.get("owner_initial"),
      operation: {
        operation_id: scope.game.writeA,
        device_id: scope.game.deviceId,
        payload_revision: 1,
        game_row: gameRow(scope, owner.id, t1, "create"),
      },
      ledger,
    });
    assertClassifiedResponse(createResult, {
      outcome: "accepted",
      code: "legacy_game_write_accepted",
    });
    if (
      createResult.gameId !== scope.game.id
      || createResult.payloadRevision !== 1
      || !sameTimestamp(createResult.savedAt, t1)
    ) {
      throw new R206StopError("guarded create acknowledgment identity mismatch", {
        code: "CREATE_ACKNOWLEDGMENT_MISMATCH",
      });
    }
    limits.add("gamesCreated", 1);
    ledger.game.savedAtT1 = t1;
    completeAction("guarded_create");
    completeAction("prohibit_events");
    record("guarded_create", createResult);
    await machine.advance("game_created", { games: 1, events: 0, liveShareTokens: 0 });

    currentOperation = "verify_denials";
    const denialResult = await adapter.verifyDenials({
      ownerSession: ledger.sessions.get("owner_initial"),
      challengerSession: ledger.sessions.get("challenger_initial"),
      ledger,
      scope,
    });
    if (denialResult?.unauthorizedSuccess !== false || denialResult?.disclosure !== false) {
      throw new R206StopError("authorization or disclosure denial probe succeeded unexpectedly", {
        code: "UNAUTHORIZED_SUCCESS",
      });
    }
    assertClassifiedResponse(denialResult, {
      outcome: "verified",
      code: "authorization_denials_verified",
    });
    completeAction("verify_denials");
    record("authorization_denials", denialResult);
    await machine.advance("denials_verified", { unauthorizedSuccesses: 0 });

    currentOperation = "guarded_update";
    const t2 = new Date(now().getTime() + 2_000).toISOString();
    const updateResult = await adapter.guardedUpdate({
      session: ledger.sessions.get("owner_initial"),
      operation: {
        operation_id: scope.game.writeB,
        device_id: scope.game.deviceId,
        payload_revision: 2,
        game_row: gameRow(scope, owner.id, t2, "update"),
      },
      ledger,
    });
    assertClassifiedResponse(updateResult, {
      outcome: "accepted",
      code: "legacy_game_write_accepted",
    });
    if (
      updateResult.gameId !== scope.game.id
      || updateResult.payloadRevision !== 2
      || !sameTimestamp(updateResult.savedAt, t2)
    ) {
      throw new R206StopError("guarded update acknowledgment identity mismatch", {
        code: "UPDATE_ACKNOWLEDGMENT_MISMATCH",
      });
    }
    limits.add("gameUpdates", 1);
    ledger.game.savedAtT2 = t2;
    completeAction("guarded_update");
    record("guarded_update", updateResult);
    await machine.advance("game_updated", { updates: 1 });

    currentOperation = "stale_delete";
    const deletedAt = new Date(now().getTime() + 3_000).toISOString();
    const staleDelete = await adapter.durableDelete({
      session: ledger.sessions.get("owner_initial"),
      deletion: deletionPayload(scope, owner.id, scope.game.deletionA, t1, deletedAt),
      ledger,
    });
    assertClassifiedResponse(staleDelete, {
      outcome: "conflicted",
      code: "newer_game_revision",
    });
    completeAction("stale_delete");
    record("stale_delete", staleDelete);
    await machine.advance("stale_delete_verified", { mutations: 0 });

    currentOperation = "durable_delete";
    const durableDelete = await adapter.durableDelete({
      session: ledger.sessions.get("owner_initial"),
      deletion: deletionPayload(scope, owner.id, scope.game.deletionA, t2, deletedAt),
      ledger,
    });
    assertClassifiedResponse(durableDelete, {
      outcome: "accepted",
      code: "game_deleted",
    });
    if (durableDelete.gameId !== scope.game.id || durableDelete.deletionId !== scope.game.deletionA) {
      throw new R206StopError("durable delete acknowledgment identity mismatch", {
        code: "DELETE_ACKNOWLEDGMENT_MISMATCH",
      });
    }
    limits.add("acceptedDurableDeletes", 1);
    limits.add("permanentTombstonesCreated", 1);
    ledger.markGameDeleted({
      gameId: durableDelete.gameId,
      deletionId: durableDelete.deletionId,
      deviceId: scope.game.deviceId,
      deletedAt: durableDelete.deletedAt,
    });
    completeAction("durable_delete");
    record("durable_delete", durableDelete);
    await machine.advance("durable_delete_verified", { tombstoneDelta: 1 });

    currentOperation = "same_id_replay";
    const replay = await adapter.durableDelete({
      session: ledger.sessions.get("owner_initial"),
      deletion: deletionPayload(scope, owner.id, scope.game.deletionA, t2, deletedAt),
      ledger,
    });
    assertClassifiedResponse(replay, {
      outcome: "accepted",
      code: "game_delete_replayed",
    });
    completeAction("same_id_replay");
    record("same_id_replay", replay);
    await machine.advance("replay_verified", { tombstones: 1 });

    currentOperation = "different_id_conflict";
    const differentId = await adapter.durableDelete({
      session: ledger.sessions.get("owner_initial"),
      deletion: deletionPayload(scope, owner.id, scope.game.deletionB, t2, deletedAt),
      ledger,
    });
    assertClassifiedResponse(differentId, {
      outcome: "conflicted",
      code: "game_already_deleted",
    });
    completeAction("different_id_conflict");
    record("different_id_conflict", differentId);
    await machine.advance("different_id_conflict_verified", { mutations: 0 });

    currentOperation = "stale_write";
    const staleWrite = await adapter.guardedUpdate({
      session: ledger.sessions.get("owner_initial"),
      operation: {
        operation_id: `${scope.game.writeB}-stale`,
        device_id: scope.game.deviceId,
        payload_revision: 2,
        game_row: gameRow(scope, owner.id, t2, "stale"),
      },
      ledger,
    });
    assertClassifiedResponse(staleWrite, {
      outcome: "conflicted",
      code: "game_deleted",
    });
    completeAction("stale_write");
    record("stale_write", staleWrite);
    await machine.advance("stale_write_verified", { resurrections: 0 });

    currentOperation = "clean_session_hydration";
    await adapter.revokeSession("owner_initial", ledger.sessions.get("owner_initial"));
    ledger.markSessionRevoked("owner_initial");
    const ownerHydration = await adapter.signInSyntheticUser("owner_hydration", scope.owner, {
      expectedPrincipalId: ledger.users.get("owner_user").id,
    });
    limits.add("sessionsCreated", 1);
    ledger.recordSession("owner_hydration", { userAlias: "owner_user", ...ownerHydration });
    if (ownerHydration.browserProfilePath) {
      ledger.addBrowserProfile(ownerHydration.browserProfilePath);
    }
    scope.owner.password = null;
    scope.owner.email = null;
    await machine.advance("hydration_session_established", {
      sessionsCreated: 3,
      ownerBrowserSession: ownerHydration.browserSessionEvidence || null,
    });

    const hydration = await adapter.verifyHydration({
      session: ledger.sessions.get("owner_hydration"),
      ledger,
      scope,
      config,
    });
    if (
      hydration?.gameVisible !== false
      || hydration?.rawPersistenceGameVisible !== false
      || hydration?.applicationStateGameVisible !== false
      || hydration?.renderedGameVisible !== false
      || hydration?.tombstoneBeforeMerge !== true
      || hydration?.tombstoneSuppressionComplete !== true
      || hydration?.resurrectionWriteRequests !== 0
      || hydration?.retryStorm !== false
      || hydration?.applicationConsoleErrors !== 0
    ) {
      throw new R206StopError("clean-session hydration did not suppress the tombstoned game", {
        code: "HYDRATION_REVEALED_GAME",
      });
    }
    assertClassifiedResponse(hydration, {
      outcome: "verified",
      code: "clean_hydration_verified",
    });
    if (hydration.browserProfilePath) ledger.addBrowserProfile(hydration.browserProfilePath);
    completeAction("clean_session_hydration");
    record("clean_session_hydration", hydration);
    await machine.advance("hydration_verified", {
      gameVisible: false,
      tombstoneBeforeMerge: true,
      retryStorm: false,
    });

    currentOperation = "verify_disclosure_absent";
    const disclosure = await adapter.verifyDisclosure({
      challengerSession: ledger.sessions.get("challenger_initial"),
      ledger,
      scope,
      config,
    });
    if (disclosure?.disclosed !== false || disclosure?.liveShareTokens !== 0) {
      throw new R206StopError("synthetic scope appeared in a public or unauthorized disclosure path", {
        code: "SYNTHETIC_DISCLOSURE_DETECTED",
      });
    }
    assertClassifiedResponse(disclosure, {
      outcome: "verified",
      code: "disclosure_absent",
    });
    completeAction("verify_disclosure_absent");
    record("disclosure", disclosure);
    await machine.advance("disclosure_verified", { disclosed: false, liveShareTokens: 0 });

    currentOperation = "write_private_ledger";
    privateLedger = await persistCheckpoint(adapter, ledger, machine, limits);
    if (!privateLedger?.path || !/^[a-f0-9]{64}$/.test(privateLedger.sha256 || "")) {
      throw new R206StopError("private ledger was not written and hash-bound", {
        code: "PRIVATE_LEDGER_WRITE_FAILED",
      });
    }
    completeAction("write_private_ledger");
    await machine.advance("private_ledger_written", { recordCount: 1 });

    currentOperation = "revoke_sessions";
    for (const [alias, session] of ledger.sessions) {
      if (!session.revoked) {
        await adapter.revokeSession(alias, session);
        ledger.markSessionRevoked(alias);
      }
    }
    for (const [alias, session] of ledger.sessions) {
      const authorityRevoked = await adapter.verifyRevokedAuthority(alias, session, ledger);
      if (authorityRevoked !== true) {
        throw new R206StopError("session revocation was not proven", {
          code: "SESSION_REVOCATION_INCOMPLETE",
        });
      }
    }
    completeAction("revoke_sessions");
    await machine.advance("sessions_revoked", { sessions: 3 });

    currentOperation = "delete_users";
    for (const alias of ["challenger_user", "owner_user"]) {
      const user = ledger.users.get(alias);
      await adapter.deleteSyntheticUser(alias, user);
      ledger.markUserDeleted(alias);
    }
    completeAction("delete_users");
    await machine.advance("users_deleted", { users: 2 });

    currentOperation = "verify_profile_cascade";
    const removedProfiles = await adapter.verifyProfilesRemoved(ledger);
    assert.deepEqual([...removedProfiles].sort(), ["challenger_user", "owner_user"]);
    for (const alias of removedProfiles) ledger.markProfileRemoved(alias);
    completeAction("verify_profile_cascade");
    await machine.advance("profiles_removed", { profiles: 2 });

    currentOperation = "clear_browser_state";
    for (const profilePath of ledger.browserProfiles) {
      await adapter.clearBrowserProfile(profilePath);
    }
    completeAction("clear_browser_state");
    await machine.advance("browser_state_cleared", {
      browserProfiles: ledger.browserProfiles.size,
    });

    currentOperation = "verify_final_residue";
    const finalCounts = await adapter.finalCounts(ledger);
    for (const key of [
      "authUsers",
      "profiles",
      "sessions",
      "games",
      "events",
      "liveShareTokens",
    ]) {
      assertZeroCount(finalCounts[key], `final ${key}`);
    }
    assertExactCount(finalCounts.tombstones, 1, "final tombstones");
    limits.add("eventsCreated", finalCounts.events);
    limits.add("liveShareTokensCreated", finalCounts.liveShareTokens);
    const finalMutationCounts = limits.assertFinal();
    await machine.advance("mutable_residue_zero", {
      mutableResidue: 0,
      retainedTombstones: 1,
    });
    cleanupResults = {
      sessionsRevoked: 3,
      usersDeleted: 2,
      profilesRemoved: 2,
      mutableResidue: 0,
      retainedTombstones: 1,
      browserProfilesCleared: ledger.browserProfiles.size,
    };
    const provisionalEvidenceBundle = createPublicEvidenceBundle({
      status: config.executionMode === "disposable"
        ? "disposable_verification_complete_not_production_evidence"
        : "verification_complete_release_closeout_review_required",
      targetRef: config.targetRef,
      privateLedgerSha256: "0".repeat(64),
      privateEvidenceReference: "r206-private-0000000000000000",
      operationResults,
      cleanupResults,
      stateHistory: machine.history,
      counts: finalCounts,
      exactIdentifiers: ledger.exactIdentifiers(),
    });
    ledger.recordPublicEvidencePayloadBindings(
      createPublicEvidencePayloadBindings(provisionalEvidenceBundle),
    );
    privateLedger = await persistCheckpoint(adapter, ledger, machine, limits);
    checkpointFrozen = true;
    const evidenceBundle = createPublicEvidenceBundle({
      status: config.executionMode === "disposable"
        ? "disposable_verification_complete_not_production_evidence"
        : "verification_complete_release_closeout_review_required",
      targetRef: config.targetRef,
      privateLedgerSha256: privateLedger.sha256,
      privateEvidenceReference: privateLedger.opaqueReference,
      operationResults,
      cleanupResults,
      stateHistory: machine.history,
      counts: finalCounts,
      exactIdentifiers: ledger.exactIdentifiers(),
    });
    currentOperation = "write_public_evidence";
    const publicEvidence = await adapter.writePublicEvidence(evidenceBundle);
    ledger.publicEvidencePaths = [...publicEvidence.paths];
    completeAction("write_public_evidence");
    await machine.advance("evidence_written", { publicEvidenceFiles: publicEvidence.paths.length });
    await machine.advance("completed", { releaseCloseoutApproved: false });
    if (adapter.recordExecutionState) {
      await adapter.recordExecutionState({
        executionStartedAt,
        mutationStarted: true,
        terminalOutcome: "completed",
        cleanupCompleted: true,
      });
    }
    ledger.destroySecrets();
    clearSyntheticScopeSecrets(scope);
    return {
      status: config.executionMode === "disposable"
        ? "R2-06 DISPOSABLE SYNTHETIC VERIFICATION COMPLETE - NOT PRODUCTION EVIDENCE"
        : "R2-06 SYNTHETIC PRODUCTION VERIFICATION COMPLETE - RELEASE CLOSEOUT REVIEW REQUIRED",
      evidenceClassification: config.executionMode === "disposable"
        ? "disposable_not_production"
        : "production_verification",
      phase: machine.phase,
      actionCount: ACTION_PLAN.length,
      counts: finalMutationCounts,
      publicEvidence,
      privateEvidence: {
        path: privateLedger.path,
        sha256: privateLedger.sha256,
        opaqueReference: privateLedger.opaqueReference,
      },
      releaseCloseoutApproved: false,
    };
  } catch (caught) {
    const error = caught instanceof R206StopError
      ? caught
      : new R206StopError("runner stopped on an unexpected execution failure", {
        code: "UNEXPECTED_EXECUTION_FAILURE",
        cause: caught,
      });
    const lastSuccessfullyCompletedPhase = machine.phase;
    const failedOperation = currentOperation;
    let residueCounts = null;
    let cleanupCompleted = false;
    if (!mutationStarted) {
      await machine.block(error);
    } else {
      await machine.enterCleanupOnly(error);
      const cleanup = await cleanupAfterFailure({ adapter, ledger, machine, limits });
      cleanupCompleted = cleanup.cleanupComplete;
      residueCounts = cleanup.residueCounts;
      cleanupResults = {
        cleanupComplete: cleanup.cleanupComplete,
        errorCount: cleanup.cleanupErrors.length,
      };
      await machine.finishFailure({
        cleanupComplete: cleanup.cleanupComplete,
        error,
      });
    }
    if (adapter.recordExecutionState && executionStartedAt) {
      await adapter.recordExecutionState({
        executionStartedAt,
        mutationStarted,
        terminalOutcome: "failed",
        cleanupCompleted,
      }).catch(() => {});
    }
    ledger.destroySecrets();
    clearSyntheticScopeSecrets(scope);
    error.cleanupResults = cleanupResults;
    throw attachExecutionContext(error, {
      currentOperation: error.executionContext?.currentOperation || failedOperation,
      operation: error.executionContext?.operation || failedOperation,
      runnerOperation: failedOperation,
      lastCompletedOperation: error.executionContext?.lastCompletedOperation || "none",
      elapsedMilliseconds: error.executionContext?.elapsedMilliseconds ?? null,
      timeoutMilliseconds: error.executionContext?.timeoutMilliseconds ?? null,
      operationTimings: error.executionContext?.operationTimings || [],
      browserContextExisted: error.executionContext?.browserContextExisted === true,
      pageLifecycleState: error.executionContext?.pageLifecycleState || "unknown",
      authRequestStarted: error.executionContext?.authRequestStarted === true,
      authResponseAccepted: error.executionContext?.authResponseAccepted === true,
      authSessionConfirmed: error.executionContext?.authSessionConfirmed === true,
      authSessionIdentityConfirmed:
        error.executionContext?.authSessionIdentityConfirmed === true,
      authPersistenceConfirmed:
        error.executionContext?.authPersistenceConfirmed === true,
      cookieStatePresent: error.executionContext?.cookieStatePresent === true,
      localStorageStatePresent: error.executionContext?.localStorageStatePresent === true,
      applicationAuthBootstrapConfirmed:
        error.executionContext?.applicationAuthBootstrapConfirmed === true,
      authenticatedCapabilityConfirmed:
        error.executionContext?.authenticatedCapabilityConfirmed === true,
      authenticatedUiMarkerObserved:
        error.executionContext?.authenticatedUiMarkerObserved === true,
      authenticatedUiMarkerElapsedMilliseconds:
        error.executionContext?.authenticatedUiMarkerElapsedMilliseconds ?? null,
      authenticatedUiMarkerType:
        error.executionContext?.authenticatedUiMarkerType || "sign_out_action",
      uiMarkerAbsenceAffectedExecution: false,
      applicationAuthReloadAttempted:
        error.executionContext?.applicationAuthReloadAttempted === true,
      phase: machine.phase,
      lastSuccessfullyCompletedPhase,
      completedActionCount: completedActions.size,
      mutationStarted,
      cleanupOnlyStarted: machine.cleanupOnly,
      cleanupCompleted,
      residueCounts,
      privateCheckpointReference: privateLedger?.opaqueReference || null,
      retainedTombstone: ledger.tombstone != null,
      manualCleanupRequired: mutationStarted && !cleanupCompleted,
      authorizationConsumed,
    });
  } finally {
    await adapter.close?.();
  }
}

export function dryRunPlan(options = {}) {
  return {
    schemaVersion: 1,
    executionMode: "dry-run",
    targetRef: options.targetRef || "REQUIRED FOR PRODUCTION",
    projectRef: options.projectRef || R206_PROJECT_REF,
    productionExecutionDefault: "disabled",
    credentialsRequired: false,
    networkMutationCount: 0,
    actionCount: ACTION_PLAN.length,
    actions: ACTION_PLAN.map((action) => ({ ...action })),
    hardLimits: { ...HARD_LIMITS },
    allowedMutationRpcs: [...ALLOWED_MUTATION_RPCS],
    allowedReadRpcs: [...ALLOWED_READ_RPCS],
    releaseCloseoutApproved: false,
  };
}
