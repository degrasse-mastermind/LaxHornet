import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "tracked-playing-time-service.js"), "utf8");
const context = vm.createContext({
  window: {},
  Date,
  Math,
  Number,
  Object,
  String,
  TypeError,
  Promise,
  Set,
  Map,
});
vm.runInContext(source, context);
const api = context.window.LaxHornetTrackedPlayingTime;
const results = [];
const pendingTests = [];

function test(name, callback) {
  pendingTests.push(
    Promise.resolve()
      .then(callback)
      .then(
        () => results.push({ name, status: "PASS" }),
        (error) => results.push({ name, status: "FAIL", error: error.message }),
      ),
  );
}

const baseNow = Date.parse("2026-07-27T12:00:00.000Z");
const baseClock = api.createClockState({
  gameId: "synthetic-game",
  playerId: "synthetic-player",
  periodFormat: "quarters",
  regulationPeriodDurationSeconds: 720,
  overtimeDurationSeconds: 240,
}, baseNow);

test("clock starts paused at configured period duration", () => {
  assert.equal(baseClock.currentPeriod, "Q1");
  assert.equal(baseClock.clockSecondsRemaining, 720);
  assert.equal(baseClock.isRunning, false);
});

test("clock start and projection use persisted anchor state", () => {
  const started = api.startClock(baseClock, baseNow);
  const projected = api.projectClock(started, baseNow + 75_000);
  assert.equal(projected.clockSecondsRemaining, 645);
  assert.equal(projected.isRunning, true);
});

test("clock pause freezes game-clock position", () => {
  const started = api.startClock(baseClock, baseNow);
  const paused = api.pauseClock(started, baseNow + 75_000);
  const later = api.projectClock(paused, baseNow + 600_000);
  assert.equal(paused.clockSecondsRemaining, 645);
  assert.equal(later.clockSecondsRemaining, 645);
});

test("clock resume continues from paused position", () => {
  const started = api.startClock(baseClock, baseNow);
  const paused = api.pauseClock(started, baseNow + 75_000);
  const resumed = api.resumeClock(paused, baseNow + 600_000);
  const projected = api.projectClock(resumed, baseNow + 645_000);
  assert.equal(projected.clockSecondsRemaining, 600);
});

test("period transition resets configured duration and pauses", () => {
  const next = api.transitionPeriod(baseClock, "Q2", baseNow + 1_000);
  assert.equal(next.currentPeriod, "Q2");
  assert.equal(next.clockSecondsRemaining, 720);
  assert.equal(next.isRunning, false);
});

test("halves and overtime durations are deterministic", () => {
  const halves = api.createClockState({
    gameId: "halves-game",
    playerId: "halves-player",
    periodFormat: "halves",
    regulationPeriodDurationSeconds: 1200,
    overtimeDurationSeconds: 180,
  }, baseNow);
  assert.equal(api.transitionPeriod(halves, "H2", baseNow).clockSecondsRemaining, 1200);
  assert.equal(api.transitionPeriod(halves, "OT", baseNow).clockSecondsRemaining, 180);
});

test("bounded refresh recovery projects a running clock", () => {
  const started = api.startClock(baseClock, baseNow);
  const recovery = api.classifyClockRecovery(started, baseNow + 20_000, {
    maximumCertainGapSeconds: 30,
  });
  assert.equal(recovery.status, "complete");
  assert.equal(recovery.clockState.clockSecondsRemaining, 700);
});

test("uncertain refresh recovery freezes without inventing clock time", () => {
  const started = api.startClock(baseClock, baseNow);
  const recovery = api.classifyClockRecovery(started, baseNow + 120_000, {
    maximumCertainGapSeconds: 30,
  });
  assert.equal(recovery.status, "needs_review");
  assert.equal(recovery.clockState.clockSecondsRemaining, 720);
  assert.equal(recovery.clockState.isRunning, false);
});

test("game-end closure captures game-clock context", () => {
  const started = api.startClock(baseClock, baseNow);
  const closure = api.gameEndClosureContext(started, baseNow + 30_000);
  assert.equal(closure.gameClockSeconds, 690);
  assert.equal(closure.source, "system_game_end");
  assert.equal(closure.systemCloseReason, "game_end");
});

const playerIn = {
  operationId: "op-in",
  clientOperationId: "client-in",
  logicalEventId: "logical-in",
  gameId: "synthetic-game",
  playerId: "synthetic-player",
  operationKind: "player_in",
  period: "Q1",
  gameClockSeconds: 600,
  occurredAt: "2026-07-27T12:02:00.000Z",
  clientCreatedAt: "2026-07-27T12:02:00.000Z",
  source: "live",
};

