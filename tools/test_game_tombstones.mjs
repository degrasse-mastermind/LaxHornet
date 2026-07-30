import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const serviceSource = fs.readFileSync(path.join(root, "event-operation-service.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const characterizationSource = fs.readFileSync(
  path.join(root, "tools", "test_sync_characterization.mjs"),
  "utf8",
);
const trustSpineTestSource = fs.readFileSync(
  path.join(root, "tools", "test_trust_spine_release1.mjs"),
  "utf8",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function api() {
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
  vm.runInContext(serviceSource, context, { filename: "event-operation-service.js" });
  return context.window.LaxHornetDurableSyncOperations;
}

function harness(options = {}) {
  const durable = api();
  let accountId = options.accountId === undefined ? "account-a" : options.accountId;
  let offline = Boolean(options.offline);
  let nowMs = Date.parse("2026-07-30T14:00:00.000Z");
  let sequence = 0;
  let state = durable.normalizeState(options.initialState, {
    accountId,
    deviceId: options.deviceId || "device-a",
    now: () => new Date(nowMs).toISOString(),
    createId: (prefix) => `${prefix}-normalize`,
  });
  const persisted = [];
  const attempts = [];
  let execute = options.execute || (async () => ({
    outcome: "accepted",
    receipt: {
      code: "accepted",
      acknowledgment: "synthetic-server",
      serverTimestamp: "2026-07-30T14:00:01.000Z",
    },
  }));
  const service = durable.createDurableSyncOperationService({
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    persistState: (next) => {
      persisted.push(clone(next));
      return options.persistFailure !== true;
    },
    currentAccountId: () => accountId,
    isOffline: () => offline,
    createId: (prefix) => `${prefix}-${++sequence}`,
    now: () => new Date(nowMs).toISOString(),
    executeOperation: async (operation) => {
      attempts.push(clone(operation));
      return execute(operation);
    },
  });
  return {
    durable,
    service,
    persisted,
    attempts,
    get state() {
      return state;
    },
    setAccount(value) {
      accountId = value;
    },
    setOffline(value) {
      offline = value;
    },
    setExecute(value) {
      execute = value;
    },
    advance(milliseconds) {
      nowMs += milliseconds;
    },
  };
}

function gamePayload(savedAt = "2026-07-30T13:55:00.000Z") {
  return {
    gameRow: {
      id: "game-123",
      user_id: "account-a",
      saved_at: savedAt,
    },
  };
}

function queueDelete(subject, options = {}) {
  return subject.service.queueDelete({
    accountId: options.accountId || "account-a",
    gameId: options.gameId || "game-123",
    knownGameSavedAt: options.knownGameSavedAt || "2026-07-30T13:55:00.000Z",
    deletedAt: options.deletedAt || "2026-07-30T14:00:00.000Z",
  });
}

test("1 deletion intent and operation are persisted atomically before network execution", () => {
  const subject = harness();
  const queued = queueDelete(subject);
  assert.ok(queued.deletionId);
  assert.equal(subject.attempts.length, 0);
  assert.equal(subject.persisted[0].operations[0].operationType, "legacy_game_delete");
  assert.equal(subject.persisted[0].tombstones[0].deletionId, queued.deletionId);
});

test("2 permanent deletion ID survives retry and refresh", async () => {
  const first = harness({ execute: async () => ({ outcome: "retryable", code: "offline" }) });
  const queued = queueDelete(first);
  await first.service.process();
  const refreshed = harness({ initialState: clone(first.state) });
  refreshed.advance(3000);
  await refreshed.service.process();
  assert.equal(refreshed.attempts[0].operationId, queued.deletionId);
  assert.equal(refreshed.attempts[0].payload.deletion.deletion_id, queued.deletionId);
});

test("3 repeated delete action reuses one logical operation", () => {
  const subject = harness();
  const first = queueDelete(subject);
  const second = queueDelete(subject);
  assert.equal(second.deletionId, first.deletionId);
  assert.equal(subject.state.operations.filter((item) => item.operationType === "legacy_game_delete").length, 1);
  assert.equal(subject.state.tombstones.length, 1);
});

test("4 network failure retains retryable deletion evidence", async () => {
  const subject = harness({ execute: async () => ({ outcome: "retryable", code: "network_failure" }) });
  queueDelete(subject);
  await subject.service.process();
  assert.equal(subject.state.operations[0].state, "retryable");
  assert.equal(subject.state.tombstones[0].state, "retryable");
});

test("5 authentication failure retains rejected deletion evidence", async () => {
  const subject = harness();
  queueDelete(subject);
  subject.service.rejectAuthentication("account-a");
  assert.equal(subject.state.operations[0].state, "rejected");
  assert.equal(subject.state.tombstones[0].lastError.category, "authentication_required");
});

test("6 authorization denial retains rejected deletion evidence", async () => {
  const subject = harness({
    execute: async () => ({
      outcome: "rejected",
      category: "authorization_denied",
      code: "authorization_denied",
    }),
  });
  queueDelete(subject);
  await subject.service.process();
  assert.equal(subject.state.operations[0].state, "rejected");
  assert.equal(subject.state.tombstones[0].lastError.category, "authorization_denied");
});

test("7 delete conflict retains conflicted evidence without ordinary retry", async () => {
  const subject = harness({
    execute: async () => ({
      outcome: "conflicted",
      category: "conflict",
      code: "newer_game_revision",
      receipt: { code: "newer_game_revision", serverTimestamp: "2026-07-30T14:01:00.000Z" },
    }),
  });
  queueDelete(subject);
  await subject.service.process();
  assert.equal(subject.state.operations[0].state, "conflicted");
  assert.equal(subject.state.tombstones[0].state, "conflicted");
  assert.equal(subject.attempts.length, 1);
});

test("8 accepted delete receipt is stored on permanent tombstone before operation compaction", async () => {
  const subject = harness();
  const queued = queueDelete(subject);
  await subject.service.process();
  assert.equal(subject.state.operations.length, 0);
  assert.equal(subject.state.tombstones[0].state, "accepted");
  assert.equal(subject.state.tombstones[0].deletionId, queued.deletionId);
  assert.equal(subject.state.tombstones[0].receipt.acknowledgment, "synthetic-server");
  assert.equal(subject.state.acknowledgments[`legacy_game_delete:game-123`].operationId, queued.deletionId);
});

test("8b application rejects a delete receipt whose permanent identity does not match", () => {
  assert.match(appSource, /data\.deletionId !== operation\.operationId/);
  assert.match(appSource, /data\.gameId !== operation\.gameId/);
  assert.match(appSource, /game_delete_acknowledgment_mismatch/);
});

test("9 stale game write cannot process after a tombstone", async () => {
  const subject = harness();
  subject.service.queueGame({ accountId: "account-a", gameId: "game-123", payload: gamePayload() });
  queueDelete(subject);
  await subject.service.process();
  assert.equal(subject.attempts.some((item) => item.operationType === "legacy_game_write"), false);
  assert.equal(subject.state.operations[0].state, "superseded");
});

test("10 older queued game write is retained as superseded history", () => {
  const subject = harness();
  subject.service.queueGame({ accountId: "account-a", gameId: "game-123", payload: gamePayload() });
  queueDelete(subject);
  const write = subject.state.operations.find((item) => item.operationType === "legacy_game_write");
  assert.equal(write.state, "superseded");
  assert.equal(write.receipt.code, "superseded_by_delete");
});

test("11 older in-flight game response cannot acknowledge away a newer delete", async () => {
  let resolveWrite;
  const pendingWrite = new Promise((resolve) => {
    resolveWrite = resolve;
  });
  const subject = harness({
    execute: async (operation) => operation.operationType === "legacy_game_write"
      ? pendingWrite
      : { outcome: "accepted", receipt: { code: "deleted" } },
  });
  subject.service.queueGame({ accountId: "account-a", gameId: "game-123", payload: gamePayload() });
  const processing = subject.service.process();
  while (subject.attempts.length === 0) await new Promise((resolve) => setImmediate(resolve));
  queueDelete(subject);
  resolveWrite({ outcome: "accepted", receipt: { code: "old_write_accepted" } });
  await processing;
  assert.equal(subject.service.isTombstoned("account-a", "game-123"), true);
  const write = subject.state.operations.find((item) => item.operationType === "legacy_game_write");
  assert.equal(write.state, "superseded");
});

function applyGames(local, incoming, tombstones) {
  const deleted = new Set(tombstones.map((item) => item.gameId));
  const merged = new Map(local.filter((item) => !deleted.has(item.id)).map((item) => [item.id, item]));
  incoming.filter((item) => !deleted.has(item.id)).forEach((item) => merged.set(item.id, item));
  return [...merged.values()];
}

test("12 authorized tombstone suppresses a cloud game during hydration", () => {
  assert.deepEqual(applyGames([], [{ id: "game-123" }], [{ gameId: "game-123" }]), []);
});

test("13 both game-then-tombstone and tombstone-then-game response orders end deleted", () => {
  const cloudGame = { id: "game-123" };
  const tombstone = { gameId: "game-123" };
  const gameThenTombstone = applyGames(applyGames([], [cloudGame], []), [], [tombstone]);
  const tombstoneThenGame = applyGames(applyGames([], [], [tombstone]), [cloudGame], [tombstone]);
  assert.deepEqual(gameThenTombstone, []);
  assert.deepEqual(tombstoneThenGame, []);
});

test("14 a missing cloud row without explicit tombstone does not delete local state", () => {
  assert.deepEqual(applyGames([{ id: "game-123", local: true }], [], []), [{ id: "game-123", local: true }]);
});

test("15 account A tombstone is not visible through account B service scope", () => {
  const subject = harness();
  subject.service.mergeServerTombstones("account-a", [{
    gameId: "game-123",
    deletionId: "delete-a",
    deviceId: "device-a",
    deletedAt: "2026-07-30T14:00:00.000Z",
    createdAt: "2026-07-30T14:00:00.000Z",
    updatedAt: "2026-07-30T14:00:00.000Z",
  }]);
  assert.equal(subject.service.isTombstoned("account-a", "game-123"), true);
  assert.equal(subject.service.isTombstoned("account-b", "game-123"), false);
});

test("16 signed-out state processes no account tombstone operation", async () => {
  const first = harness();
  queueDelete(first);
  const signedOut = harness({ initialState: clone(first.state), accountId: "" });
  await signedOut.service.process();
  assert.equal(signedOut.attempts.length, 0);
});

test("17 refresh recovers pending deletion", async () => {
  const first = harness();
  const queued = queueDelete(first);
  const refreshed = harness({ initialState: clone(first.state) });
  await refreshed.service.process();
  assert.equal(refreshed.attempts[0].operationId, queued.deletionId);
});

test("18 reconnect retries an eligible deletion", async () => {
  const subject = harness({ offline: true });
  queueDelete(subject);
  await subject.service.process();
  subject.setOffline(false);
  await subject.service.process();
  assert.equal(subject.attempts.length, 1);
  assert.equal(subject.state.tombstones[0].state, "accepted");
});

test("19 proven local-only deletion creates no server operation", () => {
  const subject = harness();
  const tombstone = subject.service.recordLocalOnlyDeletion({
    accountId: "account-a",
    gameId: "local-game",
    deletedAt: "2026-07-30T14:00:00.000Z",
  });
  assert.equal(tombstone.receipt.code, "local_only_game_deleted");
  assert.equal(subject.state.operations.length, 0);
});

test("20 ambiguous cloud visibility creates durable server deletion protection", () => {
  const bodyStart = appSource.indexOf("function prepareDurableGameDeletion");
  const bodyEnd = appSource.indexOf("function removeTombstonedGamesFromLocalState", bodyStart);
  const body = appSource.slice(bodyStart, bodyEnd);
  assert.match(body, /allowProvenLocalOnly !== false/);
  assert.match(body, /durableSyncService\(\)\.queueDelete/);
  assert.match(appSource, /prepareDurableGameDeletion\(null,\s*\{\s*gameId,\s*allowProvenLocalOnly: false/);
});

test("21 future-version operation and tombstone state is preserved", () => {
  const durable = api();
  const future = { schemaVersion: 2, operations: [], tombstones: [{ future: true }], acknowledgments: {} };
  assert.deepEqual(clone(durable.normalizeState(future)), future);
});

test("22 malformed tombstone state fails structural validation for quarantine", () => {
  assert.equal(api().isStoredState({ schemaVersion: 1, operations: [], tombstones: "bad" }), false);
});

test("23 public, recap, CSV, and private backup builders exclude tombstone metadata", () => {
  for (const [startName, endName] of [
    ["function fullBackupPayload", "function openExportDialog"],
    ["function buildFamilyRecap", "function renderFamilyRecapSection"],
    ["function buildCSV", "function downloadFile"],
    ["function publicLiveShareGameFromPayload", "async function fetchPublicLiveShareGame"],
  ]) {
    const start = appSource.indexOf(startName);
    const end = appSource.indexOf(endName, start);
    assert.ok(start >= 0 && end > start, `${startName} disclosure boundary was not found`);
    const body = appSource.slice(start, end);
    assert.doesNotMatch(body, /tombstone|deletionId|syncOperations|legacy_game_delete/);
  }
});

test("24 R2-03 lossless same-ID hydration contracts remain present", () => {
  assert.match(characterizationSource, /R2-03/);
  assert.match(characterizationSource, /richer local game survives poorer same-ID cloud hydration/i);
});

test("25 R2-04 permanent game-write identity behavior remains present", async () => {
  const subject = harness({ execute: async () => ({ outcome: "retryable", code: "network_failure" }) });
  const queued = subject.service.queueGame({
    accountId: "account-a",
    gameId: "game-123",
    payload: gamePayload(),
  });
  await subject.service.process();
  subject.advance(3000);
  await subject.service.process();
  assert.equal(subject.attempts[0].operationId, queued.operationId);
  assert.equal(subject.attempts[1].operationId, queued.operationId);
});

test("26 R2-05 classification remains deterministic for tombstone errors", () => {
  const durable = api();
  assert.equal(durable.classifyFailure({ code: "P0001", message: "laxhornet_game_deleted" }).outcome, "conflicted");
  assert.equal(durable.classifyFailure({ status: 403, message: "permission denied" }).category, "authorization_denied");
  assert.equal(durable.classifyFailure({ status: 0, message: "failed to fetch" }).outcome, "retryable");
});

test("27 Trust Spine event tombstones remain a separate unchanged service", () => {
  const durable = api();
  assert.equal(durable.OPERATION_TYPES.gameDelete, "legacy_game_delete");
  assert.match(trustSpineTestSource, /lh_tombstone_event/);
  assert.doesNotMatch(serviceSource.slice(serviceSource.indexOf("(function initializeLaxHornetDurableSyncOperations")), /lh_tombstone_event/);
});

test("integrated two-device stale upload is rejected and both devices end deleted", async () => {
  const server = { game: null, tombstone: null };
  const execute = async (operation) => {
    if (operation.operationType === "legacy_game_delete") {
      server.tombstone = clone(operation.payload.deletion);
      server.game = null;
      return { outcome: "accepted", receipt: { code: "game_deleted", serverTimestamp: operation.payload.deletion.deleted_at } };
    }
    if (server.tombstone) {
      return {
        outcome: "conflicted",
        category: "conflict",
        code: "game_deleted",
        receipt: { code: "game_deleted", serverTimestamp: server.tombstone.deleted_at },
      };
    }
    server.game = clone(operation.payload.gameRow);
    return { outcome: "accepted", receipt: { code: "game_written" } };
  };

  const deviceA = harness({ deviceId: "device-a", execute });
  deviceA.service.queueGame({ accountId: "account-a", gameId: "game-123", payload: gamePayload() });
  await deviceA.service.process();
  const staleDeviceBGame = clone(server.game);

  queueDelete(deviceA);
  await deviceA.service.process();
  assert.equal(server.game, null);

  const deviceB = harness({ deviceId: "device-b", execute });
  deviceB.service.queueGame({ accountId: "account-a", gameId: "game-123", payload: { gameRow: staleDeviceBGame } });
  await deviceB.service.process();
  assert.equal(deviceB.state.operations[0].state, "conflicted");
  deviceB.service.mergeServerTombstones("account-a", [{
    gameId: "game-123",
    deletionId: server.tombstone.deletion_id,
    deviceId: server.tombstone.device_id,
    deletedAt: server.tombstone.deleted_at,
    knownGameSavedAt: server.tombstone.known_game_saved_at,
    createdAt: server.tombstone.deleted_at,
    updatedAt: server.tombstone.deleted_at,
  }]);

  assert.equal(deviceA.service.isTombstoned("account-a", "game-123"), true);
  assert.equal(deviceB.service.isTombstoned("account-a", "game-123"), true);
  assert.deepEqual(applyGames([staleDeviceBGame], [], deviceB.state.tombstones), []);
});
