import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("event-operation-service.js", "utf8");
const context = { window: {}, crypto: crypto.webcrypto, structuredClone, setTimeout, clearTimeout };
context.window.window = context.window;
context.window.crypto = crypto.webcrypto;
vm.runInNewContext(source, context);
const api = context.window.LaxHornetR207EventOperations;

let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks += 1;
  console.log(`PASS: ${label}`);
};

const game = { id: "game-a", lifecycleState: "active" };
const original = {
  id: "event-a",
  timestamp: "2026-08-09T12:00:00Z",
  quarter: "Q1",
  statType: "goal",
  statLabel: "Goal",
  category: "Offense",
  pointValue: 1,
  tags: [],
  note: "",
  fieldZone: "",
  serverEventVersion: 1,
};

function serviceHarness({ initialState = api.emptyState(), executor = async () => ({ outcome: "accepted" }) } = {}) {
  let state = structuredClone(initialState);
  let account = "account-a";
  let calls = 0;
  let persists = 0;
  const service = api.createEventOperationService({
    getState: () => state,
    setState: (next) => { state = next; },
    persistState: () => { persists += 1; return true; },
    currentAccountId: () => account,
    execute: async (operation) => {
      calls += 1;
      return executor(operation, { setAccount: (value) => { account = value; } });
    },
  });
  return {
    service,
    state: () => state,
    account: () => account,
    setAccount: (value) => { account = value; },
    calls: () => calls,
    persists: () => persists,
  };
}

function queuedCorrection(executor) {
  const harness = serviceHarness({ executor });
  harness.service.hydrate(game, original);
  harness.service.queueEvent(game, { ...original, note: "corrected" });
  return harness;
}

// Future-schema state is preserved and centrally write-blocked.
const futureState = {
  schemaVersion: 99,
  records: {
    [original.id]: {
      accountId: "account-a",
      gameId: game.id,
      eventId: original.id,
      serverEventVersion: 1,
      acceptedSnapshot: api.eventSnapshot(original),
      desiredSnapshot: api.eventSnapshot(original),
      deleteRequested: false,
    },
  },
  operations: [{
    clientOperationId: "future-operation",
    accountId: "account-a",
    gameId: game.id,
    eventId: original.id,
    type: "correct",
    payload: { client_operation_id: "future-operation", changes: { note: "future" } },
    state: "retryable",
    attempts: 3,
  }],
  receipts: [{ clientOperationId: "future-receipt" }],
  conflicts: { [original.id]: { code: "future_conflict" } },
  futureSentinel: { exact: true },
};
const futureSerialized = JSON.stringify(futureState);
const normalizedFuture = api.normalizeState(futureState);
check(normalizedFuture.schemaVersion === 99, "schema 99 loads safely");
check(JSON.stringify(normalizedFuture) === futureSerialized, "automatic normalization does not rewrite schema 99");
const future = serviceHarness({ initialState: futureState, executor: async () => ({ outcome: "conflicted" }) });
const createResult = future.service.queueEvent(game, { ...original, id: "future-create", serverEventVersion: 0 });
check(createResult.code === "client_upgrade_required", "future-schema create is rejected");
const correctionResult = future.service.queueEvent(game, { ...original, note: "older-client-edit" });
check(correctionResult.code === "client_upgrade_required", "future-schema correction is rejected");
const deleteResult = future.service.queueTombstone(game, original);
check(deleteResult.code === "client_upgrade_required", "future-schema delete is rejected");
check(future.state().operations.length === 1, "future-schema queue append is rejected");
await future.service.process();
check(future.state().operations[0].attempts === 3, "future-schema retry scheduling cannot modify state");
check(future.state().conflicts[original.id].code === "future_conflict", "future-schema conflict persistence cannot modify state");
check(future.state().receipts.length === 1, "future-schema receipt compaction cannot modify state");
check(future.persists() === 0, "future-schema state is never normalized and saved");
check(JSON.stringify(future.state()) === futureSerialized, "future-schema in-memory state remains byte-for-byte serializable-equivalent");
check(future.calls() === 0, "future-schema worker performs no RPC work");
check(createResult.message === api.CLIENT_UPGRADE_REQUIRED_MESSAGE, "future-schema rejection returns bounded update copy");

const current = serviceHarness();
current.service.queueEvent(game, { ...original, id: "current-create", serverEventVersion: 0 });
check(current.state().operations.length === 1 && current.persists() === 1, "current schema remains writable");
const older = serviceHarness({ initialState: { schemaVersion: 0, records: {}, operations: [], receipts: [], conflicts: {} } });
older.service.queueEvent(game, { ...original, id: "older-create", serverEventVersion: 0 });
check(older.state().schemaVersion === api.CURRENT_SUPPORTED_SCHEMA_VERSION && older.state().operations.length === 1, "approved older schema upgrades and remains writable");

