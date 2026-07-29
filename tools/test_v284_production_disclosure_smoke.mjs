import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_APPLICATION_SHA,
  PRODUCTION_PROJECT_REF,
  TOOLING_BRANCH,
  assertPublicPayload,
} from "./v284_local_disclosure_fixture.mjs";
import {
  PRODUCTION_API_URL,
  PRODUCTION_ORIGIN,
  assertCleanupProof,
  assertPrewriteState,
  assertProductionTarget,
  isOldPrivateAuthorityRejected,
  parseApprovedToolingSha,
  unresolvedParticipationStarts,
} from "./v284_production_disclosure_smoke.mjs";

const results = [];
const toolingSha = "a".repeat(40);
const validTarget = {
  projectRef: PRODUCTION_PROJECT_REF,
  apiUrl: PRODUCTION_API_URL,
  applicationOrigin: PRODUCTION_ORIGIN,
  approvedApplicationSha: APPROVED_APPLICATION_SHA,
  branch: TOOLING_BRANCH,
  headSha: toolingSha,
  approvedToolingSha: toolingSha,
  configProjectId: PRODUCTION_PROJECT_REF,
  workingTreeClean: true,
};
const validPrewrite = {
  migrationCount: 1,
  activeTokenCount: 0,
  hostedAssetsMatch: true,
  toolingAbsentFromDeployment: true,
};
const validCleanup = {
  authUsers: 0,
  authSessions: 0,
  refreshTokens: 0,
  legacyEvents: 0,
  legacyGames: 0,
  playerClaims: 0,
  teamMembers: 0,
  rosterPlayers: 0,
  teams: 0,
  userProfiles: 0,
  activeTokens: 0,
  activeGrants: 0,
  runningClockRows: 0,
  activeEventVersions: 0,
  activeParticipation: 0,
  pendingEventOperations: 0,
  conflictedEventOperations: 0,
  retainedEventOperations: 7,
  retainedParticipationOperations: 9,
  retainedLifecycleEvents: 6,
  retainedGameScopes: 2,
  retainedClockRows: 1,
  oldAccessTokenRejected: true,
  oldRefreshTokenRejected: true,
  oldPrivateRpcRejected: true,
  realDataTouched: false,
};
const validPublicPayload = {
  game: {
    final_score_against: 4,
    final_score_for: 6,
    game_date: "2026-07-28",
    game_id: "synthetic-game",
    jersey_number: "99",
    opponent: "V284 Synthetic Opponent",
    period_format: "quarters",
    player_name: "V284 Synthetic Player",
    position: "Midfield",
    team_name: "V284 Synthetic Team",
  },
  events: [
    {
      category: "Effort / IQ",
      event_id: "event-a",
      field_zone: "Midfield",
      occurred_at: "2026-07-28T12:00:00.000Z",
      period: "Q1",
      point_value: 2,
      stat_label: "Ground Ball",
      stat_type: "groundBall",
    },
    {
      category: "Offense",
      event_id: "event-b",
      field_zone: "Offensive end",
      occurred_at: "2026-07-28T12:01:00.000Z",
      period: "Q1",
      point_value: 3,
      stat_label: "Assist",
      stat_type: "assist",
    },
  ],
};

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

function rejects(name, callback, pattern) {
  test(name, () => assert.throws(callback, pattern));
}

test("accepts an exact approved production target", () => {
  assert.equal(assertProductionTarget(validTarget), true);
});
for (const [name, override, pattern] of [
  ["rejects a foreign Supabase project", { projectRef: "foreign" }, /project reference mismatch/],
  ["rejects a foreign API origin", { apiUrl: "https://example.invalid" }, /API origin mismatch/],
  ["rejects a foreign application origin", { applicationOrigin: "https://example.invalid" }, /application origin mismatch/],
  ["rejects application SHA drift", { approvedApplicationSha: "b".repeat(40) }, /application SHA mismatch/],
  ["rejects the wrong tooling branch", { branch: "main" }, /non-deployable tooling branch/],
  ["rejects unapproved tooling bytes", { headSha: "b".repeat(40) }, /independently approved SHA/],
  ["rejects a dirty tooling tree", { workingTreeClean: false }, /must be clean/],
  ["rejects a linked project mismatch", { configProjectId: "foreign" }, /linked Supabase project mismatch/],
]) {
  rejects(name, () => assertProductionTarget({ ...validTarget, ...override }), pattern);
}

