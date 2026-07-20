import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const checks = [];

function expect(condition, message) {
  checks.push(message);
  if (!condition) failures.push(message);
}

const app = read("app.js");
const styles = read("styles.css");
const publicFiles = [
  "index.html",
  "privacy.html",
  "terms.html",
  "player-development.html",
  "program-value.html",
  "tracking-framework.html",
  "README.md",
  "launch-kit/invite-message.txt",
  "launch-kit/social-captions.txt",
  "launch-kit/parent-handout.html",
].map((file) => ({ file, text: read(file) }));
const publicText = publicFiles.map(({ text }) => text).join("\n");

const requiredLimitation = "Game Impact is a LaxHornet-created summary of selected recorded events. It is not a coach grade, player rating, ranking, or complete measure of performance or development.";
const insufficientEvidence = "There may not be enough recorded evidence for a reliable game takeaway yet.";

expect(!app.includes("function impactLetterGrade"), "letter-grade generator is removed");
expect(!app.includes("renderImpactGrade"), "letter-grade renderer is removed");
expect(!app.includes("calculateArchetypeResult"), "archetype generator is removed from active code");
expect(!app.includes("generateShareCard"), "archetype share-card generator is removed");
expect(!/archetype/i.test(app), "active app code contains no archetype reads, generation, or presentation");
expect(!/archetype/i.test(styles), "archetype presentation CSS is removed");
expect(!/archetype/i.test(publicText), "public, legal, README, and launch copy contain no archetype claims");
expect(!/impact-grade/i.test(`${app}\n${styles}`), "hidden DOM and CSS contain no retired impact-grade class");
expect(app.includes(requiredLimitation), "app contains the required proprietary Game Impact limitation");
expect(publicText.includes(requiredLimitation), "public/legal documentation contains the required Game Impact limitation");
expect(app.includes("Missing or incorrectly recorded events can change the result."), "app states the missing-event limitation");
expect(app.includes(insufficientEvidence), "low-data review uses the required insufficient-evidence state");
expect(app.includes('<p><span>Recorded</span>'), "Game Review visibly labels recorded evidence");
expect(app.includes('<p><span>What this may suggest</span>'), "Game Review visibly labels interpretation");
expect(app.includes('<p><span>Possible next focus</span>'), "Game Review visibly labels the optional focus");
expect(app.includes('lines.push("Recorded contributions", recorded)'), "recap begins with recorded contributions");
expect(app.includes('lines.push("", "What this may suggest", interpretation)'), "recap separates cautious interpretation");
expect(app.includes('lines.push("", "Conversation starter", conversationPrompt)'), "recap includes a conversation starter");
expect(app.includes('if (optionalFocus) lines.push("", "Possible next focus"'), "recap includes focus only when explicitly added");
expect(!/Game Impact\s*(?:grade|rating)?\s*[:\-]?\s*(?:A\+|A-|B\+|B-|C\+|C-|D\+|D-|F)(?:\s|<|\/|$)/i.test(`${app}\n${publicText}`), "no letter grade appears in app or public copy");
expect(app.includes("laxhornetImpactScore") && !app.includes('"gameImpactScore"'), "CSV reframes the numeric export field as proprietary");
expect(app.includes("proprietary: true") && app.includes("evidenceLimit: GAME_IMPACT_EVIDENCE_LIMIT"), "JSON export documents Impact provenance and evidence limits");
expect(app.includes("const publicRecapIntelligence = { ...reviewIntelligence, processLayer: {} }"), "share recap excludes private process context from prompt selection");
expect(app.includes("const noteText = privateView && event.note"), "Live Share suppresses private notes");
expect(app.includes("publicEventTags(tags)"), "Live Share filters private process tags");
expect(!app.includes("detectProcessDecisionPattern"), "user-recorded process tags do not generate automatic game patterns");
expect(!app.includes("userRecordedContextCount"), "user-recorded process tags do not generate season conclusions");
expect(!app.includes("openai") && !app.includes("anthropic"), "no external AI model integration was added");
expect(
  ['data-action="undo"', 'data-action="save-game"', 'data-action="end-game"', 'data-action="cancel-game"'].every((hook) => app.includes(hook)),
  "live tracking retains Undo, Save, End Game, and Cancel Game controls",
);
expect(
  app.includes('data-action="copy-family-recap"')
    && app.includes('data-action="share-family-recap"')
    && app.includes("copyGameFamilyRecap")
    && app.includes("shareGameFamilyRecap"),
  "recap copy and share actions remain wired",
);
expect(
  app.includes("function normalizeGame(game = {}, fallbackPlayer = null)")
    && app.includes("...game,")
    && app.includes("events: (game.events || [])"),
  "legacy saved games remain normalization-compatible without deleting unknown fields",
);
expect(
  app.includes("window.navigator.onLine === false")
    && app.includes("localStorage.setItem(scopedStorageKey(key), JSON.stringify(value))")
    && app.includes("function persistAll()"),
  "offline/local persistence paths remain present",
);
expect(
  !/leaderboard|percentile|compared (?:to|with) other players|top \d+%/i.test(`${app}\n${publicText}`),
  "no player comparison or ranking presentation was introduced",
);

if (failures.length) {
  console.error(`Product alignment checks failed (${failures.length}/${checks.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Product alignment checks passed (${checks.length}/${checks.length}).`);
checks.forEach((check) => console.log(`PASS: ${check}`));
