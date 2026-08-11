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
let dismissChecks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; console.log(`PASS: ${label}`); };
const dismissCheck = (condition, label) => { assert.ok(condition, label); dismissChecks += 1; console.log(`PASS: ${label}`); };
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

async function eventConflictFixture(options = {}) {
  const game = { id: options.gameId || "dismiss-game", lifecycleState: "active" };
  const event = {
    ...originalEvent,
    id: options.eventId || "dismiss-event",
    note: options.originalNote || "local original",
    serverEventVersion: 1,
  };
  let state = options.initialState || eventApi.emptyState();
  let persisted = 0;
  let executeCalls = 0;
  const service = eventApi.createEventOperationService({
    getState: () => state,
    setState: (next) => { state = next; },
    persistState: () => { persisted += 1; return true; },
    currentAccountId: () => "account-a",
    isOffline: () => false,
    execute: async (request) => {
      executeCalls += 1;
      if (options.execute) return options.execute(request, executeCalls);
      return { outcome: "conflicted", code: "same_field_conflict", server_event_version: 2 };
    },
  });
  if (!options.initialState) {
    service.hydrate(game, event);
    service.queueEvent(game, { ...event, note: options.proposedNote || "saved proposal" });
    await service.process();
    service.markConflictRefreshed(game, {
      ...event,
      note: options.currentNote || "current server",
      serverEventVersion: 2,
    }, { preserve: true });
  }
  return {
    event, game, service,
    state: () => state,
    persisted: () => persisted,
    executeCalls: () => executeCalls,
  };
}

const dismissedEvent = await eventConflictFixture();
const dismissedRecordBefore = structuredClone(dismissedEvent.state().records[dismissedEvent.event.id]);
const dismissedOperationCount = dismissedEvent.state().operations.length;
const dismissedExecuteCount = dismissedEvent.executeCalls();
dismissedEvent.service.resolveConflict(dismissedEvent.game, dismissedEvent.event.id, "dismiss");
const dismissedRecordAfter = dismissedEvent.state().records[dismissedEvent.event.id];
dismissCheck(!dismissedEvent.state().conflicts[dismissedEvent.event.id]
  && dismissedEvent.state().operations.some((operation) => operation.eventId === dismissedEvent.event.id && operation.state === "superseded"),
"event dismiss terminally clears Needs Attention and supersedes only the conflicted attempt");
dismissCheck(JSON.stringify(dismissedRecordAfter) === JSON.stringify(dismissedRecordBefore)
  && dismissedRecordAfter.desiredSnapshot.note === "saved proposal",
"event dismiss preserves the complete pre-dismiss local event record");
dismissCheck(dismissedRecordAfter.desiredSnapshot.note !== dismissedRecordAfter.acceptedSnapshot.note
  && dismissedRecordAfter.desiredSnapshot.note === "saved proposal",
"event dismiss copies neither the current server value nor a new proposal");
dismissCheck(dismissedEvent.state().operations.length === dismissedOperationCount
  && dismissedEvent.executeCalls() === dismissedExecuteCount
  && dismissedRecordAfter.serverEventVersion === dismissedRecordBefore.serverEventVersion,
"event dismiss creates no operation, RPC call, or event-version change");

const keptEvent = await eventConflictFixture({ eventId: "keep-distinct-event" });
keptEvent.service.resolveConflict(keptEvent.game, keptEvent.event.id, "keep_server");
dismissCheck(keptEvent.state().records[keptEvent.event.id].desiredSnapshot.note === "current server",
"event keep_server continues reconciling to the authoritative current value");
dismissCheck(keptEvent.state().records[keptEvent.event.id].desiredSnapshot.note
  !== dismissedRecordAfter.desiredSnapshot.note,
"event dismiss and keep_server produce observably different local outcomes");

const beforeDismissReplay = JSON.stringify(dismissedEvent.state());
dismissedEvent.service.resolveConflict(dismissedEvent.game, dismissedEvent.event.id, "dismiss");
dismissCheck(JSON.stringify(dismissedEvent.state()) === beforeDismissReplay,
"event dismiss replay is idempotent and does not mutate the event");

const reloadSource = await eventConflictFixture({ eventId: "reload-dismiss-event", proposedNote: "reload proposal" });
const reloadState = JSON.parse(JSON.stringify(reloadSource.state()));
const reloadedEvent = await eventConflictFixture({ initialState: reloadState, eventId: "reload-dismiss-event" });
const reloadRecordBefore = JSON.stringify(reloadedEvent.state().records["reload-dismiss-event"]);
reloadedEvent.service.resolveConflict(reloadedEvent.game, "reload-dismiss-event", "dismiss");
dismissCheck(JSON.stringify(reloadedEvent.state().records["reload-dismiss-event"]) === reloadRecordBefore,
"event dismiss remains acknowledgment-only after serialized reload");

