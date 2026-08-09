const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "event-operation-service.js");
const server = { version: 1, note: "", changedAt: {}, calls: 0 };
async function rpc(request) {
  server.calls += 1;
  const overlap = Object.keys(request.changes).some((field) => server.changedAt[field] > request.base_event_version);
  if (request.base_event_version < server.version && overlap) {
    return { outcome: "conflicted", code: "same_field_conflict", server_event_version: server.version };
  }
  server.version += 1;
  if (Object.hasOwn(request.changes, "note")) server.note = request.changes.note;
  for (const field of Object.keys(request.changes)) server.changedAt[field] = server.version;
  return { outcome: request.base_event_version < server.version - 1 ? "merged" : "accepted", code: "corrected", server_event_version: server.version, server_event: { ...request.changes } };
}

(async () => {
  const webServer = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end('<main><p data-note></p><button data-save>Save correction</button><section data-status></section></main>');
  });
  await new Promise((resolve) => webServer.listen(0, "127.0.0.1", resolve));
  const executablePath = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"]
    .find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [];
  async function session(viewport) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction("eventRpc", rpc);
    await page.goto(`http://127.0.0.1:${webServer.address().port}`);
    await page.addScriptTag({ path: sourcePath });
    await page.evaluate(() => {
      const api = window.LaxHornetR207EventOperations;
      let state = api.emptyState();
      const game = { id: "browser-game", lifecycleState: "active" };
      const event = { id: "browser-event", gameId: game.id, timestamp: "2026-08-09T12:00:00Z", quarter: "Q1", statType: "goal", statLabel: "Goal", category: "Offense", pointValue: 1, tags: [], note: "", fieldZone: "", serverEventVersion: 1 };
      const service = api.createEventOperationService({
        getState: () => state, setState: (next) => { state = next; }, persistState: () => true,
        currentAccountId: () => "browser-account", isOffline: () => false, execute: window.eventRpc,
        onAccepted: (_operation, result) => { document.querySelector("[data-note]").textContent = result.server_event?.note || ""; },
        onConflict: () => { document.querySelector("[data-status]").textContent = api.CONFLICT_MESSAGE; },
      });
      service.hydrate(game, event);
      window.__eventSession = { state: () => state, service, game, event };
      document.querySelector("[data-save]").addEventListener("click", () => {
        window.__save = (async () => {
          service.queueEvent(game, { ...event, note: "device correction" });
          await service.process();
        })();
      });
    });
    return { context, page };
  }
  const a = await session({ width: 1280, height: 800 });
  const b = await session({ width: 390, height: 844 });
  await a.page.click("[data-save]"); await a.page.evaluate(() => window.__save);
  await b.page.click("[data-save]"); await b.page.evaluate(() => window.__save);
  assert.equal(server.note, "device correction", "second session cannot silently overwrite accepted event evidence");
  assert.match(await b.page.locator("[data-status]").innerText(), /event changed on another device/i);
  assert.doesNotMatch(await b.page.locator("body").innerText(), /same_field_conflict|browser-account|client_operation/i);
  assert.equal(await b.page.evaluate(() => window.__eventSession.state().operations[0].state), "conflicted");
  const callsAfterConflict = server.calls;
  await b.page.evaluate(() => window.__eventSession.service.process());
  assert.equal(server.calls, callsAfterConflict, "browser conflict is not blindly retried");
  assert.ok(await b.page.locator("[data-save]").isVisible(), "minimum correction control remains usable at narrow viewport");
  assert.equal(errors.length, 0, `browser errors: ${errors.join(" | ")}`);
  console.log("R2-07C two-session browser: 7/7 passed");
  await a.context.close(); await b.context.close(); await browser.close();
  await new Promise((resolve) => webServer.close(resolve));
})().catch((error) => { console.error(error); process.exitCode = 1; });
