import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { inspectR206HydrationLayers } from "./r206_synthetic_production_adapter.mjs";

const root = path.resolve(import.meta.dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const serviceSource = fs.readFileSync(path.join(root, "event-operation-service.js"), "utf8");
const adapterSource = fs.readFileSync(
  path.join(root, "tools", "r206_synthetic_production_adapter.mjs"),
  "utf8",
);
const disposableSource = fs.readFileSync(
  path.join(root, "tools", "r206_synthetic_disposable_adapter.mjs"),
  "utf8",
);
const runnerSource = fs.readFileSync(
  path.join(root, "tools", "r206_synthetic_runner_core.mjs"),
  "utf8",
);
const serviceWorkerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "release", "laxhornet-release-manifest.json"), "utf8"),
);

function extractFunction(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} was not found`);
  const openingParenthesis = source.indexOf("(", start);
  let parenthesisDepth = 0;
  let closingParenthesis = -1;
  for (let index = openingParenthesis; index < source.length; index += 1) {
    if (source[index] === "(") parenthesisDepth += 1;
    if (source[index] === ")") {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        closingParenthesis = index;
        break;
      }
    }
  }
  const openingBrace = source.indexOf("{", closingParenthesis);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (["'", '"', "`"].includes(character)) {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${functionName} did not terminate`);
}

function hydrationApi(globals = {}) {
  const context = vm.createContext({ Set, Array, Object, String, ...globals });
  vm.runInContext([
    "normalizedHydrationGameId",
    "tombstonedHydrationGameIds",
    "hydrationCandidateIsTombstoned",
    "filterTombstonedHydrationCandidates",
  ].map((name) => extractFunction(appSource, name)).join("\n"), context);
  return {
    ids: context.tombstonedHydrationGameIds,
    filter: context.filterTombstonedHydrationCandidates,
  };
}

function durableApi() {
  const context = vm.createContext({
    window: {}, Date, Math, JSON, Object, Array, Set, Map, Promise, TypeError,
  });
  vm.runInContext(serviceSource, context);
  return context.window.LaxHornetDurableSyncOperations;
}

function durableHarness(accountId = "account-a") {
  const api = durableApi();
  let state = api.normalizeState(null, {
    accountId,
    deviceId: "device-a",
    createId: (prefix) => `${prefix}-1`,
  });
  const attempts = [];
  const service = api.createDurableSyncOperationService({
    getState: () => state,
    setState: (next) => { state = next; },
    persistState: () => true,
    currentAccountId: () => accountId,
    isOffline: () => false,
    createId: (prefix) => `${prefix}-${attempts.length + 2}`,
    executeOperation: async (operation) => {
      attempts.push(operation);
      return { outcome: "accepted", receipt: { code: "accepted" } };
    },
  });
  return { api, service, attempts, state: () => state };
}

function tombstone(gameId = "Game-123") {
  return {
    gameId,
    deletionId: "delete-1",
    deviceId: "device-a",
    deletedAt: "2026-08-01T12:00:00.000Z",
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  };
}

function memoryStorage(entries = {}) {
  const storage = {
    getItem(key) { return Object.hasOwn(this, key) ? this[key] : null; },
    setItem(key, value) { this[key] = String(value); },
    removeItem(key) { delete this[key]; },
  };
  Object.assign(storage, entries);
  return storage;
}

async function inspectWithBrowserGlobals({ entries = {}, presence = {}, nodes = [] } = {}) {
  const previous = {
    localStorage: globalThis.localStorage,
    window: globalThis.window,
    document: globalThis.document,
  };
  globalThis.localStorage = memoryStorage(entries);
  globalThis.window = {
    LAXHORNET_HYDRATION_INSPECTOR: {
      gamePresence: () => presence,
      diagnostics: () => ({
        tombstonesLoaded: true,
        tombstoneSuppressionComplete: true,
        tombstoneCount: 1,
      }),
    },
  };
  globalThis.document = { querySelectorAll: () => nodes };
  const page = { evaluate: async (callback, args) => callback(args) };
  try {
    return await inspectR206HydrationLayers({
      page,
      accountId: "account-a",
      gameId: "Game-123",
    });
  } finally {
    globalThis.localStorage = previous.localStorage;
    globalThis.window = previous.window;
    globalThis.document = previous.document;
  }
}

