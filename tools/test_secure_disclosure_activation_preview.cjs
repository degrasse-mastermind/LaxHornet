const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const evidenceRoot = path.join(root, "review-evidence", "secure-disclosure-activation-v282");
const browserDir = path.join(evidenceRoot, "browser");
const previewRef = process.env.LAXHORNET_PREVIEW_PROJECT_REF || "";
const expectedPreviewRefHash = "434ca80780dda1b0840ba453d4d8db948e82ccb6d39979fe9b146914fc143f38";
const publishableKey = process.env.LAXHORNET_PREVIEW_PUBLISHABLE_KEY || "";
const serviceRoleKey = process.env.LAXHORNET_PREVIEW_SERVICE_ROLE_KEY || "";
const managementToken = process.env.LAXHORNET_PREVIEW_MANAGEMENT_TOKEN || "";
const syntheticPassword = process.env.LAXHORNET_PREVIEW_TEST_PASSWORD || "";
const previewOrigin = `https://${previewRef}.supabase.co`;
const managementOrigin = "https://api.supabase.com";
const port = Number(process.env.LAXHORNET_PREVIEW_BROWSER_PORT || 5262);
const localOrigin = `http://127.0.0.1:${port}`;

const missing = [
  ["LAXHORNET_PREVIEW_PROJECT_REF", previewRef],
  ["LAXHORNET_PREVIEW_PUBLISHABLE_KEY", publishableKey],
  ["LAXHORNET_PREVIEW_SERVICE_ROLE_KEY", serviceRoleKey],
  ["LAXHORNET_PREVIEW_MANAGEMENT_TOKEN", managementToken],
  ["LAXHORNET_PREVIEW_TEST_PASSWORD", syntheticPassword],
].filter(([, value]) => !value).map(([name]) => name);

if (missing.length) {
  console.error(`Missing managed-preview variables: ${missing.join(", ")}`);
  process.exit(2);
}
if (createHash("sha256").update(previewRef).digest("hex") !== expectedPreviewRefHash) {
  console.error("Refusing to run outside the explicitly permitted managed preview.");
  process.exit(2);
}

fs.mkdirSync(browserDir, { recursive: true });

const runId = `v282-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const fixture = {
  teamA: `${runId}-team-a`,
  teamB: `${runId}-team-b`,
  playerA: `${runId}-player-a`,
  playerA2: `${runId}-player-a2`,
  playerB: `${runId}-player-b`,
  gameA: `${runId}-game-a`,
  eventA: `${runId}-event-a`,
  adminGrant: `${runId}-admin-grant`,
  coachGrant: `${runId}-coach-grant`,
  parentGrant: `${runId}-parent-grant`,
  coachInvitation: `${runId}-coach-invitation`,
  parentInvitation: `${runId}-parent-invitation`,
  expiredTokenId: `${runId}-expired-token`,
  revokedTokenId: `${runId}-revoked-token`,
};
const expiredCode = randomBytes(18).toString("hex").toUpperCase();
const revokedCode = randomBytes(18).toString("hex").toUpperCase();
const userEmails = {
  admin: `${runId}-admin@example.com`,
  coach: `${runId}-coach@example.com`,
  parent: `${runId}-parent@example.com`,
};
const results = [];
const networkInventory = [];
const browserDiagnostics = [];
let server;
let browser;
let cleanupStarted = false;

function check(condition, message, evidence = null) {
  if (!condition) {
    const suffix = evidence ? `\n${JSON.stringify(evidence, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
  results.push({ status: "pass", message });
}

function sanitizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  return { host: url.host, methodPath: url.pathname };
}

async function request(url, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { message: "non-json response" };
  }
  return { status: response.status, body: parsed };
}

function dataHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function management(pathname, options = {}) {
  return request(`${managementOrigin}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function rpc(name, args, token = publishableKey) {
  return request(`${previewOrigin}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: dataHeaders(publishableKey, { Authorization: `Bearer ${token}` }),
    body: args,
  });
}

async function tableInsert(table, rows) {
  const response = await request(`${previewOrigin}/rest/v1/${table}`, {
    method: "POST",
    headers: dataHeaders(serviceRoleKey, { Prefer: "return=minimal" }),
    body: rows,
  });
  check(response.status === 201, `seeded ${table}`, response);
}

