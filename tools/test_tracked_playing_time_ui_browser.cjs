const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const evidenceRoot = path.join(root, "review-evidence", "tracked-playing-time-ui");
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const port = Number(process.env.LAXHORNET_TRACKED_TIME_PORT || 5263);
const baseUrl = `http://127.0.0.1:${port}`;
const results = [];
const consoleErrors = [];
const trackedTimeFallbackNotices = [];

fs.mkdirSync(screenshotRoot, { recursive: true });

function check(condition, message) {
  results.push({ passed: Boolean(condition), message });
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

async function screenshot(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(screenshotRoot, name), fullPage });
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.LAXHORNET_BROWSER_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    timeout: 15000,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
    if (
      message.type() === "info"
      && message.text().includes("Tracked playing time account sync is unavailable")
    ) {
      trackedTimeFallbackNotices.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    console.log("STEP setup");
    await page.goto(`${baseUrl}/app.html?fresh=tracked-time-ui`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const navigationState = await page.evaluate(() => {
      state.authUser = { id: "synthetic-user", email: "synthetic@example.invalid" };
      state.authUserId = "synthetic-user";
      state.userProfile = {
        firstName: "Synthetic",
        lastName: "Reviewer",
        onboardingCompleted: true,
        appRole: "tracker",
      };
      state.screen = "start";
      render();
      return { screen: state.screen, hasToggle: Boolean(document.querySelector("#trackPlayingTime")) };
    });
    console.log("NAV", navigationState);
    await page.locator("#trackPlayingTime").waitFor();
    check((await page.locator("body").innerText()).includes("Track playing time for this game"), "setup shows conservative opt-in");
    await screenshot(page, "01-mobile-clock-setup.png");

    await page.locator("#trackPlayingTime").check();
    check(await page.locator("#regulationPeriodMinutes").isEnabled(), "tracked-time duration fields activate");
    await screenshot(page, "01b-mobile-clock-duration-setup.png");
    await page.locator("#opponent").fill("Synthetic Rivals");
    await page.getByRole("button", { name: "Start Tracking" }).click();
    await page.getByRole("button", { name: "Record Player In" }).waitFor();
    let bodyText = await page.locator("body").innerText();
    check(bodyText.includes("OFF FIELD") && bodyText.includes("PLAYER IN"), "new tracked game starts visibly off field");
    await page.locator(".tracked-time-live").scrollIntoViewIfNeeded();
    await screenshot(page, "02-mobile-player-in-state.png", false);

    console.log("STEP missing backend foundation");
    const missingFoundation = await page.evaluate(() => {
      reportTrackedPlayingTimeSyncError({
        code: "PGRST202",
        message: "Could not find the function public.lh_reconcile_participation_operations(p_operations) in the schema cache",
      });
      reportTrackedPlayingTimeSyncError({
        code: "PGRST202",
        message: "Could not find the function public.lh_reconcile_participation_operations(p_operations) in the schema cache",
      });
      state.toast = "";
      render();
      const local = trackedTimeState(state.activeGame);
      return {
        cloudAvailability: trackedPlayingTimeCloudAvailability,
        transientNetworkClassifiedAsMissing: isTrackedPlayingTimeRpcUnavailable({
          code: "503",
          message: "Network request failed",
        }),
        syncIssue: local.syncIssue,
        status: trackedTimeSummary(state.activeGame).status,
        bodyText: document.body.innerText,
      };
    });
    check(
      missingFoundation.cloudAvailability === "unavailable"
        && missingFoundation.syncIssue === ""
        && missingFoundation.status === "complete"
        && missingFoundation.bodyText.includes("Account sync is not available in this review build."),
      "missing tracked-time RPC falls back to device-only tracking without marking shift evidence for review",
    );
    check(
      missingFoundation.transientNetworkClassifiedAsMissing === false,
      "transient network errors do not disable tracked-time account sync",
    );
    check(
      trackedTimeFallbackNotices.length === 1,
      "repeated missing-RPC reports produce one bounded console notice",
    );
    await page.locator(".tracked-time-live .field-help").evaluate((element) => {
      element.scrollIntoView({ block: "center" });
    });
    await screenshot(page, "02b-mobile-device-only-fallback.png", false);

    console.log("STEP live clock");
    await page.evaluate(() => {
      state.isOffline = true;
      render();
    });
    await page.getByRole("button", { name: "Record Player In" }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.waitForTimeout(2250);
    bodyText = await page.locator("body").innerText();
    const activeShiftText = await page.locator("[data-active-shift]").innerText();
    check(bodyText.includes("ON FIELD") && bodyText.includes("PLAYER OUT"), "Player In changes to unmistakable on-field state");
    check(
      /^Playing 0:0[1-3]$/.test(activeShiftText),
      `active shift timer follows running game clock (observed ${activeShiftText})`,
    );
    await page.locator(".tracked-time-live").scrollIntoViewIfNeeded();
    await screenshot(page, "03-mobile-running-player-out-state.png", false);

    const beforeRefresh = await page.evaluate(() => ({
      operationCount: trackedTimeState(state.activeGame).participationOperations.length,
      gameId: state.activeGame.id,
    }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const afterRefresh = await page.evaluate(() => {
      state.authUser = { id: "synthetic-user", email: "synthetic@example.invalid" };
      state.authUserId = "synthetic-user";
      state.userProfile = {
        firstName: "Synthetic",
        lastName: "Reviewer",
        onboardingCompleted: true,
        appRole: "tracker",
      };
      state.screen = "live";
      render();
      const local = trackedTimeState(state.activeGame);
      const value = trackedTimeSummary(state.activeGame);
      return {
        operationCount: local.participationOperations.length,
        pending: local.participationOperations[0]?.syncState,
        gameId: state.activeGame.id,
        onField: value.onField,
        cloudAvailability: trackedPlayingTimeCloudAvailability,
      };
    });
    check(
      afterRefresh.gameId === beforeRefresh.gameId
        && afterRefresh.operationCount === beforeRefresh.operationCount
        && afterRefresh.onField,
      "running refresh restores one continuous active shift without duplicate Player In",
    );
    check(afterRefresh.pending === "pending", "offline pending participation operation survives refresh");
    check(
      afterRefresh.cloudAvailability === "unknown",
      "fresh page session re-enables tracked-time capability detection",
    );

    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const pausedText = await page.locator("[data-active-shift]").innerText();
    await page.waitForTimeout(1100);
    check((await page.locator("[data-active-shift]").innerText()) === pausedText, "paused clock freezes active shift display");
    await screenshot(page, "04-mobile-paused-clock.png", false);

    console.log("STEP period end");
    await page.getByRole("button", { name: "Record Player Out" }).click();
    await page.evaluate(() => {
      const local = trackedTimeState(state.activeGame);
      local.clockState = {
        ...local.clockState,
        currentPeriod: "Q1",
        clockSecondsRemaining: 90,
        isRunning: false,
        startedAt: null,
        pausedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };
      state.activeGame.currentQuarter = "Q1";
      persistAll();
      render();
    });
    await page.getByRole("button", { name: "Record Player In" }).click();
    await page.getByRole("button", { name: /End Period/ }).click();
    bodyText = await page.locator("body").innerText();
    check(bodyText.includes("Q2") && bodyText.includes("OFF FIELD"), "period end closes shift and opens next period off field");

    console.log("STEP game end");
    await page.evaluate(() => {
      const local = trackedTimeState(state.activeGame);
      local.clockState = {
        ...local.clockState,
        currentPeriod: "Q2",
        clockSecondsRemaining: 240,
        isRunning: false,
        startedAt: null,
        pausedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };
      state.activeGame.currentQuarter = "Q2";
      persistAll();
      render();
    });
    await page.getByRole("button", { name: "Record Player In" }).click();
    await page.evaluate(() => {
      const local = trackedTimeState(state.activeGame);
      local.clockState = {
        ...local.clockState,
        clockSecondsRemaining: 80,
        clientUpdatedAt: new Date().toISOString(),
      };
      persistAll();
      render();
    });
    await page.getByRole("button", { name: "End Game", exact: true }).click();
    await page.getByRole("button", { name: "End Game & Review" }).click();
    await page.getByRole("button", { name: "Open Game Review" }).click();
    await page.getByText("Tracked Playing Time", { exact: true }).waitFor();
    bodyText = await page.locator("body").innerText();
    check(bodyText.includes("System closed"), "Game Review identifies system-closed shifts");
    check(bodyText.includes("Complete:"), "valid live and system boundaries produce Complete");
    await page.waitForTimeout(2100);
    await page.locator(".tracked-time-review").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -110));
    await screenshot(page, "05-mobile-game-review-summary.png", false);

    console.log("STEP correction");
    const firstEdit = page.getByRole("button", { name: "Edit", exact: true }).first();
    await firstEdit.click();
    await page.locator("#trackedShiftStart").fill("11:59");
    await page.locator("#trackedShiftEnd").fill("11:58");
    await screenshot(page, "06-mobile-correction-flow.png", false);
    await page.getByRole("button", { name: "Save correction" }).click();
    bodyText = await page.locator("body").innerText();
    check(bodyText.includes("Estimated:") && bodyText.includes("Corrected"), "correction recalculates and marks Estimated");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator(".tracked-time-review").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -110));
    await screenshot(page, "07-desktop-game-review-summary.png", false);

    console.log("STEP no data");
    await page.evaluate(() => {
      const oldGame = normalizeGame({
        id: "synthetic-old-game",
        playerId: state.player.id,
        playerSnapshot: { ...state.player },
        opponent: "Earlier Opponent",
        date: "2026-07-01",
        periodFormat: "quarters",
        currentQuarter: "Q4",
        events: [],
        status: "complete",
        createdAt: "2026-07-01T12:00:00.000Z",
        savedAt: "2026-07-01T13:00:00.000Z",
      });
      state.games.unshift(oldGame);
      state.reviewGameId = oldGame.id;
      render();
    });
    bodyText = await page.locator("body").innerText();
    check(bodyText.includes("Playing time was not tracked for this game."), "older game renders the no-data message");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".tracked-time-review").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -110));
    await screenshot(page, "08-mobile-no-data-review.png", false);

    check(consoleErrors.length === 0, `browser console has no errors${consoleErrors.length ? `: ${consoleErrors.join(" | ")}` : ""}`);
  } finally {
    fs.writeFileSync(
      path.join(evidenceRoot, "browser-results.json"),
      JSON.stringify({ results, consoleErrors }, null, 2),
    );
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const failures = results.filter((result) => !result.passed);
  for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.message}`);
  console.log(`\n${results.length - failures.length}/${results.length} browser checks passed.`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
