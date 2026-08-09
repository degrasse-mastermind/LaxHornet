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
    const useVersionedEvents = typeof hooks.useVersionedEvents === "function" ? hooks.useVersionedEvents : () => false;
    const queueVersionedEvent = typeof hooks.queueVersionedEvent === "function" ? hooks.queueVersionedEvent : () => {};
    const queueVersionedTombstone = typeof hooks.queueVersionedTombstone === "function" ? hooks.queueVersionedTombstone : () => {};
    const flushVersionedEvents = typeof hooks.flushVersionedEvents === "function" ? hooks.flushVersionedEvents : () => false;

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
      if (useVersionedEvents(local.game)) {
        queueVersionedEvent(local.game, local.event);
        persistLocal();
        const cloudPromise = runCloudWork(() => flushVersionedEvents({ gameId: local.game.id }));
        return { ...local, cloudPromise };
      }
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
      if (useVersionedEvents(local.game)) {
        queueVersionedEvent(local.game, local.event);
        persistLocal();
        const cloudPromise = runCloudWork(() => flushVersionedEvents({ gameId: local.game.id }));
        return { ...local, cloudPromise };
      }
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
      if (useVersionedEvents(local.game)) {
        queueVersionedTombstone(local.game, local.event, reason);
        persistLocal();
        const cloudPromise = runCloudWork(() => flushVersionedEvents({ gameId: local.game.id }));
        return { ...local, cloudPromise };
      }
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
        if (useVersionedEvents(game)) {
          const legacyReady = await syncLegacyGame(game, { includeEvents: false });
          if (!legacyReady) return false;
          game.events.forEach((event) => queueVersionedEvent(game, event));
          persistLocal();
          return Boolean(await flushVersionedEvents({ gameId: game.id }));
        }
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
        if (useVersionedEvents({ id: gameId })) {
          return Boolean(await flushVersionedEvents({ gameId }));
        }
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

