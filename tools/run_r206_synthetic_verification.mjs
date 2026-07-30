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
  dryRunPlan,
  executeSyntheticVerification,
} from "./r206_synthetic_runner_core.mjs";
import {
  createProductionAdapter,
  validateProductionConfiguration,
} from "./r206_synthetic_production_adapter.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return [
    "Usage:",
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

export async function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  if (options.help) return { help: usage() };
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
    return executeSyntheticVerification({ adapter, config });
  }
  if (options.executionMode === "production") {
    options.projectRef ||= R206_PROJECT_REF;
    options.publicEvidenceDir ||= path.join(repoRoot, R206_PUBLIC_EVIDENCE_DIR);
    const validated = validateProductionConfiguration({
      repoRoot,
      options,
      env,
    });
    delete env.R206_SUPABASE_PUBLISHABLE_KEY;
    delete env.R206_SUPABASE_SECRET_KEY;
    const adapter = createProductionAdapter({
      repoRoot,
      config: validated.config,
      authorization: validated.authorization,
      preflightArtifact: validated.preflight,
      artifactHashes: validated.artifactHashes,
      secrets: validated.secrets,
    });
    validated.secrets.publishableKey = null;
    validated.secrets.secretKey = null;
    return executeSyntheticVerification({ adapter, config: validated.config });
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
      const safe = {
        ok: false,
        code: error instanceof R206StopError ? error.code : "UNEXPECTED_EXECUTION_FAILURE",
        message: error instanceof R206StopError
          ? error.message
          : "runner stopped on an unexpected execution failure",
      };
      process.stderr.write(`${JSON.stringify(safe)}\n`);
      process.exitCode = 1;
    });
}
