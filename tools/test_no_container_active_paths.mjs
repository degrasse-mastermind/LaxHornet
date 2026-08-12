#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const activeControlFiles = [
  ".github/workflows/laxhornet-regression.yml",
  ".github/workflows/pages-deployment.yml",
  "tools/run_v283_local_regression.mjs",
  "tools/run_release_preflight.mjs",
  "tools/run_release_verification.mjs",
  "docs/CODEX_WORKFLOW.md",
  "docs/RELEASE_VERIFICATION_WORKFLOW.md",
  "REPO_CURRENT_STATE.md",
];

const executablePatterns = [
  /\b(?:spawn|spawnSync|execFile|execFileSync|command|run|runGate)\s*\(\s*["']docker["']/i,
  /\b(?:docker|docker\.exe)\s+(?:build|compose|exec|run|start|stop|version)\b/i,
  /\bsupabase\s+(?:start|stop|status|db\s+(?:reset|push)|migration\s+up|test\s+db)\b/i,
  /--start-supabase\b/i,
];

for (const relative of activeControlFiles) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  for (const pattern of executablePatterns) {
    assert.doesNotMatch(source, pattern, `${relative} contains an active container/local-stack command`);
  }
}

const runner = fs.readFileSync(path.join(root, "tools", "run_v283_local_regression.mjs"), "utf8");
const invokedTools = [...runner.matchAll(/["'](tools\/(?:test|run|validate|build)_[^"']+\.(?:mjs|cjs|py))["']/g)]
  .map((match) => match[1])
  .filter((value, index, values) => values.indexOf(value) === index);

const exactBindingTool = "tools/test_r207_forward_migration_b_activation.mjs";
const staticStateCTool = "tools/test_team_members_state_c.mjs";
assert.match(
  runner,
  /args:\s*\["tools\/test_r207_forward_migration_b_activation\.mjs",\s*"--binding-only"\]/,
  "canonical regression must invoke Forward Migration B only in exact-binding mode",
);
assert.match(
  fs.readFileSync(path.join(root, exactBindingTool), "utf8"),
  /if \(process\.argv\.includes\("--binding-only"\)\) \{[\s\S]*?process\.exit\(0\);[\s\S]*?\}\s*\n\s*const main = await start/,
  "Forward Migration B binding mode must exit before server-backed execution",
);
assert.doesNotMatch(
  runner,
  /args:\s*\["tools\/test_team_members_state_c\.mjs",\s*"--local"\]/,
  "canonical regression must not enable the State C local-stack mode",
);
assert.match(
  fs.readFileSync(path.join(root, staticStateCTool), "utf8"),
  /if \(!process\.argv\.includes\("--local"\)\) \{[\s\S]*?process\.exit\(0\);[\s\S]*?\}\s*\n\s*const matrix =/,
  "State C default mode must exit before local-stack execution",
);

for (const relative of invokedTools) {
  if (relative === exactBindingTool || relative === staticStateCTool) continue;
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  for (const pattern of executablePatterns.slice(0, 2)) {
    assert.doesNotMatch(source, pattern, `canonical regression invokes container-backed tool ${relative}`);
  }
}

assert.match(
  fs.readFileSync(path.join(root, "docs", "ISOLATED_PREVIEW_REVIEW_GATE.md"), "utf8"),
  /authenticated multi-session adversarial matrix[\s\S]*must not be replaced by\s+embedded, PGlite, browser-mock, or migration-application status/i,
  "isolated Preview gate must preserve the non-substitution rule",
);

console.log(`PASS: ${activeControlFiles.length} active control files contain no container/local-stack command.`);
console.log(`PASS: ${invokedTools.length} canonical regression tool invocations are container-free.`);
console.log("PASS: authenticated isolated-Preview adversarial evidence remains a non-substitutable Level 3 gate.");