async function waitForPreviewReady() {
  const deadline = Date.now() + 8 * 60 * 1000;
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    const branch = await management(`/v1/branches/${previewRef}`);
    lastStatus = branch.body?.status || `http-${branch.status}`;
    if (branch.status === 200 && lastStatus === "ACTIVE_HEALTHY") {
      const health = await rpc("lh_public_live_share_game", { p_share_code: "V282_HEALTH_CHECK" });
      if (health.status === 200 && health.body === null) return lastStatus;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Managed preview did not become ready: ${lastStatus}`);
}

async function resetPreview(label) {
  cleanupStarted = label === "post-test";
  const reset = await management(`/v1/branches/${previewRef}/reset`, {
    method: "POST",
    body: {},
  });
  check(reset.status === 201 && reset.body?.workflow_run_id, `${label} preview reset accepted`, {
    status: reset.status,
    hasWorkflowId: Boolean(reset.body?.workflow_run_id),
  });
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await waitForPreviewReady();
}

async function createAuthUser(role) {
  const response = await request(`${previewOrigin}/auth/v1/admin/users`, {
    method: "POST",
    headers: dataHeaders(serviceRoleKey),
    body: {
      email: userEmails[role],
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: { synthetic: true, test_role: role, test_run: runId },
    },
  });
  check(response.status === 200 && response.body?.id, `created synthetic ${role} Auth user`, {
    status: response.status,
    userCreated: Boolean(response.body?.id),
  });
  return response.body.id;
}

async function signIn(email) {
  const response = await request(`${previewOrigin}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: dataHeaders(publishableKey),
    body: { email, password: syntheticPassword },
  });
  check(response.status === 200 && response.body?.access_token, `signed in ${email.split("@")[0]}`, {
    status: response.status,
    signedIn: Boolean(response.body?.access_token),
  });
  return { token: response.body.access_token, userId: response.body.user.id };
}

