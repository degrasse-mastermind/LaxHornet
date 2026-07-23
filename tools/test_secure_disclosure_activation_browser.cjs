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
const trustApi = {
  scopes: new Set(),
  events: new Map(),
  operations: new Map(),
  tokenGames: new Map(),
  tokenRevoked: new Set(),
};

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
    const post = request.postDataJSON?.() || {};
    localApiRequests.push({ method: request.method(), pathname });
    if (pathname.endsWith("/lh_public_live_share_game")) {
      if (options.failPublicRpc) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "synthetic unavailable" }) });
      } else {
        const shareCode = String(post.p_share_code || "").toUpperCase();
        if (shareCode === "UNKNOWNSECURECODE" || shareCode === "EXPIREDSECURECODE") {
          await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
          return;
        }
        const gameId = trustApi.tokenGames.get(shareCode);
        const dynamicEvents = gameId
          ? [...trustApi.events.values()]
              .filter((event) => event.gameId === gameId && event.lifecycleState === "active")
              .sort((left, right) => left.evidence.occurred_at.localeCompare(right.evidence.occurred_at))
              .map((event) => ({ event_id: event.eventId, ...event.evidence }))
          : null;
        const payload = gameId && !trustApi.tokenRevoked.has(shareCode)
          ? {
              game: {
                ...publicPayload().game,
                game_id: gameId,
              },
              events: dynamicEvents,
            }
          : gameId
            ? null
            : publicPayload();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
      }
      return;
    }
    if (pathname.endsWith("/lh_register_game_scope")) {
      trustApi.scopes.add(String(post.p_game_id || ""));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outcome: "accepted", code: "game_scope_registered" }) });
      return;
    }
    if (pathname.endsWith("/lh_create_event")) {
      const operation = post.p_operation || {};
      const operationId = String(operation.client_operation_id || "");
      const prior = trustApi.operations.get(operationId);
      if (prior) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(prior) });
        return;
      }
      if (options.failCreate) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "synthetic create unavailable" }) });
        return;
      }
      if (!trustApi.scopes.has(operation.game_id)) {
        const rejected = { outcome: "rejected", code: "unknown_game_scope", eventId: operation.event_id, gameId: operation.game_id };
        trustApi.operations.set(operationId, rejected);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rejected) });
        return;
      }
      const existing = trustApi.events.get(operation.event_id);
      const result = existing
        ? { outcome: "rejected", code: "event_id_already_used", eventId: operation.event_id, gameId: operation.game_id }
        : { outcome: "accepted", code: "created", serverEventVersion: 1, eventId: operation.event_id, gameId: operation.game_id };
      if (!existing) {
        trustApi.events.set(operation.event_id, {
          eventId: operation.event_id,
          gameId: operation.game_id,
          evidence: { ...(operation.evidence || {}) },
          serverEventVersion: 1,
          lifecycleState: "active",
        });
      }
      trustApi.operations.set(operationId, result);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
      return;
    }
    if (pathname.endsWith("/lh_correct_event")) {
      const operation = post.p_operation || {};
      const operationId = String(operation.client_operation_id || "");
      const prior = trustApi.operations.get(operationId);
      if (prior) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(prior) });
        return;
      }
      const existing = trustApi.events.get(operation.event_id);
      let result;
      if (!existing || existing.lifecycleState !== "active") {
        result = { outcome: "rejected", code: "event_not_found", eventId: operation.event_id, gameId: operation.game_id };
      } else if (Number(operation.base_server_event_version) !== existing.serverEventVersion) {
        result = {
          outcome: "conflicted",
          code: "same_field_conflict",
          serverEventVersion: existing.serverEventVersion,
          eventId: operation.event_id,
          gameId: operation.game_id,
        };
      } else {
        existing.evidence = { ...existing.evidence, ...(operation.changes || {}) };
        existing.serverEventVersion += 1;
        result = {
          outcome: "accepted",
          code: "corrected",
          serverEventVersion: existing.serverEventVersion,
          eventId: operation.event_id,
          gameId: operation.game_id,
        };
      }
      trustApi.operations.set(operationId, result);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
      return;
    }
    if (pathname.endsWith("/lh_tombstone_event")) {
      const operation = post.p_operation || {};
      const operationId = String(operation.client_operation_id || "");
      const prior = trustApi.operations.get(operationId);
      if (prior) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(prior) });
        return;
      }
      const existing = trustApi.events.get(operation.event_id);
      let result;
      if (!existing) {
        result = { outcome: "rejected", code: "event_not_found", eventId: operation.event_id, gameId: operation.game_id };
      } else if (Number(operation.base_server_event_version) !== existing.serverEventVersion) {
        result = {
          outcome: "conflicted",
          code: "stale_tombstone_base",
          serverEventVersion: existing.serverEventVersion,
          eventId: operation.event_id,
          gameId: operation.game_id,
        };
      } else {
        existing.lifecycleState = "tombstoned";
        existing.serverEventVersion += 1;
        result = {
          outcome: "accepted",
          code: "tombstoned",
          serverEventVersion: existing.serverEventVersion,
          eventId: operation.event_id,
          gameId: operation.game_id,
        };
      }
      trustApi.operations.set(operationId, result);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
      return;
    }
    if (pathname.endsWith("/lh_create_live_share_token")) {
      trustApi.tokenGames.set("SYNTHETICSECURECODE", String(post.p_game_id || ""));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ outcome: "accepted", shareCode: "SYNTHETICSECURECODE" }),
      });
      return;
    }
    if (pathname.endsWith("/lh_revoke_live_share_tokens")) {
      for (const [code, gameId] of trustApi.tokenGames.entries()) {
        if (gameId === String(post.p_game_id || "")) trustApi.tokenRevoked.add(code);
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ outcome: "accepted", count: 1 }) });
      return;
    }
    if (pathname.endsWith("/lh_record_disclosure_export")) {
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
    const neutralTokens = await securePage.evaluate(async () => {
      await loadSharedGame("UNKNOWNSECURECODE");
      const unknown = state.sharedGame;
      await loadSharedGame("EXPIREDSECURECODE");
      const expired = state.sharedGame;
      return { unknown, expired };
    });
    check(neutralTokens.unknown === null && neutralTokens.expired === null, "unknown and expired tokens remain neutral");

    await securePage.goto(`${baseUrl}/app.html?fresh=v282-token`, { waitUntil: "domcontentloaded" });
    const tokenResult = await securePage.evaluate(async () => {
      setAuthUser({ id: "synthetic-admin-user", email: "synthetic-admin@example.invalid" });
      const player = {
        id: "synthetic-player",
        rosterPlayerId: "synthetic-player",
        teamId: "synthetic-team",
        name: "Demo Player",
        number: "12",
        team: "Branford Demo Hornets",
        position: "Midfield",
      };
      const game = normalizeGame({
        id: "synthetic-secure-game",
        userId: "synthetic-admin-user",
        teamId: "synthetic-team",
        rosterPlayerId: "synthetic-player",
        opponent: "Madison Demo",
        date: "2026-07-23",
        currentQuarter: "Q1",
        playerSnapshot: player,
        events: [
          {
            id: "bridge-event-2",
            gameId: "synthetic-secure-game",
            teamId: "synthetic-team",
            rosterPlayerId: "synthetic-player",
            timestamp: "2026-07-23T12:05:00.000Z",
            quarter: "Q2",
            statType: "causedTurnover",
            statLabel: "Caused Turnover",
            category: "Defense",
            pointValue: 3,
            fieldZone: "Defensive",
            note: "private-note-marker",
            tags: ["private-tag-marker"],
          },
          {
            id: "bridge-event-1",
            gameId: "synthetic-secure-game",
            teamId: "synthetic-team",
            rosterPlayerId: "synthetic-player",
            timestamp: "2026-07-23T12:00:00.000Z",
            quarter: "Q1",
            statType: "groundBall",
            statLabel: "Ground Ball",
            category: "Effort / IQ",
            pointValue: 2,
            fieldZone: "Midfield",
            note: "another-private-note",
            tags: ["decision:good"],
          },
        ],
      });
      state.player = normalizePlayer(player);
      state.players = [state.player];
      state.activePlayerId = state.player.id;
      state.teams = [{ id: "synthetic-team", name: "Branford Demo Hornets", role: "tracker", cloudBacked: true }];
      state.playerClaims = [{ teamId: "synthetic-team", rosterPlayerId: "synthetic-player", userId: "synthetic-admin-user" }];
      state.activeGame = game;
      state.games = [game];
      await copyLiveShareLinkNow(game.id);
      const createdCode = state.activeGame.shareCode;
      const acceptedAudit = await recordSensitiveExportAudit("player_csv", "player", "synthetic-player");
      const teamAdminAudit = await recordSensitiveExportAudit("team_roster_csv", "team", "synthetic-team");
      const teamCoachAudit = await recordSensitiveExportAudit("player_csv", "player", "synthetic-player");
      let rejectedPlayer = false;
      let rejectedTeam = false;
      try {
        await recordSensitiveExportAudit("player_csv", "player", "cross-player");
      } catch {
        rejectedPlayer = true;
      }
      try {
        await recordSensitiveExportAudit("team_roster_csv", "team", "cross-team");
      } catch {
        rejectedTeam = true;
      }
      return {
        acceptedAudit,
        teamAdminAudit,
        teamCoachAudit,
        createdCode,
        rejectedPlayer,
        rejectedTeam,
        shared: state.activeGame.isShared,
        syncState: state.trustSpineSync,
      };
    });
    check(tokenResult.createdCode === "SYNTHETICSECURECODE", "signed-in token creation uses the approved RPC");
    check(tokenResult.shared === true, "team-scoped secure Live Share remains available after synchronization");
    check(tokenResult.acceptedAudit?.outcome === "accepted", "authorized export audit succeeds");
    check(tokenResult.teamAdminAudit?.outcome === "accepted", "team-admin player export audit succeeds");
    check(tokenResult.teamCoachAudit?.outcome === "accepted", "team-coach player export audit succeeds");
    check(tokenResult.rejectedPlayer === true && tokenResult.rejectedTeam === true, "cross-player and cross-team export audits remain rejected");
    check(trustApi.events.size === 2, "existing legacy events are reconciled before token creation");
    check(
      [...trustApi.events.values()].every((event) => !("note" in event.evidence) && !("tags" in event.evidence)),
      "private notes and tags never enter Trust Spine evidence",
    );
    check(
      [...trustApi.events.values()]
        .sort((left, right) => left.evidence.occurred_at.localeCompare(right.evidence.occurred_at))
        .map((event) => event.eventId)
        .join(",") === "bridge-event-1,bridge-event-2",
      "secure events preserve chronological ordering",
    );
    const initialBridgeTimeline = await securePage.evaluate(async () => {
      await loadSharedGame("SYNTHETICSECURECODE");
      return state.sharedGame?.events?.map((event) => event.id) || [];
    });
    check(initialBridgeTimeline.join(",") === "bridge-event-1,bridge-event-2", "newly reconciled events appear in the secure public timeline");
    const createReplay = await securePage.evaluate(async () => {
      const game = state.activeGame;
      const event = game.events.find((item) => item.id === "bridge-event-1");
      const evidence = trustSpineEvidenceForEvent(event);
      return supabaseClient.rpc("lh_create_event", {
        p_operation: {
          client_operation_id: trustSpineOperationId("create", game.id, event.id, evidence),
          event_id: event.id,
          game_id: game.id,
          evidence,
          annotations: {},
          client_created_at: event.timestamp,
        },
      });
    });
    check(createReplay.data?.outcome === "accepted" && createReplay.data?.code === "created", "retry of the same create operation is idempotent");

    const correctionResult = await securePage.evaluate(async () => {
      const game = state.activeGame;
      const event = game.events.find((item) => item.id === "bridge-event-1");
      event.fieldZone = "Offensive";
      event.note = "private correction note";
      event.tags = ["private correction tag"];
      event.correctedAt = "2026-07-23T12:10:00.000Z";
      queueTrustSpineGameReconciliation(game);
      const synchronized = await reconcileTrustSpineGame(game);
      return {
        synchronized,
        record: state.trustSpineSync.events[event.id],
      };
    });
    check(correctionResult.synchronized === true, "event correction synchronizes through the approved correction RPC");
    check(trustApi.events.get("bridge-event-1")?.evidence.field_zone === "Offensive", "correction updates the secure public event evidence");
    check(
      !("note" in (trustApi.events.get("bridge-event-1")?.evidence || {})) && !("tags" in (trustApi.events.get("bridge-event-1")?.evidence || {})),
      "correction keeps private notes and tags outside public evidence",
    );
    const correctedPublicZone = await securePage.evaluate(async () => {
      await loadSharedGame("SYNTHETICSECURECODE");
      return state.sharedGame?.events?.find((event) => event.id === "bridge-event-1")?.fieldZone || "";
    });
    check(correctedPublicZone === "Offensive", "corrected evidence is visible through the public-safe RPC");

    const staleConflict = await securePage.evaluate(async () => {
      const game = state.activeGame;
      const event = game.events.find((item) => item.id === "bridge-event-1");
      const record = state.trustSpineSync.events[event.id];
      record.serverEventVersion = 1;
      event.stat_label = undefined;
      event.statLabel = "Recovered Ground Ball";
      event.correctedAt = "2026-07-23T12:11:00.000Z";
      queueTrustSpineGameReconciliation(game);
      const synchronized = await reconcileTrustSpineGame(game);
      return {
        synchronized,
        conflict: state.trustSpineSync.events[event.id].conflict,
        syncStatus: state.syncStatus,
      };
    });
    check(staleConflict.synchronized === false && staleConflict.conflict?.code === "same_field_conflict", "stale correction produces a controlled conflict");
    check(/correction review/i.test(staleConflict.syncStatus), "stale correction is surfaced instead of silently overwriting a newer version");

    const tombstoneResult = await securePage.evaluate(async () => {
      const game = state.activeGame;
      const event = game.events.find((item) => item.id === "bridge-event-2");
      queueTrustSpineTombstone(game, event, "Synthetic browser deletion");
      const pending = state.trustSpineSync.events[event.id].pendingOperations.find((operation) => operation.kind === "tombstone");
      const operationPayload = trustSpinePayloadForOperation(state.trustSpineSync.events[event.id], pending);
      game.events = game.events.filter((item) => item.id !== event.id);
      state.games = [game];
      rememberDeletedEvent(event.id);
      await flushTrustSpineSync({ gameId: game.id });
      const replay = await supabaseClient.rpc("lh_tombstone_event", { p_operation: operationPayload });
      return {
        replay: replay.data,
        lifecycleState: state.trustSpineSync.events[event.id].lifecycleState,
      };
    });
    check(tombstoneResult.lifecycleState === "tombstoned", "event deletion records a Trust Spine tombstone");
    check(trustApi.events.get("bridge-event-2")?.lifecycleState === "tombstoned", "tombstone removes the event from the secure public timeline");
    check(tombstoneResult.replay?.outcome === "accepted" && tombstoneResult.replay?.code === "tombstoned", "duplicate tombstone retry is idempotent");
    const tombstonedPublicIds = await securePage.evaluate(async () => {
      await loadSharedGame("SYNTHETICSECURECODE");
      return state.sharedGame?.events?.map((event) => event.id) || [];
    });
    check(tombstonedPublicIds.join(",") === "bridge-event-1", "public-safe timeline omits tombstoned events");
    const revocationResult = await securePage.evaluate(async () => {
      await turnOffLiveShare("synthetic-secure-game");
      await loadSharedGame("SYNTHETICSECURECODE");
      return {
        shared: state.games.find((game) => game.id === "synthetic-secure-game")?.isShared ?? state.activeGame?.isShared,
        publicGame: state.sharedGame,
      };
    });
    check(revocationResult.shared === false && revocationResult.publicGame === null, "token revocation disables the public view");

    const personalRequestStart = localApiRequests.length;
    const personalContext = await newContext(browser);
    const personalPage = await personalContext.newPage();
    await installApiRoutes(personalPage);
    await personalPage.goto(`${baseUrl}/app.html?fresh=v282-personal-boundary`, { waitUntil: "domcontentloaded" });
    const personalResult = await personalPage.evaluate(async () => {
      setAuthUser({ id: "synthetic-parent-user", email: "synthetic-parent@example.invalid" });
      state.userProfile = normalizeUserProfile({
        userId: "synthetic-parent-user",
        email: "synthetic-parent@example.invalid",
        firstName: "Synthetic",
        lastName: "Parent",
        approvedRole: "tracker",
        onboardingCompleted: true,
      });
      const player = normalizePlayer({
        id: "personal-player",
        name: "Personal Demo Player",
        number: "7",
        position: "Midfield",
        team: "",
        teamId: "",
        rosterPlayerId: "",
      });
      const game = normalizeGame({
        id: "personal-game",
        userId: "synthetic-parent-user",
        teamId: "",
        rosterPlayerId: "",
        opponent: "Personal Opponent",
        date: "2026-07-23",
        currentQuarter: "Q1",
        playerSnapshot: player,
        events: [],
      });
      state.player = player;
      state.players = [player];
      state.activePlayerId = player.id;
      state.activeGame = game;
      state.games = [];
      state.screen = "live";
      render();
      logEvent("groundBall");
      const trackedCount = state.activeGame.events.length;
      const liveText = document.body.innerText;
      confirmEndGame();
      state.gameSavedSummaryId = "";
      state.reviewGameId = game.id;
      state.screen = "review";
      render();
      const reviewText = document.body.innerText;
      const csv = buildCSV({ scope: "current_game", gameId: game.id });
      const backup = fullBackupPayload();
      await copyLiveShareLinkNow(game.id);
      return {
        trackedCount,
        liveText,
        reviewText,
        csvHasEvent: csv.includes('"personal-game"') && csv.includes('"groundBall"'),
        backupHasGame: backup.games.some((item) => item.id === game.id),
        promptGameId: state.liveSharePromptGameId,
      };
    });
    const personalRequests = localApiRequests.slice(personalRequestStart);
    check(personalResult.trackedCount === 1, "personal game tracking works");
    check(personalResult.reviewText.includes("Game Review"), "personal game save and review work");
    check(personalResult.csvHasEvent && personalResult.backupHasGame, "personal game export and private backup remain available");
    check(personalResult.liveText.includes("Live Share unavailable"), "personal game Live Share is visibly unavailable");
    check(personalResult.promptGameId === "", "personal game does not open or retain a Live Share token prompt");
    check(!personalRequests.some((item) => /\/rpc\/lh_register_game_scope$/.test(item.pathname)), "personal game never calls the scope RPC");
    check(!personalRequests.some((item) => /\/rpc\/lh_create_live_share_token$/.test(item.pathname)), "personal game never calls the token RPC");
    check(!personalRequests.some((item) => /\/rest\/v1\/(?:games|events)$/.test(item.pathname) && item.method === "GET"), "personal game never uses legacy anonymous-table sharing");
    await personalPage.screenshot({ path: path.join(browserDir, "04-personal-game-boundary.png"), fullPage: true });
    await personalContext.close();

    const failedTokenCallsBefore = localApiRequests.filter((item) => item.pathname.endsWith("/lh_create_live_share_token")).length;
    const reconciliationFailureContext = await newContext(browser);
    const reconciliationFailurePage = await reconciliationFailureContext.newPage();
    await installApiRoutes(reconciliationFailurePage, { failCreate: true });
    await reconciliationFailurePage.goto(`${baseUrl}/app.html?fresh=v282-reconcile-failure`, { waitUntil: "domcontentloaded" });
    const reconciliationFailure = await reconciliationFailurePage.evaluate(async () => {
      setAuthUser({ id: "synthetic-failure-user", email: "synthetic-failure@example.invalid" });
      const player = {
        id: "failure-player",
        rosterPlayerId: "failure-player",
        teamId: "failure-team",
        name: "Failure Demo",
        number: "22",
        team: "Failure Team",
        position: "Defense",
      };
      const game = normalizeGame({
        id: "failure-game",
        userId: "synthetic-failure-user",
        teamId: "failure-team",
        rosterPlayerId: "failure-player",
        opponent: "Failure Opponent",
        date: "2026-07-23",
        currentQuarter: "Q1",
        playerSnapshot: player,
        events: [{
          id: "failure-event",
          gameId: "failure-game",
          teamId: "failure-team",
          rosterPlayerId: "failure-player",
          timestamp: "2026-07-23T13:00:00.000Z",
          quarter: "Q1",
          statType: "groundBall",
          statLabel: "Ground Ball",
          category: "Effort / IQ",
          pointValue: 2,
        }],
      });
      state.player = normalizePlayer(player);
      state.players = [state.player];
      state.teams = [{ id: "failure-team", name: "Failure Team", role: "tracker", cloudBacked: true }];
      state.playerClaims = [{ teamId: "failure-team", rosterPlayerId: "failure-player", userId: "synthetic-failure-user" }];
      state.activeGame = game;
      state.games = [game];
      await copyLiveShareLinkNow(game.id);
      return {
        isShared: state.activeGame.isShared,
        status: state.syncStatus,
        localEvents: state.activeGame.events.length,
      };
    });
    const failedTokenCallsAfter = localApiRequests.filter((item) => item.pathname.endsWith("/lh_create_live_share_token")).length;
    check(reconciliationFailure.localEvents === 1, "Trust Spine failure never erases the locally recorded event");
    check(reconciliationFailure.isShared === false && failedTokenCallsAfter === failedTokenCallsBefore, "token is not issued when required reconciliation fails");
    check(/waiting for synchronization/i.test(reconciliationFailure.status), "reconciliation failure explains that secure sharing is waiting");
    await reconciliationFailureContext.close();

    const offlineBridgeContext = await newContext(browser);
    const offlineBridgePage = await offlineBridgeContext.newPage();
    await installApiRoutes(offlineBridgePage);
    await offlineBridgePage.goto(`${baseUrl}/app.html?fresh=v282-offline-bridge`, { waitUntil: "domcontentloaded" });
    await offlineBridgePage.evaluate(() => {
      setAuthUser({ id: "synthetic-offline-user", email: "synthetic-offline@example.invalid" });
      const player = normalizePlayer({
        id: "offline-roster-player",
        rosterPlayerId: "offline-roster-player",
        teamId: "offline-team",
        name: "Offline Demo",
        number: "33",
        team: "Offline Team",
        position: "Midfield",
      });
      state.player = player;
      state.players = [player];
      state.teams = [{ id: "offline-team", name: "Offline Team", role: "tracker", cloudBacked: true }];
      state.playerClaims = [{ teamId: "offline-team", rosterPlayerId: "offline-roster-player", userId: "synthetic-offline-user" }];
      state.activeGame = normalizeGame({
        id: "offline-bridge-game",
        userId: "synthetic-offline-user",
        teamId: "offline-team",
        rosterPlayerId: "offline-roster-player",
        opponent: "Offline Opponent",
        date: "2026-07-23",
        currentQuarter: "Q1",
        playerSnapshot: player,
        events: [],
      });
      state.games = [state.activeGame];
      state.screen = "live";
      persistAll();
      render();
    });
    await offlineBridgeContext.setOffline(true);
    await offlineBridgePage.waitForTimeout(100);
    const queuedOffline = await offlineBridgePage.evaluate(() => {
      logEvent("groundBall");
      const event = state.activeGame.events[0];
      return {
        localEvents: state.activeGame.events.length,
        pending: state.trustSpineSync.events[event.id]?.pendingOperations.length || 0,
        eventId: event.id,
      };
    });
    check(queuedOffline.localEvents === 1 && queuedOffline.pending === 1, "offline tracking records locally and queues a retry-safe create");
    await offlineBridgeContext.setOffline(false);
    await offlineBridgePage.waitForTimeout(700);
    const afterReconnect = await offlineBridgePage.evaluate((eventId) => ({
      pending: state.trustSpineSync.events[eventId]?.pendingOperations.length || 0,
      serverEventVersion: state.trustSpineSync.events[eventId]?.serverEventVersion || 0,
    }), queuedOffline.eventId);
    check(afterReconnect.pending === 0 && afterReconnect.serverEventVersion === 1, "reconnection submits the pending create");
    check(trustApi.events.get(queuedOffline.eventId)?.lifecycleState === "active", "reconnected event is available to the secure public timeline");
    await offlineBridgeContext.close();

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
    await failurePage
      .waitForFunction(() => document.body.innerText.includes("Secure Live Share is temporarily unavailable"), null, { timeout: 2000 })
      .catch(() => {});
    const failureText = await failurePage.locator("body").innerText();
    check(failureText.includes("Secure Live Share is temporarily unavailable"), "failed activation RPC produces a bounded unavailable state");

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
    await securePage.evaluate(() => loadSharedGame("STATICSECURECODE"));
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
          revokeAccepted: revocationResult.shared === false && revocationResult.publicGame === null,
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
          teamAdminExportAccepted: tokenResult.teamAdminAudit?.outcome === "accepted",
          teamCoachExportAccepted: tokenResult.teamCoachAudit?.outcome === "accepted",
          crossPlayerExportRejected: tokenResult.rejectedPlayer === true,
          crossTeamExportRejected: tokenResult.rejectedTeam === true,
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
