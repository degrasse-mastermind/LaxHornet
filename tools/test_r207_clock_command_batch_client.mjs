import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const operationSource = fs.readFileSync(path.join(root, "event-operation-service.js"), "utf8");
const trackedSource = fs.readFileSync(path.join(root, "tracked-playing-time-service.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");

const copy = (value) => JSON.parse(JSON.stringify(value));

function loadApis() {
  const context = vm.createContext({
    window: {}, Date, Math, JSON, Object, Array, Set, Map, Promise, TypeError,
  });
  vm.runInContext(operationSource, context, { filename: "event-operation-service.js" });
  vm.runInContext(trackedSource, context, { filename: "tracked-playing-time-service.js" });
  return {
    durable: context.window.LaxHornetDurableSyncOperations,
    tracked: context.window.LaxHornetTrackedPlayingTime,
  };
}

function command(command, occurredAt, options = {}) {
  return {
    contract: "r207_clock_v2",
    gameId: options.gameId || "clock-game",
    command,
    arguments: options.arguments || {},
    baseClockVersion: options.baseClockVersion ?? 3,
    statusBaseVersion: options.statusBaseVersion ?? 2,
    expectedLifecycle: options.expectedLifecycle || "active",
    clientOccurredAt: occurredAt,
  };
}

function harness(options = {}) {
  const { durable } = loadApis();
  let accountId = options.accountId || "account-a";
  let offline = options.offline === true;
  let now = Date.parse("2026-08-11T02:00:00.000Z");
  let sequence = 0;
  let state = durable.normalizeState(options.initialState, {
    accountId,
    deviceId: "device-a",
    now: () => new Date(now).toISOString(),
    createId: (prefix) => `${prefix}-normalized`,
  });
  const persisted = [];
  const singleAttempts = [];
  const batchAttempts = [];
  const acceptedCallbacks = [];
  const conflictCallbacks = [];
  let executeSingle = options.executeSingle || (async () => ({
    outcome: "accepted",
    receipt: { code: "accepted", serverRevision: 4 },
  }));
  let executeBatch = options.executeBatch || (async (operations) => ({
    outcome: "accepted",
    canonical: { clockVersion: 3 + operations.length },
    operationResults: operations.map((operation, index) => ({
      operationId: operation.operationId,
      receipt: { code: "accepted", serverRevision: 4 + index },
    })),
  }));
  const service = durable.createDurableSyncOperationService({
    getState: () => state,
    setState: (next) => { state = next; },
    persistState: (next) => { persisted.push(copy(next)); return true; },
    currentAccountId: () => accountId,
    isOffline: () => offline,
    createId: (prefix) => `${prefix}-${++sequence}`,
    now: () => new Date(now).toISOString(),
    executeOperation: async (operation) => {
      singleAttempts.push(copy(operation));
      return executeSingle(operation);
    },
    executeClockBatch: async (operations) => {
      batchAttempts.push(copy(operations));
      return executeBatch(operations);
    },
    onClockAccepted: (operations, result) => {
      acceptedCallbacks.push({ operations: copy(operations), result: copy(result), state: copy(state) });
    },
    onClockConflict: (operations, result) => {
      conflictCallbacks.push({ operations: copy(operations), result: copy(result), state: copy(state) });
    },
  });
  return {
    durable,
    service,
    persisted,
    singleAttempts,
    batchAttempts,
    acceptedCallbacks,
    conflictCallbacks,
    get state() { return state; },
    setOffline(value) { offline = value; },
    setAccount(value) { accountId = value; },
    advance(milliseconds) { now += milliseconds; },
    setSingle(value) { executeSingle = value; },
    setBatch(value) { executeBatch = value; },
  };
}

test("durable online command persists before transport and keeps one permanent ID", async () => {
  const h = harness({ executeSingle: async (operation) => {
    assert.ok(h.persisted.some((snapshot) => snapshot.operations.some((item) =>
      item.operationId === operation.operationId && item.state === "pending")));
    return { outcome: "retryable", code: "offline" };
  } });
  const payload = command("start", "2026-08-11T02:00:01.000Z");
  const queued = h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload, baseRevision: 3 });
  await h.service.process();
  h.advance(2500);
  await h.service.process();
  assert.deepEqual(h.singleAttempts.map((item) => item.operationId), [queued.operationId, queued.operationId]);
});

