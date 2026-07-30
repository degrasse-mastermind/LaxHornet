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
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(message);
}

function operationApis() {
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
  return {
    durable: context.window.LaxHornetDurableSyncOperations,
    event: context.window.LaxHornetEventOperations,
  };
}

function serviceHarness(options = {}) {
  const api = operationApis().durable;
  let accountId = options.accountId || "synthetic-account-a";
  let offline = options.offline === true;
  let nowMs = options.nowMs || Date.parse("2026-07-30T12:00:00.000Z");
  let idSequence = 0;
  let state = api.normalizeState(options.initialState, {
    accountId,
    deviceId: "synthetic-device",
    now: () => new Date(nowMs).toISOString(),
    createId: (prefix) => `${prefix}-normalized`,
  });
  const persisted = [];
  const attempts = [];
  let execute = options.execute || (async () => ({
    outcome: "accepted",
    receipt: {
      code: "synthetic_accepted",
      acknowledgment: "synthetic_receipt",
      serverRevision: 2,
      serverTimestamp: "2026-07-30T12:00:01.000Z",
    },
  }));

  const service = api.createDurableSyncOperationService({
    getState: () => state,
    setState: (nextState) => {
      state = nextState;
    },
    persistState: (nextState) => {
      persisted.push(clone(nextState));
      return options.persistFailure === true ? false : true;
    },
    currentAccountId: () => accountId,
    isOffline: () => offline,
    createId: (prefix) => `${prefix}-${++idSequence}`,
    now: () => new Date(nowMs).toISOString(),
    executeOperation: async (operation) => {
      attempts.push(clone(operation));
      return execute(operation);
    },
  });

  return {
    api,
    service,
    persisted,
    attempts,
    get state() {
      return state;
    },
    set state(value) {
      state = value;
    },
    setAccountId(value) {
      accountId = value;
    },
    setOffline(value) {
      offline = value;
    },
    advance(milliseconds) {
      nowMs += milliseconds;
    },
    setExecute(value) {
      execute = value;
    },
  };
}

function gamePayload(revision = 1) {
  return {
    gameRow: {
      id: "synthetic-game",
      user_id: "synthetic-account-a",
      opponent: revision === 1 ? "Synthetic Red" : "Synthetic Blue",
      saved_at: `2026-07-30T12:00:0${revision}.000Z`,
    },
  };
}

function clockPayload(revision = 1) {
  return {
    rpcName: revision === 1
      ? "lh_initialize_game_clock"
      : "lh_update_game_clock",
    clock: {
      game_id: "synthetic-game",
      current_period: "Q1",
      clock_seconds_remaining: 720 - revision,
      is_running: revision > 1,
      started_at: revision > 1 ? "2026-07-30T12:00:00.000Z" : null,
      paused_at: null,
      client_updated_at: `2026-07-30T12:00:0${revision}.000Z`,
      recovery_state: "complete",
      ...(revision === 1
        ? {
            period_format: "quarters",
            regulation_period_duration_seconds: 720,
            overtime_duration_seconds: 240,
          }
        : {
            base_revision: revision - 1,
          }),
    },
  };
}

test("R2-04 operation schema and lifecycle are explicit", () => {
  const api = operationApis().durable;
  assert.equal(api.SCHEMA_VERSION, 1);
  assert.deepEqual(Array.from(api.OPERATION_STATES), [
    "pending",
    "syncing",
    "accepted",
    "retryable",
    "rejected",
    "conflicted",
  ]);
  assert.deepEqual({ ...api.OPERATION_TYPES }, {
    game: "legacy_game_write",
    clock: "tracked_clock_write",
  });
});

test("game write is durable before its cloud attempt", async () => {
  const harness = serviceHarness({
    execute: async () => {
      assert.ok(
        harness.persisted.some((snapshot) =>
          snapshot.operations.some((operation) => operation.state === "pending")),
      );
      assert.equal(harness.state.operations[0].state, "syncing");
      return { outcome: "retryable", code: "synthetic_network" };
    },
  });
  harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  await harness.service.process();
  assert.equal(harness.attempts.length, 1);
});

test("clock write is durable before its RPC attempt", async () => {
  const harness = serviceHarness({
    execute: async () => {
      assert.ok(
        harness.persisted.some((snapshot) =>
          snapshot.operations.some((operation) =>
            operation.operationType === "tracked_clock_write"
            && operation.state === "pending")),
      );
      return { outcome: "retryable", code: "synthetic_network" };
    },
  });
  harness.service.queueClock({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: clockPayload(),
  });
  await harness.service.process();
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.attempts[0].baseRevision, null);
});

