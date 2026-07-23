import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "next-focus-recommendation.js"), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: "next-focus-recommendation.js" });
const engine = context.window.LaxHornetNextFocus;

let nextId = 0;
function events(spec = {}) {
  return Object.entries(spec).flatMap(([statType, count]) =>
    Array.from({ length: count }, () => ({
      id: `event-${nextId += 1}`,
      statType,
      timestamp: new Date(Date.UTC(2026, 6, 1, 12, nextId)).toISOString(),
    })),
  );
}

function recommend(spec, options = {}) {
  return engine.recommendNextFocus(events(spec), options);
}

const scoringHeavy = recommend({ goal: 4, shotOnGoal: 2, assist: 1, groundBall: 1 });
const possessionLossHeavy = recommend({ turnover: 5, groundBall: 1, successfulClear: 1 });
assert.notEqual(scoringHeavy.focusKey, possessionLossHeavy.focusKey, "different game profiles should produce different focuses");

const goalHeavy = recommend({ goal: 4, shotOnGoal: 2, groundBall: 1 });
const assistHeavy = recommend({ assist: 4, smartPlay: 2, groundBall: 1 });
assert.equal(goalHeavy.focusKey, "goal-support");
assert.equal(assistHeavy.focusKey, "assist-follow-through");

assert.equal(
  recommend({ turnover: 5, groundBall: 1, successfulClear: 1 }).focusKey,
  "possession-protection",
);

assert.equal(
  recommend({ shot: 5, shotOnGoal: 1, groundBall: 1 }).focusKey,
  "shot-selection",
);

assert.equal(
  recommend({ groundBall: 5, turnover: 2, hustlePlay: 1 }).focusKey,
  "ground-ball-conversion",
);

assert.equal(
  recommend({ causedTurnover: 3, defensiveStop: 2, successfulClear: 2, groundBall: 1 }).focusKey,
  "defensive-transition",
);

assert.equal(
  recommend(
    { goalieSave: 6, goalAllowed: 2, successfulClear: 1, failedClear: 1 },
    { player: { position: "Goalie" } },
  ).focusKey,
  "goalie-outlet-reset",
);

const isolatedNegative = recommend({ turnover: 1, goal: 2, assist: 2, groundBall: 2 });
assert.notEqual(isolatedNegative.focusKey, "possession-protection", "one turnover must not dominate a fuller profile");

const lowEvidence = recommend({ turnover: 1, groundBall: 1, note: 4 });
assert.equal(lowEvidence.focusKey, "low-evidence");
assert.match(lowEvidence.whyThisFits, /fewer than four meaningful/i);

const tombstoned = engine.recommendNextFocus([
  { kind: "create", clientOperationId: "create-1", eventId: "same-event", eventEvidence: { stat_type: "turnover" } },
  { kind: "tombstone", clientOperationId: "delete-1", eventId: "same-event" },
  ...events({ goal: 2, assist: 2, groundBall: 1 }),
]);
assert.equal(tombstoned.profile.counts.turnover, 0);

const corrected = engine.buildGameProfile([
  { kind: "create", clientOperationId: "create-2", eventId: "corrected-event", eventEvidence: { stat_type: "turnover" }, serverEventVersion: 1 },
  { kind: "correct", clientOperationId: "correct-2", eventId: "corrected-event", changes: { stat_type: "successfulClear" }, serverEventVersion: 2 },
  ...events({ groundBall: 3, smartPlay: 1 }),
]);
assert.equal(corrected.counts.turnover, 0);
assert.equal(corrected.counts.successfulClear, 1);

const duplicated = engine.buildGameProfile([
  { kind: "create", clientOperationId: "duplicate-op", eventId: "duplicate-event", eventEvidence: { stat_type: "groundBall" } },
  { kind: "create", clientOperationId: "duplicate-op", eventId: "duplicate-event", eventEvidence: { stat_type: "groundBall" } },
  ...events({ groundBall: 3 }),
]);
assert.equal(duplicated.counts.groundBall, 4);

const closeProfile = events({ causedTurnover: 3, defensiveStop: 1, failedClear: 3, successfulClear: 1 });
const closeOriginal = engine.recommendNextFocus(closeProfile);
const closeAdjusted = engine.recommendNextFocus(closeProfile, {
  recentFocusKeys: [closeOriginal.focusKey, closeOriginal.focusKey],
});
assert.notEqual(closeAdjusted.focusKey, closeOriginal.focusKey, "a close alternative should be selected after repetition");
assert.equal(closeAdjusted.repetitionAdjusted, true);

const dominantProfile = events({ turnover: 7, successfulClear: 1, goal: 1, smartPlay: 1 });
const dominantOriginal = engine.recommendNextFocus(dominantProfile);
const dominantRepeated = engine.recommendNextFocus(dominantProfile, {
  recentFocusKeys: [dominantOriginal.focusKey, dominantOriginal.focusKey],
});
assert.equal(dominantOriginal.focusKey, "possession-protection");
assert.equal(dominantRepeated.focusKey, "possession-protection", "a clearly dominant repeated focus should remain selected");
assert.equal(dominantRepeated.repetitionAdjusted, false);

const publicSafeEvents = [
  ...events({ goal: 2, assist: 2 }),
  { id: "private-note", statType: "note", note: "Private medical detail", tags: ["private-team-tag"] },
];
const publicSafe = engine.recommendNextFocus(publicSafeEvents);
const publicOutput = JSON.stringify({
  focusTitle: publicSafe.focusTitle,
  whyThisFits: publicSafe.whyThisFits,
  tryThisNextGame: publicSafe.tryThisNextGame,
  evidence: publicSafe.evidence,
});
assert.doesNotMatch(publicOutput, /Private medical detail|private-team-tag/);

const balanced = recommend({
  goal: 1,
  assist: 1,
  groundBall: 2,
  causedTurnover: 1,
  hustlePlay: 1,
  smartPlay: 1,
});
assert.equal(balanced.focusKey, "balanced-contribution");

console.log("Possible Next Focus recommendation tests passed.");
console.log(JSON.stringify({
  scoringHeavy: { focus: scoringHeavy.focusTitle, why: scoringHeavy.whyThisFits },
  possessionLossHeavy: { focus: possessionLossHeavy.focusTitle, why: possessionLossHeavy.whyThisFits },
  goalHeavy: { focus: goalHeavy.focusTitle, why: goalHeavy.whyThisFits },
  assistHeavy: { focus: assistHeavy.focusTitle, why: assistHeavy.whyThisFits },
  lowEvidence: { focus: lowEvidence.focusTitle, why: lowEvidence.whyThisFits },
  balanced: { focus: balanced.focusTitle, why: balanced.whyThisFits },
}, null, 2));
