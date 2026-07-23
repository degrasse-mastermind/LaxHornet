(function initializeLaxHornetEventOperations(global) {
  "use strict";

  function requiredFunction(value, name) {
    if (typeof value !== "function") {
      throw new TypeError(`Event operation service requires ${name}`);
    }
    return value;
  }

  function createEventOperationService(hooks = {}) {
    const persistLocal = requiredFunction(hooks.persistLocal, "persistLocal");
    const queueEvent = requiredFunction(hooks.queueEvent, "queueEvent");
    const queueTombstone = requiredFunction(hooks.queueTombstone, "queueTombstone");
    const queueReconciliation = requiredFunction(hooks.queueReconciliation, "queueReconciliation");
    const syncLegacyEvent = requiredFunction(hooks.syncLegacyEvent, "syncLegacyEvent");
    const syncLegacyGame = requiredFunction(hooks.syncLegacyGame, "syncLegacyGame");
    const deleteLegacyEvent = requiredFunction(hooks.deleteLegacyEvent, "deleteLegacyEvent");
    const flushAuthoritativeQueue = requiredFunction(hooks.flushAuthoritativeQueue, "flushAuthoritativeQueue");
    const reconcileAuthoritativeGame = requiredFunction(hooks.reconcileAuthoritativeGame, "reconcileAuthoritativeGame");
    const canUseCloud = typeof hooks.canUseCloud === "function" ? hooks.canUseCloud : () => true;
    const requiresAuthoritativeHistory =
      typeof hooks.requiresAuthoritativeHistory === "function"
        ? hooks.requiresAuthoritativeHistory
        : () => true;
    const reportError = typeof hooks.reportError === "function" ? hooks.reportError : () => {};

    function runCloudWork(work) {
      if (!canUseCloud()) return Promise.resolve(false);
      return Promise.resolve()
        .then(work)
        .catch((error) => {
          reportError(error);
          return false;
        });
    }

    function applyLocalOperation(applyLocal, operationName) {
      const result = requiredFunction(applyLocal, `${operationName}.applyLocal`)();
      persistLocal();
      return result;
    }

    function normalizeLocalResult(result, fallbackGame) {
      if (result?.game && result?.event) return result;
      return { game: fallbackGame, event: result };
    }

    function createGameEventOperation({ game, applyLocal }) {
      const local = normalizeLocalResult(
        applyLocalOperation(applyLocal, "createGameEventOperation"),
        game,
      );
      if (!local.game?.id || !local.event?.id) throw new TypeError("Event creation requires a game and event");
      queueEvent(local.game, local.event);
      persistLocal();
      const cloudPromise = runCloudWork(async () => {
        const legacyResult = await syncLegacyEvent(local.game, local.event);
        if (legacyResult === false) return false;
        return Boolean(await flushAuthoritativeQueue({ gameId: local.game.id }));
      });
      return { ...local, cloudPromise };
    }

    function correctGameEventOperation({ game, applyLocal }) {
      const local = normalizeLocalResult(
        applyLocalOperation(applyLocal, "correctGameEventOperation"),
        game,
      );
      if (!local.game?.id || !local.event?.id) throw new TypeError("Event correction requires a game and event");
      queueEvent(local.game, local.event);
      persistLocal();
      const cloudPromise = runCloudWork(async () => {
        const legacyResult = await syncLegacyEvent(local.game, local.event);
        if (legacyResult === false) return false;
        return Boolean(await flushAuthoritativeQueue({ gameId: local.game.id }));
      });
      return { ...local, cloudPromise };
    }

    function tombstoneGameEventOperation({ game, reason, applyLocal }) {
      const local = normalizeLocalResult(
        applyLocalOperation(applyLocal, "tombstoneGameEventOperation"),
        game,
      );
      if (!local.game?.id || !local.event?.id) throw new TypeError("Event tombstone requires a game and event");
      queueTombstone(local.game, local.event, reason);
      persistLocal();
      const cloudPromise = runCloudWork(async () => {
        const legacyDeleteResult = await deleteLegacyEvent(local.event.id, { quiet: true });
        if (legacyDeleteResult === false) return false;
        const legacyGameResult = await syncLegacyGame(local.game);
        if (legacyGameResult === false) return false;
        return Boolean(await flushAuthoritativeQueue({ gameId: local.game.id }));
      });
      return { ...local, cloudPromise };
    }

    async function reconcileGameEventOperations(game) {
      if (!game?.id) return false;
      queueReconciliation(game);
      persistLocal();
      if (!canUseCloud()) return false;
      try {
        const legacyReady = await syncLegacyGame(game, { includeEvents: true });
        if (!legacyReady) return false;
        if (!requiresAuthoritativeHistory(game)) return true;
        return Boolean(await reconcileAuthoritativeGame(game));
      } catch (error) {
        reportError(error);
        return false;
      }
    }

    async function retryGameEventOperations(gameId = "") {
      if (!canUseCloud()) return false;
      try {
        return Boolean(await flushAuthoritativeQueue({ gameId }));
      } catch (error) {
        reportError(error);
        return false;
      }
    }

    return Object.freeze({
      createGameEventOperation,
      correctGameEventOperation,
      tombstoneGameEventOperation,
      reconcileGameEventOperations,
      retryGameEventOperations,
    });
  }

  global.LaxHornetEventOperations = Object.freeze({
    createEventOperationService,
  });
})(window);
