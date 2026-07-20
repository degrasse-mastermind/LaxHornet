import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const version = JSON.parse(read("version.json")).version;
const versionNumber = version.replace(/^v/, "");
const appJs = read("app.js");
const serviceWorker = read("service-worker.js");
const appHtml = read("app.html");
const indexHtml = read("index.html");

expect(version === `v${versionNumber}` && versionNumber.length > 0, "version.json must contain a v-prefixed release");
expect(appJs.includes(`const APP_VERSION = "${version}";`), "app.js APP_VERSION must match version.json");
expect(serviceWorker.includes(`const CACHE_NAME = "laxhornet-${version}";`), "service-worker cache must match version.json");

for (const asset of ["app.js", "styles.css", "landing.css", "manifest.json"]) {
  expect(
    serviceWorker.includes(`./${asset}?v=${versionNumber}`),
    `service-worker asset ${asset} must use the current release marker`,
  );
}

for (const [file, content, assets] of [
  ["app.html", appHtml, ["app.js", "styles.css", "manifest.json"]],
  ["index.html", indexHtml, ["landing.css", "manifest.json"]],
]) {
  for (const asset of assets) {
    expect(content.includes(`${asset}?v=${versionNumber}`), `${file} ${asset} must use the current release marker`);
  }
}

expect(
  appJs.includes('.register("service-worker.js", { updateViaCache: "none" })'),
  "service worker registration must bypass the browser HTTP cache",
);

const waitingWorkerPath = appJs.slice(appJs.indexOf("async function applyAppUpdate()"));
const postMessageIndex = waitingWorkerPath.indexOf('worker.postMessage({ type: "SKIP_WAITING" })');
const cacheClearIndex = waitingWorkerPath.indexOf("await clearLaxHornetCaches()");
expect(postMessageIndex >= 0, "update flow must activate the waiting worker");
expect(
  cacheClearIndex < 0 || cacheClearIndex > postMessageIndex,
  "update flow must not delete the waiting worker cache before activation",
);

if (failures.length) {
  console.error(`Update release checks failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Update release checks passed for ${version}.`);
