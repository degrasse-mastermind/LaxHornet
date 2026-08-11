const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const operationPath = path.join(root, "event-operation-service.js");
let diagnosticStage = "startup";
const diagnosticTimeout = setTimeout(() => {
  console.error(`Timed out during ${diagnosticStage}`);
  process.exit(1);
}, 15000);
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks += 1;
  console.log(`PASS: ${label}`);
};

const games = new Map();
const createServerGame = (id, lifecycle = "active") => {
  const game = {
    id, version: 1, statusVersion: 1, lifecycle, running: false,
    period: "Q1", remaining: 600, commands: [], receipts: new Map(),
    batches: new Map(), timeoutOnce: false,
  };
  games.set(id, game);
  return game;
};

function applyCommand(target, request) {
  if (request.expectedLifecycle !== target.lifecycle) return { outcome: "rejected", code: "stale_lifecycle_state" };
  if (target.lifecycle === "completed") return { outcome: "rejected", code: "completed_game_clock_change_forbidden" };
  if (request.command === "start" || request.command === "resume") {
    if (target.running || (request.command === "resume" && target.lifecycle !== "paused")) return { outcome: "rejected", code: "invalid_clock_transition" };
    target.running = true;
    target.lifecycle = "active";
  } else if (request.command === "pause") {
    if (!target.running || target.lifecycle !== "active") return { outcome: "rejected", code: "invalid_clock_transition" };
    target.running = false;
    target.lifecycle = "paused";
    target.statusVersion += 1;
  } else if (request.command === "advance_period") {
    target.running = false;
    target.lifecycle = "paused";
    target.period = request.arguments.next_period;
    target.remaining = 600;
    target.statusVersion += request.expectedLifecycle === "paused" ? 0 : 1;
  } else if (request.command === "complete") {
    target.running = false;
    target.lifecycle = "completed";
    target.statusVersion += 1;
  } else {
    return { outcome: "rejected", code: "invalid_clock_command" };
  }
  target.version += 1;
  target.commands.push(request.command);
  return { outcome: "accepted" };
}

function canonical(target) {
  return { clockVersion: target.version, statusVersion: target.statusVersion, lifecycleState: target.lifecycle, period: target.period, running: target.running, remaining: target.remaining };
}

async function clockRpc(envelope) {
  const target = games.get(envelope.gameId);
  if (!target) return { outcome: "rejected", code: "authorization_denied" };
  if (envelope.kind === "single") {
    if (envelope.baseClockVersion !== target.version) {
      return { outcome: "conflicted", code: "clock_conflict", receipt: { code: "clock_conflict", serverRevision: target.version } };
    }
    if (target.version >= Number.MAX_SAFE_INTEGER) {
      return { outcome: "rejected", code: "clock_revision_exhausted", message: "raw bigint overflow detail" };
    }
    const result = applyCommand(target, envelope.command);
    if (result.outcome !== "accepted") return result;
    return { outcome: "accepted", canonical: canonical(target), receipt: { code: "accepted", serverRevision: target.version } };
  }
  const batchKey = String(envelope.batchId || "");
  const storedBatch = target.batches.get(batchKey);
  let prefixCount = 0;
  if (storedBatch) {
    while (prefixCount < storedBatch.commands.length && prefixCount < envelope.commands.length) {
      if (JSON.stringify(storedBatch.commands[prefixCount]) !== JSON.stringify(envelope.commands[prefixCount])) break;
      prefixCount += 1;
    }
    if (prefixCount !== storedBatch.commands.length || envelope.commands.length <= prefixCount) {
      return { outcome: "rejected", code: "duplicate_operation_id_payload_mismatch" };
    }
    if (target.version !== envelope.baseClockVersion + prefixCount) {
      return { outcome: "conflicted", code: "clock_conflict" };
    }
  } else if (envelope.baseClockVersion !== target.version) {
    return { outcome: "conflicted", code: "clock_conflict", receipt: { code: "clock_conflict", serverRevision: target.version } };
  }
  const occurrenceTimes = envelope.commands.map((command) => Date.parse(command.clientOccurredAt));
  if (occurrenceTimes.some((value) => !Number.isFinite(value))
    || occurrenceTimes.some((value, index) => index > 0 && value < occurrenceTimes[index - 1])
    || occurrenceTimes.at(-1) - occurrenceTimes[0] > 30000) {
    return { outcome: "conflicted", code: "clock_chronology_needs_review" };
  }
  const suffixCount = envelope.commands.length - prefixCount;
  if (target.version > Number.MAX_SAFE_INTEGER - suffixCount) {
    return { outcome: "rejected", code: "clock_revision_exhausted", message: "raw bigint overflow detail" };
  }
  const candidate = {
    ...target,
    commands: [...target.commands],
    receipts: new Map(target.receipts),
    batches: new Map(target.batches),
  };
  const operationResults = [];
  for (let index = 0; index < prefixCount; index += 1) {
    const command = envelope.commands[index];
    operationResults.push({ operationId: command.operationId, receipt: candidate.receipts.get(command.operationId) });
  }
  for (let index = prefixCount; index < envelope.commands.length; index += 1) {
    const command = envelope.commands[index];
    if (candidate.running && index > 0) {
      candidate.remaining = Math.max(0, candidate.remaining - Math.floor((occurrenceTimes[index] - occurrenceTimes[index - 1]) / 1000));
    }
    const result = applyCommand(candidate, command);
    if (result.outcome !== "accepted") return { ...result, batchAtomic: true };
    const receipt = { code: "accepted", serverRevision: candidate.version };
    candidate.receipts.set(command.operationId, receipt);
    operationResults.push({ operationId: command.operationId, receipt });
  }
  candidate.batches.set(batchKey, { commands: envelope.commands.map((command) => ({ ...command })) });
  Object.assign(target, candidate);
  if (target.timeoutOnce) {
    target.timeoutOnce = false;
    throw new Error("synthetic timeout after committed prefix");
  }
  return { outcome: "accepted", canonical: canonical(target), operationResults };
}

