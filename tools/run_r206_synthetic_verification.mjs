#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  R206_PROJECT_REF,
  R206_PUBLIC_EVIDENCE_DIR,
  R206StopError,
  attachExecutionContext,
  createFailureEnvelope,
  dryRunPlan,
  executeSyntheticVerification,
  prepareR206RunPrivateDirectory,
} from "./r206_synthetic_runner_core.mjs";
import {
  createProductionAdapter,
  validateProductionConfiguration,
} from "./r206_synthetic_production_adapter.mjs";
import { checkR206BrowserRuntime } from "./r206_browser_runtime.mjs";
import { diagnoseR206BrowserSession } from "./r206_browser_session.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return [
    "Usage:",
    "  node tools/run_r206_synthetic_verification.mjs --check-browser-runtime",
    "  node tools/run_r206_synthetic_verification.mjs --diagnose-browser-session",
    "  node tools/run_r206_synthetic_verification.mjs --prepare-run-directory",
    "  node tools/run_r206_synthetic_verification.mjs --dry-run [--target-ref <sha>]",
    "  node tools/run_r206_synthetic_verification.mjs --execution-mode disposable [paths]",
    "  node tools/run_r206_synthetic_verification.mjs --execution-mode production --allow-production [reviewed inputs]",
    "",
    "Reviewed production inputs:",
    "  --target-ref <full-sha>",
    "  --project-ref <project-ref>",
    "  --private-evidence-dir <absolute-path>",
    "  --public-evidence-dir <repository-path>",
    "  --authorization-artifact <private-json>",
    "  --preflight-artifact <private-json>",
    "",
    "Production is disabled by default. Credentials are accepted only through",
    "R206_SUPABASE_PUBLISHABLE_KEY and R206_SUPABASE_SECRET_KEY at runtime.",
  ].join("\n");
}

