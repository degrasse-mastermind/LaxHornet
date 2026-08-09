import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { TextEncoder } from "node:util";

const source = fs.readFileSync("event-operation-service.js", "utf8");
const context = { window: {}, crypto: crypto.webcrypto, structuredClone, TextEncoder, setTimeout, clearTimeout };
context.window.window = context.window;
context.window.crypto = crypto.webcrypto;
vm.runInNewContext(source, context);
const api = context.window.LaxHornetR207ConflictResolution;
const eventApi = context.window.LaxHornetR207EventOperations;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; console.log(`PASS: ${label}`); };
const conflict = (overrides = {}) => ({
  conflict_id: "00000000-0000-4000-8000-000000000101",
  game_id: "game-a",
  field_group: "metadata",
  overlapping_fields: ["opponent"],
  current_values: { opponent: "Current" },
  proposed_values: { opponent: "Saved" },
  server_versions: { game: 3, metadata: 3, score: 1, status: 1, roster_context: 1, sharing: 1, clock: 0 },
  resolution_status: "open",
  created_at: "2026-08-09T12:00:00Z",
  ...overrides,
});

check(api.isStoredState(api.emptyState("account-a")), "empty account-scoped conflict state validates");
check(api.normalizeState({ ...api.emptyState("account-a"), schemaVersion: 99, future: true }, "account-a").future === true, "future conflict schema is preserved without mutation");
check(Object.keys(api.normalizeState({ ...api.emptyState("account-a"), conflicts: { one: conflict() } }, "account-b").conflicts).length === 0, "account switch starts from an isolated conflict namespace");
check(api.safeConflict(conflict())?.proposedValues.opponent === "Saved", "bounded server conflict projection is accepted");
check(api.safeConflict(conflict({ proposed_values: { token: "secret" } })) === null, "unknown private conflict values fail closed on the client");
check(api.formatValue("player_id", "opaque-internal-id") === "Selected player", "opaque player identity is never rendered as an internal ID");
check(api.safeConflict(conflict({
  field_group: "roster_context",
  overlapping_fields: ["player_id"],
  current_values: { player_id: null },
  proposed_values: { player_id: "opaque-internal-id" },
}))?.currentValues.player_id === "", "an unselected roster player remains a safe bounded conflict value");
check(api.patchableFields(api.safeConflict(conflict())).join() === "opponent", "custom correction fields use the bounded group allowlist");

function device(options = {}) {
  let account = options.account || "account-a";
  let offline = options.offline === true;
  let state = options.initialState || api.emptyState(account);
  let persisted = 0;
  let changes = 0;
  let resolveResponse = options.resolveResponse || { outcome: "accepted", code: "resolution_kept" };
  let readImpl = options.read || (async () => ({ outcome: "accepted", code: "conflicts_read", conflicts: [conflict()] }));
  const calls = [];
  const service = api.createConflictResolutionService({
    getState: () => state,
    setState: (next) => { state = next; },
    persistState: () => { persisted += 1; return true; },
    currentAccountId: () => account,
    isOffline: () => offline,
    read: (...args) => readImpl(...args),
    resolve: async (request) => {
      calls.push(structuredClone(request));
      if (options.resolve) return options.resolve(request, calls.length);
      return structuredClone(resolveResponse);
    },
    onChange: () => { changes += 1; },
  });
  return {
    service,
    state: () => state,
    setState: (next) => { state = next; },
    setAccount: (next) => { account = next; },
    setOffline: (next) => { offline = next; },
    setResolve: (next) => { resolveResponse = next; },
    setRead: (next) => { readImpl = next; },
    calls,
    persisted: () => persisted,
    changes: () => changes,
  };
}

const loaded = device();
check(await loaded.service.load("game-a"), "authorized conflict summary is persisted locally");
check(Object.values(loaded.state().conflicts).length === 1 && loaded.persisted() === 1, "read stores one bounded conflict before rendering");
await loaded.service.queue(conflict().conflict_id, "keep_server");
check(loaded.calls.length === 1 && loaded.calls[0].request_hash.length === 64, "resolution persists a permanent operation ID and request hash before RPC");
check(Object.keys(loaded.state().conflicts).length === 0 && loaded.state().receipts.length === 1, "accepted resolution persists a receipt before compacting the conflict operation");