(async () => {
  diagnosticStage = "web server startup";
  const webServer = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>*{box-sizing:border-box}body{margin:0;padding:16px;font:16px system-ui}main{display:grid;gap:12px;max-width:680px}button{min-height:48px}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.notice{padding:12px;border:1px solid #b86b20;border-radius:10px}@media(max-width:430px){.actions{grid-template-columns:1fr}}</style>
      <main><h1>Private game clock</h1><p data-clock></p><div class="actions"><button data-start>Start</button><button data-pause>Pause</button><button data-resume>Resume</button><button data-advance>End period</button><button data-complete>Complete</button></div><p class="notice" data-notice role="status" aria-live="polite" hidden></p></main>`);
  });
  await new Promise((resolve) => webServer.listen(0, "127.0.0.1", resolve));
  const executablePath = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"]
    .find((candidate) => candidate && fs.existsSync(candidate));
  diagnosticStage = "browser launch";
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [];

  async function session(gameId, viewport) {
    diagnosticStage = `session ${gameId} ${viewport.width}`;
    const initial = canonical(games.get(gameId));
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction("clockRpc", clockRpc);
    await page.goto(`http://127.0.0.1:${webServer.address().port}`);
    await page.addScriptTag({ path: operationPath });
    await page.evaluate(({ gameId: id, initialState }) => {
      const api = window.LaxHornetDurableSyncOperations;
      let state = api.normalizeState(null, { accountId: "adult-account", deviceId: crypto.randomUUID() });
      let offline = false;
      let now = Date.parse("2026-08-11T02:00:00.000Z");
      let local = { ...initialState };
      const render = () => {
        document.querySelector("[data-clock]").textContent = `${local.period} ${local.remaining} seconds ${local.lifecycle}`;
      };
      const service = api.createDurableSyncOperationService({
        getState: () => state, setState: (next) => { state = next; }, persistState: () => true,
        currentAccountId: () => "adult-account", isOffline: () => offline,
        now: () => new Date(now).toISOString(),
        executeOperation: (operation) => window.clockRpc({ kind: "single", gameId: id, baseClockVersion: operation.payload.baseClockVersion, command: { operationId: operation.operationId, ...operation.payload } }),
        executeClockBatch: (operations) => window.clockRpc({ kind: "batch", batchId: operations[0].batchId, gameId: id, baseClockVersion: local.clockVersion, commands: operations.map((operation) => ({ operationId: operation.operationId, ...operation.payload })) }),
        onClockAccepted: (_operations, result) => { if (result.canonical) local = { ...result.canonical }; render(); },
        onClockConflict: () => { const notice = document.querySelector("[data-notice]"); notice.hidden = false; notice.textContent = "The game clock changed on another device. Your clock actions are saved and need review."; },
      });
      const queue = async (command, batchRequired = offline, occurredAt = new Date(now).toISOString()) => {
        const expectedLifecycle = local.lifecycleState;
        const payload = { contract: "r207_clock_v2", command, arguments: command === "advance_period" ? { next_period: "Q2" } : {}, baseClockVersion: local.clockVersion, statusBaseVersion: local.statusVersion, expectedLifecycle, clientOccurredAt: occurredAt };
        service.queueClock({ accountId: "adult-account", gameId: id, payload, baseRevision: local.clockVersion, batchRequired });
        if (command === "start" || command === "resume") local.lifecycleState = "active";
        if (command === "pause" || command === "advance_period") local.lifecycleState = "paused";
        if (command === "complete") local.lifecycleState = "completed";
        if (command === "advance_period") local.period = "Q2";
        render();
        return service.process();
      };
      for (const command of ["start", "pause", "resume", "advance", "complete"]) {
        document.querySelector(`[data-${command}]`).addEventListener("click", () => { window.__lastClockWork = queue(command === "advance" ? "advance_period" : command); });
      }
      window.__clock = { state: () => state, local: () => local, service, queue, setOffline: (value) => { offline = value; }, advance: (milliseconds) => { now += milliseconds; } };
      render();
    }, { gameId, initialState: initial });
    return { context, page };
  }

  createServerGame("concurrent");
  const a = await session("concurrent", { width: 1280, height: 800 });
  const b = await session("concurrent", { width: 390, height: 844 });
  await a.page.click("[data-start]"); await a.page.evaluate(() => window.__lastClockWork);
  check(games.get("concurrent").version === 2 && games.get("concurrent").running, "session A concurrent start becomes authoritative");
  await b.page.click("[data-start]"); await b.page.evaluate(() => window.__lastClockWork);
  check(await b.page.locator("[data-notice]").isVisible(), "stale session B receives a visible safe clock conflict");
  check(!/clock_conflict|client[_ -]?operation|device[_ -]?id|rpc/i.test(await b.page.locator("body").innerText()), "conflict UI excludes codes and private operation identity");
  check(games.get("concurrent").version === 2 && games.get("concurrent").commands.length === 1, "stale start cannot rewrite the authoritative clock");
  const callsBeforeRetry = games.get("concurrent").commands.length;
  await b.page.evaluate(() => window.__clock.service.process());
  check(games.get("concurrent").commands.length === callsBeforeRetry, "browser conflict is durable and not auto-retried");

  createServerGame("batch-success", "paused");
  const success = await session("batch-success", { width: 390, height: 844 });
  await success.page.evaluate(async () => {
    window.__clock.setOffline(true);
    await window.__clock.queue("resume", true);
    await window.__clock.queue("pause", true);
    await window.__clock.queue("advance_period", true);
    window.__clock.setOffline(false);
    await window.__clock.service.process();
  });
  check(games.get("batch-success").commands.join(",") === "resume,pause,advance_period", "unchanged-base offline batch applies in semantic order");
  check(games.get("batch-success").version === 4 && games.get("batch-success").period === "Q2", "offline batch assigns one server revision per command and returns the canonical period");

  createServerGame("offline-chronology");
  const chronology = await session("offline-chronology", { width: 390, height: 844 });
  await chronology.page.evaluate(async () => {
    window.__clock.setOffline(true);
    await window.__clock.queue("start", true, "2026-08-11T02:10:00.000Z");
    await window.__clock.queue("pause", true, "2026-08-11T02:10:05.000Z");
    await window.__clock.queue("resume", true, "2026-08-11T02:10:06.000Z");
    await window.__clock.queue("pause", true, "2026-08-11T02:10:10.000Z");
    window.__clock.setOffline(false);
    await window.__clock.service.process();
  });
  check(games.get("offline-chronology").remaining === 591
    && games.get("offline-chronology").commands.join(",") === "start,pause,resume,pause",
  "browser reconnect preserves both bounded offline elapsed intervals");

  const timeoutGame = createServerGame("prefix-timeout");
  timeoutGame.timeoutOnce = true;
  const prefix = await session("prefix-timeout", { width: 390, height: 844 });
  await prefix.page.evaluate(async () => {
    window.__clock.setOffline(true);
    await window.__clock.queue("start", true, "2026-08-11T02:20:00.000Z");
    await window.__clock.queue("pause", true, "2026-08-11T02:20:05.000Z");
    window.__clock.setOffline(false);
    await window.__clock.service.process();
    window.__clock.setOffline(true);
    await window.__clock.queue("resume", true, "2026-08-11T02:20:06.000Z");
    await window.__clock.queue("pause", true, "2026-08-11T02:20:10.000Z");
    window.__clock.advance(2500);
    window.__clock.setOffline(false);
    await window.__clock.service.process();
  });
  check(games.get("prefix-timeout").remaining === 591
    && games.get("prefix-timeout").commands.join(",") === "start,pause,resume,pause",
  "timeout prefix plus new suffix succeeds without duplicating the committed prefix");
  check((await prefix.page.evaluate(() => window.__clock.state().operations.length)) === 0,
    "prefix replay receipts compact the complete durable browser timeline");

  const ceilingGame = createServerGame("revision-ceiling");
  ceilingGame.version = Number.MAX_SAFE_INTEGER - 1;
  const ceiling = await session("revision-ceiling", { width: 390, height: 844 });
  await ceiling.page.click("[data-start]"); await ceiling.page.evaluate(() => window.__lastClockWork);
  await ceiling.page.click("[data-pause]"); await ceiling.page.evaluate(() => window.__lastClockWork);
  const ceilingState = await ceiling.page.evaluate(() => window.__clock.state().operations.map((operation) => ({ state: operation.state, error: operation.lastError })));
  check(games.get("revision-ceiling").version === Number.MAX_SAFE_INTEGER
    && games.get("revision-ceiling").commands.join(",") === "start"
    && ceilingState.length === 1
    && ceilingState[0].state === "rejected"
    && ceilingState[0].error.category === "validation_rejected",
  "browser client retains bounded non-retryable exhaustion without a server overflow commit");
  check(!/9007199254740992|raw bigint|clock_revision_exhausted/i.test(await ceiling.page.locator("body").innerText()),
    "ordinary clock UI exposes no raw revision or exhaustion debug detail");

  createServerGame("batch-conflict");
  const offline = await session("batch-conflict", { width: 390, height: 844 });
  const other = await session("batch-conflict", { width: 1280, height: 800 });
  await offline.page.evaluate(async () => {
    window.__clock.setOffline(true);
    await window.__clock.queue("start", true);
    await window.__clock.queue("pause", true);
    await window.__clock.queue("resume", true);
    await window.__clock.queue("advance_period", true);
  });
  await other.page.click("[data-start]"); await other.page.evaluate(() => window.__lastClockWork);
  await offline.page.evaluate(async () => { window.__clock.setOffline(false); await window.__clock.service.process(); });
  const conflictState = await offline.page.evaluate(() => window.__clock.state().operations.map((operation) => ({ command: operation.payload.command, state: operation.state })));
  check(conflictState.length === 4 && conflictState.every((operation) => operation.state === "conflicted"), "changed-base reconnect retains the complete local batch as conflicted");
  check(games.get("batch-conflict").version === 2 && games.get("batch-conflict").commands.join(",") === "start", "changed-base batch applies no partial prefix");

  createServerGame("completion", "paused");
  const finisher = await session("completion", { width: 1280, height: 800 });
  const stale = await session("completion", { width: 390, height: 844 });
  await finisher.page.click("[data-complete]"); await finisher.page.evaluate(() => window.__lastClockWork);
  check(games.get("completion").lifecycle === "completed" && !games.get("completion").running, "completion atomically stops and completes the browser clock");
  await stale.page.click("[data-resume]"); await stale.page.evaluate(() => window.__lastClockWork);
  check(games.get("completion").lifecycle === "completed" && games.get("completion").commands.join(",") === "complete", "stale second session cannot reopen or change a completed game");

  const geometry = await b.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, targets: [...document.querySelectorAll("button")].map((button) => button.getBoundingClientRect().height) }));
  check(!geometry.overflow && geometry.targets.every((height) => height >= 44), "390x844 clock UI has no horizontal overflow and usable targets");
  check(errors.length === 0, `two-context sessions have no page errors: ${errors.join(" | ")}`);

  console.log(`R2-07 clock command/batch two-context browser: ${checks}/${checks} passed`);
  for (const item of [a, b, success, chronology, prefix, ceiling, offline, other, finisher, stale]) await item.context.close();
  await browser.close();
  await new Promise((resolve) => webServer.close(resolve));
  clearTimeout(diagnosticTimeout);
})().catch((error) => { clearTimeout(diagnosticTimeout); console.error(error); process.exitCode = 1; });
