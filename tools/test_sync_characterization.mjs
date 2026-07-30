import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const trackedSource = fs.readFileSync(
  path.join(root, "tracked-playing-time-service.js"),
  "utf8",
);
const eventOperationSource = fs.readFileSync(
  path.join(root, "event-operation-service.js"),
  "utf8",
);
const eventOperationTestSource = fs.readFileSync(
  path.join(root, "tools", "test_event_operation_service.mjs"),
  "utf8",
);
const trustSpineTestSource = fs.readFileSync(
  path.join(root, "tools", "test_trust_spine_release1.mjs"),
  "utf8",
);
const trustSpineSqlSource = fs.readFileSync(
  path.join(
    root,
    "docs",
    "methodnorth",
    "trust-spine-gate",
    "TRUST_SPINE_STAGING_TESTS.sql",
  ),
  "utf8",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractFunction(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} was not found`);
  const declarationStart =
    source.slice(Math.max(0, start - 6), start) === "async "
      ? start - 6
      : start;
  const openingParenthesis = source.indexOf("(", start);
  assert.notEqual(
    openingParenthesis,
    -1,
    `${functionName} has no parameter list`,
  );

  let parenthesisDepth = 0;
  let parameterQuote = "";
  let parameterEscaped = false;
  let closingParenthesis = -1;
  for (let index = openingParenthesis; index < source.length; index += 1) {
    const char = source[index];
    if (parameterEscaped) {
      parameterEscaped = false;
      continue;
    }
    if (parameterQuote) {
      if (char === "\\") {
        parameterEscaped = true;
      } else if (char === parameterQuote) {
        parameterQuote = "";
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      parameterQuote = char;
      continue;
    }
    if (char === "(") parenthesisDepth += 1;
    if (char === ")") {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        closingParenthesis = index;
        break;
      }
    }
  }
  assert.notEqual(
    closingParenthesis,
    -1,
    `${functionName} parameter list did not terminate`,
  );
  const openingBrace = source.indexOf("{", closingParenthesis);
  assert.notEqual(openingBrace, -1, `${functionName} has no body`);

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = openingBrace; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(declarationStart, index + 1);
    }
  }
  throw new Error(`${functionName} body did not terminate`);
}

function appHarness(functionNames, globals = {}) {
  const context = vm.createContext({
    Date,
    Math,
    Map,
    Set,
    WeakMap,
    Promise,
    URL,
    console: {
      log() {},
      warn() {},
      error() {},
    },
    ...globals,
  });
  const definitions = functionNames
    .map((name) => extractFunction(appSource, name))
    .join("\n");
  vm.runInContext(definitions, context, {
    filename: `app.js#${functionNames.join(",")}`,
  });
  return {
    context,
    get(name) {
      return vm.runInContext(name, context);
    },
  };
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

function trackedPlayingTimeApi() {
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
  vm.runInContext(trackedSource, context, {
    filename: "tracked-playing-time-service.js",
  });
  return context.window.LaxHornetTrackedPlayingTime;
}

function eventOperationApi() {
  const context = vm.createContext({
    window: {},
    Date,
    Math,
    Number,
    Object,
    String,
    TypeError,
    Promise,
  });
  vm.runInContext(eventOperationSource, context, {
    filename: "event-operation-service.js",
  });
  return context.window.LaxHornetEventOperations;
}

function mapperHarness() {
  const state = {
    activeGame: null,
    games: [],
    sharedGame: null,
    deletedEventIds: [],
    deletedGameIds: [],
  };
  const harness = appHarness(
    [
      "normalizeEvent",
      "normalizeGame",
      "gameToSupabaseRow",
      "eventToSupabaseRow",
      "eventFromSupabaseRow",
      "cloudProjectionMetadataForRow",
      "gameFromSupabaseRow",
      "cloudGameMergePolicy",
      "cloudEventMergePolicy",
      "hydrationTimestamp",
      "cloudConflictFieldsAreCurrent",
      "hydrationValueIsMissing",
      "mergeHydratedEvent",
      "mergeHydratedGame",
      "mergeGames",
    ],
    {
      state,
      DEFAULT_PLAYER: {
        id: "",
        name: "Synthetic Player",
        number: "",
        team: "",
        position: "",
        notes: "",
      },
      STAT_BY_KEY: {
        goal: {
          key: "goal",
          label: "Goal",
          points: 5,
          category: "Scoring",
        },
      },
      PERIOD_FORMATS: {
        quarters: {
          periods: ["Q1", "Q2", "Q3", "Q4", "OT"],
          start: "Q1",
        },
        halves: {
          periods: ["H1", "H2", "OT"],
          start: "H1",
        },
      },
      periodFormatForGame: (game = {}) =>
        game.periodFormat || game.period_format || "quarters",
      normalizePlayer: (player = {}) => ({
        ...(player && typeof player === "object" ? player : {}),
        id: player?.id || "",
        name: player?.name || "Synthetic Player",
        teamId: player?.teamId || player?.team_id || "",
        rosterPlayerId:
          player?.rosterPlayerId || player?.roster_player_id || "",
      }),
      gameScopeType: () => "personal",
      optionalScoreNumber: (value) => {
        if (value === undefined || value === null || value === "") return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      },
      uniqueTags: (tags = []) => [...new Set(Array.isArray(tags) ? tags : [])],
      scoreStateForMargin: (margin) =>
        margin === null
          ? "unknown"
          : margin > 0
            ? "leading"
            : margin < 0
              ? "trailing"
              : "tied",
      gameSegmentForPeriod: (period) =>
        ["Q1", "Q2", "H1"].includes(period) ? "first_half" : "second_half",
      uid: (prefix) => `${prefix}-generated`,
      makeShareCode: () => "SYNTHETIC",
      isDeletedEvent: (eventId) => state.deletedEventIds.includes(eventId),
      isDeletedGame: (gameId) => state.deletedGameIds.includes(gameId),
      canShowGameForCurrentAccess: () => true,
      currentUserId: () => "synthetic-account",
      cloudGameHydrationMetadata: new WeakMap(),
    },
  );
  return {
    state,
    normalizeGame: harness.get("normalizeGame"),
    gameToSupabaseRow: harness.get("gameToSupabaseRow"),
    eventToSupabaseRow: harness.get("eventToSupabaseRow"),
    eventFromSupabaseRow: harness.get("eventFromSupabaseRow"),
    gameFromSupabaseRow: harness.get("gameFromSupabaseRow"),
    cloudGameMergePolicy: harness.get("cloudGameMergePolicy"),
    cloudEventMergePolicy: harness.get("cloudEventMergePolicy"),
    mergeGames: harness.get("mergeGames"),
  };
}

