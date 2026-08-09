import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("event-operation-service.js", "utf8");
const context = { window: {}, crypto: crypto.webcrypto, TextEncoder, setTimeout, clearTimeout };
context.window.window = context.window;
context.window.crypto = crypto.webcrypto;
vm.runInNewContext(source, context);
const r207 = context.window.LaxHornetR207FieldOperations;
const checks = [];
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); };

const versions = {
  gameRevision: 1,
  metadataVersion: 1,
  scoreVersion: 1,
  statusVersion: 1,
  rosterContextVersion: 1,
  sharingVersion: 1,
  futureVersion: 9,
};
const before = { id: "synthetic-game", opponent: "A", date: "2026-08-09", location: "Field 1", gameType: "Scrimmage", lifecycleState: "active", serverVersions: versions };
const operation = r207.buildMetadataOperation({ before, after: { ...before, opponent: "B" }, clientOperationId: "permanent-a", createdAt: 1 });
check(operation.client_operation_id === "permanent-a", "permanent operation identity is assigned before cloud work");
check(operation.base_version === 1 && operation.changed_fields.join() === "opponent", "metadata operation carries exact hydrated base and bounded changed fields");
check(r207.hasRequiredVersions(versions), "complete version map is accepted");
check(r207.normalizeVersionMap(versions).futureVersion === 9, "future version fields survive local schema normalization");
check(!r207.hasRequiredVersions({ metadataVersion: 1 }), "missing bases are never defaulted to current");

for (const builder of [
  r207.buildScoreDeltaOperation({ game: before, deltas: { score_for: 1 }, clientOperationId: "score-delta" }),
  r207.buildScoreCorrectionOperation({ game: before, scoreFor: 2, scoreAgainst: 1, clientOperationId: "score-fix" }),
  r207.buildStatusOperation({ game: before, lifecycleState: "paused", clientOperationId: "status" }),
  r207.buildRosterContextOperation({ game: before, playerId: "synthetic-player", clientOperationId: "roster" }),
  r207.buildSharingOperation({ game: before, isShared: true, clientOperationId: "sharing" }),
]) {
  check(builder.base_version === 1 && builder.client_operation_id, `${builder.operation_type} builder is versioned and identified`);
}

let serverOpponent = "A";
let serverLocation = "Field 1";
let serverMetadataVersion = 1;
let calls = 0;
async function server(request) {
  calls += 1;
  if (request.client_operation_id === "retryable") return { outcome: "retryable", code: "network_unavailable" };
  if (request.client_operation_id === "unauthorized") return { outcome: "rejected", code: "authorization_denied" };
  if (request.client_operation_id === "deleted") return { outcome: "deleted", code: "game_deleted" };
  const field = request.changed_fields[0];
  if (request.base_version < serverMetadataVersion && field === "opponent") {
    return { outcome: "conflicted", code: "field_conflict", versions: { ...versions, metadataVersion: serverMetadataVersion } };
  }
  if (field === "opponent") serverOpponent = request.changes.opponent;
  if (field === "location") serverLocation = request.changes.location;
  serverMetadataVersion += 1;
  return { outcome: request.base_version < serverMetadataVersion - 1 ? "merged" : "accepted", versions: { ...versions, metadataVersion: serverMetadataVersion }, server_game: { opponent: serverOpponent, location: serverLocation } };
}

function device(account = "synthetic-account", offline = false) {
  let state = r207.emptyState();
  const persisted = [];
  const events = [];
  const service = r207.createFieldOperationService({
    getState: () => state,
    setState: (next) => { state = next; },
    persistState: (next) => { persisted.push(structuredClone(next)); return true; },
    currentAccountId: () => account,
    isOffline: () => offline,
    execute: server,
    onAccepted: (_operation, result) => events.push(result.outcome),
    onConflict: () => events.push("conflicted"),
    onRejected: (_operation, result) => events.push(result.code),
  });
  return { service, state: () => state, persisted, events };
}

const a = device();
const b = device();
await a.service.queue(operation);
operation.changes.opponent = "MUTATED-AFTER-QUEUE";
await a.service.process();
check(serverOpponent === "B", "attempted payload is immutable after durable queueing");
check(a.state().operations.length === 0 && a.state().receipts.length === 1, "receipt persists before accepted operation compaction");
check(await a.service.queue(operation) === null && a.state().operations.length === 0, "accepted operation identity cannot be requeued after compaction");