(function initializeR207EventOperations(global) {
  "use strict";

  const CURRENT_SUPPORTED_SCHEMA_VERSION = 1;
  const SCHEMA_VERSION = CURRENT_SUPPORTED_SCHEMA_VERSION;
  const CONFLICT_MESSAGE = "This event changed on another device. Refresh before saving again.";
  const CLIENT_UPGRADE_REQUIRED_MESSAGE =
    "This data was saved by a newer version of LaxHornet. Update the app before making changes.";
  const EVENT_FIELDS = Object.freeze([
    "timestamp", "quarter", "stat_type", "stat_label", "category", "point_value",
    "tags", "note", "field_zone", "corrected_at", "tags_updated_at",
  ]);
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const now = () => new Date().toISOString();
  const operationId = () => global.crypto?.randomUUID?.() || `r207c-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, records: {}, operations: [], receipts: [], conflicts: {} };
  }

  function isStoredState(value) {
    return isObject(value) && Number.isInteger(Number(value.schemaVersion))
      && isObject(value.records || {}) && Array.isArray(value.operations || [])
      && Array.isArray(value.receipts || []) && isObject(value.conflicts || {});
  }

  function storedSchemaVersion(value) {
    const version = Number(value?.schemaVersion);
    return Number.isInteger(version) ? version : 0;
  }

  function requiresClientUpgrade(value) {
    return storedSchemaVersion(value) > CURRENT_SUPPORTED_SCHEMA_VERSION;
  }

  function clientUpgradeRequired() {
    return Object.freeze({
      ok: false,
      state: "blocked",
      code: "client_upgrade_required",
      message: CLIENT_UPGRADE_REQUIRED_MESSAGE,
      retryable: false,
    });
  }

  function normalizeState(value = null) {
    if (!isStoredState(value)) return emptyState();
    if (Number(value.schemaVersion) > SCHEMA_VERSION) return copy(value);
    return {
      ...copy(value),
      schemaVersion: SCHEMA_VERSION,
      records: Object.fromEntries(Object.entries(value.records || {}).filter(([id, record]) => id && isObject(record))),
      operations: (value.operations || [])
        .filter((item) => isObject(item) && item.clientOperationId && item.payload)
        .map((item) => ({
          ...copy(item),
          state: item.state === "attempting" ? "retryable" : item.state,
          lastError: item.lastError?.code
            ? { code: classifyRpcFailure({ code: item.lastError.code }).code }
            : null,
        })),
      receipts: (value.receipts || []).filter(isObject).slice(-100),
      conflicts: Object.fromEntries(Object.entries(value.conflicts || {}).filter(([, item]) => isObject(item))),
    };
  }

  function eventSnapshot(event = {}) {
    return {
      timestamp: String(event.timestamp || ""),
      quarter: String(event.quarter || ""),
      stat_type: String(event.statType ?? event.stat_type ?? ""),
      stat_label: String(event.statLabel ?? event.stat_label ?? ""),
      category: String(event.category || ""),
      point_value: Number(event.pointValue ?? event.point_value ?? 0),
      tags: [...new Set((Array.isArray(event.tags) ? event.tags : []).map(String))],
      note: String(event.note || ""),
      field_zone: String(event.fieldZone ?? event.field_zone ?? ""),
      corrected_at: event.correctedAt ?? event.corrected_at ?? null,
      tags_updated_at: event.tagsUpdatedAt ?? event.tags_updated_at ?? null,
    };
  }

  function eventChanges(before = {}, after = {}) {
    return Object.fromEntries(EVENT_FIELDS.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      .map((field) => [field, copy(after[field])]));
  }

  function lifecycle(game = {}) {
    return String(game.lifecycleState || game.lifecycle_state || (game.status === "complete" ? "completed" : "active"));
  }

  function boundedFailureText(error) {
    const seen = new Set();
    const values = [];
    function collect(value, depth = 0) {
      if (depth > 3 || value === null || value === undefined || seen.has(value)) return;
      if (typeof value === "string") {
        values.push(value.slice(0, 1000));
        return;
      }
      if (typeof value !== "object") return;
      seen.add(value);
      ["message", "details", "hint"].forEach((key) => collect(value[key], depth + 1));
      collect(value.cause, depth + 1);
      collect(value.error, depth + 1);
    }
    collect(error);
    return values.join(" ").slice(0, 4000);
  }

  function classifyRpcFailure(error = {}) {
    const envelope = isObject(error) ? error : {};
    const nested = isObject(envelope.error) ? envelope.error : {};
    const cause = isObject(envelope.cause) ? envelope.cause : {};
    const rawCode = String(
      envelope.code || nested.code || cause.code || envelope.name || nested.name || cause.name || "",
    ).trim().toLowerCase();
    const rawStatus = envelope.status ?? envelope.statusCode ?? envelope.httpStatus
      ?? nested.status ?? nested.statusCode ?? nested.httpStatus
      ?? cause.status ?? cause.statusCode ?? cause.httpStatus;
    const status = rawStatus === null || rawStatus === undefined || rawStatus === ""
      ? null
      : Number(rawStatus);
    const text = boundedFailureText(error).toLowerCase();
    const outcome = String(envelope.outcome || nested.outcome || "").toLowerCase();
    let code = "server_error";
    let retryable = false;

    if (
      outcome === "conflicted"
      || rawCode === "conflict"
      || rawCode.includes("conflict")
      || status === 409
    ) {
      code = "conflict";
    } else if (
      outcome === "deleted"
      || ["game_deleted", "event_tombstoned", "tombstone"].includes(rawCode)
    ) {
      code = rawCode === "game_deleted" ? "game_deleted" : "tombstone";
    } else if (
      status === 401
      || status === 403
      || rawCode === "42501"
      || ["authorization_denied", "unauthorized", "not_authorized", "permission_denied", "membership_required"].includes(rawCode)
      || /row-level security|permission denied|not authorized|revoked authority|insufficient privilege/.test(text)
    ) {
      code = "authorization_denied";
    } else if (
      ["client_upgrade_required", "upgrade_required", "r207_not_activated", "unsupported_contract", "capability_unavailable"].includes(rawCode)
      || /^pgrst20[2-4]$/.test(rawCode)
      || rawCode === "42883"
      || /schema cache|could not find the function|unsupported contract|client upgrade|required.*newer client/.test(text)
    ) {
      code = "client_upgrade_required";
    } else if (
      status === 400
      || status === 422
      || rawCode === "validation_failed"
      || rawCode === "validation_rejected"
      || rawCode.startsWith("invalid_")
      || rawCode.startsWith("unsupported_")
      || /^pgrst1\d\d$/.test(rawCode)
      || /malformed|required field|invalid operation|validation/.test(text)
    ) {
      code = "validation_failed";
    } else if (
      status === 0
      || /^08/.test(rawCode)
      || ["offline", "network_unavailable", "fetcherror", "econnreset", "enotfound"].includes(rawCode)
      || /failed to fetch|fetch failed|network unavailable|connection reset|dns lookup|browser offline/.test(text)
    ) {
      code = "network_unavailable";
      retryable = true;
    } else if (
      [408, 429, 500, 502, 503, 504].includes(status)
      || ["aborterror", "timeout", "service_unavailable", "gateway_timeout"].includes(rawCode)
      || /timed out|timeout|service unavailable|temporarily unavailable|bad gateway|gateway timeout/.test(text)
    ) {
      code = "service_unavailable";
      retryable = true;
    }

    return Object.freeze({
      state: retryable ? "retryable" : "blocked",
      code,
      retryable,
    });
  }

  function createEventOperationService(hooks = {}) {
    const getState = hooks.getState;
    const setState = hooks.setState;
    const persistState = hooks.persistState;
    const execute = hooks.execute;
    const isOffline = typeof hooks.isOffline === "function" ? hooks.isOffline : () => false;
    const currentAccountId = typeof hooks.currentAccountId === "function" ? hooks.currentAccountId : () => "";
    const onConflict = typeof hooks.onConflict === "function" ? hooks.onConflict : () => {};
    const onAccepted = typeof hooks.onAccepted === "function" ? hooks.onAccepted : () => {};
    if (![getState, setState, persistState, execute].every((value) => typeof value === "function")) {
      throw new TypeError("R2-07C event service hooks are incomplete");
    }

    function writableState() {
      const source = getState();
      return requiresClientUpgrade(source) ? null : normalizeState(source);
    }

    function mutate(mutator) {
      const next = writableState();
      if (!next) return clientUpgradeRequired();
      mutator(next);
      setState(next);
      persistState(next);
      return next;
    }

    function recordFor(state, game, event) {
      const id = String(event.id || "");
      if (!state.records[id]) {
        state.records[id] = {
          accountId: String(currentAccountId() || ""), gameId: String(game.id || ""), eventId: id,
          serverEventVersion: Math.max(0, Number(event.serverEventVersion ?? event.server_event_version ?? 0)),
          lifecycleState: "active", acceptedSnapshot: {}, desiredSnapshot: eventSnapshot(event),
          deleteRequested: false, updatedAt: now(),
        };
      }
      return state.records[id];
    }

    function addOperation(state, record, type, base, changes, expectedLifecycle) {
      const payload = {
        client_operation_id: operationId(), game_id: record.gameId, event_id: record.eventId,
        operation_type: type, base_event_version: base, expected_game_lifecycle: expectedLifecycle,
        changes: copy(changes), client_created_at: now(),
      };
      state.operations.push({
        clientOperationId: payload.client_operation_id, accountId: record.accountId,
        gameId: record.gameId, eventId: record.eventId, type, payload,
        state: "pending", attempts: 0, lastAttemptAt: "", lastError: null,
      });
      return payload;
    }

    function pending(state, eventId, type = "") {
      return state.operations.find((operation) => operation.eventId === eventId
        && ["pending", "retryable"].includes(operation.state) && (!type || operation.type === type));
    }

    function materialize(state, record, expectedLifecycle) {
      if (record.deleteRequested) {
        state.operations = state.operations.filter((operation) => !(operation.eventId === record.eventId
          && operation.type === "correct" && operation.attempts === 0));
        if (record.serverEventVersion >= 1 && !pending(state, record.eventId, "tombstone")) {
          addOperation(state, record, "tombstone", record.serverEventVersion, {}, expectedLifecycle);
        }
        return;
      }
      if (record.serverEventVersion < 1) {
        if (!pending(state, record.eventId, "create")) addOperation(state, record, "create", 0, record.desiredSnapshot, expectedLifecycle);
        return;
      }
      const changes = eventChanges(record.acceptedSnapshot, record.desiredSnapshot);
      if (Object.keys(changes).length && !pending(state, record.eventId, "correct") && !state.conflicts[record.eventId]) {
        addOperation(state, record, "correct", record.serverEventVersion, changes, expectedLifecycle);
      }
    }

    function hydrate(game, event) {
      return mutate((state) => {
        const record = recordFor(state, game, event);
        const version = Number(event.serverEventVersion ?? event.server_event_version ?? 0);
        if (Number.isSafeInteger(version) && version >= record.serverEventVersion) {
          record.serverEventVersion = version;
          record.acceptedSnapshot = eventSnapshot(event);
          if (!record.desiredSnapshot || !Object.keys(record.desiredSnapshot).length) record.desiredSnapshot = eventSnapshot(event);
        }
        record.updatedAt = now();
      });
    }

    function queueEvent(game, event) {
      return mutate((state) => {
        const record = recordFor(state, game, event);
        record.desiredSnapshot = eventSnapshot(event);
        record.deleteRequested = false;
        materialize(state, record, lifecycle(game));
        record.updatedAt = now();
      });
    }

    function queueTombstone(game, event) {
      return mutate((state) => {
        const record = recordFor(state, game, event);
        record.deleteRequested = true;
        delete state.conflicts[record.eventId];
        const unattemptedCreate = pending(state, record.eventId, "create");
        if (record.serverEventVersion < 1 && unattemptedCreate?.attempts === 0) {
          state.operations = state.operations.filter((operation) => operation !== unattemptedCreate);
          record.lifecycleState = "local_only_deleted";
        } else {
          materialize(state, record, lifecycle(game));
        }
        record.updatedAt = now();
      });
    }

    async function process(options = {}) {
      if (isOffline()) return false;
      if (!writableState()) return clientUpgradeRequired();
      const accountId = String(currentAccountId() || "");
      if (!accountId) return false;
      const gameId = String(options.gameId || "");
      for (let round = 0; round < 4; round += 1) {
        const snapshot = normalizeState(getState()).operations
          .filter((operation) => (!gameId || operation.gameId === gameId)
            && operation.accountId === accountId
            && (operation.state === "pending" || (round === 0 && operation.state === "retryable")));
        if (!snapshot.length) break;
        for (const queued of snapshot) {
        let active;
        mutate((state) => {
          active = state.operations.find((operation) => operation.clientOperationId === queued.clientOperationId);
          if (active) { active.attempts += 1; active.lastAttemptAt = now(); active.state = "attempting"; }
        });
        if (!active) continue;
        let result;
        try { result = await execute(copy(active.payload)); }
        catch (error) {
          const failure = classifyRpcFailure(error);
          if (String(currentAccountId() || "") !== accountId) return false;
          mutate((state) => {
            const operation = state.operations.find((item) => item.clientOperationId === active.clientOperationId);
            if (operation) {
              operation.state = failure.state;
              operation.lastError = { code: failure.code };
            }
          });
          continue;
        }
        if (String(currentAccountId() || "") !== accountId) return false;
        mutate((state) => {
          const operation = state.operations.find((item) => item.clientOperationId === active.clientOperationId);
          const record = state.records[active.eventId];
          if (!operation || !record) return;
          if (["accepted", "merged"].includes(result?.outcome)) {
            record.serverEventVersion = Number(result.server_event_version || record.serverEventVersion);
            if (active.type === "tombstone") record.lifecycleState = "tombstoned";
            else {
              const priorDesired = copy(record.desiredSnapshot);
              record.acceptedSnapshot = { ...record.acceptedSnapshot, ...(result.server_event || active.payload.changes) };
              record.desiredSnapshot = Object.fromEntries(EVENT_FIELDS.map((field) => {
                const attempted = active.payload.changes[field];
                const unchangedSinceQueue = !Object.hasOwn(active.payload.changes, field)
                  || JSON.stringify(priorDesired[field]) === JSON.stringify(attempted);
                return [field, unchangedSinceQueue ? copy(record.acceptedSnapshot[field]) : copy(priorDesired[field])];
              }));
            }
            state.receipts.push({ clientOperationId: active.clientOperationId, eventId: active.eventId, type: active.type, result: copy(result), persistedAt: now() });
            state.receipts = state.receipts.slice(-100);
            state.operations = state.operations.filter((item) => item.clientOperationId !== active.clientOperationId);
            materialize(state, record, active.payload.expected_game_lifecycle);
            onAccepted(active, result);
          } else if (result?.outcome === "conflicted") {
            operation.state = "conflicted";
            operation.lastError = { code: String(result.code || "event_conflict") };
            state.conflicts[active.eventId] = {
              eventId: active.eventId, gameId: active.gameId, clientOperationId: active.clientOperationId,
              code: String(result.code || "event_conflict"), message: CONFLICT_MESSAGE,
              serverEventVersion: Number(result.server_event_version || record.serverEventVersion), detectedAt: now(),
            };
            onConflict(active, result);
          } else if (result?.outcome === "deleted") {
            record.lifecycleState = "tombstoned";
            record.serverEventVersion = Math.max(record.serverEventVersion, Number(result.server_event_version || 0));
            state.operations = state.operations.filter((item) => item.eventId !== active.eventId);
          } else {
            const failure = classifyRpcFailure(result);
            operation.state = failure.state;
            operation.lastError = { code: failure.code };
          }
          record.updatedAt = now();
        });
        }
      }
      return true;
    }

    function markConflictRefreshed(game, event) {
      return mutate((state) => {
        const record = recordFor(state, game, event);
        record.serverEventVersion = Number(event.serverEventVersion ?? event.server_event_version ?? record.serverEventVersion);
        record.acceptedSnapshot = eventSnapshot(event);
        delete state.conflicts[record.eventId];
        state.operations = state.operations.map((operation) => operation.eventId === record.eventId && operation.state === "conflicted"
          ? { ...operation, state: "superseded" } : operation);
      });
    }

    return Object.freeze({ hydrate, queueEvent, queueTombstone, process, markConflictRefreshed });
  }

  global.LaxHornetR207EventOperations = Object.freeze({
    SCHEMA_VERSION, CURRENT_SUPPORTED_SCHEMA_VERSION, CONFLICT_MESSAGE, CLIENT_UPGRADE_REQUIRED_MESSAGE,
    EVENT_FIELDS, emptyState, isStoredState, storedSchemaVersion, requiresClientUpgrade,
    normalizeState, classifyRpcFailure, eventSnapshot, eventChanges, createEventOperationService,
  });
})(window);

(function initializeR207FieldOperations(global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const MAX_RECEIPTS = 100;
  const VERSION_FIELDS = Object.freeze({
    metadata: "metadataVersion",
    score: "scoreVersion",
    status: "statusVersion",
    roster_context: "rosterContextVersion",
    sharing: "sharingVersion",
  });
  const OPERATION_TYPES = Object.freeze({
    metadata: "metadata_patch",
    scoreDelta: "score_delta",
    scoreCorrection: "score_correction",
    status: "status_transition",
    rosterContext: "roster_context_patch",
    sharing: "sharing_patch",
  });
  const CONFLICT_MESSAGE = "This game changed on another device. Refresh before saving again.";
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const timestamp = (value = Date.now()) => new Date(value).toISOString();

  function canonicalValue(value) {
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (!isObject(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }

  async function sha256(value) {
    const subtle = global.crypto?.subtle;
    if (!subtle) throw new Error("SHA-256 is unavailable");
    const bytes = new TextEncoder().encode(JSON.stringify(canonicalValue(value)));
    const digest = await subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function normalizeVersionMap(value = {}) {
    if (!isObject(value)) return null;
    const normalized = {};
    const aliases = {
      game: "gameRevision",
      metadata: "metadataVersion",
      score: "scoreVersion",
      status: "statusVersion",
      roster_context: "rosterContextVersion",
      sharing: "sharingVersion",
    };
    for (const [key, raw] of Object.entries(value)) {
      const number = Number(raw);
      if (!Number.isSafeInteger(number) || number < 1) return null;
      normalized[aliases[key] || key] = number;
    }
    return normalized;
  }

  function hasRequiredVersions(value = {}) {
    const versions = normalizeVersionMap(value);
    return Boolean(versions && Object.values(VERSION_FIELDS).every((key) => Number.isSafeInteger(versions[key])));
  }

  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, versionMaps: {}, operations: [], receipts: [], conflicts: {} };
  }

  function isStoredState(value) {
    return isObject(value)
      && Number.isInteger(Number(value.schemaVersion))
      && isObject(value.versionMaps || {})
      && Array.isArray(value.operations || [])
      && Array.isArray(value.receipts || [])
      && isObject(value.conflicts || {});
  }

  function normalizeState(value = null) {
    if (!isStoredState(value)) return emptyState();
    if (Number(value.schemaVersion) > SCHEMA_VERSION) return copy(value);
    const source = copy(value);
    const versionMaps = {};
    for (const [gameId, versions] of Object.entries(source.versionMaps || {})) {
      const normalized = normalizeVersionMap(versions);
      if (gameId && normalized) versionMaps[gameId] = normalized;
    }
    return {
      ...source,
      schemaVersion: SCHEMA_VERSION,
      versionMaps,
      operations: (source.operations || []).filter((item) => isObject(item) && item.clientOperationId && item.gameId),
      receipts: (source.receipts || []).filter(isObject).slice(-MAX_RECEIPTS),
      conflicts: Object.fromEntries(Object.entries(source.conflicts || {}).filter(([, item]) => isObject(item))),
    };
  }

  function operationBase({ game, fieldGroup, operationType, changedFields, changes, clientOperationId, createdAt }) {
    const gameId = String(game?.id || "").trim();
    const versions = normalizeVersionMap(game?.serverVersions);
    const versionKey = VERSION_FIELDS[fieldGroup];
    if (!gameId || !versions || !Number.isSafeInteger(versions[versionKey])) {
      throw new TypeError("A hydrated server base is required");
    }
    const fields = [...new Set(changedFields)].sort();
    if (!fields.length || !isObject(changes)) throw new TypeError("A bounded field change is required");
    const result = {
      client_operation_id: String(clientOperationId || "").trim(),
      game_id: gameId,
      operation_type: operationType,
      field_group: fieldGroup,
      base_version: versions[versionKey],
      changed_fields: fields,
      changes: copy(changes),
      client_created_at: timestamp(createdAt),
    };
    if (!result.client_operation_id) throw new TypeError("A permanent client operation ID is required");
    return result;
  }

  function buildMetadataOperation(options = {}) {
    const before = options.before || {};
    const after = options.after || {};
    const mapping = {
      opponent: "opponent",
      date: "game_date",
      location: "location",
      gameType: "game_type",
    };
    const changes = {};
    const changedFields = [];
    for (const [local, server] of Object.entries(mapping)) {
      if (after[local] !== before[local]) {
        changedFields.push(server);
        changes[server] = after[local];
      }
    }
    return operationBase({
      ...options,
      game: before,
      fieldGroup: "metadata",
      operationType: OPERATION_TYPES.metadata,
      changedFields,
      changes,
    });
  }

  function buildScoreDeltaOperation(options = {}) {
    const changes = {};
    const changedFields = [];
    for (const side of ["score_for", "score_against"]) {
      const amount = Number(options.deltas?.[side] || 0);
      if (!Number.isInteger(amount) || amount === 0) continue;
      changedFields.push(side);
      changes[`${side}_delta`] = amount;
    }
    return {
      ...operationBase({ ...options, fieldGroup: "score", operationType: OPERATION_TYPES.scoreDelta, changedFields, changes }),
      expected_lifecycle: String(options.game?.lifecycleState || "active"),
      status_base_version: options.game.serverVersions.statusVersion,
    };
  }

  function buildScoreCorrectionOperation(options = {}) {
    const changes = {
      score_for: Number(options.scoreFor),
      score_against: Number(options.scoreAgainst),
    };
    if (!Object.values(changes).every((value) => Number.isInteger(value) && value >= 0)) {
      throw new TypeError("Scores must be nonnegative integers");
    }
    const result = {
      ...operationBase({ ...options, fieldGroup: "score", operationType: OPERATION_TYPES.scoreCorrection, changedFields: ["score_against", "score_for"], changes }),
      expected_lifecycle: String(options.game?.lifecycleState || "active"),
      status_base_version: options.game.serverVersions.statusVersion,
    };
    if (options.correctionReason) result.correction_reason = String(options.correctionReason);
    return result;
  }

  function buildStatusOperation(options = {}) {
    return {
      ...operationBase({ ...options, fieldGroup: "status", operationType: OPERATION_TYPES.status, changedFields: ["lifecycle_state"], changes: { lifecycle_state: options.lifecycleState } }),
      expected_lifecycle: String(options.game?.lifecycleState || "active"),
      status_base_version: options.game.serverVersions.statusVersion,
    };
  }

  function buildRosterContextOperation(options = {}) {
    return operationBase({ ...options, fieldGroup: "roster_context", operationType: OPERATION_TYPES.rosterContext, changedFields: ["player_id"], changes: { player_id: String(options.playerId || "") } });
  }

  function buildSharingOperation(options = {}) {
    return operationBase({ ...options, fieldGroup: "sharing", operationType: OPERATION_TYPES.sharing, changedFields: ["is_shared"], changes: { is_shared: options.isShared === true } });
  }

  async function finalizeOperation(operation) {
    const request = copy(operation);
    delete request.request_hash;
    return { ...request, request_hash: await sha256(request) };
  }

  function createFieldOperationService(hooks = {}) {
    const getState = hooks.getState;
    const setState = hooks.setState;
    const persistState = hooks.persistState;
    const execute = hooks.execute;
    const accountId = hooks.currentAccountId;
    const isOffline = hooks.isOffline;
    let processing = null;
    const save = (next) => {
      setState(next);
      return persistState(next) === true;
    };

    async function queue(rawOperation) {
      const operation = await finalizeOperation(rawOperation);
      const state = normalizeState(getState());
      if (Number(state.schemaVersion) > SCHEMA_VERSION) return null;
      if (state.receipts.some((item) => item.clientOperationId === operation.client_operation_id)) {
        return null;
      }
      const duplicate = state.operations.find((item) => item.clientOperationId === operation.client_operation_id);
      if (duplicate) return copy(duplicate);
      if (state.operations.some((item) => item.gameId === operation.game_id && item.fieldGroup === operation.field_group && item.state === "conflicted")) {
        return null;
      }
      const stored = {
        accountId: String(accountId() || ""),
        clientOperationId: operation.client_operation_id,
        gameId: operation.game_id,
        fieldGroup: operation.field_group,
        state: "pending",
        attemptCount: 0,
        createdAt: operation.client_created_at,
        updatedAt: operation.client_created_at,
        request: operation,
        lastError: null,
      };
      const next = copy(state);
      next.operations.push(stored);
      return save(next) ? copy(stored) : null;
    }

    function mergeVersions(next, gameId, versions) {
      const normalized = normalizeVersionMap(versions);
      if (!normalized) return false;
      next.versionMaps[gameId] = { ...(next.versionMaps[gameId] || {}), ...normalized };
      return true;
    }

    function hydrate(gameId, versions) {
      const state = normalizeState(getState());
      if (Number(state.schemaVersion) > SCHEMA_VERSION) return false;
      const next = copy(state);
      return mergeVersions(next, gameId, versions) && save(next);
    }

    async function run() {
      if (isOffline()) return false;
      let changed = false;
      for (let index = 0; index < 100; index += 1) {
        const state = normalizeState(getState());
        const operation = state.operations.find((item) => item.accountId === accountId() && ["pending", "retryable"].includes(item.state));
        if (!operation) break;
        const attempted = copy(state);
        const attemptedIndex = attempted.operations.findIndex((item) => item.clientOperationId === operation.clientOperationId);
        attempted.operations[attemptedIndex] = { ...attempted.operations[attemptedIndex], state: "syncing", attemptCount: operation.attemptCount + 1, updatedAt: timestamp(), lastError: null };
        if (!save(attempted)) break;
        let result;
        try { result = await execute(copy(operation.request)); }
        catch (error) { result = { outcome: "retryable", code: "network_unavailable", message: String(error?.message || "") }; }
        const current = normalizeState(getState());
        const currentIndex = current.operations.findIndex((item) => item.clientOperationId === operation.clientOperationId);
        if (currentIndex < 0) continue;
        const next = copy(current);
        if (["accepted", "merged"].includes(result?.outcome) && mergeVersions(next, operation.gameId, result.versions)) {
          next.receipts.push({ clientOperationId: operation.clientOperationId, gameId: operation.gameId, fieldGroup: operation.fieldGroup, outcome: result.outcome, replay: result.replay === true, versions: copy(result.versions), acceptedAt: timestamp() });
          next.receipts = next.receipts.slice(-MAX_RECEIPTS);
          next.operations[currentIndex] = { ...next.operations[currentIndex], state: "accepted", updatedAt: timestamp() };
          if (!save(next)) break;
          const compacted = normalizeState(getState());
          compacted.operations = compacted.operations.filter((item) => item.clientOperationId !== operation.clientOperationId);
          save(compacted);
          hooks.onAccepted?.(operation, result);
          changed = true;
          continue;
        }
        if (result?.outcome === "conflicted") {
          next.operations[currentIndex] = { ...next.operations[currentIndex], state: "conflicted", updatedAt: timestamp(), lastError: { category: "conflict", code: String(result.code || "field_conflict") } };
          next.conflicts[operation.gameId] = { gameId: operation.gameId, fieldGroup: operation.fieldGroup, proposedChanges: copy(operation.request.changes), message: CONFLICT_MESSAGE, createdAt: timestamp() };
          if (result.versions) mergeVersions(next, operation.gameId, result.versions);
          save(next);
          hooks.onConflict?.(operation, result);
          continue;
        }
        const retryable = result?.outcome === "retryable";
        next.operations[currentIndex] = { ...next.operations[currentIndex], state: retryable ? "retryable" : "rejected", updatedAt: timestamp(), lastError: { category: retryable ? "retryable_transport" : result?.code === "authorization_denied" ? "authorization_denied" : "rejected", code: String(result?.code || "operation_rejected") } };
        save(next);
        hooks.onRejected?.(operation, result);
        if (retryable) break;
      }
      return changed;
    }

    function markConflictRefreshed(gameId, versions) {
      const state = normalizeState(getState());
      if (Number(state.schemaVersion) > SCHEMA_VERSION || !state.conflicts[gameId]) return false;
      const next = copy(state);
      const refreshedAt = timestamp();
      next.conflicts[gameId] = { ...next.conflicts[gameId], refreshedAt };
      next.operations = next.operations.map((item) => (
        item.gameId === gameId && item.state === "conflicted"
          ? { ...item, state: "superseded", updatedAt: refreshedAt }
          : item
      ));
      if (versions && !mergeVersions(next, gameId, versions)) return false;
      return save(next);
    }

    function process() {
      if (!processing) processing = run().finally(() => { processing = null; });
      return processing;
    }

    return Object.freeze({ queue, process, hydrate, markConflictRefreshed });
  }

  global.LaxHornetR207FieldOperations = Object.freeze({
    SCHEMA_VERSION,
    VERSION_FIELDS,
    OPERATION_TYPES,
    CONFLICT_MESSAGE,
    emptyState,
    isStoredState,
    normalizeState,
    normalizeVersionMap,
    hasRequiredVersions,
    buildMetadataOperation,
    buildScoreDeltaOperation,
    buildScoreCorrectionOperation,
    buildStatusOperation,
    buildRosterContextOperation,
    buildSharingOperation,
    finalizeOperation,
    createFieldOperationService,
  });
})(window);

(function initializeLaxHornetDurableSyncOperations(global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const DELETE_RECOVERY_VERSION = 1;
  const OPERATION_TYPES = Object.freeze({
    game: "legacy_game_write",
    gameDelete: "legacy_game_delete",
    clock: "tracked_clock_write",
  });
  const OPERATION_STATES = Object.freeze([
    "pending",
    "syncing",
    "accepted",
    "retryable",
    "rejected",
    "conflicted",
    "superseded",
  ]);
  const RETRY_BASE_MS = 2000;
  const RETRY_MAX_MS = 5 * 60 * 1000;
  const MAX_ACKNOWLEDGMENTS = 100;
  const normalizedGameIdentity = (value) => String(value ?? "").trim().toLowerCase();
  const sameGameIdentity = (left, right) => {
    const normalizedLeft = normalizedGameIdentity(left);
    return Boolean(normalizedLeft) && normalizedLeft === normalizedGameIdentity(right);
  };
  const FAILURE_CATEGORIES = Object.freeze({
    retryableTransport: "retryable_transport",
    authenticationRequired: "authentication_required",
    authorizationDenied: "authorization_denied",
    validationRejected: "validation_rejected",
    capabilityUnavailable: "capability_unavailable",
    conflict: "conflict",
    unclassifiedRejection: "unclassified_rejection",
  });
  const FAILURE_MESSAGES = Object.freeze({
    [FAILURE_CATEGORIES.retryableTransport]:
      "The service could not be reached. This saved operation remains available to retry.",
    [FAILURE_CATEGORIES.authenticationRequired]:
      "Sign in again before retrying this saved operation.",
    [FAILURE_CATEGORIES.authorizationDenied]:
      "The signed-in account is not authorized for this saved operation.",
    [FAILURE_CATEGORIES.validationRejected]:
      "The saved operation was rejected because its request is invalid.",
    [FAILURE_CATEGORIES.capabilityUnavailable]:
      "The required backend capability is unavailable.",
    [FAILURE_CATEGORIES.conflict]:
      "The saved operation conflicts with a newer server revision.",
    [FAILURE_CATEGORIES.unclassifiedRejection]:
      "The saved operation was rejected for an unclassified permanent reason.",
  });

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

  function safeCode(value = "", fallback = "") {
    const clean = String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_.:-]/g, "_")
      .slice(0, 80);
    return clean || fallback;
  }

  function normalizedHttpStatus(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const status = Number(value);
      if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
    }
    return null;
  }

  function classificationCode(category, sourceCode = "") {
    if (
      category === FAILURE_CATEGORIES.conflict
      && /stale_clock_revision/i.test(sourceCode)
    ) {
      return "stale_clock_revision";
    }
    if (category === FAILURE_CATEGORIES.conflict) return "revision_conflict";
    return category;
  }

  function normalizedError(value = null, options = {}) {
    if (!value) return null;
    if (typeof value === "string") {
      return {
        category: FAILURE_CATEGORIES.unclassifiedRejection,
        code: "sync_error",
        message: FAILURE_MESSAGES[FAILURE_CATEGORIES.unclassifiedRejection],
        httpStatus: null,
        classifiedAt: options.classifiedAt ? isoTimestamp(options.classifiedAt) : null,
        source: "legacy",
        sourceCode: "",
      };
    }
    const category = Object.values(FAILURE_CATEGORIES).includes(value.category)
      ? value.category
      : value.outcome === "retryable"
        ? FAILURE_CATEGORIES.retryableTransport
        : value.outcome === "conflicted"
          ? FAILURE_CATEGORIES.conflict
          : FAILURE_CATEGORIES.unclassifiedRejection;
    const sourceCode = safeCode(value.sourceCode || "");
    return {
      category,
      code: safeCode(
        value.code,
        classificationCode(category, sourceCode) || "sync_error",
      ),
      message: FAILURE_MESSAGES[category],
      httpStatus: normalizedHttpStatus(value.httpStatus, value.status, value.statusCode),
      classifiedAt: value.classifiedAt || options.classifiedAt
        ? isoTimestamp(value.classifiedAt || options.classifiedAt)
        : null,
      source: safeCode(value.source, "sync"),
      sourceCode,
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
    if (value.tombstones !== undefined && (!Array.isArray(value.tombstones) || !value.tombstones.every(isObject))) {
      return false;
    }
    if (
      value.deleteRecoveries !== undefined
      && (
        !Array.isArray(value.deleteRecoveries)
        || !value.deleteRecoveries.every(isStoredDeleteRecovery)
      )
    ) {
      return false;
    }
    if (value.schemaVersion !== undefined) {
      const version = Number(value.schemaVersion);
      if (!Number.isInteger(version) || version < 1) return false;
    }
    if (value.acknowledgments !== undefined && !isObject(value.acknowledgments)) return false;
    return true;
  }

  function isStoredDeleteRecovery(value) {
    if (!isObject(value)) return false;
    const version = Number(value.recoveryVersion);
    if (!Number.isInteger(version) || version < 1) return false;
    if (version > DELETE_RECOVERY_VERSION) return true;
    if (
      !String(value.accountId || "").trim()
      || !String(value.gameId || "").trim()
      || !String(value.deletionId || "").trim()
      || !Number.isFinite(Date.parse(String(value.capturedAt || "")))
      || !isObject(value.gameSnapshot)
      || !Array.isArray(value.eventSnapshot)
      || !value.eventSnapshot.every(isObject)
      || !isObject(value.previousActiveGameRelationship)
      || typeof value.previousActiveGameRelationship.wasActive !== "boolean"
      || (
        value.previousActiveGameRelationship.trackingSession !== null
        && !isObject(value.previousActiveGameRelationship.trackingSession)
      )
      || (
        value.previousReviewGameId !== null
        && typeof value.previousReviewGameId !== "string"
      )
      || !Array.isArray(value.eventDeleteMarkerBaseline)
      || !value.eventDeleteMarkerBaseline.every((item) => typeof item === "string")
    ) {
      return false;
    }
    return true;
  }

  function normalizedDeleteRecovery(value, options = {}) {
    if (!isStoredDeleteRecovery(value)) return null;
    const version = Number(value.recoveryVersion);
    if (version > DELETE_RECOVERY_VERSION) return copy(value);
    const accountId = String(value.accountId || options.accountId || "").trim();
    const gameId = String(value.gameId || options.gameId || "").trim();
    const deletionId = String(value.deletionId || options.deletionId || "").trim();
    if (!accountId || !gameId || !deletionId) return null;
    return {
      recoveryVersion: DELETE_RECOVERY_VERSION,
      accountId,
      gameId,
      deletionId,
      capturedAt: isoTimestamp(value.capturedAt || options.now()),
      gameSnapshot: copy(value.gameSnapshot),
      eventSnapshot: copy(value.eventSnapshot),
      previousActiveGameRelationship: {
        wasActive: value.previousActiveGameRelationship.wasActive === true,
        trackingSession: value.previousActiveGameRelationship.trackingSession
          ? copy(value.previousActiveGameRelationship.trackingSession)
          : null,
      },
      previousReviewGameId: value.previousReviewGameId === null
        ? null
        : String(value.previousReviewGameId || "").trim() || null,
      eventDeleteMarkerBaseline: [...new Set(
        value.eventDeleteMarkerBaseline
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      )],
    };
  }

  function normalizedTombstone(value, options = {}) {
    if (!isObject(value)) return null;
    const gameId = String(value.gameId || value.game_id || "").trim();
    const accountId = String(value.accountId || value.account_id || options.accountId || "").trim();
    const deletionId = String(value.deletionId || value.deletion_id || "").trim();
    if (!gameId || !accountId || !deletionId) return null;
    const createdAt = isoTimestamp(value.createdAt || value.created_at || options.now());
    const updatedAt = isoTimestamp(value.updatedAt || value.updated_at || createdAt);
    const state = ["pending", "accepted", "retryable", "rejected", "conflicted"].includes(value.state)
      ? value.state
      : "accepted";
    return {
      gameId,
      accountId,
      deletionId,
      deviceId: String(value.deviceId || value.device_id || options.deviceId || "").trim(),
      deletedAt: isoTimestamp(value.deletedAt || value.deleted_at || createdAt),
      knownGameSavedAt: value.knownGameSavedAt || value.known_game_saved_at
        ? isoTimestamp(value.knownGameSavedAt || value.known_game_saved_at)
        : null,
      createdAt,
      updatedAt,
      state,
      lastError: normalizedError(value.lastError || value.last_error, { classifiedAt: updatedAt }),
      receipt: normalizedReceipt(value.receipt),
    };
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
            category: FAILURE_CATEGORIES.retryableTransport,
            code: "interrupted_sync",
            message: FAILURE_MESSAGES[FAILURE_CATEGORIES.retryableTransport],
            httpStatus: null,
            classifiedAt: updatedAt,
            source: "durable_queue",
            sourceCode: "interrupted_sync",
          }
        : normalizedError(operation.lastError, { classifiedAt: updatedAt }),
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
    if (
      Array.isArray(source.deleteRecoveries)
      && source.deleteRecoveries.some(
        (recovery) => Number(recovery?.recoveryVersion) > DELETE_RECOVERY_VERSION,
      )
    ) {
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
      tombstones: (Array.isArray(source.tombstones) ? source.tombstones : [])
        .map((tombstone) => normalizedTombstone(tombstone, {
          accountId: options.accountId,
          deviceId,
          now,
        }))
        .filter(Boolean),
      deleteRecoveries: (Array.isArray(source.deleteRecoveries) ? source.deleteRecoveries : [])
        .map((recovery) => normalizedDeleteRecovery(recovery, {
          accountId: options.accountId,
          now,
        }))
        .filter(Boolean),
      acknowledgments: trimAcknowledgments(source.acknowledgments),
    };
    normalized.operations = normalized.operations.filter((operation) => {
      if (operation.state !== "accepted") return true;
      const key = [OPERATION_TYPES.game, OPERATION_TYPES.gameDelete].includes(operation.operationType)
        ? `${operation.operationType}:${operation.gameId}`
        : `${operation.operationType}:${operation.gameId}:${operation.payloadHash}`;
      return normalized.acknowledgments[key]?.payloadHash !== operation.payloadHash;
    });
    return normalized;
  }

  function classifyFailure(input = {}, options = {}) {
    const envelope = isObject(input) ? input : { message: String(input || "") };
    const error = isObject(envelope.error) ? envelope.error : envelope;
    const sourceCode = safeCode(
      error.code
      || envelope.code
      || error.name
      || envelope.name,
    );
    const code = sourceCode.toLowerCase();
    const text = [
      error.message,
      error.details,
      error.hint,
      envelope.message,
      envelope.details,
      envelope.hint,
    ].filter(Boolean).join(" ");
    const httpStatus = normalizedHttpStatus(
      envelope.httpStatus,
      envelope.status,
      envelope.statusCode,
      error.httpStatus,
      error.status,
      error.statusCode,
    );
    const explicitStatusZero = [
      envelope.httpStatus,
      envelope.status,
      envelope.statusCode,
      error.httpStatus,
      error.status,
      error.statusCode,
    ].some((value) =>
      value !== null
      && value !== undefined
      && value !== ""
      && Number(value) === 0);
    const declaredOutcome = String(envelope.outcome || error.outcome || "").toLowerCase();
    let category = FAILURE_CATEGORIES.unclassifiedRejection;

    if (
      declaredOutcome === "conflicted"
      || code.includes("stale_clock_revision")
      || /^stale_.*_revision$/.test(code)
      || code.includes("revision_conflict")
      || code.includes("clock_acknowledgment_mismatch")
      || code === "game_deleted"
      || code === "game_already_deleted"
      || code === "newer_game_revision"
      || /laxhornet_game_deleted|durable tombstone|game already deleted/i.test(text)
      || httpStatus === 409
    ) {
      category = FAILURE_CATEGORIES.conflict;
    } else if (
      httpStatus === 401
      || code === "authentication_required"
      || /^pgrst30[1-3]$/.test(code)
      || /authsessionmissing|authinvalidjwt|missing_session|session_missing|expired_session|session_expired|invalid_(?:access_)?token|token_(?:expired|revoked)|jwt_(?:expired|invalid)|bad_jwt|refresh_token_not_found/.test(code)
      || /missing session|session (?:is )?(?:missing|expired)|jwt (?:has )?expired|invalid or revoked access token|invalid jwt/i.test(text)
    ) {
      category = FAILURE_CATEGORIES.authenticationRequired;
    } else if (
      httpStatus === 403
      || code === "42501"
      || code === "authorization_denied"
      || code === "unauthorized"
      || code === "not_authorized"
      || code === "permission_denied"
      || code === "insufficient_privilege"
      || code.startsWith("unauthorized_")
      || /row-level security|violates row-level security|permission denied|not authorized|unauthorized (?:account|team|game|player|scope)|revoked membership|insufficient role|wrong (?:account|team|game|player)/i.test(text)
    ) {
      category = FAILURE_CATEGORIES.authorizationDenied;
    } else if (
      /^pgrst20[0-5]$/.test(code)
      || code === "42883"
      || code === "capability_unavailable"
      || /schema cache|could not find the function|function .* does not exist|function signature|unsupported backend capability|feature not deployed|backend capability/i.test(text)
    ) {
      category = FAILURE_CATEGORIES.capabilityUnavailable;
    } else if (
      httpStatus === 400
      || httpStatus === 422
      || code === "validation_rejected"
      || code.startsWith("invalid_")
      || code.startsWith("unsupported_")
      || /^pgrst1\d\d$/.test(code)
      || /malformed payload|required field|unsupported command|invalid (?:game state|clock transition|event payload|request body)/i.test(text)
    ) {
      category = FAILURE_CATEGORIES.validationRejected;
    } else if (
      declaredOutcome === "retryable"
      || explicitStatusZero
      || httpStatus === 408
      || httpStatus === 429
      || (httpStatus !== null && httpStatus >= 500)
      || /^pgrst00[013]$/.test(code)
      || /^08/.test(code)
      || code === "offline"
      || code === "aborterror"
      || code === "aborted"
      || /failed to fetch|fetch failed|network|timeout|timed out|connection reset|econnreset|temporary dns|dns lookup|gateway|rate.?limit|service unavailable|temporarily unavailable|offline/i.test(`${code} ${text}`)
    ) {
      category = FAILURE_CATEGORIES.retryableTransport;
    } else if (declaredOutcome === "conflicted") {
      category = FAILURE_CATEGORIES.conflict;
    } else if (declaredOutcome === "rejected") {
      category = FAILURE_CATEGORIES.unclassifiedRejection;
    }

    const retryable = category === FAILURE_CATEGORIES.retryableTransport;
    return Object.freeze({
      outcome: category === FAILURE_CATEGORIES.conflict
        ? "conflicted"
        : retryable
          ? "retryable"
          : "rejected",
      category,
      code: classificationCode(category, sourceCode),
      message: FAILURE_MESSAGES[category],
      httpStatus,
      retryable,
      attentionRequired: !retryable,
      source: safeCode(
        options.source || envelope.source,
        code.startsWith("pgrst") || /^\d{5}$/.test(code)
          ? "postgrest"
          : "javascript",
      ),
      sourceCode,
    });
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
      return value?.schemaVersion === SCHEMA_VERSION
        && !value.deleteRecoveries?.some(
          (recovery) => Number(recovery?.recoveryVersion) > DELETE_RECOVERY_VERSION,
        )
        ? value
        : null;
    }

    function replaceAndPersist(nextState, previousState) {
      setState(nextState);
      if (persistState(nextState) !== false) return true;
      setState(previousState);
      return false;
    }

    function acknowledgmentKey(operationType, gameId, hash) {
      return [OPERATION_TYPES.game, OPERATION_TYPES.gameDelete].includes(operationType)
        ? `${operationType}:${gameId}`
        : `${operationType}:${gameId}:${hash}`;
    }

    function tombstoneFor(accountId, gameId) {
      const state = supportedState();
      if (!state || !accountId || !gameId) return null;
      return state.tombstones.find((tombstone) =>
        tombstone.accountId === accountId && sameGameIdentity(tombstone.gameId, gameId)) || null;
    }

    function isTombstoned(accountId, gameId) {
      return Boolean(tombstoneFor(accountId, gameId));
    }

    function deleteRecoveryFor(accountId, gameId, deletionId = "") {
      const state = supportedState();
      if (!state || !accountId || !gameId) return null;
      const recovery = (state.deleteRecoveries || []).find((candidate) =>
        candidate.accountId === accountId
        && sameGameIdentity(candidate.gameId, gameId)
        && (!deletionId || candidate.deletionId === deletionId));
      return recovery ? copy(recovery) : null;
    }

    function supersedeGameWrites(next, accountId, gameId, timestamp) {
      next.operations = next.operations.map((operation) => {
        if (
          operation.accountId !== accountId
          || !sameGameIdentity(operation.gameId, gameId)
          || ![OPERATION_TYPES.game, OPERATION_TYPES.clock].includes(operation.operationType)
          || operation.state === "accepted"
        ) {
          return operation;
        }
        return {
          ...operation,
          state: "superseded",
          updatedAt: timestamp,
          nextAttemptAt: null,
          lastError: null,
          receipt: {
            code: "superseded_by_delete",
            acknowledgment: "local_delete_intent",
            serverRevision: null,
            serverTimestamp: timestamp,
          },
        };
      });
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
      if (
        [OPERATION_TYPES.game, OPERATION_TYPES.clock].includes(operationType)
        && state.tombstones.some((tombstone) =>
          tombstone.accountId === accountId && sameGameIdentity(tombstone.gameId, gameId))
      ) {
        return null;
      }
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

    function queueDelete({
      accountId,
      gameId,
      knownGameSavedAt = null,
      deletedAt = null,
      recoveryEvidence = null,
    }) {
      const state = supportedState();
      const scopedAccountId = String(accountId || currentAccountId() || "").trim();
      const scopedGameId = String(gameId || "").trim();
      if (!state || !scopedAccountId || !scopedGameId) return null;
      const existing = state.tombstones.find((tombstone) =>
        tombstone.accountId === scopedAccountId && sameGameIdentity(tombstone.gameId, scopedGameId));
      if (existing) {
        const operation = state.operations.find((candidate) =>
          candidate.operationType === OPERATION_TYPES.gameDelete
          && candidate.accountId === scopedAccountId
          && sameGameIdentity(candidate.gameId, scopedGameId));
        return {
          operationId: operation?.operationId || existing.deletionId,
          deletionId: existing.deletionId,
          alreadyAccepted: existing.state === "accepted",
          state: existing.state,
        };
      }

      const timestamp = isoTimestamp(deletedAt || now());
      const deletionId = createId("game-delete");
      const recovery = normalizedDeleteRecovery({
        ...(isObject(recoveryEvidence) ? recoveryEvidence : {}),
        recoveryVersion: DELETE_RECOVERY_VERSION,
        accountId: scopedAccountId,
        gameId: scopedGameId,
        deletionId,
        capturedAt: recoveryEvidence?.capturedAt || timestamp,
      }, {
        accountId: scopedAccountId,
        gameId: scopedGameId,
        deletionId,
        now,
      });
      if (!recovery) return null;
      const payload = {
        deletion: {
          game_id: scopedGameId,
          account_id: scopedAccountId,
          deletion_id: deletionId,
          device_id: state.deviceId,
          deleted_at: timestamp,
          known_game_saved_at: knownGameSavedAt ? isoTimestamp(knownGameSavedAt) : null,
        },
      };
      const hash = payloadHash(payload);
      const next = copy(state);
      next.tombstones.push({
        gameId: scopedGameId,
        accountId: scopedAccountId,
        deletionId,
        deviceId: state.deviceId,
        deletedAt: timestamp,
        knownGameSavedAt: knownGameSavedAt ? isoTimestamp(knownGameSavedAt) : null,
        createdAt: timestamp,
        updatedAt: timestamp,
        state: "pending",
        lastError: null,
        receipt: null,
      });
      next.deleteRecoveries = Array.isArray(next.deleteRecoveries)
        ? next.deleteRecoveries
        : [];
      next.deleteRecoveries.push(recovery);
      supersedeGameWrites(next, scopedAccountId, scopedGameId, timestamp);
      next.operations.push({
        operationId: deletionId,
        operationType: OPERATION_TYPES.gameDelete,
        accountId: scopedAccountId,
        gameId: scopedGameId,
        deviceId: state.deviceId,
        coalescingKey: `${OPERATION_TYPES.gameDelete}:${scopedGameId}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        attemptCount: 0,
        lastAttemptAt: null,
        nextAttemptAt: null,
        state: "pending",
        payload,
        payloadHash: hash,
        payloadRevision: 1,
        baseRevision: null,
        lastError: null,
        receipt: null,
      });
      if (!replaceAndPersist(next, state)) return null;
      return {
        operationId: deletionId,
        deletionId,
        alreadyAccepted: false,
        state: "pending",
      };
    }

    function finalizeAcceptedDelete({
      accountId,
      gameId,
      deletionId = "",
    }) {
      const state = supportedState();
      const scopedAccountId = String(accountId || currentAccountId() || "").trim();
      const scopedGameId = String(gameId || "").trim();
      if (!state || !scopedAccountId || !scopedGameId) return null;
      const tombstone = state.tombstones.find((candidate) =>
        candidate.accountId === scopedAccountId
        && sameGameIdentity(candidate.gameId, scopedGameId)
        && candidate.state === "accepted"
        && candidate.receipt);
      if (!tombstone) return null;
      const index = (state.deleteRecoveries || []).findIndex((candidate) =>
        candidate.accountId === scopedAccountId
        && sameGameIdentity(candidate.gameId, scopedGameId)
        && (!deletionId || candidate.deletionId === deletionId));
      if (index < 0) return null;
      const recovery = copy(state.deleteRecoveries[index]);
      const next = copy(state);
      next.deleteRecoveries.splice(index, 1);
      return replaceAndPersist(next, state) ? recovery : null;
    }

    function recordLocalOnlyDeletion({
      accountId,
      gameId,
      deletedAt = null,
    }) {
      const state = supportedState();
      const scopedAccountId = String(accountId || currentAccountId() || "").trim();
      const scopedGameId = String(gameId || "").trim();
      if (!state || !scopedAccountId || !scopedGameId) return null;
      const existing = state.tombstones.find((tombstone) =>
        tombstone.accountId === scopedAccountId && sameGameIdentity(tombstone.gameId, scopedGameId));
      if (existing) return copy(existing);
      const timestamp = isoTimestamp(deletedAt || now());
      const next = copy(state);
      const tombstone = {
        gameId: scopedGameId,
        accountId: scopedAccountId,
        deletionId: createId("local-game-delete"),
        deviceId: state.deviceId,
        deletedAt: timestamp,
        knownGameSavedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        state: "accepted",
        lastError: null,
        receipt: {
          code: "local_only_game_deleted",
          acknowledgment: "proven_never_cloud_visible",
          serverRevision: null,
          serverTimestamp: null,
        },
      };
      next.tombstones.push(tombstone);
      supersedeGameWrites(next, scopedAccountId, scopedGameId, timestamp);
      return replaceAndPersist(next, state) ? tombstone : null;
    }

    function mergeServerTombstones(accountId, values = []) {
      const state = supportedState();
      const scopedAccountId = String(accountId || "").trim();
      if (!state || !scopedAccountId || !Array.isArray(values)) return 0;
      const timestamp = isoTimestamp(now());
      const next = copy(state);
      let changed = 0;
      for (const value of values) {
        const incoming = normalizedTombstone(
          { ...value, accountId: scopedAccountId, state: "accepted" },
          { accountId: scopedAccountId, deviceId: state.deviceId, now },
        );
        if (!incoming || incoming.accountId !== scopedAccountId) continue;
        const index = next.tombstones.findIndex((tombstone) =>
          tombstone.accountId === scopedAccountId && sameGameIdentity(tombstone.gameId, incoming.gameId));
        if (
          index >= 0
          && next.tombstones[index].deletionId === incoming.deletionId
          && next.tombstones[index].state === "accepted"
          && next.tombstones[index].updatedAt === incoming.updatedAt
        ) {
          continue;
        }
        if (index >= 0) next.tombstones[index] = incoming;
        else next.tombstones.push(incoming);
        supersedeGameWrites(next, scopedAccountId, incoming.gameId, timestamp);
        next.operations = next.operations.map((operation) => {
          if (
            operation.operationType !== OPERATION_TYPES.gameDelete
            || operation.accountId !== scopedAccountId
            || operation.gameId !== incoming.gameId
            || operation.operationId === incoming.deletionId
          ) {
            return operation;
          }
          return {
            ...operation,
            state: "conflicted",
            updatedAt: timestamp,
            nextAttemptAt: null,
            lastError: normalizedError({
              category: FAILURE_CATEGORIES.conflict,
              code: "game_already_deleted",
              source: "tombstone_hydration",
            }, { classifiedAt: timestamp }),
            receipt: {
              code: "game_already_deleted",
              acknowledgment: "authorized_tombstone",
              serverRevision: null,
              serverTimestamp: incoming.deletedAt,
            },
          };
        });
        changed += 1;
      }
      if (!changed) return 0;
      return replaceAndPersist(next, state) ? changed : 0;
    }

    function eligibleOperation(state, accountId, timestamp) {
      const operations = state.operations
        .filter((operation) => operation.accountId === accountId)
        .sort((left, right) => {
          if (left.operationType !== right.operationType) {
            const priority = {
              [OPERATION_TYPES.gameDelete]: 0,
              [OPERATION_TYPES.game]: 1,
              [OPERATION_TYPES.clock]: 2,
            };
            return priority[left.operationType] - priority[right.operationType];
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
        lastError: normalizedError(failure, { classifiedAt: timestamp }),
        receipt: outcome === "conflicted"
          ? normalizedReceipt(failure.receipt)
          : operation.receipt,
      };
      if (operation.operationType === OPERATION_TYPES.gameDelete) {
        const tombstoneIndex = next.tombstones.findIndex((tombstone) =>
          tombstone.accountId === operation.accountId
          && sameGameIdentity(tombstone.gameId, operation.gameId)
          && tombstone.deletionId === operation.operationId);
        if (tombstoneIndex >= 0) {
          next.tombstones[tombstoneIndex] = {
            ...next.tombstones[tombstoneIndex],
            state: outcome,
            updatedAt: timestamp,
            lastError: next.operations[index].lastError,
            receipt: next.operations[index].receipt,
          };
        }
      }
      return replaceAndPersist(next, state);
    }

    function applyFailureWithoutAttempt(accountId, states, failure) {
      const state = supportedState();
      if (!state || !accountId) return 0;
      const timestamp = isoTimestamp(now());
      const next = copy(state);
      let changed = 0;
      next.operations = next.operations.map((operation) => {
        if (
          operation.accountId !== accountId
          || !states.includes(operation.state)
        ) {
          return operation;
        }
        changed += 1;
        return {
          ...operation,
          state: failure.outcome,
          updatedAt: timestamp,
          nextAttemptAt: null,
          lastError: normalizedError(failure, { classifiedAt: timestamp }),
          receipt: failure.outcome === "conflicted"
            ? normalizedReceipt(failure.receipt)
            : operation.receipt,
        };
      });
      next.tombstones = next.tombstones.map((tombstone) => {
        const operation = next.operations.find((candidate) =>
          candidate.operationType === OPERATION_TYPES.gameDelete
          && candidate.operationId === tombstone.deletionId
          && candidate.accountId === tombstone.accountId
          && sameGameIdentity(candidate.gameId, tombstone.gameId));
        if (!operation || operation.accountId !== accountId || !states.includes(
          state.operations.find((candidate) => candidate.operationId === operation.operationId)?.state,
        )) {
          return tombstone;
        }
        return {
          ...tombstone,
          state: failure.outcome,
          updatedAt: timestamp,
          lastError: operation.lastError,
          receipt: operation.receipt,
        };
      });
      if (!changed) return 0;
      return replaceAndPersist(next, state) ? changed : 0;
    }

    function rejectAuthentication(accountId = currentAccountId()) {
      return applyFailureWithoutAttempt(
        accountId,
        ["pending", "syncing", "retryable"],
        classifyFailure(
          { code: "missing_session", outcome: "rejected" },
          { source: "supabase_auth" },
        ),
      );
    }

    function recoverAuthentication(accountId = currentAccountId()) {
      const state = supportedState();
      if (!state || !accountId) return 0;
      const timestamp = isoTimestamp(now());
      const next = copy(state);
      let changed = 0;
      next.operations = next.operations.map((operation) => {
        if (
          operation.accountId !== accountId
          || operation.state !== "rejected"
          || operation.lastError?.category !== FAILURE_CATEGORIES.authenticationRequired
        ) {
          return operation;
        }
        changed += 1;
        return {
          ...operation,
          state: "pending",
          updatedAt: timestamp,
          nextAttemptAt: null,
          lastError: null,
        };
      });
      next.tombstones = next.tombstones.map((tombstone) => {
        const operation = next.operations.find((candidate) =>
          candidate.operationType === OPERATION_TYPES.gameDelete
          && candidate.operationId === tombstone.deletionId);
        return operation
          && operation.accountId === accountId
          && operation.state === "pending"
          ? {
              ...tombstone,
              state: "pending",
              updatedAt: timestamp,
              lastError: null,
            }
          : tombstone;
      });
      if (!changed) return 0;
      return replaceAndPersist(next, state) ? changed : 0;
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
      const deletionDominatesWrite = [OPERATION_TYPES.game, OPERATION_TYPES.clock]
        .includes(attempted.operationType)
        && next.tombstones.some((tombstone) =>
          tombstone.accountId === attempted.accountId
          && sameGameIdentity(tombstone.gameId, attempted.gameId));
      next.operations[index] = {
        ...current,
        state: deletionDominatesWrite
          ? "superseded"
          : payloadStillCurrent
            ? "accepted"
            : "pending",
        updatedAt: timestamp,
        nextAttemptAt: null,
        lastError: null,
        receipt: receipt.receipt,
      };
      if (attempted.operationType === OPERATION_TYPES.gameDelete) {
        const tombstoneIndex = next.tombstones.findIndex((tombstone) =>
          tombstone.accountId === attempted.accountId
          && sameGameIdentity(tombstone.gameId, attempted.gameId)
          && tombstone.deletionId === attempted.operationId);
        if (tombstoneIndex >= 0) {
          next.tombstones[tombstoneIndex] = {
            ...next.tombstones[tombstoneIndex],
            state: "accepted",
            updatedAt: timestamp,
            lastError: null,
            receipt: receipt.receipt,
          };
        }
      }
      if (!replaceAndPersist(next, state)) return false;
      if (!payloadStillCurrent || deletionDominatesWrite) return false;

      const acceptedState = supportedState();
      const compacted = copy(acceptedState);
      compacted.operations = compacted.operations.filter(
        (operation) => operation.operationId !== attempted.operationId,
      );
      replaceAndPersist(compacted, acceptedState);
      return true;
    }

    async function runForAccount(accountId) {
      if (!accountId) return false;
      if (isOffline()) {
        applyFailureWithoutAttempt(
          accountId,
          ["pending", "retryable"],
          classifyFailure(
            { code: "offline", outcome: "retryable" },
            { source: "browser_connectivity" },
          ),
        );
        return false;
      }
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
          const classified = Object.values(FAILURE_CATEGORIES).includes(result?.category)
            ? result
            : classifyFailure(result || {}, {
                source: result?.source || "operation_executor",
              });
          applyFailure(
            attempted.operationId,
            {
              ...classified,
              receipt: result?.receipt || null,
            },
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
        && !["accepted", "superseded"].includes(operation.state)));
    }

    return Object.freeze({
      queueGame,
      queueDelete,
      recordLocalOnlyDeletion,
      queueClock,
      process,
      isAcknowledged,
      isTombstoned,
      tombstoneFor,
      deleteRecoveryFor,
      finalizeAcceptedDelete,
      mergeServerTombstones,
      hasUnresolved,
      rejectAuthentication,
      recoverAuthentication,
    });
  }

  global.LaxHornetDurableSyncOperations = Object.freeze({
    SCHEMA_VERSION,
    DELETE_RECOVERY_VERSION,
    OPERATION_TYPES,
    OPERATION_STATES,
    FAILURE_CATEGORIES,
    isStoredState,
    normalizeState,
    payloadHash,
    classifyFailure,
    retryDelayMs,
    createDurableSyncOperationService,
  });
})(window);