function richerLocalGame() {
  return {
    id: "synthetic-game-same-id",
    userId: "synthetic-account",
    playerId: "synthetic-player",
    opponent: "Synthetic Opponent",
    date: "2026-07-30",
    location: "Device-only field",
    gameType: "scrimmage",
    currentQuarter: "Q3",
    status: "complete",
    scoreFor: 7,
    scoreAgainst: 5,
    scoreTrackingTouched: true,
    finalScoreFor: 7,
    finalScoreAgainst: 5,
    savedAt: "2026-07-30T15:30:00.000Z",
    localOnlyMetadata: {
      recoverySource: "synthetic-local-backup",
      captureDevice: "synthetic-device-a",
    },
    pendingLegacyOperation: {
      kind: "game_write",
      state: "pending",
    },
    trackedPlayingTime: {
      version: 1,
      clockState: {
        gameId: "synthetic-game-same-id",
        currentPeriod: "Q3",
        clockSecondsRemaining: 412,
        isRunning: false,
        revision: 4,
      },
      participationOperations: [
        {
          operationId: "synthetic-participation-operation",
          clientOperationId: "synthetic-participation-client-operation",
          logicalEventId: "synthetic-shift",
          syncState: "pending",
        },
      ],
      remoteEffectiveParticipation: [],
    },
    events: [
      {
        id: "synthetic-event-same-id",
        gameId: "synthetic-game-same-id",
        timestamp: "2026-07-30T15:00:00.000Z",
        quarter: "Q3",
        statType: "goal",
        statLabel: "Goal",
        category: "Scoring",
        pointValue: 5,
        tags: ["synthetic"],
        note: "Synthetic fixture",
        fieldZone: "offensive_end",
        scoreForAtEvent: 7,
        scoreAgainstAtEvent: 5,
        scoreStateAtEvent: "leading",
        gameSegmentAtEvent: "second_half",
        scoreAutoIncrement: "for",
        scoreForBeforeEvent: 6,
        scoreAgainstBeforeEvent: 5,
      },
    ],
  };
}

function poorerCloudRow(overrides = {}) {
  return {
    id: "synthetic-game-same-id",
    user_id: "synthetic-account",
    player_id: "synthetic-player",
    share_code: "CLOUD01",
    is_shared: false,
    opponent: "Synthetic Opponent",
    game_date: "2026-07-30",
    location: "Cloud field",
    game_type: "scrimmage",
    period_format: "quarters",
    player_snapshot: {
      id: "synthetic-player",
      name: "Synthetic Player",
    },
    current_quarter: "Q2",
    status: "in-progress",
    created_at: "2026-07-30T14:00:00.000Z",
    saved_at: "2026-07-30T14:30:00.000Z",
    ended_at: null,
    events: [
      {
        id: "synthetic-event-same-id",
        game_id: "synthetic-game-same-id",
        user_id: "synthetic-account",
        timestamp: "2026-07-30T15:00:00.000Z",
        quarter: "Q3",
        stat_type: "goal",
        stat_label: "Goal",
        category: "Scoring",
        point_value: 5,
        tags: ["synthetic"],
        note: "Synthetic fixture",
        field_zone: "offensive_end",
      },
    ],
    ...overrides,
  };
}

test("R2-03: ownership policy is explicit for games and events", () => {
  const mapper = mapperHarness();
  const gamePolicy = mapper.cloudGameMergePolicy();
  const eventPolicy = mapper.cloudEventMergePolicy();

  assert.deepEqual(Array.from(gamePolicy.identity), ["id"]);
  assert.ok(gamePolicy.cloudAuthoritative.includes("shareCode"));
  assert.ok(gamePolicy.localAuthoritative.includes("trackedPlayingTime"));
  assert.ok(gamePolicy.merged.includes("events"));
  assert.ok(gamePolicy.conflictSensitive.includes("status"));
  assert.equal(gamePolicy.preserveIfOmitted, true);

  assert.deepEqual(Array.from(eventPolicy.identity), ["id", "gameId"]);
  assert.ok(eventPolicy.cloudAuthoritative.includes("teamId"));
  assert.ok(eventPolicy.localAuthoritative.includes("scoreForAtEvent"));
  assert.ok(eventPolicy.conflictSensitive.includes("statType"));
  assert.equal(eventPolicy.preserveIfOmitted, true);
});

test("R2-03: richer local game survives poorer same-ID cloud hydration", () => {
  const mapper = mapperHarness();
  const local = mapper.normalizeGame(richerLocalGame());
  const row = poorerCloudRow();
  const cloud = mapper.gameFromSupabaseRow(row, row.events);
  const [merged] = mapper.mergeGames([local], [cloud]);

  assert.equal(merged.id, local.id);
  assert.equal(merged.status, "complete");
  assert.equal(merged.currentQuarter, "Q3");
  assert.equal(merged.location, "Device-only field");
  assert.equal(merged.scoreFor, 7);
  assert.equal(merged.scoreAgainst, 5);
  assert.equal(merged.scoreTrackingTouched, true);
  assert.equal(merged.finalScoreFor, 7);
  assert.equal(merged.finalScoreAgainst, 5);
  assert.deepEqual(merged.localOnlyMetadata, local.localOnlyMetadata);
  assert.deepEqual(merged.pendingLegacyOperation, local.pendingLegacyOperation);
});

test("R2-03: tracked playing-time state and pending operations survive hydration", () => {
  const mapper = mapperHarness();
  const local = mapper.normalizeGame(richerLocalGame());
  const row = poorerCloudRow();
  const [merged] = mapper.mergeGames(
    [local],
    [mapper.gameFromSupabaseRow(row, row.events)],
  );

  assert.deepEqual(merged.trackedPlayingTime, local.trackedPlayingTime);
  assert.equal(merged.trackedPlayingTime.clockState.revision, 4);
  assert.equal(
    merged.trackedPlayingTime.participationOperations[0].syncState,
    "pending",
  );
});

test("R2-03: same-ID events merge without losing score context or local metadata", () => {
  const mapper = mapperHarness();
  const localFixture = richerLocalGame();
  localFixture.events[0].localEventMetadata = {
    recoverySource: "synthetic-event-backup",
  };
  const local = mapper.normalizeGame(localFixture);
  const row = poorerCloudRow({
    saved_at: "2026-07-30T16:30:00.000Z",
    events: [
      {
        ...poorerCloudRow().events[0],
        stat_label: "Cloud-corrected goal",
        note: "Cloud-known update",
      },
    ],
  });
  const [merged] = mapper.mergeGames(
    [local],
    [mapper.gameFromSupabaseRow(row, row.events)],
  );

  assert.equal(merged.events.length, 1);
  const [event] = merged.events;
  assert.equal(event.statLabel, "Cloud-corrected goal");
  assert.equal(event.note, "Cloud-known update");
  assert.equal(event.scoreForAtEvent, 7);
  assert.equal(event.scoreAgainstAtEvent, 5);
  assert.equal(event.scoreMarginAtEvent, 2);
  assert.equal(event.scoreStateAtEvent, "leading");
  assert.equal(event.scoreAutoIncrement, "for");
  assert.equal(event.scoreForBeforeEvent, 6);
  assert.equal(event.scoreAgainstBeforeEvent, 5);
  assert.deepEqual(event.localEventMetadata, {
    recoverySource: "synthetic-event-backup",
  });
});