async function seedFixture(users) {
  const now = Date.now();
  const issuedAt = new Date(now - 60 * 60 * 1000).toISOString();
  const acceptedAt = new Date(now - 59 * 60 * 1000).toISOString();

  await tableInsert("lh_team_scopes", [
    { team_id: fixture.teamA, team_name_snapshot: "Branford Demo Hornets" },
    { team_id: fixture.teamB, team_name_snapshot: "Madison Demo Hornets" },
  ]);
  await tableInsert("lh_player_scopes", [
    {
      team_id: fixture.teamA,
      roster_player_id: fixture.playerA,
      player_name_snapshot: "Demo Player",
      jersey_snapshot: "12",
      position_snapshot: "Midfield",
    },
    {
      team_id: fixture.teamA,
      roster_player_id: fixture.playerA2,
      player_name_snapshot: "Second Demo Player",
      jersey_snapshot: "22",
      position_snapshot: "Defense",
    },
    {
      team_id: fixture.teamB,
      roster_player_id: fixture.playerB,
      player_name_snapshot: "Cross Team Demo Player",
      jersey_snapshot: "31",
      position_snapshot: "Attack",
    },
  ]);
  await tableInsert("lh_game_scopes", {
    game_id: fixture.gameA,
    team_id: fixture.teamA,
    roster_player_id: fixture.playerA,
    opponent_snapshot: "Madison Demo",
    game_date_snapshot: "2026-07-23",
    period_format_snapshot: "quarters",
    final_score_for: 6,
    final_score_against: 4,
  });
  await tableInsert("lh_access_grants", {
    id: fixture.adminGrant,
    user_id: users.admin,
    role: "team_admin",
    scope_type: "team",
    team_id: fixture.teamA,
    provenance_type: "system_bootstrap",
    issued_by_user_id: users.admin,
    issued_at: issuedAt,
  });
  await tableInsert("lh_grant_lifecycle_events", {
    id: `${runId}-admin-issued`,
    grant_id: fixture.adminGrant,
    sequence: 1,
    event_type: "issued",
    actor_user_id: users.admin,
    occurred_at: issuedAt,
  });
  await tableInsert("lh_grant_lifecycle_events", {
    id: `${runId}-admin-accepted`,
    grant_id: fixture.adminGrant,
    sequence: 2,
    event_type: "accepted",
    actor_user_id: users.admin,
    occurred_at: acceptedAt,
  });
  for (const role of ["coach", "parent"]) {
    const isCoach = role === "coach";
    const invitationId = isCoach ? fixture.coachInvitation : fixture.parentInvitation;
    const grantId = isCoach ? fixture.coachGrant : fixture.parentGrant;
    await tableInsert("lh_access_invitations", {
      id: invitationId,
      invited_user_id: users[role],
      invited_email: userEmails[role],
      role,
      scope_type: isCoach ? "team" : "player",
      team_id: fixture.teamA,
      roster_player_id: isCoach ? null : fixture.playerA,
      invited_by_user_id: users.admin,
      invited_by_grant_id: fixture.adminGrant,
      status: "accepted",
      created_at: issuedAt,
      accepted_at: acceptedAt,
    });
    await tableInsert("lh_access_grants", {
      id: grantId,
      user_id: users[role],
      role,
      scope_type: isCoach ? "team" : "player",
      team_id: fixture.teamA,
      roster_player_id: isCoach ? null : fixture.playerA,
      provenance_type: "invitation",
      invitation_id: invitationId,
      issued_by_user_id: users.admin,
      issued_by_grant_id: fixture.adminGrant,
      issued_at: acceptedAt,
    });
    await tableInsert("lh_grant_lifecycle_events", {
      id: `${runId}-${role}-issued`,
      grant_id: grantId,
      sequence: 1,
      event_type: "issued",
      actor_user_id: users.admin,
      actor_grant_id: fixture.adminGrant,
      occurred_at: acceptedAt,
    });
    await tableInsert("lh_grant_lifecycle_events", {
      id: `${runId}-${role}-accepted`,
      grant_id: grantId,
      sequence: 2,
      event_type: "accepted",
      actor_user_id: users[role],
      occurred_at: new Date(now - 58 * 60 * 1000).toISOString(),
    });
  }
  await tableInsert("lh_live_share_tokens", [
    {
      token_id: fixture.expiredTokenId,
      token_hash: createHash("sha256").update(expiredCode).digest("hex"),
      game_id: fixture.gameA,
      created_by_user_id: users.admin,
      created_by_grant_id: fixture.adminGrant,
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now - 60 * 60 * 1000).toISOString(),
      revoked_at: null,
    },
    {
      token_id: fixture.revokedTokenId,
      token_hash: createHash("sha256").update(revokedCode).digest("hex"),
      game_id: fixture.gameA,
      created_by_user_id: users.admin,
      created_by_grant_id: fixture.adminGrant,
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      expires_at: null,
      revoked_at: new Date(now - 60 * 60 * 1000).toISOString(),
    },
  ]);
}

async function createSyntheticEvent(parentSession) {
  const response = await rpc("lh_create_event", {
    p_operation: {
      client_operation_id: `${runId}-create-event`,
      event_id: fixture.eventA,
      game_id: fixture.gameA,
      client_created_at: "2026-07-23T18:10:00.000Z",
      evidence: {
        occurred_at: "2026-07-23T18:10:00.000Z",
        period: "Q2",
        stat_type: "groundBall",
        stat_label: "Ground Ball",
        category: "Possession",
        point_value: 2,
        field_zone: "midfield",
      },
      annotations: {
        note: "SYNTHETIC_PRIVATE_NOTE_MUST_NOT_BE_PUBLIC",
        tags: ["SYNTHETIC_PRIVATE_TAG_MUST_NOT_BE_PUBLIC"],
      },
    },
  }, parentSession.token);
  check(
    response.status === 200
      && response.body?.outcome === "accepted"
      && response.body?.code === "created",
    "created synthetic event through the approved authenticated RPC",
    response,
  );
}

function exactKeys(value) {
  return Object.keys(value || {}).sort();
}

