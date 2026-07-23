import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";

export const APPROVED_AUTHORIZED_DB_PATHS = Object.freeze([
  "supabase/PRODUCTION_CANDIDATE.md",
  "supabase/migrations/20260723000000_laxhornet_legacy_baseline.sql",
  "supabase/migrations/20260723010000_trust_spine_release_1.sql",
  "supabase/migrations/20260723020000_minimum_necessary_disclosure.sql",
  "supabase/migrations/20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
  "supabase/rollback/20260723010000_trust_spine_release_1_rollback.sql",
  "supabase/rollback/20260723020000_minimum_necessary_disclosure_rollback.sql",
]);

export class ReleaseContainmentError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ReleaseContainmentError";
    this.code = code;
    this.details = details;
  }
}

function runGit(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveCommit(repoRoot, ref, code) {
  try {
    return runGit(repoRoot, ["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    throw new ReleaseContainmentError(code, `Git ref is unavailable or invalid: ${ref}`, { ref });
  }
}

function changedFiles(repoRoot, fromCommit, toCommit) {
  const output = runGit(repoRoot, [
    "diff",
    "--name-only",
    "--no-renames",
    `${fromCommit}..${toCommit}`,
    "--",
  ]);
  return output
    .split(/\r?\n/)
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

function isAncestor(repoRoot, ancestorCommit, descendantCommit) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestorCommit, descendantCommit], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new ReleaseContainmentError(
    "ANCESTRY_CHECK_FAILED",
    result.stderr.trim() || "Unable to verify Git ancestry.",
  );
}

function treesDiffer(repoRoot, fromCommit, toCommit, treePath) {
  const result = spawnSync(
    "git",
    ["diff", "--quiet", "--no-ext-diff", `${fromCommit}..${toCommit}`, "--", treePath],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new ReleaseContainmentError(
    "TREE_COMPARISON_FAILED",
    result.stderr.trim() || `Unable to compare ${treePath}.`,
  );
}

function isSqlPath(file) {
  return path.posix.extname(file.toLowerCase()) === ".sql";
}

function isCanonicalDatabasePath(file) {
  return (
    isSqlPath(file) ||
    file.startsWith("supabase/migrations/") ||
    file.startsWith("supabase/rollback/")
  );
}

function isPostAuthorizationDatabasePath(file) {
  return isSqlPath(file) || file === "supabase" || file.startsWith("supabase/");
}

function assertExactAuthorizedSupabaseDelta(files) {
  const approved = new Set(APPROVED_AUTHORIZED_DB_PATHS);
  const actual = new Set(files.filter((file) => file === "supabase" || file.startsWith("supabase/")));
  const unexpected = [...actual].filter((file) => !approved.has(file)).sort();
  const missing = APPROVED_AUTHORIZED_DB_PATHS.filter((file) => !actual.has(file));
  if (unexpected.length || missing.length) {
    throw new ReleaseContainmentError(
      "AUTHORIZED_DB_PATH_SET_MISMATCH",
      "Authorized database ref does not contain exactly the approved PR #9 Supabase delta.",
      { unexpected, missing },
    );
  }
}

export function validateReleaseContainment({
  repoRoot,
  releaseBaseRef = "origin/main",
  authorizedDbRef = "",
  headRef = "HEAD",
} = {}) {
  if (!repoRoot) {
    throw new ReleaseContainmentError("REPOSITORY_REQUIRED", "repoRoot is required.");
  }

  const normalizedRoot = path.resolve(repoRoot);
  const releaseBaseCommit = resolveCommit(
    normalizedRoot,
    releaseBaseRef,
    "RELEASE_BASE_REF_UNAVAILABLE",
  );
  const headCommit = resolveCommit(normalizedRoot, headRef, "HEAD_REF_UNAVAILABLE");
  const releaseDeltaFiles = changedFiles(normalizedRoot, releaseBaseCommit, headCommit);
  const normalizedAuthorizedRef = String(authorizedDbRef || "").trim();

  if (!normalizedAuthorizedRef) {
    const forbidden = releaseDeltaFiles.filter(isCanonicalDatabasePath);
    if (forbidden.length) {
      throw new ReleaseContainmentError(
        "STANDALONE_DATABASE_CHANGE",
        "Standalone release-hygiene delta changes SQL or canonical database files.",
        { forbidden },
      );
    }
    return {
      mode: "standalone",
      repoRoot: normalizedRoot,
      releaseBaseRef,
      releaseBaseCommit,
      authorizedDbRef: null,
      authorizedDbCommit: null,
      headRef,
      headCommit,
      releaseDeltaFiles,
      authorizedSupabaseDeltaFiles: [],
      postAuthorizationDatabaseFiles: [],
      supabaseTreeMatchesAuthorizedRef: null,
    };
  }

  const authorizedDbCommit = resolveCommit(
    normalizedRoot,
    normalizedAuthorizedRef,
    "AUTHORIZED_DB_REF_UNAVAILABLE",
  );
  if (!isAncestor(normalizedRoot, releaseBaseCommit, authorizedDbCommit)) {
    throw new ReleaseContainmentError(
      "AUTHORIZED_DB_BASE_MISMATCH",
      "Authorized database ref does not descend from the configured release base.",
      { releaseBaseRef, normalizedAuthorizedRef },
    );
  }
  if (!isAncestor(normalizedRoot, authorizedDbCommit, headCommit)) {
    throw new ReleaseContainmentError(
      "AUTHORIZED_DB_REF_NOT_IN_HEAD",
      "Combined integration HEAD does not contain the authorized database ref.",
      { normalizedAuthorizedRef, headRef },
    );
  }

  const authorizedDeltaFiles = changedFiles(
    normalizedRoot,
    releaseBaseCommit,
    authorizedDbCommit,
  );
  assertExactAuthorizedSupabaseDelta(authorizedDeltaFiles);

  const postAuthorizationFiles = changedFiles(normalizedRoot, authorizedDbCommit, headCommit);
  const postAuthorizationDatabaseFiles = postAuthorizationFiles.filter(
    isPostAuthorizationDatabasePath,
  );
  if (postAuthorizationDatabaseFiles.length) {
    throw new ReleaseContainmentError(
      "POST_AUTHORIZATION_DATABASE_CHANGE",
      "Combined integration changes SQL or Supabase files after the authorized database ref.",
      { forbidden: postAuthorizationDatabaseFiles },
    );
  }

  if (treesDiffer(normalizedRoot, authorizedDbCommit, headCommit, "supabase")) {
    throw new ReleaseContainmentError(
      "AUTHORIZED_SUPABASE_TREE_MISMATCH",
      "Combined Supabase tree does not match the authorized PR #9 ref exactly.",
      { normalizedAuthorizedRef, headRef },
    );
  }

  return {
    mode: "integration",
    repoRoot: normalizedRoot,
    releaseBaseRef,
    releaseBaseCommit,
    authorizedDbRef: normalizedAuthorizedRef,
    authorizedDbCommit,
    headRef,
    headCommit,
    releaseDeltaFiles,
    authorizedSupabaseDeltaFiles: authorizedDeltaFiles.filter(
      (file) => file === "supabase" || file.startsWith("supabase/"),
    ),
    postAuthorizationDatabaseFiles,
    supabaseTreeMatchesAuthorizedRef: true,
  };
}

export function validateReleaseContainmentFromEnvironment(repoRoot, options = {}) {
  return validateReleaseContainment({
    repoRoot,
    releaseBaseRef:
      options.releaseBaseRef ||
      process.env.LAXHORNET_RELEASE_BASE_REF?.trim() ||
      "origin/main",
    authorizedDbRef:
      options.authorizedDbRef ??
      process.env.LAXHORNET_AUTHORIZED_DB_REF?.trim() ??
      "",
    headRef: options.headRef || "HEAD",
  });
}
