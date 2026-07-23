import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

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
const gitFile = (ref, file) => git("show", `${ref}:${file}`);
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
]) {
  try {
    expect(git("cat-file", "-t", ref) === "commit", `${name} must reference an available commit`);
  } catch {
    expect(false, `${name} commit is unavailable: ${ref}`);
  }
}

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

for (const file of [...manifest.additiveForwardMigrations, manifest.rollbackReferences.at(-1)]) {
  expect(fs.existsSync(path.join(root, file)), `cleanup branch is missing required SQL: ${file}`);
}

const migrationDirectory = path.join(root, "supabase", "migrations");
const cleanupMigrations = fs.existsSync(migrationDirectory)
  ? fs.readdirSync(migrationDirectory).map((name) => `supabase/migrations/${name}`)
  : [];
const allowedCleanupMigrations = new Set([
  ...manifest.additiveForwardMigrations,
  ...(requireCombined ? manifest.canonicalForwardMigrations : []),
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
