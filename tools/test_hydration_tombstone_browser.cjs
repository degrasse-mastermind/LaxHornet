const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const accountId = "00000000-0000-4000-8000-000000000001";
const deletedGameId = "R206P-Deleted-Game";
const unrelatedGameId = "r206p-unrelated-game";

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function supabaseStub() {
  return `
  (() => {
    const accountId = ${JSON.stringify(accountId)};
    const deletedGameId = ${JSON.stringify(deletedGameId.toLowerCase())};
    const requests = [];
    window.__R206P_SUPABASE_REQUESTS = requests;
    const session = {
      access_token: "disposable-access",
      refresh_token: "disposable-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: accountId, email: "disposable@example.invalid" },
    };
    function tableResult(table) {
      if (table === "legacy_game_tombstones") return {
        data: [{
          game_id: deletedGameId,
          deletion_id: "disposable-deletion",
          device_id: "disposable-device",
          deleted_at: "2026-08-01T12:00:00.000Z",
          known_game_saved_at: "2026-08-01T11:00:00.000Z",
          created_at: "2026-08-01T12:00:00.000Z",
          updated_at: "2026-08-01T12:00:00.000Z",
        }], error: null,
      };
      if (table === "games") return {
        data: [{
          id: deletedGameId,
          user_id: accountId,
          player_id: "disposable-player",
          opponent: "Disposable",
          game_date: "2026-08-01",
          status: "complete",
          saved_at: "2026-08-01T13:00:00.000Z",
          events: [],
        }], error: null,
      };
      return { data: [], error: null };
    }
    function builder(table) {
      const value = () => tableResult(table);
      const chain = {
        select() { return chain; }, eq() { return chain; }, in() { return chain; },
        order() { return Promise.resolve(value()); }, limit() { return chain; },
        insert() { requests.push({ type: "insert", table }); return chain; },
        upsert() { requests.push({ type: "upsert", table }); return chain; },
        update() { requests.push({ type: "update", table }); return chain; },
        delete() { requests.push({ type: "delete", table }); return chain; },
        single() { return Promise.resolve(value()); },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        then(resolve, reject) { return Promise.resolve(value()).then(resolve, reject); },
      };
      return chain;
    }
    window.supabase = {
      createClient() {
        return {
          auth: {
            async getSession() { return { data: { session }, error: null }; },
            onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
            async signInWithPassword() { return { data: { session, user: session.user }, error: null }; },
            async signUp() { return { data: { session, user: session.user }, error: null }; },
            async signOut() { return { error: null }; },
          },
          from(table) { requests.push({ type: "select", table }); return builder(table); },
          async rpc(name, body) {
            requests.push({
              type: name === "laxhornet_sync_game" ? "game_write" : "rpc",
              name,
              gameId: body?.p_operation?.game_row?.id || "",
            });
            return { data: [], error: null };
          },
          channel() { return { on() { return this; }, subscribe() { return this; } }; },
          removeChannel() {},
        };
      },
    };
  })();`;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      if (relative === "assets/supabase.min.js") {
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "application/javascript; charset=utf-8",
        });
        response.end(supabaseStub());
        return;
      }
      const target = path.resolve(root, relative);
      if (!target.startsWith(root) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": contentType(target),
      });
      response.end(fs.readFileSync(target));
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function game(id) {
  return {
    id,
    userId: accountId,
    playerId: "disposable-player",
    opponent: id === unrelatedGameId ? "Unrelated" : "Deleted",
    date: "2026-08-01",
    status: "complete",
    savedAt: "2026-08-01T14:00:00.000Z",
    events: [],
  };
}

