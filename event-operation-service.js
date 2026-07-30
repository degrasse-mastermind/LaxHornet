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

(function initializeLaxHornetDurableSyncOperations(global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const OPERATION_TYPES = Object.freeze({
    game: "legacy_game_write",
    clock: "tracked_clock_write",
  });
  const OPERATION_STATES = Object.freeze([
    "pending",
    "syncing",
    "accepted",
    "retryable",
    "rejected",
    "conflicted",
  ]);
  const RETRY_BASE_MS = 2000;
  const RETRY_MAX_MS = 5 * 60 * 1000;
  const MAX_ACKNOWLEDGMENTS = 100;

  function requiredFunction(value, name) {
    if (typeof value !== "function") {
      throw new TypeError(`Durable sync operations require ${name}`);
    }
    return value;
  }

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function copy(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function canonicalValue(value) {
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (!isObject(value)) return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }

  function hashText(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function payloadHash(payload) {
    return hashText(JSON.stringify(canonicalValue(payload)));
  }

  function isoTimestamp(value = Date.now()) {
    const milliseconds = typeof value === "number" ? value : Date.parse(String(value || ""));
    if (!Number.isFinite(milliseconds)) return new Date().toISOString();
    return new Date(milliseconds).toISOString();
  }

  function normalizedError(value = null) {
    if (!value) return null;
    if (typeof value === "string") {
      return { code: "sync_error", message: value.slice(0, 240) };
    }
    return {
      code: String(value.code || value.outcome || "sync_error").trim().slice(0, 80),
      message: String(value.message || value.code || "Synchronization needs attention.")
        .trim()
        .slice(0, 240),
    };
  }

  function normalizedReceipt(value = null) {
    if (!isObject(value)) return null;
    const serverRevision = Number(value.serverRevision);
    return {
      code: String(value.code || "accepted").trim().slice(0, 80),
      acknowledgment: String(value.acknowledgment || "accepted_response")
        .trim()
        .slice(0, 80),
      serverRevision: Number.isInteger(serverRevision) && serverRevision >= 0
        ? serverRevision
        : null,
      serverTimestamp: value.serverTimestamp
        ? isoTimestamp(value.serverTimestamp)
        : null,
    };
  }

  function isStoredState(value) {
    if (Array.isArray(value)) return value.every(isObject);
    if (!isObject(value)) return false;
    if (!Array.isArray(value.operations) || !value.operations.every(isObject)) return false;
    if (value.schemaVersion !== undefined) {
      const version = Number(value.schemaVersion);
      if (!Number.isInteger(version) || version < 1) return false;
    }
    if (value.acknowledgments !== undefined && !isObject(value.acknowledgments)) return false;
    return true;
  }

  function normalizedOperation(operation, options = {}) {
    if (!isObject(operation)) return null;
    const operationType = Object.values(OPERATION_TYPES).includes(operation.operationType)
      ? operation.operationType
      : "";
    const operationId = String(operation.operationId || "").trim();
    const accountId = String(operation.accountId || options.accountId || "").trim();
    const gameId = String(operation.gameId || "").trim();
    if (!operationType || !operationId || !accountId || !gameId || !isObject(operation.payload)) {
      return null;
    }
    const rawPayloadRevision = Number(operation.payloadRevision);
    const payloadRevision = Number.isInteger(rawPayloadRevision) && rawPayloadRevision > 0
      ? rawPayloadRevision
      : 1;
    const storedState = OPERATION_STATES.includes(operation.state)
      ? operation.state
      : "pending";
    const recoveredState = storedState === "syncing" ? "retryable" : storedState;
    const createdAt = isoTimestamp(operation.createdAt || options.now());
    const updatedAt = isoTimestamp(operation.updatedAt || createdAt);
    const baseRevision = operation.baseRevision === null || operation.baseRevision === undefined
      ? null
      : Number(operation.baseRevision);
    return {
      operationId,
      operationType,
      accountId,
      gameId,
      deviceId: String(operation.deviceId || options.deviceId || "").trim(),
      coalescingKey: String(
        operation.coalescingKey
        || `${operationType}:${gameId}`,
      ).trim(),
      createdAt,
      updatedAt,
      attemptCount: Math.max(0, Number(operation.attemptCount || 0)),
      lastAttemptAt: operation.lastAttemptAt
        ? isoTimestamp(operation.lastAttemptAt)
        : null,
      nextAttemptAt: recoveredState === "retryable" && storedState === "syncing"
        ? null
        : operation.nextAttemptAt
          ? isoTimestamp(operation.nextAttemptAt)
          : null,
      state: recoveredState,
      payload: copy(operation.payload),
      payloadHash: String(operation.payloadHash || payloadHash(operation.payload)),
      payloadRevision,
      baseRevision: Number.isInteger(baseRevision) && baseRevision >= 0
        ? baseRevision
        : null,
      lastError: storedState === "syncing"
        ? {
            code: "interrupted_sync",
            message: "The previous synchronization attempt ended before acknowledgment.",
          }
        : normalizedError(operation.lastError),
      receipt: normalizedReceipt(operation.receipt),
    };
  }

  function trimAcknowledgments(acknowledgments = {}) {
    return Object.fromEntries(
      Object.entries(acknowledgments)
        .filter(([, receipt]) => isObject(receipt) && receipt.payloadHash)
        .sort(([, left], [, right]) =>
          Date.parse(right.acceptedAt || 0) - Date.parse(left.acceptedAt || 0))
        .slice(0, MAX_ACKNOWLEDGMENTS)
        .map(([key, receipt]) => [
          key,
          {
            operationId: String(receipt.operationId || "").trim(),
            operationType: String(receipt.operationType || "").trim(),
            gameId: String(receipt.gameId || "").trim(),
            payloadHash: String(receipt.payloadHash || "").trim(),
            payloadRevision: Math.max(1, Number(receipt.payloadRevision || 1)),
            acceptedAt: isoTimestamp(receipt.acceptedAt || Date.now()),
            receipt: normalizedReceipt(receipt.receipt),
          },
        ]),
    );
  }

  function normalizeState(value = null, options = {}) {
    const now = typeof options.now === "function"
      ? options.now
      : () => new Date().toISOString();
    const createId = typeof options.createId === "function"
      ? options.createId
      : (prefix) => `${prefix}-${Date.now()}`;
    const source = Array.isArray(value)
      ? { operations: value }
      : isObject(value)
        ? value
        : {};
    const version = Number(source.schemaVersion || SCHEMA_VERSION);
    if (Number.isInteger(version) && version > SCHEMA_VERSION) {
      return copy(source);
    }
    const deviceId = String(source.deviceId || options.deviceId || createId("device")).trim();
    const normalized = {
      schemaVersion: SCHEMA_VERSION,
      deviceId,
      operations: (Array.isArray(source.operations) ? source.operations : [])
        .map((operation) => normalizedOperation(operation, {
          accountId: options.accountId,
          deviceId,
          now,
        }))
        .filter(Boolean),
      acknowledgments: trimAcknowledgments(source.acknowledgments),
    };
    normalized.operations = normalized.operations.filter((operation) => {
      if (operation.state !== "accepted") return true;
      const key = operation.operationType === OPERATION_TYPES.game
        ? `${operation.operationType}:${operation.gameId}`
        : `${operation.operationType}:${operation.gameId}:${operation.payloadHash}`;
      return normalized.acknowledgments[key]?.payloadHash !== operation.payloadHash;
    });
    return normalized;
  }

  function classifyFailure(error = {}) {
    const code = String(error.code || error.name || "").toLowerCase();
    const message = String(error.message || error.code || "Synchronization failed.");
    const status = Number(error.status || error.statusCode || 0);
    if (
      code.includes("stale_clock_revision")
      || code.includes("conflict")
      || status === 409
    ) {
      return { outcome: "conflicted", code: code || "conflict", message };
    }
    if (
      status === 0
      || status === 408
      || status === 429
      || status >= 500
      || /network|fetch|timeout|temporar|unavailable|rate.?limit/i.test(`${code} ${message}`)
    ) {
      return { outcome: "retryable", code: code || "transport_failure", message };
    }
    return { outcome: "rejected", code: code || "request_rejected", message };
  }

  function retryDelayMs(attemptCount) {
    const exponent = Math.max(0, Math.min(10, Number(attemptCount || 1) - 1));
    return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** exponent));
  }

  function createDurableSyncOperationService(hooks = {}) {
    const getState = requiredFunction(hooks.getState, "getState");
    const setState = requiredFunction(hooks.setState, "setState");
    const persistState = requiredFunction(hooks.persistState, "persistState");
    const currentAccountId = requiredFunction(hooks.currentAccountId, "currentAccountId");
    const executeOperation = requiredFunction(hooks.executeOperation, "executeOperation");
    const isOffline = typeof hooks.isOffline === "function" ? hooks.isOffline : () => false;
    const createId = typeof hooks.createId === "function"
      ? hooks.createId
      : (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const now = typeof hooks.now === "function"
      ? hooks.now
      : () => new Date().toISOString();
    let processor = null;

    function supportedState() {
      const value = getState();
      return value?.schemaVersion === SCHEMA_VERSION ? value : null;
    }

    function replaceAndPersist(nextState, previousState) {
      setState(nextState);
      if (persistState(nextState) !== false) return true;
      setState(previousState);
      return false;
    }

    function acknowledgmentKey(operationType, gameId, hash) {
      return operationType === OPERATION_TYPES.game
        ? `${operationType}:${gameId}`
        : `${operationType}:${gameId}:${hash}`;
    }

    function isAcknowledged(operationType, gameId, payload) {
      const state = supportedState();
      if (!state) return false;
      const hash = payloadHash(payload);
      return state.acknowledgments[
        acknowledgmentKey(operationType, gameId, hash)
      ]?.payloadHash === hash;
    }

    function queue(operationType, gameId, payload, options = {}) {
      const state = supportedState();
      const accountId = String(options.accountId || currentAccountId() || "").trim();
      if (!state || !accountId || !gameId || !isObject(payload)) return null;
      const hash = payloadHash(payload);
      if (isAcknowledged(operationType, gameId, payload)) {
        return { operationId: "", payloadHash: hash, alreadyAccepted: true };
      }

      const coalescingKey = operationType === OPERATION_TYPES.game
        ? `${operationType}:${gameId}`
        : `${operationType}:${gameId}:${hash}`;
      const existingIndex = state.operations.findIndex((operation) =>
        operation.accountId === accountId
        && operation.coalescingKey === coalescingKey
        && operation.state !== "accepted");
      if (existingIndex >= 0 && state.operations[existingIndex].payloadHash === hash) {
        const existing = state.operations[existingIndex];
        return {
          operationId: existing.operationId,
          payloadHash: hash,
          alreadyAccepted: false,
          state: existing.state,
        };
      }

      const timestamp = isoTimestamp(now());
      const next = copy(state);
      if (existingIndex >= 0) {
        const existing = next.operations[existingIndex];
        next.operations[existingIndex] = {
          ...existing,
          updatedAt: timestamp,
          state: "pending",
          payload: copy(payload),
          payloadHash: hash,
          payloadRevision: existing.payloadRevision + 1,
          baseRevision: options.baseRevision !== null
            && options.baseRevision !== undefined
            && Number.isInteger(Number(options.baseRevision))
            ? Number(options.baseRevision)
            : null,
          nextAttemptAt: null,
          lastError: null,
          receipt: existing.receipt,
        };
      } else {
        next.operations.push({
          operationId: createId("sync-operation"),
          operationType,
          accountId,
          gameId,
          deviceId: state.deviceId,
          coalescingKey,
          createdAt: timestamp,
          updatedAt: timestamp,
          attemptCount: 0,
          lastAttemptAt: null,
          nextAttemptAt: null,
          state: "pending",
          payload: copy(payload),
          payloadHash: hash,
          payloadRevision: 1,
          baseRevision: options.baseRevision !== null
            && options.baseRevision !== undefined
            && Number.isInteger(Number(options.baseRevision))
            ? Number(options.baseRevision)
            : null,
          lastError: null,
          receipt: null,
        });
      }
      if (!replaceAndPersist(next, state)) return null;
      const queued = next.operations.find((operation) => operation.coalescingKey === coalescingKey);
      return {
        operationId: queued.operationId,
        payloadHash: queued.payloadHash,
        alreadyAccepted: false,
        state: queued.state,
      };
    }

    function queueGame({ accountId, gameId, payload }) {
      return queue(OPERATION_TYPES.game, gameId, payload, { accountId });
    }

    function queueClock({ accountId, gameId, payload, baseRevision = null }) {
      return queue(OPERATION_TYPES.clock, gameId, payload, {
        accountId,
        baseRevision,
      });
    }

    function eligibleOperation(state, accountId, timestamp) {
      const operations = state.operations
        .filter((operation) => operation.accountId === accountId)
        .sort((left, right) => {
          if (left.operationType !== right.operationType) {
            return left.operationType === OPERATION_TYPES.game ? -1 : 1;
          }
          if (left.operationType === OPERATION_TYPES.clock) {
            const revisionDifference = Number(left.baseRevision ?? -1)
              - Number(right.baseRevision ?? -1);
            if (revisionDifference) return revisionDifference;
          }
          return Date.parse(left.createdAt) - Date.parse(right.createdAt);
        });

      const firstClockByGame = new Map();
      for (const operation of operations) {
        if (operation.operationType === OPERATION_TYPES.clock) {
          if (firstClockByGame.has(operation.gameId)) continue;
          firstClockByGame.set(operation.gameId, operation);
        }
        if (!["pending", "retryable"].includes(operation.state)) continue;
        if (
          operation.nextAttemptAt
          && Date.parse(operation.nextAttemptAt) > timestamp
        ) {
          continue;
        }
        if (
          operation.operationType === OPERATION_TYPES.clock
          && firstClockByGame.get(operation.gameId)?.operationId !== operation.operationId
        ) {
          continue;
        }
        return operation;
      }
      return null;
    }

    function markAttempt(operationId) {
      const state = supportedState();
      if (!state) return null;
      const index = state.operations.findIndex((operation) => operation.operationId === operationId);
      if (index < 0) return null;
      const next = copy(state);
      const timestamp = isoTimestamp(now());
      next.operations[index] = {
        ...next.operations[index],
        state: "syncing",
        attemptCount: next.operations[index].attemptCount + 1,
        lastAttemptAt: timestamp,
        nextAttemptAt: null,
        updatedAt: timestamp,
        lastError: null,
      };
      return replaceAndPersist(next, state) ? copy(next.operations[index]) : null;
    }

    function applyFailure(operationId, failure) {
      const state = supportedState();
      if (!state) return false;
      const index = state.operations.findIndex((operation) => operation.operationId === operationId);
      if (index < 0) return false;
      const next = copy(state);
      const operation = next.operations[index];
      const timestamp = isoTimestamp(now());
      const outcome = ["retryable", "rejected", "conflicted"].includes(failure.outcome)
        ? failure.outcome
        : "rejected";
      next.operations[index] = {
        ...operation,
        state: outcome,
        updatedAt: timestamp,
        nextAttemptAt: outcome === "retryable"
          ? isoTimestamp(Date.parse(timestamp) + retryDelayMs(operation.attemptCount))
          : null,
        lastError: normalizedError(failure),
        receipt: outcome === "conflicted"
          ? normalizedReceipt(failure.receipt)
          : operation.receipt,
      };
      return replaceAndPersist(next, state);
    }

    function applyAcceptance(attempted, result) {
      const state = supportedState();
      if (!state) return false;
      const index = state.operations.findIndex(
        (operation) => operation.operationId === attempted.operationId,
      );
      if (index < 0) return false;
      const current = state.operations[index];
      const timestamp = isoTimestamp(now());
      const receipt = {
        operationId: attempted.operationId,
        operationType: attempted.operationType,
        gameId: attempted.gameId,
        payloadHash: attempted.payloadHash,
        payloadRevision: attempted.payloadRevision,
        acceptedAt: timestamp,
        receipt: normalizedReceipt(result.receipt),
      };
      const key = acknowledgmentKey(
        attempted.operationType,
        attempted.gameId,
        attempted.payloadHash,
      );
      const next = copy(state);
      next.acknowledgments[key] = receipt;
      next.acknowledgments = trimAcknowledgments(next.acknowledgments);
      const payloadStillCurrent = current.payloadHash === attempted.payloadHash
        && current.payloadRevision === attempted.payloadRevision;
      next.operations[index] = {
        ...current,
        state: payloadStillCurrent ? "accepted" : "pending",
        updatedAt: timestamp,
        nextAttemptAt: null,
        lastError: null,
        receipt: receipt.receipt,
      };
      if (!replaceAndPersist(next, state)) return false;
      if (!payloadStillCurrent) return false;

      const acceptedState = supportedState();
      const compacted = copy(acceptedState);
      compacted.operations = compacted.operations.filter(
        (operation) => operation.operationId !== attempted.operationId,
      );
      replaceAndPersist(compacted, acceptedState);
      return true;
    }

    async function runForAccount(accountId) {
      if (!accountId || isOffline()) return false;
      let anyAccepted = false;
      for (let processed = 0; processed < 100; processed += 1) {
        if (currentAccountId() !== accountId || isOffline()) break;
        const state = supportedState();
        if (!state) break;
        const operation = eligibleOperation(state, accountId, Date.parse(isoTimestamp(now())));
        if (!operation) break;
        const attempted = markAttempt(operation.operationId);
        if (!attempted) break;
        let result;
        try {
          result = await executeOperation(copy(attempted));
        } catch (error) {
          result = classifyFailure(error);
        }
        if (currentAccountId() !== accountId) break;
        if (result?.outcome === "accepted") {
          anyAccepted = applyAcceptance(attempted, result) || anyAccepted;
        } else {
          applyFailure(
            attempted.operationId,
            result?.outcome ? result : classifyFailure(result || {}),
          );
        }
      }
      return anyAccepted;
    }

    function process() {
      const accountId = currentAccountId();
      if (!accountId) return Promise.resolve(false);
      if (processor) {
        return processor.accountId === accountId
          ? processor.promise
          : processor.promise.then(() => process());
      }
      const promise = runForAccount(accountId).finally(() => {
        if (processor?.promise === promise) processor = null;
      });
      processor = { accountId, promise };
      return promise;
    }

    function hasUnresolved(accountId = currentAccountId()) {
      const state = supportedState();
      return Boolean(state?.operations.some((operation) =>
        operation.accountId === accountId
        && operation.state !== "accepted"));
    }

    return Object.freeze({
      queueGame,
      queueClock,
      process,
      isAcknowledged,
      hasUnresolved,
    });
  }

  global.LaxHornetDurableSyncOperations = Object.freeze({
    SCHEMA_VERSION,
    OPERATION_TYPES,
    OPERATION_STATES,
    isStoredState,
    normalizeState,
    payloadHash,
    classifyFailure,
    retryDelayMs,
    createDurableSyncOperationService,
  });
})(window);
