(function initializePublicEventSemantics(global) {
  "use strict";

  const definitions = Object.freeze([
    ["goal", "Goal", "Offense", 5, true],
    ["assist", "Assist", "Offense", 3, true],
    ["shot", "Missed Shot", "Offense", -0.5, true],
    ["shotOnGoal", "Shot on Goal", "Offense", 1, true],
    ["goalieSave", "Save", "Goalie", 3, true],
    ["goalAllowed", "Goal Allowed", "Goalie", -1, true],
    ["faceoffWin", "Faceoff Win", "Faceoff", 2, true],
    ["faceoffLoss", "Faceoff Loss", "Faceoff", -1, true],
    ["groundBall", "Ground Ball", "Effort / IQ", 2, true],
    ["turnover", "Turnover", "Possession", -2, true],
    ["causedTurnover", "Caused Turnover", "Defense", 3, true],
    ["defensiveStop", "Defensive Stop", "Defense", 3, true],
    ["successfulClear", "Successful Clear", "Clearing", 1, true],
    ["failedClear", "Failed Clear", "Clearing", -2, true],
    ["hustlePlay", "Hustle Play", "Effort / IQ", 1, true],
    ["backedUpShot", "Backed Up Shot", "Effort / IQ", 2, true],
    ["smartPlay", "Smart Play", "Effort / IQ", 1, true],
    ["penalty", "Penalty", "Discipline", -2, true],
    ["note", "Note", "Note", 0, false],
  ].map(([statType, statLabel, category, pointValue, publicLiveShare]) =>
    Object.freeze({ statType, statLabel, category, pointValue, publicLiveShare }),
  ));
  const periods = new Set(["Q1", "Q2", "Q3", "Q4", "H1", "H2", "OT"]);
  const fieldZones = new Map(
    ["", "Offensive end", "Midfield", "Defensive end", "Sideline", "Endline", "Crease"]
      .map((fieldZone) => [fieldZone.toLowerCase(), fieldZone]),
  );
  const utcTimestampPattern =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,6})?Z$/;

  function normalizedToken(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  const definitionByToken = new Map(
    definitions.map((definition) => [normalizedToken(definition.statType), definition]),
  );

  function canonicalSemantic(value = {}) {
    const statType = value.statType ?? value.stat_type;
    return definitionByToken.get(normalizedToken(statType)) || null;
  }

  function isPublicEvent(value = {}) {
    return canonicalSemantic(value)?.publicLiveShare === true;
  }

  function publicSemantic(value = {}) {
    const semantic = canonicalSemantic(value);
    return semantic?.publicLiveShare ? semantic : null;
  }

  function canonicalEvidence(value = {}) {
    const semantic = canonicalSemantic(value);
    const occurredAt = String(value.timestamp ?? value.occurred_at ?? "").trim();
    const occurredAtMatch = occurredAt.match(utcTimestampPattern);
    const parsedTime = Date.parse(occurredAt);
    const period = String(value.quarter ?? value.period ?? "").trim().toUpperCase();
    const rawFieldZone = String(value.fieldZone ?? value.field_zone ?? "").trim();
    const fieldZone = fieldZones.get(rawFieldZone.toLowerCase());
    if (
      !semantic
      || !occurredAtMatch
      || !Number.isFinite(parsedTime)
      || new Date(parsedTime).toISOString().slice(0, 19) !== occurredAtMatch[1]
      || !periods.has(period)
      || fieldZone === undefined
    ) {
      return null;
    }
    return Object.freeze({
      ...semantic,
      occurredAt: new Date(parsedTime).toISOString(),
      period,
      pointValue: semantic.pointValue,
      fieldZone,
    });
  }

  global.LaxHornetPublicEventSemantics = Object.freeze({
    definitions,
    normalizedToken,
    canonicalSemantic,
    canonicalEvidence,
    publicSemantic,
    isPublicEvent,
  });
})(window);
