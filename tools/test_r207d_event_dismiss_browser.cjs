const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "event-operation-service.js");
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks += 1;
  console.log(`PASS: ${label}`);
};

(async () => {
  const webServer = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 16px; font: 16px system-ui; }
        main { max-width: 720px; display: grid; gap: 16px; }
        .values, .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        button { min-height: 48px; }
        @media (max-width: 430px) { .values, .actions { grid-template-columns: 1fr; } }
      </style>
      <main>
        <section aria-labelledby="attention-title">
          <h1 id="attention-title" tabindex="-1">Needs Attention</h1>
          <p>This event changed on another device. Review it before saving again.</p>
          <div class="values" role="group" aria-label="Current and saved values">
            <p>Current: <span data-current></span></p>
            <p>Your saved version: <span data-local></span></p>
          </div>
          <div class="actions">
            <button type="button" data-keep>Keep current</button>
            <button type="button" data-dismiss>Dismiss notice</button>
          </div>
          <p data-outcome role="status" aria-live="polite"></p>
        </section>
      </main>`);
  });
  await new Promise((resolve) => webServer.listen(0, "127.0.0.1", resolve));
  const executablePath = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((candidate) => candidate && fs.existsSync(candidate));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [];

  async function session(viewport) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${webServer.address().port}`);
    await page.addScriptTag({ path: sourcePath });
    await page.evaluate(async () => {
      const api = window.LaxHornetR207EventOperations;
      let state = api.emptyState();
      let rpcCalls = 0;
      const game = { id: "dismiss-browser-game", lifecycleState: "active" };
      const event = {
        id: "dismiss-browser-event", timestamp: "2026-08-09T12:00:00Z", quarter: "Q1",
        statType: "goal", statLabel: "Goal", category: "Offense", pointValue: 1,
        tags: [], note: "local original", fieldZone: "", serverEventVersion: 1,
      };
      const service = api.createEventOperationService({
        getState: () => state,
        setState: (next) => { state = next; },
        persistState: () => true,
        currentAccountId: () => "synthetic-adult-account",
        isOffline: () => false,
        execute: async () => {
          rpcCalls += 1;
          return { outcome: "conflicted", code: "same_field_conflict", server_event_version: 2 };
        },
      });
      service.hydrate(game, event);
      service.queueEvent(game, { ...event, note: "saved local proposal" });
      await service.process();
      service.markConflictRefreshed(game, { ...event, note: "authoritative server value", serverEventVersion: 2 }, { preserve: true });
      const render = (outcome = "") => {
        const record = state.records[event.id];
        document.querySelector("[data-current]").textContent = record.acceptedSnapshot.note;
        document.querySelector("[data-local]").textContent = record.desiredSnapshot.note;
        document.querySelector("[data-outcome]").textContent = outcome;
      };
      document.querySelector("[data-dismiss]").addEventListener("click", () => {
        service.resolveConflict(game, event.id, "dismiss");
        render("Event review item dismissed");
        document.querySelector("#attention-title").focus();
      });
      document.querySelector("[data-keep]").addEventListener("click", () => {
        service.resolveConflict(game, event.id, "keep_server");
        render("Current event kept");
        document.querySelector("#attention-title").focus();
      });
      render();
      window.__dismissBrowser = { state: () => state, service, game, event, rpcCalls: () => rpcCalls };
    });
    return { context, page };
  }

  const mobile = await session({ width: 390, height: 844 });
  const before = await mobile.page.evaluate(() => {
    const state = window.__dismissBrowser.state();
    const eventId = window.__dismissBrowser.event.id;
    return {
      record: structuredClone(state.records[eventId]),
      operations: state.operations.length,
      calls: window.__dismissBrowser.rpcCalls(),
    };
  });
  check(await mobile.page.getByRole("heading", { name: "Needs Attention" }).isVisible(), "mobile Needs Attention heading is visible");
  check((await mobile.page.locator("body").innerText()).includes("saved local proposal")
    && !(await mobile.page.locator("body").innerText()).includes("same_field_conflict"),
  "browser renders safe current/saved values without raw conflict codes");
  const mobileGeometry = await mobile.page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    buttonHeights: [...document.querySelectorAll("button")].map((button) => button.getBoundingClientRect().height),
  }));
  check(!mobileGeometry.overflow && mobileGeometry.buttonHeights.every((height) => height >= 44), "390x844 layout has no horizontal overflow and usable targets");
  await mobile.page.locator("[data-dismiss]").focus();
  await mobile.page.locator("[data-dismiss]").press("Enter");
  const afterDismiss = await mobile.page.evaluate(() => {
    const state = window.__dismissBrowser.state();
    const eventId = window.__dismissBrowser.event.id;
    return {
      record: structuredClone(state.records[eventId]),
      conflict: state.conflicts[eventId] || null,
      operations: state.operations.length,
      calls: window.__dismissBrowser.rpcCalls(),
      focus: document.activeElement?.id || "",
      outcome: document.querySelector("[data-outcome]").textContent,
    };
  });
  check(afterDismiss.conflict === null && /dismissed/i.test(afterDismiss.outcome), "keyboard dismiss terminally clears the conflict and announces the outcome");
  check(JSON.stringify(afterDismiss.record) === JSON.stringify(before.record), "browser dismiss leaves the complete local event record unchanged");
  check(afterDismiss.operations === before.operations && afterDismiss.calls === before.calls, "browser dismiss queues no event mutation and performs no RPC");
  check(afterDismiss.focus === "attention-title", "browser dismiss restores focus to the review heading");

  const desktop = await session({ width: 1280, height: 800 });
  await desktop.page.locator("[data-keep]").click();
  const keptNote = await desktop.page.evaluate(() => {
    const state = window.__dismissBrowser.state();
    return state.records[window.__dismissBrowser.event.id].desiredSnapshot.note;
  });
  check(keptNote === "authoritative server value", "browser keep_server still reconciles to the authoritative event value");
  check(keptNote !== afterDismiss.record.desiredSnapshot.note, "browser keep_server and dismiss remain semantically distinct");
  check(errors.length === 0, `browser sessions have no page errors: ${errors.join(" | ")}`);

  console.log(`R2-07D event dismiss browser: ${checks}/${checks} passed`);
  await mobile.context.close();
  await desktop.context.close();
  await browser.close();
  await new Promise((resolve) => webServer.close(resolve));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
