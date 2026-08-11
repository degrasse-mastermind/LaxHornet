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
  const CLOCK_COMMANDS = Object.freeze([
    "initialize",
    "start",
    "pause",
    "resume",
    "persist_position",
    "advance_period",
    "set_remaining",
    "correct_remaining",
    "complete",
  ]);

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
    const serverClockVersion = finiteInteger(
      clock.serverClockVersion ?? clock.clockVersion ?? 0,
      "serverClockVersion",
    );
    const anchorServerAt = clock.anchorServerAt
      ? isoTimestamp(clock.anchorServerAt)
      : null;
    const anchorClockSecondsRemaining = clock.anchorClockSecondsRemaining === null
      || clock.anchorClockSecondsRemaining === undefined
      ? null
      : Math.min(maximum, finiteInteger(
          clock.anchorClockSecondsRemaining,
          "anchorClockSecondsRemaining",
        ));

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
      serverClockVersion,
      anchorServerAt,
      anchorClockSecondsRemaining,
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
    const hasServerAnchor = normalized.anchorServerAt
      && normalized.anchorClockSecondsRemaining !== null;
    const updatedMilliseconds = timestampMilliseconds(
      hasServerAnchor ? normalized.anchorServerAt : normalized.clientUpdatedAt,
      hasServerAnchor ? "anchorServerAt" : "clientUpdatedAt",
    );
    const projectedRemaining = hasServerAnchor
      ? normalized.anchorClockSecondsRemaining
      : normalized.clockSecondsRemaining;
    const elapsedSeconds = Math.max(0, Math.floor((nowMilliseconds - updatedMilliseconds) / 1000));
    if (!elapsedSeconds) return normalized;
    return {
      ...normalized,
      clockSecondsRemaining: Math.max(0, projectedRemaining - elapsedSeconds),
      isRunning: projectedRemaining - elapsedSeconds > 0,
      pausedAt: projectedRemaining - elapsedSeconds > 0 ? null : isoTimestamp(nowMilliseconds),
      clientUpdatedAt: isoTimestamp(nowMilliseconds),
    };
  }

  function withoutServerAnchor(clock) {
    return {
      ...clock,
      anchorServerAt: null,
      anchorClockSecondsRemaining: null,
    };
  }

  function startClock(clock, now = Date.now()) {
    const normalized = projectClock(clock, now);
    if (normalized.isRunning || normalized.clockSecondsRemaining === 0) return normalized;
    const timestamp = isoTimestamp(now);
    return withoutServerAnchor({
      ...normalized,
      isRunning: true,
      startedAt: normalized.startedAt || timestamp,
      pausedAt: null,
      clientUpdatedAt: timestamp,
      revision: normalized.revision + 1,
    });
  }

  function pauseClock(clock, now = Date.now()) {
    const projected = projectClock(clock, now);
    if (!projected.isRunning) return projected;
    const timestamp = isoTimestamp(now);
    return withoutServerAnchor({
      ...projected,
      isRunning: false,
      pausedAt: timestamp,
      clientUpdatedAt: timestamp,
      revision: projected.revision + 1,
    });
  }

  function resumeClock(clock, now = Date.now()) {
    return startClock(clock, now);
  }

  function persistClockPosition(clock, now = Date.now()) {
    const projected = projectClock(clock, now);
    const timestamp = isoTimestamp(now);
    return withoutServerAnchor({
      ...projected,
      clientUpdatedAt: timestamp,
      revision: projected.revision + 1,
    });
  }

  function transitionPeriod(clock, nextPeriod, now = Date.now()) {
    const projected = projectClock(clock, now);
    if (!PERIODS[projected.periodFormat].includes(nextPeriod)) {
      throw new TypeError(`Invalid ${projected.periodFormat} period: ${nextPeriod}`);
    }
    const timestamp = isoTimestamp(now);
    return withoutServerAnchor({
      ...projected,
      currentPeriod: nextPeriod,
      clockSecondsRemaining: periodDurationSeconds(projected, nextPeriod),
      isRunning: false,
      startedAt: null,
      pausedAt: timestamp,
      clientUpdatedAt: timestamp,
      recoveryState: "complete",
      revision: projected.revision + 1,
    });
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

  function clockCommandPayload(clock, options = {}) {
    const normalized = normalizeClockState(clock);
    const command = String(options.command || "");
    if (!CLOCK_COMMANDS.includes(command)) throw new TypeError("Unsupported clock command");
    const expectedLifecycle = String(options.expectedLifecycle || "");
    if (!["active", "paused", "completed"].includes(expectedLifecycle)) {
      throw new TypeError("expectedLifecycle must be active, paused, or completed");
    }
    const statusBaseVersion = finiteInteger(
      options.statusBaseVersion,
      "statusBaseVersion",
      1,
    );
    const baseClockVersion = command === "initialize"
      ? 0
      : finiteInteger(
          options.baseClockVersion ?? normalized.serverClockVersion,
          "baseClockVersion",
          1,
        );
    const argumentsValue = command === "initialize"
      ? {
          period_format: normalized.periodFormat,
          regulation_period_duration_seconds: normalized.regulationPeriodDurationSeconds,
          overtime_duration_seconds: normalized.overtimeDurationSeconds,
          current_period: normalized.currentPeriod,
          clock_seconds_remaining: normalized.clockSecondsRemaining,
        }
      : { ...(options.arguments || {}) };
    return Object.freeze({
      contract: "r207_clock_v2",
      gameId: normalized.gameId,
      command,
      arguments: argumentsValue,
      baseClockVersion,
      statusBaseVersion,
      expectedLifecycle,
      clientOccurredAt: normalized.clientUpdatedAt,
    });
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

  function periodSequence(periodFormat = "quarters") {
    return PERIODS[PERIODS[periodFormat] ? periodFormat : "quarters"];
  }

  function compareParticipationOperations(left, right, periodFormat = "quarters") {
    const periods = periodSequence(periodFormat);
    const leftPeriod = periods.indexOf(left.period);
    const rightPeriod = periods.indexOf(right.period);
    if (leftPeriod !== rightPeriod) {
      return (leftPeriod < 0 ? Number.MAX_SAFE_INTEGER : leftPeriod)
        - (rightPeriod < 0 ? Number.MAX_SAFE_INTEGER : rightPeriod);
    }
    if (left.gameClockSeconds !== right.gameClockSeconds) {
      return right.gameClockSeconds - left.gameClockSeconds;
    }
    const occurredDifference = Date.parse(left.occurredAt || left.clientCreatedAt)
      - Date.parse(right.occurredAt || right.clientCreatedAt);
    if (occurredDifference) return occurredDifference;
    return left.clientOperationId.localeCompare(right.clientOperationId);
  }

  function configuredGameDurationSeconds(clockState, effectiveOperations = []) {
    if (!clockState) return null;
    let clock;
    try {
      clock = normalizeClockState(clockState);
    } catch {
      return null;
    }
    const regulationPeriods = clock.periodFormat === "halves" ? 2 : 4;
    let total = regulationPeriods * clock.regulationPeriodDurationSeconds;
    const usedOvertime = clock.currentPeriod === "OT"
      || effectiveOperations.some((operation) => operation.period === "OT");
    if (usedOvertime) {
      if (!clock.overtimeDurationSeconds) return null;
      total += clock.overtimeDurationSeconds;
    }
    return total;
  }

  function derivePlayingTimeSummary({
    operations = [],
    clockState = null,
    syncIssue = "",
  } = {}) {
    const periodFormat = clockState?.periodFormat || "quarters";
    const effectiveOperations = resolveEffectiveParticipationOperations(operations)
      .sort((left, right) => compareParticipationOperations(left, right, periodFormat));
    const shifts = [];
    const issues = [];
    let activeStart = null;

    const addIssue = (code, operation, detail) => {
      issues.push({
        code,
        operation,
        period: operation?.period || "",
        detail,
      });
    };

    for (const operation of effectiveOperations) {
      if (!periodSequence(periodFormat).includes(operation.period)) {
        addIssue("missing_period_context", operation, "A participation boundary has no valid period.");
        continue;
      }
      if (operation.recoveryUncertain) {
        addIssue("recovery_uncertain", operation, "Clock recovery could not prove the exact boundary.");
      }
      if (operation.operationKind === "player_in") {
        if (activeStart) {
          addIssue("overlapping_player_in", operation, "Player In was recorded while the player was already on field.");
          continue;
        }
        activeStart = operation;
        continue;
      }
      if (operation.operationKind !== "player_out") continue;
      if (!activeStart) {
        addIssue("unmatched_player_out", operation, "Player Out has no matching Player In.");
        continue;
      }
      if (activeStart.period !== operation.period) {
        addIssue("cross_period_shift", operation, "A shift cannot cross a period boundary.");
        activeStart = null;
        continue;
      }
      const durationSeconds = activeStart.gameClockSeconds - operation.gameClockSeconds;
      if (durationSeconds < 0) {
        addIssue("invalid_clock_order", operation, "Shift end occurs before its start.");
        activeStart = null;
        continue;
      }
      shifts.push({
        id: `${activeStart.logicalEventId}:${operation.logicalEventId}`,
        startOperation: activeStart,
        endOperation: operation,
        period: activeStart.period,
        startClockSeconds: activeStart.gameClockSeconds,
        endClockSeconds: operation.gameClockSeconds,
        durationSeconds,
        sources: [...new Set([activeStart.source, operation.source])],
        corrected: Boolean(activeStart.corrected || operation.corrected),
        manual: activeStart.source === "manual" || operation.source === "manual",
        systemClosed: ["system_period_end", "system_game_end"].includes(operation.source),
        reviewIssue: null,
      });
      activeStart = null;
    }

    if (activeStart) {
      addIssue("unmatched_player_in", activeStart, "Player In is still open.");
    }
    if (syncIssue) {
      issues.push({
        code: "sync_issue",
        operation: null,
        period: "",
        detail: String(syncIssue),
      });
    }

    const totalSeconds = shifts.reduce((total, shift) => total + shift.durationSeconds, 0);
    const shiftCount = shifts.length;
    const manualOrCorrected = shifts.some((shift) => shift.manual || shift.corrected);
    const status = issues.length ? "needs_review" : manualOrCorrected ? "estimated" : "complete";
    const configuredDurationSeconds = configuredGameDurationSeconds(clockState, effectiveOperations);
    const gameShare = configuredDurationSeconds
      ? Math.round((totalSeconds / configuredDurationSeconds) * 100)
      : null;

    return {
      effectiveOperations,
      shifts,
      issues,
      activeStart,
      onField: Boolean(activeStart),
      totalSeconds,
      shiftCount,
      averageSeconds: shiftCount ? Math.round(totalSeconds / shiftCount) : 0,
      longestSeconds: shiftCount ? Math.max(...shifts.map((shift) => shift.durationSeconds)) : 0,
      configuredDurationSeconds,
      gameShare,
      status,
      statusExplanation: issues.length
        ? issues[0].detail
        : manualOrCorrected
          ? "Includes a manual entry or correction."
          : "All tracked shifts have valid live or system boundaries.",
    };
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
    const canQueueClock = typeof hooks.canQueueClock === "function"
      ? hooks.canQueueClock
      : canUseCloud;
    const reportError = typeof hooks.reportError === "function" ? hooks.reportError : () => {};

    function initializeClock({ game, clockState, commandContext = {} }) {
      const local = trackedPlayingTimeState(game);
      local.clockState = normalizeClockState(clockState);
      persistLocal();
      const cloudPromise = canQueueClock()
        ? Promise.resolve(sendClock(
            clockRpcPayload(local.clockState, { initialize: true }),
            { ...commandContext, afterClock: local.clockState },
          )).catch((error) => {
            reportError(error);
            return false;
          })
        : Promise.resolve(false);
      return { game, clockState: local.clockState, cloudPromise };
    }

    function updateClock({ game, clockState, baseRevision, commandContext = {} }) {
      const local = trackedPlayingTimeState(game);
      local.clockState = normalizeClockState(clockState);
      persistLocal();
      const cloudPromise = canQueueClock()
        ? Promise.resolve(sendClock(
            clockRpcPayload(local.clockState, { baseRevision }),
            { ...commandContext, afterClock: local.clockState },
          )).catch((error) => {
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
    CLOCK_COMMANDS,
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
    clockCommandPayload,
    trackedPlayingTimeState,
    resolveEffectiveParticipationOperations,
    configuredGameDurationSeconds,
    derivePlayingTimeSummary,
    createTrackedPlayingTimeService,
  });
})(window);