test("1 clean browser with one tombstone has no game candidate", () => {
  const api = hydrationApi();
  assert.deepEqual(Array.from(api.filter([], api.ids([{ game_id: "Game-123" }]))), []);
});

test("2 stale remote hydration response is filtered", () => {
  const api = hydrationApi();
  assert.equal(api.filter([{ id: "Game-123" }], api.ids([{ game_id: "game-123" }])).length, 0);
});

test("3 stale local game is filtered by the matching tombstone", () => {
  const api = hydrationApi();
  assert.equal(api.filter([{ id: "Game-123", local: true }], api.ids([{ game_id: "game-123" }])).length, 0);
});

test("4 higher local revision cannot defeat a tombstone", () => {
  const api = hydrationApi();
  assert.equal(api.filter([{ id: "Game-123", revision: 999 }], api.ids([{ game_id: "game-123" }])).length, 0);
});

test("5 an empty remote table does not preserve a tombstoned local game", () => {
  const api = hydrationApi();
  assert.equal(api.filter([{ id: "Game-123" }], api.ids([tombstone()])).length, 0);
});

test("6 tombstone arriving after local parsing still suppresses the parsed game", () => {
  const api = hydrationApi();
  const parsed = [{ id: "Game-123" }];
  assert.equal(api.filter(parsed, api.ids([tombstone()])).length, 0);
});

test("7 tombstone arriving before local parsing suppresses the later candidate", () => {
  const api = hydrationApi();
  const ids = api.ids([tombstone()]);
  assert.equal(api.filter([{ id: "Game-123" }], ids).length, 0);
});

test("8 normalized type and casing differences cannot bypass suppression", () => {
  const api = hydrationApi();
  assert.equal(api.filter([{ id: "  GAME-123 " }], api.ids([{ game_id: "game-123" }])).length, 0);
});

test("9 queued stale whole-game write is superseded", () => {
  const subject = durableHarness();
  subject.service.queueGame({ accountId: "account-a", gameId: "GAME-123", payload: { gameRow: {} } });
  subject.service.mergeServerTombstones("account-a", [tombstone("game-123")]);
  assert.equal(subject.state().operations[0].state, "superseded");
});

test("10 queued tracked-clock write is superseded", () => {
  const subject = durableHarness();
  subject.service.queueClock({ accountId: "account-a", gameId: "GAME-123", payload: { revision: 2 } });
  subject.service.mergeServerTombstones("account-a", [tombstone("game-123")]);
  assert.equal(subject.state().operations[0].state, "superseded");
});

test("11 later writes cannot be queued for a tombstoned game", () => {
  const subject = durableHarness();
  subject.service.mergeServerTombstones("account-a", [tombstone()]);
  assert.equal(subject.service.queueGame({ accountId: "account-a", gameId: "game-123", payload: {} }), null);
  assert.equal(subject.service.queueClock({ accountId: "account-a", gameId: "game-123", payload: {} }), null);
});

test("12 hydration generations reject obsolete commits", () => {
  const body = extractFunction(appSource, "loadCloudGames");
  assert.match(body, /discardStaleHydration/);
  assert.match(body, /newerHydrationAlreadyReported/);
  assert.match(body, /latestDiagnostics\.tombstoneSuppressionComplete/);
  assert.ok((body.match(/cloudGameHydrationIsCurrent/g) || []).length >= 8);
});