async function runRpcChecks(sessions) {
  for (const table of ["games", "events"]) {
    const direct = await request(`${previewOrigin}/rest/v1/${table}?select=*&limit=1`, {
      headers: dataHeaders(publishableKey),
    });
    check(
      direct.status >= 400 || (Array.isArray(direct.body) && direct.body.length === 0),
      `anonymous ${table} read exposes no rows`,
      direct,
    );
  }

  const create = await rpc("lh_create_live_share_token", {
    p_game_id: fixture.gameA,
    p_expires_at: null,
  }, sessions.admin.token);
  check(create.status === 200 && create.body?.outcome === "accepted", "team admin created a game-scoped token", create);
  const shareCode = create.body.shareCode;
  check(/^[A-F0-9]{32}$/.test(shareCode), "created token has the expected random shape");

  const publicRead = await rpc("lh_public_live_share_game", { p_share_code: shareCode });
  check(publicRead.status === 200 && publicRead.body?.game, "anonymous public-safe read succeeded", publicRead);
  const allowedGameKeys = [
    "final_score_against", "final_score_for", "game_date", "game_id", "jersey_number",
    "opponent", "period_format", "player_name", "position", "team_name",
  ].sort();
  const allowedEventKeys = [
    "category", "event_id", "field_zone", "occurred_at", "period", "point_value",
    "stat_label", "stat_type",
  ].sort();
  check(JSON.stringify(exactKeys(publicRead.body.game)) === JSON.stringify(allowedGameKeys), "public game payload matches the exact allowlist");
  check(JSON.stringify(exactKeys(publicRead.body.events?.[0])) === JSON.stringify(allowedEventKeys), "public event payload matches the exact allowlist");
  const serialized = JSON.stringify(publicRead.body).toLowerCase();
  check(!serialized.includes("synthetic_private_note"), "public payload excludes private notes");
  check(!serialized.includes("synthetic_private_tag"), "public payload excludes private tags");

  const poll = await rpc("lh_public_live_share_game", { p_share_code: shareCode });
  check(JSON.stringify(poll.body) === JSON.stringify(publicRead.body), "public-safe polling preserves the allowlisted shape");
  for (const code of [randomBytes(18).toString("hex").toUpperCase(), expiredCode, revokedCode]) {
    const neutral = await rpc("lh_public_live_share_game", { p_share_code: code });
    check(neutral.status === 200 && neutral.body === null, "unknown, expired, or revoked token fails neutrally");
  }

  const audit = async (session, scopeId) => rpc("lh_record_disclosure_export", {
    p_export_type: "player_csv",
    p_scope_type: "player",
    p_scope_id: scopeId,
    p_outcome: "accepted",
  }, session.token);
  const adminAudit = await audit(sessions.admin, fixture.playerA);
  check(adminAudit.body?.outcome === "accepted", "team administrator player-export audit succeeded", adminAudit);
  const coachAudit = await audit(sessions.coach, fixture.playerA);
  check(coachAudit.body?.outcome === "accepted", "team-scoped coach player-export audit succeeded", coachAudit);
  const parentAudit = await audit(sessions.parent, fixture.playerA);
  check(parentAudit.body?.outcome === "accepted", "player-scoped parent audit succeeded for the granted player", parentAudit);
  const crossPlayer = await audit(sessions.parent, fixture.playerA2);
  check(crossPlayer.body?.outcome === "rejected" && crossPlayer.body?.code === "unauthorized_scope", "cross-player export audit was rejected", crossPlayer);
  const crossTeam = await audit(sessions.parent, fixture.playerB);
  check(crossTeam.body?.outcome === "rejected" && crossTeam.body?.code === "unauthorized_scope", "cross-team export audit was rejected", crossTeam);

  const backup = await rpc("lh_record_disclosure_export", {
    p_export_type: "full_backup",
    p_scope_type: "account",
    p_scope_id: sessions.parent.userId,
    p_outcome: "accepted",
  }, sessions.parent.token);
  check(backup.body?.outcome === "accepted", "private backup audit succeeded for the signed-in account", backup);
  const wrongBackup = await rpc("lh_record_disclosure_export", {
    p_export_type: "full_backup",
    p_scope_type: "account",
    p_scope_id: sessions.admin.userId,
    p_outcome: "accepted",
  }, sessions.parent.token);
  check(wrongBackup.body?.outcome === "rejected" && wrongBackup.body?.code === "unauthorized_scope", "private backup audit rejected another account", wrongBackup);

  return {
    shareCode,
    publicPayload: publicRead.body,
    tokenEvidence: {
      created: create.body?.outcome,
      codeLength: shareCode.length,
      polled: poll.status === 200,
      unknownExpiredRevokedNeutral: true,
    },
    exportEvidence: {
      teamAdmin: adminAudit.body?.outcome,
      teamCoach: coachAudit.body?.outcome,
      parentOwnPlayer: parentAudit.body?.outcome,
      crossPlayer: crossPlayer.body?.code,
      crossTeam: crossTeam.body?.code,
      ownBackup: backup.body?.outcome,
      otherAccountBackup: wrongBackup.body?.code,
    },
  };
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const localServer = http.createServer((req, res) => {
      let pathname = decodeURIComponent(new URL(req.url, localOrigin).pathname);
      if (pathname === "/") pathname = "/app.html";
      const target = path.resolve(root, `.${pathname}`);
      if (!target.startsWith(root) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType(target) });
      res.end(fs.readFileSync(target));
    });
    localServer.listen(port, "127.0.0.1", () => resolve(localServer));
  });
}

