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
  "20260812005627_atomic_scored_event_command.sql",
];
const rollbackFile = "20260812005627_atomic_scored_event_command_rollback.sql";
const OWNER = "00000000-0000-4000-8000-00000000000a";
const OTHER = "00000000-0000-4000-8000-00000000000b";
const containers = new Set();
let checks = 0;

const read = (folder, file) => fs.readFileSync(path.join(root, "supabase", folder, file), "utf8");
const check = (condition, label, details = null) => {
  assert.ok(condition, details ? `${label}: ${JSON.stringify(details)}` : label);
  checks += 1;
  console.log(`PASS: ${label}`);
};

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    timeout: 180_000,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${result.stdout || ""}\n${result.stderr || ""}`);
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

function psqlAsync(container, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
      "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    ], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status === 0) resolve(stdout.trim());
      else reject(new Error(`${stdout}\n${stderr}`));
    });
    child.stdin.end(sql);
  });
}

const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create table auth.users(
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema auth, extensions to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
create publication supabase_realtime;
${migrations.map((file) => read("migrations", file)).join("\n")}
${read("", "seed.sql")}
`;

async function start(name) {
  const container = `laxhornet-lh25-${name}-${process.pid}`;
  containers.add(container);
  docker([
    "run", "-d", "--rm", "--name", container,
    "-e", "POSTGRES_PASSWORD=synthetic-only", "postgres:17-alpine",
  ]);
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

const claims = (actor) => `
select set_config('request.jwt.claims', '{"sub":"${actor}","role":"authenticated"}', false);
set role authenticated;
`;
const parse = (text) => JSON.parse(text.split(/\r?\n/).reverse().find((line) => line.startsWith("{")));
const event = (overrides = {}) => ({
  timestamp: "2026-08-12T01:00:00Z",
  quarter: "Q1",
  stat_type: "goal",
  stat_label: "Goal",
  category: "Offense",
  point_value: 1,
  tags: [],
  note: "",
  field_zone: "",
  corrected_at: null,
  tags_updated_at: null,
  ...overrides,
});
const operation = ({
  id,
  eventId,
  action = "create",
  changes = event(),
  eventVersion = 0,
  scoreVersion = 1,
  statusVersion = 1,
  lifecycle = "active",
  gameId = "game-a",
}) => ({
  client_operation_id: id,
  game_id: gameId,
  event_id: eventId,
  action,
  changes: action === "tombstone" ? {} : changes,
  base_event_version: eventVersion,
  base_score_version: scoreVersion,
  base_status_version: statusVersion,
  expected_game_lifecycle: lifecycle,
  client_created_at: "2026-08-12T01:00:00Z",
});
const sqlCall = (actor, request) => `
${claims(actor)}
select public.laxhornet_apply_scored_event_v1($json$${JSON.stringify(request)}$json$::jsonb)::text;
reset role;
`;
const call = (container, actor, request) => parse(psql(container, sqlCall(actor, request)).stdout);
const gameState = (container, gameId = "game-a") => psql(
  container,
  `select score_for||'|'||score_against||'|'||score_version||'|'||status_version from public.games where id='${gameId}';`,
).stdout;

try {
  const main = await start("main");
  psql(main, `
    insert into auth.users(id,email) values
      ('${OWNER}','owner@example.invalid'),
      ('${OTHER}','other@example.invalid');
    insert into public.games(
      id,user_id,share_code,opponent,game_date,status,lifecycle_state,
      score_for,score_against,score_known
    ) values
      ('game-a','${OWNER}','LH25GAMEA','Synthetic A','2026-08-12','in-progress','active',0,0,true),
      ('game-race','${OWNER}','LH25RACE','Synthetic Race','2026-08-12','in-progress','active',0,0,true),
      ('game-complete','${OWNER}','LH25DONE','Synthetic Complete','2026-08-12','complete','completed',2,1,true);
  `);

  const createdRequest = operation({ id: "atomic-create-a", eventId: "event-a" });
  const created = call(main, OWNER, createdRequest);
  check(created.outcome === "accepted" && created.code === "scored_event_created", "scored-event create is accepted", created);
  check(gameState(main) === "1|0|2|1", "Goal increments the canonical score exactly once");
  check(psql(main, "select stat_type||'|'||server_event_version from public.events where id='event-a';").stdout === "goal|1", "Goal creates one versioned event head");
  check(psql(main, "select count(*) from public.atomic_scored_event_operations where client_operation_id='atomic-create-a' and outcome_class='accepted';").stdout === "1", "accepted parent receipt is durable");

  const replay = call(main, OWNER, createdRequest);
  check(replay.replay === true && gameState(main) === "1|0|2|1", "lost-response replay returns the receipt without duplicate score");
  check(psql(main, "select count(*) from public.events where id='event-a';").stdout === "1", "lost-response replay creates no duplicate event");

  const tampered = call(main, OWNER, { ...createdRequest, changes: event({ note: "tamper" }) });
  check(tampered.code === "duplicate_operation_id_payload_mismatch" && gameState(main) === "1|0|2|1", "same parent ID with changed payload is rejected");
  check(psql(main, "select count(*) from public.atomic_scored_event_operation_attempts where attempt_code='duplicate_operation_id_payload_mismatch';").stdout === "1", "tamper attempt is append-only evidence");

  const unauthorized = call(main, OTHER, operation({ id: "atomic-unauthorized", eventId: "event-private", scoreVersion: 2 }));
  check(unauthorized.code === "authorization_denied" && Object.keys(unauthorized).sort().join(",") === "code,outcome", "unauthorized request is non-enumerating");
  check(psql(main, "select count(*) from public.atomic_scored_event_operations where client_operation_id='atomic-unauthorized';").stdout === "0", "unauthorized request creates no parent evidence");

  const stale = call(main, OWNER, operation({ id: "atomic-stale", eventId: "event-stale", scoreVersion: 1 }));
  check(stale.code === "stale_score_version" && psql(main, "select count(*) from public.events where id='event-stale';").stdout === "0", "stale score base conflicts before event mutation");

  const injectedAfterEventRequest = operation({ id: "atomic-fail-event", eventId: "event-fail-event", scoreVersion: 2 });
  const injectedAfterEvent = parse(psql(main, `
    reset role;
    select set_config('request.jwt.claims', '{"sub":"${OWNER}","role":"authenticated"}', false);
    select lh_sync_private.r207_apply_atomic_scored_event(
      $json$${JSON.stringify(injectedAfterEventRequest)}$json$::jsonb, true, false
    )::text;
  `).stdout);
  check(injectedAfterEvent.code === "injected_after_event", "injected post-event failure returns a bounded rejection");
  check(gameState(main) === "1|0|2|1"
    && psql(main, "select count(*) from public.events where id='event-fail-event';").stdout === "0"
    && psql(main, "select count(*) from public.legacy_event_sync_operations where client_operation_id='atomic-fail-event:event';").stdout === "0",
  "post-event failure rolls back event, score, and child journal");

  const injectedAfterScoreRequest = operation({ id: "atomic-fail-score", eventId: "event-fail-score", scoreVersion: 2 });
  const injectedAfterScore = parse(psql(main, `
    reset role;
    select set_config('request.jwt.claims', '{"sub":"${OWNER}","role":"authenticated"}', false);
    select lh_sync_private.r207_apply_atomic_scored_event(
      $json$${JSON.stringify(injectedAfterScoreRequest)}$json$::jsonb, false, true
    )::text;
  `).stdout);
  check(injectedAfterScore.code === "injected_after_score", "injected post-score failure returns a bounded rejection");
  check(gameState(main) === "1|0|2|1"
    && psql(main, "select count(*) from public.events where id='event-fail-score';").stdout === "0"
    && psql(main, "select count(*) from public.game_sync_operations where client_operation_id='atomic-fail-score:score';").stdout === "0",
  "post-score failure rolls back both canonical heads and child journals");

  const corrected = call(main, OWNER, operation({
    id: "atomic-correct-a",
    eventId: "event-a",
    action: "correct",
    changes: { stat_type: "goalAllowed", stat_label: "Goal Allowed", category: "Defense" },
    eventVersion: 1,
    scoreVersion: 2,
  }));
  check(corrected.code === "scored_event_corrected" && gameState(main) === "0|1|3|1", "scoring-type correction applies one server-derived net delta", corrected);
  check(psql(main, "select stat_type||'|'||server_event_version from public.events where id='event-a';").stdout === "goalAllowed|2", "correction advances the canonical event version");

  const tombstoneRequest = operation({
    id: "atomic-tombstone-a",
    eventId: "event-a",
    action: "tombstone",
    eventVersion: 2,
    scoreVersion: 3,
  });
  const tombstoned = call(main, OWNER, tombstoneRequest);
  check(tombstoned.code === "scored_event_tombstoned" && gameState(main) === "0|0|4|1", "Undo tombstones the event and reverses its effect exactly once", tombstoned);
  check(psql(main, "select count(*) from public.events where id='event-a';").stdout === "0", "Undo leaves no effective event head");
  const tombstoneReplay = call(main, OWNER, tombstoneRequest);
  check(tombstoneReplay.replay === true && gameState(main) === "0|0|4|1", "repeated Undo cannot reverse score twice");

  const complete = call(main, OWNER, operation({
    id: "atomic-complete-create",
    eventId: "event-complete",
    scoreVersion: 1,
    lifecycle: "completed",
    gameId: "game-complete",
  }));
  check(complete.code === "completed_game_event_append_rejected"
    && gameState(main, "game-complete") === "2|1|1|1"
    && psql(main, "select count(*) from public.events where id='event-complete';").stdout === "0",
  "completed game rejects event append and score mutation together", complete);

  const raceA = operation({ id: "atomic-race-a", eventId: "event-race-a", gameId: "game-race" });
  const raceB = operation({ id: "atomic-race-b", eventId: "event-race-b", gameId: "game-race" });
  const raceResults = await Promise.all([
    psqlAsync(main, sqlCall(OWNER, raceA)).then(parse),
    psqlAsync(main, sqlCall(OWNER, raceB)).then(parse),
  ]);
  check(raceResults.filter((item) => item.outcome === "accepted").length === 1
    && raceResults.filter((item) => item.code === "stale_score_version").length === 1,
  "same-score-base concurrent events serialize to one accept and one explicit conflict", raceResults);
  check(gameState(main, "game-race") === "1|0|2|1"
    && psql(main, "select count(*) from public.events where game_id='game-race';").stdout === "1",
  "concurrent race leaves score and event cardinality consistent");

  const tableAcl = psql(main, "select has_table_privilege('authenticated','public.atomic_scored_event_operations','select')::text||','||has_table_privilege('anon','public.atomic_scored_event_operations','select')::text;").stdout;
  const functionAcl = psql(main, "select has_function_privilege('authenticated','public.laxhornet_apply_scored_event_v1(jsonb)','execute')::text||','||has_function_privilege('anon','public.laxhornet_apply_scored_event_v1(jsonb)','execute')::text;").stdout;
  check(tableAcl === "false,false" && functionAcl === "true,false", "history is private and only authenticated receives RPC execution");
  check(psql(main, "select relrowsecurity::text||','||relforcerowsecurity::text from pg_class where oid='public.atomic_scored_event_operations'::regclass;").stdout === "true,true", "parent operation history uses FORCE RLS");

  const rollbackRefusal = psql(main, read("rollback", rollbackFile), true);
  check(rollbackRefusal.status !== 0 && /LH25_ATOMIC_SCORED_EVENT_ROLLBACK_REFUSED/.test(rollbackRefusal.stderr), "rollback refuses after accepted immutable evidence");

  const empty = await start("empty");
  psql(empty, read("rollback", rollbackFile));
  check(psql(empty, "select to_regclass('public.atomic_scored_event_operations') is null and to_regprocedure('public.laxhornet_apply_scored_event_v1(jsonb)') is null;").stdout === "t", "zero-evidence rollback removes only the additive LH-25 surface");

  console.log(`LH-25 atomic scored-event PostgreSQL matrix: ${checks}/${checks} passed`);
} finally {
  for (const container of containers) docker(["rm", "-f", container], { allowFailure: true });
  const residue = docker(["ps", "-a", "--filter", "name=laxhornet-lh25-", "--format", "{{.Names}}"], { allowFailure: true }).stdout.trim();
  assert.equal(residue, "", `LH-25 container residue: ${residue}`);
}
