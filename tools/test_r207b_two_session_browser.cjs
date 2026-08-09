const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "event-operation-service.js");
const versions = { gameRevision: 1, metadataVersion: 1, scoreVersion: 1, statusVersion: 1, rosterContextVersion: 1, sharingVersion: 1 };
const server = { opponent: "Original", location: "Field 1", metadataVersion: 1, calls: 0 };

async function rpc(actor, request) {
  server.calls += 1;
  if (actor === "unauthorized") return { outcome: "rejected", code: "authorization_denied" };
  if (request.game_id === "tombstoned-game") return { outcome: "deleted", code: "game_deleted" };
  const field = request.changed_fields[0];
  if (request.base_version < server.metadataVersion && field === "opponent") {
    return { outcome: "conflicted", code: "field_conflict", conflict_id: "private-conflict-id", versions: { ...versions, metadataVersion: server.metadataVersion } };
  }
  if (field === "opponent") server.opponent = request.changes.opponent;
  if (field === "location") server.location = request.changes.location;
  const merged = request.base_version < server.metadataVersion;
  server.metadataVersion += 1;
  return { outcome: merged ? "merged" : "accepted", versions: { ...versions, metadataVersion: server.metadataVersion }, server_game: { opponent: server.opponent, location: server.location } };
}

(async () => {
  const webServer = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<main><p data-server>Original</p><button data-save>Save</button><section data-notice></section></main>`);
  });
  await new Promise((resolve) => webServer.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${webServer.address().port}`;
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [];

  async function session({ actor = "synthetic-account", featureFlag = true, viewport = { width: 1280, height: 800 }, gameId = "synthetic-game" } = {}) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction("syntheticRpc", (request) => rpc(actor, request));
    await page.exposeFunction("syntheticServerState", () => ({ ...server }));
    await page.goto(baseUrl);
    await page.addScriptTag({ path: sourcePath });
    await page.evaluate(({ actor, featureFlag, gameId, versions }) => {
      const api = window.LaxHornetR207FieldOperations;
      let localState = api.emptyState();
      const game = { id: gameId, opponent: "Original", date: "2026-08-09", location: "Field 1", gameType: "Scrimmage", lifecycleState: "active", serverVersions: versions };
      const service = api.createFieldOperationService({
        getState: () => localState,
        setState: (next) => { localState = next; },
        persistState: () => true,
        currentAccountId: () => actor,
        isOffline: () => false,
        execute: (request) => window.syntheticRpc(request),
        onAccepted: (_operation, result) => { document.querySelector("[data-server]").textContent = result.server_game?.opponent || game.opponent; },
        onConflict: () => {
          const notice = document.querySelector("[data-notice]");
          notice.innerHTML = `<p>${api.CONFLICT_MESSAGE}</p><button data-refresh>Refresh game</button>`;
          notice.querySelector("[data-refresh]").addEventListener("click", async () => {
            const latest = await window.syntheticServerState();
            document.querySelector("[data-server]").textContent = latest.opponent;
            service.markConflictRefreshed(game.id, { ...game.serverVersions, metadataVersion: latest.metadataVersion });
            notice.textContent = "Latest game loaded";
          });
        },
        onRejected: (_operation, result) => { document.querySelector("[data-notice]").textContent = result.code === "authorization_denied" ? "This account cannot save that game." : "This saved game is no longer available."; },
      });
      window.__r207 = { getState: () => localState, service };
      document.querySelector("[data-save]").addEventListener("click", () => {
        window.__lastR207Save = (async () => {
          if (!featureFlag) return;
          const next = { ...game, opponent: actor === "synthetic-account" ? "Device change" : actor };
          const operation = api.buildMetadataOperation({ before: game, after: next, clientOperationId: `${actor}-${gameId}`, createdAt: Date.now() });
          await service.queue(operation);
          await service.process();
        })();
      });
    }, { actor, featureFlag, gameId, versions });
    return { context, page };
  }

  const a = await session();
  const b = await session({ viewport: { width: 390, height: 844 } });
  await a.page.evaluate(async () => { document.querySelector("[data-save]").click(); await window.__lastR207Save; });
  await b.page.evaluate(async () => { document.querySelector("[data-save]").click(); await window.__lastR207Save; });
  assert.equal(server.opponent, "Device change", "stale second session must not overwrite accepted value");
  assert.match(await b.page.locator("[data-notice]").innerText(), /changed on another device/i);
  assert.doesNotMatch(await b.page.locator("body").innerText(), /private-conflict-id|field_conflict|synthetic-account-/i);
  await b.page.locator("[data-refresh]").click();
  assert.equal(await b.page.locator("[data-server]").innerText(), "Device change");
  assert.ok((await b.page.evaluate(() => window.__r207.getState().operations[0].state)) === "superseded");
  assert.ok(await b.page.evaluate(() => Boolean(window.__r207.getState().conflicts["synthetic-game"].proposedChanges.opponent)));

  const nonOverlap = await session();
  await nonOverlap.page.evaluate(async () => {
    const api = window.LaxHornetR207FieldOperations;
    const game = { id: "synthetic-game", opponent: "Original", date: "2026-08-09", location: "Field 1", gameType: "Scrimmage", lifecycleState: "active", serverVersions: { gameRevision: 1, metadataVersion: 1, scoreVersion: 1, statusVersion: 1, rosterContextVersion: 1, sharingVersion: 1 } };
    await window.__r207.service.queue(api.buildMetadataOperation({ before: game, after: { ...game, location: "Field 2" }, clientOperationId: "non-overlap-browser", createdAt: Date.now() }));
    await window.__r207.service.process();
  });
  assert.equal(server.location, "Field 2", "non-overlapping stale change should merge");

  const unauthorized = await session({ actor: "unauthorized" });
  await unauthorized.page.evaluate(async () => { document.querySelector("[data-save]").click(); await window.__lastR207Save; });
  assert.match(await unauthorized.page.locator("[data-notice]").innerText(), /cannot save/i);
  assert.doesNotMatch(await unauthorized.page.locator("body").innerText(), /synthetic-game|private-conflict-id/i);

  const tombstoned = await session({ gameId: "tombstoned-game" });
  await tombstoned.page.evaluate(async () => { document.querySelector("[data-save]").click(); await window.__lastR207Save; });
  assert.match(await tombstoned.page.locator("[data-notice]").innerText(), /no longer available/i);

  const callsBeforeOff = server.calls;
  const disabled = await session({ featureFlag: false });
  await disabled.page.evaluate(async () => { document.querySelector("[data-save]").click(); await window.__lastR207Save; });
  assert.equal(server.calls, callsBeforeOff, "default-off path must make no v2 request");
  assert.equal((await b.page.viewportSize()).width, 390, "conflict journey runs at mobile viewport");
  assert.deepEqual(errors, [], `browser console errors: ${errors.join(" | ")}`);

  for (const item of [a, b, nonOverlap, unauthorized, tombstoned, disabled]) await item.context.close();
  await browser.close();
  await new Promise((resolve) => webServer.close(resolve));
  console.log("R2-07B two-session browser: 12/12 passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
