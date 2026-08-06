const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const artifactRoot = path.join(root, ".pages-artifact");
const currentVersion = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version;
const currentCacheName = `laxhornet-${currentVersion}`;
const priorVersion = `v${Number(currentVersion.replace(/^v/, "")) - 1}`;
const priorCacheName = `laxhornet-${priorVersion}`;
const host = "127.0.0.1";
const configuredOrigin = String(process.env.LAXHORNET_PAGES_BASE_URL || "").replace(/\/+$/, "");
let serveLegacyWorker = false;
const legacyPriorWorker = `
const CACHE_NAME = "${priorCacheName}";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", "/app.html", "/version.json"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
`;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

function artifactFile(requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolved = path.resolve(artifactRoot, ...relative.split("/"));
  if (!resolved.startsWith(`${path.resolve(artifactRoot)}${path.sep}`)) return null;
  return resolved;
}

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/service-worker.js" && serveLegacyWorker) {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "application/javascript; charset=utf-8",
      });
      response.end(legacyPriorWorker);
      return;
    }
    const file = artifactFile(request.url);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(path.extname(file).toLowerCase()) || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve(server));
  });
}

async function run() {
  if (!configuredOrigin) {
    assert.ok(fs.existsSync(path.join(artifactRoot, "app.html")), "build the Pages artifact before browser validation");
  }
  const server = configuredOrigin ? null : await startServer();
  const address = server?.address();
  const origin = configuredOrigin || `http://${host}:${address.port}`;
  let browser;
  let context;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { channel: "chrome" } : {}),
    });
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  } catch (error) {
    if (server) await new Promise((resolve) => server.close(resolve));
    throw error;
  }
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(15_000);
  const failures = [];
  const internalRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => failures.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ""}`));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/^\/(?:tools|docs|review-evidence|supabase|release)(?:\/|$)/.test(pathname)) {
      internalRequests.push(pathname);
    }
  });

  try {
    console.log(configuredOrigin ? "STEP seed cache" : `STEP install legacy ${priorVersion} worker`);
    serveLegacyWorker = !configuredOrigin;
    await page.goto(`${origin}/version.json`, { waitUntil: "domcontentloaded" });
    if (configuredOrigin) {
      await page.evaluate(async ({ currentCacheName, priorCacheName }) => {
        const current = await caches.open(currentCacheName);
        await current.put("/tools/internal-probe.mjs", new Response("internal"));
        const previous = await caches.open(priorCacheName);
        await previous.put("/legacy", new Response("legacy"));
        await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" });
        await navigator.serviceWorker.ready;
      }, { currentCacheName, priorCacheName });
      await page.reload({ waitUntil: "domcontentloaded" });
    } else {
      await page.evaluate(async () => {
        await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" });
        await navigator.serviceWorker.ready;
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);
      await page.evaluate(async ({ currentCacheName, priorCacheName }) => {
        const current = await caches.open(priorCacheName);
        await current.put("/tools/internal-probe.mjs", new Response("internal"));
        const previous = await caches.open(`laxhornet-v${Number(priorCacheName.replace(/^laxhornet-v/, "")) - 1}`);
        await previous.put("/legacy", new Response("legacy"));
      }, { currentCacheName, priorCacheName });
      console.log(`STEP upgrade legacy ${priorVersion} worker to ${currentVersion} worker`);
      serveLegacyWorker = false;
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("new release worker did not activate")), 10_000);
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
          registration.update().then(async () => {
            const waiting = registration.waiting || registration.installing;
            if (!waiting) throw new Error("new release worker was not installed");
            if (waiting.state !== "installed") {
              await new Promise((installed) => waiting.addEventListener("statechange", () => {
                if (waiting.state === "installed") installed();
              }));
            }
            waiting.postMessage({ type: "SKIP_WAITING" });
          }).catch(reject);
        });
      });
    }
    await page.waitForFunction(async (currentCacheName) => {
      const keys = await caches.keys();
      const current = await caches.open(currentCacheName);
      return keys.length === 1
        && keys[0] === currentCacheName
        && !(await current.match("/tools/internal-probe.mjs"));
    }, currentCacheName);
    failures.length = 0;

    console.log("STEP online app");
    await page.goto(`${origin}/app.html?qa=allowlisted-pages`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      true,
      "service worker must control the artifact app",
    );
    assert.match(await page.locator("body").innerText(), new RegExp(`App version:\\s*${currentVersion}`, "i"));
    assert.equal(await page.getByRole("button", { name: "Watch Live" }).isVisible(), true);
    assert.equal(
      await page.evaluate(() => typeof window.trackedTimeSummary === "function"),
      true,
      "tracked-time runtime must load",
    );

    await page.getByRole("button", { name: "View Demo Game" }).click();
    await page.getByRole("heading", { name: "Sample Completed Game Review" }).waitFor();
    assert.equal(internalRequests.length, 0, `runtime requested internal paths: ${internalRequests.join(", ")}`);
    assert.deepEqual(failures, [], `browser errors before offline transition:\n${failures.join("\n")}`);

    const internalResponse = await page.request.get(`${origin}/tools/test_event_operation_service.mjs`);
    assert.equal(internalResponse.status(), 404, "internal tooling must be unavailable from the artifact");

    console.log("STEP offline app shell");
    await context.setOffline(true);
    await page.goto(`${origin}/app.html?qa=offline-shell`, { waitUntil: "domcontentloaded" });
    assert.match(await page.locator("body").innerText(), /Track the plays that show the whole game|Demo Game/);
    assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);
    await context.setOffline(false);
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
    await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

run()
  .then(() => console.log("Pages artifact browser: PASS"))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
