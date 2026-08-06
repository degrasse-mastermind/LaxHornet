const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("./r206-browser-runtime/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const productionOrigin = "https://laxhornet.mybranford.com";
const deployedSha = "9e434e33534a1b348b19e2081b91d7e0724299fc";
const legacySha = "f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37";
const currentRuntime = "v285";
const currentCache = "laxhornet-v285";
const legacyRuntime = "v284";
const legacyCache = "laxhornet-v284";
const outputArgument = process.argv.find((item) => item.startsWith("--output="));
const outputPath = outputArgument ? path.resolve(outputArgument.slice("--output=".length)) : "";

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function gitFile(ref, relativePath) {
  try {
    return execFileSync("git", ["show", `${ref}:${relativePath}`], { cwd: root });
  } catch {
    return null;
  }
}

function disposableSupabaseStub() {
  return `(() => {
    const calls = [];
    window.__V285_PRODUCTION_LOCAL_CLIENT_CALLS = calls;
    const result = () => ({ data: [], error: null });
    const builder = (table) => {
      const chain = {
        select() { calls.push({ type: "select", table }); return chain; },
        eq() { return chain; }, in() { return chain; }, order() { return chain; }, limit() { return chain; },
        single() { return Promise.resolve(result()); },
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
              const user = JSON.parse(localStorage.getItem("v285ProductionLocalSession") || "null");
              calls.push({ type: "get_session", hasUser: Boolean(user) });
              return { data: { session: user ? {
                access_token: "isolated-local-access",
                refresh_token: "isolated-local-refresh",
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                user,
              } : null }, error: null };
            },
            async signInWithPassword() { return { data: { session: null, user: null }, error: null }; },
            async signUp() { return { data: { session: null, user: null }, error: null }; },
            onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
            async signOut() { localStorage.removeItem("v285ProductionLocalSession"); return { error: null }; },
          },
          from(table) { return builder(table); },
          async rpc(name) {
            calls.push({ type: "rpc", name });
            const user = JSON.parse(localStorage.getItem("v285ProductionLocalSession") || "null");
            if (name === "laxhornet_my_profile") {
              return { data: user ? [{ user_id: user.id, email: user.email, first_name: "Local", last_name: "Fixture", onboarding_completed: true, approved_role: "tracker" }] : [], error: null };
            }
            if (user && name === "laxhornet_my_teams") {
              return { data: [{ id: "isolated-team", name: "Local Hornets", role: "tracker", created_by: user.id }], error: null };
            }
            if (user && ["laxhornet_visible_roster_players", "laxhornet_my_roster_players"].includes(name)) {
              return { data: [
                { id: "isolated-player-a", team_id: "isolated-team", name: "Jordan Local", number: "12", position: "Midfield", active: true },
                { id: "isolated-player-b", team_id: "isolated-team", name: "Riley Local", number: "8", position: "Attack", active: true },
              ], error: null };
            }
            if (user && name === "laxhornet_my_player_claims") {
              return { data: [
                { id: "claim-a", team_id: "isolated-team", roster_player_id: "isolated-player-a", user_id: user.id },
                { id: "claim-b", team_id: "isolated-team", roster_player_id: "isolated-player-b", user_id: user.id },
              ], error: null };
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

function createIssueCollector(page, issues, network) {
  let intentionalOffline = false;
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !(intentionalOffline && /ERR_(?:FAILED|INTERNET_DISCONNECTED)/.test(message.text()))) {
      issues.push(`console: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (!intentionalOffline) issues.push(`requestfailed: ${new URL(request.url()).pathname}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    network.push({ method, origin: url.origin, path: url.pathname });
  });
  return {
    setIntentionalOffline(value) { intentionalOffline = value; },
  };
}

async function waitForControlled(page, cacheName) {
  await page.waitForFunction(async (expected) => {
    if (!navigator.serviceWorker.controller) return false;
    return (await caches.keys()).includes(expected);
  }, cacheName, { timeout: 20_000 });
}

async function cleanInstall(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const issues = [];
  const network = [];
  const collector = createIssueCollector(page, issues, network);
  try {
    await page.goto(`${productionOrigin}/app.html?v285-clean=${Date.now()}`, { waitUntil: "networkidle" });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20_000 });
    await waitForControlled(page, currentCache);
    const online = await page.evaluate(async ({ currentCache }) => ({
      runtime: typeof APP_VERSION === "string" ? APP_VERSION : "",
      controlled: Boolean(navigator.serviceWorker.controller),
      caches: await caches.keys(),
      bodyMeaningful: document.body.innerText.trim().length > 100,
    }), { currentCache });
    assert.equal(online.runtime, currentRuntime);
    assert.equal(online.controlled, true);
    assert.ok(online.caches.includes(currentCache));
    assert.equal(online.bodyMeaningful, true);
    collector.setIntentionalOffline(true);
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.match(await page.locator("body").innerText(), /Track the plays|Watch Live|LaxHornet/i);
    assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);
    await context.setOffline(false);
    collector.setIntentionalOffline(false);
    assert.deepEqual(issues, []);
    return { status: "PASS", runtime: online.runtime, cache: currentCache, controlled: true, offlineReload: true, blankScreen: false, reloadLoop: false, fatalErrors: 0 };
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
  }
}

async function legacyUpgrade(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  const issues = [];
  const network = [];
  const collector = createIssueCollector(page, issues, network);
  let legacyMode = true;
  let legacyWorkerRequests = 0;
  await context.route(`${productionOrigin}/**`, async (route) => {
    if (!legacyMode) return route.continue();
    const url = new URL(route.request().url());
    const relative = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const bytes = gitFile(legacySha, relative);
    if (!bytes) return route.continue();
    if (relative === "service-worker.js") legacyWorkerRequests += 1;
    return route.fulfill({ status: 200, contentType: contentType(relative), body: bytes });
  });
  try {
    await page.goto(`${productionOrigin}/app.html?legacy-upgrade=${Date.now()}`, { waitUntil: "networkidle" });
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
      await page.reload({ waitUntil: "networkidle" });
    }
    await waitForControlled(page, legacyCache);
    const before = await page.evaluate(async () => ({
      runtime: typeof APP_VERSION === "string" ? APP_VERSION : "",
      controlled: Boolean(navigator.serviceWorker.controller),
      caches: await caches.keys(),
      appScript: [...document.scripts].map((script) => script.src).find((src) => /app\.js/.test(src)) || "",
    }));
    assert.equal(legacyWorkerRequests > 0, true, "legacy worker request was not intercepted");
    assert.equal(before.runtime, legacyRuntime);
    assert.equal(before.controlled, true);
    assert.ok(before.caches.includes(legacyCache));
    assert.match(before.appScript, /[?&]v=284/);
    assert.deepEqual(issues, [], "legacy-controlled client had errors before update");

    legacyMode = false;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("v285 worker did not take control")), 20_000);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        registration.update().then(async () => {
          let worker = registration.installing || registration.waiting;
          if (!worker) {
            worker = await new Promise((installed) => registration.addEventListener("updatefound", () => installed(registration.installing), { once: true }));
          }
          if (worker.state !== "installed") {
            await new Promise((installed, failed) => worker.addEventListener("statechange", () => {
              if (worker.state === "installed") installed();
              if (worker.state === "redundant") failed(new Error("v285 worker became redundant"));
            }));
          }
          worker.postMessage({ type: "SKIP_WAITING" });
        }).catch(reject);
      });
    });
    await page.waitForTimeout(1_000);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await page.goto(`${productionOrigin}/app.html?v285-upgraded=${Date.now()}`, { waitUntil: "domcontentloaded" });
        break;
      } catch (error) {
        if (!/ERR_ABORTED|frame was detached/i.test(error.message)) throw error;
        if (attempt === 3) throw error;
        await page.waitForTimeout(750);
      }
    }
    await page.waitForFunction((expected) => typeof APP_VERSION === "string" && APP_VERSION === expected, currentRuntime, { timeout: 20_000 });
    await page.waitForFunction(() => document.body.innerText.trim().length > 100, null, { timeout: 10_000 });
    await waitForControlled(page, currentCache);
    const after = await page.evaluate(async () => ({
      runtime: typeof APP_VERSION === "string" ? APP_VERSION : "",
      caches: await caches.keys(),
      controlled: Boolean(navigator.serviceWorker.controller),
      appScript: [...document.scripts].map((script) => script.src).find((src) => /app\.js/.test(src)) || "",
      bodyMeaningful: document.body.innerText.trim().length > 100,
    }));
    assert.equal(after.runtime, currentRuntime);
    assert.equal(after.controlled, true);
    assert.ok(after.caches.includes(currentCache));
    assert.ok(!after.caches.includes(legacyCache));
    assert.doesNotMatch(after.appScript, /[?&]v=284/);
    assert.match(after.appScript, /[?&]v=285/);
    assert.equal(after.bodyMeaningful, true);
    collector.setIntentionalOffline(true);
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.match(await page.locator("body").innerText(), /Track the plays|Watch Live|LaxHornet/i);
    await context.setOffline(false);
    collector.setIntentionalOffline(false);
    const unexpectedIssues = issues.filter((issue) => issue !== "requestfailed: /app.html");
    assert.deepEqual(unexpectedIssues, []);
    return { status: "PASS", fromRuntime: legacyRuntime, toRuntime: currentRuntime, priorCacheRemoved: true, currentCachePopulated: true, controlTransferred: true, staleApplicationJavaScript: false, offlineReload: true, blankScreen: false, reloadLoop: false };
  } finally {
    await context.setOffline(false).catch(() => {});
    await context.close();
  }
}

async function initializeLocalAccount(page) {
  return page.evaluate(() => {
    const accountId = "isolated-account";
    const team = normalizeTeam({ id: "isolated-team", name: "Local Hornets", role: "tracker", createdBy: accountId, cloudBacked: true });
    const roster = [
      normalizeRosterPlayer({ id: "isolated-player-a", teamId: team.id, name: "Jordan Local", number: "12", position: "Midfield" }),
      normalizeRosterPlayer({ id: "isolated-player-b", teamId: team.id, name: "Riley Local", number: "8", position: "Attack" }),
    ];
    setAuthUser({ id: accountId, email: "isolated@example.invalid" });
    localStorage.setItem("v285ProductionLocalSession", JSON.stringify({ id: accountId, email: "isolated@example.invalid" }));
    state.userProfile = { firstName: "Local", lastName: "Fixture", onboardingCompleted: true, appRole: "tracker" };
    state.teams = [team];
    state.rosterPlayers = roster;
    state.playerClaims = roster.map((player) => normalizePlayerClaim({ id: `claim-${player.id}`, teamId: team.id, rosterPlayerId: player.id, userId: accountId, createdAt: new Date().toISOString() }));
    state.activeTeamId = team.id;
    state.activePlayerId = roster[0].id;
    mergeRosterPlayersIntoPlayers();
    state.player = state.players[0];
    state.screen = "home";
    state.syncStatus = "Saved on this phone";
    persistAll();
    render();
  });
}

async function productionLocalSmoke(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await context.route("**/assets/supabase.min.js*", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: disposableSupabaseStub(),
  }));
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const issues = [];
  const network = [];
  createIssueCollector(page, issues, network);
  try {
    await page.goto(`${productionOrigin}/app.html?production-local=${Date.now()}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof state !== "undefined" && typeof render === "function");
    assert.equal(await page.title(), "LaxHornet App");
    assert.match(await page.locator("body").innerText(), /Track the plays/i);
    await initializeLocalAccount(page);

    const screens = [];
    for (const name of ["Home", "Track", "Review", "Season", "More"]) {
      const button = page.getByRole("button", { name, exact: true });
      assert.equal(await button.count(), 1, `${name} navigation is missing`);
      await button.click();
      assert.ok((await page.locator("body").innerText()).trim().length > 100);
      screens.push(name);
    }
    await page.getByRole("button", { name: /Players & Teams/ }).click();
    assert.match(await page.locator("body").innerText(), /Players & Teams/);
    screens.push("Players & Teams");

    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: "Start New Game" }).click();
    assert.equal(await page.locator("#liveShare").isDisabled(), true);
    assert.match(await page.locator("body").innerText(), /Live Share is temporarily unavailable/i);
    await page.locator("#opponent").fill("Local Rivals");
    await page.locator("#periodFormat").selectOption("quarters");
    await page.getByRole("button", { name: "Start Tracking" }).click();
    await page.evaluate(() => { state.screen = "home"; persistAll(); render(); });
    await page.reload({ waitUntil: "networkidle" });
    try {
      await page.waitForFunction(() => typeof state !== "undefined" && Boolean(state.activeGame));
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        authReady: Boolean(state?.authUser),
        activeGameReady: Boolean(state?.activeGame),
        stubPresent: Array.isArray(window.__V285_PRODUCTION_LOCAL_CLIENT_CALLS),
        stubCalls: (window.__V285_PRODUCTION_LOCAL_CLIENT_CALLS || []).slice(-5),
        sessionFixturePresent: Boolean(localStorage.getItem("v285ProductionLocalSession")),
        activeGameStoragePresent: [...Object.keys(localStorage)].some((key) => key.startsWith("laxhornet.activeGame")),
      }));
      throw new Error(`isolated active-game hydration failed: ${JSON.stringify(diagnostic)}; ${error.message}`);
    }
    const homeText = await page.locator("body").innerText();
    assert.match(homeText, /Jordan Local/);
    assert.match(homeText, /Q1/);
    assert.match(homeText, /Local Rivals/);
    await page.getByRole("button", { name: "Resume Live Game" }).click();
    assert.match(await page.locator("body").innerText(), /Tracking: Jordan Local/);
    const recovery = { status: "PASS", player: true, period: true, opponent: true, resumeAction: true };

    await page.locator('[data-action="save-game"]').click();
    await page.locator('[data-action="end-game"]').click();
    await page.locator('[data-action="confirm-end-game"]').click();
    const ownershipBefore = await page.evaluate(() => ({ gamePlayerId: state.games[0].playerId, gameCount: state.games.length }));
    await page.evaluate(() => { setActivePlayer("isolated-player-b"); state.screen = "games"; render(); });
    assert.equal(await page.evaluate(() => state.activePlayerId), "isolated-player-b");
    await page.locator('[data-action="open-saved-review"]').click();
    const reviewState = await page.evaluate(() => ({
      activePlayerMatchesGame: state.activePlayerId === state.games[0].playerId,
      ownershipUnchanged: state.games[0].playerId,
      reviewMatchesGame: state.reviewGameId === state.games[0].id,
    }));
    assert.equal(reviewState.activePlayerMatchesGame, true);
    assert.equal(reviewState.ownershipUnchanged, ownershipBefore.gamePlayerId);
    assert.equal(reviewState.reviewMatchesGame, true);
    await page.getByRole("button", { name: "Season", exact: true }).click();
    assert.match(await page.locator("body").innerText(), /Jordan Local/);
    const alignment = { status: "PASS", gameOwnerSelected: true, reviewMatchesGame: true, seasonContextMatches: true, ownershipUnchanged: true };

    const mutationRequests = network.filter((entry) =>
      !["GET", "HEAD", "OPTIONS"].includes(entry.method)
      && (/supabase\.co$/i.test(new URL(entry.origin).hostname) || /\/auth\/v1\/admin|\/rest\/v1\/rpc\//.test(entry.path))
    );
    assert.deepEqual(mutationRequests, []);
    assert.deepEqual(issues, []);
    return {
      status: "PASS",
      screens,
      liveShareSafeState: true,
      activeGameRecovery: recovery,
      savedReviewAlignment: alignment,
      consoleOrPageErrors: 0,
      productionMutationRequests: 0,
      hostedSupabaseRequests: network.filter((entry) => /\.supabase\.co$/i.test(new URL(entry.origin).hostname)).length,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const result = {
      capturedAt: new Date().toISOString(),
      productionUrl: productionOrigin,
      deployedSha,
      cleanInstall: await cleanInstall(browser),
      existingV284ClientUpgrade: await legacyUpgrade(browser),
      productionLocalSmoke: await productionLocalSmoke(browser),
      noRealAccountSignIn: true,
      isolatedProfilesCleared: true,
      productionDataMutated: false,
      status: "PASS",
    };
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
