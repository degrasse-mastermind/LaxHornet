import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const map = await readFile(new URL("../docs/VNEXT_PRODUCTION_UX_INTEGRATION_MAP.md", import.meta.url), "utf8");

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function sourceBetween(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must follow ${startMarker}`);
  return app.slice(start, end);
}

test("primary information architecture is Home, Track, Games, Season, More", () => {
  const nav = sourceBetween("function renderBottomNav()", "function renderNavIcon(");
  assert.match(nav, /label:\s*"Home"/);
  assert.match(nav, /label:\s*state\.activeGame \? "Live" : "Track"/);
  assert.match(nav, /label:\s*"Games"/);
  assert.match(nav, /label:\s*"Season"/);
  assert.match(nav, /label:\s*"More"/);
});

test("new games use the existing tracked-time engine with configurable periods", () => {
  const setup = sourceBetween("function renderStartGame()", "function renderStatButton(");
  assert.match(setup, /name="trackPlayingTime" type="hidden" value="on"/);
  assert.match(setup, /value="quarters"/);
  assert.match(setup, /value="halves"/);
  assert.match(setup, /data-game-structure-summary/);
  assert.match(setup, /list="periodDurationOptions"/);
  assert.match(setup, /Choose a common value or enter a custom duration\./);
});

test("live tracker exposes authoritative clock and explicit participation state", () => {
  const tracker = sourceBetween("function renderLiveScoreboard(", "function renderEventRow(");
  assert.match(tracker, /projectedTrackedClock\(game\)/);
  assert.match(tracker, /&#9679; ON FIELD — EVENTS ENABLED/);
  assert.match(tracker, /&#9675; OFF FIELD — EVENT BUTTONS LOCKED/);
  assert.match(tracker, /summary\.onField \? "SUB OUT" : "PUT IN"/);
});

test("event creation rechecks the gate before operation or score mutation", () => {
  const logEvent = sourceBetween("function logEvent(", "function undoLastEvent(");
  const gate = logEvent.indexOf("liveEventCaptureGate(state.activeGame)");
  const operation = logEvent.indexOf("createGameEventOperation(");
  const score = logEvent.indexOf("applyScoreIncrementForStat(");
  assert.ok(gate >= 0 && operation > gate && score > gate);
});

test("Game Review separates factual snapshot, story, and canonical evidence", () => {
  const tabs = sourceBetween("function renderReviewTabs(", "function renderGameStorySection(");
  assert.match(tabs, /\["snapshot", "Snapshot"\]/);
  assert.match(tabs, /\["story", "Story"\]/);
  assert.match(tabs, /\["evidence", "Evidence"\]/);
  const story = sourceBetween("function renderEvidenceBasedStory(", "function renderReviewTabs(");
  assert.match(story, /Evidence:/);
  assert.match(story, /does not infer positioning, assignment, intent, matchup, effort, decision quality, or coaching responsibility/);
});

test("saved review survives a transient player-selection reset without bypassing access", () => {
  const reviewLookup = sourceBetween("function currentReviewGame()", "function saveActiveGame(");
  assert.match(reviewLookup, /state\.games\.find\(\(game\) => game\.id === state\.reviewGameId\)/);
  assert.match(reviewLookup, /canShowGameForCurrentAccess\(accountScopedGame\)/);
});

test("mobile presentation keeps tactile controls and safe-area spacing", () => {
  assert.match(styles, /min-height:\s*48px/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /@media \(max-width:\s*(?:430|700)px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("score-event atomicity gap is stopped with a minimal server contract", () => {
  assert.match(map, /Goal\/Assist score coupling is the one stopped subsection\./);
  assert.match(map, /additive authenticated RPC\/command/);
  assert.match(map, /No client\s+workaround or migration is included/);
});

test("authentication remains responsive before cloud hydration", () => {
  const auth = sourceBetween("async function handleAuthSubmit(formData)", "async function signOut()");
  const immediateRender = auth.indexOf("if (!startupDeepLinkApplied) render();");
  const hydration = auth.indexOf("await loadCloudGames({ silent: true });");
  assert.ok(immediateRender >= 0 && hydration > immediateRender);
});

let passed = 0;
for (const item of tests) {
  try {
    await item.fn();
    passed += 1;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.name}: ${error.message}`);
  }
}

console.log(`\n${passed}/${tests.length} vNext UX tests passed.`);
if (passed !== tests.length) process.exitCode = 1;
