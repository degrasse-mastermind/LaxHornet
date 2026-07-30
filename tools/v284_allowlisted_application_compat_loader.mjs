import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const approvedToolingSha = "0ce0f6734318b07bbf7156e91c79d05d40bd7222";
const historicalApplicationSha = "effca6952e647b7424f96675f390fc80d5c42368";
const targetApplicationSha = process.env.LAXHORNET_V284_APPLICATION_SHA || "";
const fixtureModuleName = "v284_local_disclosure_fixture.mjs";
const smokeModuleName = "v284_production_disclosure_smoke.mjs";

assert.match(
  targetApplicationSha,
  /^[0-9a-f]{40}$/,
  "LAXHORNET_V284_APPLICATION_SHA must be a full lowercase Git SHA",
);

export async function load(url, context, nextLoad) {
  const loaded = await nextLoad(url, context);
  const moduleUrl = new URL(url);
  if (moduleUrl.protocol !== "file:") return loaded;

  const moduleName = path.basename(fileURLToPath(moduleUrl));
  const source = String(loaded.source);
  if (moduleName === smokeModuleName) {
    const staleOrdinaryReconciliation = `    const synchronized = await page.evaluate(async () => ({
      ok: await reconcileGameEventOperations(state.activeGame),
      pending: Object.values(state.trustSpineSync.events).reduce(
        (sum, record) => sum + (record.pendingOperations?.length || 0),
        0,
      ),
    }));`;
    const compatibleOrdinaryReconciliation = `    const synchronized = await page.evaluate(async () => {
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const ok = await reconcileGameEventOperations(state.activeGame);
        const pending = Object.values(state.trustSpineSync.events).reduce(
          (sum, record) => sum + (record.pendingOperations?.length || 0),
          0,
        );
        if (ok && pending === 0) return { ok: true, pending: 0 };
        await new Promise((resolve) => window.setTimeout(resolve, attempt * 250));
      }
      return {
        ok: false,
        pending: Object.values(state.trustSpineSync.events).reduce(
          (sum, record) => sum + (record.pendingOperations?.length || 0),
          0,
        ),
        syncStatus: state.syncStatus,
        cloudError: state.cloudError || "",
        errors: Object.values(state.trustSpineSync.events)
          .filter((record) => record.lastError || record.pendingOperations?.length)
          .map((record) => ({
            lastError: record.lastError || "",
            pending: (record.pendingOperations || []).map((operation) => ({
              kind: operation.kind,
              lastError: operation.lastError || "",
            })),
          })),
      };
    });`;
    const staleOfflineClick = `    await trackerContext.setOffline(true);
    await page.locator('[data-stat="goal"]').click();
    const offline = await page.evaluate((knownIds) => {`;
    const compatibleOfflineEntry = `    await trackerContext.setOffline(true);
    const offlineAttempt = await page.evaluate(() => {
      const before = liveEventCaptureGate(state.activeGame);
      if (hasTrackedPlayingTime(state.activeGame)) {
        const clock = projectedTrackedClock(state.activeGame);
        if (!clock?.isRunning) changeTrackedClock(clock?.startedAt ? "resume" : "start");
        if (!trackedTimeSummary(state.activeGame)?.onField) togglePlayerParticipation();
      }
      const after = liveEventCaptureGate(state.activeGame);
      return { accepted: Boolean(logEvent("goal")), before, after };
    });
    if (offlineAttempt.accepted) {
      await page.waitForFunction(
        () => Object.values(state.trustSpineSync.events).some(
          (record) => (record.pendingOperations?.length || 0) >= 1,
        ),
        null,
        { timeout: 10000 },
      );
    }
    const offline = await page.evaluate((knownIds) => {`;
    assert.equal(
      source.includes(staleOrdinaryReconciliation),
      true,
      `exact tooling ${approvedToolingSha} one-shot reconciliation was not found`,
    );
    assert.equal(
      source.includes(staleOfflineClick),
      true,
      `exact tooling ${approvedToolingSha} offline click was not found`,
    );
    return {
      ...loaded,
      source: source
        .replace(staleOrdinaryReconciliation, compatibleOrdinaryReconciliation)
        .replace(staleOfflineClick, compatibleOfflineEntry)
        .replace(
          '    assert.ok(offline.eventId && offline.pending >= 1, "offline event was not retained locally");',
          `    assert.ok(
      offlineAttempt.accepted && offline.eventId && offline.pending >= 1,
      \`offline event was not retained locally: \${JSON.stringify({ offlineAttempt, offline })}\`,
    );`,
        ),
    };
  }
  if (moduleName !== fixtureModuleName) return loaded;

  const historicalDeclaration =
    `export const APPROVED_APPLICATION_SHA = "${historicalApplicationSha}";`;
  assert.equal(
    source.includes(historicalDeclaration),
    true,
    `exact tooling ${approvedToolingSha} application declaration was not found`,
  );

  return {
    ...loaded,
    source: source.replace(
      historicalDeclaration,
      `export const APPROVED_APPLICATION_SHA = "${targetApplicationSha}";`,
    ),
  };
}