test("permanent game operation ID survives retry", async () => {
  const harness = serviceHarness({
    execute: async () => ({ outcome: "retryable", code: "network_failure" }),
  });
  const queued = harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  await harness.service.process();
  harness.advance(2500);
  await harness.service.process();
  assert.deepEqual(
    harness.attempts.map((operation) => operation.operationId),
    [queued.operationId, queued.operationId],
  );
});

test("permanent clock operation ID survives retry", async () => {
  const harness = serviceHarness({
    execute: async () => ({ outcome: "retryable", code: "network_failure" }),
  });
  const queued = harness.service.queueClock({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: clockPayload(),
  });
  await harness.service.process();
  harness.advance(2500);
  await harness.service.process();
  assert.deepEqual(
    harness.attempts.map((operation) => operation.operationId),
    [queued.operationId, queued.operationId],
  );
});

for (const [label, queueName, payload] of [
  ["game", "queueGame", gamePayload()],
  ["clock", "queueClock", clockPayload()],
]) {
  test(`refresh recovers pending ${label} operation`, async () => {
    const first = serviceHarness({ offline: true });
    const queued = first.service[queueName]({
      accountId: "synthetic-account-a",
      gameId: "synthetic-game",
      payload,
    });
    const refreshed = serviceHarness({
      initialState: clone(first.state),
      execute: async () => ({ outcome: "retryable", code: "network_failure" }),
    });
    await refreshed.service.process();
    assert.equal(refreshed.attempts[0].operationId, queued.operationId);
  });
}

test("stale syncing operation becomes replayable after refresh", () => {
  const api = operationApis().durable;
  const normalized = api.normalizeState({
    schemaVersion: 1,
    deviceId: "synthetic-device",
    operations: [
      {
        operationId: "synthetic-operation",
        operationType: "legacy_game_write",
        accountId: "synthetic-account-a",
        gameId: "synthetic-game",
        deviceId: "synthetic-device",
        createdAt: "2026-07-30T12:00:00.000Z",
        updatedAt: "2026-07-30T12:00:00.000Z",
        state: "syncing",
        payload: gamePayload(),
      },
    ],
    acknowledgments: {},
  }, {
    accountId: "synthetic-account-a",
    now: () => "2026-07-30T12:01:00.000Z",
  });
  assert.equal(normalized.operations[0].state, "retryable");
  assert.equal(normalized.operations[0].nextAttemptAt, null);
  assert.equal(normalized.operations[0].lastError.code, "interrupted_sync");
});

test("accepted receipt is durable before accepted payload compaction", async () => {
  const harness = serviceHarness();
  const queued = harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  await harness.service.process();
  assert.equal(harness.state.operations.length, 0);
  const acknowledgment = Object.values(harness.state.acknowledgments)[0];
  assert.equal(acknowledgment.operationId, queued.operationId);
  assert.equal(acknowledgment.receipt.acknowledgment, "synthetic_receipt");
  assert.equal(acknowledgment.receipt.serverRevision, 2);
  assert.equal(Object.hasOwn(acknowledgment.receipt, "payload"), false);
});

test("older accepted response cannot acknowledge a newer coalesced game payload", async () => {
  const firstResponse = deferred();
  let calls = 0;
  const harness = serviceHarness({
    execute: async () => {
      calls += 1;
      if (calls === 1) return firstResponse.promise;
      return { outcome: "retryable", code: "synthetic_later_retry" };
    },
  });
  const first = harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(1),
  });
  const processing = harness.service.process();
  await waitFor(() => harness.attempts.length === 1, "first game attempt did not start");
  const newer = harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(2),
  });
  assert.equal(newer.operationId, first.operationId);
  firstResponse.resolve({
    outcome: "accepted",
    receipt: { code: "older_accepted", acknowledgment: "synthetic_receipt" },
  });
  await processing;

  assert.equal(harness.state.operations[0].payloadHash, newer.payloadHash);
  assert.equal(harness.state.operations[0].state, "retryable");
  assert.equal(
    harness.service.isAcknowledged(
      harness.api.OPERATION_TYPES.game,
      "synthetic-game",
      gamePayload(2),
    ),
    false,
  );
});

test("duplicate queue processing has only one active attempt", async () => {
  const response = deferred();
  const harness = serviceHarness({
    execute: async () => response.promise,
  });
  harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  const first = harness.service.process();
  const second = harness.service.process();
  await waitFor(() => harness.attempts.length === 1, "game attempt did not start");
  assert.equal(harness.attempts.length, 1);
  response.resolve({ outcome: "accepted", receipt: { code: "accepted" } });
  await Promise.all([first, second]);
  assert.equal(harness.attempts.length, 1);
});