test("participation payload uses private RPC field names", () => {
  assert.deepEqual(
    Object.keys(api.participationRpcPayload(playerIn)).sort(),
    [
      "client_created_at",
      "client_operation_id",
      "game_clock_seconds",
      "game_id",
      "logical_event_id",
      "occurred_at",
      "operation_id",
      "operation_kind",
      "period",
      "player_id",
      "recovery_uncertain",
      "source",
      "system_close_reason",
    ].sort(),
  );
});

test("effective resolver ignores duplicate client operations", () => {
  const effective = api.resolveEffectiveParticipationOperations([playerIn, { ...playerIn }]);
  assert.equal(effective.length, 1);
});

test("effective resolver applies correction to stable logical identity", () => {
  const correction = {
    operationId: "op-correction",
    clientOperationId: "client-correction",
    logicalEventId: "logical-in",
    targetOperationId: "op-in",
    gameId: "synthetic-game",
    operationKind: "correct",
    period: "Q1",
    gameClockSeconds: 580,
    occurredAt: "2026-07-27T12:02:20.000Z",
    clientCreatedAt: "2026-07-27T12:05:00.000Z",
    source: "manual",
    changeReason: "Correct missed tap",
  };
  const [effective] = api.resolveEffectiveParticipationOperations([playerIn, correction]);
  assert.equal(effective.operationKind, "player_in");
  assert.equal(effective.gameClockSeconds, 580);
  assert.equal(effective.corrected, true);
});

test("effective resolver removes tombstoned logical event", () => {
  const tombstone = {
    operationId: "op-tombstone",
    clientOperationId: "client-tombstone",
    logicalEventId: "logical-in",
    targetOperationId: "op-in",
    gameId: "synthetic-game",
    operationKind: "tombstone",
    clientCreatedAt: "2026-07-27T12:05:00.000Z",
    source: "manual",
    changeReason: "Remove invalid tap",
  };
  assert.equal(api.resolveEffectiveParticipationOperations([playerIn, tombstone]).length, 0);
});

test("offline operation is persisted before cloud retry", async () => {
  const calls = [];
  const game = { id: "synthetic-game" };
  const service = api.createTrackedPlayingTimeService({
    persistLocal: () => calls.push("persist"),
    sendClock: async () => ({ outcome: "accepted" }),
    sendOperations: async () => ({ outcome: "accepted", results: [] }),
    readEffectiveOperations: async () => ({ outcome: "accepted", operations: [] }),
    canUseCloud: () => false,
  });
  const result = service.appendParticipationOperation({ game, operation: playerIn });
  assert.equal(calls[0], "persist");
  assert.equal(result.operation.syncState, "pending");
  assert.equal(await result.cloudPromise, false);
});

test("retry accepts operations idempotently without duplicating local history", async () => {
  const game = { id: "synthetic-game" };
  let sends = 0;
  const service = api.createTrackedPlayingTimeService({
    persistLocal: () => {},
    sendClock: async () => ({ outcome: "accepted" }),
    sendOperations: async (operations) => {
      sends += 1;
      return {
        outcome: "accepted",
        results: operations.map((operation) => ({
          outcome: "accepted",
          clientOperationId: operation.client_operation_id,
        })),
      };
    },
    readEffectiveOperations: async () => ({ outcome: "accepted", operations: [] }),
    canUseCloud: () => true,
  });
  const first = service.appendParticipationOperation({ game, operation: playerIn });
  await first.cloudPromise;
  const duplicate = service.appendParticipationOperation({ game, operation: playerIn });
  assert.equal(duplicate.duplicate, true);
  assert.equal(game.trackedPlayingTime.participationOperations.length, 1);
  assert.equal(await service.retryParticipationOperations(game), true);
  assert.equal(sends, 1);
});

test("reconciliation stores a private effective snapshot", async () => {
  const game = { id: "synthetic-game" };
  const service = api.createTrackedPlayingTimeService({
    persistLocal: () => {},
    sendClock: async () => ({ outcome: "accepted" }),
    sendOperations: async () => ({ outcome: "accepted", results: [] }),
    readEffectiveOperations: async () => ({ outcome: "accepted", operations: [{ logicalEventId: "remote-in" }] }),
    canUseCloud: () => true,
  });
  assert.equal(await service.reconcileParticipationOperations(game), true);
  assert.equal(game.trackedPlayingTime.remoteEffectiveParticipation[0].logicalEventId, "remote-in");
});

await Promise.all(pendingTests);
const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status.padEnd(4)} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}
console.log(`\n${results.length - failures.length}/${results.length} tracked playing time service tests passed.`);
if (failures.length) process.exitCode = 1;
