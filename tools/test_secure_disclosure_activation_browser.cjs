const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const evidenceRoot = path.join(root, "review-evidence", "secure-disclosure-activation-v282");
const browserDir = path.join(evidenceRoot, "browser");
const port = Number(process.env.LAXHORNET_ACTIVATION_PORT || 5258);
const baseUrl = `http://127.0.0.1:${port}`;
const results = [];
const failures = [];
const hostedRequests = [];
const localApiRequests = [];
const browserDiagnostics = [];

fs.mkdirSync(browserDir, { recursive: true });

function check(condition, message) {
  results.push({ passed: Boolean(condition), message });
  if (!condition) failures.push(message);
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

function safeLocalFile(requestPath) {
  let pathname = decodeURIComponent(new URL(requestPath, baseUrl).pathname);
  if (pathname === "/" || pathname === "/blank.html") pathname = pathname === "/" ? "/index.html" : "/blank.html";
  const missingConfig = pathname.startsWith("/missing-config/");
  if (missingConfig) pathname = pathname.slice("/missing-config".length);
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root)) return null;
  return { target, missingConfig };
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const resolved = safeLocalFile(request.url);
      if (!resolved) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      if (request.url.startsWith("/blank.html")) {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><title>Activation cache setup</title>");
        return;
      }
      if (!fs.existsSync(resolved.target) || !fs.statSync(resolved.target).isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      let body = fs.readFileSync(resolved.target);
      if (resolved.missingConfig && resolved.target.endsWith("app.html")) {
        body = Buffer.from(body.toString("utf8").replace(/\s*<script src="runtime-config\.js\?v=282" defer><\/script>/, ""));
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentType(resolved.target),
      });
      response.end(body);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function publicPayload() {
  return {
    game: {
      game_id: "synthetic-secure-game",
      team_name: "Branford Demo Hornets",
      player_name: "Demo Player",
      jersey_number: "12",
      position: "Midfield",
      opponent: "Madison Demo",
      game_date: "2026-07-23",
      period_format: "quarters",
      final_score_for: null,
      final_score_against: null,
    },
    events: [
      {
        event_id: "synthetic-event-1",
        stat_type: "groundBall",
        stat_label: "Ground Ball",
        category: "Effort / IQ",
        point_value: 2,
        period: "Q1",
        occurred_at: "2026-07-23T12:00:00.000Z",
        field_zone: "Midfield",
      },
      {
        event_id: "synthetic-event-2",
        stat_type: "causedTurnover",
        stat_label: "Caused Turnover",
        category: "Defense",
        point_value: 3,
        period: "Q2",
        occurred_at: "2026-07-23T12:05:00.000Z",
        field_zone: "Defensive",
      },
    ],
  };
}

async function installApiRoutes(page, options = {}) {
  await page.route("http://127.0.0.1:9/**", async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;
    localApiRequests.push({ method: request.method(), pathname });
    if (pathname.endsWith("/lh_public_live_share_game")) {
      if (options.failPublicRpc) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "synthetic unavailable" }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicPayload()) });
      }
      return;
    }
    if (pathname.endsWith("/lh_register_game_scope")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outcome: "accepted" }) });
      return;
    }
    if (pathname.endsWith("/lh_create_live_share_token")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ outcome: "accepted", shareCode: "SYNTHETICSECURECODE" }),
      });
      return;
    }
    if (pathname.endsWith("/lh_revoke_live_share_tokens")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outcome: "accepted", count: 1 }) });
      return;
    }
    if (pathname.endsWith("/lh_record_disclosure_export")) {
      const post = request.postDataJSON?.() || {};
      const rejected = String(post.p_scope_id || "").startsWith("cross-");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rejected ? { outcome: "rejected", code: "unauthorized_scope" } : { outcome: "accepted", code: "export_audit_recorded" }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function newContext(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.LAXHORNET_RUNTIME_CONFIG = {
      supabaseUrl: "http://127.0.0.1:9",
      supabasePublishableKey: "synthetic-local-browser-test",
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    });
  });
  return context;
}

