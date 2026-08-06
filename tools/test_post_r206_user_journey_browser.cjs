const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("./r206-browser-runtime/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const evidenceRoot = path.join(
  root,
  "review-evidence",
  "post-r2-06-user-centered-qa",
);
const screenshotRoot = path.join(evidenceRoot, "screenshots");
fs.mkdirSync(screenshotRoot, { recursive: true });

const checks = [];
const browserIssues = [];
const clientCalls = [];

function check(condition, message, details = null) {
  checks.push({ passed: Boolean(condition), message, details });
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

function disposableSupabaseStub() {
  return `
  (() => {
    const calls = [];
    window.__POST_R206_QA_CLIENT_CALLS = calls;
    const result = () => ({ data: [], error: null });
    const builder = (table) => {
      const chain = {
        select() { calls.push({ type: "select", table }); return chain; },
        eq() { return chain; }, in() { return chain; }, order() { return chain; },
        limit() { return chain; }, single() { return Promise.resolve(result()); },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        insert() { calls.push({ type: "insert", table }); return chain; },
        upsert() { calls.push({ type: "upsert", table }); return chain; },
        update() { calls.push({ type: "update", table }); return chain; },
        delete() { calls.push({ type: "delete", table }); return chain; },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
      return chain;
    };
    window.supabase = {
      createClient() {
        return {
          auth: {
            async getSession() {
              const user = JSON.parse(localStorage.getItem("postR206QaSession") || "null");
              return {
                data: {
                  session: user ? {
                    access_token: "disposable-local-access",
                    refresh_token: "disposable-local-refresh",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user,
                  } : null,
                },
                error: null,
              };
            },
            async signInWithPassword() { return { data: { session: null, user: null }, error: null }; },
            async signUp() { return { data: { session: null, user: null }, error: null }; },
            onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
            async signOut() {
              calls.push({ type: "sign_out" });
              localStorage.removeItem("postR206QaSession");
              return { error: null };
            },
          },
          from(table) { return builder(table); },
          async rpc(name) {
            calls.push({ type: "rpc", name });
            const user = JSON.parse(localStorage.getItem("postR206QaSession") || "null");
            if (name === "laxhornet_my_profile") {
              return {
                data: user ? [{
                  user_id: user.id,
                  email: user.email,
                  first_name: "QA",
                  last_name: "Reviewer",
                  onboarding_completed: true,
                  approved_role: "tracker",
                }] : [],
                error: null,
              };
            }
            if (user?.id === "qa-account-a" && name === "laxhornet_my_teams") {
              return { data: [{ id: "qa-team", name: "QA Hornets", role: "tracker", created_by: user.id }], error: null };
            }
            if (user?.id === "qa-account-a" && ["laxhornet_visible_roster_players", "laxhornet_my_roster_players"].includes(name)) {
              return {
                data: [
                  { id: "qa-player-a", team_id: "qa-team", name: "Jordan QA", number: "12", position: "Midfield", active: true },
                  { id: "qa-player-b", team_id: "qa-team", name: "Riley QA", number: "8", position: "Attack", active: true },
                ],
                error: null,
              };
            }
            if (user?.id === "qa-account-a" && name === "laxhornet_my_player_claims") {
              return {
                data: [
                  { id: "qa-claim-a", team_id: "qa-team", roster_player_id: "qa-player-a", user_id: user.id },
                  { id: "qa-claim-b", team_id: "qa-team", roster_player_id: "qa-player-b", user_id: user.id },
                ],
                error: null,
              };
            }
            return result();
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
        response.end(disposableSupabaseStub());
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

async function capture(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(screenshotRoot, name), fullPage });
}

async function noHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  check(metrics.scrollWidth <= metrics.clientWidth, `${label} has no horizontal page overflow`, metrics);
}

async function initializeAccount(page, accountId = "qa-account-a") {
  return page.evaluate((id) => {
    const team = normalizeTeam({
      id: "qa-team",
      name: "QA Hornets",
      role: "tracker",
      createdBy: id,
      cloudBacked: true,
    });
    const rosterPlayers = [
      normalizeRosterPlayer({
        id: "qa-player-a",
        teamId: team.id,
        name: "Jordan QA",
        number: "12",
        position: "Midfield",
      }),
      normalizeRosterPlayer({
        id: "qa-player-b",
        teamId: team.id,
        name: "Riley QA",
        number: "8",
        position: "Attack",
      }),
    ];
    setAuthUser({ id, email: `${id}@example.invalid` });
    localStorage.setItem("postR206QaSession", JSON.stringify({
      id,
      email: `${id}@example.invalid`,
    }));
    state.userProfile = {
      firstName: "QA",
      lastName: "Reviewer",
      onboardingCompleted: true,
      appRole: "tracker",
    };
    state.teams = [team];
    state.rosterPlayers = rosterPlayers;
    state.playerClaims = rosterPlayers.map((player) => normalizePlayerClaim({
      id: `qa-claim-${player.id}`,
      teamId: team.id,
      rosterPlayerId: player.id,
      userId: id,
      createdAt: new Date().toISOString(),
    }));
    state.activeTeamId = team.id;
    state.activePlayerId = rosterPlayers[0].id;
    mergeRosterPlayersIntoPlayers();
    state.player = state.players[0];
    state.screen = "home";
    state.syncStatus = "Saved on this phone";
    persistAll();
    render();
    return { accountId: currentUserId(), playerCount: state.players.length };
  }, accountId);
}

async function waitForApp(page) {
  await page.waitForFunction(() => typeof state !== "undefined" && typeof render === "function");
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
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    serviceWorkers: "allow",
  });
  const page = await context.newPage();
  let intentionalOffline = false;
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => browserIssues.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !(intentionalOffline && /ERR_FAILED/.test(message.text()))) {
      browserIssues.push(message.text());
    }
  });
  page.on("request", (request) => {
    if (/https:\/\/[a-z0-9-]+\.supabase\.co/i.test(request.url())) {
      browserIssues.push(`Hosted Supabase request: ${request.url()}`);
    }
  });

  try {
    await page.goto(`${origin}/app.html?fresh=post-r206-user-qa`, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForTimeout(250);
    check((await page.title()) === "LaxHornet App", "application identity is correct");
    check((await page.locator("body").innerText()).includes("Track the plays"), "welcome screen is meaningful");
    await capture(page, "01-welcome-narrow.png");
    await noHorizontalOverflow(page, "narrow welcome");

    const initialized = await initializeAccount(page);
    check(initialized.accountId === "qa-account-a" && initialized.playerCount === 2, "disposable account and players initialize");
    check((await page.locator("body").innerText()).includes("Start New Game"), "home presents the primary next action");
    await capture(page, "02-home-narrow.png");
    await noHorizontalOverflow(page, "narrow home");

    await page.getByRole("button", { name: "Start New Game" }).click();
    check((await page.locator("h2").innerText()) === "Set up game", "game setup opens from home");
    check(await page.locator("#liveShare").isDisabled(), "Live Share is unavailable for a personal disposable game");
    check((await page.locator("body").innerText()).includes("Live Share is temporarily unavailable"), "Live Share limitation is explained");
    await capture(page, "03-game-setup-narrow.png");
    await page.locator("#opponent").fill("Disposable Rivals");
    await page.locator("#periodFormat").selectOption("quarters");
    await page.getByRole("button", { name: "Start Tracking" }).click();
    check((await page.locator("body").innerText()).includes("Tracking: Jordan QA"), "live tracker keeps the active player visible");
    check((await page.locator("body").innerText()).includes("Q1"), "live tracker keeps the period visible");
    await capture(page, "04-live-narrow.png");
    await noHorizontalOverflow(page, "narrow live tracker");

    await page.locator('[data-stat="goal"]').click();
    await page.locator('[data-stat="groundBall"]').click();
    await page.locator('[data-action="toggle-more-plays"]').click();
    await page.locator('[data-stat="faceoffWin"]').click();
    let liveState = await page.evaluate(() => ({
      events: state.activeGame.events.length,
      scoreFor: state.activeGame.scoreFor,
      lastConfirmation: state.lastEventConfirmation?.label || "",
    }));
    check(liveState.events === 3 && liveState.scoreFor === 1, "common statistics record once with score context", liveState);
    check(liveState.lastConfirmation === "Faceoff Win", "the latest action receives visible confirmation", liveState);
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    liveState = await page.evaluate(() => ({ events: state.activeGame.events.length, toast: state.toast }));
    check(liveState.events === 2 && /Undo last event/.test(liveState.toast), "undo removes exactly the latest event with feedback", liveState);

    await page.getByRole("button", { name: "Switch Player" }).click();
    check((await page.locator("h2").innerText()) === "Players & Teams", "player switch opens a clear player-selection screen");
    const activeGamePlayerBefore = await page.evaluate(() => state.activeGame.playerId);
    await page.locator('[data-player-select="qa-player-b"]').click();
    const playerSwitch = await page.evaluate(() => ({
      activePlayerId: state.activePlayerId,
      activeGamePlayerId: state.activeGame.playerId,
    }));
    check(
      playerSwitch.activePlayerId === "qa-player-b" && playerSwitch.activeGamePlayerId === activeGamePlayerBefore,
      "switching the selected player does not reassign the active game",
      playerSwitch,
    );
    await capture(page, "05-player-switch-narrow.png");
    await page.getByRole("button", { name: "Live" }).click();

    await page.setViewportSize({ width: 844, height: 390 });
    await capture(page, "06-live-landscape.png");
    await noHorizontalOverflow(page, "mobile landscape live tracker");
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole("button", { name: "Home" }).click();
    const resumeGameButton = page.getByRole("button", { name: /Resume Live Game/ });
    const hasResumeGameButton = (await resumeGameButton.count()) === 1;
    check(hasResumeGameButton, "home clearly exposes active-game recovery");
    if (hasResumeGameButton) await resumeGameButton.click();
    else await page.getByRole("button", { name: "Live" }).click();
    check((await page.locator("body").innerText()).includes("Disposable Rivals"), "active game resumes from home");

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    intentionalOffline = true;
    await context.setOffline(true);
    await page.locator('[data-stat="assist"]').click();
    const offlineBeforeReload = await page.evaluate(() => ({
      stateCount: state.activeGame.events.length,
      storedCount: JSON.parse(localStorage.getItem(`laxhornet.activeGame.user.${currentUserId()}`) || "null")?.events?.length || 0,
      status: displaySyncStatus(),
    }));
    check(
      offlineBeforeReload.stateCount === 3 && offlineBeforeReload.storedCount === 3,
      "offline event persists immediately in account-scoped active-game storage",
      offlineBeforeReload,
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForFunction(() => state.authUser?.id === "qa-account-a" && Boolean(state.activeGame));
    const offlineAfterReload = await page.evaluate(() => ({
      activeGameId: state.activeGame?.id || "",
      eventCount: state.activeGame?.events?.length || 0,
      isOffline: state.isOffline,
    }));
    check(
      Boolean(offlineAfterReload.activeGameId) && offlineAfterReload.eventCount === 3,
      "service-worker-controlled offline reload recovers the active game without duplication",
      offlineAfterReload,
    );
    await capture(page, "07-offline-recovered-mobile.png");
    await context.setOffline(false);
    intentionalOffline = false;
    await page.waitForTimeout(250);
    check((await page.evaluate(() => state.activeGame.events.length)) === 3, "network restoration does not duplicate events");

    if ((await page.locator('[data-action="save-game"]').count()) === 0) {
      const resumeAfterReload = page.getByRole("button", { name: "Resume Live Game" });
      if (await resumeAfterReload.count()) await resumeAfterReload.click();
      else await page.getByRole("button", { name: "Live", exact: true }).click();
    }

    await page.locator('[data-action="save-game"]').click();
    check((await page.evaluate(() => state.games.some((game) => game.id === state.activeGame.id))), "Save persists the active game without ending it");
    await page.locator('[data-action="end-game"]').click();
    check((await page.locator('[role="dialog"]').innerText()).includes("End Game"), "End Game requires confirmation");
    await page.locator('[data-action="confirm-end-game"]').click();
    check((await page.evaluate(() => !state.activeGame && state.games.length === 1)), "confirmed end saves one completed game");
    await page.locator('[data-action="open-saved-review"]').click();
    const reviewText = await page.locator("body").innerText();
    check(reviewText.includes("Disposable Rivals") && /RECORDED EVENTS/i.test(reviewText), "saved game review shows opponent and derived totals");
    await capture(page, "08-review-standard-mobile.png");

    await page.getByRole("button", { name: "Season" }).click();
    const seasonBeforeDelete = await page.locator("body").innerText();
    check(seasonBeforeDelete.includes("Season Snapshot") && /GAMES TRACKED\s+1/i.test(seasonBeforeDelete), "season totals include the saved game");
    await page.setViewportSize({ width: 1280, height: 800 });
    await capture(page, "09-season-desktop.png");
    await noHorizontalOverflow(page, "desktop season dashboard");

    const accountIsolation = await page.evaluate(() => {
      const accountA = currentUserId();
      const gameId = state.games[0]?.id || "";
      persistAll();
      setAuthUser({ id: "qa-account-b", email: "qa-account-b@example.invalid" });
      state.userProfile = {
        firstName: "Second",
        lastName: "Account",
        onboardingCompleted: true,
        appRole: "tracker",
      };
      const visibleInB = state.games.some((game) => game.id === gameId);
      setAuthUser({ id: accountA, email: "qa-account-a@example.invalid" });
      state.userProfile = {
        firstName: "QA",
        lastName: "Reviewer",
        onboardingCompleted: true,
        appRole: "tracker",
      };
      render();
      return {
        visibleInB,
        restoredInA: state.games.some((game) => game.id === gameId),
      };
    });
    check(!accountIsolation.visibleInB && accountIsolation.restoredInA, "account switching isolates prior-account games and restores the original namespace", accountIsolation);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => setActivePlayer("qa-player-a"));
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await capture(page, "10-games-standard-mobile.png");
    const savedGameId = await page.evaluate(() => state.games[0].id);
    intentionalOffline = true;
    await context.setOffline(true);
    await page.waitForFunction(() => state.isOffline === true);
    await page.getByRole("button", { name: "Delete game" }).click();
    check((await page.locator('[role="dialog"]').innerText()).includes("Delete this game"), "game deletion requires confirmation");
    await page.locator('[data-action="confirm-delete-game"]').click();
    await page.waitForFunction(() => state.games.length === 0);
    const afterDelete = await page.evaluate((gameId) => ({
      gameVisible: state.games.some((game) => game.id === gameId),
      tombstonePresent: durableSyncService().isTombstoned(currentUserId(), gameId),
      liveShareCalls: (window.__POST_R206_QA_CLIENT_CALLS || [])
        .filter((entry) => /share|token/i.test(entry.name || entry.table || "")).length,
    }), savedGameId);
    check(!afterDelete.gameVisible && afterDelete.tombstonePresent, "deleted game is hidden and retains local tombstone evidence", afterDelete);
    check(afterDelete.liveShareCalls === 0, "unrelated user actions create no Live Share token", afterDelete);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    check((await page.evaluate((gameId) => !state.games.some((game) => game.id === gameId), savedGameId)), "deleted game does not reappear after reopen");
    await context.setOffline(false);
    intentionalOffline = false;
    const seasonAfterDelete = await page.evaluate(() => {
      state.screen = "dashboard";
      render();
      return document.body.innerText;
    });
    check(!seasonAfterDelete.includes("1 game"), "season totals remove the deleted game");

    await page.getByRole("button", { name: "More" }).click();
    await capture(page, "11-more-standard-mobile.png");
    const namedControls = await page.locator("button").evaluateAll((buttons) => (
      buttons.every((button) => (button.getAttribute("aria-label") || button.innerText || "").trim().length > 0)
    ));
    check(namedControls, "all rendered buttons have an accessible name");
    const undersizedPrimaryTargets = await page.locator("button:visible").evaluateAll((buttons) => buttons
      .filter((button) => {
        const box = button.getBoundingClientRect();
        return box.width < 44 || box.height < 44;
      })
      .map((button) => ({
        name: (button.getAttribute("aria-label") || button.innerText || "").trim(),
        width: Math.round(button.getBoundingClientRect().width),
        height: Math.round(button.getBoundingClientRect().height),
      })));
    check(
      undersizedPrimaryTargets.length === 0,
      "visible More-screen buttons meet a 44px touch-target minimum",
      undersizedPrimaryTargets,
    );
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const active = document.activeElement;
      const style = active ? getComputedStyle(active) : null;
      return {
        name: active?.getAttribute?.("aria-label") || active?.innerText || active?.tagName || "",
        outline: style?.outline || "",
        boxShadow: style?.boxShadow || "",
      };
    });
    check(Boolean(focusState.name) && (focusState.outline !== "none" || focusState.boxShadow !== "none"), "keyboard focus is visible on the More screen", focusState);

    await page.locator('[data-action="sign-out"]').click();
    check(!await page.getByRole("button", { name: "Start New Game" }).count(), "sign-out returns to the signed-out entry state");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    check(!await page.getByRole("button", { name: "Start New Game" }).count(), "reopen preserves signed-out state");
    await capture(page, "12-signed-out-reopen.png");

    clientCalls.push(...await page.evaluate(() => window.__POST_R206_QA_CLIENT_CALLS || []));
    check(browserIssues.length === 0, "browser journey has no console, page, or hosted-network errors", browserIssues);
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  for (const result of checks) {
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.message}`);
    if (!result.passed && result.details) console.log(JSON.stringify(result.details));
  }
  const failures = checks.filter((result) => !result.passed);
  console.log(`\n${checks.length - failures.length}/${checks.length} post-R2-06 user-journey checks passed.`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
