import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, "tools", "fixtures", "lh-dev-006-storage-safety.json"), "utf8"),
);
const startMarker = "// LOCAL_STORAGE_SAFETY_CORE_START";
const endMarker = "// LOCAL_STORAGE_SAFETY_CORE_END";
const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker);
assert.ok(start >= 0 && end > start, "storage safety source markers must exist");

const context = {};
vm.createContext(context);
vm.runInContext(
  `${appSource.slice(start, end + endMarker.length)}
globalThis.__storageSafetyTestApi = {
  createLocalStorageSafety,
  storageSupportKeys,
  LOCAL_STORAGE_HEALTH,
  LOCAL_STORAGE_SCHEMA_VERSION
};`,
  context,
  { filename: "app.js#local-storage-safety" },
);

const {
  createLocalStorageSafety,
  storageSupportKeys,
  LOCAL_STORAGE_HEALTH,
  LOCAL_STORAGE_SCHEMA_VERSION,
} = context.__storageSafetyTestApi;

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries).map(([key, value]) => [key, String(value)]));
    this.onGet = null;
    this.onSet = null;
    this.onRemove = null;
  }

  getItem(key) {
    const overridden = this.onGet?.(key, this.values.get(key));
    if (overridden !== undefined) return overridden;
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    const overridden = this.onSet?.(key, String(value));
    if (overridden?.throw) throw new Error(overridden.throw);
    this.values.set(key, overridden?.value ?? String(value));
  }

  removeItem(key) {
    const overridden = this.onRemove?.(key);
    if (overridden?.throw) throw new Error(overridden.throw);
    this.values.delete(key);
  }

  keys() {
    return [...this.values.keys()];
  }
}

const objectArray = (value) => Array.isArray(value) && value.every(
  (item) => item && typeof item === "object" && !Array.isArray(item),
);
const objectValue = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
const fixedNow = () => "2026-07-30T12:00:00.000Z";
const plain = (value) => JSON.parse(JSON.stringify(value));

function manager(storage, options = {}) {
  return createLocalStorageSafety({ storage, now: fixedNow, ...options });
}

function metadata(domain = "saved_games", version = LOCAL_STORAGE_SCHEMA_VERSION) {
  return JSON.stringify({
    schemaVersion: version,
    domain,
    updatedAt: fixedNow(),
  });
}

const results = [];
async function test(name, callback) {
  try {
    await callback();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`FAIL ${name}: ${error.stack || error.message}`);
  }
}

await test("missing key returns default and never resurrects backup", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const storage = new MemoryStorage({ [keys.backup]: JSON.stringify(fixture.savedGames) });
  const result = manager(storage).read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.deepEqual(result.value, []);
  assert.equal(result.status, LOCAL_STORAGE_HEALTH.healthy);
  assert.equal(storage.getItem(key), null);
});

await test("valid current payload loads unchanged", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const raw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: raw, [keys.metadata]: metadata() });
  const result = manager(storage).read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.deepEqual(plain(result.value), fixture.savedGames);
  assert.equal(result.status, LOCAL_STORAGE_HEALTH.healthy);
  assert.equal(storage.getItem(key), raw);
});

await test("legacy payload upgrades through sidecar metadata without wrapping primary", () => {
  const key = "laxhornet.games";
  const raw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: raw });
  const safety = manager(storage);
  const first = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(first.status, LOCAL_STORAGE_HEALTH.legacyUpgraded);
  assert.equal(storage.getItem(key), raw);
  assert.equal(JSON.parse(storage.getItem(storageSupportKeys(key).metadata)).schemaVersion, 1);
  const second = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(second.status, LOCAL_STORAGE_HEALTH.healthy);
  assert.deepEqual(plain(second.value), fixture.savedGames);
});

await test("migration is idempotent", () => {
  let calls = 0;
  const key = "laxhornet.games";
  const storage = new MemoryStorage({ [key]: JSON.stringify(fixture.savedGames) });
  const safety = manager(storage, { migrations: { 0: (value) => { calls += 1; return value; } } });
  safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(calls, 1);
});

