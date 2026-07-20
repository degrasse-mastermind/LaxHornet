import crypto from "node:crypto";

const required = [
  "TRUST_SPINE_SUPABASE_URL",
  "TRUST_SPINE_PUBLISHABLE_KEY",
  "TRUST_SPINE_TEST_EMAIL",
  "TRUST_SPINE_TEST_PASSWORD",
  "TRUST_SPINE_TEST_GAME_ID",
  "TRUST_SPINE_TEST_EVENT_ID",
  "TRUST_SPINE_TEST_EVENT_VERSION",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`SKIP: missing disposable-staging variables: ${missing.join(", ")}`);
  process.exit(2);
}

const baseUrl = process.env.TRUST_SPINE_SUPABASE_URL.replace(/\/+$/, "");
const apiKey = process.env.TRUST_SPINE_PUBLISHABLE_KEY;
const gameId = process.env.TRUST_SPINE_TEST_GAME_ID;
const eventId = process.env.TRUST_SPINE_TEST_EVENT_ID;
const initialVersion = Number(process.env.TRUST_SPINE_TEST_EVENT_VERSION);

if (!Number.isInteger(initialVersion) || initialVersion < 1) {
  throw new Error("TRUST_SPINE_TEST_EVENT_VERSION must be a positive integer");
}

const safeJson = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
};

const request = async (path, { token, method = "POST", body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token || apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await safeJson(response) };
};

