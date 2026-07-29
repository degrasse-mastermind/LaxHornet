#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
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
const releaseArgument = process.argv[2] || "v284";
const release = releaseArgument.startsWith("v") ? releaseArgument : `v${releaseArgument}`;
const logRoot = path.join(
  tmpdir(),
  "laxhornet-release-verification",
  createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0, 12),
  `${release}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
const logFile = path.join(logRoot, "release-verification.log");
const regressionFile = path.join(logRoot, "full-regression.txt");
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

function recordProcess(name, result) {
  const stdout = (result.stdout || "").trimEnd();
  const stderr = (result.stderr || "").trimEnd();
  if (stdout) {
    console.log(stdout);
    appendFileSync(logFile, `${stdout}\n`);
  }
  if (stderr) {
    console.error(stderr);
    appendFileSync(logFile, `${stderr}\n`);
  }
  appendFileSync(logFile, `EXIT: ${result.status ?? 1}\n\n`);
  if (result.status !== 0) throw new Error(`${name} exited with ${result.status ?? 1}`);
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
    ...(options.input ? { input: options.input } : {}),
  });
  recordProcess(name, result);
  write(`PASS: ${name}`);
  return result;
}

function runExpectedFailure(name, command, args, expectedText, options = {}) {
  gateNumber += 1;
  write(`===== GATE ${gateNumber}: ${name} =====`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout || 60000,
    env: { ...process.env, ...options.env },
    ...(options.input ? { input: options.input } : {}),
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.stdout) appendFileSync(logFile, result.stdout);
  if (result.stderr) appendFileSync(logFile, result.stderr);
  appendFileSync(logFile, `EXIT: ${result.status ?? 1}\n\n`);
  if (result.status === 0 || !output.includes(expectedText)) {
    throw new Error(`${name} did not fail with the required refusal`);
  }
  write(`PASS: ${name}`);
  return result;
}

function psql(container, sql) {
  return spawnSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60000,
      input: sql,
    },
  );
}

const rollbackSql = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(
    path.join(root, "supabase", "rollback", "20260727000000_tracked_playing_time_operations_rollback.sql"),
    "utf8",
  ),
);
const migrationSql = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(
    path.join(root, "supabase", "migrations", "20260727000000_tracked_playing_time_operations.sql"),
    "utf8",
  ),
);
const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(
  await import("node:fs").then(({ readFileSync }) =>
    readFileSync(path.join(root, "supabase", "config.toml"), "utf8"),
  ),
)?.[1];
if (!projectId) throw new Error("Unable to resolve the local Supabase project ID");
const databaseContainer = `supabase_db_${projectId}`;

const syntheticHistorySql = `
begin;
insert into public.lh_game_clock_states(
  game_id, owner_user_id, player_id, scope_type, period_format,
  regulation_period_duration_seconds, overtime_duration_seconds,
  current_period, clock_seconds_remaining, is_running,
  client_updated_at, recovery_state, created_by_user_id
) values (
  'rollback-synthetic-game',
  '11111111-1111-4111-8111-111111111111',
  'rollback-synthetic-player',
  'personal',
  'quarters',
  600,
  180,
  'Q1',
  600,
  false,
  '2026-07-27T13:00:00Z',
  'complete',
  '11111111-1111-4111-8111-111111111111'
);
insert into public.lh_participation_logical_events(
  logical_event_id, game_id, player_id, scope_type, event_kind,
  current_revision, created_by_user_id
) values (
  'rollback-synthetic-logical',
  'rollback-synthetic-game',
  'rollback-synthetic-player',
  'personal',
  'player_in',
  1,
  '11111111-1111-4111-8111-111111111111'
);
insert into public.lh_participation_operations(
  operation_id, client_operation_id, game_id, logical_event_id,
  operation_kind, effective_event_kind, revision_sequence, player_id,
  scope_type, period, game_clock_seconds, occurred_at, client_created_at,
  source, recovery_uncertain, change_reason, authored_by_user_id, request_hash
) values (
  'rollback-synthetic-operation',
  'rollback-synthetic-client',
  'rollback-synthetic-game',
  'rollback-synthetic-logical',
  'player_in',
  'player_in',
  1,
  'rollback-synthetic-player',
  'personal',
  'Q1',
  600,
  '2026-07-27T13:00:00Z',
  '2026-07-27T13:00:00Z',
  'live',
  false,
  '',
  '11111111-1111-4111-8111-111111111111',
  'rollback-synthetic-request-hash'
);
update public.lh_participation_logical_events
set current_operation_id = 'rollback-synthetic-operation'
where logical_event_id = 'rollback-synthetic-logical';
commit;
`;

const rollbackVerificationSql = `
select case
  when to_regclass('public.lh_game_clock_states') is null
    and to_regclass('public.lh_participation_operations') is null
    and to_regclass('public.lh_effective_participation_operations') is null
    and to_regprocedure('public.lh_reconcile_participation_operations(jsonb)') is null
    and to_regprocedure('public.lh_release_capabilities()') is not null
    and to_regprocedure('public.lh_create_live_share_token(text,timestamp with time zone)') is not null
  then 'ROLLBACK_SCOPE_PASS'
  else 'ROLLBACK_SCOPE_FAIL'
