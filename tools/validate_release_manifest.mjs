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
  validateHistoricalProvenance,
  validateReleaseContainment,
} from "./release_containment.mjs";

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
  manifest.finalMainBaseSha === "2b773bce9eb858870c06b95b35051c34fbbad8bc",
  "finalMainBaseSha must identify the reviewed v283 main base",
);
expect(
  manifest.databaseTreeMode === "canonical_plus_additive_with_provenance",
  "databaseTreeMode must identify the canonical-plus-additive release boundary with provenance",
);

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

const expectedMigrationSequence = [
  ...manifest.canonicalForwardMigrations.slice(0, 2),
  historical.markerPath,
  ...manifest.canonicalForwardMigrations.slice(2),
  ...manifest.additiveForwardMigrations,
];
expect(
  JSON.stringify(manifest.requiredMigrationSequence) === JSON.stringify(expectedMigrationSequence),
  "requiredMigrationSequence must preserve timestamp order including the historical marker",
);
expect(
  JSON.stringify(manifest.expectedRemoteAppliedMigrations)
    === JSON.stringify([historical.markerPath]),
  "expectedRemoteAppliedMigrations must contain only the historical production marker",
);
expect(
  JSON.stringify(manifest.expectedPendingProductionMigrations)
    === JSON.stringify([
      ...manifest.canonicalForwardMigrations,
      ...manifest.additiveForwardMigrations,
    ]),
  "expectedPendingProductionMigrations must contain the five reviewed forward migrations",
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
      headRef: combinedRef,
    });
    expect(
      containment.mode === "canonical_plus_additive_with_provenance",
      "combined ref must validate in canonical_plus_additive_with_provenance mode",
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
  `Release manifest valid for ${manifest.release} (${requireCombined ? `combined ref ${combinedRef}` : "stacked review mode"}).`,
);