async function runBrowserCheck(shareCode) {
  server = await startServer();
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ url, key }) => {
    window.LAXHORNET_RUNTIME_CONFIG = {
      supabaseUrl: url,
      supabasePublishableKey: key,
    };
  }, { url: previewOrigin, key: publishableKey });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserDiagnostics.push(`console:${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserDiagnostics.push(`pageerror: ${error.message}`));
  page.on("request", (browserRequest) => {
    const url = new URL(browserRequest.url());
    networkInventory.push({
      method: browserRequest.method(),
      host: url.host,
      path: url.pathname,
      resourceType: browserRequest.resourceType(),
    });
  });
  await page.goto(`${localOrigin}/app.html?share=${encodeURIComponent(shareCode)}&fresh=v282-managed-preview`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Ground Ball", { exact: false }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(4500);
  const body = await page.locator("body").innerText();
  const status = await page.evaluate(() => window.LAXHORNET_DISCLOSURE_STATUS);
  const scriptOrder = await page.evaluate(() => window.LAXHORNET_SCRIPT_ORDER);
  check(status?.ready === true, "managed browser reports secure disclosure ready");
  check(Object.values(status?.features || {}).every(Boolean), "managed browser reports all three secure flags true");
  check(JSON.stringify(scriptOrder) === JSON.stringify(["runtime-config", "app"]), "managed browser executes runtime-config before app.js");
  check(body.includes("Ground Ball"), "managed browser renders an allowlisted event");
  check(!body.includes("SYNTHETIC_PRIVATE_NOTE"), "managed browser excludes the private note");
  check(!body.includes("SYNTHETIC_PRIVATE_TAG"), "managed browser excludes the private tag");
  const previewRpcRequests = networkInventory.filter((item) =>
    item.host === `${previewRef}.supabase.co`
      && item.path.endsWith("/rest/v1/rpc/lh_public_live_share_game"));
  check(previewRpcRequests.length >= 2, "managed browser polls the public-safe RPC");
  check(!networkInventory.some((item) =>
    item.host === `${previewRef}.supabase.co`
      && /^\/rest\/v1\/(?:games|events)(?:\/|$)/.test(item.path)), "managed browser makes no ordinary games/events request");
  check(!networkInventory.some((item) =>
    item.host.endsWith(".supabase.co")
      && item.host !== `${previewRef}.supabase.co`), "managed browser makes no foreign hosted-project request");
  await page.screenshot({
    path: path.join(browserDir, "04-managed-preview-live-share.png"),
    fullPage: true,
  });
}

async function verifyCleanup() {
  const deadline = Date.now() + 8 * 60 * 1000;
  let finalEvidence = null;
  while (Date.now() < deadline) {
    const fixtureRead = await request(
      `${previewOrigin}/rest/v1/lh_team_scopes?team_id=eq.${encodeURIComponent(fixture.teamA)}&select=team_id`,
      { headers: dataHeaders(serviceRoleKey) },
    );
    const users = await request(`${previewOrigin}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: dataHeaders(serviceRoleKey),
    });
    const listedUsers = users.body?.users || [];
    const rowsRemaining = Array.isArray(fixtureRead.body) ? fixtureRead.body.length : null;
    const usersRemaining = listedUsers.filter((user) => Object.values(userEmails).includes(user.email)).length;
    finalEvidence = {
      tableStatus: fixtureRead.status,
      authStatus: users.status,
      rowsRemaining,
      usersRemaining,
    };
    if (fixtureRead.status === 200 && users.status === 200 && rowsRemaining === 0 && usersRemaining === 0) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  check(finalEvidence?.rowsRemaining === 0, "post-test reset removed synthetic Trust Spine rows", finalEvidence);
  check(finalEvidence?.usersRemaining === 0, "post-test reset removed synthetic Auth users", finalEvidence);
}

