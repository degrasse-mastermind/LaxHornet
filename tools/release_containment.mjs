import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";
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

export const APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS = Object.freeze([
  "supabase/migrations/20260723040000_event_pipeline_capabilities.sql",
  "supabase/rollback/20260723040000_event_pipeline_capabilities_rollback.sql",
]);

export const APPROVED_HISTORICAL_PROVENANCE_PATHS = Object.freeze([
  "supabase/migrations/20260723010607_remote_schema.sql",
  "supabase/production-history/20260723010607_remote_schema.sql",
  "supabase/production-history/README.md",
]);

export const APPROVED_HISTORICAL_PROVENANCE_IDENTITIES = Object.freeze({
  "supabase/migrations/20260723010607_remote_schema.sql": Object.freeze({
    sha256: "eee50c8cddc00dcec0171f1cadc3937d6ca8473a023c68c6858609f6813520f9",
    blob: "d4aed15847e45abbe755aaba3d10f3978755acc9",
    classification: "comment-only historical migration marker",
  }),
  "supabase/production-history/20260723010607_remote_schema.sql": Object.freeze({
    sha256: "c8bd4bc55cc13b6506ccb859cf658f6962beec65f91d713f0867c91b4b046c82",
    blob: "0c7fd494be0a461a3fb2b3efa60496b8541229a3",
    statementCount: 350,
    orderedStatementsMd5: "ea4aeff5aff66a88dae1211b93e3a1fa",
    classification: "historical production db-pull snapshot",
  }),
  "supabase/production-history/README.md": Object.freeze({
    sha256: "b77ad6b99fb551d0099c689d76803ffa78ef6da8c56a7d660a2b346e0cb01019",
    blob: "73aff47d9b4c33876617a9b956b2693befa9457c",
    classification: "historical production provenance documentation",
  }),
});

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

