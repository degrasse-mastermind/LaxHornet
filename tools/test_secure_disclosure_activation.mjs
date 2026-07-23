import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { validateReleaseContainmentFromEnvironment } from "./release_containment.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const appHtml = read("app.html");
const runtimeConfig = read("runtime-config.js");
const serviceWorker = read("service-worker.js");
const version = JSON.parse(read("version.json")).version;
const checks = [];

function check(condition, message) {
  assert.ok(condition, message);
  checks.push(message);
}

const containment = validateReleaseContainmentFromEnvironment(root, {
  releaseBaseRef:
    process.env.LAXHORNET_ACTIVATION_BASE_REF?.trim() ||
    "origin/review/release-hygiene-v281",
  authorizedDbRef: "",
  headRef: process.env.LAXHORNET_ACTIVATION_HEAD_REF?.trim() || "HEAD",
});

check(version === "v282", "version manifest identifies v282");
check(app.includes('const APP_VERSION = "v282";'), "app runtime identifies v282");
check(serviceWorker.includes('const CACHE_NAME = "laxhornet-v282";'), "service worker uses the v282 cache");
check(appHtml.includes('runtime-config.js?v=282'), "app shell loads the v282 runtime configuration");
check(
  appHtml.indexOf('runtime-config.js?v=282') < appHtml.indexOf('app.js?v=282'),
  "deferred runtime configuration appears before deferred app.js",
);
check(
  runtimeConfig.includes("...(window.LAXHORNET_RUNTIME_CONFIG || {})"),
  "runtime configuration preserves existing non-secret values",
);
for (const flag of ["publicLiveShareRpc", "liveShareTokenRpc", "exportAuditRpc"]) {
  check(runtimeConfig.includes(`${flag}: true`), `${flag} is explicitly enabled`);
}
check(!/supabase\.co|sb_publishable_|service[_-]?role|eyJ[a-zA-Z0-9_-]+\./i.test(runtimeConfig), "runtime configuration contains no host or credential");
check(serviceWorker.includes('requestUrl.pathname.endsWith("/runtime-config.js")'), "service worker has a dedicated runtime-config route");
check(serviceWorker.includes('fetch(event.request, { cache: "no-store" })'), "runtime configuration prefers a no-store network fetch");
check(serviceWorker.includes("caches.match(RUNTIME_CONFIG_ASSET)"), "runtime configuration has a v282 offline cache fallback");
check(serviceWorker.includes("keys.filter((key) => key !== CACHE_NAME)"), "activation removes stale LaxHornet caches");
check(app.includes("SECURE_DISCLOSURE_RUNTIME_READY"), "app detects complete activation configuration");
check(app.includes('reportSecureDisclosureUnavailable("Live Share")'), "missing activation configuration blocks Live Share truthfully");
check(app.includes("Secure export is temporarily unavailable"), "missing activation configuration blocks audited exports truthfully");
check(app.includes('.select("*, events(*)")'), "legacy fallback source remains for a later cleanup release");

const readinessGuard = app.indexOf("if (!SECURE_DISCLOSURE_RUNTIME_READY)", app.indexOf("async function loadSharedGame"));
const legacyRead = app.indexOf('.select("*, events(*)")', app.indexOf("async function loadSharedGame"));
check(readinessGuard >= 0 && readinessGuard < legacyRead, "v282 blocks before the legacy anonymous table read");

check(!containment.releaseDeltaFiles.some((file) => file.endsWith(".sql")), "v282 activation delta changes no SQL");
check(!containment.releaseDeltaFiles.some((file) => file.startsWith("supabase/")), "v282 activation delta changes no Supabase files");

console.log(`Secure-disclosure activation checks passed (${checks.length}/${checks.length}).`);
checks.forEach((message) => console.log(`PASS: ${message}`));
