const required = [
  "DISCLOSURE_SUPABASE_URL",
  "DISCLOSURE_PUBLISHABLE_KEY",
  "DISCLOSURE_TEST_EMAIL",
  "DISCLOSURE_TEST_PASSWORD",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`SKIP: missing disposable-staging variables: ${missing.join(", ")}`);
  process.exit(2);
}

const baseUrl = process.env.DISCLOSURE_SUPABASE_URL
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/+$/, "");
const apiKey = process.env.DISCLOSURE_PUBLISHABLE_KEY;

async function request(path, { token, method = "POST", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token || apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let responseBody = null;
  try {
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = { raw: text };
  }
  return { status: response.status, body: responseBody };
}

const rpc = (name, args, token) => request(`/rest/v1/rpc/${name}`, { token, body: args });

function assert(condition, message, evidence) {
  if (!condition) {
    throw new Error(`${message}\n${JSON.stringify(evidence, null, 2)}`);
  }
}

const results = [];
const record = (name, evidence) => results.push({ name, status: "pass", evidence });

const signIn = await request("/auth/v1/token?grant_type=password", {
  body: {
    email: process.env.DISCLOSURE_TEST_EMAIL,
    password: process.env.DISCLOSURE_TEST_PASSWORD,
  },
});
assert(signIn.status === 200 && signIn.body?.access_token, "Synthetic staging sign-in failed", signIn);
const userToken = signIn.body.access_token;
record("synthetic authenticated sign-in", { status: signIn.status, userId: signIn.body.user?.id });

for (const table of ["games", "events", "lh_live_share_tokens", "lh_security_audit_events"]) {
  const direct = await request(`/rest/v1/${table}?select=*&limit=1`, { method: "GET" });
  assert(direct.status >= 400 || (Array.isArray(direct.body) && direct.body.length === 0), `Anonymous ordinary-table read exposed ${table}`, direct);
  record(`anonymous ${table} table denial`, { status: direct.status, body: direct.body });
}

const tokenCreate = await rpc("lh_create_live_share_token", {
  p_game_id: "disclosure-game",
  p_expires_at: null,
}, userToken);
assert(tokenCreate.status === 200 && tokenCreate.body?.outcome === "accepted", "Live Share token creation failed", tokenCreate);
const shareCode = tokenCreate.body.shareCode;
assert(/^[A-F0-9]{32}$/.test(shareCode), "Live Share token is not an unguessable 32-character random value", tokenCreate.body);
record("game-scoped token creation", { status: tokenCreate.status, codeLength: shareCode.length, expiresAt: tokenCreate.body.expiresAt });

const publicResponse = await rpc("lh_public_live_share_game", { p_share_code: shareCode });
assert(publicResponse.status === 200 && publicResponse.body?.game, "Anonymous Live Share RPC failed", publicResponse);

const gameKeys = Object.keys(publicResponse.body.game).sort();
const eventKeys = Object.keys(publicResponse.body.events?.[0] || {}).sort();
const allowedGameKeys = [
  "final_score_against",
  "final_score_for",
  "game_date",
  "game_id",
  "jersey_number",
  "opponent",
  "period_format",
  "player_name",
  "position",
  "team_name",
].sort();
const allowedEventKeys = [
  "category",
  "event_id",
  "field_zone",
  "occurred_at",
  "period",
  "point_value",
  "stat_label",
  "stat_type",
].sort();
assert(JSON.stringify(gameKeys) === JSON.stringify(allowedGameKeys), "Game response exceeded the exact field allowlist", gameKeys);
assert(JSON.stringify(eventKeys) === JSON.stringify(allowedEventKeys), "Event response exceeded the exact field allowlist", eventKeys);

const serialized = JSON.stringify(publicResponse.body).toLowerCase();
for (const forbidden of [
  "note",
  "tags",
  "process",
  "user_id",
  "grant_id",
  "revision",
  "operation",
  "evidence_status",
  "focus",
  "recommendation",
  "email",
]) {
  assert(!serialized.includes(`"${forbidden}"`), `Live Share leaked forbidden field ${forbidden}`, publicResponse.body);
}
record("anonymous Live Share exact allowlist", publicResponse.body);

const authenticatedResponse = await rpc("lh_public_live_share_game", { p_share_code: shareCode }, userToken);
assert(authenticatedResponse.status === 200, "Authenticated Live Share RPC failed", authenticatedResponse);
assert(JSON.stringify(authenticatedResponse.body) === JSON.stringify(publicResponse.body), "Authenticated and anonymous public responses differ", authenticatedResponse);
record("authenticated public-safe response", { status: authenticatedResponse.status });

const pollResponse = await rpc("lh_public_live_share_game", { p_share_code: shareCode });
assert(JSON.stringify(pollResponse.body) === JSON.stringify(publicResponse.body), "Allowlisted polling response changed shape", pollResponse);
record("public-safe polling", { status: pollResponse.status, eventCount: pollResponse.body.events.length });

for (const code of ["UNKNOWNLIVE1234567890", "EXPIREDTOKEN1234567890", "REVOKEDTOKEN1234567890"]) {
  const unavailable = await rpc("lh_public_live_share_game", { p_share_code: code });
  assert(unavailable.status === 200 && unavailable.body === null, `${code.slice(0, 7)} token did not fail neutrally`, unavailable);
  record(`${code.slice(0, 7).toLowerCase()} token neutral failure`, unavailable);
}

const gameAudit = await rpc("lh_record_disclosure_export", {
  p_export_type: "player_csv",
  p_scope_type: "game",
  p_scope_id: "disclosure-game",
  p_outcome: "accepted",
}, userToken);
assert(gameAudit.status === 200 && gameAudit.body?.outcome === "accepted" && gameAudit.body?.recordedAt, "Game CSV audit failed", gameAudit);
assert(!JSON.stringify(gameAudit.body).includes("payload"), "Export audit response contains exported payload", gameAudit.body);
record("game CSV audit metadata", gameAudit.body);

const wrongAccountAudit = await rpc("lh_record_disclosure_export", {
  p_export_type: "full_backup",
  p_scope_type: "account",
  p_scope_id: "22222222-2222-4222-8222-222222222222",
  p_outcome: "accepted",
}, userToken);
assert(
  wrongAccountAudit.status === 200
    && wrongAccountAudit.body?.outcome === "rejected"
    && wrongAccountAudit.body?.code === "unauthorized_scope",
  "Full-backup audit accepted another account scope",
  wrongAccountAudit,
);
record("wrong-account backup audit denied", wrongAccountAudit.body);

const backupAudit = await rpc("lh_record_disclosure_export", {
  p_export_type: "full_backup",
  p_scope_type: "account",
  p_scope_id: signIn.body.user.id,
  p_outcome: "accepted",
}, userToken);
assert(backupAudit.status === 200 && backupAudit.body?.outcome === "accepted", "Full-backup audit failed", backupAudit);
record("private full-backup audit metadata", backupAudit.body);

const revoke = await rpc("lh_revoke_live_share_tokens", { p_game_id: "disclosure-game" }, userToken);
assert(revoke.status === 200 && revoke.body?.outcome === "accepted" && revoke.body?.revokedTokenCount >= 1, "Token revocation failed", revoke);
const revokedRead = await rpc("lh_public_live_share_game", { p_share_code: shareCode });
assert(revokedRead.status === 200 && revokedRead.body === null, "Revoked token remained readable", revokedRead);
record("created-token revocation", { revoke: revoke.body, readAfterRevoke: revokedRead });

console.log(JSON.stringify({
  suite: "LaxHornet minimum-necessary disclosure remote staging checks",
  projectHost: new URL(baseUrl).host,
  synthetic: true,
  testsPassed: results.length,
  results,
}, null, 2));
