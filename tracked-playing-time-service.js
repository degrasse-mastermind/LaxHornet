(function initializeLaxHornetTrackedPlayingTime(global) {
  "use strict";

  const RECOVERY_STATES = Object.freeze(["complete", "estimated", "needs_review"]);
  const OPERATION_SOURCES = Object.freeze([
    "live",
    "manual",
    "recovery",
    "system_period_end",
    "system_game_end",
  ]);
  const PERIODS = Object.freeze({
    quarters: Object.freeze(["Q1", "Q2", "Q3", "Q4", "OT"]),
    halves: Object.freeze(["H1", "H2", "OT"]),
  });

  function requiredFunction(value, name) {
    if (typeof value !== "function") {
      throw new TypeError(`Tracked playing time service requires ${name}`);
    }
    return value;
  }

  function finiteInteger(value, name, minimum = 0) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < minimum) {
      throw new TypeError(`${name} must be an integer greater than or equal to ${minimum}`);
    }
    return number;
  }

  function timestampMilliseconds(value, name) {
    const milliseconds = Date.parse(String(value || ""));
    if (!Number.isFinite(milliseconds)) throw new TypeError(`${name} must be an ISO timestamp`);
    return milliseconds;
  }

  function isoTimestamp(value = Date.now()) {
    const milliseconds = typeof value === "number" ? value : timestampMilliseconds(value, "timestamp");
    return new Date(milliseconds).toISOString();
  }

  function periodDurationSeconds(clock, period = clock.currentPeriod) {
    if (period === "OT") {
      return finiteInteger(
        clock.overtimeDurationSeconds ?? clock.regulationPeriodDurationSeconds,
        "overtimeDurationSeconds",
        1,
      );
    }
    return finiteInteger(clock.regulationPeriodDurationSeconds, "regulationPeriodDurationSeconds", 1);
  }

  function normalizeClockState(clock = {}) {
    const periodFormat = PERIODS[clock.periodFormat] ? clock.periodFormat : "quarters";
    const currentPeriod = PERIODS[periodFormat].includes(clock.currentPeriod)
      ? clock.currentPeriod
      : PERIODS[periodFormat][0];
    const regulationPeriodDurationSeconds = finiteInteger(
      clock.regulationPeriodDurationSeconds,
      "regulationPeriodDurationSeconds",
      1,
    );
    const overtimeDurationSeconds = clock.overtimeDurationSeconds === null
      || clock.overtimeDurationSeconds === undefined
      ? null
      : finiteInteger(clock.overtimeDurationSeconds, "overtimeDurationSeconds", 1);
    const maximum = currentPeriod === "OT"
      ? overtimeDurationSeconds ?? regulationPeriodDurationSeconds
      : regulationPeriodDurationSeconds;
    const clockSecondsRemaining = Math.min(
      maximum,
      finiteInteger(clock.clockSecondsRemaining ?? maximum, "clockSecondsRemaining"),
    );
    const recoveryState = RECOVERY_STATES.includes(clock.recoveryState)
      ? clock.recoveryState
      : "complete";
    const clientUpdatedAt = isoTimestamp(clock.clientUpdatedAt || Date.now());

    return {
      version: 1,
      gameId: String(clock.gameId || ""),
      playerId: String(clock.playerId || ""),
      teamId: String(clock.teamId || ""),
      rosterPlayerId: String(clock.rosterPlayerId || ""),
      scopeType: clock.scopeType === "team_roster" ? "team_roster" : "personal",
      periodFormat,
      regulationPeriodDurationSeconds,
      overtimeDurationSeconds,
      currentPeriod,
      clockSecondsRemaining,
      isRunning: Boolean(clock.isRunning),
      startedAt: clock.startedAt ? isoTimestamp(clock.startedAt) : null,
      pausedAt: clock.pausedAt ? isoTimestamp(clock.pausedAt) : null,
      clientUpdatedAt,
      recoveryState,
      revision: finiteInteger(clock.revision ?? 1, "revision", 1),
    };
  }

  function createClockState(config = {}, now = Date.now()) {
    const periodFormat = PERIODS[config.periodFormat] ? config.periodFormat : "quarters";
    const currentPeriod = PERIODS[periodFormat].includes(config.currentPeriod)
      ? config.currentPeriod
      : PERIODS[periodFormat][0];
    const regulationPeriodDurationSeconds = finiteInteger(
      config.regulationPeriodDurationSeconds,
      "regulationPeriodDurationSeconds",
      1,
    );
    const overtimeDurationSeconds = config.overtimeDurationSeconds === null
      || config.overtimeDurationSeconds === undefined
      ? null
      : finiteInteger(config.overtimeDurationSeconds, "overtimeDurationSeconds", 1);
    return normalizeClockState({
      ...config,
      periodFormat,
      currentPeriod,
      regulationPeriodDurationSeconds,
      overtimeDurationSeconds,
      clockSecondsRemaining:
        config.clockSecondsRemaining
        ?? (currentPeriod === "OT" ? overtimeDurationSeconds ?? regulationPeriodDurationSeconds : regulationPeriodDurationSeconds),
      isRunning: false,
      startedAt: null,
      pausedAt: null,
      clientUpdatedAt: isoTimestamp(now),
      recoveryState: "complete",
      revision: 1,
    });
  }

  function projectClock(clock, now = Date.now()) {
    const normalized = normalizeClockState(clock);
    if (!normalized.isRunning || normalized.clockSecondsRemaining === 0) return normalized;
    const nowMilliseconds = typeof now === "number" ? now : timestampMilliseconds(now, "now");
    const updatedMilliseconds = timestampMilliseconds(normalized.clientUpdatedAt, "clientUpdatedAt");
    const elapsedSeconds = Math.max(0, Math.floor((nowMilliseconds - updatedMilliseconds) / 1000));
    if (!elapsedSeconds) return normalized;
    return {
      ...normalized,
      clockSecondsRemaining: Math.max(0, normalized.clockSecondsRemaining - elapsedSeconds),
      isRunning: normalized.clockSecondsRemaining - elapsedSeconds > 0,
      pausedAt: normalized.clockSecondsRemaining - elapsedSeconds > 0 ? null : isoTimestamp(nowMilliseconds),
      clientUpdatedAt: isoTimestamp(nowMilliseconds),
    };
  }

  function startClock(clock, now = Date.now()) {
    const normalized = projectClock(clock, now);
    if (normalized.isRunning || normalized.clockSecondsRemaining === 0) return normalized;
    const timestamp = isoTimestamp(now);
    return {
      ...normalized,
      isRunning: true,
      startedAt: normalized.startedAt || timestamp,
      pausedAt: null,
      clientUpdatedAt: timestamp,
      revision: normalized.revision + 1,
    };
  }

  function pauseClock(clock, now = Date.now()) {
    const projected = projectClock(clock, now);
    if (!projected.isRunning) return projected;
    const timestamp = isoTimestamp(now);
    return {
      ...projected,
      isRunning: false,
      pausedAt: timestamp,
      clientUpdatedAt: timestamp,
      revision: projected.revision + 1,
    };
  }

  function resumeClock(clock, now = Date.now()) {
    return startClock(clock, now);
  }

  function persistClockPosition(clock, now = Date.now()) {
    const projected = projectClock(clock, now);
    const timestamp = isoTimestamp(now);
    return {
      ...projected,
      clientUpdatedAt: timestamp,
      revision: projected.revision + 1,
    };
  }

  function transitionPeriod(clock, nextPeriod, now = Date.now()) {
    const projected = projectClock(clock, now);
    if (!PERIODS[projected.periodFormat].includes(nextPeriod)) {
      throw new TypeError(`Invalid ${projected.periodFormat} period: ${nextPeriod}`);
    }
    const timestamp = isoTimestamp(now);
    return {
      ...projected,
      currentPeriod: nextPeriod,
      clockSecondsRemaining: periodDurationSeconds(projected, nextPeriod),
      isRunning: false,
      startedAt: null,
      pausedAt: timestamp,
      clientUpdatedAt: timestamp,
      recoveryState: "complete",
      revision: projected.revision + 1,
    };
  }

  function gameEndClosureContext(clock, now = Date.now()) {
    const projected = projectClock(clock, now);
    return Object.freeze({
      period: projected.currentPeriod,
      gameClockSeconds: projected.clockSecondsRemaining,
      occurredAt: isoTimestamp(now),
      source: "system_game_end",
      systemCloseReason: "game_end",
      recoveryUncertain: projected.recoveryState === "needs_review",
    });
  }

  function classifyClockRecovery(clock, now = Date.now(), options = {}) {
    let normalized;
    try {
      normalized = normalizeClockState(clock);
    } catch {
      return Object.freeze({ status: "needs_review", clockState: null, reason: "invalid_clock_state" });
    }
    if (!normalized.isRunning) {
      return Object.freeze({ status: normalized.recoveryState, clockState: normalized, reason: "paused_state" });
    }

    const maximumGapSeconds = finiteInteger(options.maximumCertainGapSeconds ?? 30, "maximumCertainGapSeconds");
    const nowMilliseconds = typeof now === "number" ? now : timestampMilliseconds(now, "now");
    const updatedMilliseconds = timestampMilliseconds(normalized.clientUpdatedAt, "clientUpdatedAt");
    const gapSeconds = Math.max(0, Math.floor((nowMilliseconds - updatedMilliseconds) / 1000));
    if (gapSeconds <= maximumGapSeconds) {
      return Object.freeze({
        status: normalized.recoveryState,
        clockState: projectClock(normalized, nowMilliseconds),
        reason: "bounded_running_recovery",
      });
    }
    return Object.freeze({
      status: "needs_review",
      clockState: {
        ...normalized,
        isRunning: false,
        recoveryState: "needs_review",
        pausedAt: isoTimestamp(nowMilliseconds),
        clientUpdatedAt: isoTimestamp(nowMilliseconds),
        revision: normalized.revision + 1,
      },
      reason: "uncertain_running_gap",
    });
  }

  function normalizeParticipationOperation(operation = {}) {
    const operationKind = String(operation.operationKind || "");
    if (!["player_in", "player_out", "correct", "tombstone"].includes(operationKind)) {
      throw new TypeError("Unsupported participation operation kind");
    }
    const source = OPERATION_SOURCES.includes(operation.source) ? operation.source : "live";
    const normalized = {
      operationId: String(operation.operationId || ""),
      clientOperationId: String(operation.clientOperationId || ""),
      logicalEventId: String(operation.logicalEventId || ""),
      targetOperationId: String(operation.targetOperationId || ""),
      gameId: String(operation.gameId || ""),
      playerId: String(operation.playerId || ""),
      operationKind,
      period: operation.period ? String(operation.period) : "",
      gameClockSeconds: operation.gameClockSeconds === null || operation.gameClockSeconds === undefined
        ? null
        : finiteInteger(operation.gameClockSeconds, "gameClockSeconds"),
      occurredAt: operation.occurredAt ? isoTimestamp(operation.occurredAt) : null,
      clientCreatedAt: isoTimestamp(operation.clientCreatedAt || Date.now()),
      source,
      systemCloseReason: operation.systemCloseReason ? String(operation.systemCloseReason) : null,
      recoveryUncertain: Boolean(operation.recoveryUncertain),
      changeReason: String(operation.changeReason || ""),
      revision: operation.revision === null || operation.revision === undefined
        ? null
        : finiteInteger(operation.revision, "revision", 1),
      syncState: operation.syncState === "accepted" ? "accepted" : "pending",
    };
    for (const [name, value] of [
      ["operationId", normalized.operationId],
      ["clientOperationId", normalized.clientOperationId],
      ["logicalEventId", normalized.logicalEventId],
      ["gameId", normalized.gameId],
    ]) {
      if (!value) throw new TypeError(`${name} is required`);
    }
    if (operationKind === "tombstone") {
      if (!normalized.targetOperationId || !normalized.changeReason) {
        throw new TypeError("Tombstone requires targetOperationId and changeReason");
      }
    } else if (operationKind === "correct") {
      if (
        !normalized.targetOperationId
        || !normalized.period
        || normalized.gameClockSeconds === null
        || !normalized.occurredAt
        || !normalized.changeReason
      ) {
        throw new TypeError("Correction requires target, clock position, timestamp, and reason");
      }
    } else if (
      !normalized.playerId
      || !normalized.period
      || normalized.gameClockSeconds === null
      || !normalized.occurredAt
    ) {
      throw new TypeError("Player In/Out requires player, clock position, and timestamp");
    }
    return normalized;
  }

  function participationRpcPayload(operation) {
    const normalized = normalizeParticipationOperation(operation);
    const payload = {
      operation_id: normalized.operationId,
      client_operation_id: normalized.clientOperationId,
      logical_event_id: normalized.logicalEventId,
      game_id: normalized.gameId,
      operation_kind: normalized.operationKind,
      client_created_at: normalized.clientCreatedAt,
      source: normalized.source,
      recovery_uncertain: normalized.recoveryUncertain,
    };
    if (normalized.operationKind === "player_in" || normalized.operationKind === "player_out") {
      Object.assign(payload, {
        player_id: normalized.playerId,
        period: normalized.period,
        game_clock_seconds: normalized.gameClockSeconds,
        occurred_at: normalized.occurredAt,
        system_close_reason: normalized.systemCloseReason,
      });
    } else if (normalized.operationKind === "correct") {
      Object.assign(payload, {
        target_operation_id: normalized.targetOperationId,
        period: normalized.period,
        game_clock_seconds: normalized.gameClockSeconds,
        occurred_at: normalized.occurredAt,
        change_reason: normalized.changeReason,
      });
    } else {
      Object.assign(payload, {
        target_operation_id: normalized.targetOperationId,
        change_reason: normalized.changeReason,
      });
    }
    return payload;
  }

  function clockRpcPayload(clock, options = {}) {
    const normalized = normalizeClockState(clock);
    const payload = {
      game_id: normalized.gameId,
      current_period: normalized.currentPeriod,
      clock_seconds_remaining: normalized.clockSecondsRemaining,
      is_running: normalized.isRunning,
      started_at: normalized.startedAt,
      paused_at: normalized.pausedAt,
      client_updated_at: normalized.clientUpdatedAt,
      recovery_state: normalized.recoveryState,
    };
    if (options.initialize) {
      Object.assign(payload, {
        period_format: normalized.periodFormat,
        regulation_period_duration_seconds: normalized.regulationPeriodDurationSeconds,
        overtime_duration_seconds: normalized.overtimeDurationSeconds,
      });
    } else {
      payload.base_revision = finiteInteger(options.baseRevision ?? normalized.revision, "baseRevision", 1);
    }
    return payload;
  }

  function trackedPlayingTimeState(game) {
    if (!game || typeof game !== "object") throw new TypeError("game is required");
    if (!game.trackedPlayingTime || game.trackedPlayingTime.version !== 1) {
      game.trackedPlayingTime = {
        version: 1,
        clockState: null,
        participationOperations: [],
        remoteEffectiveParticipation: [],
      };
    }
    if (!Array.isArray(game.trackedPlayingTime.participationOperations)) {
      game.trackedPlayingTime.participationOperations = [];
    }
    if (!Array.isArray(game.trackedPlayingTime.remoteEffectiveParticipation)) {
      game.trackedPlayingTime.remoteEffectiveParticipation = [];
    }
    return game.trackedPlayingTime;
  }

  function resolveEffectiveParticipationOperations(operations = []) {
    const seenClientIds = new Set();
    const heads = new Map();
    for (const raw of operations) {
      let operation;
      try {
        operation = normalizeParticipationOperation(raw);
      } catch {
        continue;
      }
      if (seenClientIds.has(operation.clientOperationId)) continue;
      seenClientIds.add(operation.clientOperationId);
      const current = heads.get(operation.logicalEventId);
      if (!current) {
        if (operation.operationKind === "player_in" || operation.operationKind === "player_out") {
          heads.set(operation.logicalEventId, operation);
        }
        continue;
      }
      if (operation.targetOperationId !== current.operationId) continue;
      if (operation.operationKind === "correct") {
        heads.set(operation.logicalEventId, {
          ...current,
          ...operation,
          playerId: current.playerId,
          operationKind: current.operationKind,
          corrected: true,
        });
      } else if (operation.operationKind === "tombstone") {
        heads.delete(operation.logicalEventId);
      }
    }
    return [...heads.values()];
  }

  function createTrackedPlayingTimeService(hooks = {}) {
    const persistLocal = requiredFunction(hooks.persistLocal, "persistLocal");
    const sendClock = requiredFunction(hooks.sendClock, "sendClock");
    const sendOperations = requiredFunction(hooks.sendOperations, "sendOperations");
    const readEffectiveOperations = requiredFunction(
      hooks.readEffectiveOperations,
      "readEffectiveOperations",
    );
    const canUseCloud = typeof hooks.canUseCloud === "function" ? hooks.canUseCloud : () => true;
    const reportError = typeof hooks.reportError === "function" ? hooks.reportError : () => {};

    function initializeClock({ game, clockState }) {
      const local = trackedPlayingTimeState(game);
      local.clockState = normalizeClockState(clockState);
      persistLocal();
      const cloudPromise = canUseCloud()
        ? Promise.resolve(sendClock(clockRpcPayload(local.clockState, { initialize: true }))).catch((error) => {
            reportError(error);
            return false;
          })
        : Promise.resolve(false);
      return { game, clockState: local.clockState, cloudPromise };
    }

    function updateClock({ game, clockState, baseRevision }) {
      const local = trackedPlayingTimeState(game);
      local.clockState = normalizeClockState(clockState);
      persistLocal();
      const cloudPromise = canUseCloud()
        ? Promise.resolve(sendClock(clockRpcPayload(local.clockState, { baseRevision }))).catch((error) => {
            reportError(error);
            return false;
          })
        : Promise.resolve(false);
      return { game, clockState: local.clockState, cloudPromise };
    }

    function appendParticipationOperation({ game, operation }) {
      const local = trackedPlayingTimeState(game);
      const normalized = normalizeParticipationOperation(operation);
      const duplicate = local.participationOperations.find(
        (item) => item.clientOperationId === normalized.clientOperationId,
      );
      if (duplicate) return { game, operation: duplicate, duplicate: true, cloudPromise: Promise.resolve(true) };
      local.participationOperations.push(normalized);
      persistLocal();
      const cloudPromise = canUseCloud()
        ? retryParticipationOperations(game)
        : Promise.resolve(false);
      return { game, operation: normalized, duplicate: false, cloudPromise };
    }

    async function retryParticipationOperations(game) {
      const local = trackedPlayingTimeState(game);
      const pending = local.participationOperations.filter((operation) => operation.syncState !== "accepted");
      if (!pending.length) return true;
      if (!canUseCloud()) return false;
      try {
        const response = await sendOperations(pending.map(participationRpcPayload));
        const results = Array.isArray(response?.results) ? response.results : [];
        const accepted = new Set(
          results
            .filter((result) => result?.outcome === "accepted")
            .map((result) => String(result.clientOperationId || "")),
        );
        for (const operation of pending) {
          if (accepted.has(operation.clientOperationId)) operation.syncState = "accepted";
        }
        persistLocal();
        return pending.every((operation) => operation.syncState === "accepted");
      } catch (error) {
        reportError(error);
        return false;
      }
    }

    async function reconcileParticipationOperations(game) {
      if (!canUseCloud()) return false;
      const retried = await retryParticipationOperations(game);
      try {
        const response = await readEffectiveOperations(game.id);
        if (response?.outcome !== "accepted" || !Array.isArray(response.operations)) return false;
        trackedPlayingTimeState(game).remoteEffectiveParticipation = response.operations.map((operation) => ({
          ...operation,
        }));
        persistLocal();
        return retried;
      } catch (error) {
        reportError(error);
        return false;
      }
    }

    return Object.freeze({
      initializeClock,
      updateClock,
      appendParticipationOperation,
      retryParticipationOperations,
      reconcileParticipationOperations,
    });
  }

  global.LaxHornetTrackedPlayingTime = Object.freeze({
    RECOVERY_STATES,
    OPERATION_SOURCES,
    PERIODS,
    createClockState,
    normalizeClockState,
    periodDurationSeconds,
    projectClock,
    startClock,
    pauseClock,
    resumeClock,
    persistClockPosition,
    transitionPeriod,
    gameEndClosureContext,
    classifyClockRecovery,
    normalizeParticipationOperation,
    participationRpcPayload,
    clockRpcPayload,
    trackedPlayingTimeState,
    resolveEffectiveParticipationOperations,
    createTrackedPlayingTimeService,
  });
})(window);