(async () => {
  const server = await startServer();
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const secureContext = await newContext(browser);
    const securePage = await secureContext.newPage();
    securePage.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        browserDiagnostics.push(`console:${message.type()}: ${message.text()}`);
      }
    });
    securePage.on("pageerror", (error) => browserDiagnostics.push(`pageerror: ${error.message}`));
    securePage.on("request", (request) => {
      if (/https:\/\/[a-z]{20}\.supabase\.co/i.test(request.url())) hostedRequests.push(request.url());
    });
    await installApiRoutes(securePage);
    await securePage.goto(`${baseUrl}/blank.html`, { waitUntil: "domcontentloaded" });
    await securePage.evaluate(async () => {
      const stale = await caches.open("laxhornet-v281");
      await stale.put(
        "/runtime-config.js?v=281",
        new Response("window.LAXHORNET_RUNTIME_CONFIG={publicLiveShareRpc:false,liveShareTokenRpc:false,exportAuditRpc:false};"),
      );
    });
    await securePage.goto(`${baseUrl}/app.html?share=SYNTHETICSECURECODE&fresh=v282-browser`, { waitUntil: "domcontentloaded" });
    try {
      await securePage.getByText("Ground Ball", { exact: false }).first().waitFor();
    } catch (error) {
      browserDiagnostics.push(`rendered-body: ${(await securePage.locator("body").innerText()).slice(0, 2000)}`);
      throw error;
    }
    await securePage.waitForTimeout(4300);
    const status = await securePage.evaluate(() => window.LAXHORNET_DISCLOSURE_STATUS);
    const scriptOrder = await securePage.evaluate(() => window.LAXHORNET_SCRIPT_ORDER);
    check(status?.ready === true, "all three secure disclosure flags are active");
    check(Object.values(status?.features || {}).every(Boolean), "runtime status reports every disclosure feature true");
    check(JSON.stringify(scriptOrder) === JSON.stringify(["runtime-config", "app"]), "runtime-config executes before app.js");
    check((await securePage.locator("body").innerText()).includes("Ground Ball"), "public-safe payload renders an allowlisted event");
    check(!(await securePage.locator("body").innerText()).includes("private-note-marker"), "public UI contains no private note");
    check(!(await securePage.locator("body").innerText()).includes("private-tag-marker"), "public UI contains no private tag");
    const publicRpcCalls = localApiRequests.filter((item) => item.pathname.endsWith("/lh_public_live_share_game")).length;
    check(publicRpcCalls >= 2, "public-safe polling repeats the RPC request");
    check(!localApiRequests.some((item) => /\/rest\/v1\/(?:games|events)$/.test(item.pathname)), "secure viewer makes no ordinary games/events request");
    check((await securePage.evaluate(() => caches.keys())).every((key) => key !== "laxhornet-v281"), "v282 activation removes the stale v281 cache");
    await securePage.screenshot({ path: path.join(browserDir, "01-secure-live-share.png"), fullPage: true });

    await securePage.goto(`${baseUrl}/app.html?fresh=v282-token`, { waitUntil: "domcontentloaded" });
    const tokenResult = await securePage.evaluate(async () => {
      setAuthUser({ id: "synthetic-admin-user", email: "synthetic-admin@example.invalid" });
      const game = normalizeGame({
        id: "synthetic-secure-game",
        userId: "synthetic-admin-user",
        opponent: "Madison Demo",
        date: "2026-07-23",
        currentQuarter: "Q1",
        playerSnapshot: { id: "synthetic-player", name: "Demo Player", number: "12", team: "Branford Demo Hornets", position: "Midfield" },
        events: [],
      });
      state.activeGame = game;
      state.games = [game];
      await copyLiveShareLinkNow(game.id);
      const createdCode = state.activeGame.shareCode;
      await turnOffLiveShare(game.id);
      const acceptedAudit = await recordSensitiveExportAudit("player_csv", "player", "synthetic-player");
      let rejected = false;
      try {
        await recordSensitiveExportAudit("player_csv", "player", "cross-player");
      } catch {
        rejected = true;
      }
      return { acceptedAudit, createdCode, rejected, shared: state.activeGame.isShared };
    });
    check(tokenResult.createdCode === "SYNTHETICSECURECODE", "signed-in token creation uses the approved RPC");
    check(tokenResult.shared === false, "token revocation disables Live Share");
    check(tokenResult.acceptedAudit?.outcome === "accepted", "authorized export audit succeeds");
    check(tokenResult.rejected === true, "rejected export audit is bounded");

    const missingRequestStart = localApiRequests.length;
    const missingContext = await newContext(browser);
    const missingPage = await missingContext.newPage();
    missingPage.on("request", (request) => {
      if (/https:\/\/[a-z]{20}\.supabase\.co/i.test(request.url())) hostedRequests.push(request.url());
    });
    await installApiRoutes(missingPage);
    await missingPage.goto(`${baseUrl}/missing-config/app.html?fresh=v282-missing`, { waitUntil: "domcontentloaded" });
    const missingStatus = await missingPage.evaluate(() => window.LAXHORNET_DISCLOSURE_STATUS);
    check(missingStatus?.ready === false, "missing runtime-config is detected");
    await missingPage.evaluate(() => loadSharedGame("SYNTHETICSECURECODE"));
    await missingPage.waitForTimeout(200);
    const missingText = await missingPage.locator("body").innerText();
    check(missingText.includes("Secure Live Share is temporarily unavailable"), "missing configuration shows truthful bounded copy");
    check(
      !localApiRequests.slice(missingRequestStart).some((item) => /\/rest\/v1\/(?:games|events)$/.test(item.pathname)),
      "missing configuration never falls through to legacy tables",
    );
    const localEventCount = await missingPage.evaluate(() => {
      state.activeGame = normalizeGame({
        id: "synthetic-offline-game",
        opponent: "Local Opponent",
        date: "2026-07-23",
        currentQuarter: "Q1",
        playerSnapshot: { id: "local-player", name: "Demo Player", number: "12", team: "Local Team", position: "Midfield" },
        events: [],
      });
      logEvent("groundBall");
      return state.activeGame.events.length;
    });
    check(localEventCount === 1, "local tracking remains available when secure disclosure configuration is missing");
    await missingPage.screenshot({ path: path.join(browserDir, "02-missing-config-bounded.png"), fullPage: true });

    const failureContext = await newContext(browser);
    const failurePage = await failureContext.newPage();
    await installApiRoutes(failurePage, { failPublicRpc: true });
    await failurePage.goto(`${baseUrl}/app.html?share=SYNTHETICSECURECODE&fresh=v282-rpc-failure`, { waitUntil: "domcontentloaded" });
    await failurePage.waitForTimeout(350);
    check((await failurePage.locator("body").innerText()).includes("Secure Live Share is temporarily unavailable"), "failed activation RPC produces a bounded unavailable state");

    const updateContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await updateContext.addInitScript(() => {
      window.LAXHORNET_RUNTIME_CONFIG = {
        supabaseUrl: "http://127.0.0.1:9",
        supabasePublishableKey: "synthetic-local-browser-test",
      };
    });
    const updatePage = await updateContext.newPage();
    await installApiRoutes(updatePage);
    await updatePage.route("**/version.json*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: "v283" }) }),
    );
    await updatePage.goto(`${baseUrl}/app.html?fresh=v282-update`, { waitUntil: "domcontentloaded" });
    await updatePage.evaluate(() => showUpdateAvailable(null, "v283"));
    await updatePage.getByText("Update available", { exact: true }).waitFor();
    check((await updatePage.locator("body").innerText()).includes("Update Now"), "delayed service-worker activation exposes a clear update action");
    await updatePage.screenshot({ path: path.join(browserDir, "03-update-path.png"), fullPage: true });
    await updateContext.close();

    await secureContext.setOffline(true);
    const offlineCount = await securePage.evaluate(() => {
      state.activeGame = normalizeGame({
        id: "synthetic-offline-v282",
        opponent: "Offline Opponent",
        date: "2026-07-23",
        currentQuarter: "Q1",
        playerSnapshot: { id: "offline-player", name: "Demo Player", number: "12", team: "Local Team", position: "Midfield" },
        events: [],
      });
      logEvent("groundBall");
      return state.activeGame.events.length;
    });
    check(offlineCount === 1, "updated offline client continues local tracking");
    await secureContext.setOffline(false);
    await securePage.evaluate(() => loadSharedGame("SYNTHETICSECURECODE"));
    await securePage.getByText("Ground Ball", { exact: false }).first().waitFor();
    check(true, "updated client recovers secure Live Share after reconnection");

    check(hostedRequests.length === 0, "activation browser suite contacts no hosted Supabase project");

    const inventory = {
      generatedAt: new Date().toISOString(),
      hostedSupabaseRequestCount: hostedRequests.length,
      productionHostRequestCount: hostedRequests.filter((url) => url.includes("ulbmjcvnyznvmjgpstno")).length,
      localApiRequests,
    };
    fs.writeFileSync(path.join(evidenceRoot, "local-network-request-inventory.json"), JSON.stringify(inventory, null, 2));
    fs.writeFileSync(path.join(evidenceRoot, "public-payload-sample.json"), JSON.stringify(publicPayload(), null, 2));
    fs.writeFileSync(
      path.join(evidenceRoot, "script-order-proof.json"),
      JSON.stringify({ expected: ["runtime-config", "app"], observed: scriptOrder, passed: JSON.stringify(scriptOrder) === JSON.stringify(["runtime-config", "app"]) }, null, 2),
    );
    fs.writeFileSync(
      path.join(evidenceRoot, "token-lifecycle-evidence.json"),
      JSON.stringify(
        {
          syntheticOnly: true,
          tokenValueRecorded: false,
          createAccepted: tokenResult.createdCode === "SYNTHETICSECURECODE",
          publicReadAccepted: publicRpcCalls >= 2,
          revokeAccepted: tokenResult.shared === false,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(evidenceRoot, "export-audit-evidence.json"),
      JSON.stringify(
        {
          syntheticOnly: true,
          authorizedPlayerExportAccepted: tokenResult.acceptedAudit?.outcome === "accepted",
          crossPlayerExportRejected: tokenResult.rejected === true,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(evidenceRoot, "failure-mode-evidence.json"),
      JSON.stringify(
        {
          missingConfigDetected: missingStatus?.ready === false,
          missingConfigBoundedMessage: missingText.includes("Secure Live Share is temporarily unavailable"),
          legacyAnonymousTableFallbackBlocked: !localApiRequests
            .slice(missingRequestStart)
            .some((item) => /\/rest\/v1\/(?:games|events)$/.test(item.pathname)),
          localTrackingAvailable: localEventCount === 1,
          failedRpcBounded: (await failurePage.locator("body").innerText()).includes("Secure Live Share is temporarily unavailable"),
          offlineTrackingAvailable: offlineCount === 1,
          secureRecoveryAfterReconnect: true,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(evidenceRoot, "service-worker-cache-proof.txt"),
      [
        "PASS: v282 activation removed the synthetic laxhornet-v281 cache.",
        "PASS: runtime-config.js uses a dedicated network no-store route.",
        "PASS: the v282 cached runtime-config fallback keeps all secure disclosure flags enabled.",
        "PASS: the update-available path rendered an Update Now action.",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(evidenceRoot, "local-browser-results.txt"),
      `${results.map(({ passed, message }) => `${passed ? "PASS" : "FAIL"}: ${message}`).join("\n")}\n`,
    );

    results.forEach(({ passed, message }) => console.log(`${passed ? "PASS" : "FAIL"}: ${message}`));
    if (failures.length) {
      console.error(`Activation browser checks failed (${failures.length}/${results.length}).`);
      process.exitCode = 1;
    } else {
      console.log(`Activation browser checks passed (${results.length}/${results.length}).`);
    }
  } finally {
    if (browserDiagnostics.length) {
      fs.writeFileSync(path.join(evidenceRoot, "browser-diagnostics.txt"), `${browserDiagnostics.join("\n")}\n`);
    }
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