const assert = (condition, message, evidence) => {
  if (!condition) {
    const suffix = evidence === undefined ? "" : `\n${JSON.stringify(evidence, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
};

const rpc = (name, args, token) =>
  request(`/rest/v1/rpc/${name}`, { token, body: args });

const operationId = (label) =>
  `remote-${label}-${crypto.randomUUID()}`;

const signIn = await request("/auth/v1/token?grant_type=password", {
  body: {
    email: process.env.TRUST_SPINE_TEST_EMAIL,
    password: process.env.TRUST_SPINE_TEST_PASSWORD,
  },
});
assert(signIn.status === 200 && signIn.body?.access_token, "Synthetic sign-in failed", signIn);
const token = signIn.body.access_token;

const results = [];
const record = (name, evidence) => results.push({ name, status: "pass", evidence });

const grants = await rpc("lh_resolve_active_grants", {}, token);
assert(grants.status === 200 && Array.isArray(grants.body), "Active-grant resolver failed", grants);
assert(grants.body.length > 0, "Synthetic user has no active staging grant", grants);
record("active grant resolution", { status: grants.status, count: grants.body.length });

const directTable = await request(
  `/rest/v1/lh_event_effective?event_id=eq.${encodeURIComponent(eventId)}`,
  { token, method: "GET" },
);
assert(directTable.status >= 400, "Direct Trust Spine table read was not denied", directTable);
record("direct table denial", { status: directTable.status, body: directTable.body });

const privateHelper = await rpc(
  "lh_correct_event_impl",
  { p_operation: {} },
  token,
);
assert(privateHelper.status >= 400, "Private helper was reachable through PostgREST", privateHelper);
record("private helper denial", { status: privateHelper.status, body: privateHelper.body });

const differentBase = initialVersion;
const differentFieldOps = [
  {
    client_operation_id: operationId("different-zone"),
    event_id: eventId,
    game_id: gameId,
    base_server_event_version: differentBase,
    changes: { field_zone: "remote_test_zone" },
    correction_reason: "Disposable staging concurrency test",
  },
  {
    client_operation_id: operationId("different-label"),
    event_id: eventId,
    game_id: gameId,
    base_server_event_version: differentBase,
    changes: { stat_label: "Remote Test Label" },
    correction_reason: "Disposable staging concurrency test",
  },
];
const differentResults = await Promise.all(
  differentFieldOps.map((operation) => rpc("lh_correct_event", { p_operation: operation }, token)),
);
assert(
  differentResults.every((result) => result.status === 200 && result.body?.outcome === "accepted"),
  "Concurrent different-field corrections did not both preserve accepted evidence",
  differentResults,
);
const versions = differentResults.map((result) => Number(result.body.serverEventVersion));
assert(
  new Set(versions).size === 2 && Math.min(...versions) === differentBase + 1,
  "Concurrent different-field corrections did not receive unique sequential versions",
  differentResults,
);
record("separate-request different-field concurrency", differentResults.map((result) => result.body));

const sameBase = Math.max(...versions);
const sameOperationIdA = operationId("same-field-a");
const sameOperationIdB = operationId("same-field-b");
const sameFieldResults = await Promise.all([
  rpc("lh_correct_event", {
    p_operation: {
      client_operation_id: sameOperationIdA,
      event_id: eventId,
      game_id: gameId,
      base_server_event_version: sameBase,
      changes: { field_zone: "remote_test_zone_a" },
      correction_reason: "Disposable staging same-field test",
    },
  }, token),
  rpc("lh_correct_event", {
    p_operation: {
      client_operation_id: sameOperationIdB,
      event_id: eventId,
      game_id: gameId,
      base_server_event_version: sameBase,
      changes: { field_zone: "remote_test_zone_b" },
      correction_reason: "Disposable staging same-field test",
    },
  }, token),
]);
const outcomes = sameFieldResults.map((result) => result.body?.outcome).sort();
assert(
  sameFieldResults.every((result) => result.status === 200)
    && outcomes.join(",") === "accepted,conflicted",
  "Concurrent same-field corrections did not produce one accepted result and one conflict",
  sameFieldResults,
);
record("separate-request same-field concurrency", sameFieldResults.map((result) => result.body));

const acceptedResult = sameFieldResults.find((result) => result.body?.outcome === "accepted");
const acceptedOperation = acceptedResult.body.clientOperationId === sameOperationIdA
  ? {
      client_operation_id: sameOperationIdA,
      event_id: eventId,
      game_id: gameId,
      base_server_event_version: sameBase,
      changes: { field_zone: "remote_test_zone_a" },
      correction_reason: "Disposable staging same-field test",
    }
  : {
      client_operation_id: sameOperationIdB,
      event_id: eventId,
      game_id: gameId,
      base_server_event_version: sameBase,
      changes: { field_zone: "remote_test_zone_b" },
      correction_reason: "Disposable staging same-field test",
    };
const replay = await rpc("lh_correct_event", { p_operation: acceptedOperation }, token);
assert(
  replay.status === 200 && replay.body?.replay === true,
  "Exact operation replay did not return the original receipt",
  replay,
);
const tampered = structuredClone(acceptedOperation);
tampered.changes.field_zone = "tampered_remote_value";
const tamperResult = await rpc("lh_correct_event", { p_operation: tampered }, token);
assert(
  tamperResult.status === 200 && tamperResult.body?.outcome === "rejected"
    && tamperResult.body?.code === "duplicate_operation_id_payload_mismatch",
  "Duplicate operation ID tampering was not rejected",
  tamperResult,
);
record("idempotent replay and tamper denial", {
  replay: replay.body,
  tampered: tamperResult.body,
});

if (process.env.TRUST_SPINE_TEST_SHARE_CODE) {
  const share = await rpc(
    "lh_public_live_share_game",
    { p_share_code: process.env.TRUST_SPINE_TEST_SHARE_CODE },
  );
  assert(share.status === 200 && share.body, "Anonymous Live Share failed", share);
  const serialized = JSON.stringify(share.body);
  for (const forbidden of [
    "note",
    "tags",
    "grant",
    "revision",
    "operation",
    "audit",
    "internal_status",
  ]) {
    assert(!serialized.includes(`"${forbidden}"`), `Live Share leaked ${forbidden}`, share.body);
  }
  record("anonymous Live Share allowlist", share.body);
}

console.log(JSON.stringify({
  suite: "LaxHornet Trust Spine remote disposable-staging checks",
  synthetic: true,
  testsPassed: results.length,
  results,
}, null, 2));