await test("future schema remains primary, unhealthy, metadata-preserved, and write-blocked", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const raw = JSON.stringify(fixture.savedGames);
  const futureMetadata = metadata("saved_games", 9);
  const storage = new MemoryStorage({ [key]: raw, [keys.metadata]: futureMetadata });
  const safety = manager(storage);
  const read = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(read.status, LOCAL_STORAGE_HEALTH.unsupportedFuture);
  assert.deepEqual(plain(read.value), fixture.savedGames);
  const write = safety.write({
    primaryKey: key,
    domain: "saved_games",
    value: [],
    validate: objectArray,
  });
  assert.equal(write.ok, false);
  assert.equal(write.status, LOCAL_STORAGE_HEALTH.unsupportedFuture);
  assert.equal(storage.getItem(key), raw);
  assert.equal(storage.getItem(keys.metadata), futureMetadata);
  assert.equal(safety.healthSnapshot().find((item) => item.domain === "saved_games").status, LOCAL_STORAGE_HEALTH.unsupportedFuture);
});

await test("future incompatible shape is preserved without quarantine or overwrite", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const raw = JSON.stringify({ schemaVersion: 9, data: fixture.savedGames });
  const futureMetadata = metadata("saved_games", 9);
  const storage = new MemoryStorage({ [key]: raw, [keys.metadata]: futureMetadata });
  const result = manager(storage).read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(result.status, LOCAL_STORAGE_HEALTH.unsupportedFuture);
  assert.deepEqual(result.value, []);
  assert.equal(storage.getItem(key), raw);
  assert.equal(storage.getItem(keys.metadata), futureMetadata);
  assert.equal(storage.getItem(keys.quarantine), null);
});

await test("write checks future metadata even before the domain is read", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const raw = JSON.stringify(fixture.savedGames);
  const futureMetadata = metadata("saved_games", 9);
  const storage = new MemoryStorage({ [key]: raw, [keys.metadata]: futureMetadata });
  const result = manager(storage).write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(result.status, LOCAL_STORAGE_HEALTH.unsupportedFuture);
  assert.equal(storage.getItem(key), raw);
  assert.equal(storage.getItem(keys.metadata), futureMetadata);
});

await test("failed migration preserves valid primary and blocks writes", () => {
  const key = "laxhornet.games";
  const raw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: raw });
  const safety = manager(storage, { migrations: { 0: () => { throw new Error("synthetic migration failure"); } } });
  const read = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(read.status, LOCAL_STORAGE_HEALTH.migrationFailed);
  assert.deepEqual(plain(read.value), fixture.savedGames);
  const write = safety.write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(write.ok, false);
  assert.equal(write.status, LOCAL_STORAGE_HEALTH.migrationFailed);
  assert.equal(storage.getItem(key), raw);
});

await test("malformed primary recovers validated backup", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const backupRaw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: "{bad", [keys.backup]: backupRaw });
  const safety = manager(storage);
  const result = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(result.status, LOCAL_STORAGE_HEALTH.backupRecovered);
  assert.deepEqual(plain(result.value), fixture.savedGames);
  assert.equal(storage.getItem(key), backupRaw);
  assert.equal(JSON.parse(storage.getItem(keys.quarantine)).raw, "{bad");
  assert.equal(storage.getItem(keys.staging), null);
});

await test("malformed primary with no backup quarantines and defaults", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const storage = new MemoryStorage({ [key]: "{bad" });
  const result = manager(storage).read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(result.status, LOCAL_STORAGE_HEALTH.defaulted);
  assert.deepEqual(result.value, []);
  assert.equal(storage.getItem(key), "{bad");
  assert.equal(JSON.parse(storage.getItem(keys.quarantine)).raw, "{bad");
});

