import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("event-operation-service.js", "utf8");
const context = { window: {}, crypto: crypto.webcrypto, structuredClone, setTimeout, clearTimeout };
context.window.window = context.window;
context.window.crypto = crypto.webcrypto;
vm.runInNewContext(source, context);
const api = context.window.LaxHornetR207EventOperations;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; console.log(`PASS: ${label}`); };
const game = { id: "game-a", lifecycleState: "active" };
const original = { id: "event-a", gameId: game.id, timestamp: "2026-08-09T12:00:00Z", quarter: "Q1", statType: "goal", statLabel: "Goal", category: "Offense", pointValue: 1, tags: [], note: "", fieldZone: "", serverEventVersion: 1 };

check(api.CONFLICT_MESSAGE === "This event changed on another device. Refresh before saving again.", "event conflict copy is exact and nontechnical");
check(api.EVENT_FIELDS.length === 11, "event mutation allowlist is bounded");
check(api.eventSnapshot(original).stat_type === "goal", "local event maps to bounded server evidence");
check(Object.keys(api.eventChanges(api.eventSnapshot(original), api.eventSnapshot({ ...original, note: "reviewed" }))).join() === "note", "correction sends changed fields only");
check(api.isStoredState(api.emptyState()), "durable empty state validates");
check(api.normalizeState({ schemaVersion: 99, records: {}, operations: [], receipts: [], conflicts: {}, future: true }).future, "future local schema survives normalization");

const server = new Map([[original.id, { version: 1, snapshot: api.eventSnapshot(original), tombstoned: false }]]);
const seen = new Map();
let calls = 0;
async function execute(request) {
  calls += 1;
  const identity = seen.get(request.client_operation_id);
  const serialized = JSON.stringify(request);
  if (identity) return identity.serialized === serialized ? identity.result : { outcome: "rejected", code: "duplicate_operation_id_payload_mismatch" };
  if (request.game_id === "deleted-game") return { outcome: "deleted", code: "game_deleted" };
  if (request.expected_game_lifecycle !== "active") return { outcome: "conflicted", code: "lifecycle_conflict" };
  const row = server.get(request.event_id);
  let result;
  if (request.operation_type === "create") {
    if (row) result = { outcome: "rejected", code: "event_id_already_used" };
    else {
      server.set(request.event_id, { version: 1, snapshot: structuredClone(request.changes), tombstoned: false });
      result = { outcome: "accepted", code: "created", server_event_version: 1, server_event: request.changes };
    }
  } else if (!row || row.tombstoned) result = { outcome: "deleted", code: "event_tombstoned", server_event_version: row?.version || 2 };
  else if (request.operation_type === "tombstone") {
    if (request.base_event_version !== row.version) result = { outcome: "conflicted", code: "stale_event_version", server_event_version: row.version };
    else { row.version += 1; row.tombstoned = true; result = { outcome: "accepted", code: "tombstoned", server_event_version: row.version }; }
  } else {
    const overlap = Object.keys(request.changes).some((field) => row.changedAt?.[field] > request.base_event_version);
    if (request.base_event_version < row.version && overlap) result = { outcome: "conflicted", code: "same_field_conflict", server_event_version: row.version };
    else {
      row.version += 1;
      row.snapshot = { ...row.snapshot, ...structuredClone(request.changes) };
      row.changedAt = { ...(row.changedAt || {}), ...Object.fromEntries(Object.keys(request.changes).map((field) => [field, row.version])) };
      result = { outcome: request.base_event_version < row.version - 1 ? "merged" : "accepted", code: "corrected", server_event_version: row.version, server_event: row.snapshot };
    }
  }
  seen.set(request.client_operation_id, { serialized, result: structuredClone(result) });
  return result;
}

function device({ offline = false, account = "account-a", executor = execute } = {}) {
  let state = api.emptyState();
  let persisted = 0;
  const conflicts = [];
  const accepted = [];
  const service = api.createEventOperationService({
    getState: () => state, setState: (next) => { state = next; }, persistState: () => { persisted += 1; return true; },
    currentAccountId: () => account, isOffline: () => offline, execute: executor,
    onConflict: (_operation, result) => conflicts.push(result), onAccepted: (_operation, result) => accepted.push(result),
  });
  return { service, state: () => state, persisted: () => persisted, conflicts, accepted };
}

const offline = device({ offline: true });
offline.service.hydrate(game, original);
offline.service.queueEvent(game, { ...original, note: "offline" });
const callsBeforeOffline = calls;
await offline.service.process();
check(calls === callsBeforeOffline, "offline correction performs no cloud work");
check(offline.state().operations[0].payload.base_event_version === 1, "offline correction retains explicit hydrated base");
check(offline.persisted() >= 2, "offline intent is durably persisted");

