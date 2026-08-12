import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceFile =
  process.env.LAXHORNET_REGRESSION_EVIDENCE_FILE ||
  path.join(
    root,
    "review-evidence",
    "event-pipeline-release-control-cleanup",
    "regression-output.txt",
  );
const cleanOutput = (value) => (value || "")
  .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
  .replace(/[ \t]+$/gm, "")
  .trimEnd();
if (existsSync(evidenceFile)) {
  writeFileSync(evidenceFile, `${cleanOutput(readFileSync(evidenceFile, "utf8"))}\n`);
}
const python = process.env.LAXHORNET_PYTHON || "python";
const failFast = process.argv.includes("--fail-fast");
const manifest = JSON.parse(
  readFileSync(path.join(root, "release", "laxhornet-release-manifest.json"), "utf8"),
);
const git = (...args) =>
  spawnSync("git", args, { cwd: root, encoding: "utf8" });
const isAncestorOfHead = (ref) => git("merge-base", "--is-ancestor", ref, "HEAD").status === 0;
const combinedMode =
  isAncestorOfHead(manifest.databaseCandidate) &&
  isAncestorOfHead(manifest.cleanupCandidate);
const defaultBaseRef = combinedMode
  ? git("merge-base", manifest.databaseCandidate, manifest.preCutoverRuntime).stdout.trim()
  : "7cf58df9a43ce235fc6068bd4c50549e05906de4";
const baseRef = process.env.LAXHORNET_RELEASE_BASE_REF || defaultBaseRef;
const additivePaths = [
  "supabase/migrations/20260723040000_event_pipeline_capabilities.sql",
  "supabase/rollback/20260723040000_event_pipeline_capabilities_rollback.sql",
  "supabase/migrations/20260727000000_tracked_playing_time_operations.sql",
  "supabase/rollback/20260727000000_tracked_playing_time_operations_rollback.sql",
  "supabase/tests/tracked_playing_time_foundation.sql",
  "supabase/migrations/20260728193942_v284_public_event_semantic_boundary.sql",
  "supabase/rollback/20260728193942_v284_public_event_semantic_boundary_rollback.sql",
  "supabase/tests/v284_public_event_semantic_boundary.sql",
  "supabase/migrations/20260730004700_team_members_rls_recursion.sql",
  "supabase/rollback/20260730004700_team_members_rls_recursion_rollback.sql",
  "supabase/tests/team_members_rls_recursion.sql",
  "supabase/tests/team_members_rls_recursion_reproduction.sql",
  "supabase/migrations/20260730134439_durable_game_tombstones.sql",
  "supabase/rollback/20260730134439_durable_game_tombstones_rollback.sql",
  "supabase/tests/durable_game_tombstones.sql",
  "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
  "supabase/rollback/20260730151714_durable_game_tombstone_concurrency_rollback.sql",
  "supabase/tests/durable_game_tombstone_concurrency.sql",
  "supabase/migrations/20260806143128_r207a_dormant_concurrency_foundation.sql",
  "supabase/rollback/20260806143128_r207a_dormant_concurrency_foundation_rollback.sql",
  "supabase/migrations/20260809155442_r207b_controlled_preview_integration.sql",
  "supabase/rollback/20260809155442_r207b_controlled_preview_integration_rollback.sql",
  "supabase/seed.sql",
  "supabase/migrations/20260809164435_r207b_qualify_preview_game_update.sql",
  "supabase/rollback/20260809164435_r207b_qualify_preview_game_update_rollback.sql",
  "supabase/migrations/20260809173500_r207c_versioned_event_corrections.sql",
  "supabase/rollback/20260809173500_r207c_versioned_event_corrections_rollback.sql",
  "supabase/migrations/20260809201608_r207d_conflict_resolution_foundation.sql",
  "supabase/rollback/20260809201608_r207d_conflict_resolution_foundation_rollback.sql",
  "supabase/migrations/20260811010813_r207_clock_command_batch_integration.sql",
  "supabase/rollback/20260811010813_r207_clock_command_batch_integration_rollback.sql",
  "supabase/migrations/20260811131042_r207_forward_migration_b_cutover_gate.sql",
  "supabase/migrations/20260811211414_r207_pre_activation_policy_reconciliation.sql",
  "supabase/migrations/20260811211415_r207_forward_migration_b_activation.sql",
  "supabase/migrations/20260811211416_r207_forward_migration_b_postactivation_verification.sql",
  "supabase/rollback/20260811211415_r207_forward_migration_b_activation_rollback.sql",
].join(",");

