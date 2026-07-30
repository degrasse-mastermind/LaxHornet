const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, "tools", "fixtures", "lh-dev-006-storage-safety.json"), "utf8"),
);
const port = Number(process.env.LAXHORNET_STORAGE_SAFETY_PORT || 5276);
const baseUrl = `http://127.0.0.1:${port}`;
const results = [];
const browserIssues = [];
const hostedRequests = [];

function check(condition, message, details = null) {
  results.push({ passed: Boolean(condition), message, details });
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, baseUrl).pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const target = path.resolve(root, relative);
      if (!target.startsWith(root) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      if (relative === "assets/supabase.min.js") {
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/javascript; charset=utf-8",
        });
        response.end("window.supabase={createClient:()=>null};");
        return;
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentType(target),
      });
      response.end(fs.readFileSync(target));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function supportKeys(primaryKey) {
  return {
    backup: `${primaryKey}.safety.backup`,
    quarantine: `${primaryKey}.safety.quarantine`,
  };
}

async function scenario(browser, name, entries, verify) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await context.addInitScript((initialEntries) => {
    for (const [key, value] of Object.entries(initialEntries)) localStorage.setItem(key, value);
  }, entries);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("console", (message) => {
    if (
      ["error", "warning"].includes(message.type())
      && message.text() !== "Service Worker registration blocked by Playwright"
    ) {
      browserIssues.push({ scenario: name, type: message.type(), message: message.text() });
    }
  });
  page.on("pageerror", (error) => browserIssues.push({
    scenario: name,
    type: "pageerror",
    message: error.message,
  }));
  page.on("request", (request) => {
    if (/https:\/\/[a-z0-9-]+\.supabase\.co/i.test(request.url())) hostedRequests.push(request.url());
  });
  try {
    await page.goto(`${baseUrl}/app.html?fresh=lh-dev-006-${name}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof state !== "undefined" && Array.isArray(state.games));
    return await verify(page, context);
  } finally {
    await context.close();
  }
}

(async () => {
  const server = await startServer();
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const gamesRaw = JSON.stringify(fixture.savedGames);
    const activeRaw = JSON.stringify(fixture.activeGame);
    const normal = await scenario(
      browser,
      "normal",
      {
        "laxhornet.games": gamesRaw,
        "laxhornet.activeGame": activeRaw,
      },
      (page) => page.evaluate(() => ({
        title: document.title,
        meaningful: document.body.innerText.includes("Track the plays"),
        savedGameIds: state.games.map((game) => game.id),
        activeGameId: state.activeGame?.id || "",
      })),
    );
    check(
      normal.title === "LaxHornet App"
        && normal.meaningful
        && normal.savedGameIds.includes("synthetic-game-saved")
        && normal.activeGameId === "synthetic-game-active",
      "normal startup loads valid existing saved and active game data",
      normal,
    );

    const gameKeys = supportKeys("laxhornet.games");
    const recovered = await scenario(
      browser,
      "saved-game-recovery",
      {
        "laxhornet.games": "{malformed",
        [gameKeys.backup]: gamesRaw,
      },
      (page) => page.evaluate(() => ({
        gameIds: state.games.map((game) => game.id),
        primaryId: JSON.parse(localStorage.getItem("laxhornet.games") || "[]")[0]?.id || "",
        quarantine: JSON.parse(localStorage.getItem("laxhornet.games.safety.quarantine") || "null")?.raw || "",
      })),
    );
    check(
      recovered.gameIds.includes("synthetic-game-saved")
        && recovered.primaryId === "synthetic-game-saved"
        && recovered.quarantine === "{malformed",
      "malformed saved-games primary recovers from a valid backup",
      recovered,
    );

    const activeKeys = supportKeys("laxhornet.activeGame");
    const offline = await scenario(
      browser,
      "active-game-recovery-offline-save",
      {
        "laxhornet.games": gamesRaw,
        "laxhornet.activeGame": "{malformed",
        [activeKeys.backup]: activeRaw,
      },
      async (page, context) => {
        await page.evaluate(() => {
          state.authUser = { id: "synthetic-local-user", email: "synthetic@example.invalid" };
          state.authUserId = "synthetic-local-user";
          state.userProfile = {
            firstName: "Synthetic",
            lastName: "Local",
            onboardingCompleted: true,
            appRole: "tracker",
          };
          state.screen = "live";
          render();
        });
        await context.setOffline(true);
        await page.locator('[data-stat="groundBall"]').click();
        return page.evaluate(() => {
          const stored = JSON.parse(localStorage.getItem("laxhornet.activeGame"));
          return {
            activeGameId: state.activeGame?.id || "",
            stateEventCount: state.activeGame?.events.length || 0,
            storedEventCount: stored?.events.length || 0,
            lastStatType: stored?.events.at(-1)?.statType || "",
          };
        });
      },
    );
    check(
      offline.activeGameId === "synthetic-game-active"
        && offline.stateEventCount === 1
        && offline.storedEventCount === 1
        && offline.lastStatType === "groundBall",
      "active game recovers and one offline event persists immediately",
      offline,
    );

    check(browserIssues.length === 0, "browser smoke has no unexpected console or page errors", browserIssues);
    check(hostedRequests.length === 0, "browser smoke does not contact hosted Supabase", hostedRequests);

    for (const result of results) {
      console.log(`${result.passed ? "PASS" : "FAIL"} ${result.message}`);
      if (!result.passed && result.details) console.log(JSON.stringify(result.details, null, 2));
    }
    const failures = results.filter((result) => !result.passed);
    console.log(`\n${results.length - failures.length}/${results.length} local-storage browser checks passed.`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