test("attempted clock payload is immutable when caller data changes", async () => {
  const h = harness();
  const payload = command("set_remaining", "2026-08-11T02:00:01.000Z", {
    arguments: { clock_seconds_remaining: 500 },
  });
  h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload, baseRevision: 3 });
  payload.arguments.clock_seconds_remaining = 1;
  await h.service.process();
  assert.equal(h.singleAttempts[0].payload.arguments.clock_seconds_remaining, 500);
});

test("offline ordered commands share one permanent batch and compact only after receipts", async () => {
  const h = harness({ offline: true });
  const first = command("start", "2026-08-11T02:00:01.000Z");
  const second = command("pause", "2026-08-11T02:00:03.000Z");
  h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: first, baseRevision: 3, batchRequired: true });
  await h.service.process();
  h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: second, baseRevision: 3, batchRequired: true });
  assert.equal(new Set(h.state.operations.map((item) => item.batchId)).size, 1);
  h.setOffline(false);
  await h.service.process();
  assert.equal(h.batchAttempts.length, 1);
  assert.deepEqual(h.batchAttempts[0].map((item) => item.payload.command), ["start", "pause"]);
  assert.equal(h.state.operations.length, 0);
  assert.equal(Object.keys(h.state.acknowledgments).length, 2);
  assert.equal(h.acceptedCallbacks[0].state.operations.length, 0);
});

test("client never predicts intermediate server revisions", async () => {
  const h = harness({ offline: true });
  for (const [index, name] of ["start", "pause", "resume"].entries()) {
    h.service.queueClock({
      accountId: "account-a",
      gameId: "clock-game",
      payload: command(name, `2026-08-11T02:00:0${index + 1}.000Z`, {
        expectedLifecycle: name === "resume" ? "paused" : "active",
      }),
      baseRevision: 3,
      batchRequired: true,
    });
  }
  assert.deepEqual(h.state.operations.map((item) => item.baseRevision), [3, 3, 3]);
  assert.ok(h.state.operations.every((item) => !Object.hasOwn(item.payload, "resultClockVersion")));
});

test("one batch conflict retains the complete timeline and never auto-retries", async () => {
  const h = harness({
    executeBatch: async () => ({
      outcome: "conflicted",
      code: "clock_conflict",
      receipt: { code: "clock_conflict", serverRevision: 9 },
    }),
  });
  for (const [index, name] of ["start", "pause"].entries()) {
    h.service.queueClock({
      accountId: "account-a", gameId: "clock-game",
      payload: command(name, `2026-08-11T02:00:0${index + 1}.000Z`),
      baseRevision: 3, batchRequired: true,
    });
  }
  await h.service.process();
  await h.service.process();
  assert.deepEqual(h.state.operations.map((item) => item.state), ["conflicted", "conflicted"]);
  assert.ok(h.state.operations.every((item) => item.receipt.serverRevision === 9));
  assert.equal(h.batchAttempts.length, 1);
  assert.equal(h.conflictCallbacks.length, 1);
});

test("batch receipt mismatch fails closed without compaction", async () => {
  const h = harness({
    executeBatch: async (operations) => ({
      outcome: "accepted",
      operationResults: [{ operationId: operations[0].operationId, receipt: { serverRevision: 4 } }],
    }),
  });
  for (const [index, name] of ["start", "pause"].entries()) {
    h.service.queueClock({
      accountId: "account-a", gameId: "clock-game",
      payload: command(name, `2026-08-11T02:00:0${index + 1}.000Z`),
      baseRevision: 3, batchRequired: true,
    });
  }
  await h.service.process();
  assert.deepEqual(h.state.operations.map((item) => item.state), ["conflicted", "conflicted"]);
  assert.equal(Object.keys(h.state.acknowledgments).length, 0);
});

