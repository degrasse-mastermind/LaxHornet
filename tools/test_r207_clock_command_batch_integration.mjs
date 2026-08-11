import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrations = [
  "20260723000000_laxhornet_legacy_baseline.sql",
  "20260723010000_trust_spine_release_1.sql",
  "20260723020000_minimum_necessary_disclosure.sql",
  "20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
  "20260723040000_event_pipeline_capabilities.sql",
  "20260727000000_tracked_playing_time_operations.sql",
  "20260728193942_v284_public_event_semantic_boundary.sql",
  "20260730134439_durable_game_tombstones.sql",
  "20260730151714_durable_game_tombstone_concurrency.sql",
  "20260806143128_r207a_dormant_concurrency_foundation.sql",
  "20260809155442_r207b_controlled_preview_integration.sql",
  "20260809164435_r207b_qualify_preview_game_update.sql",
  "20260809173500_r207c_versioned_event_corrections.sql",
  "20260809201608_r207d_conflict_resolution_foundation.sql",
  "20260811010813_r207_clock_command_batch_integration.sql",
];
const rollbackFile = "20260811010813_r207_clock_command_batch_integration_rollback.sql";
const OWNER = "00000000-0000-4000-8000-00000000000a";
const TRACKER = "00000000-0000-4000-8000-00000000000b";
const OTHER = "00000000-0000-4000-8000-00000000000c";
const containers = new Set();
let checks = 0;
let p1Checks = 0;
const check = (condition, label, details = null) => {
  assert.ok(condition, details ? `${label}: ${JSON.stringify(details)}` : label);
  checks += 1;
  console.log(`PASS: ${label}`);
};
const p1Check = (condition, label, details = null) => {
  check(condition, label, details);
  p1Checks += 1;
};
const read = (folder, file) => fs.readFileSync(path.join(root, "supabase", folder, file), "utf8");
function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    timeout: 180000,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${result.stdout}\n${result.stderr}`);
  }
  return result;
}
function psql(container, sql, allowFailure = false) {
  const result = docker([
    "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
    "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
  ], { input: sql, allowFailure });
  result.stdout = result.stdout.trim();
  result.stderr = result.stderr.trim();
  return result;
}
function psqlConcurrent(container, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
      "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    ], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => { stdout += value; });
    child.stderr.on("data", (value) => { stderr += value; });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status !== 0) reject(new Error(`${stdout}\n${stderr}`));
      else resolve(stdout.trim());
    });
    child.stdin.end(sql);
  });
}
const bootstrap = `
create role anon nologin; create role authenticated nologin;
create schema auth; create schema extensions;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema auth, extensions to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
create publication supabase_realtime;
${migrations.map((file) => read("migrations", file)).join("\n")}`;
async function start(name) {
  const container = `laxhornet-r207clock-${name}-${process.pid}`;
  containers.add(container);
  docker(["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=synthetic-only", "postgres:17-alpine"]);
  let ready = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (docker(["exec", container, "pg_isready", "-U", "postgres"], { allowFailure: true }).status === 0) ready += 1;
    else ready = 0;
    if (ready >= 3) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready >= 3, "disposable PostgreSQL target did not become ready");
  psql(container, bootstrap);
  return container;
}
const claims = (actor) => `select set_config('request.jwt.claims', '{"sub":"${actor}","role":"authenticated"}', false); set role authenticated;`;
const parse = (text) => JSON.parse(text.split(/\r?\n/).reverse().find((line) => line.startsWith("{")));
const operation = ({
  id,
  game,
  base,
  status = 1,
  lifecycle = "active",
  command,
  args = {},
  device = "synthetic-device-a",
  occurred = "2026-08-10T12:00:00Z",
}) => ({
  client_operation_id: id,
  device_id: device,
  game_id: game,
  base_clock_version: base,
  status_base_version: status,
  expected_lifecycle: lifecycle,
  command,
  arguments: args,
  client_occurred_at: occurred,
});
const command = ({
  id,
  lifecycle,
  command: commandName,
  args = {},
  device = "synthetic-offline-device",
  occurred = "2026-08-10T12:00:00Z",
}) => ({
  client_operation_id: id,
  device_id: device,
  expected_lifecycle: lifecycle,
  command: commandName,
  arguments: args,
  client_occurred_at: occurred,
});
const batch = ({ id, game, base, status = 1, lifecycle = "active", commands }) => ({
  client_batch_id: id,
  game_id: game,
  base_clock_version: base,
  status_base_version: status,
  expected_lifecycle: lifecycle,
  commands,
});
function callOperation(container, actor, request) {
  return parse(psql(container, `${claims(actor)} select public.lh_apply_game_clock_operation_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).stdout);
}
function callBatch(container, actor, request) {
  return parse(psql(container, `${claims(actor)} select public.lh_apply_game_clock_batch_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).stdout);
}
const clockInsert = (game, owner = OWNER, options = {}) => `
  insert into public.lh_game_clock_states(
    game_id,owner_user_id,player_id,team_id,roster_player_id,scope_type,
    period_format,regulation_period_duration_seconds,overtime_duration_seconds,
    current_period,clock_seconds_remaining,is_running,started_at,paused_at,
    client_updated_at,server_updated_at,recovery_state,revision,created_by_user_id,
    anchor_server_at,anchor_clock_seconds_remaining
  ) values (
    '${game}','${owner}','synthetic-player',${options.team ? `'${options.team}'` : "null"},
    ${options.roster ? `'${options.roster}'` : "null"},'${options.team ? "team_roster" : "personal"}',
    'quarters',720,300,'Q1',720,false,null,statement_timestamp(),
    statement_timestamp(),statement_timestamp(),'complete',1,'${owner}',statement_timestamp(),720
  );`;
const gameInsert = (game, owner = OWNER, extras = "") => `
  insert into public.games(id,user_id,share_code,opponent,game_date,status,lifecycle_state${extras ? ",team_id,roster_player_id" : ""})
  values ('${game}','${owner}','${`${game.slice(0, 7)}${game.slice(-1)}`.padEnd(8, "0")}','Synthetic Adult Opponent','2026-08-10','in-progress','active'${extras});`;

try {
  const main = await start("main");
  psql(main, `
    insert into auth.users(id,email) values
      ('${OWNER}','owner@example.invalid'),
      ('${TRACKER}','tracker@example.invalid'),
      ('${OTHER}','other@example.invalid');
    ${gameInsert("lifecycle-game")}
    ${gameInsert("race-game")}${clockInsert("race-game")}
    ${gameInsert("delay-game")}${clockInsert("delay-game")}
    ${gameInsert("batch-game")}${clockInsert("batch-game")}
    ${gameInsert("batch-conflict")}${clockInsert("batch-conflict")}
    ${gameInsert("batch-invalid")}${clockInsert("batch-invalid")}
    ${gameInsert("atomic-game")}${clockInsert("atomic-game")}
    ${gameInsert("independent-a")}${clockInsert("independent-a")}
    ${gameInsert("independent-b")}${clockInsert("independent-b")}
    ${gameInsert("unauthorized-game")}${clockInsert("unauthorized-game")}
    ${gameInsert("p1-prefix-one")}${clockInsert("p1-prefix-one")}
    ${gameInsert("p1-prefix-multi")}${clockInsert("p1-prefix-multi")}
    ${gameInsert("p1-period")}${clockInsert("p1-period")}
    ${gameInsert("p1-complete")}${clockInsert("p1-complete")}
    ${gameInsert("p1-reversed")}${clockInsert("p1-reversed")}
    ${gameInsert("p1-gap")}${clockInsert("p1-gap")}
    ${gameInsert("p1-boundary")}${clockInsert("p1-boundary")}
    ${gameInsert("p1-ceiling-single")}${clockInsert("p1-ceiling-single")}
    ${gameInsert("p1-ceiling-batch")}${clockInsert("p1-ceiling-batch")}
    ${gameInsert("p1-ceiling-prefix")}${clockInsert("p1-ceiling-prefix")}
  `);

  const dormant = callOperation(main, OWNER, operation({
    id: "dormant-start", game: "race-game", base: 1, command: "start",
  }));
  check(dormant.code === "r207_not_activated", "public clock contracts remain dormant by migration default");
  psql(main, read("", "seed.sql"));

  const initialized = callOperation(main, OWNER, operation({
    id: "initialize-clock", game: "lifecycle-game", base: 0, command: "initialize",
    args: {
      period_format: "quarters",
      regulation_period_duration_seconds: 720,
      overtime_duration_seconds: 300,
      current_period: "Q1",
      clock_seconds_remaining: 720,
    },
  }));
  check(initialized.outcome === "accepted" && initialized.clock_version === 1, "initialize creates one server-anchored clock revision", initialized);
  const started = callOperation(main, OWNER, operation({ id: "start-clock", game: "lifecycle-game", base: 1, command: "start" }));
  check(started.outcome === "accepted" && started.clock_state.is_running === true && started.clock_version === 2, "start accepts at the current revision and returns a server anchor", started);
  const paused = callOperation(main, OWNER, operation({ id: "pause-clock", game: "lifecycle-game", base: 2, status: 1, command: "pause" }));
  check(paused.outcome === "accepted" && paused.lifecycle_state === "paused" && paused.status_version === 2, "pause stops the clock and advances lifecycle atomically", paused);
  const resumed = callOperation(main, OWNER, operation({ id: "resume-clock", game: "lifecycle-game", base: 3, status: 2, lifecycle: "paused", command: "resume" }));
  check(resumed.outcome === "accepted" && resumed.lifecycle_state === "active" && resumed.clock_version === 4, "resume restarts only the current paused clock", resumed);
  const persisted = callOperation(main, OWNER, operation({ id: "persist-clock", game: "lifecycle-game", base: 4, status: 3, command: "persist_position" }));
  check(persisted.outcome === "accepted" && persisted.clock_version === 5, "persist position re-anchors authoritative elapsed time", persisted);
  const pausedAgain = callOperation(main, OWNER, operation({ id: "pause-again", game: "lifecycle-game", base: 5, status: 3, command: "pause" }));
  assert.equal(pausedAgain.outcome, "accepted");
  const advanced = callOperation(main, OWNER, operation({ id: "advance-period", game: "lifecycle-game", base: 6, status: 4, lifecycle: "paused", command: "advance_period", args: { next_period: "Q2" } }));
  check(advanced.outcome === "accepted" && advanced.clock_state.current_period === "Q2" && advanced.clock_state.clock_seconds_remaining === 720, "advance period validates order and resets to the configured duration", advanced);
  const setRemaining = callOperation(main, OWNER, operation({ id: "set-clock", game: "lifecycle-game", base: 7, status: 4, lifecycle: "paused", command: "set_remaining", args: { clock_seconds_remaining: 333 } }));
  check(setRemaining.outcome === "accepted" && setRemaining.clock_state.clock_seconds_remaining === 333, "set remaining accepts a bounded current-base correction", setRemaining);
  const corrected = callOperation(main, OWNER, operation({ id: "correct-clock", game: "lifecycle-game", base: 8, status: 4, lifecycle: "paused", command: "correct_remaining", args: { clock_seconds_remaining: 321 } }));
  check(corrected.outcome === "accepted" && corrected.clock_state.clock_seconds_remaining === 321, "correct remaining retains an explicit immutable command", corrected);
  const completed = callOperation(main, OWNER, operation({ id: "complete-clock", game: "lifecycle-game", base: 9, status: 4, lifecycle: "paused", command: "complete" }));
  check(completed.outcome === "accepted" && completed.lifecycle_state === "completed" && completed.clock_state.is_running === false, "completion freezes clock and lifecycle atomically", completed);
  const afterComplete = callOperation(main, OWNER, operation({ id: "after-complete", game: "lifecycle-game", base: 10, status: 5, lifecycle: "completed", command: "start" }));
  check(afterComplete.code === "completed_game_clock_change_forbidden", "completed games reject later ordinary clock commands", afterComplete);

  const missingBaseRequest = operation({ id: "missing-base", game: "race-game", base: 1, command: "start" });
  delete missingBaseRequest.base_clock_version;
  const missingBase = callOperation(main, OWNER, missingBaseRequest);
  check(missingBase.code === "invalid_clock_operation", "missing clock base is rejected before mutation", missingBase);
  const missingLifecycleRequest = operation({ id: "missing-lifecycle", game: "race-game", base: 1, command: "start" });
  delete missingLifecycleRequest.expected_lifecycle;
  const missingLifecycle = callOperation(main, OWNER, missingLifecycleRequest);
  check(missingLifecycle.code === "invalid_clock_operation", "missing lifecycle base is rejected before mutation", missingLifecycle);
  const staleLifecycle = callOperation(main, OWNER, operation({ id: "stale-lifecycle", game: "race-game", base: 1, lifecycle: "paused", command: "start" }));
  check(staleLifecycle.code === "stale_lifecycle_state", "stale lifecycle base is rejected before clock mutation", staleLifecycle);

  const concurrentRequests = ["race-a", "race-b"].map((id) => operation({ id, game: "race-game", base: 1, command: "start", device: id }));
  const concurrentResults = await Promise.all(concurrentRequests.map((request) =>
    psqlConcurrent(main, `${claims(OWNER)} select public.lh_apply_game_clock_operation_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).then(parse)));
  check(concurrentResults.filter((item) => item.outcome === "accepted").length === 1
    && concurrentResults.filter((item) => item.outcome === "conflicted").length === 1,
  "concurrent start/start yields one commit and one bounded conflict", concurrentResults);
  check(psql(main, "select count(*) from public.game_clock_commands where game_id='race-game';").stdout === "1", "start/start creates no duplicate command evidence");

  const delayStart = callOperation(main, OWNER, operation({ id: "delay-start", game: "delay-game", base: 1, command: "start" }));
  assert.equal(delayStart.outcome, "accepted");
  const delayedPause = callOperation(main, OWNER, operation({ id: "delay-pause", game: "delay-game", base: 1, command: "pause" }));
  check(delayedPause.outcome === "conflicted" && delayedPause.code === "clock_conflict", "delayed stale pause cannot rewrite authoritative elapsed time", delayedPause);
  const replay = callOperation(main, OWNER, operation({ id: "delay-start", game: "delay-game", base: 1, command: "start" }));
  check(replay.replay === true && replay.clock_version === delayStart.clock_version, "timeout-after-commit identical replay returns the stable stored receipt", replay);
  const mismatch = callOperation(main, OWNER, operation({ id: "delay-start", game: "delay-game", base: 1, command: "pause" }));
  check(mismatch.code === "duplicate_operation_id_payload_mismatch", "same command ID with changed payload is rejected deterministically", mismatch);

  const successBatch = batch({
    id: "offline-success", game: "batch-game", base: 1, commands: [
      command({ id: "offline-start", lifecycle: "active", command: "start" }),
      command({ id: "offline-pause", lifecycle: "active", command: "pause", occurred: "2026-08-10T12:00:05Z" }),
      command({ id: "offline-resume", lifecycle: "paused", command: "resume", occurred: "2026-08-10T12:00:06Z" }),
    ],
  });
  const batchAccepted = callBatch(main, OWNER, successBatch);
  check(batchAccepted.outcome === "accepted" && batchAccepted.receipts.length === 3 && batchAccepted.clock_version === 4, "unchanged-base offline batch applies in semantic order with one revision per command", batchAccepted);
  const batchReplay = callBatch(main, OWNER, successBatch);
  check(batchReplay.replay === true && batchReplay.receipts.length === 3
    && psql(main, "select count(*) from public.game_clock_commands where game_id='batch-game';").stdout === "3",
  "identical batch replay returns stored receipts without duplicate mutations", batchReplay);

  callOperation(main, OWNER, operation({ id: "remote-batch-start", game: "batch-conflict", base: 1, command: "start" }));
  const conflictBatch = batch({
    id: "offline-conflict", game: "batch-conflict", base: 1, commands: [
      command({ id: "offline-conflict-start", lifecycle: "active", command: "start" }),
      command({ id: "offline-conflict-pause", lifecycle: "active", command: "pause" }),
    ],
  });
  const batchConflict = callBatch(main, OWNER, conflictBatch);
  check(batchConflict.outcome === "conflicted" && batchConflict.receipts.length === 0, "changed-base offline batch conflicts as one atomic unit", batchConflict);
  check(psql(main, "select count(*) from public.game_sync_operations where client_operation_id in ('offline-conflict-start','offline-conflict-pause');").stdout === "0", "base conflict applies no command prefix or receipt evidence");

  const invalidBatch = batch({
    id: "offline-invalid", game: "batch-invalid", base: 1, commands: [
      command({ id: "invalid-first", lifecycle: "active", command: "start" }),
      command({ id: "invalid-second", lifecycle: "active", command: "start" }),
    ],
  });
  const invalidResult = callBatch(main, OWNER, invalidBatch);
  check(invalidResult.outcome === "rejected" && invalidResult.batch_atomic === true, "invalid command rejects the complete batch atomically", invalidResult);
  check(psql(main, "select revision||'|'||is_running::text from public.lh_game_clock_states where game_id='batch-invalid';").stdout === "1|false"
    && psql(main, "select count(*) from public.game_sync_operations where client_operation_id in ('invalid-first','invalid-second','offline-invalid');").stdout === "0",
  "atomic batch failure rolls back state, command identity, receipts, and evidence");

  const partialReplay = callBatch(main, OWNER, batch({
    id: "mixed-batch", game: "delay-game", base: 2, commands: [
      command({ id: "delay-start", lifecycle: "active", command: "start" }),
      command({ id: "mixed-new", lifecycle: "active", command: "pause" }),
    ],
  }));
  check(partialReplay.code === "clock_batch_partial_replay_mismatch", "partial duplicate/new batch mixtures fail closed", partialReplay);

  const onePrefix = batch({
    id: "p1-one-batch", game: "p1-prefix-one", base: 1, commands: [
      command({ id: "p1-one-a", lifecycle: "active", command: "start", occurred: "2026-08-10T12:10:00Z" }),
    ],
  });
  const onePrefixAccepted = callBatch(main, OWNER, onePrefix);
  const onePrefixExtended = callBatch(main, OWNER, batch({
    id: "p1-one-batch", game: "p1-prefix-one", base: 1, commands: [
      ...onePrefix.commands,
      command({ id: "p1-one-b", lifecycle: "active", command: "pause", occurred: "2026-08-10T12:10:05Z" }),
    ],
  }));
  p1Check(onePrefixAccepted.clock_version === 2
    && onePrefixExtended.outcome === "accepted"
    && onePrefixExtended.clock_version === 3
    && onePrefixExtended.clock_state.clock_seconds_remaining === 715
    && onePrefixExtended.receipts[0].replay === true,
  "exact one-command prefix replays and one new suffix commits without duplicate mutation", { onePrefixAccepted, onePrefixExtended });

  const multiPrefix = batch({
    id: "p1-multi-batch", game: "p1-prefix-multi", base: 1, commands: [
      command({ id: "p1-multi-a", lifecycle: "active", command: "start", occurred: "2026-08-10T12:20:00Z" }),
      command({ id: "p1-multi-b", lifecycle: "active", command: "pause", occurred: "2026-08-10T12:20:05Z" }),
    ],
  });
  const multiPrefixAccepted = callBatch(main, OWNER, multiPrefix);
  const multiExtendedRequest = batch({
    id: "p1-multi-batch", game: "p1-prefix-multi", base: 1, commands: [
      ...multiPrefix.commands,
      command({ id: "p1-multi-c", lifecycle: "paused", command: "resume", occurred: "2026-08-10T12:20:06Z" }),
      command({ id: "p1-multi-d", lifecycle: "active", command: "pause", occurred: "2026-08-10T12:20:10Z" }),
    ],
  });
  const multiExtended = callBatch(main, OWNER, multiExtendedRequest);
  p1Check(multiPrefixAccepted.clock_state.clock_seconds_remaining === 715
    && multiExtended.outcome === "accepted"
    && multiExtended.clock_version === 5
    && multiExtended.clock_state.clock_seconds_remaining === 711
    && multiExtended.receipts.length === 4
    && multiExtended.receipts.slice(0, 2).every((receipt) => receipt.replay === true),
  "exact multi-command prefix replays and multi-command suffix preserves both elapsed intervals", { multiPrefixAccepted, multiExtended });

  const initialReplayAfterExtension = callBatch(main, OWNER, multiPrefix);
  const extendedReplayAfterTimeout = callBatch(main, OWNER, multiExtendedRequest);
  p1Check(initialReplayAfterExtension.replay === true
    && initialReplayAfterExtension.clock_version === 3
    && extendedReplayAfterTimeout.replay === true
    && extendedReplayAfterTimeout.clock_version === 5
    && extendedReplayAfterTimeout.clock_state.clock_seconds_remaining === 711,
  "full replay and timeout-after-extension replay return their exact immutable canonical results", { initialReplayAfterExtension, extendedReplayAfterTimeout });

  const changedPrefix = callBatch(main, OWNER, batch({
    id: "p1-multi-batch", game: "p1-prefix-multi", base: 1, commands: [
      command({ id: "p1-multi-a", lifecycle: "active", command: "start", args: { unexpected: true }, occurred: "2026-08-10T12:20:00Z" }),
      ...multiExtendedRequest.commands.slice(1),
      command({ id: "p1-multi-e", lifecycle: "paused", command: "resume", occurred: "2026-08-10T12:20:11Z" }),
    ],
  }));
  p1Check(changedPrefix.code === "duplicate_operation_id_payload_mismatch",
    "changed semantic payload inside a committed prefix is rejected", changedPrefix);

  const reorderedPrefix = callBatch(main, OWNER, batch({
    id: "p1-multi-batch", game: "p1-prefix-multi", base: 1, commands: [
      { ...multiExtendedRequest.commands[1], client_occurred_at: "2026-08-10T12:20:00Z" },
      { ...multiExtendedRequest.commands[0], client_occurred_at: "2026-08-10T12:20:05Z" },
      ...multiExtendedRequest.commands.slice(2),
      command({ id: "p1-multi-f", lifecycle: "paused", command: "resume", occurred: "2026-08-10T12:20:11Z" }),
    ],
  }));
  p1Check(reorderedPrefix.code === "duplicate_operation_id_payload_mismatch",
    "reordered committed prefix is rejected", reorderedPrefix);

  const missingPrefix = callBatch(main, OWNER, batch({
    id: "p1-multi-batch", game: "p1-prefix-multi", base: 1, commands: [
      multiExtendedRequest.commands[0], multiExtendedRequest.commands[1],
      multiExtendedRequest.commands[2],
    ],
  }));
  p1Check(missingPrefix.code === "duplicate_operation_id_payload_mismatch",
    "omitting a committed prefix command is rejected", missingPrefix);

  const interleavedPrefix = callBatch(main, OWNER, batch({
    id: "p1-multi-batch", game: "p1-prefix-multi", base: 1, commands: [
      multiExtendedRequest.commands[0],
      command({ id: "p1-interleaved", lifecycle: "active", command: "pause", occurred: "2026-08-10T12:20:04Z" }),
      ...multiExtendedRequest.commands.slice(1),
    ],
  }));
  p1Check(interleavedPrefix.outcome === "rejected"
    && ["clock_batch_partial_replay_mismatch", "duplicate_operation_id_payload_mismatch"].includes(interleavedPrefix.code),
    "duplicate/new interleaving inside the committed prefix is rejected", interleavedPrefix);

  const wrongSuffixBase = callBatch(main, OWNER, batch({
    id: "p1-multi-batch", game: "p1-prefix-multi", base: 2, commands: [
      ...multiExtendedRequest.commands,
      command({ id: "p1-wrong-base", lifecycle: "paused", command: "resume", occurred: "2026-08-10T12:20:11Z" }),
    ],
  }));
  p1Check(wrongSuffixBase.code === "duplicate_operation_id_payload_mismatch",
    "suffix with a changed original batch base is rejected", wrongSuffixBase);

  p1Check(psql(main, "select count(*) from public.game_clock_commands where game_id='p1-prefix-multi';").stdout === "4"
    && psql(main, "select count(*) from public.game_clock_batches where game_id='p1-prefix-multi';").stdout === "2"
    && psql(main, "select count(distinct operation_id) from public.game_clock_commands where game_id='p1-prefix-multi';").stdout === "4",
  "prefix extension creates no duplicate command receipts or evidence");

  const periodChronology = callBatch(main, OWNER, batch({
    id: "p1-period-batch", game: "p1-period", base: 1, commands: [
      command({ id: "p1-period-start", lifecycle: "active", command: "start", occurred: "2026-08-10T12:30:00Z" }),
      command({ id: "p1-period-pause", lifecycle: "active", command: "pause", occurred: "2026-08-10T12:30:05Z" }),
      command({ id: "p1-period-advance", lifecycle: "paused", command: "advance_period", args: { next_period: "Q2" }, occurred: "2026-08-10T12:30:06Z" }),
    ],
  }));
  p1Check(periodChronology.outcome === "accepted"
    && periodChronology.clock_state.current_period === "Q2"
    && periodChronology.clock_state.clock_seconds_remaining === 720
    && psql(main, "select clock_seconds_remaining from public.game_clock_commands where game_id='p1-period' and command='pause';").stdout === "715",
  "period advance preserves the elapsed prior-period interval before the bounded reset", periodChronology);

  const completionChronology = callBatch(main, OWNER, batch({
    id: "p1-complete-batch", game: "p1-complete", base: 1, commands: [
      command({ id: "p1-complete-start", lifecycle: "active", command: "start", occurred: "2026-08-10T12:40:00Z" }),
      command({ id: "p1-complete-end", lifecycle: "active", command: "complete", occurred: "2026-08-10T12:40:07Z" }),
    ],
  }));
  p1Check(completionChronology.outcome === "accepted"
    && completionChronology.lifecycle_state === "completed"
    && completionChronology.clock_state.is_running === false
    && completionChronology.clock_state.clock_seconds_remaining === 713,
  "completion preserves bounded offline elapsed time and freezes the canonical clock", completionChronology);

  const reversedChronology = callBatch(main, OWNER, batch({
    id: "p1-reversed-batch", game: "p1-reversed", base: 1, commands: [
      command({ id: "p1-reversed-start", lifecycle: "active", command: "start", occurred: "2026-08-10T12:50:05Z" }),
      command({ id: "p1-reversed-pause", lifecycle: "active", command: "pause", occurred: "2026-08-10T12:50:00Z" }),
    ],
  }));
  p1Check(reversedChronology.code === "clock_chronology_needs_review"
    && psql(main, "select revision||'|'||is_running::text from public.lh_game_clock_states where game_id='p1-reversed';").stdout === "1|false"
    && psql(main, "select count(*) from public.game_clock_commands where game_id='p1-reversed';").stdout === "0",
  "reversed offline chronology fails closed with zero mutation", reversedChronology);

  const excessiveGap = callBatch(main, OWNER, batch({
    id: "p1-gap-batch", game: "p1-gap", base: 1, commands: [
      command({ id: "p1-gap-start", lifecycle: "active", command: "start", occurred: "2026-08-10T13:00:00Z" }),
      command({ id: "p1-gap-pause", lifecycle: "active", command: "pause", occurred: "2026-08-10T13:00:31Z" }),
    ],
  }));
  p1Check(excessiveGap.code === "clock_chronology_needs_review"
    && psql(main, "select revision||'|'||is_running::text from public.lh_game_clock_states where game_id='p1-gap';").stdout === "1|false",
  "offline chronology beyond the approved 30-second certainty bound applies zero commands", excessiveGap);

  psql(main, "update public.lh_game_clock_states set clock_seconds_remaining=3,anchor_clock_seconds_remaining=3 where game_id='p1-boundary';");
  const completionBoundary = callBatch(main, OWNER, batch({
    id: "p1-boundary-batch", game: "p1-boundary", base: 1, commands: [
      command({ id: "p1-boundary-start", lifecycle: "active", command: "start", occurred: "2026-08-10T13:10:00Z" }),
      command({ id: "p1-boundary-pause", lifecycle: "active", command: "pause", occurred: "2026-08-10T13:10:05Z" }),
    ],
  }));
  p1Check(completionBoundary.code === "clock_chronology_needs_review"
    && completionBoundary.batch_atomic === true
    && psql(main, "select revision||'|'||clock_seconds_remaining||'|'||is_running::text from public.lh_game_clock_states where game_id='p1-boundary';").stdout === "1|3|false"
    && psql(main, "select count(*) from public.game_sync_operations where client_operation_id in ('p1-boundary-start','p1-boundary-pause');").stdout === "0",
  "elapsed chronology crossing the clock boundary rolls back the complete batch", completionBoundary);

  p1Check(batchConflict.outcome === "conflicted"
    && psql(main, "select count(*) from public.game_clock_commands where game_id='batch-conflict';").stdout === "1",
  "changed server base continues to apply zero offline batch commands", batchConflict);

  const MAX_SAFE_REVISION = 9007199254740991n;
  psql(main, `update public.lh_game_clock_states set revision=${MAX_SAFE_REVISION - 1n} where game_id='p1-ceiling-single';`);
  const reachesCeiling = callOperation(main, OWNER, operation({
    id: "p1-ceiling-start", game: "p1-ceiling-single", base: Number(MAX_SAFE_REVISION - 1n), command: "start",
  }));
  const ceilingReplay = callOperation(main, OWNER, operation({
    id: "p1-ceiling-start", game: "p1-ceiling-single", base: Number(MAX_SAFE_REVISION - 1n), command: "start",
  }));
  p1Check(reachesCeiling.outcome === "accepted"
    && BigInt(reachesCeiling.clock_version) === MAX_SAFE_REVISION
    && ceilingReplay.replay === true
    && BigInt(ceilingReplay.clock_version) === MAX_SAFE_REVISION,
  "one command may reach MAX_SAFE_INTEGER and exact replay at the ceiling consumes no revision", { reachesCeiling, ceilingReplay });

  const beyondCeiling = callOperation(main, OWNER, operation({
    id: "p1-ceiling-pause", game: "p1-ceiling-single", base: Number(MAX_SAFE_REVISION), command: "pause",
  }));
  p1Check(beyondCeiling.code === "clock_revision_exhausted"
    && psql(main, "select revision||'|'||is_running::text from public.lh_game_clock_states where game_id='p1-ceiling-single';").stdout === `${MAX_SAFE_REVISION}|true`
    && psql(main, "select count(*) from public.game_sync_operations where client_operation_id='p1-ceiling-pause';").stdout === "0",
  "command requiring MAX_SAFE_INTEGER plus one rejects before state, receipt, or evidence mutation", beyondCeiling);

  psql(main, `update public.lh_game_clock_states set revision=${MAX_SAFE_REVISION - 1n} where game_id='p1-ceiling-batch';`);
  const crossingBatch = callBatch(main, OWNER, batch({
    id: "p1-ceiling-batch-id", game: "p1-ceiling-batch", base: Number(MAX_SAFE_REVISION - 1n), commands: [
      command({ id: "p1-ceiling-batch-start", lifecycle: "active", command: "start", occurred: "2026-08-10T13:20:00Z" }),
      command({ id: "p1-ceiling-batch-pause", lifecycle: "active", command: "pause", occurred: "2026-08-10T13:20:01Z" }),
    ],
  }));
  p1Check(crossingBatch.code === "clock_revision_exhausted"
    && psql(main, "select revision||'|'||is_running::text from public.lh_game_clock_states where game_id='p1-ceiling-batch';").stdout === `${MAX_SAFE_REVISION - 1n}|false`
    && psql(main, "select count(*) from public.game_sync_operations where client_operation_id in ('p1-ceiling-batch-start','p1-ceiling-batch-pause','p1-ceiling-batch-id');").stdout === "0",
  "batch crossing the safe revision ceiling is rejected in full before its first command", crossingBatch);

  psql(main, `update public.lh_game_clock_states set revision=${MAX_SAFE_REVISION - 1n} where game_id='p1-ceiling-prefix';`);
  const ceilingPrefixRequest = batch({
    id: "p1-ceiling-prefix-id", game: "p1-ceiling-prefix", base: Number(MAX_SAFE_REVISION - 1n), commands: [
      command({ id: "p1-ceiling-prefix-start", lifecycle: "active", command: "start", occurred: "2026-08-10T13:30:00Z" }),
    ],
  });
  const ceilingPrefixAccepted = callBatch(main, OWNER, ceilingPrefixRequest);
  const ceilingSuffixRejected = callBatch(main, OWNER, batch({
    id: "p1-ceiling-prefix-id", game: "p1-ceiling-prefix", base: Number(MAX_SAFE_REVISION - 1n), commands: [
      ...ceilingPrefixRequest.commands,
      command({ id: "p1-ceiling-prefix-pause", lifecycle: "active", command: "pause", occurred: "2026-08-10T13:30:01Z" }),
    ],
  }));
  p1Check(BigInt(ceilingPrefixAccepted.clock_version) === MAX_SAFE_REVISION
    && ceilingSuffixRejected.code === "clock_revision_exhausted"
    && psql(main, "select count(*) from public.game_clock_commands where game_id='p1-ceiling-prefix';").stdout === "1"
    && psql(main, "select count(*) from public.game_sync_operations where client_operation_id='p1-ceiling-prefix-pause';").stdout === "0",
  "exact prefix replay plus a suffix crossing the ceiling rejects the suffix atomically", { ceilingPrefixAccepted, ceilingSuffixRejected });

  const unauthorized = callOperation(main, OTHER, operation({ id: "unauthorized-clock", game: "unauthorized-game", base: 1, command: "start" }));
  check(unauthorized.code === "authorization_denied" && Object.keys(unauthorized).sort().join(",") === "code,outcome", "unrelated personal account receives non-enumerating authorization denial", unauthorized);

  psql(main, `
    insert into public.teams(id,name,invite_code,created_by) values ('team-clock','Synthetic Adult Team','CLOCKT01','${OWNER}');
    insert into public.team_members(id,team_id,user_id,role) values ('member-clock','team-clock','${TRACKER}','member');
    insert into public.roster_players(id,team_id,name,number) values ('roster-clock','team-clock','Synthetic Adult','00');
    insert into public.player_claims(id,team_id,roster_player_id,user_id) values ('claim-clock','team-clock','roster-clock','${TRACKER}');
    ${gameInsert("team-clock-game", OWNER, ",'team-clock','roster-clock'")}
    insert into public.lh_team_scopes(team_id,team_name_snapshot)
      values ('team-clock','Synthetic Adult Team');
    insert into public.lh_player_scopes(team_id,roster_player_id,player_name_snapshot,jersey_snapshot)
      values ('team-clock','roster-clock','Synthetic Adult','00');
    insert into public.lh_game_scopes(game_id,team_id,roster_player_id,opponent_snapshot,game_date_snapshot)
      values ('team-clock-game','team-clock','roster-clock','Synthetic Adult Opponent','2026-08-10');
    ${clockInsert("team-clock-game", OWNER, { team: "team-clock", roster: "roster-clock" })}
  `);
  const teamAccepted = callOperation(main, TRACKER, operation({ id: "team-clock-start", game: "team-clock-game", base: 1, command: "start" }));
  psql(main, "delete from public.player_claims where id='claim-clock';");
  const teamRevokedReplay = callOperation(main, TRACKER, operation({ id: "team-clock-start", game: "team-clock-game", base: 1, command: "start" }));
  check(teamAccepted.outcome === "accepted" && teamRevokedReplay.code === "authorization_denied", "current team tracker may write but revoked authority blocks replay disclosure", { teamAccepted, teamRevokedReplay });
  const copiedOwner = callOperation(main, OWNER, operation({ id: "team-copied-owner", game: "team-clock-game", base: 2, command: "pause" }));
  check(copiedOwner.code === "authorization_denied", "copied team-game owner identity is insufficient authority", copiedOwner);

  psql(main, `
    ${gameInsert("deleted-clock-game")}
    insert into public.legacy_game_tombstones(game_id,owner_user_id,deleted_by,deletion_id,device_id,deleted_at)
      values ('deleted-clock-game','${OWNER}','${OWNER}','deleted-clock','synthetic-device',statement_timestamp());
  `);
  const tombstoned = callOperation(main, OWNER, operation({ id: "deleted-clock-command", game: "deleted-clock-game", base: 1, command: "start" }));
  const tombstoneOther = callOperation(main, OTHER, operation({ id: "deleted-clock-probe", game: "deleted-clock-game", base: 1, command: "start" }));
  check(tombstoned.code === "game_deleted" && tombstoneOther.code === "authorization_denied"
    && psql(main, "select count(*) from public.lh_game_clock_states where game_id='deleted-clock-game';").stdout === "0",
  "tombstone precedence prevents clock recreation without disclosing private deletion details", { tombstoned, tombstoneOther });

  const independentResults = await Promise.all([
    operation({ id: "independent-start-a", game: "independent-a", base: 1, command: "start" }),
    operation({ id: "independent-start-b", game: "independent-b", base: 1, command: "start" }),
  ].map((request) => psqlConcurrent(main, `${claims(OWNER)} select public.lh_apply_game_clock_operation_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).then(parse)));
  check(independentResults.every((item) => item.outcome === "accepted"), "unrelated games proceed independently under the universal lock order", independentResults);

  const injectedRequest = operation({ id: "atomic-injected", game: "atomic-game", base: 1, command: "start" });
  const injected = psql(main, `select set_config('request.jwt.claims', '{"sub":"${OWNER}","role":"authenticated"}', false); select lh_sync_private.r207_apply_clock_operation($json$${JSON.stringify(injectedRequest)}$json$::jsonb,true);`, true);
  check(injected.status !== 0 && /r207_clock_injected_atomicity_failure/.test(injected.stderr)
    && psql(main, "select revision||'|'||is_running::text from public.lh_game_clock_states where game_id='atomic-game';").stdout === "1|false"
    && psql(main, "select count(*) from public.game_sync_operations where client_operation_id='atomic-injected';").stdout === "0",
  "injected failure rolls back state, operation identity, receipt, and evidence together");

  const directAcl = psql(main, "select has_table_privilege('authenticated','public.game_clock_batches','select')::text||','||has_table_privilege('anon','public.game_clock_batches','select')::text;").stdout;
  check(directAcl === "false,false"
    && psql(main, "select relrowsecurity::text||','||relforcerowsecurity::text from pg_class where oid='public.game_clock_batches'::regclass;").stdout === "true,true",
  "batch and command evidence remain private behind forced RLS and explicit grants");
  const commandGrant = psql(main, "select has_function_privilege('authenticated','public.lh_apply_game_clock_operation_v2(jsonb)','execute')::text||','||has_function_privilege('anon','public.lh_apply_game_clock_operation_v2(jsonb)','execute')::text;").stdout;
  check(commandGrant === "true,false", "only authenticated callers receive public clock RPC execution grants");

  psql(main, "update public.r207_preview_control set preview_enabled=false where control_id;");
  const rollbackRefusal = psql(main, read("rollback", rollbackFile), true);
  check(rollbackRefusal.status !== 0 && /clock rollback refused/.test(rollbackRefusal.stderr), "rollback refuses after immutable clock command/batch evidence exists");

  const empty = await start("empty");
  psql(empty, read("rollback", rollbackFile));
  check(psql(empty, "select to_regclass('public.game_clock_batches') is null;").stdout === "t"
    && psql(empty, `${claims(OWNER)} select public.lh_apply_game_clock_operation_v2('{}'::jsonb)->>'code'; reset role;`).stdout.split(/\r?\n/).at(-1) === "r207_not_activated",
  "zero-evidence rollback restores dormant wrappers and removes only additive batch schema");

  console.log(`R2-07 clock P1 remediation adversarial matrix: ${p1Checks}/${p1Checks} passed`);
  console.log(`R2-07 clock command/batch server matrix: ${checks}/${checks} passed`);
} finally {
  for (const container of containers) docker(["rm", "-f", container], { allowFailure: true });
  const residue = docker(["ps", "-a", "--filter", "name=laxhornet-r207clock-", "--format", "{{.Names}}"], { allowFailure: true }).stdout.trim();
  assert.equal(residue, "", `R2-07 clock container residue: ${residue}`);
}
