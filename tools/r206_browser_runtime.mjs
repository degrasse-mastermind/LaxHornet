import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { R206StopError } from "./r206_synthetic_runner_core.mjs";

export const R206_PLAYWRIGHT_VERSION = "1.61.1";
export const R206_CHROMIUM_REVISION = "1228";
export const R206_CHROMIUM_VERSION = "149.0.7827.55";
export const R206_BROWSER_TYPE = "chromium";

const runtimePackagePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "r206-browser-runtime",
  "package.json",
);

function safeNativeValue(value) {
  const normalized = String(value || "");
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(normalized) ? normalized : null;
}

function browserStop(message, code, cause) {
  const error = new R206StopError(message, { code, cause });
  error.nativeErrorName = safeNativeValue(cause?.name);
  error.nativeErrorCode = safeNativeValue(cause?.code);
  error.executionContext = {
    currentOperation: "browser_runtime_readiness",
    phase: "browser_readiness",
    lastSuccessfullyCompletedPhase: "none",
    completedActionCount: 0,
    mutationStarted: false,
    cleanupOnlyStarted: false,
    cleanupCompleted: false,
    residueCounts: null,
    privateCheckpointReference: null,
    retainedTombstone: false,
    manualCleanupRequired: false,
    authorizationConsumed: false,
  };
  return error;
}

export async function loadPinnedPlaywright({
  packagePath = runtimePackagePath,
  resolveModule,
  importModule = (specifier) => import(specifier),
} = {}) {
  let playwrightEntry;
  let packageVersion = null;
  let browserRevision = null;
  let browserVersion = null;
  try {
    const resolver = createRequire(packagePath);
    playwrightEntry = resolveModule
      ? await resolveModule(resolver)
      : resolver.resolve("playwright");
    if (!resolveModule) {
      const playwrightPackagePath = resolver.resolve("playwright/package.json");
      const playwrightPackage = JSON.parse(fs.readFileSync(playwrightPackagePath, "utf8"));
      packageVersion = playwrightPackage.version;
      const browsersPath = path.join(
        path.dirname(playwrightPackagePath),
        "..",
        "playwright-core",
        "browsers.json",
      );
      const browsers = JSON.parse(fs.readFileSync(browsersPath, "utf8"));
      const chromium = browsers.browsers?.find((entry) => entry.name === R206_BROWSER_TYPE);
      browserRevision = chromium?.revision || null;
      browserVersion = chromium?.browserVersion || null;
      if (
        packageVersion !== R206_PLAYWRIGHT_VERSION
        || browserRevision !== R206_CHROMIUM_REVISION
        || browserVersion !== R206_CHROMIUM_VERSION
      ) {
        throw browserStop(
          "the installed Playwright or Chromium identity differs from the reviewed pinned runtime",
          "BROWSER_RUNTIME_VERSION_MISMATCH",
        );
      }
    }
  } catch (error) {
    if (error instanceof R206StopError) throw error;
    throw browserStop(
      "the reviewed Playwright module is unavailable; install the pinned browser runtime before execution",
      "BROWSER_RUNTIME_UNAVAILABLE",
      error,
    );
  }

  try {
    const imported = await importModule(
      playwrightEntry.startsWith?.("file:")
        ? playwrightEntry
        : pathToFileURL(playwrightEntry).href,
    );
    const runtime = imported.default && !imported.chromium ? imported.default : imported;
    return {
      ...runtime,
      __r206Version: packageVersion,
      __r206BrowserRevision: browserRevision,
      __r206BrowserVersion: browserVersion,
    };
  } catch (error) {
    throw browserStop(
      "the reviewed Playwright module could not be imported",
      "BROWSER_RUNTIME_UNAVAILABLE",
      error,
    );
  }
}

export async function checkR206BrowserRuntime({
  loadPlaywright = () => loadPinnedPlaywright(),
  fsImpl = fs,
  osImpl = os,
  pathImpl = path,
} = {}) {
  let playwright;
  try {
    playwright = await loadPlaywright();
  } catch (error) {
    if (error instanceof R206StopError) throw error;
    throw browserStop(
      "the reviewed Playwright module is unavailable; install the pinned browser runtime before execution",
      "BROWSER_RUNTIME_UNAVAILABLE",
      error,
    );
  }

  const chromium = playwright?.chromium;
  if (
    playwright?.__r206Version != null
    && (
      playwright.__r206Version !== R206_PLAYWRIGHT_VERSION
      || playwright.__r206BrowserRevision !== R206_CHROMIUM_REVISION
      || playwright.__r206BrowserVersion !== R206_CHROMIUM_VERSION
    )
  ) {
    throw browserStop(
      "the installed Playwright or Chromium identity differs from the reviewed pinned runtime",
      "BROWSER_RUNTIME_VERSION_MISMATCH",
    );
  }
  if (
    !chromium
    || typeof chromium.executablePath !== "function"
    || typeof chromium.launchPersistentContext !== "function"
  ) {
    throw browserStop(
      "the reviewed Playwright Chromium browser type is unavailable",
      "BROWSER_RUNTIME_UNAVAILABLE",
    );
  }

  let executablePath;
  try {
    executablePath = chromium.executablePath();
  } catch (error) {
    throw browserStop(
      "the reviewed Chromium executable could not be resolved",
      "BROWSER_EXECUTABLE_MISSING",
      error,
    );
  }
  if (!executablePath || !fsImpl.existsSync(executablePath)) {
    throw browserStop(
      "the reviewed Chromium executable is not installed",
      "BROWSER_EXECUTABLE_MISSING",
    );
  }

  const profilePath = fsImpl.mkdtempSync(
    pathImpl.join(osImpl.tmpdir(), "laxhornet-r206-readiness-"),
  );
  let context = null;
  let launchError = null;
  try {
    context = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      serviceWorkers: "block",
    });
  } catch (error) {
    launchError = error;
  }

  let cleanupError = null;
  try {
    await context?.close();
  } catch (error) {
    cleanupError = error;
  }
  try {
    fsImpl.rmSync(profilePath, { recursive: true, force: true });
    if (fsImpl.existsSync(profilePath)) {
      throw new Error("temporary readiness profile still exists");
    }
  } catch (error) {
    cleanupError ||= error;
  }

  if (cleanupError) {
    throw browserStop(
      "the isolated browser-readiness profile could not be removed",
      "BROWSER_READINESS_CLEANUP_FAILED",
      cleanupError,
    );
  }
  if (launchError) {
    throw browserStop(
      "the reviewed Chromium runtime could not launch an isolated temporary profile",
      "BROWSER_LAUNCH_FAILED",
      launchError,
    );
  }

  return {
    chromium,
    result: {
      ok: true,
      code: "BROWSER_RUNTIME_READY",
      browserType: R206_BROWSER_TYPE,
      playwrightVersion: R206_PLAYWRIGHT_VERSION,
      browserRevision: R206_CHROMIUM_REVISION,
      browserVersion: R206_CHROMIUM_VERSION,
      isolatedProfileCreated: true,
      isolatedProfileRemoved: true,
      productionCredentialsRequired: false,
      networkMutationCount: 0,
    },
  };
}