test("real transport failure is retryable with bounded durable state", async () => {
  const h = harness({ executeSingle: async () => { throw Object.assign(new Error("Failed to fetch private host"), { status: 0 }); } });
  h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: command("start", "2026-08-11T02:00:01.000Z"), baseRevision: 3 });
  await h.service.process();
  assert.equal(h.state.operations[0].state, "retryable");
  assert.equal(h.state.operations[0].lastError.category, "retryable_transport");
  assert.doesNotMatch(JSON.stringify(h.state.operations[0].lastError), /private host/i);
});

test("authorization is blocked, non-retryable, and raw error detail is sanitized", async () => {
  const h = harness({ executeSingle: async () => ({
    outcome: "rejected", code: "authorization_denied",
    message: "permission denied for private table with secret host",
  }) });
  h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: command("start", "2026-08-11T02:00:01.000Z"), baseRevision: 3 });
  await h.service.process();
  const error = h.state.operations[0].lastError;
  assert.equal(h.state.operations[0].state, "rejected");
  assert.equal(error.category, "authorization_denied");
  assert.equal(h.state.operations[0].nextAttemptAt, null);
  assert.doesNotMatch(JSON.stringify(error), /private table|secret host/i);
});

test("clock revision exhaustion is non-retryable and stores no raw server detail", async () => {
  const h = harness({ executeSingle: async () => ({
    outcome: "rejected",
    code: "clock_revision_exhausted",
    message: "bigint 9007199254740992 from private clock row",
  }) });
  h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: command("start", "2026-08-11T02:00:01.000Z"), baseRevision: 3 });
  await h.service.process();
  await h.service.process();
  const operation = h.state.operations[0];
  assert.equal(operation.state, "rejected");
  assert.equal(operation.lastError.category, "validation_rejected");
  assert.equal(operation.lastError.code, "validation_rejected");
  assert.equal(operation.nextAttemptAt, null);
  assert.equal(h.singleAttempts.length, 1);
  assert.doesNotMatch(JSON.stringify(operation), /9007199254740992|private clock row/i);
});

test("offline chronology uncertainty retains the full batch as a non-retryable conflict", async () => {
  const h = harness({ executeBatch: async () => ({
    outcome: "conflicted",
    code: "clock_chronology_needs_review",
    message: "raw client timestamp and private anchor",
  }) });
  for (const [name, occurredAt] of [["start", "2026-08-11T02:00:01.000Z"], ["pause", "2026-08-11T02:00:45.000Z"]]) {
    h.service.queueClock({
      accountId: "account-a", gameId: "clock-game",
      payload: command(name, occurredAt), baseRevision: 3, batchRequired: true,
    });
  }
  await h.service.process();
  await h.service.process();
  assert.equal(h.batchAttempts.length, 1);
  assert.deepEqual(h.state.operations.map((operation) => operation.state), ["conflicted", "conflicted"]);
  assert.ok(h.state.operations.every((operation) => operation.nextAttemptAt === null));
  assert.doesNotMatch(JSON.stringify(h.state.operations), /raw client timestamp|private anchor/i);
});

test("timeout prefix plus new suffix reuses one batch and compacts only after all receipts", async () => {
  let attempt = 0;
  const h = harness({
    executeBatch: async (operations) => {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error("network timeout after commit"), { status: 0 });
      return {
        outcome: "accepted",
        canonical: { clockVersion: 7 },
        operationResults: operations.map((operation, index) => ({
          operationId: operation.operationId,
          receipt: { code: index < 2 ? "replayed_prefix" : "accepted", serverRevision: 4 + index },
        })),
      };
    },
  });
  for (const [name, occurredAt, lifecycle] of [
    ["start", "2026-08-11T02:00:01.000Z", "active"],
    ["pause", "2026-08-11T02:00:03.000Z", "active"],
  ]) {
    h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: command(name, occurredAt, { expectedLifecycle: lifecycle }), baseRevision: 3, batchRequired: true });
  }
  await h.service.process();
  const batchId = h.state.operations[0].batchId;
  for (const [name, occurredAt, lifecycle] of [
    ["resume", "2026-08-11T02:00:04.000Z", "paused"],
    ["pause", "2026-08-11T02:00:06.000Z", "active"],
  ]) {
    h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: command(name, occurredAt, { expectedLifecycle: lifecycle }), baseRevision: 3, batchRequired: true });
  }
  assert.ok(h.state.operations.every((operation) => operation.batchId === batchId));
  h.advance(2500);
  await h.service.process();
  assert.deepEqual(h.batchAttempts.map((operations) => operations.map((operation) => operation.payload.command)), [
    ["start", "pause"],
    ["start", "pause", "resume", "pause"],
  ]);
  assert.deepEqual(h.batchAttempts[1].map((operation) => operation.payload.clientOccurredAt), [
    "2026-08-11T02:00:01.000Z", "2026-08-11T02:00:03.000Z",
    "2026-08-11T02:00:04.000Z", "2026-08-11T02:00:06.000Z",
  ]);
  assert.equal(h.state.operations.length, 0);
  assert.equal(Object.keys(h.state.acknowledgments).length, 4);
});