export function parseArgs(argv) {
  const options = {
    dryRun: false,
    allowProduction: false,
    reviewedPrivatePathOverride: false,
  };
  const valueFlags = new Map([
    ["--execution-mode", "executionMode"],
    ["--target-ref", "targetRef"],
    ["--project-ref", "projectRef"],
    ["--api-url", "apiUrl"],
    ["--private-evidence-dir", "privateEvidenceDir"],
    ["--public-evidence-dir", "publicEvidenceDir"],
    ["--authorization-artifact", "authorizationArtifact"],
    ["--preflight-artifact", "preflightArtifact"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--allow-production") {
      options.allowProduction = true;
      continue;
    }
    if (argument === "--check-browser-runtime") {
      options.checkBrowserRuntime = true;
      continue;
    }
    if (argument === "--diagnose-browser-session") {
      options.diagnoseBrowserSession = true;
      continue;
    }
    if (argument === "--prepare-run-directory") {
      options.prepareRunDirectory = true;
      continue;
    }
    if (argument === "--reviewed-private-path-override") {
      options.reviewedPrivatePathOverride = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    const key = valueFlags.get(argument);
    if (!key || index + 1 >= argv.length) {
      throw new R206StopError(`unrecognized or incomplete argument: ${argument}`, {
        code: "INVALID_ARGUMENT",
      });
    }
    options[key] = argv[index + 1];
    index += 1;
  }
  return options;
}

function currentHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function currentWorktreeRoots() {
  return execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => fs.realpathSync(path.resolve(line.slice("worktree ".length))));
}

function disposableConfiguration(options) {
  const privateEvidenceDir = path.resolve(
    options.privateEvidenceDir
      || fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-private-")),
  );
  const publicEvidenceDir = path.resolve(
    options.publicEvidenceDir
      || fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-public-")),
  );
  if (
    options.projectRef
    && options.projectRef !== "local-r206-disposable"
    && options.projectRef !== R206_PROJECT_REF
  ) {
    throw new R206StopError("disposable project reference is unrecognized", {
      code: "PROJECT_REF_MISMATCH",
    });
  }
  return {
    executionMode: "disposable",
    targetRef: options.targetRef || currentHead(),
    projectRef: "local-r206-disposable",
    privateEvidenceDir,
    publicEvidenceDir,
    credentialSource: "disposable_in_memory",
    releaseCloseoutApproved: false,
  };
}

export async function run(
  argv = process.argv.slice(2),
  env = process.env,
  dependencies = {},
) {
  const readinessCheck = dependencies.checkBrowserRuntime || checkR206BrowserRuntime;
  const diagnoseBrowserSession = dependencies.diagnoseBrowserSession
    || diagnoseR206BrowserSession;
  const validateProduction = dependencies.validateProductionConfiguration
    || validateProductionConfiguration;
  const buildProductionAdapter = dependencies.createProductionAdapter
    || createProductionAdapter;
  const executeVerification = dependencies.executeSyntheticVerification
    || executeSyntheticVerification;
  const prepareRunDirectory = dependencies.prepareR206RunPrivateDirectory
    || prepareR206RunPrivateDirectory;
  const options = parseArgs(argv);
  if (options.help) return { help: usage() };
  if (options.prepareRunDirectory) {
    if (argv.length !== 1) {
      throw new R206StopError("--prepare-run-directory cannot be combined with other arguments", {
        code: "INVALID_ARGUMENT",
      });
    }
    return prepareRunDirectory({
      repoRoot,
      gitWorktreeRoots: currentWorktreeRoots(),
    });
  }
  if (options.checkBrowserRuntime) {
    if (argv.length !== 1) {
      throw attachExecutionContext(
        new R206StopError("--check-browser-runtime cannot be combined with other arguments", {
          code: "INVALID_ARGUMENT",
        }),
        {
          currentOperation: "browser_runtime_readiness",
          phase: "browser_readiness",
          mutationStarted: false,
          authorizationConsumed: false,
        },
      );
    }
    const readiness = await readinessCheck();
    return readiness.result;
  }
  if (options.diagnoseBrowserSession) {
    if (argv.length !== 1) {
      throw attachExecutionContext(
        new R206StopError("--diagnose-browser-session cannot be combined with other arguments", {
          code: "INVALID_ARGUMENT",
        }),
        {
          currentOperation: "browser_session_diagnostic",
          phase: "browser_session_diagnostic",
          mutationStarted: false,
          authorizationConsumed: false,
        },
      );
    }
    const readiness = await readinessCheck();
    try {
      return await diagnoseBrowserSession({ chromium: readiness.chromium });
    } catch (error) {
      throw attachExecutionContext(error, {
        ...(error.executionContext || {}),
        phase: "browser_session_diagnostic",
        mutationStarted: false,
        cleanupOnlyStarted: false,
        cleanupCompleted: error.executionContext?.browserProfileRemoved === true,
        authorizationConsumed: false,
      });
    }
  }
  if (options.dryRun) {
    if (options.executionMode && options.executionMode !== "dry-run") {
      throw new R206StopError("--dry-run cannot be combined with another execution mode", {
        code: "INVALID_ARGUMENT",
      });
    }
    return dryRunPlan({
      targetRef: options.targetRef || currentHead(),
      projectRef: options.projectRef || R206_PROJECT_REF,
    });
  }
  if (options.executionMode === "disposable") {
    const config = disposableConfiguration(options);
    const { createDisposableAdapter } = await import("./r206_synthetic_disposable_adapter.mjs");
    const adapter = await createDisposableAdapter({
      repoRoot,
      privateEvidenceDir: config.privateEvidenceDir,
      publicEvidenceDir: config.publicEvidenceDir,
    });
    return executeVerification({ adapter, config });
  }
  if (options.executionMode === "production") {
    options.projectRef ||= R206_PROJECT_REF;
    options.publicEvidenceDir ||= path.join(repoRoot, R206_PUBLIC_EVIDENCE_DIR);
    let browserRuntime;
    try {
      browserRuntime = await readinessCheck();
    } catch (error) {
      throw attachExecutionContext(error, {
        currentOperation: "browser_runtime_readiness",
        phase: "browser_readiness",
        lastSuccessfullyCompletedPhase: "none",
        completedActionCount: 0,
        mutationStarted: false,
        cleanupOnlyStarted: false,
        cleanupCompleted: false,
        authorizationConsumed: false,
        manualCleanupRequired: false,
      });
    }
    let validated;
    try {
      validated = validateProduction({
        repoRoot,
        options,
        env,
      });
    } catch (error) {
      throw attachExecutionContext(error, {
        currentOperation: "production_configuration_validation",
        phase: "configuration_validation",
        lastSuccessfullyCompletedPhase: "browser_readiness",
        completedActionCount: 0,
        mutationStarted: false,
        cleanupOnlyStarted: false,
        cleanupCompleted: false,
        authorizationConsumed: [
          "PRODUCTION_AUTHORIZATION_ALREADY_CONSUMED",
          "PRIVATE_EVIDENCE_RUN_ALREADY_CONSUMED",
        ].includes(error?.code),
        manualCleanupRequired: false,
      });
    }
    delete env.R206_SUPABASE_PUBLISHABLE_KEY;
    delete env.R206_SUPABASE_SECRET_KEY;
    const adapter = buildProductionAdapter({
      repoRoot,
      config: validated.config,
      authorization: validated.authorization,
      preflightArtifact: validated.preflight,
      artifactHashes: validated.artifactHashes,
      secrets: validated.secrets,
      browserRuntime,
    });
    validated.secrets.publishableKey = null;
    validated.secrets.secretKey = null;
    return executeVerification({ adapter, config: validated.config });
  }
  throw new R206StopError(
    "choose --dry-run or an explicit --execution-mode disposable|production",
    { code: "EXECUTION_MODE_REQUIRED" },
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run()
    .then((result) => {
      if (result.help) {
        process.stdout.write(`${result.help}\n`);
      } else {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      }
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify(createFailureEnvelope(error))}\n`);
      process.exitCode = 1;
    });
}