test("13 account transitions invalidate hydration immediately", () => {
  assert.match(extractFunction(appSource, "setAuthUser"), /cloudGameHydrationGeneration \+= 1/);
  assert.match(extractFunction(appSource, "loadCloudGames"), /loadCloudTeams\(\{ silent: true, accountId: hydrationUserId \}\)/);
  assert.ok((extractFunction(appSource, "loadCloudTeams").match(/accountLoadIsCurrent/g) || []).length >= 6);
  for (const helper of ["loadEditableTeamAccessCodes", "loadTeamAccessRequests", "loadPlayerClaims", "loadClaimedRosterPlayers"]) {
    assert.match(extractFunction(appSource, helper), /accountLoadIsCurrent/);
  }
});

test("14 repeated hydration has one monotonic generation source", () => {
  assert.match(extractFunction(appSource, "loadCloudGames"), /\+\+cloudGameHydrationGeneration/);
});

test("15 one account tombstone cannot suppress another account", () => {
  const subject = durableHarness();
  subject.service.mergeServerTombstones("account-a", [tombstone()]);
  assert.equal(subject.service.isTombstoned("account-b", "Game-123"), false);
});

test("16 same game ID remains isolated under a different account", () => {
  const subject = durableHarness();
  subject.service.mergeServerTombstones("account-a", [tombstone()]);
  assert.equal(subject.service.tombstoneFor("account-b", "Game-123"), null);
});

test("17 legacy import rechecks authoritative tombstones before commit", () => {
  assert.match(extractFunction(appSource, "confirmPendingImport"), /!isDeletedGame\(game\.id\)/);
});