async function inspect(page) {
  return page.evaluate(({ accountId: id, deletedGameId: deletedId, unrelatedGameId: keepId }) => {
    const normalized = (value) => String(value || "").trim().toLowerCase();
    const matches = (value) => normalized(value) === normalized(deletedId);
    const gameKey = `laxhornet.games.user.${id}`;
    const rawKeys = [
      gameKey,
      `${gameKey}.safety.backup`,
      `${gameKey}.safety.staging`,
      `${gameKey}.safety.quarantine`,
      `laxhornet.activeGame.user.${id}`,
      `laxhornet.trackingSession.user.${id}`,
      `laxhornet.reviewGameId.user.${id}`,
    ];
    const canonicalRaw = rawKeys.map((key) => localStorage.getItem(key) || "");
    const presence = window.LAXHORNET_HYDRATION_INSPECTOR.gamePresence(deletedId);
    const diagnostics = window.LAXHORNET_HYDRATION_INSPECTOR.diagnostics();
    return {
      rawStorageClean: canonicalRaw.every((raw) => !raw.toLowerCase().includes(deletedId.toLowerCase())),
      applicationStateClean: Object.values(presence).every((value) => value === false),
      renderedUiClean: [...document.querySelectorAll("[data-game-id]")]
        .every((node) => !matches(node.dataset.gameId)),
      unrelatedGamePreserved: state.games.some((item) => normalized(item.id) === normalized(keepId)),
      diagnostics,
      resurrectionWrites: window.__R206P_SUPABASE_REQUESTS
        .filter((entry) => entry.type === "game_write" && matches(entry.gameId)).length,
      tombstoneStored: JSON.parse(
        localStorage.getItem(`laxhornet.syncOperations.v1.user.${id}`) || "{}",
      ).tombstones?.some((item) => matches(item.gameId)) === true,
    };
  }, { accountId, deletedGameId, unrelatedGameId });
}

(async () => {
  const { server, origin } = await startServer();
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await context.addInitScript(({ accountId: id, deleted, unrelated }) => {
    const key = (base) => `${base}.user.${id}`;
    const games = [deleted, unrelated];
    localStorage.setItem(key("laxhornet.games"), JSON.stringify(games));
    localStorage.setItem(`${key("laxhornet.games")}.safety.backup`, JSON.stringify(games));
    localStorage.setItem(key("laxhornet.activeGame"), JSON.stringify(deleted));
    localStorage.setItem(key("laxhornet.trackingSession"), JSON.stringify({ gameId: deleted.id }));
    localStorage.setItem(key("laxhornet.reviewGameId"), JSON.stringify(deleted.id));
    localStorage.setItem(key("laxhornet.syncOperations.v1"), JSON.stringify({
      schemaVersion: 1,
      deviceId: "disposable-device",
      operations: [{
        operationId: "stale-write",
        operationType: "legacy_game_write",
        accountId: id,
        gameId: deleted.id,
        deviceId: "disposable-device",
        coalescingKey: `legacy_game_write:${deleted.id}`,
        createdAt: "2026-08-01T11:00:00.000Z",
        updatedAt: "2026-08-01T11:00:00.000Z",
        attemptCount: 0,
        lastAttemptAt: null,
        nextAttemptAt: null,
        state: "pending",
        payload: { gameRow: { id: deleted.id, user_id: id } },
        payloadHash: "stale",
        payloadRevision: 1,
        baseRevision: null,
        lastError: null,
        receipt: null,
      }],
      tombstones: [],
      deleteRecoveries: [],
      acknowledgments: {},
    }));
  }, { accountId, deleted: game(deletedGameId), unrelated: game(unrelatedGameId) });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  try {
    await page.goto(`${origin}/app.html?fresh=r206p-disposable`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => window.LAXHORNET_HYDRATION_DIAGNOSTICS?.tombstoneSuppressionComplete === true,
      null,
      { timeout: 15_000 },
    );
    const first = await inspect(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => navigator.serviceWorker.controller
        && window.LAXHORNET_HYDRATION_DIAGNOSTICS?.tombstoneSuppressionComplete === true,
      null,
      { timeout: 15_000 },
    );
    const controlledReload = await inspect(page);
    for (const [label, result] of [["fresh", first], ["service-worker reload", controlledReload]]) {
      assert.equal(result.rawStorageClean, true, `${label}: raw storage`);
      assert.equal(result.applicationStateClean, true, `${label}: application state`);
      assert.equal(result.renderedUiClean, true, `${label}: rendered UI`);
      assert.equal(result.unrelatedGamePreserved, true, `${label}: unrelated game`);
      assert.equal(result.tombstoneStored, true, `${label}: retained tombstone`);
      assert.equal(result.resurrectionWrites, 0, `${label}: resurrection writes`);
      assert.equal(result.diagnostics.tombstonesLoaded, true, `${label}: tombstones loaded`);
      assert.equal(result.diagnostics.tombstoneSuppressionComplete, true, `${label}: suppression complete`);
    }
    assert.deepEqual(browserErrors, []);
    process.stdout.write("R2-06P disposable browser hydration: raw storage, application state, rendered UI, and controlled reload passed\n");
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