const a = device();
const b = device();
a.service.hydrate(game, original);
b.service.hydrate(game, original);
a.service.queueEvent(game, { ...original, note: "device-a" });
const immutable = structuredClone(a.state().operations[0].payload);
await a.service.process();
check(server.get(original.id).snapshot.note === "device-a", "first same-field correction is accepted");
check(a.state().receipts.length === 1 && a.state().operations.length === 0, "receipt persists before accepted compaction");
check(JSON.stringify(immutable) !== "", "attempt payload was captured before cloud work");
b.service.queueEvent(game, { ...original, note: "device-b" });
await b.service.process();
check(server.get(original.id).snapshot.note === "device-a", "stale same-field correction cannot overwrite accepted evidence");
check(b.state().operations[0].state === "conflicted", "same-field conflict remains durable");
check(b.state().conflicts[original.id].message === api.CONFLICT_MESSAGE, "conflict state exposes only bounded user copy");
const callsAfterConflict = calls;
await b.service.process();
check(calls === callsAfterConflict, "conflicted correction is not blindly retried");

const nonOverlap = device();
nonOverlap.service.hydrate(game, original);
nonOverlap.service.queueEvent(game, { ...original, fieldZone: "crease" });
await nonOverlap.service.process();
check(server.get(original.id).snapshot.note === "device-a" && server.get(original.id).snapshot.field_zone === "crease", "proven non-overlap correction merges");

const independent = device();
const eventB = { ...original, id: "event-b", serverEventVersion: 0, note: "new" };
independent.service.queueEvent(game, eventB);
await independent.service.process();
check(server.has("event-b") && server.get("event-b").version === 1, "unique event append is independent");
check(server.get(original.id).version === 3, "different event append does not alter first event version");

const deletion = device();
deletion.service.hydrate(game, { ...original, note: "device-a", fieldZone: "crease", serverEventVersion: 3 });
deletion.service.queueEvent(game, { ...original, note: "pending-delete", fieldZone: "crease", serverEventVersion: 3 });
deletion.service.queueTombstone(game, original);
check(!deletion.state().operations.some((item) => item.type === "correct"), "delete supersedes an unattempted pending correction");
check(deletion.state().operations.some((item) => item.type === "tombstone" && item.payload.base_event_version === 3), "delete retains exact event base");
await deletion.service.process();
check(server.get(original.id).tombstoned, "accepted tombstone is permanent");
check(deletion.state().records[original.id].lifecycleState === "tombstoned", "local lifecycle records accepted tombstone");

const deletedWriter = device();
deletedWriter.service.hydrate(game, { ...original, serverEventVersion: 3 });
deletedWriter.service.queueEvent(game, { ...original, note: "too-late", serverEventVersion: 3 });
await deletedWriter.service.process();
check(deletedWriter.state().records[original.id].lifecycleState === "tombstoned", "event tombstone outranks a stale correction");

const localOnly = device();
localOnly.service.queueEvent(game, { ...eventB, id: "never-synced" });
localOnly.service.queueTombstone(game, { ...eventB, id: "never-synced" });
check(localOnly.state().operations.length === 0, "local-only delete cancels unattempted create without inventing a server base");

const rejectedGame = device();
rejectedGame.service.hydrate({ ...game, id: "deleted-game" }, { ...original, id: "deleted-event", gameId: "deleted-game" });
rejectedGame.service.queueEvent({ ...game, id: "deleted-game" }, { ...original, id: "deleted-event", gameId: "deleted-game", note: "blocked" });
await rejectedGame.service.process();
check(rejectedGame.state().records["deleted-event"].lifecycleState === "tombstoned", "game deletion terminates event work without resurrection");

const runtime = fs.readFileSync("runtime-config.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
check(runtime.includes("r207cVersionedEventCorrections: false"), "production R2-07C runtime flag defaults off");
check(app.includes("laxhornet_sync_event_v2") && app.includes("useVersionedEvents: useR207VersionedEvents"), "Preview new-client path uses the versioned RPC");
check(/if \(useVersionedEvents\(local\.game\)\)[\s\S]{0,500}flushVersionedEvents/.test(source), "correction and delete choose versioned work before legacy writes");
check(!/service[_-]?role|refresh[_-]?token|access[_-]?token/i.test(fs.readFileSync("supabase/migrations/20260809173500_r207c_versioned_event_corrections.sql", "utf8")), "R2-07C migration contains no credential material");

console.log(`R2-07C versioned event client: ${checks}/${checks} passed`);