await b.service.queue(r207.buildMetadataOperation({ before, after: { ...before, opponent: "C" }, clientOperationId: "permanent-b", createdAt: 2 }));
await b.service.process();
check(serverOpponent === "B" && b.state().operations[0].state === "conflicted", "stale overlap conflicts without silent overwrite");
check(b.state().conflicts[before.id].message === r207.CONFLICT_MESSAGE, "conflict retains nontechnical user message");
check(!JSON.stringify(b.state().conflicts[before.id]).includes("permanent-a"), "local conflict surface contains no other operation identity");
const callsAfterConflict = calls;
await b.service.process();
check(calls === callsAfterConflict, "conflict is not blindly retried");
check(b.service.markConflictRefreshed(before.id, { ...versions, metadataVersion: serverMetadataVersion }), "server refresh resolves the blocking conflict");
check(Boolean(b.state().conflicts[before.id].refreshedAt) && b.state().operations[0].state === "superseded", "refresh retains the proposal as resolved local evidence");
check(Boolean(await b.service.queue(r207.buildMetadataOperation({ before: { ...before, opponent: "B", serverVersions: { ...versions, metadataVersion: serverMetadataVersion } }, after: { ...before, opponent: "D" }, clientOperationId: "permanent-b2", createdAt: 3 }))), "refresh permits a new operation from the latest server base");

const c = device();
await c.service.queue(r207.buildMetadataOperation({ before, after: { ...before, location: "Field 2" }, clientOperationId: "non-overlap", createdAt: 3 }));
await c.service.process();
check(serverOpponent === "B" && serverLocation === "Field 2" && c.events.includes("merged"), "approved non-overlapping stale metadata merges");

for (const [id, expected] of [["unauthorized", "authorization_denied"], ["deleted", "game_deleted"]]) {
  const subject = device();
  await subject.service.queue(r207.buildMetadataOperation({ before: { ...before, serverVersions: { ...versions, metadataVersion: serverMetadataVersion } }, after: { ...before, opponent: id, serverVersions: { ...versions, metadataVersion: serverMetadataVersion } }, clientOperationId: id, createdAt: 4 }));
  await subject.service.process();
  check(subject.state().operations[0].lastError.code === expected, `${id} result remains distinct from a conflict`);
}

const offline = device("synthetic-account", true);
await offline.service.queue(r207.buildMetadataOperation({ before, after: { ...before, opponent: "Offline" }, clientOperationId: "offline", createdAt: 5 }));
const callsBeforeOffline = calls;
await offline.service.process();
check(calls === callsBeforeOffline && offline.state().operations[0].state === "pending", "offline work remains local and unattempted");

const retryable = device();
await retryable.service.queue(r207.buildMetadataOperation({ before: { ...before, serverVersions: { ...versions, metadataVersion: serverMetadataVersion } }, after: { ...before, opponent: "Retry" }, clientOperationId: "retryable", createdAt: 6 }));
const callsBeforeRetryable = calls;
await retryable.service.process();
check(calls === callsBeforeRetryable + 1 && retryable.state().operations[0].state === "retryable", "retryable transport failure makes only one immediate attempt");

const runtime = fs.readFileSync("runtime-config.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260809155442_r207b_controlled_preview_integration.sql", "utf8");
const qualificationFix = fs.readFileSync("supabase/migrations/20260809164435_r207b_qualify_preview_game_update.sql", "utf8");
const seed = fs.readFileSync("supabase/seed.sql", "utf8");
check(runtime.includes("r207bControlledPreview: false"), "production runtime flag defaults off");
check(app.includes(r207.CONFLICT_MESSAGE) === false && app.includes("CONFLICT_MESSAGE"), "UI consumes the bounded shared conflict copy without duplicating raw diagnostics");
check(app.includes("&& r207ConflictForGame(game.id)"), "a conflict blocks the legacy whole-game overwrite path");
check(/preview_enabled boolean not null default false/i.test(migration), "server preview capability defaults off");
check(/update public\.r207_preview_control[\s\S]*preview_enabled = true/i.test(seed), "isolated Preview seed explicitly enables the server bridge");
check(/update public\.games as game_row[\s\S]*where game_row\.id\s*=/i.test(qualificationFix), "Preview wrapper qualifies the game identifier and prevents PostgreSQL 42702");
check(!/service[_-]?role|refresh[_-]?token|access[_-]?token/i.test(`${migration}\n${seed}`), "migration and Preview seed contain no credential material");

console.log(`R2-07B controlled preview tests: ${checks.length}/${checks.length} passed`);
