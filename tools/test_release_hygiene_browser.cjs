const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.env.LAXHORNET_TEST_URL || "http://127.0.0.1:5251";
const root = path.resolve(__dirname, "..");
const evidenceDir = path.join(root, "review-evidence", "release-hygiene-v281", "browser");
const failures = [];
const results = [];
const hostedSupabaseRequests = [];

fs.mkdirSync(evidenceDir, { recursive: true });

function expectCheck(condition, message) {
  results.push({ message, passed: Boolean(condition) });
  if (!condition) failures.push(message);
}

async function capture(page, fileName) {
  await page.screenshot({ path: path.join(evidenceDir, fileName), fullPage: true });
}

(async () => {
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.LAXHORNET_RUNTIME_CONFIG = {
      supabaseUrl: "http://127.0.0.1:9",
      supabasePublishableKey: "synthetic-local-browser-test",
    };
  });
  const page = await context.newPage();
  await page.route("http://127.0.0.1:9/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  page.on("request", (request) => {
    if (/https:\/\/[a-z]{20}\.supabase\.co/i.test(request.url())) hostedSupabaseRequests.push(request.url());
  });

  await page.goto(`${baseUrl}/app.html?share=SYNTHETIC&fresh=v281-browser`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const sharedText = await page.locator("body").innerText();
  expectCheck(sharedText.includes("Shared Game"), "anonymous shared-game screen renders");
  const secureActivatedView = /shared live game/i.test(sharedText) && /read-only/i.test(sharedText);
  const sharedCodeField = page.locator("#sharedScreenCode");
  const secureEntryView =
    (await sharedCodeField.count()) === 1 &&
    (await sharedCodeField.inputValue()) === "SYNTHETIC" &&
    sharedText.includes("Watch Live") &&
    !sharedText.includes("Track New Game");
  expectCheck(
    secureEntryView || secureActivatedView,
    "anonymous shared-game flow remains read-only and code-scoped before or after secure activation",
  );
  expectCheck(documentWidthFits(await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))), "anonymous shared-game screen has no 390px horizontal overflow");
  await capture(page, "01-anonymous-shared-game.png");

  await page.goto(`${baseUrl}/app.html?fresh=v281-browser-csv`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => openExportDialog("csv"));
  await page.getByRole("heading", { name: "Export selected event data" }).waitFor();
  const csvText = await page.locator('[role="dialog"]').innerText();
  expectCheck(/export scope/i.test(csvText), "CSV export dialog requires a selected scope");
  expectCheck(csvText.includes("Include private process/decision tags"), "CSV export keeps private process tags optional");
  expectCheck(csvText.includes("Include private event notes"), "CSV export keeps private notes optional");
  await capture(page, "02-scoped-csv-export.png");

  await page.goto(`${baseUrl}/app.html?fresh=v281-browser-backup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => openExportDialog("full_backup"));
  await page.getByRole("heading", { name: "Create private full backup" }).waitFor();
  const backupText = await page.locator('[role="dialog"]').innerText();
  expectCheck(backupText.includes("sensitive recovery file"), "private backup confirmation identifies sensitive recovery data");
  expectCheck(backupText.includes("not a family/public share file"), "private backup is distinguished from public sharing");
  expectCheck((await page.locator("#confirmSensitiveBackup").count()) === 1, "private backup requires explicit confirmation");
  await capture(page, "03-sensitive-backup-confirmation.png");

  await page.goto(`${baseUrl}/app.html?fresh=v281-browser-import`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const payload = {
      version: 1,
      games: [{
        id: "synthetic-import-game",
        date: "2026-07-23",
        opponent: "Synthetic Opponent",
        playerSnapshot: {
          id: "local-player",
          name: "Demo Player",
          number: "12",
          team: "Synthetic Team",
          position: "Midfield",
        },
        events: [],
      }],
      teams: [{ id: "ignored-team" }],
      playerClaims: [{ id: "ignored-claim" }],
    };
    prepareImportJSONFile(new File([JSON.stringify(payload)], "synthetic-backup.json", { type: "application/json" }));
  });
  await page.getByRole("heading", { name: "Merge private backup?" }).waitFor();
  const importText = await page.locator('[role="dialog"]').innerText();
  expectCheck(importText.includes("Team access, roster authority, account ownership, and Live Share will not be restored or changed."), "import review states authority boundaries");
  expectCheck(importText.includes("Existing games are never silently replaced."), "import review states merge behavior");
  await capture(page, "04-import-review.png");

  await page.goto(`${baseUrl}/app.html?fresh=v281-browser-help`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.querySelector("#app").innerHTML = renderHelp();
  });
  const helpText = await page.locator("body").innerText();
  expectCheck(helpText.includes("passed isolated staging and managed preview verification"), "Help identifies staged and preview proof");
  expectCheck(helpText.includes("not active in production yet"), "Help says hardened production activation is pending");
  expectCheck(helpText.includes("avoid sensitive or private information in notes or tags"), "Help warns against sensitive notes and tags");
  await capture(page, "05-help-disclosure-copy.png");

  await page.goto(`${baseUrl}/app.html?fresh=v281-browser-update`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => showUpdateAvailable(null, "v999"));
  await page.getByText("Update available", { exact: true }).waitFor();
  const updateText = await page.locator("body").innerText();
  expectCheck(updateText.includes("Update Now"), "update-available banner exposes the update action");
  await capture(page, "06-update-available.png");

  expectCheck(hostedSupabaseRequests.length === 0, "browser verification made no hosted Supabase request");
  await browser.close();

  results.forEach(({ message, passed }) => console.log(`${passed ? "PASS" : "FAIL"}: ${message}`));
  console.log(`Browser evidence: ${evidenceDir}`);
  if (hostedSupabaseRequests.length) {
    hostedSupabaseRequests.forEach((url) => console.error(`Unexpected hosted Supabase request: ${url}`));
  }
  if (failures.length) {
    console.error(`Release-hygiene browser checks failed (${failures.length}/${results.length}).`);
    process.exit(1);
  }
  console.log(`Release-hygiene browser checks passed (${results.length}/${results.length}).`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function documentWidthFits({ scrollWidth, clientWidth }) {
  return scrollWidth <= clientWidth;
}