const rootJavaScript = readdirSync(root)
  .filter((name) => name.endsWith(".js"))
  .sort()
  .map((name) => ({ name: `syntax: ${name}`, command: process.execPath, args: ["--check", name] }));

const tests = [
  ...rootJavaScript,
  { name: "local-storage safety contracts", command: process.execPath, args: ["tools/test_local_storage_safety.mjs"] },
  { name: "event-operation service contracts", command: process.execPath, args: ["tools/test_event_operation_service.mjs"] },
  { name: "durable game and clock operation contracts", command: process.execPath, args: ["tools/test_durable_sync_operations.mjs"] },
  { name: "durable legacy game tombstone contracts", command: process.execPath, args: ["tools/test_game_tombstones.mjs"] },
  { name: "R2-06P hydration tombstone suppression contracts", command: process.execPath, args: ["tools/test_hydration_tombstone_suppression.mjs"] },
  { name: "R2-06P disposable browser hydration", command: process.execPath, args: ["tools/test_hydration_tombstone_browser.cjs"] },
  { name: "durable legacy game tombstone migration", command: process.execPath, args: ["tools/test_game_tombstone_migration.mjs"] },
  { name: "R2-07B controlled preview client", command: process.execPath, args: ["tools/test_r207b_controlled_preview.mjs"] },
  { name: "R2-07B two-session browser", command: process.execPath, args: ["tools/test_r207b_two_session_browser.cjs"] },
  { name: "R2-07C versioned event client", command: process.execPath, args: ["tools/test_r207c_versioned_events.mjs"] },
  { name: "R2-07C client safety remediation", command: process.execPath, args: ["tools/test_r207c_client_safety_remediation.mjs"] },
  { name: "R2-07C two-session browser", command: process.execPath, args: ["tools/test_r207c_two_session_browser.cjs"] },
  { name: "R2-07D conflict resolution client", command: process.execPath, args: ["tools/test_r207d_conflict_resolution_client.mjs"] },
  { name: "R2-07D event dismiss browser", command: process.execPath, args: ["tools/test_r207d_event_dismiss_browser.cjs"] },
  { name: "R2-07 clock command and batch client", command: process.execPath, args: ["tools/test_r207_clock_command_batch_client.mjs"] },
  { name: "R2-07 clock command and batch browser", command: process.execPath, args: ["tools/test_r207_clock_command_batch_two_context_browser.cjs"] },
  {
    name: "R2-07 Forward Migration B exact binding",
    command: process.execPath,
    args: ["tools/test_r207_forward_migration_b_activation.mjs", "--binding-only"],
  },
  { name: "active no-container verification paths", command: process.execPath, args: ["tools/test_no_container_active_paths.mjs"] },
  { name: "recursive active-executable graph adversarial contracts", command: process.execPath, args: ["tools/test_active_executable_graph.mjs"] },
  { name: "hosted Supabase Preview matrix contracts", command: process.execPath, args: ["tools/test_supabase_preview_server_matrix_contract.mjs"] },
  { name: "sync error classification contracts", command: process.execPath, args: ["tools/test_sync_error_classification.mjs"] },
  { name: "sync characterization contracts", command: process.execPath, args: ["tools/test_sync_characterization.mjs"] },
  { name: "tracked playing time service contracts", command: process.execPath, args: ["tools/test_tracked_playing_time_service.mjs"] },
  { name: "tracked playing time foundation contracts", command: process.execPath, args: ["tools/test_tracked_playing_time_foundation.mjs"] },
  { name: "v284 team authorization policy", command: process.execPath, args: ["tools/test_v284_team_authorization_policy.mjs"] },
  { name: "tracked playing time UI contracts", command: process.execPath, args: ["tools/test_tracked_playing_time_ui.mjs"] },
  { name: "tracked playing time manual scenarios", command: process.execPath, args: ["tools/test_tracked_playing_time_manual_scenarios.mjs"] },
  {
    name: "tracked playing time browser",
    command: process.execPath,
    args: ["tools/test_tracked_playing_time_ui_browser.cjs"],
    env: {
      LAXHORNET_TRACKED_TIME_EVIDENCE_ROOT: path.join(
        os.tmpdir(),
        "laxhornet-v284-tracked-playing-time-browser",
      ),
    },
  },
  { name: "public event semantic boundary", command: process.execPath, args: ["tools/test_public_event_semantic_boundary.mjs"] },
  { name: "team members RLS remediation", command: process.execPath, args: ["tools/test_team_members_rls_remediation.mjs"] },
  { name: "team members State C bindings", command: process.execPath, args: ["tools/test_team_members_state_c.mjs"] },
  { name: "game scope and capability contracts", command: process.execPath, args: ["tools/test_game_scope_capabilities.mjs"] },
  { name: "current update release", command: process.execPath, args: ["tools/test_update_release.mjs"] },
  {
    name: "release manifest validation",
    command: process.execPath,
    args: [
      "tools/validate_release_manifest.mjs",
      ...(combinedMode ? ["--require-combined", "--combined-ref=HEAD"] : []),
    ],
  },
  { name: "release manifest reconciliation", command: process.execPath, args: ["tools/test_release_manifest_reconciliation.mjs"] },
  { name: "R2-06Q evidence reconciliation", command: process.execPath, args: ["tools/test_r206_closeout_reconciliation.mjs"] },
  { name: "R2-06R release closeout", command: process.execPath, args: ["tools/test_r206_release_closeout.mjs"] },
  { name: "post-R2-06 stabilization release", command: process.execPath, args: ["tools/test_post_r206_stabilization_release.mjs"] },
  { name: "v285 production deployment reconciliation", command: process.execPath, args: ["tools/test_v285_production_reconciliation.mjs"] },
  { name: "Pages explicit production-state verifier", command: process.execPath, args: ["tools/test_pages_settings_verifier.mjs"] },
  { name: "Pages deployment contracts", command: process.execPath, args: ["tools/test_pages_deployment.mjs"] },
  { name: "release preflight phase-aware", command: process.execPath, args: ["tools/test_release_preflight_phase_aware.mjs"] },
  { name: "release containment phase-aware", command: process.execPath, args: ["tools/test_release_containment_phase_aware.mjs"] },
  { name: "release hygiene", command: process.execPath, args: ["tools/test_release_hygiene.mjs"] },
  { name: "R2-06 browser runtime and failure-envelope contracts", command: process.execPath, args: ["tools/test_r206_browser_runtime.mjs"] },
  { name: "R2-06 browser session establishment contracts", command: process.execPath, args: ["tools/test_r206_browser_session.mjs"] },
  { name: "R2-06 reviewed synthetic runner contracts", command: process.execPath, args: ["tools/test_r206_synthetic_verification.mjs"] },
  { name: "R2-06 disposable synthetic verification", command: process.execPath, args: ["tools/test_r206_synthetic_verification_disposable.mjs"] },
  { name: "minimum disclosure", command: process.execPath, args: ["tools/test_minimum_disclosure.mjs"] },
  { name: "secure disclosure activation", command: process.execPath, args: ["tools/test_secure_disclosure_activation.mjs"] },
  {
    name: "secure disclosure browser",
    command: process.execPath,
    args: ["tools/test_secure_disclosure_activation_browser.cjs"],
    env: {
      LAXHORNET_ACTIVATION_EVIDENCE_ROOT: path.join(
        os.tmpdir(),
        "laxhornet-v284-secure-disclosure-browser",
      ),
    },
  },
  { name: "Product Alignment source", command: process.execPath, args: ["tools/test_product_alignment_remediation.mjs"] },
  {
    name: "Product Alignment browser",
    command: process.execPath,
    args: ["tools/test_product_alignment_browser.cjs"],
    localServer: { port: 5251 },
  },
  { name: "Trust Spine contracts", command: process.execPath, args: ["tools/test_trust_spine_release1.mjs"] },
  { name: "Trust Spine SQL acceptance and rollback", command: process.execPath, args: ["tools/run_trust_spine_pglite.mjs"] },
  { name: "Cancel Game", command: python, args: ["tools/test_cancel_game.py"] },
  { name: "delete permissions", command: python, args: ["tools/test_delete_rpc_permissions.py"] },
  { name: "player-removal cleanup", command: python, args: ["tools/test_player_removal_request_cleanup.py"] },
  { name: "secret and host scan", command: process.execPath, args: ["tools/test_event_pipeline_secret_scan.mjs"] },
  { name: "git diff check", command: "git", args: ["diff", "--check"] },
];