end;
`;

const refusalVerificationSql = `
select case
  when (select count(*) from public.lh_participation_operations) = 1
    and to_regprocedure('public.lh_reconcile_participation_operations(jsonb)') is not null
  then 'ROLLBACK_REFUSAL_PASS'
  else 'ROLLBACK_REFUSAL_FAIL'
end;
`;

function runPsqlGate(name, sql, expectedText = "") {
  gateNumber += 1;
  write(`===== GATE ${gateNumber}: ${name} =====`);
  const result = psql(databaseContainer, sql);
  recordProcess(name, result);
  if (expectedText && !`${result.stdout || ""}`.includes(expectedText)) {
    throw new Error(`${name} did not report ${expectedText}`);
  }
  write(`PASS: ${name}`);
}

let preflight;
try {
  write(`LaxHornet ${release} local release verification`);
  write(`Evidence: ${logRoot}`);
  write("");

  preflight = runReleasePreflight({
    prepare: true,
    release,
    phase: "preparation",
    startSupabase: true,
  });
  appendResults("PREFLIGHT", preflight.results);
  if (!preflight.ok) throw new Error("release preflight failed");

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
  runGate("blank seven-migration reset", "supabase", ["db", "reset", "--local"]);
  runGate(
    "blank reset pgTAP",
    "supabase",
    ["test", "db", "--local", "supabase/tests/tracked_playing_time_foundation.sql"],
  );
  runGate(
    "blank reset public-event boundary pgTAP",
    "supabase",
    ["test", "db", "--local", "supabase/tests/v284_public_event_semantic_boundary.sql"],
  );
  runGate(
    "production-shaped six-migration reset",
    "supabase",
    ["db", "reset", "--local", "--version", "20260723040000"],
  );
  runGate("production-shaped migration up", "supabase", ["migration", "up", "--local"]);
  runGate(
    "production-shaped pgTAP",
    "supabase",
    ["test", "db", "--local", "supabase/tests/tracked_playing_time_foundation.sql"],
  );
  runGate(
    "production-shaped public-event boundary pgTAP",
    "supabase",
    ["test", "db", "--local", "supabase/tests/v284_public_event_semantic_boundary.sql"],
  );
  runPsqlGate("empty-history rollback", rollbackSql);
  runPsqlGate("empty-history rollback scope", rollbackVerificationSql, "ROLLBACK_SCOPE_PASS");
  runPsqlGate("tracked-time migration reapply", migrationSql);
  runPsqlGate("accepted synthetic history setup", syntheticHistorySql);

  gateNumber += 1;
  write(`===== GATE ${gateNumber}: accepted-history rollback refusal =====`);
  const refusal = psql(databaseContainer, rollbackSql);
  const refusalOutput = `${refusal.stdout || ""}${refusal.stderr || ""}`;
  appendFileSync(logFile, refusalOutput);
  appendFileSync(logFile, `EXIT: ${refusal.status ?? 1}\n\n`);
  if (
    refusal.status === 0 ||
    !refusalOutput.includes(
      "Rollback refused: export or explicitly dispose of tracked playing time participation history first.",
    )
  ) {
    throw new Error("accepted-history rollback did not fail with the required refusal");
  }
  write("PASS: accepted-history rollback refusal");
  runPsqlGate(
    "accepted-history rollback preservation",
    refusalVerificationSql,
    "ROLLBACK_REFUSAL_PASS",
  );

  runGate("disposable database cleanup reset", "supabase", ["db", "reset", "--local"]);

  gateNumber += 1;
  write(`===== GATE ${gateNumber}: local database lint =====`);
  const lint = spawnSync(
    "supabase",
    ["db", "lint", "--local", "--level", "warning", "--fail-on", "none"],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 60000 },
  );
  if (lint.stdout) appendFileSync(logFile, lint.stdout);
  if (lint.stderr) appendFileSync(logFile, lint.stderr);
  if (lint.status !== 0) throw new Error("local database lint command failed");
  const lintPayload = JSON.parse((lint.stdout || "").trim() || '{"results":[]}');
  const unexpectedLint = (lintPayload.results || []).flatMap((result) =>
    (result.issues || [])
      .filter(
        (issue) =>
          !(
            result.function === "public.laxhornet_request_team_player_access" &&
            issue.sqlState === "42702" &&
            issue.message.includes('column reference "id" is ambiguous')
          ),
      )
      .map((issue) => `${result.function}: ${issue.message}`),
  );
  if (unexpectedLint.length) {
    throw new Error(`new database lint issue: ${unexpectedLint.join("; ")}`);
  }
  write(
    (lintPayload.results || []).length
      ? "PASS: local database lint (known pre-existing ambiguous id finding only)"
      : "PASS: local database lint",
  );

  runGate(
    "complete application and release regression",
    process.execPath,
    ["tools/run_v283_local_regression.mjs", "--fail-fast"],
    { env: releaseEnv, timeout: 600000 },
  );

  write("");
  write(`${release.toUpperCase()} LOCAL RELEASE VERIFICATION PASS`);
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