function writeEvidence(rpcEvidence) {
  const hosted = networkInventory.filter((item) => item.host.endsWith(".supabase.co"));
  const forbiddenHostedCount = hosted.filter((item) => item.host !== `${previewRef}.supabase.co`).length;
  const sanitizedNetworkInventory = networkInventory.map((item) => ({
    ...item,
    host: item.host === `${previewRef}.supabase.co`
      ? "authorized-preview.supabase.co"
      : item.host.endsWith(".supabase.co")
        ? "unexpected-supabase-host"
        : item.host,
  }));
  fs.writeFileSync(
    path.join(evidenceRoot, "managed-preview-results.json"),
    `${JSON.stringify({
      suite: "LaxHornet v282 managed-preview activation",
      environment: "authorized managed preview",
      synthetic: true,
      testsPassed: results.length,
      testsFailed: 0,
      results,
      browserDiagnostics,
    }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(evidenceRoot, "managed-preview-network-inventory.json"),
    `${JSON.stringify({
      previewHost: "authorized-preview.supabase.co",
      forbiddenHostedRequestCount: forbiddenHostedCount,
      hostedRequestCount: hosted.length,
      requests: sanitizedNetworkInventory,
    }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(evidenceRoot, "managed-preview-public-payload.json"),
    `${JSON.stringify(rpcEvidence.publicPayload, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(evidenceRoot, "managed-preview-token-lifecycle.json"),
    `${JSON.stringify(rpcEvidence.tokenEvidence, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(evidenceRoot, "managed-preview-export-audit.json"),
    `${JSON.stringify(rpcEvidence.exportEvidence, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(evidenceRoot, "managed-preview-cleanup-proof.json"),
    `${JSON.stringify({
      environment: "authorized managed preview",
      resetAfterTest: true,
      trustSpineFixtureRowsRemaining: 0,
      syntheticAuthUsersRemaining: 0,
      productionContacted: false,
    }, null, 2)}\n`,
  );
}

(async () => {
  let rpcEvidence;
  try {
    await resetPreview("pre-test");
    const users = {
      admin: await createAuthUser("admin"),
      coach: await createAuthUser("coach"),
      parent: await createAuthUser("parent"),
    };
    await seedFixture(users);
    const sessions = {
      admin: await signIn(userEmails.admin),
      coach: await signIn(userEmails.coach),
      parent: await signIn(userEmails.parent),
    };
    await createSyntheticEvent(sessions.parent);
    rpcEvidence = await runRpcChecks(sessions);
    await runBrowserCheck(rpcEvidence.shareCode);
    const revoke = await rpc("lh_revoke_live_share_tokens", {
      p_game_id: fixture.gameA,
    }, sessions.admin.token);
    check(revoke.body?.outcome === "accepted" && revoke.body?.revokedTokenCount >= 1, "token revocation succeeded", revoke);
    const afterRevoke = await rpc("lh_public_live_share_game", {
      p_share_code: rpcEvidence.shareCode,
    });
    check(afterRevoke.status === 200 && afterRevoke.body === null, "revocation immediately disabled the public view", afterRevoke);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (!cleanupStarted) {
      await resetPreview("post-test");
    }
  }
  await verifyCleanup();
  writeEvidence(rpcEvidence);
  console.log(`Managed-preview activation checks passed (${results.length}/${results.length}).`);
  console.log(`Preview host requests observed: ${networkInventory.filter((item) => item.host === `${previewRef}.supabase.co`).length}`);
  console.log(`Foreign hosted-project requests observed: ${networkInventory.filter((item) => item.host.endsWith(".supabase.co") && item.host !== `${previewRef}.supabase.co`).length}`);
  console.log("Synthetic cleanup: Trust Spine rows 0; Auth users 0.");
})().catch(async (error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
