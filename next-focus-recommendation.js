(function attachNextFocusRecommendation(global) {
  "use strict";

  const MEANINGFUL_STAT_TYPES = new Set([
    "goal",
    "assist",
    "shot",
    "shotOnGoal",
    "goalieSave",
    "goalAllowed",
    "faceoffWin",
    "faceoffLoss",
    "groundBall",
    "turnover",
    "causedTurnover",
    "defensiveStop",
    "successfulClear",
    "failedClear",
    "hustlePlay",
    "backedUpShot",
    "smartPlay",
    "penalty",
  ]);

  const CANDIDATE_ORDER = [
    "goalie-outlet-reset",
    "possession-protection",
    "shot-selection",
    "clearing-support",
    "ground-ball-conversion",
    "discipline-positioning",
    "faceoff-follow-through",
    "defensive-transition",
    "goal-support",
    "assist-follow-through",
    "off-ball-support",
    "balanced-contribution",
    "repeat-useful-play",
  ];

  const LOW_EVIDENCE_RECOMMENDATION = Object.freeze({
    focusKey: "low-evidence",
    focusTitle: "Build a fuller game picture",
    whyThisFits: "There are fewer than four meaningful recorded events, so there is not enough evidence for a strong pattern yet.",
    tryThisNextGame: "Keep building a fuller game picture next time by tracking one simple pattern.",
    confidence: "low",
    category: "tracking",
    evidence: ["Limited recorded game evidence"],
    evidenceScore: 0,
    repetitionAdjusted: false,
  });

  function cleanText(value) {
    return String(value || "").trim();
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function ratio(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
  }

  function eventIdFor(item = {}, index = 0) {
    return cleanText(
      item.eventId
      || item.event_id
      || item.event?.id
      || item.eventEvidence?.event_id
      || item.evidence?.event_id
      || item.id,
    ) || `anonymous-event-${index}`;
  }

  function operationIdFor(item = {}) {
    return cleanText(item.clientOperationId || item.client_operation_id || item.operationId || item.operation_id);
  }

  function operationKindFor(item = {}) {
    return cleanText(item.kind || item.operationKind || item.operation_kind).toLowerCase();
  }

  function versionFor(item = {}) {
    return numberValue(
      item.serverEventVersion
      || item.server_event_version
      || item.eventVersion
      || item.event_version
      || item.version,
    );
  }

  function timeFor(item = {}) {
    const value = cleanText(
      item.correctedAt
      || item.corrected_at
      || item.updatedAt
      || item.updated_at
      || item.clientCreatedAt
      || item.client_created_at
      || item.timestamp
      || item.occurred_at,
    );
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function eventEvidenceFor(item = {}) {
    const source = item.event || item.eventEvidence || item.evidence || item.changes || item;
    return {
      id: cleanText(source.id || source.eventId || source.event_id || item.eventId || item.event_id),
      statType: cleanText(source.statType || source.stat_type),
      timestamp: cleanText(source.timestamp || source.occurred_at || item.timestamp),
      quarter: cleanText(source.quarter || source.period || item.quarter),
      fieldZone: cleanText(source.fieldZone || source.field_zone),
    };
  }

  function effectiveGameEvents(items = [], options = {}) {
    const deletedIds = new Set([
      ...(options.deletedEventIds || []),
      ...(options.tombstonedEventIds || []),
    ].map(cleanText).filter(Boolean));
    const seenOperations = new Set();
    const latestByEventId = new Map();

    (items || []).forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const eventId = eventIdFor(item, index);
      const operationId = operationIdFor(item);
      if (operationId && seenOperations.has(operationId)) return;
      if (operationId) seenOperations.add(operationId);

      const kind = operationKindFor(item);
      const lifecycleState = cleanText(item.lifecycleState || item.lifecycle_state).toLowerCase();
      if (kind === "tombstone" || lifecycleState === "tombstoned" || item.tombstoned === true || item.deleted === true) {
        deletedIds.add(eventId);
        latestByEventId.delete(eventId);
        return;
      }
      if (deletedIds.has(eventId)) return;

      const evidence = eventEvidenceFor(item);
      const existing = latestByEventId.get(eventId);
      const candidate = {
        ...(kind === "correct" && existing ? existing.event : {}),
        ...evidence,
        id: eventId,
      };
      const candidateVersion = versionFor(item);
      const candidateTime = timeFor(item);
      const shouldReplace = (
        !existing
        || candidateVersion > existing.version
        || (candidateVersion === existing.version && candidateTime >= existing.time)
      );
      if (shouldReplace) {
        latestByEventId.set(eventId, {
          event: candidate,
          version: candidateVersion,
          time: candidateTime,
          inputIndex: index,
        });
      }
    });

    return [...latestByEventId.values()]
      .sort((left, right) => left.time - right.time || left.inputIndex - right.inputIndex || left.event.id.localeCompare(right.event.id))
      .map((entry) => entry.event)
      .filter((event) => !deletedIds.has(event.id));
  }

  function buildGameProfile(items = [], options = {}) {
    const events = effectiveGameEvents(items, options);
    const counts = Object.fromEntries([...MEANINGFUL_STAT_TYPES].map((key) => [key, 0]));
    events.forEach((event) => {
      if (MEANINGFUL_STAT_TYPES.has(event.statType)) counts[event.statType] += 1;
    });

    const meaningfulEventCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const shotAttempts = counts.goal + counts.shotOnGoal + counts.shot;
    const onTargetShots = counts.goal + counts.shotOnGoal;
    const clearAttempts = counts.successfulClear + counts.failedClear;
    const faceoffAttempts = counts.faceoffWin + counts.faceoffLoss;
    const goalieActivity = counts.goalieSave + counts.goalAllowed;
    const possessionWins = (
      counts.groundBall
      + counts.successfulClear
      + counts.causedTurnover
      + counts.faceoffWin
      + counts.goalieSave
      + counts.backedUpShot
    );
    const possessionLosses = counts.turnover + counts.failedClear + counts.faceoffLoss;
    const possessionDecisions = possessionWins + possessionLosses;
    const defensiveContribution = counts.causedTurnover + counts.defensiveStop;
    const supportContribution = (
      counts.assist
      + counts.groundBall
      + counts.successfulClear
      + counts.causedTurnover
      + counts.defensiveStop
      + counts.hustlePlay
      + counts.backedUpShot
      + counts.smartPlay
    );
    const conversionSignals = (
      counts.successfulClear
      + counts.goal
      + counts.assist
      + counts.shotOnGoal
      + counts.smartPlay
    );
    const possessionGains = counts.groundBall + counts.faceoffWin + counts.causedTurnover + counts.goalieSave;

    return {
      counts,
      effectiveEventCount: events.length,
      meaningfulEventCount,
      lowEvidence: meaningfulEventCount < 4,
      shotAttempts,
      onTargetShots,
      shotOnTargetRatio: ratio(onTargetShots, shotAttempts),
      clearAttempts,
      clearSuccessRatio: ratio(counts.successfulClear, clearAttempts),
      faceoffAttempts,
      faceoffWinRatio: ratio(counts.faceoffWin, faceoffAttempts),
      goalieActivity,
      goalieSaveRatio: ratio(counts.goalieSave, goalieActivity),
      possessionWins,
      possessionLosses,
      possessionRetentionRatio: ratio(possessionWins, possessionDecisions),
      turnoverPressureRatio: ratio(counts.turnover, counts.turnover + possessionWins),
      defensiveContribution,
      supportContribution,
      possessionConversionRatio: Math.min(1, ratio(conversionSignals, possessionGains)),
    };
  }

  function candidate(focusKey, evidenceScore, fields) {
    return {
      focusKey,
      evidenceScore: Math.round(evidenceScore * 10) / 10,
      confidence: evidenceScore >= 84 ? "high" : evidenceScore >= 62 ? "medium" : "low",
      repetitionAdjusted: false,
      ...fields,
    };
  }

  function candidateOrder(candidateItem) {
    const index = CANDIDATE_ORDER.indexOf(candidateItem.focusKey);
    return index === -1 ? CANDIDATE_ORDER.length : index;
  }

  function rankedCandidates(candidates = []) {
    return [...candidates].sort(
      (left, right) => right.evidenceScore - left.evidenceScore || candidateOrder(left) - candidateOrder(right),
    );
  }

  function generateFocusCandidates(profile = {}, playerContext = {}) {
    const counts = profile.counts || {};
    const position = cleanText(
      typeof playerContext === "string"
        ? playerContext
        : playerContext.positionGroup || playerContext.position,
    ).toLowerCase();
    const candidates = [];
    const add = (focusKey, score, fields) => candidates.push(candidate(focusKey, score, fields));

    if (position.includes("goal") && profile.goalieActivity >= 3) {
      add("goalie-outlet-reset", 72 + counts.goalieSave * 3 + Math.min(10, counts.goalAllowed * 1.5), {
        focusTitle: "Outlet and reset after the save",
        whyThisFits: "Goalie activity shaped this game, so the next useful layer is organizing the reset and safest outlet.",
        tryThisNextGame: "After each save or goal, reset quickly, communicate early, and find the safest outlet.",
        category: "goalie",
        evidence: [
          `${profile.goalieActivity} goalie events`,
          `${counts.goalieSave} saves`,
          profile.clearAttempts ? `${Math.round(profile.clearSuccessRatio * 100)}% recorded clear success` : "",
        ].filter(Boolean),
      });
    }

    if (counts.turnover >= 3 && profile.turnoverPressureRatio >= 0.4) {
      add("possession-protection", 62 + profile.turnoverPressureRatio * 28 + Math.max(0, counts.turnover - 2) * 3, {
        focusTitle: "Protect possession under pressure",
        whyThisFits: "Several recorded possessions ended under pressure relative to the positive possession plays.",
        tryThisNextGame: "Secure the ball first, scan for the simple outlet, and move it before pressure closes.",
        category: "possession",
        evidence: [
          `${counts.turnover} turnovers`,
          `${profile.possessionWins} positive possession plays`,
          `${Math.round(profile.turnoverPressureRatio * 100)}% turnover share of tracked possession pressure`,
        ],
      });
    }

    if (counts.shot >= 3 && profile.shotAttempts >= 4 && profile.shotOnTargetRatio < 0.55) {
      add("shot-selection", 62 + (1 - profile.shotOnTargetRatio) * 25 + counts.shot * 2, {
        focusTitle: "Choose the higher-quality shooting look",
        whyThisFits: "Most recorded shot attempts did not force a save or finish as a goal.",
        tryThisNextGame: "Before shooting, look for a better angle, one more step, or the extra pass.",
        category: "scoring",
        evidence: [
          `${counts.shot} missed shots`,
          `${profile.onTargetShots} of ${profile.shotAttempts} attempts on target or goals`,
        ],
      });
    }

    if (counts.failedClear >= 2 && profile.clearAttempts >= 3 && profile.clearSuccessRatio <= 0.5) {
      add("clearing-support", 60 + (1 - profile.clearSuccessRatio) * 25 + counts.failedClear * 2, {
        focusTitle: "Create the first clean clearing outlet",
        whyThisFits: "Multiple recorded clears ended under pressure, and successful exits were limited.",
        tryThisNextGame: "Talk early, create width, and give the ball carrier the first simple outlet.",
        category: "clearing",
        evidence: [
          `${counts.failedClear} failed clears`,
          `${counts.successfulClear} successful clears`,
        ],
      });
    }

    if (
      counts.groundBall >= 3
      && (profile.possessionConversionRatio < 0.75 || counts.turnover + counts.failedClear >= 2)
    ) {
      add("ground-ball-conversion", 58 + counts.groundBall * 3 + (1 - profile.possessionConversionRatio) * 18, {
        focusTitle: "Secure the next pass after the ground ball",
        whyThisFits: "Ground-ball involvement was strong; the recorded follow-up plays leave room to turn more wins into settled possession.",
        tryThisNextGame: "Win the ground ball, protect the stick, then complete the first clean pass.",
        category: "possession",
        evidence: [
          `${counts.groundBall} ground balls`,
          `${Math.round(profile.possessionConversionRatio * 100)}% follow-up signal ratio`,
        ],
      });
    }

    if (counts.penalty >= 2 && counts.penalty / profile.meaningfulEventCount >= 0.2) {
      add("discipline-positioning", 60 + counts.penalty * 4 + (counts.penalty / profile.meaningfulEventCount) * 16, {
        focusTitle: "Compete with controlled positioning",
        whyThisFits: "Discipline events appeared more than once and represented a meaningful part of the recorded game.",
        tryThisNextGame: "Keep feet moving, stay balanced, and use position before contact.",
        category: "discipline",
        evidence: [`${counts.penalty} penalties in ${profile.meaningfulEventCount} meaningful events`],
      });
    }

    if (profile.faceoffAttempts >= 4) {
      add("faceoff-follow-through", 56 + profile.faceoffAttempts * 2 + Math.abs(profile.faceoffWinRatio - 0.5) * 8, {
        focusTitle: "Finish the faceoff with team possession",
        whyThisFits: "Faceoff results were a meaningful part of the game, and the next play determines whether the draw becomes settled possession.",
        tryThisNextGame: "Compete through the loose ball, connect with wing support, and make the first clean pass.",
        category: "faceoff",
        evidence: [
          `${counts.faceoffWin} faceoff wins`,
          `${counts.faceoffLoss} faceoff losses`,
        ],
      });
    }

    if (profile.defensiveContribution >= 3) {
      add("defensive-transition", 60 + profile.defensiveContribution * 4 + (counts.failedClear ? 4 : 0), {
        focusTitle: "Turn defensive stops into clean transitions",
        whyThisFits: "Defensive contribution was a clear part of the game; the next layer is organizing the possession after the stop.",
        tryThisNextGame: "After the stop, communicate the pickup and outlet so the defense can become a controlled clear.",
        category: "defense",
        evidence: [
          `${counts.causedTurnover} caused turnovers`,
          `${counts.defensiveStop} defensive stops`,
        ],
      });
    }

    if (counts.goal >= 2 && counts.goal > counts.assist) {
      add("goal-support", 58 + counts.goal * 4 + Math.max(0, 3 - profile.supportContribution) * 2, {
        focusTitle: "Add the next support play",
        whyThisFits: "Finishing drove the recorded impact, while fewer support events appeared around those scoring moments.",
        tryThisNextGame: "Build on the scoring by adding one feed, ride, backup, or ground-ball support play.",
        category: "balanced",
        evidence: [
          `${counts.goal} goals`,
          `${profile.supportContribution} recorded support plays`,
        ],
      });
    }

    if (counts.assist >= 2 && counts.assist >= counts.goal) {
      add("assist-follow-through", 59 + counts.assist * 4, {
        focusTitle: "Keep moving after the feed",
        whyThisFits: "Creating chances for teammates was a strong pattern, so the next step is staying available after the pass.",
        tryThisNextGame: "After the feed, relocate into support space and stay ready for the return pass or rebound.",
        category: "off-ball",
        evidence: [
          `${counts.assist} assists`,
          `${counts.goal} goals`,
        ],
      });
    }

    const effortEvents = counts.hustlePlay + counts.backedUpShot + counts.smartPlay;
    if (effortEvents >= 3) {
      add("off-ball-support", 54 + effortEvents * 3, {
        focusTitle: "Connect off-ball effort to the next possession",
        whyThisFits: "Hustle, backup, and smart-play involvement appeared repeatedly away from the scoring line.",
        tryThisNextGame: "Stay involved after the first effort play and help complete the next pass or possession.",
        category: "off-ball",
        evidence: [`${effortEvents} hustle, backup, or smart-play events`],
      });
    }

    const contributionGroups = [
      counts.goal + counts.assist + counts.shot + counts.shotOnGoal,
      counts.groundBall + counts.turnover + counts.successfulClear + counts.failedClear,
      profile.defensiveContribution,
      profile.goalieActivity,
      effortEvents,
      profile.faceoffAttempts,
    ].filter((count) => count > 0).length;
    if (profile.meaningfulEventCount >= 6 && contributionGroups >= 3) {
      add("balanced-contribution", 52 + contributionGroups * 3 + Math.min(6, profile.meaningfulEventCount / 2), {
        focusTitle: "Repeat the balanced involvement",
        whyThisFits: "The recorded game included meaningful involvement in several parts of play without one concern overwhelming the profile.",
        tryThisNextGame: "Choose one useful play from each side of the ball and try to repeat both.",
        category: "balanced",
        evidence: [`${contributionGroups} contribution areas across ${profile.meaningfulEventCount} meaningful events`],
      });
    }

    if (!candidates.length) {
      add("repeat-useful-play", 40, {
        focusTitle: "Repeat one useful play",
        whyThisFits: "The game has enough recorded evidence for review, but no single pattern crossed a stronger recommendation threshold.",
        tryThisNextGame: "Choose one useful recorded play and try to create it again early.",
        category: "development",
        evidence: [`${profile.meaningfulEventCount} meaningful recorded events`],
      });
    }

    return rankedCandidates(candidates);
  }

  function selectCandidate(candidates = [], recentFocusKeys = [], options = {}) {
    const ranked = rankedCandidates(candidates);
    const strongest = ranked[0] || null;
    if (!strongest) return null;
    const recent = (recentFocusKeys || []).map(cleanText).filter(Boolean).slice(0, 3);
    const repeatedCount = recent.filter((key) => key === strongest.focusKey).length;
    const alternative = ranked.find((item) => item.focusKey !== strongest.focusKey);
    const closeScoreDelta = numberValue(options.closeScoreDelta || 12);
    if (
      repeatedCount >= 2
      && alternative
      && strongest.evidenceScore - alternative.evidenceScore <= closeScoreDelta
    ) {
      return {
        ...alternative,
        repetitionAdjusted: true,
        repetitionReason: `${strongest.focusTitle} appeared in at least two recent games, and this alternative was within ${closeScoreDelta} evidence points.`,
      };
    }
    return strongest;
  }

  function recommendNextFocus(items = [], options = {}) {
    const profile = buildGameProfile(items, options);
    if (profile.lowEvidence) {
      return {
        ...LOW_EVIDENCE_RECOMMENDATION,
        profile,
        candidates: [],
      };
    }
    const candidates = generateFocusCandidates(profile, options.player || options.position || {});
    const selected = selectCandidate(candidates, options.recentFocusKeys, options);
    return {
      ...selected,
      profile,
      candidates,
    };
  }

  const api = Object.freeze({
    effectiveGameEvents,
    buildGameProfile,
    generateFocusCandidates,
    selectCandidate,
    recommendNextFocus,
  });

  global.LaxHornetNextFocus = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