await test("wrong structural type is rejected safely", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const storage = new MemoryStorage({ [key]: JSON.stringify({ not: "games" }) });
  const result = manager(storage).read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(result.status, LOCAL_STORAGE_HEALTH.defaulted);
  assert.deepEqual(result.value, []);
  assert.equal(JSON.parse(storage.getItem(keys.quarantine)).reason, "wrong_structural_type");
});

await test("failed serialization does not replace valid primary", () => {
  const key = "laxhornet.games";
  const raw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: raw });
  const circular = {};
  circular.self = circular;
  const result = manager(storage).write({ primaryKey: key, domain: "saved_games", value: circular, validate: objectArray });
  assert.equal(result.ok, false);
  assert.equal(storage.getItem(key), raw);
});

await test("failed staged validation does not replace valid primary", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const raw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: raw });
  storage.onSet = (target) => target === keys.staging ? { value: JSON.stringify({ corrupt: true }) } : undefined;
  const result = manager(storage).write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(result.ok, false);
  assert.equal(storage.getItem(key), raw);
  assert.notEqual(storage.getItem(keys.staging), null);
});

await test("failed promotion restores valid primary", () => {
  const key = "laxhornet.games";
  const raw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: raw });
  let promotions = 0;
  storage.onSet = (target) => {
    if (target === key && ++promotions === 1) return { throw: "synthetic promotion failure" };
    return undefined;
  };
  const result = manager(storage).write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(result.ok, false);
  assert.equal(storage.getItem(key), raw);
});

await test("successful write preserves one validated backup and cleans staging", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const oldRaw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: oldRaw });
  const result = manager(storage).write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(result.ok, true);
  assert.equal(storage.getItem(key), "[]");
  assert.equal(storage.getItem(keys.backup), oldRaw);
  assert.deepEqual(JSON.parse(storage.getItem(keys.backup)), fixture.savedGames);
  assert.equal(storage.getItem(keys.staging), null);
  assert.equal(storage.keys().filter((item) => item === keys.backup).length, 1);
});

await test("metadata write failure restores primary and retains staging", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const oldRaw = JSON.stringify(fixture.savedGames);
  const storage = new MemoryStorage({ [key]: oldRaw });
  storage.onSet = (target) => target === keys.metadata ? { throw: "synthetic metadata quota" } : undefined;
  const result = manager(storage).write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(result.ok, false);
  assert.equal(storage.getItem(key), oldRaw);
  assert.notEqual(storage.getItem(keys.staging), null);
});

await test("quarantine failure preserves malformed primary and blocks promotion", () => {
  const key = "laxhornet.games";
  const keys = storageSupportKeys(key);
  const storage = new MemoryStorage({
    [key]: "{bad",
    [keys.backup]: JSON.stringify(fixture.savedGames),
  });
  storage.onSet = (target) => target === keys.quarantine ? { throw: "synthetic quota" } : undefined;
  const safety = manager(storage);
  const read = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(read.status, LOCAL_STORAGE_HEALTH.backupRecovered);
  assert.deepEqual(plain(read.value), fixture.savedGames);
  assert.equal(storage.getItem(key), "{bad");
  const write = safety.write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(write.ok, false);
  assert.equal(storage.getItem(key), "{bad");
});

await test("unavailable storage defaults reads and fails writes without throwing", () => {
  const key = "laxhornet.games";
  const storage = new MemoryStorage();
  storage.onGet = () => {
    throw new Error("synthetic unavailable storage");
  };
  const safety = manager(storage);
  const read = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.equal(read.status, LOCAL_STORAGE_HEALTH.defaulted);
  assert.deepEqual(read.value, []);
  const write = safety.write({ primaryKey: key, domain: "saved_games", value: [], validate: objectArray });
  assert.equal(write.status, LOCAL_STORAGE_HEALTH.writeFailed);
});