const log = [];
const failureDiagnostics = [];
let failed = 0;
let completed = 0;
let firstFailed = "";

async function waitForLocalServer(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
      socket.setTimeout(250, () => { socket.destroy(); resolve(false); });
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local browser test server did not become ready on port ${port}`);
}

for (const test of tests) {
  let localServer;
  if (test.localServer) {
    localServer = spawn(python, ["-m", "http.server", String(test.localServer.port), "--bind", "127.0.0.1"], {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForLocalServer(test.localServer.port);
  }
  const result = spawnSync(test.command, test.args, {
    cwd: root,
    encoding: "utf8",
    timeout: test.timeoutMs || 180000,
    env: {
      ...process.env,
      LAXHORNET_RELEASE_BASE_REF: baseRef,
      LAXHORNET_ALLOWED_ADDITIVE_DB_PATHS: additivePaths,
      ...(test.env || {}),
      ...(combinedMode
        ? {
            LAXHORNET_AUTHORIZED_DB_REF: manifest.databaseCandidate,
            LAXHORNET_APPROVED_ADDITIVE_REF: manifest.cleanupCandidate,
          }
        : {}),
    },
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  completed += 1;
  if (exitCode !== 0) {
    failed += 1;
    firstFailed ||= test.name;
    failureDiagnostics.push(
      `===== FAILED: ${test.name} =====`,
      cleanOutput(result.stdout),
      cleanOutput(result.stderr),
      `EXIT: ${exitCode}`,
    );
  }
  if (localServer && !localServer.killed) localServer.kill();
  log.push(
    `===== ${test.name} =====`,
    cleanOutput(result.stdout),
    cleanOutput(result.stderr),
    `EXIT: ${exitCode}`,
    "",
  );
  if (failFast && exitCode !== 0) break;
}

log.push(
  `MODE: ${combinedMode ? "canonical_plus_additive" : "stacked_additive"}`,
  `TOTAL: ${completed - failed} passed, ${failed} failed${completed < tests.length ? `, ${tests.length - completed} not run` : ""}`,
  ...(firstFailed ? [`FIRST_FAILED: ${firstFailed}`] : []),
  "",
);
writeFileSync(evidenceFile, log.join("\n"));
console.log(log.findLast((line) => line.startsWith("TOTAL:")));

if (failed) {
  console.error(failureDiagnostics.join("\n"));
  process.exitCode = 1;
}