test("18 saved-game safety backups are sanitized without deleting unrelated games", () => {
  const localStorage = memoryStorage({
    "laxhornet.games.user.account-a": JSON.stringify([{ id: "Game-123" }, { id: "game-keep" }]),
    "laxhornet.games.user.account-a.safety.backup": JSON.stringify([{ id: "GAME-123" }, { id: "game-keep" }]),
  });
  const context = vm.createContext({
    localStorage,
    LOCAL_STORAGE_SUPPORT_SUFFIXES: {
      metadata: ".safety.meta",
      staging: ".safety.staging",
      backup: ".safety.backup",
      quarantine: ".safety.quarantine",
    },
    STORAGE_KEYS: {
      games: "laxhornet.games",
      activeGame: "laxhornet.activeGame",
      trackingSession: "laxhornet.trackingSession",
      reviewGameId: "laxhornet.reviewGameId",
      trustSpineSync: "laxhornet.trustSpineSync.v1",
      familyRecapFocus: "laxhornet.familyRecapFocus",
    },
    isStorageObject: (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
    normalizeTrustSpineSyncState: (value) => value,
    scopedStorageKey: (key) => `${key}.user.account-a`,
    currentAccountTombstonedGameIds: () => new Set(),
    Set, Array, Object, String, JSON,
  });
  vm.runInContext([
    "storageSupportKeys",
    "normalizedHydrationGameId",
    "rewriteHydrationStorageJSON",
    "sanitizeHydrationStorageFamily",
    "purgeTombstonedGamesFromLocalStorage",
  ].map((name) => extractFunction(appSource, name)).join("\n"), context);
  context.purgeTombstonedGamesFromLocalStorage(new Set(["game-123"]));
  assert.deepEqual(JSON.parse(localStorage["laxhornet.games.user.account-a"]), [{ id: "game-keep" }]);
  assert.deepEqual(JSON.parse(localStorage["laxhornet.games.user.account-a.safety.backup"]), [{ id: "game-keep" }]);
});

test("19 tombstone metadata itself is not classified as raw game persistence", async () => {
  const result = await inspectWithBrowserGlobals({
    entries: {
      "laxhornet.syncOperations.v1.user.account-a": JSON.stringify({
        tombstones: [{ gameId: "Game-123" }],
      }),
    },
  });
  assert.equal(result.rawPersistenceGameVisible, false);
  assert.equal(result.gameVisible, false);
});

test("20 raw saved-game persistence is independently detected", async () => {
  const result = await inspectWithBrowserGlobals({
    entries: { "laxhornet.games.user.account-a": JSON.stringify([{ id: "Game-123" }]) },
  });
  assert.equal(result.rawPersistenceGameVisible, true);
});

test("21 raw application state is independently detected", async () => {
  const result = await inspectWithBrowserGlobals({ presence: { savedGameState: true } });
  assert.equal(result.applicationStateGameVisible, true);
});

test("22 rendered game-list state is independently detected", async () => {
  const result = await inspectWithBrowserGlobals({ nodes: [{ dataset: { gameId: "game-123" } }] });
  assert.equal(result.renderedGameVisible, true);
});

test("23 verifier requires raw, application, rendered, and no-write layers", () => {
  assert.match(runnerSource, /rawPersistenceGameVisible/);
  assert.match(runnerSource, /applicationStateGameVisible/);
  assert.match(runnerSource, /renderedGameVisible/);
  assert.match(runnerSource, /resurrectionWriteRequests !== 0/);
});

test("24 direct detail and derived selectors read only canonical state.games", () => {
  assert.match(appSource, /games\.find\(\(game\) => game\.id === state\.reviewGameId\)/);
  assert.match(appSource, /state\.games\.filter/);
});

test("25 durable tombstone remains in sync state while game storage is purged", () => {
  const persistBody = extractFunction(appSource, "persistAll");
  assert.match(persistBody, /saveJSON\(STORAGE_KEYS\.syncOperations, state\.syncOperations\)/);
  assert.match(persistBody, /purgeTombstonedGamesFromLocalStorage/);
});

test("26 diagnostics are count-only and omit private identifiers", () => {
  const body = extractFunction(appSource, "publishHydrationDiagnostics");
  for (const forbidden of ["gameId", "deletionId", "accountId", "userId", "email", "opponent"]) {
    assert.doesNotMatch(body, new RegExp(forbidden, "i"));
  }
});

test("27 explicit invariant failure classifications are registered", () => {
  for (const code of [
    "TOMBSTONE_LOAD_FAILED",
    "TOMBSTONE_SUPPRESSION_INCOMPLETE",
    "STALE_HYDRATION_COMMIT_REJECTED",
    "DELETED_GAME_REINTRODUCED",
  ]) assert.match(appSource, new RegExp(code));
});

test("28 offline-to-online reconciliation hydrates tombstones before retries", () => {
  const onlineStart = appSource.indexOf('window.addEventListener("online"');
  const onlineBody = appSource.slice(onlineStart, appSource.indexOf('window.addEventListener("offline"', onlineStart));
  assert.ok(onlineBody.indexOf("loadCloudGames") < onlineBody.indexOf("retryGameEventOperations"));
});

test("29 service worker does not cache Supabase responses", () => {
  assert.match(serviceWorkerSource, /requestUrl\.origin === self\.location\.origin/);
  assert.doesNotMatch(serviceWorkerSource, /supabase\.co/);
});

test("30 disposable hydration reports all three layers and retained suppression", () => {
  assert.match(disposableSource, /rawPersistenceGameVisible/);
  assert.match(disposableSource, /applicationStateGameVisible/);
  assert.match(disposableSource, /renderedGameVisible/);
  assert.match(disposableSource, /tombstoneSuppressionComplete/);
});

test("31 production hydration inspection uses scoped keys rather than an all-storage substring scan", () => {
  assert.match(adapterSource, /const scoped = \(base\)/);
  assert.doesNotMatch(adapterSource, /values\.some\(\(value\) => value\.includes\(gameId\)\)/);
});

test("32 production execution and release closeout remain disabled", () => {
  assert.equal(manifest.r206ReleaseControl.syntheticRunner.productionExecutionDefault, "disabled");
  assert.equal(manifest.r206ReleaseControl.syntheticVerification.authorized, false);
  assert.equal(manifest.r206ReleaseControl.syntheticVerification.completed, false);
  assert.equal(manifest.r206ReleaseControl.cleanupCompleted, false);
  assert.equal(manifest.r206ReleaseControl.releaseCloseoutApproved, false);
});