const reloaded = device({ initialState: JSON.parse(JSON.stringify({
  ...api.emptyState("account-a"),
  conflicts: { [conflict().conflict_id]: api.safeConflict(conflict()) },
})) });
check(reloaded.state().conflicts[conflict().conflict_id].proposedValues.opponent === "Saved",
  "bounded unresolved conflict and saved proposal survive serialized reload");

const offline = device({ offline: true });
await offline.service.load("game-a");
offline.setState({ ...api.emptyState("account-a"), conflicts: { [conflict().conflict_id]: api.safeConflict(conflict()) } });
const queuedOffline = await offline.service.queue(conflict().conflict_id, "apply_proposed");
check(queuedOffline === false && offline.calls.length === 0 && offline.state().operations[0].state === "pending", "offline resolution remains durable and performs no network work");
const immutablePayload = JSON.stringify(offline.state().operations[0].request);
offline.setOffline(false);
await offline.service.load("game-a");
check(offline.state().operations[0]?.state === "pending", "authorized conflict refresh preserves a pending durable resolution operation");
await offline.service.process();
check(JSON.stringify(offline.calls[0]) === immutablePayload, "retry sends the exact immutable resolution payload");

const stale = device({ resolveResponse: {
  outcome: "conflicted",
  code: "resolution_stale",
  conflict: conflict({
    conflict_id: "00000000-0000-4000-8000-000000000202",
    current_values: { opponent: "Newer" },
    proposed_values: { opponent: "Saved" },
    server_versions: { game: 4, metadata: 4, score: 1, status: 1, roster_context: 1, sharing: 1, clock: 0 },
  }),
} });
await stale.service.load("game-a");
await stale.service.queue(conflict().conflict_id, "apply_proposed");
check(!stale.state().conflicts[conflict().conflict_id]
  && stale.state().conflicts["00000000-0000-4000-8000-000000000202"]?.currentValues.opponent === "Newer",
"stale resolution replaces the local item with the linked latest conflict without losing the proposal");
await stale.service.process();
check(stale.calls.length === 1, "stale resolution becomes review-only and is never blindly retried");

const independentA = conflict({ conflict_id: "00000000-0000-4000-8000-000000000301", game_id: "game-a" });
const independentB = conflict({ conflict_id: "00000000-0000-4000-8000-000000000302", game_id: "game-b" });
const independent = device({
  offline: true,
  initialState: { ...api.emptyState("account-a"), conflicts: {
    [independentA.conflict_id]: api.safeConflict(independentA),
    [independentB.conflict_id]: api.safeConflict(independentB),
  } },
  resolve: async (_request, callNumber) => callNumber === 1 ? {
    outcome: "conflicted", code: "resolution_stale",
    conflict: conflict({ conflict_id: "00000000-0000-4000-8000-000000000303", game_id: "game-a", current_values: { opponent: "Newer" } }),
  } : { outcome: "accepted", code: "resolution_kept" },
});
await independent.service.queue(independentA.conflict_id, "apply_proposed");
await independent.service.queue(independentB.conflict_id, "keep_server");
independent.setOffline(false);
await independent.service.process();
check(independent.calls.length === 2 && independent.state().receipts.some((item) => item.conflictId === independentB.conflict_id),
  "one stale dependency blocks only its conflict while unrelated game work continues");

const rawFailure = device({ resolve: async () => { throw new Error("postgres secret row payload"); } });
await rawFailure.service.load("game-a");
await rawFailure.service.queue(conflict().conflict_id, "keep_server");
check(!JSON.stringify(rawFailure.state()).includes("postgres secret row payload")
  && Object.values(rawFailure.state().operations)[0]?.lastError?.code,
"RPC failures persist only a bounded classification code and never a raw server message");

const futureState = { ...api.emptyState("account-a"), schemaVersion: 99, futurePrivateShape: { raw: "must-remain-untouched" } };
const future = device({ initialState: futureState });
check(await future.service.load("game-a") === false
  && await future.service.queue(conflict().conflict_id, "keep_server") === false
  && future.calls.length === 0 && future.persisted() === 0
  && JSON.stringify(future.state()) === JSON.stringify(futureState),
"future conflict schema remains read-only with no RPC or local rewrite");

