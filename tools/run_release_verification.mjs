#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  cleanupReleasePreflight,
  runReleasePreflight,
} from "./run_release_preflight.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedRelease = process.argv[2] || "";
const currentRelease = JSON.parse(
  readFileSync(path.join(root, "version.json"), "utf8"),
).version;
const release = requestedRelease
  ? requestedRelease.startsWith("v") ? requestedRelease : `v${requestedRelease}`
  : currentRelease;
const logRoot = path.join(
  tmpdir(),
  "laxhornet-portable-release-verification",
  createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0, 12),
  `${release}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
const logFile = path.join(logRoot, "portable-release-verification.log");
const regressionFile = path.join(logRoot, "portable-regression.txt");
mkdirSync(logRoot, { recursive: true });

let gateNumber = 0;
let failedGate = "";

function write(message = "") {
  console.log(message);
  appendFileSync(logFile, `${message}\n`);
}

function appendResults(label, results) {
  appendFileSync(logFile, `===== ${label} =====\n`);
  for (const result of results) {
    appendFileSync(
      logFile,
      `${result.status.padEnd(24)} ${result.label}${result.detail ? ` — ${result.detail}` : ""}\n`,
    );
  }
  appendFileSync(logFile, "\n");
}

function runGate(name, command, args, options = {}) {
  gateNumber += 1;
  write(`===== GATE ${gateNumber}: ${name} =====`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout || 240000,
    env: { ...process.env, ...options.env },
  });
  for (const output of [result.stdout, result.stderr]) {
    if (output) {
      process.stdout.write(output);
      appendFileSync(logFile, output);
    }
  }
  appendFileSync(logFile, `EXIT: ${result.status ?? 1}\n\n`);
  if (result.status !== 0) throw new Error(`${name} exited with ${result.status ?? 1}`);
  write(`PASS: ${name}`);
}

let preflight;
try {
  write(`LaxHornet ${release} portable release verification`);
  write(`Evidence: ${logRoot}`);
  write("");

  preflight = runReleasePreflight({
    prepare: true,
    ...(requestedRelease ? { release, phase: "preparation" } : {}),
  });
  appendResults("PREFLIGHT", preflight.results);
  if (!preflight.ok) throw new Error("portable release preflight failed");

  const releaseEnv = {
    ...preflight.environment,
    LAXHORNET_REGRESSION_EVIDENCE_FILE: regressionFile,
  };

  runGate(
    "production-ledger provenance",
    process.execPath,
    ["tools/test_production_ledger_provenance.mjs"],
    { env: releaseEnv },
  );
  runGate(
    "active no-container verification paths",
    process.execPath,
    ["tools/test_no_container_active_paths.mjs"],
    { env: releaseEnv },
  );
  runGate(
    "complete canonical-plus-additive portable regression",
    process.execPath,
    ["tools/run_v283_local_regression.mjs", "--fail-fast"],
    { env: releaseEnv, timeout: 600000 },
  );

  write("");
  write(`${release.toUpperCase()} PORTABLE RELEASE VERIFICATION PASS`);
  write("REAL POSTGRESQL AND AUTHENTICATED MULTI-SESSION EVIDENCE REMAIN REQUIRED FROM THE ISOLATED SUPABASE PREVIEW.");
  write("THIS LOCAL RESULT DOES NOT AUTHORIZE MERGE, MIGRATION, DEPLOYMENT, ACTIVATION, OR RELEASE.");
} catch (error) {
  failedGate = `Gate ${gateNumber || "preflight"}`;
  write("");
  write(`FAILED: ${failedGate} — ${error.message}`);
  process.exitCode = 1;
} finally {
  write("");
  write("===== CLEANUP =====");
  const cleanup = cleanupReleasePreflight();
  appendResults("CLEANUP RESULT", cleanup.results);
  if (!cleanup.ok && !process.exitCode) {
    failedGate = "cleanup";
    process.exitCode = 1;
  }
  write(`Evidence retained: ${logRoot}`);
  if (failedGate) write(`First failed gate: ${failedGate}`);
}