test("requires a full explicit tooling SHA", () => {
  assert.equal(parseApprovedToolingSha(["--approved-tooling-sha", toolingSha]), toolingSha);
});
rejects("rejects a missing tooling SHA", () => parseApprovedToolingSha([]), /is required/);
rejects(
  "rejects an abbreviated tooling SHA",
  () => parseApprovedToolingSha(["--approved-tooling-sha", "abcdef0"]),
  /full Git SHA/,
);

test("accepts fail-closed prewrite state", () => {
  assert.equal(assertPrewriteState(validPrewrite), true);
});
for (const [name, override, pattern] of [
  ["rejects a missing migration", { migrationCount: 0 }, /exactly once/],
  ["rejects duplicate migration history", { migrationCount: 2 }, /exactly once/],
  ["rejects an active pre-existing share", { activeTokenCount: 1 }, /forbid synthetic production writes/],
  ["rejects hosted asset drift", { hostedAssetsMatch: false }, /hosted application bytes/],
  ["rejects deployed tooling", { toolingAbsentFromDeployment: false }, /entered the application tree/],
]) {
  rejects(name, () => assertPrewriteState({ ...validPrewrite, ...override }), pattern);
}

test("accepts exact-zero production cleanup", () => {
  assert.equal(assertCleanupProof(validCleanup), true);
});
for (const key of [
  "retainedEventOperations",
  "retainedParticipationOperations",
  "retainedLifecycleEvents",
  "retainedGameScopes",
  "retainedClockRows",
]) {
  rejects(
    `rejects unavailable ${key}`,
    () => assertCleanupProof({ ...validCleanup, [key]: null }),
    /not an integer/,
  );
  rejects(
    `rejects negative ${key}`,
    () => assertCleanupProof({ ...validCleanup, [key]: -1 }),
    /is negative/,
  );
}
for (const key of [
  "authUsers",
  "authSessions",
  "refreshTokens",
  "legacyEvents",
  "legacyGames",
  "playerClaims",
  "teamMembers",
  "rosterPlayers",
  "teams",
  "userProfiles",
  "activeTokens",
  "activeGrants",
  "runningClockRows",
  "activeEventVersions",
  "activeParticipation",
  "pendingEventOperations",
  "conflictedEventOperations",
]) {
  rejects(
    `rejects surviving ${key}`,
    () => assertCleanupProof({ ...validCleanup, [key]: 1 }),
    /survived production cleanup/,
  );
  rejects(
    `rejects unavailable ${key}`,
    () => assertCleanupProof({ ...validCleanup, [key]: null }),
    /not an integer/,
  );
}
rejects(
  "rejects usable old access token",
  () => assertCleanupProof({ ...validCleanup, oldAccessTokenRejected: false }),
  /retained authority/,
);
rejects(
  "rejects usable old refresh token",
  () => assertCleanupProof({ ...validCleanup, oldRefreshTokenRejected: false }),
  /remained usable/,
);
rejects(
  "rejects retained old private RPC authority",
  () => assertCleanupProof({ ...validCleanup, oldPrivateRpcRejected: false }),
  /private RPC authority/,
);
rejects(
  "rejects an ambiguous real-data boundary",
  () => assertCleanupProof({ ...validCleanup, realDataTouched: true }),
  /real-data boundary/,
);