test("network failure becomes retryable with bounded backoff", async () => {
  const harness = serviceHarness({
    execute: async () => {
      const error = new Error("Failed to fetch");
      error.status = 0;
      throw error;
    },
  });
  harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  await harness.service.process();
  const [operation] = harness.state.operations;
  assert.equal(operation.state, "retryable");
  assert.equal(operation.attemptCount, 1);
  assert.equal(
    Date.parse(operation.nextAttemptAt) - Date.parse(operation.lastAttemptAt),
    2000,
  );
});

test("validation or authorization failure remains rejected", async () => {
  const harness = serviceHarness({
    execute: async () => ({
      outcome: "rejected",
      code: "not_authorized",
      message: "Synthetic authorization rejection",
    }),
  });
  harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  await harness.service.process();
  assert.equal(harness.state.operations[0].state, "rejected");
  assert.equal(harness.state.operations[0].lastError.code, "not_authorized");
});

test("revision conflict remains conflicted and is not retried", async () => {
  const harness = serviceHarness({
    execute: async () => ({
      outcome: "conflicted",
      code: "stale_clock_revision",
      receipt: {
        code: "stale_clock_revision",
        serverRevision: 4,
      },
    }),
  });
  harness.service.queueClock({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: clockPayload(2),
    baseRevision: 1,
  });
  await harness.service.process();
  await harness.service.process();
  assert.equal(harness.state.operations[0].state, "conflicted");
  assert.equal(harness.state.operations[0].receipt.serverRevision, 4);
  assert.equal(harness.attempts.length, 1);
});

test("offline processing does not create attempts or retry storms", async () => {
  const harness = serviceHarness({ offline: true });
  harness.service.queueClock({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: clockPayload(),
  });
  await Promise.all([
    harness.service.process(),
    harness.service.process(),
    harness.service.process(),
  ]);
  assert.equal(harness.attempts.length, 0);
  assert.equal(harness.state.operations[0].state, "pending");
  assert.equal(harness.state.operations[0].attemptCount, 0);
});

test("account A queue is isolated while account B is active", async () => {
  const first = serviceHarness({ offline: true });
  first.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  const second = serviceHarness({
    accountId: "synthetic-account-b",
    initialState: clone(first.state),
  });
  await second.service.process();
  assert.equal(second.attempts.length, 0);
  assert.equal(second.state.operations[0].accountId, "synthetic-account-a");
});

test("accepted operation does not reappear after intentional compaction", async () => {
  const harness = serviceHarness();
  harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  await harness.service.process();
  const duplicate = harness.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  assert.equal(duplicate.alreadyAccepted, true);
  assert.equal(harness.state.operations.length, 0);
  assert.equal(harness.attempts.length, 1);
});

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function storageSafety(storage) {
  const start = appSource.indexOf("// LOCAL_STORAGE_SAFETY_CORE_START");
  const end = appSource.indexOf("// LOCAL_STORAGE_SAFETY_CORE_END");
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({
    Date,
    JSON,
    Object,
    Array,
    Set,
    Map,
    Math,
  });
  vm.runInContext(
    `${appSource.slice(start, end)}
globalThis.__storageApi = { createLocalStorageSafety };`,
    context,
    { filename: "app.js#local-storage-safety" },
  );
  return context.__storageApi.createLocalStorageSafety({
    storage,
    now: () => "2026-07-30T12:00:00.000Z",
  });
}

test("malformed operation domain is quarantined without blocking startup", () => {
  const api = operationApis().durable;
  const key = "laxhornet.syncOperations.v1.user.synthetic-account-a";
  const malformed = JSON.stringify({ schemaVersion: 1, operations: "bad" });
  const storage = new MemoryStorage({ [key]: malformed });
  const safety = storageSafety(storage);
  const fallback = {
    schemaVersion: 1,
    deviceId: "synthetic-device",
    operations: [],
    acknowledgments: {},
  };
  const result = safety.read({
    primaryKey: key,
    domain: "game_clock_operation_state",
    fallback,
    validate: api.isStoredState,
  });
  assert.deepEqual(clone(result.value), fallback);
  const quarantine = JSON.parse(storage.getItem(`${key}.safety.quarantine`));
  assert.equal(quarantine.raw, malformed);
  assert.equal(quarantine.reason, "wrong_structural_type");
});

test("future operation-domain version is preserved and write-blocked", () => {
  const api = operationApis().durable;
  const key = "laxhornet.syncOperations.v1.user.synthetic-account-a";
  const future = {
    schemaVersion: 2,
    deviceId: "future-device",
    operations: [],
    acknowledgments: {},
    futureField: "preserve",
  };
  const storage = new MemoryStorage({
    [key]: JSON.stringify(future),
    [`${key}.safety.meta`]: JSON.stringify({
      schemaVersion: 2,
      domain: "game_clock_operation_state",
    }),
  });
  const safety = storageSafety(storage);
  const result = safety.read({
    primaryKey: key,
    domain: "game_clock_operation_state",
    fallback: null,
    validate: api.isStoredState,
  });
  assert.deepEqual(clone(result.value), future);
  const write = safety.write({
    primaryKey: key,
    domain: "game_clock_operation_state",
    value: {
      schemaVersion: 1,
      deviceId: "downgrade",
      operations: [],
      acknowledgments: {},
    },
    validate: api.isStoredState,
  });
  assert.equal(write.ok, false);
  assert.equal(write.status, "unsupported_future");
  assert.deepEqual(JSON.parse(storage.getItem(key)), future);
});