const revoked = device();
await revoked.service.load("game-a");
revoked.setRead(async () => ({ outcome: "rejected", code: "authorization_denied" }));
await revoked.service.load("game-a");
check(Object.keys(revoked.state().conflicts).length === 0, "revoked authority purges cached server conflict values for that game");

let releaseRead;
const switched = device({ read: () => new Promise((resolve) => { releaseRead = resolve; }) });
const inFlight = switched.service.load("game-a");
switched.setAccount("account-b");
releaseRead({ outcome: "accepted", conflicts: [conflict()] });
check(await inFlight === false && Object.keys(switched.state().conflicts).length === 0, "late account-A read is rejected after switching to account B");

const eventGame = { id: "game-a", lifecycleState: "active" };
const originalEvent = { id: "event-a", timestamp: "2026-08-09T12:00:00Z", quarter: "Q1", statType: "goal", statLabel: "Goal", category: "Offense", pointValue: 1, tags: [], note: "", fieldZone: "", serverEventVersion: 1 };
let eventState = eventApi.emptyState();
let serverVersion = 2;
const eventService = eventApi.createEventOperationService({
  getState: () => eventState,
  setState: (next) => { eventState = next; },
  persistState: () => true,
  currentAccountId: () => "account-a",
  isOffline: () => false,
  execute: async () => ({ outcome: "conflicted", code: "same_field_conflict", server_event_version: serverVersion }),
});
eventService.hydrate(eventGame, originalEvent);
eventService.queueEvent(eventGame, { ...originalEvent, note: "saved correction" });
await eventService.process();
eventService.markConflictRefreshed(eventGame, { ...originalEvent, note: "current correction", serverEventVersion: 2 }, { preserve: true });
check(eventState.conflicts[originalEvent.id].proposedValues.note === "saved correction"
  && eventState.conflicts[originalEvent.id].currentValues.note === "current correction",
"event refresh preserves the saved proposal while capturing the safe current value locally");
eventService.resolveConflict(eventGame, originalEvent.id, "keep_server");
check(!eventState.conflicts[originalEvent.id] && eventState.records[originalEvent.id].desiredSnapshot.note === "current correction", "event keep-current resolution clears only the affected local conflict");

const runtime = fs.readFileSync("runtime-config.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
check(runtime.includes("r207dConflictResolution: false"), "production R2-07D runtime flag defaults off");
check(app.includes("This game changed on another device. Your version is saved and needs review."), "minimum game conflict copy is nontechnical and exact");
check(app.includes("Keep current") && app.includes("Apply my version") && app.includes("Apply correction") && app.includes("Dismiss notice"), "minimum Needs Attention surface exposes all bounded actions");
check(app.includes('aria-labelledby="r207NeedsAttentionTitle"')
  && app.includes('role="group" aria-label="Current and saved values"')
  && app.includes('<div class="toast" role="status">')
  && app.includes('id="gameReviewTitle" tabindex="-1"')
  && app.includes("focusR207ResolutionOutcome();"),
"Needs Attention has screen-reader labels, live outcome announcement, and deterministic focus restoration");
const styles = fs.readFileSync("styles.css", "utf8");
check(styles.includes("@media (max-width: 430px)")
  && /\.r207-conflict-value-row,\s*\n\s*\.r207-resolution-actions\s*\{\s*\n\s*grid-template-columns:\s*1fr;/.test(styles)
  && styles.includes("min-height: var(--lh-tap-min)"),
"Needs Attention has a single-column mobile layout and minimum touch-target sizing");
const publicProjection = app.slice(app.indexOf("function publicLiveShareGameFromPayload"), app.indexOf("async function fetchPublicLiveShareGame"));
check(publicProjection.length > 0
  && !/r207Conflict|conflictId|proposedValues|currentValues|operationId|request_hash/.test(publicProjection),
"Live Share public projection remains isolated from private conflict and resolution evidence");
check(!/service[_-]?role|refresh[_-]?token|access[_-]?token/i.test(fs.readFileSync("supabase/migrations/20260809201608_r207d_conflict_resolution_foundation.sql", "utf8")), "R2-07D migration contains no credential material");

console.log(`R2-07D conflict resolution client: ${checks}/${checks} passed`);