await test("support keys follow the fully scoped account primary", () => {
  const base = "laxhornet.games";
  const firstKey = `${base}.user.${fixture.accounts.first}`;
  const secondKey = `${base}.user.${fixture.accounts.second}`;
  const firstSupport = storageSupportKeys(firstKey);
  const secondSupport = storageSupportKeys(secondKey);
  assert.ok(firstSupport.backup.startsWith(firstKey));
  assert.ok(secondSupport.quarantine.startsWith(secondKey));
  assert.notEqual(firstSupport.backup, secondSupport.backup);
});

await test("switching accounts cannot read another account recovery data", () => {
  const firstKey = `laxhornet.games.user.${fixture.accounts.first}`;
  const secondKey = `laxhornet.games.user.${fixture.accounts.second}`;
  const storage = new MemoryStorage({
    [storageSupportKeys(firstKey).backup]: JSON.stringify(fixture.savedGames),
  });
  const result = manager(storage).read({ primaryKey: secondKey, domain: "saved_games", fallback: [], validate: objectArray });
  assert.deepEqual(result.value, []);
  assert.equal(storage.getItem(secondKey), null);
});

await test("intentional removal clears primary and all support keys", () => {
  const key = "laxhornet.activeGame";
  const keys = storageSupportKeys(key);
  const entries = Object.fromEntries(
    [key, keys.metadata, keys.staging, keys.backup, keys.quarantine].map((item) => [item, "{}"]),
  );
  const storage = new MemoryStorage(entries);
  manager(storage).remove(key);
  for (const item of Object.keys(entries)) assert.equal(storage.getItem(item), null);
});

await test("device reset prefix includes every new support key", () => {
  for (const key of Object.values(storageSupportKeys(`laxhornet.games.user.${fixture.accounts.first}`))) {
    assert.ok(key.startsWith("laxhornet."));
  }
  const clearFunction = appSource.slice(
    appSource.indexOf("function clearLaxHornetBrowserStorage"),
    appSource.indexOf("async function unregisterLaxHornetServiceWorkers"),
  );
  assert.match(clearFunction, /key\.startsWith\("laxhornet\."\)/);
});

await test("tracked-time-bearing saved games survive safe write and read unchanged", () => {
  const key = "laxhornet.games";
  const storage = new MemoryStorage();
  const safety = manager(storage);
  assert.equal(
    safety.write({ primaryKey: key, domain: "saved_games", value: fixture.savedGames, validate: objectArray }).ok,
    true,
  );
  const read = safety.read({ primaryKey: key, domain: "saved_games", fallback: [], validate: objectArray });
  assert.deepEqual(plain(read.value), fixture.savedGames);
  assert.equal(
    read.value[0].trackedPlayingTime.participationOperations[0].clientOperationId,
    "synthetic-participation-operation-1",
  );
});

await test("event-operation state survives safe write and read unchanged", () => {
  const key = "laxhornet.trustSpineSync.v1";
  const storage = new MemoryStorage();
  const safety = manager(storage);
  assert.equal(
    safety.write({
      primaryKey: key,
      domain: "event_operation_state",
      value: fixture.eventOperationState,
      validate: objectValue,
    }).ok,
    true,
  );
  const read = safety.read({ primaryKey: key, domain: "event_operation_state", fallback: {}, validate: objectValue });
  assert.deepEqual(plain(read.value), fixture.eventOperationState);
});

await test("storage metadata remains outside private backup, CSV, recap, and Live Share builders", () => {
  const privateBackup = appSource.slice(appSource.indexOf("function fullBackupPayload"), appSource.indexOf("function openExportDialog"));
  const csv = appSource.slice(appSource.indexOf("function buildCSV"), appSource.indexOf("function downloadFile"));
  const recap = appSource.slice(appSource.indexOf("function buildFamilyRecap"), appSource.indexOf("function copyGameFamilyRecap"));
  const liveShare = appSource.slice(
    appSource.indexOf("function publicLiveShareGameFromPayload"),
    appSource.indexOf("async function loadSharedGame"),
  );
  for (const source of [privateBackup, csv, recap, liveShare]) {
    assert.doesNotMatch(source, /\.safety\.(?:meta|staging|backup|quarantine)/);
  }
  assert.match(privateBackup, /games:\s*state\.games\.map\(normalizeGame\)/);
});