test("R2-03: omitted cloud fields do not delete local game or event fields", () => {
  const mapper = mapperHarness();
  const local = mapper.normalizeGame(richerLocalGame());
  const partialRow = {
    id: local.id,
    user_id: "synthetic-account",
    share_code: "PARTIAL",
    is_shared: true,
    events: [
      {
        id: local.events[0].id,
        game_id: local.id,
        user_id: "synthetic-account",
        note: "Only this cloud field was projected",
      },
    ],
  };
  const [merged] = mapper.mergeGames(
    [local],
    [mapper.gameFromSupabaseRow(partialRow, partialRow.events)],
  );

  assert.equal(merged.shareCode, "PARTIAL");
  assert.equal(merged.isShared, true);
  assert.equal(merged.status, "complete");
  assert.equal(merged.location, "Device-only field");
  assert.equal(merged.events[0].note, "Synthetic fixture");
  assert.equal(merged.events[0].statType, "goal");
  assert.equal(merged.events[0].scoreForAtEvent, 7);
});

test("R2-03: newer local conflict-sensitive values defeat older cloud values", () => {
  const mapper = mapperHarness();
  const local = mapper.normalizeGame(richerLocalGame());
  const row = poorerCloudRow();
  const [merged] = mapper.mergeGames(
    [local],
    [mapper.gameFromSupabaseRow(row, row.events)],
  );

  assert.equal(merged.savedAt, local.savedAt);
  assert.equal(merged.status, "complete");
  assert.equal(merged.currentQuarter, "Q3");
  assert.equal(merged.location, "Device-only field");
});

test("R2-03: newer cloud conflict-sensitive values update while local-only evidence survives", () => {
  const mapper = mapperHarness();
  const local = mapper.normalizeGame(richerLocalGame());
  const row = poorerCloudRow({
    status: "complete",
    current_quarter: "Q4",
    location: "Newer cloud location",
    saved_at: "2026-07-30T16:30:00.000Z",
  });
  const [merged] = mapper.mergeGames(
    [local],
    [mapper.gameFromSupabaseRow(row, row.events)],
  );

  assert.equal(merged.savedAt, "2026-07-30T16:30:00.000Z");
  assert.equal(merged.status, "complete");
  assert.equal(merged.currentQuarter, "Q4");
  assert.equal(merged.location, "Newer cloud location");
  assert.equal(merged.scoreFor, 7);
  assert.deepEqual(merged.trackedPlayingTime, local.trackedPlayingTime);
});

test("R2-03: cloud-only games are added", () => {
  const mapper = mapperHarness();
  const row = poorerCloudRow({
    id: "synthetic-cloud-only-game",
    events: [],
  });
  const [merged] = mapper.mergeGames(
    [],
    [mapper.gameFromSupabaseRow(row, row.events)],
  );
  assert.equal(merged.id, "synthetic-cloud-only-game");
  assert.equal(merged.location, "Cloud field");
});

test("R2-03: repeated same-ID game and event payloads do not create duplicates", () => {
  const mapper = mapperHarness();
  const local = mapper.normalizeGame(richerLocalGame());
  const row = poorerCloudRow({
    saved_at: "2026-07-30T16:30:00.000Z",
  });
  const cloud = mapper.gameFromSupabaseRow(row, [
    row.events[0],
    { ...row.events[0] },
  ]);
  const games = mapper.mergeGames([local], [cloud, cloud]);

  assert.equal(games.length, 1);
  assert.equal(games[0].events.length, 1);
});

test("R2-03: active game is the same-ID hydration base and remains unmodified", () => {
  const mapper = mapperHarness();
  const active = mapper.normalizeGame({
    ...richerLocalGame(),
    scoreFor: 9,
    savedAt: "2026-07-30T17:00:00.000Z",
  });
  const activeBefore = clone(active);
  const staleSaved = mapper.normalizeGame({
    ...richerLocalGame(),
    scoreFor: 2,
    savedAt: "2026-07-30T14:00:00.000Z",
  });
  const row = poorerCloudRow();
  const [merged] = mapper.mergeGames(
    [staleSaved],
    [mapper.gameFromSupabaseRow(row, row.events)],
    { activeGame: active },
  );

  assert.equal(merged.scoreFor, 9);
  assert.deepEqual(clone(active), activeBefore);
});

test(
  "R2-03: legacy outbound projections stay lossy while hydration merge is lossless",
  () => {
    const mapper = mapperHarness();
    const local = mapper.normalizeGame(richerLocalGame());
    mapper.state.games = [local];

    const gameRow = mapper.gameToSupabaseRow(local);
    const eventRow = mapper.eventToSupabaseRow(local.events[0]);

    const gameCloudFields = [
      "id",
      "player_id",
      "user_id",
      "opponent",
      "game_date",
      "location",
      "game_type",
      "period_format",
      "current_quarter",
      "status",
      "saved_at",
    ];
    for (const field of gameCloudFields) {
      assert.ok(Object.hasOwn(gameRow, field), `game cloud field ${field}`);
    }
    for (const omittedField of [
      "score_for",
      "score_against",
      "score_tracking_touched",
      "final_score_for",
      "final_score_against",
      "tracked_playing_time",
      "pending_operation",
      "local_only_metadata",
    ]) {
      assert.equal(
        Object.hasOwn(gameRow, omittedField),
        false,
        `game projection omits ${omittedField}`,
      );
    }

    const eventCloudFields = [
      "id",
      "game_id",
      "timestamp",
      "quarter",
      "stat_type",
      "stat_label",
      "category",
      "point_value",
      "tags",
      "note",
      "field_zone",
    ];
    for (const field of eventCloudFields) {
      assert.ok(Object.hasOwn(eventRow, field), `event cloud field ${field}`);
    }
    for (const omittedField of [
      "score_for_at_event",
      "score_against_at_event",
      "score_state_at_event",
      "score_auto_increment",
      "score_for_before_event",
      "score_against_before_event",
    ]) {
      assert.equal(
        Object.hasOwn(eventRow, omittedField),
        false,
        `event projection omits ${omittedField}`,
      );
    }

    const row = poorerCloudRow();
    const projected = mapper.gameFromSupabaseRow(row, row.events);
    const [hydrated] = mapper.mergeGames([local], [projected]);
    assert.equal(hydrated.scoreFor, 7);
    assert.deepEqual(hydrated.trackedPlayingTime, local.trackedPlayingTime);
    assert.equal(hydrated.events[0].scoreForAtEvent, 7);
  },
);