test("accepts exact canonical public fixture semantics", () => {
  assert.equal(assertPublicPayload(validPublicPayload, validPublicPayload.events).eventCount, 2);
});
rejects(
  "rejects a missing exact expected public timeline",
  () => assertPublicPayload(validPublicPayload),
  /exact expected public events are required/,
);
for (const [name, eventOverride, pattern] of [
  ["rejects a private public-payload type", { stat_type: "player_in" }, /noncanonical public stat type/],
  ["rejects an unknown public-payload type", { stat_type: "future_event" }, /noncanonical public stat type/],
  ["rejects a poisoned public label", { stat_label: "Player In" }, /stat label is noncanonical/],
  ["rejects a poisoned public category", { category: "Private Legacy Alias" }, /category is noncanonical/],
  ["rejects a poisoned public point value", { point_value: 99 }, /point value is noncanonical/],
  ["rejects a poisoned public period", { period: "SHIFT" }, /period is noncanonical/],
  ["rejects a poisoned public field zone", { field_zone: "Player In at 12:34" }, /field zone is noncanonical/],
  ["rejects a noncanonical public timestamp", { occurred_at: "2026-07-28 12:00:00" }, /timestamp is noncanonical/],
]) {
  rejects(
    name,
    () => assertPublicPayload(
      {
        ...validPublicPayload,
        events: [
          { ...validPublicPayload.events[0], ...eventOverride },
          validPublicPayload.events[1],
        ],
      },
      validPublicPayload.events,
    ),
    pattern,
  );
}
for (const [name, eventOverride] of [
  ["rejects the wrong canonical period", { period: "Q2" }],
  ["rejects the wrong canonical field zone", { field_zone: "Sideline" }],
  ["rejects the wrong canonical timestamp", { occurred_at: "2026-07-28T12:00:01.000Z" }],
]) {
  rejects(
    name,
    () => assertPublicPayload(
      {
        ...validPublicPayload,
        events: [
          { ...validPublicPayload.events[0], ...eventOverride },
          validPublicPayload.events[1],
        ],
      },
      validPublicPayload.events,
    ),
    /exact expected fixture events/,
  );
}

test("accepts only explicit old private-authority rejection", () => {
  assert.equal(isOldPrivateAuthorityRejected({ status: 401, body: null }), true);
  assert.equal(isOldPrivateAuthorityRejected({
    status: 200,
    body: { outcome: "rejected", code: "unauthorized_scope" },
  }), true);
});
for (const result of [
  { status: 500, body: { message: "server failure" } },
  { status: 404, body: null },
  { status: 200, body: { outcome: "accepted", code: "clock_read" } },
  { status: 200, body: { outcome: "rejected", code: "unexpected" } },
]) {
  test(`does not treat ${result.status}/${result.body?.code || "none"} as revoked authority`, () => {
    assert.equal(isOldPrivateAuthorityRejected(result), false);
  });
}

test("participation cleanup follows game-clock order rather than insertion order", () => {
  const operations = [
    {
      player_id: "synthetic-player",
      operation_kind: "player_in",
      period: "Q1",
      game_clock_seconds: 250,
      occurred_at: "2026-07-28T12:00:00.000Z",
      client_operation_id: "in-active",
    },
  ];
  assert.equal(unresolvedParticipationStarts(operations, "quarters").length, 1);
  assert.equal(unresolvedParticipationStarts([
    ...operations,
    {
      player_id: "synthetic-player",
      operation_kind: "player_out",
      period: "Q1",
      game_clock_seconds: 600,
      occurred_at: "2026-07-28T12:01:00.000Z",
      client_operation_id: "out-wrong-clock",
    },
  ], "quarters").length, 1, "an out before the in on game time must not close the shift");
  assert.equal(unresolvedParticipationStarts([
    ...operations,
    {
      player_id: "synthetic-player",
      operation_kind: "player_out",
      period: "Q1",
      game_clock_seconds: 250,
      occurred_at: "2026-07-28T12:01:00.000Z",
      client_operation_id: "out-same-clock-later",
    },
  ], "quarters").length, 0, "same-clock later recovery must close the shift");
});

