import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  APPROVED_AUTHORIZED_DB_PATHS,
  APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS,
  APPROVED_HISTORICAL_PROVENANCE_IDENTITIES,
  APPROVED_HISTORICAL_PROVENANCE_PATHS,
  DURABLE_GAME_TOMBSTONE_CONCURRENCY_REVIEW_DB_PATHS,
  DURABLE_GAME_TOMBSTONE_REVIEW_DB_PATHS,
  TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS,
  TRACKED_PLAYING_TIME_REVIEW_DB_PATHS,
  V284_PUBLIC_EVENT_BOUNDARY_DB_PATHS,
  validateHistoricalProvenance,
  validateReleaseContainment,
} from "./release_containment.mjs";
import {
  R206_MIGRATIONS,
  R206_RUNTIME_SHA,
  evaluateR206ReleaseControl,
} from "./release_manifest_state.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "release", "laxhornet-release-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];
const requireCombined = process.argv.includes("--require-combined");
const combinedRefArg = process.argv.find((value) => value.startsWith("--combined-ref="));
const combinedRef = combinedRefArg ? combinedRefArg.split("=", 2)[1] : "HEAD";

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const gitBuffer = (...args) => execFileSync("git", args, { cwd: root });
const gitFile = (ref, file) => git("show", `${ref}:${file}`);
const gitFileSha256 = (ref, file) =>
  createHash("sha256").update(gitBuffer("show", `${ref}:${file}`)).digest("hex");
