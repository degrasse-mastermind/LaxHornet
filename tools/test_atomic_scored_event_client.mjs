import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "event-operation-service.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");
const preview = fs.readFileSync(path.join(root, "tools", "build_r207b_vercel_preview.mjs"), "utf8");
const context = { window: {}, crypto: { randomUUID: () => `atomic-${Math.random()}` } };
vm.createContext(context);
vm.runInContext(source, context);

const api = context.window.LaxHornetR207EventOperations;
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks += 1;
  console.log(`PASS: ${label}`);
};

let state = api.emptyState();
let prepareCount = 0;
let executeCount = 0;
let acceptedState = null;
let failNetwork = true;
const service = api.createEventOperationService({
  getState: () => state,
  setState: (next) => { state = next; },
  persistState: () => true,
  currentAccountId: () => "account-a",
  isOffline: () => false,
  prepareOperation: (operation) => {
    prepareCount += 1;
    return {
      rpc: "atomic_scored_event",
      operation: {
        client_operation_id: operation.clientOperationId,
        game_id: operation.gameId,
        event_id: operation.eventId,
        action: operation.type,
        changes: operation.payload.changes,
        base_event_version: operation.payload.base_event_version,
        base_score_version: 7,
        base_status_version: 3,
        expected_game_lifecycle: operation.payload.expected_game_lifecycle,
        client_created_at: operation.payload.client_created_at,
      },
    };
  },
  execute: async (request) => {
    executeCount += 1;
    if (failNetwork) {
      failNetwork = false;
      throw { code: "network_unavailable", status: 0 };
    }
    check(request.rpc === "atomic_scored_event", "prepared scored event selects the composite RPC");
    check(request.operation.base_score_version === 7 && request.operation.base_status_version === 3,
      "prepared request retains its exact first-attempt server bases");
    return {
      outcome: "accepted",
      code: "scored_event_created",
      server_event_version: 1,
      versions: { score_version: 8, status_version: 3 },
      server_game: { score_for: 1, score_against: 0, score_known: true, lifecycle_state: "active" },
    };
  },
  onAccepted: (_operation, _result, nextState) => { acceptedState = nextState; },
});

const game = { id: "game-a", lifecycleState: "active" };
const event = {
  id: "event-a",
  timestamp: "2026-08-12T01:00:00Z",
  quarter: "Q1",
  statType: "goal",
  statLabel: "Goal",
  category: "Offense",
  pointValue: 1,
  tags: [],
  note: "",
  fieldZone: "",
};

service.queueEvent(game, event);
await service.process({ gameId: game.id });
const retryable = state.operations[0];
check(retryable.state === "retryable", "network loss keeps the scored event retryable");
check(retryable.preparedRequest.operation.base_score_version === 7, "first-attempt composite request is durably stored");
await service.process({ gameId: game.id });
check(prepareCount === 1 && executeCount === 2, "retry reuses one permanent prepared request without re-finalizing");
check(state.operations.length === 0 && state.receipts.length === 1, "accepted composite operation compacts to one receipt");
check(acceptedState && acceptedState.records["event-a"].serverEventVersion === 1,
  "accepted callback observes the next durable event state");

let blockedState = api.emptyState();
let blockedExecutions = 0;
const blocked = api.createEventOperationService({
  getState: () => blockedState,
  setState: (next) => { blockedState = next; },
  persistState: () => true,
  currentAccountId: () => "account-a",
  isOffline: () => false,
  prepareOperation: () => { throw new TypeError("missing hydrated score base"); },
  execute: async () => { blockedExecutions += 1; return { outcome: "accepted" }; },
});
blocked.queueEvent(game, { ...event, id: "event-blocked" });
await blocked.process({ gameId: game.id });
check(blockedExecutions === 0
  && blockedState.operations[0].state === "blocked"
  && blockedState.operations[0].lastError.code === "validation_failed",
"missing hydrated base fails closed before network execution");

check(runtime.includes("r207AtomicScoredEvents: false"), "production runtime keeps atomic scored events default-off");
check(preview.includes('.replace("r207AtomicScoredEvents: false", "r207AtomicScoredEvents: true")'),
  "isolated Vercel Preview explicitly enables the composite client");
check(app.includes('rpcName = envelope.rpc === "atomic_scored_event"')
  && app.includes('"laxhornet_apply_scored_event_v1"')
  && !app.includes('laxhornet_apply_scored_event_v1") ||'),
"scored-event execution names one composite RPC without a split-write fallback");
check(app.includes("&& !pendingAtomicScoredEventForGame(current.id)"),
  "ordinary game sync suppresses duplicate score correction while composite intents are pending");
check(app.includes("local_score:")
  && app.includes("localScoreChangedAfterPreparation")
  && app.includes("laterScoredOperations || localScoreChangedAfterPreparation"),
"accepted server scores do not overwrite later local scoring edits");

console.log(`LH-25 atomic scored-event client: ${checks}/${checks} passed`);
