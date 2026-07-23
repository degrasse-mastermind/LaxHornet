import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "event-operation-service.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: "event-operation-service.js" });

function harness({ online = true, authoritative = true, flushResult = true } = {}) {
  const calls = [];
  const hooks = {
    persistLocal: () => calls.push("persist"),
    queueEvent: (_game, event) => calls.push(`queue:${event.id}`),
    queueTombstone: (_game, event) => calls.push(`tombstone:${event.id}`),
    queueReconciliation: (game) => calls.push(`reconcile-queue:${game.id}`),
    syncLegacyEvent: async (_game, event) => {
      calls.push(`legacy-event:${event.id}`);
      return true;
    },
    syncLegacyGame: async (game, options = {}) => {
      calls.push(`legacy-game:${game.id}:${Boolean(options.includeEvents)}`);
      return true;
    },
    deleteLegacyEvent: async (eventId) => {
      calls.push(`legacy-delete:${eventId}`);
      return true;
    },
    flushAuthoritativeQueue: async ({ gameId }) => {
      calls.push(`flush:${gameId}`);
      return flushResult;
    },
    reconcileAuthoritativeGame: async (game) => {
      calls.push(`authoritative-reconcile:${game.id}`);
      return true;
    },
    canUseCloud: () => online,
    requiresAuthoritativeHistory: () => authoritative,
    reportError: (error) => calls.push(`error:${error.message}`),
  };
  return {
    calls,
    service: context.window.LaxHornetEventOperations.createEventOperationService(hooks),
  };
}

const game = { id: "game-1" };
const event = { id: "event-1" };

{
  const { calls, service } = harness();
  const operation = service.createGameEventOperation({
    game,
    applyLocal: () => {
      calls.push("local-create");
      return event;
    },
  });
  assert.deepEqual(calls, ["local-create", "persist", "queue:event-1", "persist"]);
  assert.equal(await operation.cloudPromise, true);
  assert.deepEqual(calls.slice(-2), ["legacy-event:event-1", "flush:game-1"]);
}

{
  const { calls, service } = harness({ online: false });
  const operation = service.correctGameEventOperation({
    game,
    applyLocal: () => {
      calls.push("local-correct");
      return event;
    },
  });
  assert.equal(await operation.cloudPromise, false);
  assert.equal(calls.includes("legacy-event:event-1"), false);
  assert.equal(calls.includes("queue:event-1"), true);
}

{
  const { calls, service } = harness();
  const operation = service.tombstoneGameEventOperation({
    game,
    reason: "test",
    applyLocal: () => {
      calls.push("local-tombstone");
      return event;
    },
  });
  assert.equal(await operation.cloudPromise, true);
  assert.deepEqual(
    calls.filter((call) => call.startsWith("legacy-") || call.startsWith("flush:")),
    ["legacy-delete:event-1", "legacy-game:game-1:false", "flush:game-1"],
  );
}

{
  const { calls, service } = harness({ authoritative: false });
  assert.equal(await service.reconcileGameEventOperations(game), true);
  assert.equal(calls.includes("authoritative-reconcile:game-1"), false);
  assert.equal(calls.includes("legacy-game:game-1:true"), true);
}

{
  const { calls, service } = harness({ flushResult: false });
  assert.equal(await service.retryGameEventOperations("game-1"), false);
  assert.deepEqual(calls, ["flush:game-1"]);
}

assert.match(appSource, /function trustSpineOperationId\(/);
assert.match(appSource, /stableTrustSpineJSON\(value\)/);
assert.match(appSource, /client_operation_id: trustSpineOperationId\("create"/);
assert.match(appSource, /client_operation_id: trustSpineOperationId\("correct"/);
assert.match(appSource, /clientOperationId: trustSpineOperationId\("tombstone"/);

for (const operation of [
  "createGameEventOperation",
  "correctGameEventOperation",
  "tombstoneGameEventOperation",
  "reconcileGameEventOperations",
]) {
  assert.match(appSource, new RegExp(`function ${operation.replace("GameEventOperation", "GameEventOperation")}`));
}

const includeEventCallers = [...appSource.matchAll(/syncGameToSupabase\([^;\n]+includeEvents:\s*true[^;\n]*\)/g)];
assert.equal(includeEventCallers.length, 0, "app callers must not bypass the operation service with includeEvents");
assert.doesNotMatch(source, /notes|tags/i, "operation service must not project notes or tags");

console.log("Event operation service contracts passed.");