// RPC failures are centrally classified and only bounded codes are durable.
const rls = queuedCorrection(async () => {
  const error = new Error("new row violates row-level security policy");
  error.code = "42501";
  throw error;
});
const rlsPayload = structuredClone(rls.state().operations[0].payload);
await rls.service.process();
check(rls.state().operations[0].state === "blocked" && rls.state().operations[0].lastError.code === "authorization_denied", "42501 becomes blocked authorization_denied");
const rlsSerialized = JSON.stringify(rls.state());
check(!/new row violates|row-level security|42501/i.test(rlsSerialized), "RLS message and SQLSTATE are absent from durable state");
const rlsCalls = rls.calls();
await rls.service.process();
check(rls.calls() === rlsCalls && !("nextAttemptAt" in rls.state().operations[0]), "authorization denial is not scheduled or retried");

const validation = queuedCorrection(async () => { throw { status: 400, code: "invalid_operation", message: "raw validation body" }; });
await validation.service.process();
check(validation.state().operations[0].state === "blocked" && validation.state().operations[0].lastError.code === "validation_failed", "validation failure is non-retryable");

const upgrade = queuedCorrection(async () => { throw { code: "PGRST202", message: "schema cache raw detail" }; });
await upgrade.service.process();
check(upgrade.state().operations[0].state === "blocked" && upgrade.state().operations[0].lastError.code === "client_upgrade_required", "schema incompatibility requires a client upgrade");

const network = queuedCorrection(async () => { throw new TypeError("Failed to fetch"); });
const networkPayload = structuredClone(network.state().operations[0].payload);
await network.service.process();
check(network.state().operations[0].state === "retryable" && network.state().operations[0].lastError.code === "network_unavailable", "actual transport failure remains retryable");
check(JSON.stringify(network.state().operations[0].payload) === JSON.stringify(networkPayload), "retry classification preserves operation ID and immutable payload");

const service = queuedCorrection(async () => { throw { status: 503, message: "upstream private detail" }; });
await service.service.process();
check(service.state().operations[0].state === "retryable" && service.state().operations[0].lastError.code === "service_unavailable", "approved transient service failure remains retryable");

const conflict = queuedCorrection(async () => ({ outcome: "conflicted", code: "same_field_conflict", server_event_version: 2 }));
await conflict.service.process();
check(conflict.state().operations[0].state === "conflicted" && conflict.state().conflicts[original.id], "conflict behavior remains unchanged");

const tombstone = queuedCorrection(async () => ({ outcome: "deleted", code: "event_tombstoned", server_event_version: 2 }));
await tombstone.service.process();
check(tombstone.state().operations.length === 0 && tombstone.state().records[original.id].lifecycleState === "tombstoned", "tombstone behavior remains unchanged");

const unknown = queuedCorrection(async () => { throw new Error("database exploded near private_table"); });
await unknown.service.process();
check(unknown.state().operations[0].state === "blocked" && unknown.state().operations[0].lastError.code === "server_error", "unknown permanent failure becomes bounded server_error");
const normalizedReload = api.normalizeState(JSON.parse(JSON.stringify(unknown.state())));
check(!JSON.stringify(normalizedReload).includes("private_table"), "reload retains no raw server message");
check(!JSON.stringify(unknown.state()).includes("database exploded"), "serialized state contains no raw server description");
const unknownCalls = unknown.calls();
await unknown.service.process();
check(unknown.calls() === unknownCalls, "retry worker skips blocked operations");

const accountTransition = queuedCorrection(async (_operation, controls) => {
  controls.setAccount("account-b");
  return { outcome: "accepted", code: "corrected", server_event_version: 2 };
});
await accountTransition.service.process();
check(accountTransition.state().receipts.length === 0 && api.normalizeState(accountTransition.state()).operations[0].state === "retryable", "account transition cannot apply an in-flight result and remains recoverable");
check(JSON.stringify(rls.state().operations[0].payload) === JSON.stringify(rlsPayload), "authorization failure preserves operation ID and payload");

const malformed = {};
malformed.error = malformed;
const malformedResult = api.classifyRpcFailure(malformed);
check(malformedResult.code === "server_error" && Object.keys(malformedResult).every((key) => ["state", "code", "retryable"].includes(key)), "malformed Supabase error object is sanitized");
const nestedResult = api.classifyRpcFailure({ cause: { code: "42501", message: "nested row-level security secret" } });
check(nestedResult.code === "authorization_denied" && !JSON.stringify(nestedResult).includes("nested"), "nested error cause is classified without leaking its message");
const thrownString = api.classifyRpcFailure("arbitrary private failure text");
check(thrownString.code === "server_error" && !JSON.stringify(thrownString).includes("private"), "thrown string is safely reduced to server_error");
const thrownUnknown = api.classifyRpcFailure({ unexpected: { message: "hidden nested value" } });
check(thrownUnknown.code === "server_error" && !JSON.stringify(thrownUnknown).includes("hidden"), "unknown error object is safely reduced");

const appSource = fs.readFileSync("app.js", "utf8");
check(!appSource.includes("operation.lastError = readableSupabaseError(error)"), "shared event queue no longer durably stores raw Supabase messages");
check(!appSource.includes("local.syncIssue = String(error?.message"), "tracked-time durable state no longer stores raw caught messages");

console.log(`R2-07C client safety remediation: ${checks}/${checks} passed`);
