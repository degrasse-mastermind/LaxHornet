import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
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
vm.runInContext(fs.readFileSync(path.join(root, "tracked-playing-time-service.js"), "utf8"), context);
const api = context.window.LaxHornetTrackedPlayingTime;
const baseNow = Date.parse("2026-07-27T12:00:00.000Z");
const clock = api.createClockState({
  gameId: "manual-game",
  playerId: "synthetic-player",
  periodFormat: "quarters",
  regulationPeriodDurationSeconds: 720,
  overtimeDurationSeconds: 240,
}, baseNow);
let sequence = 0;

function operation(kind, gameClockSeconds, options = {}) {
  sequence += 1;
  return {
    operationId: options.operationId || `op-${sequence}`,
    clientOperationId: options.clientOperationId || `client-${sequence}`,
    logicalEventId: options.logicalEventId || `logical-${sequence}`,
    targetOperationId: options.targetOperationId || "",
    gameId: "manual-game",
    playerId: "synthetic-player",
    operationKind: kind,
    period: options.period || "Q1",
    gameClockSeconds,
    occurredAt: new Date(baseNow + sequence * 1000).toISOString(),
    clientCreatedAt: new Date(baseNow + sequence * 1000).toISOString(),
    source: options.source || "live",
    systemCloseReason: options.systemCloseReason || null,
    recoveryUncertain: false,
    changeReason: options.changeReason || "",
  };
}

function derive(operations, clockState = clock) {
  return api.derivePlayingTimeSummary({ operations, clockState });
}

const scenarios = [];
function scenario(name, callback) {
  try {
    const evidence = callback();
    scenarios.push({ name, passed: true, evidence });
  } catch (error) {
    scenarios.push({ name, passed: false, evidence: error.message });
  }
}

scenario("A. Normal rotation", () => {
  const value = derive([
    operation("player_in", 600),
    operation("player_out", 450),
    operation("player_in", 300),
    operation("player_out", 120),
  ]);
  assert.deepEqual(
    [value.shiftCount, value.totalSeconds, value.averageSeconds, value.longestSeconds, value.status],
    [2, 330, 165, 180, "complete"],
  );
  return "2 shifts; total 5:30; average 2:45; longest 3:00; Complete";
});

scenario("B. Period boundary", () => {
  const value = derive([
    operation("player_in", 90),
    operation("player_out", 0, { source: "system_period_end", systemCloseReason: "period_end" }),
  ]);
  const next = api.transitionPeriod(clock, "Q2", baseNow + 1000);
  assert.equal(value.shifts[0].durationSeconds, 90);
  assert.equal(value.shifts[0].systemClosed, true);
  assert.equal(next.currentPeriod, "Q2");
  assert.equal(derive([], next).onField, false);
  return "Q1 shift closed at 0:00 for 1:30; Q2 begins off field; Complete";
});

scenario("C. Clock pause", () => {
  const initial = { ...clock, clockSecondsRemaining: 600 };
  const started = api.startClock(initial, baseNow);
  const paused = api.pauseClock(started, baseNow + 75_000);
  const afterPause = api.projectClock(paused, baseNow + 600_000);
  const resumed = api.resumeClock(afterPause, baseNow + 600_000);
  const finished = api.projectClock(resumed, baseNow + 645_000);
  const value = derive([
    operation("player_in", 600),
    operation("player_out", finished.clockSecondsRemaining),
  ], finished);
  assert.equal(afterPause.clockSecondsRemaining, 525);
  assert.equal(value.totalSeconds, 120);
  return "1:15 run + paused wall time + 0:45 run = 2:00";
});

scenario("D. Game-end closure", () => {
  const value = derive([
    operation("player_in", 240, { period: "Q2" }),
    operation("player_out", 80, {
      period: "Q2",
      source: "system_game_end",
      systemCloseReason: "game_end",
    }),
  ]);
  assert.equal(value.totalSeconds, 160);
  assert.equal(value.shifts[0].systemClosed, true);
  assert.equal(value.status, "complete");
  return "Q2 4:00 to 1:20 = 2:40; system game-end closure; Complete";
});

scenario("E. Correction", () => {
  const start = operation("player_in", 600);
  const end = operation("player_out", 360);
  const correction = operation("correct", 560, {
    logicalEventId: start.logicalEventId,
    targetOperationId: start.operationId,
    source: "manual",
    changeReason: "Correct start",
  });
  const value = derive([start, end, correction]);
  assert.equal(value.totalSeconds, 200);
  assert.equal(value.status, "estimated");
  assert.equal(value.shifts[0].corrected, true);
  assert.equal(api.resolveEffectiveParticipationOperations([start, end, correction]).length, 2);
  return "4:00 original becomes 3:20; Estimated; correction revision preserved";
});

scenario("F. Refresh recovery", () => {
  const start = operation("player_in", 600);
  const running = api.startClock({ ...clock, clockSecondsRemaining: 600 }, baseNow);
  const recovered = api.classifyClockRecovery(running, baseNow + 20_000, {
    maximumCertainGapSeconds: 30,
  });
  const continued = api.projectClock(recovered.clockState, baseNow + 40_000);
  const value = derive([start, { ...start }, operation("player_out", continued.clockSecondsRemaining)], continued);
  assert.equal(value.shiftCount, 1);
  assert.equal(value.totalSeconds, 40);
  return "one deduplicated continuous 0:40 shift after bounded refresh recovery";
});

scenario("G. No data", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(app, /Playing time was not tracked for this game\./);
  assert.match(app, /if \(!summary\)/);
  return "older game uses the exact no-data message and no inferred operations";
});

for (const item of scenarios) {
  console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.evidence}`);
}
const failures = scenarios.filter((item) => !item.passed);
console.log(`\n${scenarios.length - failures.length}/${scenarios.length} manual scenarios passed.`);
if (failures.length) process.exitCode = 1;