function loadCloudGamesHarness(initialGames = [], options = {}) {
  const requests = [];
  const mapper = mapperHarness();
  const state = {
    games: clone(initialGames),
    activeGame: options.activeGame ? clone(options.activeGame) : null,
    players: [],
    activePlayerId: "",
    reviewGameId: null,
    player: {
      id: "synthetic-player",
    },
    syncStatus: "",
  };
  const supabaseClient = {
    from(table) {
      assert.equal(table, "games");
      const request = deferred();
      requests.push(request);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        order() {
          return request.promise;
        },
      };
    },
  };
  let persistCount = 0;
  let currentAccountId = options.accountId || "synthetic-account";
  const harness = appHarness(
    ["cloudGameHydrationIsCurrent", "loadCloudGames"],
    {
    state,
    supabaseClient,
    cloudGameHydrationGeneration: 0,
    currentUserId: () => currentAccountId,
    loadCloudTeams: async () => [],
    flushDeletedCloudRecords: async () => {},
    syncLocalGamesToCloud: async () => 0,
    processDurableSyncOperations: async () => false,
    durableSyncStatus: () => "",
    teamIds: () => [],
    gameFromSupabaseRow: mapper.gameFromSupabaseRow,
    canShowGameForCurrentAccess: () => true,
    mergeGames: mapper.mergeGames,
    mergePlayersFromGames: () => {},
    isDeletedGame: () => false,
    gamePlayerId: (game) => game.player_id || game.playerId || "",
    syncActivePlayer: () => {},
    persistAll: () => {
      persistCount += 1;
    },
    render: () => {},
    showToast: () => {},
    playerTitle: () => "Synthetic Player",
    reportSyncError: (error) => {
      throw error;
    },
    },
  );
  return {
    state,
    requests,
    get persistCount() {
      return persistCount;
    },
    setAccountId(accountId) {
      currentAccountId = accountId;
    },
    loadCloudGames: harness.get("loadCloudGames"),
  };
}

test(
  "R2-03: older overlapping cloud load cannot regress a newer accepted response",
  async () => {
    const harness = loadCloudGamesHarness([
      {
        id: "synthetic-overlap-game",
        userId: "synthetic-account",
        status: "in-progress",
        savedAt: "2026-07-30T14:00:00.000Z",
        events: [],
      },
    ]);

    const requestA = harness.loadCloudGames({ silent: true });
    await waitFor(() => harness.requests.length === 1, "request A did not start");
    const requestB = harness.loadCloudGames({ silent: true });
    await waitFor(() => harness.requests.length === 2, "request B did not start");

    harness.requests[1].resolve({
      data: [
        {
          id: "synthetic-overlap-game",
          user_id: "synthetic-account",
          status: "complete",
          saved_at: "2026-07-30T16:00:00.000Z",
          game_date: "2026-07-30",
          events: [],
        },
      ],
      error: null,
    });
    await requestB;
    assert.equal(
      harness.state.games[0].status,
      "complete",
      "request B applies first",
    );

    harness.requests[0].resolve({
      data: [
        {
          id: "synthetic-overlap-game",
          user_id: "synthetic-account",
          status: "in-progress",
          saved_at: "2026-07-30T15:00:00.000Z",
          game_date: "2026-07-29",
          events: [],
        },
      ],
      error: null,
    });
    await requestA;
    assert.equal(
      harness.state.games[0].status,
      "complete",
      "request A is ignored after request B becomes the current generation",
    );
    assert.equal(harness.persistCount, 1);
  },
);

test("R2-03: a later legitimate request C becomes the accepted generation", async () => {
  const harness = loadCloudGamesHarness([]);
  const requestA = harness.loadCloudGames({ silent: true });
  await waitFor(() => harness.requests.length === 1, "request A did not start");
  const requestB = harness.loadCloudGames({ silent: true });
  await waitFor(() => harness.requests.length === 2, "request B did not start");

  harness.requests[1].resolve({ data: [], error: null });
  await requestB;
  harness.requests[0].resolve({ data: [], error: null });
  await requestA;

  const requestC = harness.loadCloudGames({ silent: true });
  await waitFor(() => harness.requests.length === 3, "request C did not start");
  harness.requests[2].resolve({
    data: [
      {
        id: "synthetic-request-c-game",
        user_id: "synthetic-account",
        game_date: "2026-07-30",
        saved_at: "2026-07-30T17:00:00.000Z",
        events: [],
      },
    ],
    error: null,
  });
  await requestC;

  assert.deepEqual(
    Array.from(harness.state.games, (game) => game.id),
    ["synthetic-request-c-game"],
  );
  assert.equal(harness.persistCount, 2);
});

test("R2-03: a response from the prior account cannot hydrate the new namespace", async () => {
  const harness = loadCloudGamesHarness([]);
  const request = harness.loadCloudGames({ silent: true });
  await waitFor(() => harness.requests.length === 1, "account request did not start");
  harness.setAccountId("synthetic-other-account");
  harness.requests[0].resolve({
    data: [
      {
        id: "synthetic-prior-account-game",
        user_id: "synthetic-account",
        game_date: "2026-07-30",
        events: [],
      },
    ],
    error: null,
  });
  await request;

  assert.equal(harness.state.games.length, 0);
  assert.equal(harness.persistCount, 0);
});

test(
  "CHARACTERIZATION: stale device uploads a legacy game and event before learning of deletion",
  async () => {
    const cloud = new Map();
    const staleGame = {
      id: "synthetic-deleted-game",
      userId: "synthetic-account",
      events: [
        {
          id: "synthetic-deleted-event",
          gameId: "synthetic-deleted-game",
        },
      ],
    };
    const state = {
      games: [clone(staleGame)],
      activeGame: null,
      deletedGameIds: [],
      deletedEventIds: [],
    };
    const harness = appHarness(["syncLocalGamesToCloud"], {
      state,
      supabaseClient: {},
      currentUserId: () => "synthetic-account",
      isDeletedGame: (gameId) => state.deletedGameIds.includes(gameId),
      gameTeamId: () => "",
      canEditGame: () => true,
      normalizeGame: (game) => clone(game),
      reconcileGameEventOperations: async (game) => {
        cloud.set(game.id, clone(game));
        return true;
      },
    });

    const uploaded = await harness.get("syncLocalGamesToCloud")();
    assert.equal(uploaded, 1);
    assert.equal(cloud.has("synthetic-deleted-game"), true);
    assert.equal(
      cloud.get("synthetic-deleted-game").events[0].id,
      "synthetic-deleted-event",
    );
  },
);