test("runner contains mandatory production guards and fail-closed cleanup", () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, "v284_production_disclosure_smoke.mjs"),
    "utf8",
  );
  assert.match(source, /--approved-tooling-sha/);
  assert.match(source, /activeTokenCount/);
  assert.match(source, /PRODUCTION CLEANUP FAILED/);
  assert.match(source, /finally\s*\{/);
  assert.match(source, /tombstoneActiveEvents/);
  assert.match(source, /closeResidualParticipation/);
  assert.match(source, /revokeTokens/);
  assert.match(source, /deleteAuthUsers/);
  assert.match(source, /removeMutableFixtureSql/);
  assert.match(source, /revokeFixtureGrantsSafelySql/);
  assert.doesNotMatch(source, /if\s*\(\s*context\.seedComplete/);
  assert.match(source, /trackedOperationCount:\s*9/);
  const halvesLegacySeed = source.indexOf("insert into public.games(", source.indexOf("productionSeedSql("));
  const halvesScopeSeed = source.indexOf("insert into public.lh_game_scopes(", halvesLegacySeed);
  assert.ok(
    halvesLegacySeed >= 0 && halvesScopeSeed > halvesLegacySeed,
    "halves clock scope must have a synthetic legacy game registration",
  );
  assert.match(source, /is_running\s*=\s*false/);
  assert.match(
    source,
    /delete from public\.lh_game_clock_states clock[\s\S]*not exists \([\s\S]*from public\.lh_participation_operations operation/i,
  );
  const revokeStart = source.indexOf("async function revokeTokens(");
  const revokeCatch = source.indexOf("} catch {", revokeStart);
  const directTokenFallback = source.indexOf("update public.lh_live_share_tokens", revokeStart);
  const neutralTokenProbe = source.indexOf('"lh_public_live_share_game"', directTokenFallback);
  assert.ok(
    revokeStart >= 0
      && revokeCatch > revokeStart
      && directTokenFallback > revokeCatch
      && neutralTokenProbe > directTokenFallback,
    "token cleanup fallback and neutral proof must survive RPC failure",
  );
  const cleanupStart = source.indexOf("async function cleanup(context)");
  const residualClose = source.indexOf("closeResidualParticipation(context)", cleanupStart);
  const clockDelete = source.indexOf("delete from public.lh_game_clock_states", cleanupStart);
  const grantRevoke = source.indexOf("revokeFixtureGrantsSafelySql(context)", cleanupStart);
  assert.ok(
    cleanupStart >= 0
      && residualClose > cleanupStart
      && clockDelete > residualClose
      && grantRevoke > clockDelete,
    "residual participation must close before clock and authority teardown",
  );
  assert.match(source, /unsupported_event_semantics/);
  assert.match(source, /invalid_public_event_evidence/);
  assert.match(source, /expectedCode/);
  assert.match(
    source,
    /item\.statType === "goal"\s*\?\s*"invalid_public_event_evidence"\s*:\s*"unsupported_event_semantics"/,
  );
  const offlineMode = source.indexOf("await trackerContext.setOffline(true)");
  const offlineGoalClick = source.indexOf("page.locator('[data-stat=\"goal\"]').click()", offlineMode);
  const offlineRetry = source.indexOf("hosted offline retry did not reconcile", offlineMode);
  const endGameJourney = source.indexOf("endGame()", offlineRetry);
  const savedModalClose = source.indexOf('[data-action="close-saved-game"]');
  const savedModalClick = source.indexOf("await savedGameModalClose.click()", savedModalClose);
  const restoreActiveGame = source.indexOf(
    "state.activeGame = state.games.find((game) => game.id === gameId)",
    savedModalClick,
  );
  const restoreLiveScreen = source.indexOf('state.screen = "live"', restoreActiveGame);
  const restoreRender = source.indexOf("render()", restoreLiveScreen);
  const formerFailureBoundary = source.indexOf("const boundaries =", restoreRender);
  assert.ok(
    offlineMode >= 0
      && offlineGoalClick > offlineMode
      && offlineRetry > offlineGoalClick
      && endGameJourney > offlineRetry
      && savedModalClose > endGameJourney
      && savedModalClick > savedModalClose
      && restoreActiveGame > savedModalClick
      && restoreLiveScreen > restoreActiveGame
      && restoreRender > restoreLiveScreen
      && formerFailureBoundary > restoreRender,
    "offline recovery must precede End Game, then modal closure, restoration, and former-failure disclosure",
  );
  assert.match(source, /Legacy Participation Alias/);
  assert.match(source, /Player In at 12:34/);
  assert.doesNotMatch(source, /supabase\s+db\s+push|migration\s+repair|functions\s+deploy/i);
});

const failures = results.filter((item) => item.status === "FAIL");
for (const item of results) {
  process.stdout.write(`${item.status} ${item.name}${item.error ? `: ${item.error}` : ""}\n`);
}
if (failures.length) {
  process.stderr.write(`FAIL ${failures.length}/${results.length} production smoke safety contracts\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS ${results.length}/${results.length} production smoke safety contracts\n`);
}
