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
  allowedAdditiveDbPaths: [
    "supabase/migrations/20260723040000_event_pipeline_capabilities.sql",
    "supabase/rollback/20260723040000_event_pipeline_capabilities_rollback.sql",
  ],
  headRef: process.env.LAXHORNET_ACTIVATION_HEAD_REF?.trim() || "HEAD",
});

const versionNumber = Number(version.replace(/^v/, ""));
check(versionNumber >= 282, "version manifest identifies a secure-disclosure release");
check(app.includes(`const APP_VERSION = "${version}";`), "app runtime matches the version manifest");
check(serviceWorker.includes(`const CACHE_NAME = "laxhornet-${version}";`), "service worker uses the release cache");
check(appHtml.includes(`runtime-config.js?v=${versionNumber}`), "app shell loads the release runtime configuration");
check(
  appHtml.indexOf(`runtime-config.js?v=${versionNumber}`)
    < appHtml.indexOf(`event-operation-service.js?v=${versionNumber}`)
    && appHtml.indexOf(`event-operation-service.js?v=${versionNumber}`)
      < appHtml.indexOf(`app.js?v=${versionNumber}`),
  "runtime configuration and event service appear before deferred app.js",
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
check(serviceWorker.includes("caches.match(RUNTIME_CONFIG_ASSET)"), "runtime configuration has a versioned offline cache fallback");
check(serviceWorker.includes("keys.filter((key) => key !== CACHE_NAME)"), "activation removes stale LaxHornet caches");
check(app.includes("SECURE_DISCLOSURE_RUNTIME_READY"), "app detects complete activation configuration");
check(app.includes('reportSecureDisclosureUnavailable("Live Share")'), "missing activation configuration blocks Live Share truthfully");
check(app.includes("Secure export is temporarily unavailable"), "missing activation configuration blocks audited exports truthfully");
const sharedLoader = app.slice(app.indexOf("async function loadSharedGame"), app.indexOf("async function copyShareLink"));
check(!sharedLoader.includes('.from("games")'), "anonymous Live Share has no ordinary-table fallback");
check(app.includes("requireSecureCapability"), "secure disclosure requires a backend capability handshake");

const sqlDelta = containment.releaseDeltaFiles.filter((file) => file.endsWith(".sql"));
check(
  sqlDelta.every((file) => /20260723040000_event_pipeline_capabilities/.test(file)),
  "activation cleanup changes only the additive capability migration and rollback",
);

console.log(`Secure-disclosure activation checks passed (${checks.length}/${checks.length}).`);
checks.forEach((message) => console.log(`PASS: ${message}`));
