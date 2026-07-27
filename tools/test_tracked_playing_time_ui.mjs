import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
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
vm.runInContext(source("tracked-playing-time-service.js"), context);
const api = context.window.LaxHornetTrackedPlayingTime;
const app = source("app.js");
const appHtml = source("app.html");
const worker = source("service-worker.js");
const migration = source("supabase/migrations/20260727000000_tracked_playing_time_operations.sql");
const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

const baseNow = Date.parse("2026-07-27T12:00:00.000Z");
const clock = api.createClockState({
  gameId: "game-a",
  playerId: "player-a",
  periodFormat: "quarters",
  regulationPeriodDurationSeconds: 720,
  overtimeDurationSeconds: 240,
}, baseNow);
let sequence = 0;
function boundary(kind, gameClockSeconds, options = {}) {
  sequence += 1;
  return {
    operationId: options.operationId || `operation-${sequence}`,
    clientOperationId: options.clientOperationId || `client-${sequence}`,
    logicalEventId: options.logicalEventId || `logical-${sequence}`,
    targetOperationId: options.targetOperationId || "",
    gameId: "game-a",
    playerId: "player-a",
    operationKind: kind,
    period: options.period || "Q1",
    gameClockSeconds,
    occurredAt: options.occurredAt || new Date(baseNow + sequence * 1000).toISOString(),
    clientCreatedAt: options.clientCreatedAt || new Date(baseNow + sequence * 1000).toISOString(),
    source: options.source || "live",
    systemCloseReason: options.systemCloseReason || null,
    recoveryUncertain: Boolean(options.recoveryUncertain),
    changeReason: options.changeReason || "",
  };
}

function summary(operations, options = {}) {
  return api.derivePlayingTimeSummary({
    operations,
    clockState: options.clockState === undefined ? clock : options.clockState,
    syncIssue: options.syncIssue || "",
  });
}

test("existing game path does not invent tracked-time configuration", () => {
  assert.match(app, /function hasTrackedPlayingTime\(game\)/);
  assert.match(app, /Playing time was not tracked for this game\./);
});

test("configured game starts paused and off field", () => {
  assert.equal(clock.isRunning, false);
  assert.equal(summary([]).onField, false);
});

test("one Player In creates one effective private boundary", () => {
  assert.equal(summary([boundary("player_in", 600)]).effectiveOperations.length, 1);
});

test("one Player Out completes one shift", () => {
  const value = summary([boundary("player_in", 600), boundary("player_out", 540)]);
  assert.equal(value.shiftCount, 1);
  assert.equal(value.durationSeconds, undefined);
  assert.equal(value.shifts[0].durationSeconds, 60);
});

test("active shift duration follows projected game clock", () => {
  const started = api.startClock({ ...clock, clockSecondsRemaining: 600 }, baseNow);
  const projected = api.projectClock(started, baseNow + 42_000);
  const value = summary([boundary("player_in", 600)], { clockState: projected });
  assert.equal(value.activeStart.gameClockSeconds - projected.clockSecondsRemaining, 42);
});

test("paused clock excludes wall-clock time from active shift", () => {
  const started = api.startClock({ ...clock, clockSecondsRemaining: 600 }, baseNow);
  const paused = api.pauseClock(started, baseNow + 75_000);
  assert.equal(api.projectClock(paused, baseNow + 600_000).clockSecondsRemaining, 525);
});

test("resumed clock continues from the paused checkpoint", () => {
  const paused = api.pauseClock(api.startClock(clock, baseNow), baseNow + 75_000);
  const resumed = api.resumeClock(paused, baseNow + 600_000);
  assert.equal(api.projectClock(resumed, baseNow + 645_000).clockSecondsRemaining, 600);
});

test("multiple shifts calculate total average and longest", () => {
  const value = summary([
    boundary("player_in", 600),
    boundary("player_out", 450),
    boundary("player_in", 300),
    boundary("player_out", 120),
  ]);
  assert.deepEqual(
    [value.shiftCount, value.totalSeconds, value.averageSeconds, value.longestSeconds],
    [2, 330, 165, 180],
  );
});