function tryResolveCommit(repoRoot, ref) {
  try {
    return runGit(repoRoot, ["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    return "";
  }
}

export function resolveReleaseBaseRef(repoRoot, explicitRef = "") {
  const normalizedRoot = path.resolve(repoRoot);
  const normalizedExplicitRef = String(explicitRef || "").trim();
  if (normalizedExplicitRef) {
    resolveCommit(normalizedRoot, normalizedExplicitRef, "RELEASE_BASE_REF_UNAVAILABLE");
    return { releaseBaseRef: normalizedExplicitRef, releaseBaseSource: "explicit" };
  }

  if (tryResolveCommit(normalizedRoot, "origin/main")) {
    return { releaseBaseRef: "origin/main", releaseBaseSource: "origin/main" };
  }
  if (tryResolveCommit(normalizedRoot, "main")) {
    return { releaseBaseRef: "main", releaseBaseSource: "main" };
  }

  throw new ReleaseContainmentError(
    "RELEASE_BASE_REF_UNAVAILABLE",
    "No authorized release base is available. Set LAXHORNET_RELEASE_BASE_REF or provide origin/main or main.",
    { attemptedRefs: ["origin/main", "main"] },
  );
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

function listFilesAt(repoRoot, ref, treePath = "") {
  const args = ["ls-tree", "-r", "--name-only", ref];
  if (treePath) args.push("--", treePath);
  const output = runGit(repoRoot, args);
  return output
    .split(/\r?\n/)
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

function blobIdAt(repoRoot, ref, file) {
  try {
    return runGit(repoRoot, ["rev-parse", `${ref}:${file}`]);
  } catch {
    return "";
  }
}

function fileBufferAt(repoRoot, ref, file) {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function digest(algorithm, value) {
  return createHash(algorithm).update(value).digest("hex");
}

function parseHistoricalStatements(archiveText) {
  const marker =
    /^-- statement (\d+) \| md5 ([a-f0-9]{32}) \| chars (\d+)\r?$/gm;
  const matches = [...archiveText.matchAll(marker)];
  const statements = [];

  for (const [index, match] of matches.entries()) {
    const statementNumber = Number(match[1]);
    const expectedMd5 = match[2];
    const characterCount = Number(match[3]);
    const contentStart = match.index + match[0].length +
      (archiveText.slice(match.index + match[0].length).startsWith("\r\n") ? 2 : 1);
    const statement = archiveText.slice(contentStart, contentStart + characterCount);

    if (statementNumber !== index + 1 || statement.length !== characterCount) {
      throw new ReleaseContainmentError(
        "HISTORICAL_STATEMENT_STRUCTURE_MISMATCH",
        "The archived production snapshot statement ordering or length changed.",
        { statementNumber, expectedStatementNumber: index + 1, characterCount },
      );
    }
    if (digest("md5", statement) !== expectedMd5) {
      throw new ReleaseContainmentError(
        "HISTORICAL_STATEMENT_IDENTITY_MISMATCH",
        "An archived production statement no longer matches its audited identity.",
        { statementNumber },
      );
    }
    statements.push(statement);
  }

  return statements;
}

function assertCommentOnlyMarker(markerText) {
  const withoutBlockComments = markerText.replace(/\/\*[\s\S]*?\*\//g, "");
  const executable = withoutBlockComments
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--"));
  if (executable.length) {
    throw new ReleaseContainmentError(
      "HISTORICAL_MARKER_EXECUTABLE_SQL",
      "The historical production migration marker must remain comment-only.",
      { executable },
    );
  }
}

export function validateHistoricalProvenance({
  repoRoot,
  headRef = "HEAD",
} = {}) {
  if (!repoRoot) {
    throw new ReleaseContainmentError("REPOSITORY_REQUIRED", "repoRoot is required.");
  }
  const normalizedRoot = path.resolve(repoRoot);
  const headCommit = resolveCommit(normalizedRoot, headRef, "HEAD_REF_UNAVAILABLE");
  const mismatched = [];

  for (const file of APPROVED_HISTORICAL_PROVENANCE_PATHS) {
    const identity = APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[file];
    const content = fileBufferAt(normalizedRoot, headCommit, file);
    const actualBlob = blobIdAt(normalizedRoot, headCommit, file);
    const actualSha256 = content ? digest("sha256", content) : "";
    const expectedRepositorySha256 = identity.repositorySha256 || identity.sha256;
    if (
      !content ||
      actualBlob !== identity.blob ||
      actualSha256 !== expectedRepositorySha256
    ) {
      mismatched.push({
        file,
        expectedBlob: identity.blob,
        actualBlob: actualBlob || null,
        expectedSha256: expectedRepositorySha256,
        actualSha256: actualSha256 || null,
      });
    }
  }
  if (mismatched.length) {
    throw new ReleaseContainmentError(
      "HISTORICAL_PROVENANCE_FILE_IDENTITY_MISMATCH",
      "Historical production provenance files changed from their reviewed identities.",
      { mismatched },
    );
  }

  const markerPath = "supabase/migrations/20260723010607_remote_schema.sql";
  const archivePath =
    "supabase/production-history/20260723010607_remote_schema.sql";
  const markerText = fileBufferAt(normalizedRoot, headCommit, markerPath).toString("utf8");
  const archiveText = fileBufferAt(normalizedRoot, headCommit, archivePath).toString("utf8");
  assertCommentOnlyMarker(markerText);
  const statements = parseHistoricalStatements(archiveText);
  const archiveIdentity = APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[archivePath];
  const orderedStatementsMd5 = digest(
    "md5",
    statements.join("\n-- statement boundary --\n"),
  );
  if (
    statements.length !== archiveIdentity.statementCount ||
    orderedStatementsMd5 !== archiveIdentity.orderedStatementsMd5
  ) {
    throw new ReleaseContainmentError(
      "HISTORICAL_ARCHIVE_AUDIT_MISMATCH",
      "The archived production snapshot no longer matches the audited statement set.",
      {
        expectedStatementCount: archiveIdentity.statementCount,
        actualStatementCount: statements.length,
        expectedOrderedStatementsMd5: archiveIdentity.orderedStatementsMd5,
        actualOrderedStatementsMd5: orderedStatementsMd5,
      },
    );
  }

  return {
    projectRef: "ulbmjcvnyznvmjgpstno",
    migrationVersion: "20260723010607",
    migrationName: "remote_schema",
    markerPath,
    archivePath,
    statementCount: statements.length,
    orderedStatementsMd5,
    markerCommentOnly: true,
    identitiesMatch: true,
  };
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

function assertMatchingFileSet(expectedFiles, actualFiles, code, message) {
  const expected = new Set(expectedFiles);
  const actual = new Set(actualFiles);
  const unexpected = [...actual].filter((file) => !expected.has(file)).sort();
  const missing = [...expected].filter((file) => !actual.has(file)).sort();
  if (unexpected.length || missing.length) {
    throw new ReleaseContainmentError(code, message, { unexpected, missing });
  }
}

function assertMatchingBlobIdentities(repoRoot, expectedSources, headCommit, code, message) {
  const mismatched = [];
  for (const [file, sourceRef] of expectedSources) {
    const expectedBlob = blobIdAt(repoRoot, sourceRef, file);
    const actualBlob = blobIdAt(repoRoot, headCommit, file);
    if (!expectedBlob || expectedBlob !== actualBlob) {
      mismatched.push({
        file,
        expectedSource: sourceRef,
        expectedBlob: expectedBlob || null,
        actualBlob: actualBlob || null,
      });
    }
  }
  if (mismatched.length) {
    throw new ReleaseContainmentError(code, message, { mismatched });
  }
}

function validateCanonicalPlusAdditiveTree({
  repoRoot,
  authorizedDbCommit,
  approvedAdditiveCommit,
  headCommit,
}) {
  const canonicalSupabaseFiles = listFilesAt(repoRoot, authorizedDbCommit, "supabase");
  const expectedSupabaseSources = new Map(
    canonicalSupabaseFiles.map((file) => [file, authorizedDbCommit]),
  );
  for (const file of APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS) {
    if (!blobIdAt(repoRoot, approvedAdditiveCommit, file)) {
      throw new ReleaseContainmentError(
        "APPROVED_ADDITIVE_FILE_MISSING",
        "The approved cleanup ref is missing a required capability file.",
        { file, approvedAdditiveCommit },
      );
    }
    expectedSupabaseSources.set(file, approvedAdditiveCommit);
  }

  const headSupabaseFiles = listFilesAt(repoRoot, headCommit, "supabase");
  const historicalProvenancePresent = headSupabaseFiles.some(
    (file) =>
      APPROVED_HISTORICAL_PROVENANCE_PATHS.includes(file) ||
      file.startsWith("supabase/production-history/"),
  );
  const expectedFiles = [
    ...expectedSupabaseSources.keys(),
    ...(historicalProvenancePresent ? APPROVED_HISTORICAL_PROVENANCE_PATHS : []),
  ];
  assertMatchingFileSet(
    expectedFiles,
    headSupabaseFiles,
    "COMBINED_SUPABASE_PATH_SET_MISMATCH",
    "The combined Supabase tree contains missing or unexpected paths.",
  );
  assertMatchingBlobIdentities(
    repoRoot,
    expectedSupabaseSources,
    headCommit,
    "COMBINED_SUPABASE_FILE_IDENTITY_MISMATCH",
    "The combined Supabase tree does not match the approved canonical and additive file identities.",
  );
  return historicalProvenancePresent
    ? validateHistoricalProvenance({ repoRoot, headRef: headCommit })
    : null;
}

export function validateReleaseContainment({
  repoRoot,
  releaseBaseRef = "origin/main",
  authorizedDbRef = "",
  approvedAdditiveRef = "",
  allowedAdditiveDbPaths = [],
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
  const normalizedApprovedAdditiveRef = String(approvedAdditiveRef || "").trim();

  if (!normalizedAuthorizedRef) {
    const allowedAdditive = new Set(
      (allowedAdditiveDbPaths || []).map((file) => String(file).trim().replaceAll("\\", "/")).filter(Boolean),
    );
    const databaseDelta = releaseDeltaFiles.filter(isCanonicalDatabasePath);
    const forbidden = databaseDelta.filter((file) => !allowedAdditive.has(file));
    if (forbidden.length) {
      throw new ReleaseContainmentError(
        "STANDALONE_DATABASE_CHANGE",
        "Standalone release-hygiene delta changes SQL or canonical database files.",
        { forbidden },
      );
    }
    return {
      mode: databaseDelta.length ? "additive" : "standalone",
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
      allowedAdditiveDatabaseFiles: databaseDelta,
    };
  }

  const authorizedDbCommit = resolveCommit(
    normalizedRoot,
    normalizedAuthorizedRef,
    "AUTHORIZED_DB_REF_UNAVAILABLE",
  );
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

  if (normalizedApprovedAdditiveRef) {
    const approvedAdditiveCommit = resolveCommit(
      normalizedRoot,
      normalizedApprovedAdditiveRef,
      "APPROVED_ADDITIVE_REF_UNAVAILABLE",
    );
    if (!isAncestor(normalizedRoot, approvedAdditiveCommit, headCommit)) {
      throw new ReleaseContainmentError(
        "APPROVED_ADDITIVE_REF_NOT_IN_HEAD",
        "Combined integration HEAD does not contain the approved additive cleanup ref.",
        { normalizedApprovedAdditiveRef, headRef },
      );
    }

    const historicalProvenance = validateCanonicalPlusAdditiveTree({
      repoRoot: normalizedRoot,
      authorizedDbCommit,
      approvedAdditiveCommit,
      headCommit,
    });

    return {
      mode: historicalProvenance
        ? "canonical_plus_additive_with_provenance"
        : "canonical_plus_additive",
      repoRoot: normalizedRoot,
      releaseBaseRef,
      releaseBaseCommit,
      authorizedDbRef: normalizedAuthorizedRef,
      authorizedDbCommit,
      approvedAdditiveRef: normalizedApprovedAdditiveRef,
      approvedAdditiveCommit,
      headRef,
      headCommit,
      releaseDeltaFiles,
      authorizedSupabaseDeltaFiles: authorizedDeltaFiles.filter(
        (file) => file === "supabase" || file.startsWith("supabase/"),
      ),
      allowedAdditiveDatabaseFiles: [...APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS],
      postAuthorizationDatabaseFiles: [],
      supabaseTreeMatchesAuthorizedRef: null,
      canonicalSupabaseFilesMatchAuthorizedRef: true,
      combinedSupabaseTreeMatchesApprovedRefs: true,
      historicalProvenance,
    };
  }

  const supabaseChangesAfterAuthorization = changedFiles(
    normalizedRoot,
    authorizedDbCommit,
    headCommit,
  ).filter((file) => file === "supabase" || file.startsWith("supabase/"));
  const nonSupabaseSqlChangesFromReleaseBase = releaseDeltaFiles.filter(
    (file) => isSqlPath(file) && file !== "supabase" && !file.startsWith("supabase/"),
  );
  const postAuthorizationDatabaseFiles = [
    ...new Set([
      ...supabaseChangesAfterAuthorization,
      ...nonSupabaseSqlChangesFromReleaseBase,
    ]),
  ].sort();
  if (postAuthorizationDatabaseFiles.length) {
    throw new ReleaseContainmentError(
      "POST_AUTHORIZATION_DATABASE_CHANGE",
      "Combined integration changes the authorized Supabase tree or adds SQL outside the release base.",
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
  const explicitReleaseBaseRef =
    options.releaseBaseRef || process.env.LAXHORNET_RELEASE_BASE_REF?.trim() || "";
  const { releaseBaseRef, releaseBaseSource } = resolveReleaseBaseRef(
    repoRoot,
    explicitReleaseBaseRef,
  );
  const result = validateReleaseContainment({
    repoRoot,
    releaseBaseRef,
    authorizedDbRef:
      options.authorizedDbRef ??
      process.env.LAXHORNET_AUTHORIZED_DB_REF?.trim() ??
      "",
    approvedAdditiveRef:
      options.approvedAdditiveRef ??
      process.env.LAXHORNET_APPROVED_ADDITIVE_REF?.trim() ??
      "",
    allowedAdditiveDbPaths:
      options.allowedAdditiveDbPaths
      ?? process.env.LAXHORNET_ALLOWED_ADDITIVE_DB_PATHS?.split(",")
      ?? [],
    headRef: options.headRef || "HEAD",
  });
  return { ...result, releaseBaseSource };
}