test("public Live Share, CSV, recap, and private backup exclude queue metadata", () => {
  for (const functionName of [
    "publicLiveShareGameFromPayload",
    "buildCSV",
    "fullBackupPayload",
    "familyRecapTakeaway",
  ]) {
    const start = appSource.indexOf(`function ${functionName}`);
    assert.ok(start >= 0, `${functionName} missing`);
    const nextFunction = appSource.indexOf("\nfunction ", start + 10);
    const body = appSource.slice(start, nextFunction < 0 ? appSource.length : nextFunction);
    assert.doesNotMatch(
      body,
      /syncOperations|operationId|attemptCount|nextAttemptAt|lastError|receipt/,
      functionName,
    );
  }
});

test("unresolved durable work cannot be reported as Synced", () => {
  assert.match(
    appSource,
    /state\.syncStatus = operationStatus\s*\|\| \(cloudGames\.length \|\| uploadedCount \? "Synced"/,
  );
  assert.match(
    appSource,
    /state\.syncStatus = operationStatus\s*\|\| \(hasPendingTrustSpineWork/,
  );
  assert.match(
    appSource,
    /showToast\(\s*operationStatus\s*\|\|/,
  );
});

test("existing Trust Spine event-operation service remains a separate namespace", () => {
  const apis = operationApis();
  assert.equal(typeof apis.event.createEventOperationService, "function");
  assert.equal(typeof apis.durable.createDurableSyncOperationService, "function");
  assert.notEqual(apis.event, apis.durable);
  const state = { pending: [] };
  const service = apis.event.createEventOperationService({
    persistLocal: () => {},
    queueEvent: (_game, event) => state.pending.push(event.id),
    queueTombstone: () => {},
    queueReconciliation: () => {},
    syncLegacyEvent: async () => true,
    syncLegacyGame: async () => true,
    deleteLegacyEvent: async () => true,
    flushAuthoritativeQueue: async () => true,
    reconcileAuthoritativeGame: async () => true,
  });
  const result = service.createGameEventOperation({
    game: { id: "synthetic-game" },
    applyLocal: () => ({ id: "synthetic-event" }),
  });
  assert.deepEqual(state.pending, ["synthetic-event"]);
  assert.ok(result.cloudPromise instanceof Promise);
});

test("integrated game journey survives failure, refresh, replay, receipt, and cleanup", async () => {
  const first = serviceHarness({
    execute: async () => {
      throw new Error("Failed to fetch synthetic game");
    },
  });
  const queued = first.service.queueGame({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: gamePayload(),
  });
  await first.service.process();
  assert.equal(first.state.operations[0].state, "retryable");

  const refreshed = serviceHarness({ initialState: clone(first.state) });
  refreshed.advance(2500);
  await refreshed.service.process();
  assert.equal(refreshed.attempts[0].operationId, queued.operationId);
  assert.equal(refreshed.state.operations.length, 0);
  assert.equal(
    refreshed.service.isAcknowledged(
      refreshed.api.OPERATION_TYPES.game,
      "synthetic-game",
      gamePayload(),
    ),
    true,
  );
});

test("integrated clock journey survives failure, refresh, replay, revision receipt, and cleanup", async () => {
  const first = serviceHarness({
    execute: async () => ({
      outcome: "retryable",
      code: "synthetic_timeout",
      message: "Synthetic timeout",
    }),
  });
  const queued = first.service.queueClock({
    accountId: "synthetic-account-a",
    gameId: "synthetic-game",
    payload: clockPayload(2),
    baseRevision: 1,
  });
  await first.service.process();
  assert.equal(first.state.operations[0].state, "retryable");

  const refreshed = serviceHarness({ initialState: clone(first.state) });
  refreshed.advance(2500);
  await refreshed.service.process();
  assert.equal(refreshed.attempts[0].operationId, queued.operationId);
  assert.equal(refreshed.state.operations.length, 0);
  const acknowledgment = Object.values(refreshed.state.acknowledgments)[0];
  assert.equal(acknowledgment.receipt.serverRevision, 2);
  assert.equal(acknowledgment.receipt.acknowledgment, "synthetic_receipt");
});