test("double Player In is rejected as overlap evidence", () => {
  const value = summary([boundary("player_in", 600), boundary("player_in", 590)]);
  assert.equal(value.shifts.length, 0);
  assert.ok(value.issues.some((issue) => issue.code === "overlapping_player_in"));
});

test("double Player Out does not create an invalid shift", () => {
  const value = summary([
    boundary("player_in", 600),
    boundary("player_out", 550),
    boundary("player_out", 540),
  ]);
  assert.equal(value.shifts.length, 1);
  assert.ok(value.issues.some((issue) => issue.code === "unmatched_player_out"));
});

test("period end system closure records zero clock and indicator", () => {
  const value = summary([
    boundary("player_in", 90),
    boundary("player_out", 0, { source: "system_period_end", systemCloseReason: "period_end" }),
  ]);
  assert.equal(value.shifts[0].durationSeconds, 90);
  assert.equal(value.shifts[0].systemClosed, true);
});

test("next period transition is paused and off field", () => {
  const next = api.transitionPeriod(clock, "Q2", baseNow);
  assert.equal(next.isRunning, false);
  assert.equal(summary([], { clockState: next }).onField, false);
});

test("game-end system closure completes the active shift", () => {
  const value = summary([
    boundary("player_in", 240, { period: "Q2" }),
    boundary("player_out", 80, { period: "Q2", source: "system_game_end", systemCloseReason: "game_end" }),
  ]);
  assert.equal(value.shifts[0].durationSeconds, 160);
  assert.equal(value.status, "complete");
});

test("bounded running refresh restores one active boundary", () => {
  const operation = boundary("player_in", 600);
  const recovered = api.classifyClockRecovery(api.startClock(clock, baseNow), baseNow + 20_000, {
    maximumCertainGapSeconds: 30,
  });
  assert.equal(summary([operation, { ...operation }], { clockState: recovered.clockState }).effectiveOperations.length, 1);
});

test("uncertain running refresh marks Needs review", () => {
  const uncertain = boundary("player_in", 600, { recoveryUncertain: true });
  assert.equal(summary([uncertain]).status, "needs_review");
});

test("duplicate client operation is idempotent", () => {
  const operation = boundary("player_in", 600);
  assert.equal(summary([operation, { ...operation }]).effectiveOperations.length, 1);
});

test("corrected start updates duration", () => {
  const start = boundary("player_in", 600);
  const end = boundary("player_out", 360);
  const correction = boundary("correct", 560, {
    logicalEventId: start.logicalEventId,
    targetOperationId: start.operationId,
    source: "manual",
    changeReason: "Correct start",
  });
  const value = summary([start, end, correction]);
  assert.equal(value.shifts[0].durationSeconds, 200);
  assert.equal(value.status, "estimated");
});

test("corrected end updates duration", () => {
  const start = boundary("player_in", 600);
  const end = boundary("player_out", 360);
  const correction = boundary("correct", 400, {
    logicalEventId: end.logicalEventId,
    targetOperationId: end.operationId,
    source: "manual",
    changeReason: "Correct end",
  });
  assert.equal(summary([start, end, correction]).shifts[0].durationSeconds, 200);
});

test("tombstoned shift boundaries are removed from totals", () => {
  const start = boundary("player_in", 600);
  const end = boundary("player_out", 500);
  const removeStart = boundary("tombstone", null, {
    logicalEventId: start.logicalEventId,
    targetOperationId: start.operationId,
    source: "manual",
    changeReason: "Remove invalid shift",
  });
  const removeEnd = boundary("tombstone", null, {
    logicalEventId: end.logicalEventId,
    targetOperationId: end.operationId,
    source: "manual",
    changeReason: "Remove invalid shift",
  });
  assert.equal(summary([start, end, removeStart, removeEnd]).totalSeconds, 0);
});

test("manual shift is valid but Estimated", () => {
  const value = summary([
    boundary("player_in", 600, { source: "manual" }),
    boundary("player_out", 500, { source: "manual" }),
  ]);
  assert.equal(value.status, "estimated");
});