const reviewedTextSha256 = (bytes) => {
  const canonicalCrLf = bytes
    .toString("utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\r\n");
  return createHash("sha256").update(Buffer.from(canonicalCrLf, "utf8")).digest("hex");
};
const repositoryTextSha256 = (bytes) =>
  createHash("sha256")
    .update(Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8"))
    .digest("hex");
const existsAt = (ref, file) => {
  try {
    git("cat-file", "-e", `${ref}:${file}`);
    return true;
  } catch {
    return false;
  }
};

for (const [name, ref] of [
  ["databaseCandidate", manifest.databaseCandidate],
  ["preCutoverRuntime", manifest.preCutoverRuntime],
  ["activationCandidate", manifest.activationCandidate],
  ["cleanupCandidate", manifest.cleanupCandidate],
]) {
  try {
    expect(git("cat-file", "-t", ref) === "commit", `${name} must reference an available commit`);
  } catch {
    expect(false, `${name} commit is unavailable: ${ref}`);
  }
}

expect(
  manifest.finalMainBaseSha === "fc9c079d69757cfc2667dea7e1dfcc56524dce56",
  "finalMainBaseSha must identify the reviewed v284 main base",
);
expect(
  manifest.preReleaseBaseSha === manifest.finalMainBaseSha,
  "preReleaseBaseSha must preserve the reviewed v284 main base",
);
expect(
  manifest.releaseHeadSha === "1cf5d9d33a7295da8248353165a696b7b81690db",
  "releaseHeadSha must identify the reviewed v284 release head",
);
expect(
  manifest.releaseHeadTreeSha === "20341b66dad600d1ae19f4eed20b55bb61752fbc",
  "releaseHeadTreeSha must identify the reviewed v284 release tree",
);
expect(
  manifest.approvedMergeSha === "e2cd28a568e91232d375a8607e6376800d3a2a20",
  "approvedMergeSha must identify the approved PR #26 merge",
);
expect(
  manifest.incidentRemediationBaseSha === "1221f418c1e005606d54c545148944f9ec69f132",
  "incidentRemediationBaseSha must identify the deployed v284 incident baseline",
);
expect(
  manifest.incidentRemediationHeadSha === "19f3f89d1120fce167f59237e355bb7cc04394c0",
  "incidentRemediationHeadSha must identify the reviewed PR #30 head",
);
expect(
  manifest.incidentRemediationMergeSha === "effca6952e647b7424f96675f390fc80d5c42368",
  "incidentRemediationMergeSha must identify the approved PR #30 merge",
);
expect(
  manifest.productionApplicationSha === R206_RUNTIME_SHA,
  "productionApplicationSha must identify the reconciled R2-06A production runtime",
);
expect(
  manifest.productionRollbackSourceSha === "44f0510d3bde18f459e78f570efd27b72dc2a989",
  "productionRollbackSourceSha must preserve the historical R2-05 rollback source",
);
expect(
  manifest.blockedRuntimeSourceSha === "18f5157de159fa7a27b3cefb4c90f5148c3b230d",
  "blockedRuntimeSourceSha must identify the rolled-back R2-06 source",
);
expect(
  fs.existsSync(path.join(root, manifest.productionRollbackEvidence || "")),
  "production rollback evidence must exist",
);
expect(
  manifest.productionSmokeToolingSha === "0ce0f6734318b07bbf7156e91c79d05d40bd7222",
  "productionSmokeToolingSha must identify the independently reviewed tooling",
);
expect(
  manifest.productionUrl === "https://laxhornet.mybranford.com",
  "productionUrl must identify the approved LaxHornet production origin",
);
expect(
  manifest.productionSmokeEvidence
    === "review-evidence/v284-tracked-playing-time-production/production-smoke-results.json",
  "productionSmokeEvidence must identify the sanitized closeout result",
);
expect(
  manifest.productionVerifiedAt === "2026-07-30",
  "productionVerifiedAt must record the completed application rollback date",
);
expect(
  fs.existsSync(path.join(root, manifest.productionSmokeEvidence || "")),
  "sanitized production smoke evidence must exist",
);
try {
  execFileSync(
    "git",
    [
      "merge-base",
      "--is-ancestor",
      manifest.incidentRemediationHeadSha,
      manifest.incidentRemediationMergeSha,
    ],
    { cwd: root, stdio: "ignore" },
  );
  expect(true, "incident remediation head must be incorporated by its merge");
} catch {
  expect(false, "incident remediation head must be incorporated by its merge");
}
try {
  execFileSync(
    "git",
    ["merge-base", "--is-ancestor", manifest.preReleaseBaseSha, manifest.approvedMergeSha],
    { cwd: root, stdio: "ignore" },
  );
  expect(true, "preReleaseBaseSha must be an ancestor of approvedMergeSha");
} catch {
  expect(false, "preReleaseBaseSha must be an ancestor of approvedMergeSha");
}
try {
  execFileSync(
    "git",
    ["merge-base", "--is-ancestor", manifest.releaseHeadSha, manifest.approvedMergeSha],
    { cwd: root, stdio: "ignore" },
  );
  expect(true, "releaseHeadSha must be incorporated by approvedMergeSha");
} catch {
  try {
    expect(
      git("rev-parse", `${manifest.approvedMergeSha}^{tree}`)
        === manifest.releaseHeadTreeSha,
      "squash-merged approvedMergeSha must have the recorded releaseHeadTreeSha",
    );
  } catch {
    expect(false, "releaseHeadSha must be incorporated by approvedMergeSha");
  }
}
expect(
  manifest.databaseTreeMode === "canonical_plus_additive_with_provenance",
  "databaseTreeMode must identify the canonical-plus-additive release boundary with provenance",
);
expect(
  manifest.reviewDatabaseTreeMode
    === "canonical_plus_additive_with_provenance_and_review_package",
  "reviewDatabaseTreeMode must identify the isolated review-only database package",
);

const reviewPackages = manifest.reviewDatabasePackages || [];
const trackedTimeReview = reviewPackages.find(
  (entry) => entry.name === "tracked_playing_time_foundation",
);
const publicEventBoundaryReview = reviewPackages.find(
  (entry) => entry.name === "v284_public_event_semantic_boundary",
);
const teamMembersRlsReview = reviewPackages.find(
  (entry) => entry.name === "team_members_rls_recursion",
);
const durableGameTombstoneReview = reviewPackages.find(
  (entry) => entry.name === "durable_game_tombstones",
);
const durableGameConcurrencyReview = reviewPackages.find(
  (entry) => entry.name === "durable_game_tombstone_concurrency",
);
expect(reviewPackages.length === 5, "manifest must contain the five bounded database packages");
expect(Boolean(trackedTimeReview), "tracked playing time review package must be present");
expect(Boolean(publicEventBoundaryReview), "public event semantic boundary package must be present");
expect(Boolean(teamMembersRlsReview), "team_members RLS remediation package must be present");
expect(Boolean(durableGameTombstoneReview), "R2-06 durable tombstone package must be present");
expect(Boolean(durableGameConcurrencyReview), "R2-06A concurrency package must be present");
const trackedTimeReviewPaths = trackedTimeReview
  ? [
      trackedTimeReview.forwardMigration,
      trackedTimeReview.rollbackReference,
      trackedTimeReview.testSql,
    ]
  : [];
expect(
  JSON.stringify([...trackedTimeReviewPaths].sort())
    === JSON.stringify([...TRACKED_PLAYING_TIME_REVIEW_DB_PATHS].sort()),
  "tracked playing time review package paths must match the explicit containment allowlist",
);
expect(trackedTimeReview?.status === "production_applied", "tracked playing time package must record production application");
expect(trackedTimeReview?.productionApplied === true, "tracked playing time package must record production application");
expect(
  trackedTimeReview?.productionAuthorizationRequired === true,
  "review package must require separate production authorization",
);
for (const file of TRACKED_PLAYING_TIME_REVIEW_DB_PATHS) {
  const absolute = path.join(root, file);
  expect(fs.existsSync(absolute), `tracked playing time review file is missing: ${file}`);
  if (fs.existsSync(absolute)) {
    const localHash = reviewedTextSha256(fs.readFileSync(absolute));
    expect(
      trackedTimeReview?.sha256?.[file] === localHash,
      `tracked playing time review SHA-256 is stale: ${file}`,
    );
  }
}

const publicEventBoundaryPaths = publicEventBoundaryReview
  ? [
      publicEventBoundaryReview.forwardMigration,
      publicEventBoundaryReview.rollbackReference,
      publicEventBoundaryReview.testSql,
    ]
  : [];
expect(
  JSON.stringify([...publicEventBoundaryPaths].sort())
    === JSON.stringify([...V284_PUBLIC_EVENT_BOUNDARY_DB_PATHS].sort()),
  "public event semantic boundary paths must match the explicit containment allowlist",
);
expect(
  publicEventBoundaryReview?.status === "production_applied",
  "public event semantic boundary must record production application",
);
expect(
  publicEventBoundaryReview?.productionApplied === true,
  "public event semantic boundary must record production application",
);
expect(
  publicEventBoundaryReview?.productionAuthorizationRequired === true,
  "public event semantic boundary must require explicit production authorization",
);
for (const file of V284_PUBLIC_EVENT_BOUNDARY_DB_PATHS) {
  const absolute = path.join(root, file);
  expect(fs.existsSync(absolute), `public event semantic boundary file is missing: ${file}`);
  if (fs.existsSync(absolute)) {
    const localHash = reviewedTextSha256(fs.readFileSync(absolute));
    expect(
      publicEventBoundaryReview?.sha256?.[file] === localHash,
      `public event semantic boundary SHA-256 is stale: ${file}`,
    );
  }
}

const teamMembersRlsPaths = teamMembersRlsReview
  ? [
      teamMembersRlsReview.forwardMigration,
      teamMembersRlsReview.rollbackReference,
      teamMembersRlsReview.testSql,
      teamMembersRlsReview.reproductionTestSql,
    ]
  : [];
expect(
  JSON.stringify([...teamMembersRlsPaths].sort())
    === JSON.stringify([...TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS].sort()),
  "team_members RLS remediation paths must match the explicit containment allowlist",
);
expect(
  ["approved_pending_production", "production_applied"].includes(teamMembersRlsReview?.status),
  "team_members RLS remediation must record an approved pending or production-applied status",
);
expect(
  teamMembersRlsReview?.productionAuthorizationRequired === true,
  "team_members RLS remediation must require explicit production authorization",
);
for (const file of TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS) {
  const absolute = path.join(root, file);
  expect(fs.existsSync(absolute), `team_members RLS remediation file is missing: ${file}`);
  if (fs.existsSync(absolute)) {
    const localHash = reviewedTextSha256(fs.readFileSync(absolute));
    expect(
      teamMembersRlsReview?.sha256?.[file] === localHash,
      `team_members RLS remediation SHA-256 is stale: ${file}`,
    );
  }
}

const durableGameTombstonePaths = durableGameTombstoneReview
  ? [
      durableGameTombstoneReview.forwardMigration,
      durableGameTombstoneReview.rollbackReference,
      durableGameTombstoneReview.testSql,
    ]
  : [];
expect(
  JSON.stringify([...durableGameTombstonePaths].sort())
    === JSON.stringify([...DURABLE_GAME_TOMBSTONE_REVIEW_DB_PATHS].sort()),
  "R2-06 durable tombstone paths must match the explicit containment allowlist",
);
expect(
  durableGameTombstoneReview?.status === "production_present_reconciled"
    && durableGameTombstoneReview?.productionApplied === true
    && durableGameTombstoneReview?.productionCatalogVerified === true
    && durableGameTombstoneReview?.productionAuthorizationRecorded === false,
  "R2-06 durable tombstones must record reconciled presence without tracked authorization",
);
expect(
  durableGameTombstoneReview?.productionAuthorizationRequired === true,
  "R2-06 durable tombstones must require separate production authorization",
);
for (const file of DURABLE_GAME_TOMBSTONE_REVIEW_DB_PATHS) {
  const absolute = path.join(root, file);
  expect(fs.existsSync(absolute), `R2-06 durable tombstone file is missing: ${file}`);
  if (fs.existsSync(absolute)) {
    expect(
      durableGameTombstoneReview?.sha256?.[file]
        === reviewedTextSha256(fs.readFileSync(absolute)),
      `R2-06 durable tombstone SHA-256 is stale: ${file}`,
    );
  }
}

const durableGameConcurrencyPaths = durableGameConcurrencyReview
  ? [
      durableGameConcurrencyReview.forwardMigration,
      durableGameConcurrencyReview.rollbackReference,
      durableGameConcurrencyReview.testSql,
    ]
  : [];
expect(
  JSON.stringify([...durableGameConcurrencyPaths].sort())
    === JSON.stringify([...DURABLE_GAME_TOMBSTONE_CONCURRENCY_REVIEW_DB_PATHS].sort()),
  "R2-06A concurrency paths must match the explicit containment allowlist",
);
expect(
  durableGameConcurrencyReview?.status === "production_present_reconciled"
    && durableGameConcurrencyReview?.productionApplied === true
    && durableGameConcurrencyReview?.productionCatalogVerified === true
    && durableGameConcurrencyReview?.productionAuthorizationRecorded === false,
  "R2-06A concurrency remediation must record reconciled presence without tracked authorization",
);
expect(
  durableGameConcurrencyReview?.requiresMigration
    === durableGameTombstoneReview?.forwardMigration,
  "R2-06A must depend on the R2-06 tombstone migration",
);
expect(
  durableGameConcurrencyReview?.productionAuthorizationRequired === true,
  "R2-06A concurrency remediation must require separate production authorization",
);
for (const file of DURABLE_GAME_TOMBSTONE_CONCURRENCY_REVIEW_DB_PATHS) {
  const absolute = path.join(root, file);
  expect(fs.existsSync(absolute), `R2-06A concurrency file is missing: ${file}`);
  if (fs.existsSync(absolute)) {
    expect(
      durableGameConcurrencyReview?.sha256?.[file]
        === reviewedTextSha256(fs.readFileSync(absolute)),
      `R2-06A concurrency SHA-256 is stale: ${file}`,
    );
  }
}

const identities = manifest.approvedDatabaseFileIdentities || {};
expect(identities.algorithm === "sha256", "approved database identities must use sha256");
expect(
  identities.canonicalSourceRef === manifest.databaseCandidate,
  "canonical identity source must match databaseCandidate",
);
expect(
  identities.additiveSourceRef === manifest.cleanupCandidate,
  "additive identity source must match cleanupCandidate",
);

const canonicalIdentityPaths = Object.keys(identities.canonical || {}).sort();
const additiveIdentityPaths = Object.keys(identities.additive || {}).sort();
const historicalIdentityPaths = Object.keys(identities.historicalProvenance || {}).sort();
expect(
  JSON.stringify(canonicalIdentityPaths) === JSON.stringify([...APPROVED_AUTHORIZED_DB_PATHS].sort()),
  "manifest must identify exactly the approved PR #9 canonical files",
);
expect(
  JSON.stringify(additiveIdentityPaths)
    === JSON.stringify([...APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS].sort()),
  "manifest must identify exactly the approved PR #12 additive files",
);
expect(
  JSON.stringify(historicalIdentityPaths)
    === JSON.stringify([...APPROVED_HISTORICAL_PROVENANCE_PATHS].sort()),
  "manifest must identify exactly the reviewed historical provenance files",
);

for (const [file, expectedHash] of Object.entries(identities.canonical || {})) {
  expect(existsAt(manifest.databaseCandidate, file), `canonical source is missing identity file: ${file}`);
  if (existsAt(manifest.databaseCandidate, file)) {
    expect(
      gitFileSha256(manifest.databaseCandidate, file) === expectedHash,
      `canonical source hash does not match the approved identity: ${file}`,
    );
  }
}
for (const [file, expectedHash] of Object.entries(identities.additive || {})) {
  expect(existsAt(manifest.cleanupCandidate, file), `cleanup source is missing identity file: ${file}`);
  if (existsAt(manifest.cleanupCandidate, file)) {
    expect(
      gitFileSha256(manifest.cleanupCandidate, file) === expectedHash,
      `cleanup source hash does not match the approved identity: ${file}`,
    );
  }
}

const historical = manifest.productionHistoricalMigration || {};
const expectedHistorical = {
  version: "20260723010607",
  name: "remote_schema",
  projectRef: "ulbmjcvnyznvmjgpstno",
  archivedSnapshotPath: "supabase/production-history/20260723010607_remote_schema.sql",
  markerPath: "supabase/migrations/20260723010607_remote_schema.sql",
  documentationPath: "supabase/production-history/README.md",
  orderedStatementsMd5: "ea4aeff5aff66a88dae1211b93e3a1fa",
  statementCount: 350,
};
for (const [key, expectedValue] of Object.entries(expectedHistorical)) {
  expect(
    historical[key] === expectedValue,
    `productionHistoricalMigration.${key} must match the reviewed production audit`,
  );
}
for (const flag of [
  "remoteMarkerExpectedApplied",
  "blankDatabaseMarkerNoOp",
  "productionPushRequiresIncludeAll",
]) {
  expect(historical[flag] === true, `productionHistoricalMigration.${flag} must be true`);
}
for (const file of APPROVED_HISTORICAL_PROVENANCE_PATHS) {
  const manifestIdentity = identities.historicalProvenance?.[file] || {};
  const approvedIdentity = APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[file];
  expect(
    manifestIdentity.sha256 === approvedIdentity.sha256,
    `manifest historical SHA-256 differs from the reviewed identity: ${file}`,
  );
  expect(
    manifestIdentity.gitBlob === approvedIdentity.blob,
    `manifest historical Git blob differs from the reviewed identity: ${file}`,
  );
}
expect(
  historical.archiveSha256
    === APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[historical.archivedSnapshotPath]?.sha256,
  "productionHistoricalMigration archive SHA-256 must match its approved identity",
);
expect(
  historical.archiveGitBlob
    === APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[historical.archivedSnapshotPath]?.blob,
  "productionHistoricalMigration archive Git blob must match its approved identity",
);
expect(
  historical.markerSha256
    === APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[historical.markerPath]?.sha256,
  "productionHistoricalMigration marker SHA-256 must match its approved identity",
);
expect(
  historical.markerGitBlob
    === APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[historical.markerPath]?.blob,
  "productionHistoricalMigration marker Git blob must match its approved identity",
);
expect(
  historical.documentationSha256
    === APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[historical.documentationPath]?.sha256,
  "productionHistoricalMigration documentation SHA-256 must match its approved identity",
);
expect(
  historical.documentationGitBlob
    === APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[historical.documentationPath]?.blob,
  "productionHistoricalMigration documentation Git blob must match its approved identity",
);

const approvedBaseMigrationSequence = [
  ...manifest.canonicalForwardMigrations.slice(0, 2),
  historical.markerPath,
  ...manifest.canonicalForwardMigrations.slice(2),
  ...manifest.additiveForwardMigrations,
];
const expectedMigrationSequence = [
  ...approvedBaseMigrationSequence,
  trackedTimeReview?.forwardMigration,
  publicEventBoundaryReview?.forwardMigration,
  teamMembersRlsReview?.forwardMigration,
  durableGameTombstoneReview?.forwardMigration,
  durableGameConcurrencyReview?.forwardMigration,
];
expect(
  JSON.stringify(manifest.requiredMigrationSequence) === JSON.stringify(expectedMigrationSequence),
  "requiredMigrationSequence must preserve production order through R2-06A",
);
expect(
  JSON.stringify(manifest.reviewMigrationSequence)
    === JSON.stringify(expectedMigrationSequence),
  "reviewMigrationSequence must include R2-06 and R2-06A in order",
);
const expectedAppliedMigrationSequence = expectedMigrationSequence;
expect(
  JSON.stringify(manifest.expectedRemoteAppliedMigrations)
    === JSON.stringify(expectedAppliedMigrationSequence),
  "expectedRemoteAppliedMigrations must include reconciled R2-06 then R2-06A",
);
expect(
  JSON.stringify(manifest.expectedPendingProductionMigrations)
    === JSON.stringify([]),
  "expectedPendingProductionMigrations must be empty after reconciliation",
);
expect(
  teamMembersRlsReview?.productionApplied
    ? teamMembersRlsReview?.status === "production_applied"
    : teamMembersRlsReview?.status === "approved_pending_production",
  "team_members RLS package status and productionApplied flag must agree",
);
expect(
  manifest.runtimeReleaseBlockedUntilMigrationsApplied === true,
  "runtime release must continue to fail closed when required migrations are absent",
);
expect(
  JSON.stringify(manifest.runtimeDatabaseDependencies)
    === JSON.stringify(R206_MIGRATIONS),
  "runtime database dependencies must require R2-06 before R2-06A",
);
expect(
  manifest.runtimeDatabaseDependenciesSatisfied === true,
  "runtime database dependencies must record the verified reconciled state",
);

const r206ReleaseControl = evaluateR206ReleaseControl(manifest, {
  evidenceExists: (file) => fs.existsSync(path.join(root, file)),
});
for (const failure of r206ReleaseControl.failures) {
  expect(false, failure);
}
expect(
  r206ReleaseControl.runtimeDatabaseReady === true,
  "R2-06 runtime, migration, and catalog reconciliation must be internally consistent",
);
expect(
  r206ReleaseControl.releaseComplete
    === (manifest.r206ReleaseControl?.releaseCloseoutApproved === true),
  "R2-06 closeout approval must agree with the complete release-control state",
);
const syntheticRunner = manifest.r206ReleaseControl?.syntheticRunner;
const expectedRunnerPaths = [
  "tools/run_r206_synthetic_verification.mjs",
  "tools/r206_browser_runtime.mjs",
  "tools/r206-browser-runtime/package.json",
  "tools/r206-browser-runtime/package-lock.json",
  "tools/r206_synthetic_runner_core.mjs",
  "tools/r206_synthetic_production_adapter.mjs",
  "tools/r206_synthetic_disposable_adapter.mjs",
  "tools/test_r206_synthetic_verification.mjs",
  "tools/test_r206_browser_runtime.mjs",
  "tools/test_r206_synthetic_verification_disposable.mjs",
  "tools/fixtures/r206-synthetic-evidence-schema.json",
];
expect(syntheticRunner?.implemented === true, "R2-06 synthetic runner must be registered");
expect(
  syntheticRunner?.productionExecutionDefault === "disabled",
  "R2-06 synthetic runner production execution must default to disabled",
);
expect(
  syntheticRunner?.browserReadinessPath === "tools/r206_browser_runtime.mjs"
    && syntheticRunner?.browserReadinessTestPath === "tools/test_r206_browser_runtime.mjs"
    && syntheticRunner?.browserRuntimePackagePath === "tools/r206-browser-runtime/package.json"
    && syntheticRunner?.browserRuntimeLockPath === "tools/r206-browser-runtime/package-lock.json",
  "R2-06 browser runtime reviewed paths changed",
);
expect(
  syntheticRunner?.playwrightVersion === "1.61.1"
    && syntheticRunner?.chromiumRevision === "1228"
    && syntheticRunner?.chromiumVersion === "149.0.7827.55",
  "R2-06 browser runtime reviewed identities changed",
);
expect(syntheticRunner?.actionCount === 21, "R2-06 synthetic runner must retain exactly 21 actions");
expect(
  JSON.stringify(syntheticRunner?.allowedMutationRpcs)
    === JSON.stringify(["laxhornet_sync_game", "laxhornet_delete_game_durable"]),
  "R2-06 synthetic runner mutation RPC allowlist changed",
);
expect(
  JSON.stringify(syntheticRunner?.hardLimits) === JSON.stringify({
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
  }),
  "R2-06 synthetic runner hard limits changed",
);
for (const file of expectedRunnerPaths) {
  const absolute = path.join(root, file);
  expect(fs.existsSync(absolute), `R2-06 synthetic runner file is missing: ${file}`);
  if (fs.existsSync(absolute)) {
    const actual = repositoryTextSha256(fs.readFileSync(absolute));
    expect(
      syntheticRunner?.sha256?.[file] === actual,
      `R2-06 synthetic runner SHA-256 mismatch: ${file}`,
    );
  }
}
expect(
  Object.keys(syntheticRunner?.sha256 || {}).sort().join("\n")
    === [...expectedRunnerPaths].sort().join("\n"),
  "R2-06 synthetic runner hash inventory changed",
);
expect(
  manifest.r206ReleaseControl?.syntheticVerification?.authorized === false
    && manifest.r206ReleaseControl?.syntheticVerification?.completed === false
    && manifest.r206ReleaseControl?.cleanupCompleted === false
    && manifest.r206ReleaseControl?.releaseCloseoutApproved === false,
  "registering the R2-06 synthetic runner must not advance production verification or closeout",
);
expect(
  fs.existsSync(
    path.join(
      root,
      manifest.r206ReleaseControl?.reconciliation?.manifestReconciliationEvidence || "",
    ),
  ),
  "R2-06 manifest reconciliation evidence must exist",
);

expect(
  Number.isInteger(manifest.minimumSchemaCapability) && manifest.minimumSchemaCapability > 0,
  "minimumSchemaCapability must be a positive integer",
);

const runtimeConfig = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");
for (const flag of manifest.requiredRuntimeFlags) {
  expect(runtimeConfig.includes(`${flag}: true`), `runtime flag is missing or disabled: ${flag}`);
}
expect(
  runtimeConfig.includes(`minimumSchemaCapability: ${manifest.minimumSchemaCapability}`),
  "runtime and manifest schema capabilities must match",
);

const capabilityMigration = fs.readFileSync(
  path.join(root, manifest.additiveForwardMigrations[0]),
  "utf8",
);
expect(
  capabilityMigration.includes(`'schemaVersion', ${manifest.minimumSchemaCapability}`),
  "database and manifest schema capabilities must match",
);
for (const capability of manifest.requiredBackendCapabilities) {
  expect(capabilityMigration.includes(`'${capability}', true`), `backend capability is missing: ${capability}`);
}

for (const file of manifest.canonicalForwardMigrations) {
  expect(existsAt(manifest.databaseCandidate, file), `database candidate is missing canonical migration: ${file}`);
  if (requireCombined) {
    expect(existsAt(combinedRef, file), `combined ref is missing canonical migration: ${file}`);
    if (existsAt(combinedRef, file) && existsAt(manifest.databaseCandidate, file)) {
      expect(
        gitFile(combinedRef, file) === gitFile(manifest.databaseCandidate, file),
        `combined ref rewrites approved migration: ${file}`,
      );
    }
  }
}

if (requireCombined) {
  for (const [file, expectedHash] of [
    ...Object.entries(identities.canonical || {}),
    ...Object.entries(identities.additive || {}),
  ]) {
    expect(existsAt(combinedRef, file), `combined ref is missing approved identity file: ${file}`);
    if (existsAt(combinedRef, file)) {
      expect(
        gitFileSha256(combinedRef, file) === expectedHash,
        `combined ref does not match the approved file identity: ${file}`,
      );
    }
  }
  for (const file of APPROVED_HISTORICAL_PROVENANCE_PATHS) {
    const expectedIdentity = APPROVED_HISTORICAL_PROVENANCE_IDENTITIES[file];
    expect(existsAt(combinedRef, file), `combined ref is missing historical provenance: ${file}`);
    if (existsAt(combinedRef, file)) {
      expect(
        gitFileSha256(combinedRef, file)
          === (expectedIdentity.repositorySha256 || expectedIdentity.sha256),
        `combined ref historical SHA-256 differs from the reviewed identity: ${file}`,
      );
      expect(
        git("rev-parse", `${combinedRef}:${file}`) === expectedIdentity.blob,
        `combined ref historical Git blob differs from the reviewed identity: ${file}`,
      );
    }
  }
  try {
    const provenance = validateHistoricalProvenance({ repoRoot: root, headRef: combinedRef });
    expect(provenance.markerCommentOnly === true, "historical marker must be comment-only");
    expect(provenance.statementCount === historical.statementCount, "historical statement count mismatch");
    expect(
      provenance.orderedStatementsMd5 === historical.orderedStatementsMd5,
      "historical ordered-statement MD5 mismatch",
    );
  } catch (error) {
    expect(false, `historical provenance validation failed: ${error.code || error.message}`);
  }

  try {
    const releaseBase = git("merge-base", manifest.databaseCandidate, manifest.preCutoverRuntime);
    const containment = validateReleaseContainment({
      repoRoot: root,
      releaseBaseRef: releaseBase,
      authorizedDbRef: manifest.databaseCandidate,
      approvedAdditiveRef: manifest.cleanupCandidate,
      allowedAdditiveDbPaths: [
        ...TRACKED_PLAYING_TIME_REVIEW_DB_PATHS,
        ...V284_PUBLIC_EVENT_BOUNDARY_DB_PATHS,
        ...TEAM_MEMBERS_RLS_REMEDIATION_DB_PATHS,
        ...DURABLE_GAME_TOMBSTONE_REVIEW_DB_PATHS,
        ...DURABLE_GAME_TOMBSTONE_CONCURRENCY_REVIEW_DB_PATHS,
      ],
      headRef: combinedRef,
    });
    expect(
      containment.mode === manifest.reviewDatabaseTreeMode,
      "combined ref must validate in the review-only database tree mode",
    );
    expect(
      containment.combinedSupabaseTreeMatchesApprovedRefs === true,
      "combined Supabase tree must match both approved source refs",
    );
  } catch (error) {
    expect(false, `combined release containment failed: ${error.code || error.message}`);
  }
}

for (const file of [...manifest.additiveForwardMigrations, manifest.rollbackReferences.at(-1)]) {
  expect(fs.existsSync(path.join(root, file)), `cleanup branch is missing required SQL: ${file}`);
}

const migrationDirectory = path.join(root, "supabase", "migrations");
const cleanupMigrations = fs.existsSync(migrationDirectory)
  ? fs.readdirSync(migrationDirectory).map((name) => `supabase/migrations/${name}`)
  : [];
const allowedCleanupMigrations = new Set([
  ...manifest.additiveForwardMigrations,
  historical.markerPath,
  ...manifest.canonicalForwardMigrations,
  trackedTimeReview?.forwardMigration,
  publicEventBoundaryReview?.forwardMigration,
  teamMembersRlsReview?.forwardMigration,
  DURABLE_GAME_TOMBSTONE_REVIEW_DB_PATHS[0],
  DURABLE_GAME_TOMBSTONE_CONCURRENCY_REVIEW_DB_PATHS[0],
]);
for (const file of cleanupMigrations) {
  expect(allowedCleanupMigrations.has(file), `unknown cleanup migration detected: ${file}`);
}

const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version;
expect(version === manifest.release, "version.json and release manifest must match");

const evidenceRoot = path.join(root, manifest.evidenceDirectory);
for (const evidence of [
  "README.md",
  "architecture-boundary.md",
  "event-operation-contract.md",
  "game-scope-decision.md",
  "capability-handshake-contract.md",
]) {
  expect(fs.existsSync(path.join(evidenceRoot, evidence)), `required release evidence is missing: ${evidence}`);
}

if (failures.length) {
  console.error(`Release manifest validation failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Release manifest valid for ${manifest.release} (${requireCombined ? `combined ref ${combinedRef}` : "production-applied manifest"}); R2-06 runtime/catalog reconciled and closeout ${r206ReleaseControl.closeoutReady ? "ready" : "blocked"}.`,
);
