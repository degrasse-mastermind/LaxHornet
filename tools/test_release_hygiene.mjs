import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { validateReleaseContainmentFromEnvironment } from "./release_containment.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const version = JSON.parse(read("version.json")).version;
const activationRelease = version === "v282";
const containment = validateReleaseContainmentFromEnvironment(root, {
  releaseBaseRef:
    process.env.LAXHORNET_RELEASE_BASE_REF?.trim() ||
    (activationRelease ? "origin/review/release-hygiene-v281" : undefined),
});
const baseApp = execFileSync("git", ["show", `${containment.releaseBaseCommit}:app.js`], {
  cwd: root,
  encoding: "utf8",
});
const changedFiles = containment.releaseDeltaFiles;

const checks = [];
function check(condition, message) {
  assert.ok(condition, message);
  checks.push(message);
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return source
    .slice(start, nextFunction < 0 ? source.length : nextFunction)
    .replace(/\r\n/g, "\n")
    .trimEnd();
}

function activeTextFiles(dir) {
  const ignored = new Set([".git", "review-evidence", "laxhornet-ux-audit", "laxhornet-game-review-screenshot-pack", "laxhornet-review-audit-jimi-win-low-impact", "LaxHornet-github-pages"]);
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name.endsWith(".zip")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...activeTextFiles(fullPath));
    else if (/\.(?:html|js|mjs|cjs|json|md|css|toml|ts|txt)$/i.test(entry.name)) results.push(fullPath);
  }
  return results;
}

check(read("version.json").includes(`"version": "${version}"`), `version manifest identifies ${version}`);
check(app.includes(`const APP_VERSION = "${version}";`), `browser runtime identifies ${version}`);
check(read("service-worker.js").includes(`const CACHE_NAME = "laxhornet-${version}";`), `service-worker cache identifies ${version}`);

for (const flag of ["publicLiveShareRpc", "liveShareTokenRpc", "exportAuditRpc"]) {
  check(
    app.includes(`${flag}: RUNTIME_CONFIG.${flag} === true`),
    `${flag} requires deliberate true runtime configuration`,
  );
}
check(!/window\.LAXHORNET_RUNTIME_CONFIG\s*=/.test(app), "app runtime does not self-enable trusted disclosure flags");
check(app.includes('.select("*, events(*)")'), "legacy Live Share fallback remains pending explicit cutover");
if (activationRelease) {
  const runtimeConfig = read("runtime-config.js");
  const appHtml = read("app.html");
  for (const flag of ["publicLiveShareRpc", "liveShareTokenRpc", "exportAuditRpc"]) {
    check(runtimeConfig.includes(`${flag}: true`), `${flag} is explicitly enabled by the v282 runtime artifact`);
  }
  check(
    appHtml.indexOf("runtime-config.js?v=282") < appHtml.indexOf("app.js?v=282"),
    "v282 runtime configuration loads before app.js",
  );
  check(
    app.includes("SECURE_DISCLOSURE_RUNTIME_READY") &&
      app.includes("reportSecureDisclosureUnavailable"),
    "v282 has bounded secure-disclosure configuration failure handling",
  );
}

const activeFiles = activeTextFiles(root);
const productionProjectRef = "ulbmjcvnyznvmjgpstno";
const stagingReferenceViolations = [];
const publishableKeyViolations = [];
for (const file of activeFiles) {
  const text = fs.readFileSync(file, "utf8");
  const hostedProjectRefs = [...text.matchAll(/https:\/\/([a-z]{20})\.supabase\.co/gi)].map((match) => match[1]);
  if (hostedProjectRefs.some((ref) => ref !== productionProjectRef)) stagingReferenceViolations.push(path.relative(root, file));
  if (path.basename(file) !== "app.js") {
    if (/sb_publishable_[A-Za-z0-9_-]+/.test(text)) publishableKeyViolations.push(path.relative(root, file));
  }
}
check(stagingReferenceViolations.length === 0, "active runtime, public, and support files contain no staging project reference");
check(publishableKeyViolations.length === 0, "no publishable key appears outside the existing production app configuration");
check(app.includes(`https://${productionProjectRef}.supabase.co`), "app default remains scoped to the established production project");

if (containment.mode === "standalone") {
  check(!changedFiles.some((file) => file.endsWith(".sql")), "standalone release-hygiene delta changes no SQL");
  check(!changedFiles.some((file) => file.startsWith("supabase/migrations/")), "standalone release-hygiene delta does not alter canonical migrations");
  check(!changedFiles.some((file) => file.startsWith("supabase/rollback/")), "standalone release-hygiene delta does not alter canonical rollbacks");
} else {
  check(containment.supabaseTreeMatchesAuthorizedRef, "combined Supabase tree matches the authorized PR #9 ref exactly");
  check(containment.postAuthorizationDatabaseFiles.length === 0, "release-hygiene delta does not alter the authorized database candidate");
  check(
    containment.authorizedSupabaseDeltaFiles.length === 7,
    "combined integration contains only the seven approved PR #9 Supabase files",
  );
}

for (const functionName of [
  "impactValueForEvent",
  "possessionRuleForEvent",
  "calculatePossessionImpact",
  "calculateGameImpact",
  "calculateTotals",
  "calculateSeasonTotalsFromGames",
  "publicLiveShareGameFromPayload",
]) {
  check(
    extractFunction(app, functionName) === extractFunction(baseApp, functionName),
    `${functionName} is unchanged from origin/main`,
  );
}

for (const file of ["README.md", "access-and-trust.html", "privacy.html", "terms.html"]) {
  const text = read(file);
  check(/isolated staging/i.test(text), `${file} identifies isolated staging proof`);
  check(/managed preview/i.test(text), `${file} identifies managed preview proof`);
  check(/not (?:yet )?active in production|production activation|production defaults remain off/i.test(text), `${file} says production activation is pending`);
  check(/sensitive|private/i.test(text) && /notes|tags|backup/i.test(text), `${file} retains sensitive-data caution`);
}

console.log(`Release hygiene checks passed (${checks.length}/${checks.length}).`);
checks.forEach((message) => console.log(`PASS: ${message}`));
process.exit(0);