test("unmatched boundary is Needs review", () => {
  assert.equal(summary([boundary("player_out", 500)]).status, "needs_review");
});

test("fully valid live tracking is Complete", () => {
  assert.equal(summary([boundary("player_in", 600), boundary("player_out", 500)]).status, "complete");
});

test("configured regulation game share is correct", () => {
  const value = summary([boundary("player_in", 720), boundary("player_out", 0)]);
  assert.equal(value.gameShare, 25);
});

test("game share is omitted without a reliable clock configuration", () => {
  assert.equal(summary([], { clockState: null }).gameShare, null);
});

test("public Live Share mapper contains no tracked-time fields", () => {
  const mapper = app.slice(app.indexOf("function publicLiveShareGameFromPayload"), app.indexOf("async function loadSharedGame"));
  assert.doesNotMatch(mapper, /trackedPlayingTime|participation|clockSecondsRemaining/);
});

test("tracked-time RPCs are not granted to anonymous users", () => {
  assert.doesNotMatch(migration, /grant execute on function public\.lh_(?:initialize_game_clock|list_effective_participation)[\s\S]{0,100}to anon/);
});

test("selected CSV remains event-only", () => {
  const csvBuilder = app.slice(app.indexOf("function buildCSV"), app.indexOf("function buildFullBackup"));
  assert.match(csvBuilder, /normalizedGame\.events/);
  assert.doesNotMatch(csvBuilder, /trackedPlayingTime|participationOperations/);
});

test("personal-game clock scope is preserved", () => {
  const personal = api.createClockState({
    gameId: "personal",
    playerId: "player",
    scopeType: "personal",
    periodFormat: "quarters",
    regulationPeriodDurationSeconds: 720,
  });
  assert.equal(personal.scopeType, "personal");
});

test("team-roster clock scope is preserved", () => {
  const team = api.createClockState({
    gameId: "team-game",
    playerId: "player",
    teamId: "team",
    rosterPlayerId: "roster-player",
    scopeType: "team_roster",
    periodFormat: "halves",
    regulationPeriodDurationSeconds: 1440,
  });
  assert.equal(team.scopeType, "team_roster");
});

test("ordinary stat events remain separate from participation", () => {
  assert.match(app, /state\.activeGame\.events\.push\(event\)/);
  assert.doesNotMatch(app, /statType:\s*["']player_(?:in|out)/);
});

test("existing untracked period selector remains available", () => {
  assert.match(app, /data-quarter="\$\{period\}"/);
  assert.match(app, /hasTrackedPlayingTime\(game\)/);
});

test("existing Game Review keeps its prior sections", () => {
  assert.match(app, /renderReviewSummarySection/);
  assert.match(app, /renderReviewStatsSection/);
  assert.match(app, /renderTrackedPlayingTimeReview/);
});

test("service worker caches the tracked-time script without a version bump", () => {
  assert.match(worker, /\.\/tracked-playing-time-service\.js\?v=283/);
  assert.match(worker, /const CACHE_NAME = "laxhornet-v283"/);
});

test("tracked-time service loads before app.js", () => {
  assert.ok(
    appHtml.indexOf("tracked-playing-time-service.js?v=283")
      < appHtml.indexOf("app.js?v=283"),
  );
});

test("family/public recap builders do not reference tracked-time data", () => {
  const recap = app.slice(app.indexOf("function buildFamilyRecap"), app.indexOf("function copyGameFamilyRecap"));
  assert.doesNotMatch(recap, /trackedPlayingTime|participationOperations/);
});

test("private full backup retains tracked state through normalized games", () => {
  assert.match(app, /games: state\.games\.map\(normalizeGame\)/);
  assert.match(app, /return \{\s*\.\.\.game,/);
});

const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status.padEnd(4)} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}
console.log(`\n${results.length - failures.length}/${results.length} tracked playing time UI tests passed.`);
if (failures.length) process.exitCode = 1;