test("account switch cannot execute or disclose another account clock queue", async () => {
  const h = harness({ offline: true });
  h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: command("start", "2026-08-11T02:00:01.000Z"), baseRevision: 3 });
  h.setAccount("account-b");
  h.setOffline(false);
  await h.service.process();
  assert.equal(h.singleAttempts.length, 0);
  assert.equal(h.state.operations[0].accountId, "account-a");
});

test("future schema blocks append, retry, receipt, batch, conflict, and compaction mutation", async () => {
  const future = {
    schemaVersion: 2,
    deviceId: "future-device",
    operations: [],
    tombstones: [],
    deleteRecoveries: [],
    acknowledgments: {},
    futureClockBatch: { preserve: true },
  };
  const h = harness({ initialState: future });
  const before = copy(h.state);
  const queued = h.service.queueClock({ accountId: "account-a", gameId: "clock-game", payload: command("start", "2026-08-11T02:00:01.000Z"), batchRequired: true });
  const processed = await h.service.process();
  assert.equal(queued, null);
  assert.equal(processed, false);
  assert.deepEqual(h.state, before);
  assert.equal(h.persisted.length, 0);
  assert.equal(h.acceptedCallbacks.length + h.conflictCallbacks.length, 0);
});

test("server anchor drives local projection without client revision invention", () => {
  const { tracked } = loadApis();
  const clock = tracked.normalizeClockState({
    gameId: "clock-game", periodFormat: "quarters",
    regulationPeriodDurationSeconds: 720, overtimeDurationSeconds: 240,
    currentPeriod: "Q1", clockSecondsRemaining: 700, isRunning: true,
    startedAt: "2026-08-11T02:00:00.000Z", pausedAt: null,
    clientUpdatedAt: "2026-08-11T02:00:09.000Z", recoveryState: "complete",
    revision: 2, serverClockVersion: 7,
    anchorServerAt: "2026-08-11T02:00:00.000Z",
    anchorClockSecondsRemaining: 710,
  });
  const projected = tracked.projectClock(clock, "2026-08-11T02:00:10.000Z");
  assert.equal(projected.clockSecondsRemaining, 700);
  assert.equal(projected.serverClockVersion, 7);
  assert.equal(projected.revision, 2);
});

test("client wiring is default-off, uses both RPCs, and exposes only safe conflict copy", () => {
  assert.match(runtimeSource, /r207ClockCommandBatch:\s*false/);
  assert.match(appSource, /lh_apply_game_clock_operation_v2/);
  assert.match(appSource, /lh_apply_game_clock_batch_v2/);
  assert.match(appSource, /The game clock changed on another device\. Your clock actions are saved and need review\./);
  const liveStart = appSource.indexOf("function renderTrackedPlayingTimeLive");
  const liveEnd = appSource.indexOf("\nfunction renderLiveTracker", liveStart);
  assert.ok(liveStart >= 0 && liveEnd > liveStart);
  assert.doesNotMatch(
    appSource.slice(liveStart, liveEnd),
    /client_operation_id|device_id|server_updated_at|lh_apply_game_clock/,
  );
});
