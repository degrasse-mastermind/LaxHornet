const { chromium } = require("playwright");
const fs = require("node:fs");

const baseUrl = process.env.LAXHORNET_TEST_URL || "http://127.0.0.1:5251";
const failures = [];
const results = [];

async function expectCheck(condition, message) {
  results.push({ message, passed: Boolean(condition) });
  if (!condition) failures.push(message);
}

(async () => {
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${baseUrl}/?fresh=product-alignment-browser`, { waitUntil: "networkidle" });
  const landingText = await page.locator("body").innerText();
  await expectCheck(!/player archetype|player profile/i.test(landingText), "public homepage contains no player archetype/profile claim");
  await expectCheck(!/Game Impact\s*[A-F][+-]?/i.test(landingText), "public homepage contains no Game Impact letter grade");

  await page.goto(`${baseUrl}/app.html?fresh=product-alignment-browser`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "View Demo Game" }).click();
  await page.waitForTimeout(100);
  const demoText = await page.locator("body").innerText();
  await expectCheck(demoText.includes("Sample Live Tracker"), "demo tracker renders");
  await expectCheck(demoText.includes("Sample Completed Game Review"), "demo review renders");
  await expectCheck(demoText.includes("LaxHornet-created summary of selected recorded events"), "rendered numeric Impact includes its proprietary limitation");
  await expectCheck(/recorded/i.test(demoText) && /what this may suggest/i.test(demoText) && /possible next focus/i.test(demoText), "rendered review separates evidence, interpretation, and focus");
  await expectCheck(!/Game Impact\s*[A-F][+-]?|Player Archetype|Season Player Profile|Spark Plug|Finisher|Setup Artist|Possession Engine|Defensive Disruptor|Two-Way Force|Glue Player|The Wall|Outlet Starter/i.test(demoText), "rendered demo contains no grade or archetype output");
  await expectCheck((await page.locator(".impact-grade").count()) === 0, "rendered DOM contains no retired impact-grade element");
  await expectCheck((await page.locator(".archetype-card").count()) === 0, "rendered DOM contains no archetype card");
  await expectCheck((await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)), "390px demo has no horizontal page overflow");

  const runtimeChecks = await page.evaluate(() => {
    const player = {
      id: "browser-demo-player",
      rosterPlayerId: "browser-demo-roster",
      teamId: "browser-demo-team",
      name: "Demo Player",
      jersey: "12",
      team: "Branford Demo Hornets",
      position: "Midfield",
    };
    const makeEvent = (id, statType, statLabel, tags = [], note = "") => ({
      id,
      statType,
      statLabel,
      category: statType === "goal" ? "Offense" : "Possession",
      quarter: "Q2",
      timestamp: `2026-07-20T12:0${id.slice(-1)}:00.000Z`,
      tags,
      note,
    });
    const events = [
      makeEvent("event-1", "groundBall", "Ground Ball", ["Good Decision, Unsuccessful Execution"], "Private parent note"),
      makeEvent("event-2", "successfulClear", "Successful Clear"),
      makeEvent("event-3", "assist", "Assist"),
      makeEvent("event-4", "goal", "Goal"),
    ];
    const game = {
      id: "browser-demo-game",
      opponent: "Madison Demo",
      date: "2026-07-20",
      events,
      playerSnapshot: player,
    };
    const totals = calculateTotals(events, player);
    const intelligence = buildPostGameIntelligence(game, events, player, totals, null);
    const recap = buildFamilyRecap(game, events, player, totals, intelligence);
    const lowEvents = events.slice(0, 2);
    const lowTotals = calculateTotals(lowEvents, player);
    const lowIntelligence = buildPostGameIntelligence(
      { ...game, id: "browser-low-data", events: lowEvents },
      lowEvents,
      player,
      lowTotals,
      null,
    );
    const publicEventHtml = renderEventRow(events[0], { publicOnlyTags: true });
    return {
      recap,
      lowDevelopmentTakeaway: lowIntelligence.developmentTakeaway,
      lowWarnings: lowIntelligence.warnings,
      publicEventHtml,
    };
  });

  await expectCheck(
    runtimeChecks.recap.text.includes("Recorded contributions")
      && runtimeChecks.recap.text.includes("What this may suggest")
      && runtimeChecks.recap.text.includes("Conversation starter"),
    "runtime Family Recap separates evidence, interpretation, and conversation prompt",
  );
  await expectCheck(
    !/Game Impact\s*[A-F][+-]?|archetype|Private parent note|Good Decision, Unsuccessful Execution/i.test(runtimeChecks.recap.text),
    "runtime Family Recap excludes grades, archetypes, private notes, and private process tags",
  );
  await expectCheck(
    runtimeChecks.lowDevelopmentTakeaway === null
      && runtimeChecks.lowWarnings.includes("There may not be enough recorded evidence for a reliable game takeaway yet."),
    "runtime low-data review suppresses developmental takeaway and shows the required limitation",
  );
  await expectCheck(
    !runtimeChecks.publicEventHtml.includes("Private parent note")
      && !runtimeChecks.publicEventHtml.includes("Good Decision, Unsuccessful Execution"),
    "runtime public event rendering excludes private notes and process tags",
  );

  console.log("SAMPLE FAMILY RECAP");
  console.log(runtimeChecks.recap.text);

  await browser.close();

  results.forEach(({ message, passed }) => console.log(`${passed ? "PASS" : "FAIL"}: ${message}`));
  if (failures.length) {
    console.error(`Browser product alignment checks failed (${failures.length}/${results.length}).`);
    process.exit(1);
  }
  console.log(`Browser product alignment checks passed (${results.length}/${results.length}).`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
