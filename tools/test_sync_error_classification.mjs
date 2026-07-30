import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const operationSource = fs.readFileSync(
  path.join(root, "event-operation-service.js"),
  "utf8",
);

function classifierApi() {
  const context = vm.createContext({
    window: {},
    Date,
    Math,
    JSON,
    Object,
    Array,
    Set,
    Map,
    Promise,
    TypeError,
  });
  vm.runInContext(operationSource, context, {
    filename: "event-operation-service.js",
  });
  return context.window.LaxHornetDurableSyncOperations;
}

const api = classifierApi();

const cases = [
  {
    label: "offline",
    input: { code: "offline" },
    expected: ["retryable", "retryable_transport", "retryable_transport", null],
  },
  {
    label: "fetch failure",
    input: new TypeError("Failed to fetch"),
    expected: ["retryable", "retryable_transport", "retryable_transport", null],
  },
  {
    label: "timeout",
    input: { name: "AbortError", message: "The request timed out" },
    expected: ["retryable", "retryable_transport", "retryable_transport", null],
  },
  {
    label: "HTTP 429",
    input: { status: 429, message: "Too many requests" },
    expected: ["retryable", "retryable_transport", "retryable_transport", 429],
  },
  {
    label: "HTTP 500",
    input: { status: 500, message: "Internal server error" },
    expected: ["retryable", "retryable_transport", "retryable_transport", 500],
  },
  {
    label: "HTTP 401",
    input: { status: 401, message: "Invalid access token" },
    expected: ["rejected", "authentication_required", "authentication_required", 401],
  },
  {
    label: "missing session",
    input: { code: "missing_session" },
    expected: ["rejected", "authentication_required", "authentication_required", null],
  },
  {
    label: "HTTP 403",
    input: { status: 403, message: "Forbidden" },
    expected: ["rejected", "authorization_denied", "authorization_denied", 403],
  },
  {
    label: "RLS permission denial",
    input: {
      code: "42501",
      message: "new row violates row-level security policy",
    },
    expected: ["rejected", "authorization_denied", "authorization_denied", null],
  },
  {
    label: "unauthorized scope",
    input: { code: "unauthorized_scope", outcome: "rejected" },
    expected: ["rejected", "authorization_denied", "authorization_denied", null],
  },
  {
    label: "tracked-clock unauthorized outcome",
    input: { code: "unauthorized", outcome: "rejected" },
    expected: ["rejected", "authorization_denied", "authorization_denied", null],
  },
  {
    label: "HTTP 400 malformed payload",
    input: { status: 400, code: "PGRST102", message: "Malformed JSON body" },
    expected: ["rejected", "validation_rejected", "validation_rejected", 400],
  },
  {
    label: "HTTP 422 invalid state",
    input: { status: 422, code: "invalid_game_state" },
    expected: ["rejected", "validation_rejected", "validation_rejected", 422],
  },
  {
    label: "PGRST202",
    input: {
      status: 404,
      code: "PGRST202",
      message: "Could not find the function in the schema cache",
    },
    expected: ["rejected", "capability_unavailable", "capability_unavailable", 404],
  },
  {
    label: "missing RPC signature",
    input: {
      code: "42883",
      message: "function lh_update_game_clock(jsonb) does not exist",
    },
    expected: ["rejected", "capability_unavailable", "capability_unavailable", null],
  },
  {
    label: "HTTP 409",
    input: { status: 409, message: "Conflict" },
    expected: ["conflicted", "conflict", "revision_conflict", 409],
  },
  {
    label: "stale clock revision",
    input: { code: "stale_clock_revision", outcome: "conflicted" },
    expected: ["conflicted", "conflict", "stale_clock_revision", null],
  },
  {
    label: "unknown permanent failure",
    input: new Error("Synthetic permanent server rejection"),
    expected: ["rejected", "unclassified_rejection", "unclassified_rejection", null],
  },
];

for (const scenario of cases) {
  test(`${scenario.label} has the required deterministic classification`, () => {
    const result = api.classifyFailure(scenario.input, {
      source: "synthetic_contract",
    });
    const [outcome, category, code, httpStatus] = scenario.expected;
    assert.equal(result.outcome, outcome);
    assert.equal(result.category, category);
    assert.equal(result.code, code);
    assert.equal(result.httpStatus, httpStatus);
    assert.equal(result.retryable, outcome === "retryable");
    assert.equal(result.attentionRequired, outcome !== "retryable");
    assert.equal(result.source, "synthetic_contract");
    assert.equal(typeof result.message, "string");
    assert.ok(result.message.length > 0 && result.message.length <= 240);
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        "attentionRequired",
        "category",
        "code",
        "httpStatus",
        "message",
        "outcome",
        "retryable",
        "source",
        "sourceCode",
      ].sort(),
    );
  });
}

test("schema-cache capability failure takes precedence over a retryable HTTP status", () => {
  const result = api.classifyFailure({
    status: 503,
    code: "PGRST002",
    message: "Could not build the schema cache",
  });
  assert.equal(result.outcome, "rejected");
  assert.equal(result.category, "capability_unavailable");
  assert.equal(result.retryable, false);
});

test("unknown errors without an explicit transport signal fail closed", () => {
  const result = api.classifyFailure({
    message: "A permanent server-side rule rejected the request",
  });
  assert.equal(result.outcome, "rejected");
  assert.equal(result.code, "unclassified_rejection");
});

test("classification output never retains private server text, tokens, or payloads", () => {
  const secret = "synthetic-token-never-store";
  const privateName = "Synthetic Child Name";
  const result = api.classifyFailure({
    status: 403,
    code: "42501",
    message: `Bearer ${secret} denied for ${privateName}`,
    details: JSON.stringify({
      access_token: secret,
      player_name: privateName,
      request_payload: { gameId: "synthetic-private-game" },
    }),
  }, {
    source: "tracked_clock_rpc",
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.doesNotMatch(serialized, new RegExp(privateName));
  assert.doesNotMatch(serialized, /access_token|request_payload|synthetic-private-game/);
  assert.equal(result.sourceCode, "42501");
});

test("Supabase result envelopes preserve safe HTTP status and source code", () => {
  const result = api.classifyFailure({
    error: {
      code: "PGRST301",
      message: "JWT could not be decoded",
    },
    httpStatus: 401,
  }, {
    source: "legacy_game_upsert",
  });
  assert.equal(result.category, "authentication_required");
  assert.equal(result.httpStatus, 401);
  assert.equal(result.sourceCode, "PGRST301");
  assert.equal(result.source, "legacy_game_upsert");
});