test(
  "CHARACTERIZATION: RLS-invisible legacy event delete clears a device marker as if absent",
  async () => {
    const state = {
      deletedGameIds: [],
      deletedEventIds: ["synthetic-rls-hidden-event"],
      cloudError: "",
      syncStatus: "Sync needs attention",
    };
    const supabaseClient = {
      async rpc() {
        return {
          data: null,
          error: {
            code: "PGRST202",
            message: "Could not find the function laxhornet_delete_event",
          },
        };
      },
      from(table) {
        assert.equal(table, "events");
        return {
          delete() {
            return {
              eq() {
                return {
                  async select() {
                    return { data: [], error: null };
                  },
                };
              },
            };
          },
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    // This null is deliberately indistinguishable from an RLS-hidden row.
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
    const harness = appHarness(
      [
        "supabaseErrorText",
        "readableSupabaseError",
        "isCloudDeleteNotFoundError",
        "cloudDeleteErrorIsResolved",
        "clearResolvedCloudDeleteError",
        "cloudRecordStillVisible",
        "isMissingRpcError",
        "forgetDeletedEvent",
        "deleteSupabaseEvent",
      ],
      {
        state,
        supabaseClient,
        uniqueIds: (values = []) => [...new Set(values.filter(Boolean))],
        reportCloudDeleteError: () => assert.fail("unexpected delete error"),
        reportCloudDeleteNeedsUpdate: () =>
          assert.fail("hidden row was unexpectedly treated as visible"),
      },
    );

    const deleted = await harness.get("deleteSupabaseEvent")(
      "synthetic-rls-hidden-event",
    );
    assert.equal(deleted, true);
    assert.deepEqual(state.deletedEventIds, []);
  },
);

test(
  "R2-04: failed tracked-clock writes keep local clock state and use the separate durable queue",
  async () => {
    const api = trackedPlayingTimeApi();
    const persisted = [];
    let sendAttempts = 0;
    const game = {
      id: "synthetic-clock-game",
    };
    const baseNow = Date.parse("2026-07-30T16:00:00.000Z");
    const clock = api.createClockState(
      {
        gameId: game.id,
        playerId: "synthetic-player",
        periodFormat: "quarters",
        regulationPeriodDurationSeconds: 720,
        overtimeDurationSeconds: 240,
      },
      baseNow,
    );
    const service = api.createTrackedPlayingTimeService({
      persistLocal: () => persisted.push(clone(game)),
      sendClock: async () => {
        sendAttempts += 1;
        throw new Error("synthetic network failure");
      },
      sendOperations: async () => ({ outcome: "accepted", results: [] }),
      readEffectiveOperations: async () => ({
        outcome: "accepted",
        operations: [],
      }),
      canUseCloud: () => true,
      reportError: () => {},
    });

    const result = service.updateClock({
      game,
      clockState: {
        ...clock,
        clockSecondsRemaining: 600,
        revision: 3,
      },
      baseRevision: 2,
    });
    assert.equal(await result.cloudPromise, false);
    assert.equal(sendAttempts, 1);
    assert.equal(persisted.at(-1).trackedPlayingTime.clockState.revision, 3);
    assert.equal(
      Object.hasOwn(
        persisted.at(-1).trackedPlayingTime,
        "pendingClockOperations",
      ),
      false,
    );

    const reloaded = clone(persisted.at(-1));
    assert.equal(reloaded.trackedPlayingTime.clockState.revision, 3);
    assert.match(appSource, /syncOperations:\s*"laxhornet\.syncOperations\.v1"/);
    assert.match(appSource, /sendClock:\s*syncTrackedClockPayload/);
    assert.match(appSource, /canQueueClock:/);
  },
);

function legacyErrorClassification(error) {
  const state = {
    syncStatus: "",
    cloudError: "",
  };
  const toasts = [];
  const harness = appHarness(
    [
      "supabaseErrorText",
      "readableSupabaseError",
      "isTeamSetupError",
      "reportTeamSetupError",
      "reportSyncError",
    ],
    {
      state,
      lastSyncErrorAt: 0,
      showToast: (message) => toasts.push(message),
      render: () => {},
    },
  );
  harness.get("reportSyncError")(error);
  return {
    syncStatus: state.syncStatus,
    cloudError: state.cloudError,
    toast: toasts.at(-1) || "",
  };
}

test(
  "CHARACTERIZATION: legacy sync error outputs do not provide a durable authorization taxonomy",
  () => {
    const cases = [
      {
        kind: "network",
        error: { message: "Failed to fetch" },
        expectedStatus: "Live Share needs setup",
        expectedDurableCode: "",
      },
      {
        kind: "expired-auth",
        error: { message: "JWT expired" },
        expectedStatus: "Live Share needs setup",
        expectedDurableCode: "",
      },
      {
        kind: "rls-denial",
        error: {
          code: "42501",
          message: "new row violates row-level security policy for table games",
        },
        expectedStatus: "Team setup needs attention",
        expectedDurableCode: "",
      },
      {
        kind: "rpc-validation",
        error: { code: "22023", message: "invalid event payload" },
        expectedStatus: "Live Share needs setup",
        expectedDurableCode: "",
      },
      {
        kind: "capability-loss",
        error: {
          code: "PGRST202",
          message: "Could not find the function lh_update_game_clock in schema cache",
        },
        expectedStatus: "Team setup needs attention",
        expectedDurableCode: "",
      },
      {
        kind: "membership-loss",
        error: {
          code: "42501",
          message: "permission denied for relation games",
        },
        expectedStatus: "Team setup needs attention",
        expectedDurableCode: "",
      },
    ];

    for (const scenario of cases) {
      const result = legacyErrorClassification(scenario.error);
      assert.equal(
        result.syncStatus,
        scenario.expectedStatus,
        scenario.kind,
      );
      assert.equal(
        Object.hasOwn(result, "retryability"),
        false,
        `${scenario.kind} has no retryability`,
      );
      assert.equal(
        Object.hasOwn(result, "authorizationState"),
        false,
        `${scenario.kind} has no authorization state`,
      );
      assert.equal(scenario.expectedDurableCode, "");
    }

    const persistBody = extractFunction(appSource, "persistAll");
    assert.doesNotMatch(persistBody, /syncStatus|cloudError/);
  },
);

function trustSpineRecordAndOperation() {
  const operation = {
    kind: "correct",
    clientOperationId: "synthetic-trust-operation",
    clientCreatedAt: "2026-07-30T17:00:00.000Z",
    attempts: 0,
    lastAttemptAt: "",
    lastError: "",
    eventEvidence: {
      statLabel: "Synthetic correction",
    },
    rpcPayload: {
      client_operation_id: "synthetic-trust-operation",
      event_id: "synthetic-trust-event",
      game_id: "synthetic-trust-game",
      base_server_event_version: 1,
      changes: {
        stat_label: "Synthetic correction",
      },
    },
  };
  const record = {
    gameId: "synthetic-trust-game",
    eventId: "synthetic-trust-event",
    serverEventVersion: 1,
    lifecycleState: "active",
    acceptedEvidence: {
      statLabel: "Original synthetic label",
    },
    pendingOperations: [operation],
    acceptedReceipts: [],
    conflict: null,
    lastError: "",
    updatedAt: "",
  };
  return { record, operation };
}

async function processTrustSpineOutcome(rpcResult) {
  const { record, operation } = trustSpineRecordAndOperation();
  const harness = appHarness(
    [
      "trustSpineRpcForOperation",
      "trustSpinePayloadForOperation",
      "acceptTrustSpineOperation",
      "processTrustSpineOperation",
    ],
    {
      supabaseClient: {
        async rpc() {
          return clone(rpcResult);
        },
      },
      trustSpineAttemptedReplayOperation: () => false,
      canonicalEventEvidenceForGame: () => true,
      trustSpineGameById: () => ({
        id: "synthetic-trust-game",
      }),
      suppressPrivateTrustSpineRecord: () => {},
      trustSpineRecordCanonicalSemantic: () => true,
      readableSupabaseError: (error) =>
        [error?.message, error?.code].filter(Boolean).join(" "),
    },
  );
  const result = await harness.get("processTrustSpineOperation")(
    record,
    operation,
  );
  return { result, record, operation };
}

test(
  "CHARACTERIZATION: Trust Spine transport failures retain pending work but rejected outcomes remove it",
  async () => {
    const network = await processTrustSpineOutcome({
      data: null,
      error: {
        message: "Failed to fetch",
      },
    });
    assert.equal(network.result, false);
    assert.equal(network.record.pendingOperations.length, 1);
    assert.match(network.record.lastError, /Failed to fetch/);

    for (const code of [
      "not_authorized",
      "invalid_input",
      "capability_unavailable",
      "membership_required",
    ]) {
      const rejected = await processTrustSpineOutcome({
        data: {
          outcome: "rejected",
          code,
          serverEventVersion: 1,
        },
        error: null,
      });
      assert.equal(rejected.result, false, code);
      assert.equal(rejected.record.pendingOperations.length, 0, code);
      assert.equal(rejected.record.lastError, code, code);
      assert.equal(
        rejected.record.acceptedEvidence.statLabel,
        "Original synthetic label",
        `${code} retains accepted evidence but not the unresolved operation`,
      );
    }

    const conflicted = await processTrustSpineOutcome({
      data: {
        outcome: "conflicted",
        code: "same_field_conflict",
        serverEventVersion: 2,
      },
      error: null,
    });
    assert.equal(conflicted.record.pendingOperations.length, 0);
    assert.equal(conflicted.record.conflict.code, "same_field_conflict");
  },
);

test(
  "CHARACTERIZATION: participation rejections remain pending without stored server classification",
  async () => {
    const api = trackedPlayingTimeApi();
    const reported = [];
    const game = {
      id: "synthetic-participation-game",
      trackedPlayingTime: {
        version: 1,
        participationOperations: [
          {
            operationId: "synthetic-participation-op",
            clientOperationId: "synthetic-participation-client-op",
            logicalEventId: "synthetic-participation-logical",
            gameId: "synthetic-participation-game",
            playerId: "synthetic-player",
            operationKind: "player_in",
            period: "Q1",
            gameClockSeconds: 600,
            occurredAt: "2026-07-30T17:00:00.000Z",
            clientCreatedAt: "2026-07-30T17:00:00.000Z",
            source: "live",
            syncState: "pending",
          },
        ],
      },
    };
    const service = api.createTrackedPlayingTimeService({
      persistLocal: () => {},
      sendClock: async () => ({ outcome: "accepted" }),
      sendOperations: async () => ({
        outcome: "accepted",
        results: [
          {
            outcome: "rejected",
            code: "not_authorized",
            clientOperationId: "synthetic-participation-client-op",
          },
        ],
      }),
      readEffectiveOperations: async () => ({
        outcome: "accepted",
        operations: [],
      }),
      canUseCloud: () => true,
      reportError: (error) => reported.push(error),
    });

    assert.equal(await service.retryParticipationOperations(game), false);
    const [operation] = game.trackedPlayingTime.participationOperations;
    assert.equal(operation.syncState, "pending");
    assert.equal(Object.hasOwn(operation, "lastError"), false);
    assert.equal(Object.hasOwn(operation, "serverCode"), false);
    assert.deepEqual(reported, []);
  },
);

function syncGameHarness(upsertWithOptionalColumns) {
  const state = {
    isOffline: false,
    syncStatus: "",
  };
  const reported = [];
  let queuedPayload = null;
  let accepted = false;
  const harness = appHarness(["syncGameToSupabase"], {
    state,
    supabaseClient: {},
    isDeletedGame: () => false,
    currentUserId: () => "synthetic-account",
    queueLegacyGameOperation: (game) => {
      queuedPayload = { gameRow: clone(game) };
      return {
        operationId: "synthetic-game-operation",
        alreadyAccepted: false,
        game: clone(game),
        payload: queuedPayload,
      };
    },
    processDurableSyncOperations: async () => {
      const result = await upsertWithOptionalColumns("games", queuedPayload.gameRow);
      accepted = !result.error;
      if (result.error) reported.push(result.error);
      return accepted;
    },
    durableSyncService: () => ({
      isAcknowledged: () => accepted,
    }),
    durableSyncStatus: () => "",
    syncLegacyGameEvents: async (game) => {
      const result = await upsertWithOptionalColumns("events", game.events);
      if (result.error) {
        reported.push(result.error);
        return false;
      }
      return true;
    },
    window: {
      LaxHornetDurableSyncOperations: {
        OPERATION_TYPES: {
          game: "legacy_game_write",
        },
      },
    },
  });
  return {
    state,
    reported,
    syncGameToSupabase: harness.get("syncGameToSupabase"),
  };
}

test(
  "R2-03: integrated loadCloudGames hydration preserves richer local evidence after partial sync",
  async () => {
    const calls = [];
    const local = richerLocalGame();
    const syncHarness = syncGameHarness(async (table) => {
      calls.push(table);
      if (table === "games") return { error: null, skipped: [] };
      return {
        error: {
          code: "42501",
          message: "synthetic event write rejected",
        },
        skipped: [],
      };
    });

    assert.equal(
      await syncHarness.syncGameToSupabase(local, { includeEvents: true }),
      false,
    );
    assert.deepEqual(calls, ["games", "events"]);
    assert.equal(local.events.length, 1, "local event exists before hydration");

    const loadHarness = loadCloudGamesHarness([local]);
    const hydration = loadHarness.loadCloudGames({ silent: true });
    await waitFor(
      () => loadHarness.requests.length === 1,
      "hydration request did not start",
    );
    loadHarness.requests[0].resolve({
      data: [
        {
          id: local.id,
          user_id: "synthetic-account",
          game_date: local.date,
          status: "in-progress",
          events: [],
        },
      ],
      error: null,
    });
    await hydration;

    assert.equal(loadHarness.state.games[0].id, local.id);
    assert.equal(loadHarness.state.games[0].events.length, 1);
    assert.deepEqual(
      loadHarness.state.games[0].trackedPlayingTime,
      local.trackedPlayingTime,
    );
    assert.equal(loadHarness.state.games[0].scoreFor, 7);
    assert.equal(
      loadHarness.state.games[0].events[0].scoreForAtEvent,
      7,
    );
  },
);

test(
  "R2-04: refresh preserves separate durable game and clock operations alongside Trust Spine work",
  async () => {
    assert.match(appSource, /syncOperations:\s*"laxhornet\.syncOperations\.v1"/);
    assert.match(appSource, /queueLegacyGameOperation\(game/);
    assert.match(appSource, /queueClock\(\{/);
    assert.match(eventOperationSource, /storedState === "syncing" \? "retryable"/);

    const trustCloud = deferred();
    const trustState = {
      pendingOperations: [],
    };
    const trustSnapshots = [];
    const eventApi = eventOperationApi();
    const eventService = eventApi.createEventOperationService({
      persistLocal: () => trustSnapshots.push(clone(trustState)),
      queueEvent: (_game, event) => {
        trustState.pendingOperations.push({
          clientOperationId: `permanent-${event.id}`,
          eventId: event.id,
          state: "pending",
        });
      },
      queueTombstone: () => {},
      queueReconciliation: () => {},
      syncLegacyEvent: async () => trustCloud.promise,
      syncLegacyGame: async () => true,
      deleteLegacyEvent: async () => true,
      flushAuthoritativeQueue: async () => true,
      reconcileAuthoritativeGame: async () => true,
      canUseCloud: () => true,
      requiresAuthoritativeHistory: () => true,
    });
    const trustOperation = eventService.createGameEventOperation({
      game: {
        id: "synthetic-refresh-trust-game",
      },
      applyLocal: () => ({
        id: "synthetic-refresh-trust-event",
      }),
    });
    assert.equal(trustSnapshots.at(-1).pendingOperations.length, 1);
    assert.equal(
      trustSnapshots.at(-1).pendingOperations[0].clientOperationId,
      "permanent-synthetic-refresh-trust-event",
    );

    trustCloud.resolve(false);
    await trustOperation.cloudPromise;
  },
);

test(
  "CHARACTERIZATION: sign-in switches to account namespace without migrating signed-out evidence",
  () => {
    const namespaceStorage = {
      "laxhornet.games": [
        {
          id: "synthetic-device-game",
        },
      ],
      "laxhornet.games.user.synthetic-account": [
        {
          id: "synthetic-account-game",
          savedAt: "2026-07-30T18:00:00.000Z",
          localOnlyMetadata: {
            namespace: "synthetic-account",
          },
          trackedPlayingTime: {
            participationOperations: [
              {
                clientOperationId: "synthetic-account-operation",
                syncState: "pending",
              },
            ],
          },
          events: [],
        },
      ],
    };
    const state = {
      authUserId: "",
      authUser: null,
      games: clone(namespaceStorage["laxhornet.games"]),
    };
    const contextGlobals = {
      state,
      activeStorageUserId: "",
      persistAll: () => {},
    };
    const harness = appHarness(
      ["scopedStorageKey", "setAuthUser"],
      contextGlobals,
    );
    harness.context.applyStoredAccountState = (userId) => {
      harness.context.activeStorageUserId = userId || "";
      const key = harness.get("scopedStorageKey")("laxhornet.games");
      state.games = clone(namespaceStorage[key] || []);
    };

    assert.equal(
      harness.get("scopedStorageKey")("laxhornet.games"),
      "laxhornet.games",
    );
    harness.get("setAuthUser")({
      id: "synthetic-account",
    });
    assert.equal(
      harness.get("scopedStorageKey")("laxhornet.games"),
      "laxhornet.games.user.synthetic-account",
    );
    assert.deepEqual(state.games.map((game) => game.id), [
      "synthetic-account-game",
    ]);

    const mapper = mapperHarness();
    state.games = mapper.mergeGames(state.games, [
      {
        id: "synthetic-account-game",
        savedAt: "2026-07-30T17:00:00.000Z",
        status: "in-progress",
        events: [],
      },
      {
        id: "synthetic-cloud-game",
        date: "2026-07-30",
        events: [],
      },
    ]);
    assert.deepEqual(
      Array.from(state.games, (game) => game.id).sort(),
      ["synthetic-account-game", "synthetic-cloud-game"],
    );
    const accountGame = state.games.find(
      (game) => game.id === "synthetic-account-game",
    );
    assert.deepEqual(clone(accountGame.localOnlyMetadata), {
      namespace: "synthetic-account",
    });
    assert.equal(
      accountGame.trackedPlayingTime.participationOperations[0].syncState,
      "pending",
    );
    assert.deepEqual(
      namespaceStorage["laxhornet.games"].map((game) => game.id),
      ["synthetic-device-game"],
      "signed-out evidence remains hidden in the device namespace",
    );
  },
);

test(
  "CHARACTERIZATION: authorization refresh can remove local games before persistence",
  () => {
    const state = {
      teams: [
        {
          id: "synthetic-team",
          cloudBacked: true,
        },
      ],
      playerClaims: [],
      rosterPlayers: [],
      games: [
        {
          id: "synthetic-revoked-game",
          teamId: "synthetic-team",
          retainedEvidence: "synthetic-local-only",
        },
      ],
      activeTeamId: "synthetic-team",
    };
    const harness = appHarness(["pruneLocalOnlyCloudState"], {
      state,
      cloudRosterModeEnabled: () => true,
      normalizeTeams: (teams) => clone(teams),
      normalizeTeam: (team) => team,
      normalizePlayerClaims: (claims) => clone(claims),
      isPlayerAccessRemoved: () => false,
      normalizeRosterPlayers: (players) => clone(players),
      normalizeRosterPlayer: (player) => player,
      isPlatformReviewer: () => false,
      hasPlayerClaim: () => false,
      canShowGameForCurrentAccess: () => false,
    });
    harness.get("pruneLocalOnlyCloudState")();
    assert.deepEqual(state.games, []);

    const persistedGames = clone(state.games);
    assert.deepEqual(
      persistedGames,
      [],
      "the next persistAll games write has no retained-resource copy",
    );
  },
);

test(
  "CHARACTERIZATION: persistAll can leave a cross-key mixed generation after one domain write fails",
  () => {
    const STORAGE_KEYS = {
      player: "player",
      players: "players",
      activePlayerId: "activePlayerId",
      teams: "teams",
      rosterPlayers: "rosterPlayers",
      activeTeamId: "activeTeamId",
      teamAccessRequests: "teamAccessRequests",
      playerClaims: "playerClaims",
      removedPlayerAccess: "removedPlayerAccess",
      adminViewMode: "adminViewMode",
      onboardingIntent: "onboardingIntent",
      nextGameFocus: "nextGameFocus",
      trustSpineSync: "trustSpineSync",
      syncOperations: "syncOperations",
      deletedGames: "deletedGames",
      deletedEvents: "deletedEvents",
      games: "games",
      activeGame: "activeGame",
      trackingSession: "trackingSession",
      reviewGameId: "reviewGameId",
    };
    const storage = {
      games: [
        {
          id: "synthetic-old-game-generation",
        },
      ],
      activeGame: {
        id: "synthetic-old-active-generation",
      },
    };
    const state = {
      player: {},
      players: [],
      activePlayerId: "",
      teams: [],
      rosterPlayers: [],
      activeTeamId: "",
      teamAccessRequests: [],
      playerClaims: [],
      removedPlayerAccess: [],
      adminViewMode: "admin",
      onboardingIntent: "child",
      nextGameFocus: null,
      trustSpineSync: {},
      syncOperations: {
        schemaVersion: 1,
        deviceId: "synthetic-device",
        operations: [],
        acknowledgments: {},
      },
      deletedGameIds: [],
      deletedEventIds: [],
      games: [
        {
          id: "synthetic-new-game-generation",
        },
      ],
      activeGame: {
        id: "synthetic-new-active-generation",
      },
      trackingSession: null,
      reviewGameId: null,
    };
    const failedWrites = [];
    const harness = appHarness(["persistAll"], {
      state,
      STORAGE_KEYS,
      localStorageSafety: {
        beginBatch() {},
        endBatch() {
          return failedWrites;
        },
      },
      recoverAdminTeamContext: () => {},
      pruneLocalOnlyCloudState: () => {},
      mergeRosterPlayersIntoPlayers: () => {},
      ensureActiveTeamRosterPlayer: () => {},
      syncActivePlayer: () => {},
      saveJSON: (key, value) => {
        if (key === STORAGE_KEYS.games) {
          failedWrites.push({
            domain: "games",
            status: "write_failed",
          });
          return;
        }
        storage[key] = clone(value);
      },
      removeStoredItem: (key) => {
        delete storage[key];
      },
      normalizeTeamAccessRequests: (value) => value,
      normalizePlayerClaims: (value) => value,
      normalizeRemovedPlayerAccess: (value) => value,
      normalizeNextGameFocus: (value) => value,
      normalizeTrustSpineSyncState: (value) => value,
      nextGameFocusMatchesPlayer: () => false,
      saveScopedNextGameFocus: () => {},
      uniqueIds: (values = []) => [...new Set(values)],
      normalizeTrackingSession: (value) => value,
      scheduleStorageHealthNotice: () => {},
    });
    harness.get("persistAll")();

    assert.equal(storage.games[0].id, "synthetic-old-game-generation");
    assert.equal(
      storage.activeGame.id,
      "synthetic-new-active-generation",
      "later domains still advance after the games write fails",
    );
  },
);

test(
  "CHARACTERIZATION: repeated logical captures receive different unstable client IDs",
  () => {
    const randomValues = [0.123456, 0.654321];
    const harness = appHarness(["uid"], {
      Date: {
        now: () => Date.parse("2026-07-30T19:00:00.000Z"),
      },
      Math: {
        random: () => randomValues.shift(),
      },
    });
    const uid = harness.get("uid");
    const first = uid("event");
    const second = uid("event");
    assert.notEqual(first, second);
    assert.match(first, /^event-/);
    assert.match(second, /^event-/);
  },
);

test(
  "GUARANTEE: existing Trust Spine coverage proves permanent IDs, replay, versions, conflicts, and tombstones",
  () => {
    // Equivalent coverage already exists; this test binds R2-02 to those exact
    // executable contracts instead of weakening or duplicating them.
    for (const sourceFragment of [
      'client_operation_id: trustSpineOperationId\\("create"',
      'client_operation_id: trustSpineOperationId\\("correct"',
      'clientOperationId: trustSpineOperationId\\("tombstone"',
    ]) {
      assert.ok(
        eventOperationTestSource.includes(sourceFragment),
        `missing existing operation-ID coverage: ${sourceFragment}`,
      );
    }
    for (const marker of [
      "correction idempotency",
      "duplicate operation tampering",
      "same-field conflict",
      "tombstone resurrection prevention",
      "tombstones are permanent",
      "concurrency-safe revision counter",
    ]) {
      assert.match(trustSpineTestSource, new RegExp(marker, "i"));
    }
    assert.match(trustSpineSqlSource, /code' <> 'same_field_conflict'/i);
    assert.match(
      trustSpineSqlSource,
      /code' <> 'duplicate_operation_id_payload_mismatch'/i,
    );
    assert.match(
      trustSpineSqlSource,
      /serverEventVersion'\)::integer <> 4/i,
    );
    assert.match(
      trustSpineSqlSource,
      /tombstoned effective state changed/i,
    );
  },
);

test("R2-01 confirmed-risk coverage manifest is complete", () => {
  const coverage = {
    same_id_cloud_wins: "same-ID cloud hydration",
    lossy_cloud_mapping: "legacy Supabase projections",
    stale_upload_before_read: "stale device uploads",
    duplicate_ui_capture: "repeated logical captures",
    durable_clock_retry: "failed tracked-clock writes",
    rejected_trust_operation_removed: "rejected outcomes remove it",
    hydration_removes_participation: "same-ID cloud hydration",
    stale_game_or_event_resurrection: "stale device uploads",
    rls_invisible_delete_marker_clear: "RLS-invisible legacy event delete",
    generic_legacy_error_state: "legacy sync error outputs",
    unclassified_participation_rejection: "participation rejections",
    out_of_order_load_regression: "older overlapping cloud load",
    random_identity_instability: "repeated logical captures",
    unsigned_to_signed_isolation: "sign-in switches",
    authorization_filter_data_loss: "authorization refresh",
    nontransactional_multi_key_persist: "cross-key mixed generation",
    transient_global_sync_status: "legacy sync error outputs",
  };
  assert.deepEqual(Object.keys(coverage).sort(), [
    "authorization_filter_data_loss",
    "duplicate_ui_capture",
    "durable_clock_retry",
    "generic_legacy_error_state",
    "hydration_removes_participation",
    "nontransactional_multi_key_persist",
    "out_of_order_load_regression",
    "random_identity_instability",
    "rejected_trust_operation_removed",
    "rls_invisible_delete_marker_clear",
    "same_id_cloud_wins",
    "stale_game_or_event_resurrection",
    "stale_upload_before_read",
    "transient_global_sync_status",
    "unclassified_participation_rejection",
    "unsigned_to_signed_isolation",
    "lossy_cloud_mapping",
  ].sort());
  assert.equal(Object.keys(coverage).length, 17);
});