const staleDismiss = await eventConflictFixture({ eventId: "stale-dismiss-event", proposedNote: "stale local proposal", currentNote: "newest server" });
staleDismiss.service.resolveConflict(staleDismiss.game, staleDismiss.event.id, "dismiss");
dismissCheck(staleDismiss.state().records[staleDismiss.event.id].desiredSnapshot.note === "stale local proposal"
  && staleDismiss.state().records[staleDismiss.event.id].acceptedSnapshot.note === "newest server",
"event dismiss does not apply or replace a stale local proposal");

const unrelated = { ...originalEvent, id: "unrelated-event", note: "unrelated current", serverEventVersion: 1 };
const dismissedSnapshotBeforeUnrelatedWork = JSON.stringify(staleDismiss.state().records[staleDismiss.event.id]);
staleDismiss.service.hydrate(staleDismiss.game, unrelated);
staleDismiss.service.queueEvent(staleDismiss.game, { ...unrelated, note: "unrelated edit" });
dismissCheck(staleDismiss.state().operations.some((operation) => operation.eventId === unrelated.id && operation.type === "correct")
  && JSON.stringify(staleDismiss.state().records[staleDismiss.event.id]) === dismissedSnapshotBeforeUnrelatedWork,
"event dismiss leaves unrelated event work usable without revisiting dismissed content");

const futureEventState = { ...eventApi.emptyState(), schemaVersion: 99, privateFutureShape: { raw: "preserve" } };
const futureEvent = await eventConflictFixture({ initialState: futureEventState, eventId: "future-event" });
const futureEventBefore = JSON.stringify(futureEvent.state());
const futureDismissResult = futureEvent.service.resolveConflict(futureEvent.game, "future-event", "dismiss");
dismissCheck(futureDismissResult.code === "client_upgrade_required"
  && JSON.stringify(futureEvent.state()) === futureEventBefore && futureEvent.persisted() === 0,
"future-schema guard prevents dismiss from rewriting newer durable event state");

let deniedState = eventApi.emptyState();
const deniedService = eventApi.createEventOperationService({
  getState: () => deniedState,
  setState: (next) => { deniedState = next; },
  persistState: () => true,
  currentAccountId: () => "account-a",
  isOffline: () => false,
  execute: async () => ({ outcome: "rejected", code: "authorization_denied", message: "private raw server detail" }),
});
const deniedEvent = { ...originalEvent, id: "denied-event", note: "local denied value", serverEventVersion: 1 };
deniedService.hydrate(eventGame, deniedEvent);
deniedService.queueEvent(eventGame, { ...deniedEvent, note: "local denied proposal" });
const deniedRecordBefore = structuredClone(deniedState.records[deniedEvent.id]);
await deniedService.process();
dismissCheck(deniedState.records[deniedEvent.id].desiredSnapshot.note === deniedRecordBefore.desiredSnapshot.note
  && deniedState.records[deniedEvent.id].serverEventVersion === deniedRecordBefore.serverEventVersion
  && !JSON.stringify(deniedState).includes("private raw server detail"),
"authorization failure preserves local event content and stores no raw server message");

const tombstonedDismiss = await eventConflictFixture({ eventId: "tombstoned-dismiss-event" });
tombstonedDismiss.state().records[tombstonedDismiss.event.id].lifecycleState = "tombstoned";
const tombstonedRecordBefore = JSON.stringify(tombstonedDismiss.state().records[tombstonedDismiss.event.id]);
const tombstonedOperationCount = tombstonedDismiss.state().operations.length;
tombstonedDismiss.service.resolveConflict(tombstonedDismiss.game, tombstonedDismiss.event.id, "dismiss");
dismissCheck(JSON.stringify(tombstonedDismiss.state().records[tombstonedDismiss.event.id]) === tombstonedRecordBefore
  && tombstonedDismiss.state().operations.length === tombstonedOperationCount
  && tombstonedDismiss.state().records[tombstonedDismiss.event.id].lifecycleState === "tombstoned",
"event dismiss cannot reconcile or resurrect tombstoned event state");

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

console.log(`R2-07D event dismiss semantics: ${dismissChecks}/${dismissChecks} passed`);
console.log(`R2-07D conflict resolution client: ${checks}/${checks} passed`);
