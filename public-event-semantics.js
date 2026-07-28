(function initializePublicEventSemantics(global) {
  "use strict";

  const definitions = Object.freeze([
    ["goal", "Goal", "Offense", true],
    ["assist", "Assist", "Offense", true],
    ["shot", "Missed Shot", "Offense", true],
    ["shotOnGoal", "Shot on Goal", "Offense", true],
    ["goalieSave", "Save", "Goalie", true],
    ["goalAllowed", "Goal Allowed", "Goalie", true],
    ["faceoffWin", "Faceoff Win", "Faceoff", true],
    ["faceoffLoss", "Faceoff Loss", "Faceoff", true],
    ["groundBall", "Ground Ball", "Effort / IQ", true],
    ["turnover", "Turnover", "Possession", true],
    ["causedTurnover", "Caused Turnover", "Defense", true],
    ["defensiveStop", "Defensive Stop", "Defense", true],
    ["successfulClear", "Successful Clear", "Clearing", true],
    ["failedClear", "Failed Clear", "Clearing", true],
    ["hustlePlay", "Hustle Play", "Effort / IQ", true],
    ["backedUpShot", "Backed Up Shot", "Effort / IQ", true],
    ["smartPlay", "Smart Play", "Effort / IQ", true],
    ["penalty", "Penalty", "Discipline", true],
    ["note", "Note", "Note", false],
  ].map(([statType, statLabel, category, publicLiveShare]) =>
    Object.freeze({ statType, statLabel, category, publicLiveShare }),
  ));

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

  global.LaxHornetPublicEventSemantics = Object.freeze({
    definitions,
    normalizedToken,
    canonicalSemantic,
    publicSemantic,
    isPublicEvent,
  });
})(window);