await test("import validation rejects malformed records and retains existing normalization path", () => {
  const source = appSource.slice(
    appSource.indexOf("function validateImportedGameRecord"),
    appSource.indexOf("function gameToSupabaseRow"),
  );
  assert.match(source, /if \(!isStorageObject\(game\)\) throw/);
  assert.match(source, /game\.events !== undefined && !isStorageObjectArray\(game\.events\)/);
  assert.match(source, /normalizeGame\(validateImportedGameRecord\(game\)\)/);
  assert.match(source, /const importedGames = Array\.isArray\(payload\) \? payload : payload\.games/);
  assert.match(source, /if \(!Array\.isArray\(importedGames\)\) throw/);
});

await test("caller-facing storage helper contracts remain synchronous and unchanged", () => {
  const helperSource = appSource.slice(
    appSource.indexOf("function loadJSON"),
    appSource.indexOf("function readStoredAccountState"),
  );
  const persistSource = appSource.slice(
    appSource.indexOf("function persistAll"),
    appSource.indexOf("function applyStoredAccountState"),
  );
  assert.doesNotMatch(helperSource, /async function (?:loadJSON|saveJSON|removeStoredItem)/);
  assert.doesNotMatch(persistSource, /async function persistAll/);
  assert.match(helperSource, /function loadJSON[\s\S]*return localStorageSafety\.read/);
  assert.doesNotMatch(
    helperSource.slice(helperSource.indexOf("function saveJSON"), helperSource.indexOf("function removeStoredItem")),
    /\breturn\b/,
  );
  assert.doesNotMatch(persistSource, /\breturn\b/);
});

await test("persistAll batch warnings deduplicate identical failures but allow a different identity", () => {
  const noticeSource = appSource.slice(
    appSource.indexOf("function storageHealthNotice"),
    appSource.indexOf("function readStoredAccountState"),
  );
  const persistSource = appSource.slice(
    appSource.indexOf("function persistAll"),
    appSource.indexOf("function applyStoredAccountState"),
  );
  const toasts = [];
  const noticeContext = {
    LOCAL_STORAGE_HEALTH,
    STORAGE_DOMAIN_DEFINITIONS: new Map([
      ["games", { domain: "saved_games", critical: true }],
      ["activeGame", { domain: "active_game", critical: true }],
    ]),
    localStorageSafety: { healthSnapshot: () => [] },
    reportedStorageHealthNotices: new Set(),
    queueMicrotask: (callback) => callback(),
    showToast: (message) => toasts.push(message),
  };
  vm.createContext(noticeContext);
  vm.runInContext(
    `${noticeSource}
globalThis.__scheduleStorageHealthNotice = scheduleStorageHealthNotice;`,
    noticeContext,
    { filename: "app.js#storage-health-notice" },
  );

  const identicalFailure = [{ domain: "saved_games", status: LOCAL_STORAGE_HEALTH.writeFailed }];
  noticeContext.__scheduleStorageHealthNotice(identicalFailure);
  noticeContext.__scheduleStorageHealthNotice(identicalFailure);
  noticeContext.__scheduleStorageHealthNotice([
    { domain: "active_game", status: LOCAL_STORAGE_HEALTH.writeFailed },
  ]);

  assert.match(persistSource, /scheduleStorageHealthNotice\(localStorageSafety\.endBatch\(\)\)/);
  assert.equal(toasts.length, 2);
  assert.equal(toasts[0], toasts[1]);
});

const failures = results.filter((result) => !result.ok);
console.log(`\n${results.length - failures.length}/${results.length} local-storage safety tests passed.`);
if (failures.length) process.exitCode = 1;
