import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationFiles = [
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
];
const rollbackFile = "20260806143128_r207a_dormant_concurrency_foundation_rollback.sql";
const ACCOUNT_A = "00000000-0000-4000-8000-00000000000a";
const ACCOUNT_B = "00000000-0000-4000-8000-00000000000b";
const ACCOUNT_C = "00000000-0000-4000-8000-00000000000c";
const containers = new Set();
let checks = 0;

function check(condition, message, evidence = {}) {
  assert.ok(condition, `${message}\n${JSON.stringify(evidence, null, 2)}`);
  checks += 1;
  console.log(`PASS: ${message}`);
}

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout || 180000,
    input: options.input,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`docker ${args.join(" ")} failed\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return result;
}

function psql(container, sql, { allowFailure = false } = {}) {
  const result = docker(
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { input: sql, allowFailure },
  );
  result.stdout = result.stdout.trim();
  result.stderr = result.stderr.trim();
  return result;
}

function psqlAsync(container, sql) {
  const child = spawn(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(sql);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`concurrent psql failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

function source(folder, file) {
  return fs.readFileSync(path.join(root, "supabase", folder, file), "utf8");
}

function bootstrapSql(includeR207 = true) {
  const selected = includeR207 ? migrationFiles : migrationFiles.slice(0, -1);
  return `
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
${selected.map((file) => source("migrations", file)).join("\n")}
`;
}

async function startContainer(suffix, includeR207 = true) {
  const container = `laxhornet-r207a-${suffix}-${process.pid}`;
  containers.add(container);
  docker(["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=synthetic-only", "postgres:17-alpine"]);
  let ready = false;
  let consecutiveReady = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const probe = docker(["exec", container, "pg_isready", "-U", "postgres", "-d", "postgres"], { allowFailure: true, timeout: 5000 });
    if (probe.status === 0) {
      consecutiveReady += 1;
      if (consecutiveReady >= 3) { ready = true; break; }
    } else {
      consecutiveReady = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  check(ready, `${suffix} disposable PostgreSQL target became ready`);
  psql(container, bootstrapSql(includeR207));
  return container;
}

function claims(accountId, email = "synthetic@example.invalid") {
  return `select set_config('request.jwt.claims', '{"sub":"${accountId}","role":"authenticated","email":"${email}"}', false);`;
}

function asActor(accountId, sql) {
  return `${claims(accountId)}\n${sql}`;
}

function gameOperation({
  id,
  game,
  hash,
  type = "metadata_patch",
  group = "metadata",
  base = 1,
  fields = ["opponent"],
  changes = { opponent: "Changed" },
  expectedLifecycle,
  statusBase,
  correctionReason,
}) {
  const operation = {
    client_operation_id: id,
    game_id: game,
    request_hash: hash,
    operation_type: type,
    field_group: group,
    base_version: base,
    changed_fields: fields,
    changes,
  };
  if (expectedLifecycle !== undefined) operation.expected_lifecycle = expectedLifecycle;
  if (statusBase !== undefined) operation.status_base_version = statusBase;
  if (correctionReason !== undefined) operation.correction_reason = correctionReason;
  return operation;
}

function applyGame(accountId, operation, fail = false) {
  return asActor(accountId, `select lh_sync_private.r207_apply_game_operation_for_test($json$${JSON.stringify(operation)}$json$::jsonb, ${fail})::text;`);
}

function applyClock(accountId, operation) {
  return asActor(accountId, `select lh_sync_private.r207_apply_clock_operation_for_test($json$${JSON.stringify(operation)}$json$::jsonb)::text;`);
}

function jsonResult(output) {
  const line = output.split(/\r?\n/).reverse().find((value) => value.trim().startsWith("{"));
  assert.ok(line, `No JSON result found:\n${output}`);
  return JSON.parse(line);
}

function hash(character) {
  return character.repeat(64);
}

function seedSql() {
  return `
insert into auth.users(id, email) values
  ('${ACCOUNT_A}', 'a@example.invalid'),
  ('${ACCOUNT_B}', 'b@example.invalid'),
  ('${ACCOUNT_C}', 'c@example.invalid');
insert into public.games(id, user_id, share_code, opponent, game_date, status)
select id, owner, 'SHARE-' || id, 'Initial', date '2026-08-06', status
from (values
  ('same-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('cross-a', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('cross-b', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('payload-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('actor-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('actor-game-b', '${ACCOUNT_B}'::uuid, 'in-progress'),
  ('revoked-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('deleted-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('atomic-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('lock-game-a', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('lock-game-b', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('field-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('complete-game', '${ACCOUNT_A}'::uuid, 'complete'),
  ('clock-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('team-replay-game', '${ACCOUNT_A}'::uuid, 'in-progress'),
  ('wrong-account-game', '${ACCOUNT_A}'::uuid, 'in-progress')
) as fixture(id, owner, status);
update public.games set lifecycle_state = 'completed' where id = 'complete-game';
insert into public.lh_game_clock_states(
  game_id, owner_user_id, player_id, scope_type, period_format,
  regulation_period_duration_seconds, current_period, clock_seconds_remaining,
  client_updated_at, created_by_user_id
) values
  ('clock-game', '${ACCOUNT_A}', 'adult-synthetic', 'personal', 'quarters',
   720, 'Q1', 720, statement_timestamp(), '${ACCOUNT_A}'),
  ('complete-game', '${ACCOUNT_A}', 'adult-synthetic', 'personal', 'quarters',
   720, 'Q1', 0, statement_timestamp(), '${ACCOUNT_A}');
insert into public.teams(id, name, invite_code, created_by)
values ('team-r207', 'Synthetic Adult Team', 'TEAM-R207', '${ACCOUNT_A}');
insert into public.team_members(id, team_id, user_id, role) values
  ('member-r207', 'team-r207', '${ACCOUNT_B}', 'member'),
  ('untracked-r207', 'team-r207', '${ACCOUNT_C}', 'member');
insert into public.roster_players(id, team_id, name, number)
values ('roster-r207', 'team-r207', 'Synthetic Adult', '00');
insert into public.player_claims(id, team_id, roster_player_id, user_id)
values ('claim-r207', 'team-r207', 'roster-r207', '${ACCOUNT_B}');
insert into public.games(
  id, user_id, share_code, opponent, game_date, team_id, roster_player_id
) values (
  'team-game', '${ACCOUNT_A}', 'SHARE-team-game', 'Initial', date '2026-08-06',
  'team-r207', 'roster-r207'
);
update public.games set team_id='team-r207', roster_player_id='roster-r207'
where id='team-replay-game';
insert into public.legacy_game_tombstones(
  game_id, owner_user_id, team_id, roster_player_id, deleted_by,
  deletion_id, device_id, deleted_at
) values
  ('team-tombstone-owner', '${ACCOUNT_A}', 'team-r207', 'roster-r207', '${ACCOUNT_A}',
   'delete-team-owner', 'synthetic-device', statement_timestamp()),
  ('team-tombstone-untracked', '${ACCOUNT_A}', 'team-r207', 'roster-r207', '${ACCOUNT_A}',
   'delete-team-untracked', 'synthetic-device', statement_timestamp()),
  ('team-tombstone-authorized', '${ACCOUNT_A}', 'team-r207', 'roster-r207', '${ACCOUNT_A}',
   'delete-team-authorized', 'synthetic-device', statement_timestamp()),
  ('personal-tombstone', '${ACCOUNT_A}', null, null, '${ACCOUNT_A}',
   'delete-personal', 'synthetic-device', statement_timestamp());
`;
}

async function holdOperationIdentity(container, actor, clientId, milliseconds = 900) {
  return psqlAsync(container, `begin;
select pg_advisory_xact_lock(hashtextextended('laxhornet:r207-operation:${actor}:${clientId}', 0));
select pg_sleep(${milliseconds / 1000});
commit;`);
}

async function run() {
  const container = await startContainer("matrix");
  psql(container, seedSql());

  const backfill = jsonResult(psql(container, `select json_build_object(
    'legacy_versions', (select count(*) from public.games where game_revision = 1 and metadata_version = 1 and score_version = 1),
    'unknown_scores', (select count(*) from public.games where not score_known),
    'completed', (select lifecycle_state from public.games where id = 'complete-game'),
    'clock_type', (select data_type from information_schema.columns where table_schema='public' and table_name='lh_game_clock_states' and column_name='revision'),
    'retention_enabled', (select execution_enabled from public.r207_retention_control)
  )::text;`).stdout);
  check(backfill.legacy_versions === 17 && backfill.unknown_scores === 17, "populated v285-shaped games backfill to version 1 with unknown scores", backfill);
  check(backfill.completed === "completed" && backfill.clock_type === "bigint", "lifecycle mapping and bigint clock revision are exact", backfill);
  check(backfill.retention_enabled === false, "retention execution is structurally disabled", backfill);

  const dormant = jsonResult(psql(container, `${claims(ACCOUNT_A)} set role authenticated; select public.laxhornet_sync_game_v2('{}'::jsonb)::text; reset role;`).stdout);
  check(dormant.code === "r207_not_activated", "authenticated v2 game RPC remains dormant", dormant);
  const anon = psql(container, "set role anon; select public.laxhornet_sync_game_v2('{}'::jsonb);", { allowFailure: true });
  check(anon.status !== 0 && /permission denied/i.test(anon.stderr), "anonymous execution is denied");

  const identical = gameOperation({ id: "same-id", game: "same-game", hash: hash("a"), changes: { opponent: "Identical" } });
  const gate1 = holdOperationIdentity(container, ACCOUNT_A, "same-id");
  await new Promise((resolve) => setTimeout(resolve, 100));
  const sameResults = await Promise.all([
    psqlAsync(container, applyGame(ACCOUNT_A, identical)),
    psqlAsync(container, applyGame(ACCOUNT_A, identical)),
    gate1,
  ]);
  const sameJson = sameResults.slice(0, 2).map(jsonResult);
  check(sameJson.filter((value) => value.replay === false).length === 1 && sameJson.filter((value) => value.replay === true).length === 1, "case 1: identical concurrent first-seen requests yield one mutation and one replay", sameJson);
  const sameCounts = psql(container, "select game_revision || ',' || (select count(*) from public.game_sync_operations where client_operation_id='same-id') || ',' || (select count(*) from public.game_field_changes where game_id='same-game') from public.games where id='same-game';").stdout;
  check(sameCounts === "2,1,1", "cases 8-9: no uniqueness error and exactly one semantic mutation", { sameCounts });

  const crossA = gameOperation({ id: "cross-id", game: "cross-a", hash: hash("b"), changes: { opponent: "Cross A" } });
  const crossB = gameOperation({ id: "cross-id", game: "cross-b", hash: hash("c"), changes: { opponent: "Cross B" } });
  const gate2 = holdOperationIdentity(container, ACCOUNT_A, "cross-id");
  await new Promise((resolve) => setTimeout(resolve, 100));
  const crossResults = await Promise.all([
    psqlAsync(container, applyGame(ACCOUNT_A, crossA)),
    psqlAsync(container, applyGame(ACCOUNT_A, crossB)),
    gate2,
  ]);
  const crossJson = crossResults.slice(0, 2).map(jsonResult);
  check(crossJson.filter((value) => value.code === "duplicate_operation_id_scope_mismatch").length === 1, "case 2: same actor and operation ID across games has one bounded losing result", crossJson);
  check(!JSON.stringify(crossJson.find((value) => value.code === "duplicate_operation_id_scope_mismatch")).includes("cross-"), "case 7: cross-game mismatch discloses no canonical game identity", crossJson);
  const crossMutationCount = Number(psql(container, "select count(*) from public.games where id in ('cross-a','cross-b') and game_revision=2;").stdout);
  check(crossMutationCount === 1, "cross-game race produces at most one semantic mutation", { crossMutationCount });

  const payloadA = gameOperation({ id: "payload-id", game: "payload-game", hash: hash("d"), changes: { opponent: "Payload A" } });
  const payloadB = gameOperation({ id: "payload-id", game: "payload-game", hash: hash("e"), changes: { opponent: "Payload B" } });
  const payloadResults = await Promise.all([
    psqlAsync(container, applyGame(ACCOUNT_A, payloadA)),
    psqlAsync(container, applyGame(ACCOUNT_A, payloadB)),
  ]);
  const payloadJson = payloadResults.map(jsonResult);
  check(payloadJson.filter((value) => value.code === "duplicate_operation_id_payload_mismatch").length === 1, "case 3: same-game different payloads produce one bounded payload mismatch", payloadJson);

  const actorResults = await Promise.all([
    psqlAsync(container, applyGame(ACCOUNT_A, gameOperation({ id: "shared-client", game: "actor-game", hash: hash("f") }))),
    psqlAsync(container, applyGame(ACCOUNT_B, gameOperation({ id: "shared-client", game: "actor-game-b", hash: hash("1") }))),
  ]);
  check(actorResults.map(jsonResult).every((value) => value.outcome === "accepted"), "case 4: different actors may independently reuse a client operation ID", actorResults);

  const revokedOp = gameOperation({ id: "revoke-id", game: "revoked-game", hash: hash("2") });
  check(jsonResult(psql(container, applyGame(ACCOUNT_A, revokedOp)).stdout).outcome === "accepted", "revocation fixture operation is accepted");
  psql(container, `update public.games set user_id='${ACCOUNT_B}' where id='revoked-game';`);
  const revokedReplay = jsonResult(psql(container, applyGame(ACCOUNT_A, revokedOp)).stdout);
  check(revokedReplay.code === "authorization_denied" && !JSON.stringify(revokedReplay).includes("revoke-id"), "case 5: replay after current-authority loss is non-enumerating", revokedReplay);

  const deletedOp = gameOperation({ id: "delete-replay-id", game: "deleted-game", hash: hash("3") });
  check(jsonResult(psql(container, applyGame(ACCOUNT_A, deletedOp)).stdout).outcome === "accepted", "deletion replay fixture operation is accepted");
  psql(container, `delete from public.games where id='deleted-game'; insert into public.legacy_game_tombstones(
    game_id, owner_user_id, deletion_id, deleted_by, device_id, deleted_at
  ) values ('deleted-game','${ACCOUNT_A}','delete-r207','${ACCOUNT_A}','synthetic-device',statement_timestamp());`);
  const deletedReplay = jsonResult(psql(container, applyGame(ACCOUNT_A, deletedOp)).stdout);
  check(deletedReplay.code === "game_deleted" && !JSON.stringify(deletedReplay).includes("delete-replay-id"), "case 6: tombstone outranks stored replay and contains private result", deletedReplay);

  const beforeAtomic = psql(container, "select game_revision from public.games where id='atomic-game';").stdout;
  const atomicFailure = psql(
    container,
    applyGame(ACCOUNT_A, gameOperation({ id: "atomic-id", game: "atomic-game", hash: hash("4") }), true),
    { allowFailure: true },
  );
  check(atomicFailure.status !== 0 && /r207_injected_atomicity_failure/.test(atomicFailure.stderr), "case 10: injected persistence failure aborts the operation transaction");
  const afterAtomic = psql(container, "select game_revision || ',' || (select count(*) from public.game_sync_operations where client_operation_id='atomic-id') from public.games where id='atomic-game';").stdout;
  check(afterAtomic === `${beforeAtomic},0`, "operation identity, semantic mutation, result, and history roll back together", { beforeAtomic, afterAtomic });

  const opposing = [];
  for (let index = 0; index < 8; index += 1) {
    const client = `opposing-${index}`;
    opposing.push(psqlAsync(container, applyGame(ACCOUNT_A, gameOperation({
      id: client,
      game: index % 2 ? "lock-game-a" : "lock-game-b",
      hash: hash(index % 2 ? "5" : "6"),
      type: "score_delta",
      group: "score",
      base: 1,
      expectedLifecycle: "active",
      statusBase: 1,
      fields: ["score_for"],
      changes: { score_for_delta: 1 },
    }))));
  }
  const opposingResults = await Promise.all(opposing);
  check(opposingResults.length === 8, "case 11: opposing concurrent arrival completes without deadlock");
  check(opposingResults.map(jsonResult).every((value) => value.outcome === "accepted" || value.outcome === "merged"), "active-game score_delta behavior remains accepted and idempotent under serialization", opposingResults);
  const functionBody = psql(container, "select pg_get_functiondef('lh_sync_private.r207_apply_game_operation_for_test(jsonb,boolean)'::regprocedure);").stdout;
  check(functionBody.indexOf("laxhornet:r207-operation:") < functionBody.indexOf("laxhornet:legacy-game:"), "source inspection proves operation-identity lock precedes game lock");

  const held = holdOperationIdentity(container, ACCOUNT_A, "held-id", 1400);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const independentStart = Date.now();
  const independent = jsonResult(await psqlAsync(
    container,
    applyGame(ACCOUNT_A, gameOperation({
      id: "free-id",
      game: "lock-game-a",
      hash: hash("7"),
      base: 1,
      fields: ["game_type"],
      changes: { game_type: "regular" },
    })),
  ));
  const independentMs = Date.now() - independentStart;
  await held;
  check(independent.outcome === "accepted" && independentMs < 1000, "case 12: unrelated operation identity progresses while another identity is held", { independentMs, independent });

  const firstField = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "field-first", game: "field-game", hash: hash("8"), changes: { opponent: "First" } }))).stdout);
  const sameField = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "field-stale", game: "field-game", hash: hash("9"), base: 1, changes: { opponent: "Second" } }))).stdout);
  const nonOverlap = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "field-merge", game: "field-game", hash: hash("a"), base: 1, fields: ["location"], changes: { location: "Merged" } }))).stdout);
  check(firstField.outcome === "accepted" && sameField.outcome === "conflicted" && nonOverlap.outcome === "merged", "field-group revisions reject stale overlap and prove non-overlap merge", { firstField, sameField, nonOverlap });
  const missingBaseOperation = gameOperation({ id: "missing-base", game: "field-game", hash: hash("b") });
  delete missingBaseOperation.base_version;
  const missingBase = jsonResult(psql(container, applyGame(ACCOUNT_A, missingBaseOperation)).stdout);
  check(missingBase.code === "invalid_operation", "missing field-group base version is rejected", missingBase);
  const privateConflictValue = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({
    id: "private-value",
    game: "field-game",
    hash: hash("0"),
    base: 1,
    changes: { opponent: "No Store", token: "must-not-persist" },
  }))).stdout);
  check(
    privateConflictValue.code === "invalid_conflict_values"
      && Number(psql(container, "select count(*) from public.game_sync_operations where client_operation_id='private-value';").stdout) === 0,
    "unknown or private conflict values fail closed and are not stored",
    privateConflictValue,
  );

  const completedBefore = psql(container, "select score_for || ',' || score_against || ',' || score_version || ',' || game_revision || ',' || (select count(*) from public.game_sync_operations where game_id='complete-game') || ',' || (select count(*) from public.game_field_changes where game_id='complete-game') from public.games where id='complete-game';").stdout;
  const completedDelta = gameOperation({
    id: "complete-delta", game: "complete-game", hash: hash("c"), type: "score_delta", group: "score",
    fields: ["score_for"], changes: { score_for_delta: 1 }, expectedLifecycle: "completed", statusBase: 1,
  });
  const completedDeltaResult = jsonResult(psql(container, applyGame(ACCOUNT_A, completedDelta)).stdout);
  check(completedDeltaResult.code === "completed_game_score_correction_required", "completed game rejects ordinary score_delta", completedDeltaResult);
  const completedAbsolute = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({
    id: "complete-absolute", game: "complete-game", hash: hash("d"), type: "score_correction", group: "score",
    fields: ["score_against", "score_for"], changes: { score_for: 2, score_against: 1 }, expectedLifecycle: "completed", statusBase: 1,
  }))).stdout);
  check(completedAbsolute.code === "completed_game_score_correction_reason_required", "completed game rejects ordinary absolute score write without a bounded correction reason", completedAbsolute);
  const completedAfterRejectedWrites = psql(container, "select score_for || ',' || score_against || ',' || score_version || ',' || game_revision || ',' || (select count(*) from public.game_sync_operations where game_id='complete-game') || ',' || (select count(*) from public.game_field_changes where game_id='complete-game') from public.games where id='complete-game';").stdout;
  check(completedAfterRejectedWrites === completedBefore, "rejected completed-game score writes change no score, revision, journal, or successful operation evidence", { completedBefore, completedAfterRejectedWrites });

  const missingLifecycleOperation = { ...completedDelta, client_operation_id: "complete-missing-lifecycle", request_hash: hash("e") };
  delete missingLifecycleOperation.expected_lifecycle;
  const missingLifecycle = jsonResult(psql(container, applyGame(ACCOUNT_A, missingLifecycleOperation)).stdout);
  check(missingLifecycle.code === "missing_expected_lifecycle", "completed-game score write without lifecycle expectation is rejected", missingLifecycle);
  const staleLifecycle = jsonResult(psql(container, applyGame(ACCOUNT_A, { ...completedDelta, client_operation_id: "complete-stale-lifecycle", request_hash: hash("f"), expected_lifecycle: "active" })).stdout);
  check(staleLifecycle.code === "stale_lifecycle_state", "completed-game score write under an active-game assumption is rejected", staleLifecycle);
  const missingStatusBaseOperation = { ...completedDelta, client_operation_id: "complete-missing-status", request_hash: hash("1") };
  delete missingStatusBaseOperation.status_base_version;
  const missingStatusBase = jsonResult(psql(container, applyGame(ACCOUNT_A, missingStatusBaseOperation)).stdout);
  check(missingStatusBase.code === "missing_status_base_version", "completed-game score write without status base is rejected", missingStatusBase);
  const staleStatusBase = jsonResult(psql(container, applyGame(ACCOUNT_A, { ...completedDelta, client_operation_id: "complete-stale-status", request_hash: hash("2"), status_base_version: 2 })).stdout);
  check(staleStatusBase.code === "stale_status_version", "completed-game score write with stale status base is rejected", staleStatusBase);
  const unboundedCorrectionReason = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({
    id: "complete-unbounded-reason", game: "complete-game", hash: hash("0"), type: "score_correction", group: "score",
    fields: ["score_against", "score_for"], changes: { score_for: 2, score_against: 1 }, expectedLifecycle: "completed",
    statusBase: 1, correctionReason: "x".repeat(201),
  }))).stdout);
  check(unboundedCorrectionReason.code === "invalid_completed_game_score_correction_reason", "completed-game correction rejects an unbounded or non-allowlisted reason without storing it", unboundedCorrectionReason);

  const authorizedCorrection = gameOperation({
    id: "complete-correction", game: "complete-game", hash: hash("3"), type: "score_correction", group: "score",
    fields: ["score_against", "score_for"], changes: { score_for: 2, score_against: 1 }, expectedLifecycle: "completed",
    statusBase: 1, correctionReason: "official_result_correction",
  });
  const correctionAccepted = jsonResult(psql(container, applyGame(ACCOUNT_A, authorizedCorrection)).stdout);
  const correctionReplay = jsonResult(psql(container, applyGame(ACCOUNT_A, authorizedCorrection)).stdout);
  const correctionState = psql(container, "select score_for || ',' || score_against || ',' || final_score_for || ',' || final_score_against || ',' || score_version || ',' || game_revision || ',' || (select count(*) from public.game_sync_operations where client_operation_id='complete-correction') || ',' || (select count(*) from public.game_sync_operation_attempts where client_operation_id='complete-correction') || ',' || (select correction_reason from public.game_sync_operations where client_operation_id='complete-correction') from public.games where id='complete-game';").stdout;
  check(correctionAccepted.outcome === "accepted" && correctionReplay.replay === true && correctionState === "2,1,2,1,2,2,1,1,official_result_correction", "authorized allowlisted completed-game correction succeeds once and replays idempotently with minimum reason evidence", { correctionAccepted, correctionReplay, correctionState });
  const staleScoreCorrection = jsonResult(psql(container, applyGame(ACCOUNT_A, { ...authorizedCorrection, client_operation_id: "complete-stale-score", request_hash: hash("a"), base_version: 1 })).stdout);
  check(staleScoreCorrection.code === "stale_score_version", "completed-game correction with a stale score base is rejected", staleScoreCorrection);
  const unauthorizedCorrection = jsonResult(psql(container, applyGame(ACCOUNT_B, { ...authorizedCorrection, client_operation_id: "complete-unauthorized", request_hash: hash("4") })).stdout);
  check(unauthorizedCorrection.code === "authorization_denied", "unauthorized completed-game correction is denied without disclosure", unauthorizedCorrection);

  const completedConcurrentBefore = psql(container, "select score_for || ',' || score_against || ',' || score_version || ',' || game_revision from public.games where id='complete-game';").stdout;
  const concurrentCompletedResults = await Promise.all([
    psqlAsync(container, applyGame(ACCOUNT_A, { ...completedDelta, client_operation_id: "complete-concurrent-a", request_hash: hash("5"), base_version: 2 })),
    psqlAsync(container, applyGame(ACCOUNT_A, { ...completedDelta, client_operation_id: "complete-concurrent-b", request_hash: hash("6"), base_version: 2 })),
  ]);
  const completedConcurrentAfter = psql(container, "select score_for || ',' || score_against || ',' || score_version || ',' || game_revision from public.games where id='complete-game';").stdout;
  check(concurrentCompletedResults.map(jsonResult).every((value) => value.code === "completed_game_score_correction_required") && completedConcurrentAfter === completedConcurrentBefore, "concurrent ordinary score_delta requests against a completed game produce zero mutations", { completedConcurrentBefore, completedConcurrentAfter });

  const completedCorrection = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "complete-metadata", game: "complete-game", hash: hash("7"), base: 1, changes: { opponent: "Corrected Fact" } }))).stdout);
  const reopen = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "complete-reopen", game: "complete-game", hash: hash("8"), type: "status_transition", group: "status", fields: ["lifecycle_state"], changes: { lifecycle_state: "active" }, expectedLifecycle: "completed", statusBase: 1 }))).stdout);
  check(completedCorrection.outcome === "accepted" && reopen.code === "completed_game_reopen_forbidden", "completed games allow bounded factual metadata correction but never reopen", { completedCorrection, reopen });

  const completedClock = jsonResult(psql(container, applyClock(ACCOUNT_A, {
    client_operation_id: "complete-clock", game_id: "complete-game", request_hash: hash("9"), command: "start",
    base_clock_version: 1, expected_lifecycle: "completed", status_base_version: 1,
  })).stdout);
  check(completedClock.code === "completed_game_clock_change_forbidden", "completed-game clock commands remain frozen", completedClock);

  const clockAccepted = jsonResult(psql(container, applyClock(ACCOUNT_A, {
    client_operation_id: "clock-start", game_id: "clock-game", request_hash: hash("a"), command: "start", base_clock_version: 1,
    expected_lifecycle: "active", status_base_version: 1,
  })).stdout);
  const clockStale = jsonResult(psql(container, applyClock(ACCOUNT_A, {
    client_operation_id: "clock-stale", game_id: "clock-game", request_hash: hash("b"), command: "pause", base_clock_version: 1,
    expected_lifecycle: "active", status_base_version: 1,
  })).stdout);
  const clockMissing = jsonResult(psql(container, applyClock(ACCOUNT_A, {
    client_operation_id: "clock-missing", game_id: "clock-game", request_hash: hash("c"), command: "pause",
    expected_lifecycle: "active", status_base_version: 1,
  })).stdout);
  check(clockAccepted.clock_version === 2 && clockStale.code === "stale_clock_revision" && clockMissing.code === "missing_base_clock_version", "clock commands use optimistic revision, immutable command history, and explicit bases", { clockAccepted, clockStale, clockMissing });

  const wrongAccount = jsonResult(psql(container, applyGame(ACCOUNT_B, gameOperation({ id: "wrong-account", game: "wrong-account-game", hash: hash("2") }))).stdout);
  check(wrongAccount.code === "authorization_denied", "wrong-account operation is denied without disclosure", wrongAccount);
  const teamAccepted = jsonResult(psql(container, applyGame(ACCOUNT_B, gameOperation({ id: "team-op", game: "team-game", hash: hash("3") }))).stdout);
  const authorizedTeamTombstone = jsonResult(psql(container, applyGame(ACCOUNT_B, gameOperation({ id: "team-tombstone-authorized", game: "team-tombstone-authorized", hash: hash("4") }))).stdout);
  check(authorizedTeamTombstone.code === "game_deleted", "current authorized roster tracker may receive the bounded team tombstone result", authorizedTeamTombstone);
  const copiedOwnerTombstone = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "team-tombstone-owner", game: "team-tombstone-owner", hash: hash("5") }))).stdout);
  check(copiedOwnerTombstone.code === "authorization_denied" && Object.keys(copiedOwnerTombstone).sort().join(",") === "code,outcome", "copied historical owner receives a non-enumerating denial for a team tombstone", copiedOwnerTombstone);
  const untrackedMemberTombstone = jsonResult(psql(container, applyGame(ACCOUNT_C, gameOperation({ id: "team-tombstone-untracked", game: "team-tombstone-untracked", hash: hash("6") }))).stdout);
  check(untrackedMemberTombstone.code === "authorization_denied", "current team member without roster-tracking authority cannot observe team tombstone state", untrackedMemberTombstone);
  const crossMismatchTombstone = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "same-id", game: "team-tombstone-owner", hash: hash("a") }))).stdout);
  check(crossMismatchTombstone.code === "authorization_denied" && !/same-id|team-tombstone|conflict|replay|game_deleted/.test(JSON.stringify(crossMismatchTombstone)), "cross-game operation-ID reuse cannot reveal a team tombstone, operation, replay, or conflict to an unauthorized actor", crossMismatchTombstone);
  const personalTombstoneOwner = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "personal-tombstone-owner", game: "personal-tombstone", hash: hash("7") }))).stdout);
  const personalTombstoneOther = jsonResult(psql(container, applyGame(ACCOUNT_B, gameOperation({ id: "personal-tombstone-other", game: "personal-tombstone", hash: hash("8") }))).stdout);
  check(personalTombstoneOwner.code === "game_deleted" && personalTombstoneOther.code === "authorization_denied", "personal-game tombstone authority remains isolated to the canonical owner", { personalTombstoneOwner, personalTombstoneOther });

  const teamReplayOperation = gameOperation({ id: "team-replay-revoked", game: "team-replay-game", hash: hash("9") });
  check(jsonResult(psql(container, applyGame(ACCOUNT_B, teamReplayOperation)).stdout).outcome === "accepted", "team replay revocation fixture is accepted under current tracker authority");
  psql(container, `delete from public.games where id='team-replay-game'; insert into public.legacy_game_tombstones(
    game_id, owner_user_id, team_id, roster_player_id, deleted_by, deletion_id, device_id, deleted_at
  ) values ('team-replay-game','${ACCOUNT_A}','team-r207','roster-r207','${ACCOUNT_A}','delete-team-replay','synthetic-device',statement_timestamp());`);
  psql(container, "delete from public.player_claims where id='claim-r207';");
  const teamRevoked = jsonResult(psql(container, applyGame(ACCOUNT_B, gameOperation({ id: "team-op", game: "team-game", hash: hash("3") }))).stdout);
  check(teamAccepted.outcome === "accepted" && teamRevoked.code === "authorization_denied", "current roster authority permits team operation and revocation blocks replay", { teamAccepted, teamRevoked });
  const teamTombstoneReplayRevoked = jsonResult(psql(container, applyGame(ACCOUNT_B, teamReplayOperation)).stdout);
  check(teamTombstoneReplayRevoked.code === "authorization_denied" && !/team-replay|game_deleted|replay|conflict/.test(JSON.stringify(teamTombstoneReplayRevoked)), "team tombstone replay after tracker revocation is denied without operation or tombstone disclosure", teamTombstoneReplayRevoked);
  psql(container, "delete from public.team_members where id='untracked-r207';");
  const formerMemberTombstone = jsonResult(psql(container, applyGame(ACCOUNT_C, gameOperation({ id: "team-tombstone-former", game: "team-tombstone-untracked", hash: hash("0") }))).stdout);
  check(formerMemberTombstone.code === "authorization_denied", "former team member cannot observe team tombstone state", formerMemberTombstone);
  const historicalOwner = jsonResult(psql(container, applyGame(ACCOUNT_A, gameOperation({ id: "team-owner-copy", game: "team-game", hash: hash("4"), base: 2 }))).stdout);
  check(historicalOwner.code === "authorization_denied", "copied team-game owner identity does not substitute for current roster authority", historicalOwner);

  for (const table of ["game_sync_operations", "game_sync_operation_attempts", "game_field_changes", "game_conflicts", "game_conflict_resolutions", "game_clock_commands", "r207_retention_control"]) {
    const rls = psql(container, `select relrowsecurity::text || ',' || relforcerowsecurity::text from pg_class where oid='public.${table}'::regclass;`).stdout;
    check(rls === "true,true", `${table} has enabled and forced RLS`, { rls });
    const denied = psql(container, `set role authenticated; select * from public.${table} limit 1;`, { allowFailure: true });
    check(denied.status !== 0 && /permission denied/i.test(denied.stderr), `${table} denies direct authenticated access`);
  }

  const immutableOperation = psql(container, "update public.game_sync_operations set outcome_code='changed' where client_operation_id='same-id';", { allowFailure: true });
  const immutableConflict = psql(container, "update public.game_conflicts set conflict_type='resolution_stale' where operation_id is not null;", { allowFailure: true });
  check(/r207_append_only_history/.test(immutableOperation.stderr) && /r207_append_only_history/.test(immutableConflict.stderr), "operation and conflict history reject mutation");
  psql(container, `insert into public.game_conflict_resolutions(
    conflict_id,resolver_user_id,client_resolution_operation_id,request_hash,action,outcome_code
  ) select conflict_id,'${ACCOUNT_A}','resolution-test','${hash("5")}','keep_server','kept_server'
    from public.game_conflicts limit 1;`);
  const immutableResolution = psql(container, "delete from public.game_conflict_resolutions;", { allowFailure: true });
  check(/r207_append_only_history/.test(immutableResolution.stderr), "conflict resolution history is append-only");

  const rollbackRefused = psql(container, source("rollback", rollbackFile), { allowFailure: true });
  check(rollbackRefused.status !== 0 && /R207A_ROLLBACK_REFUSED_EVIDENCE_EXISTS/.test(rollbackRefused.stderr), "pre-activation rollback refuses after R2-07 evidence exists");

  const rollbackContainer = await startContainer("rollback");
  psql(rollbackContainer, source("rollback", rollbackFile));
  const rollbackState = psql(rollbackContainer, "select to_regclass('public.game_sync_operations') is null and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='games' and column_name='game_revision');").stdout;
  check(rollbackState === "t", "zero-evidence pre-activation rollback removes only dormant R2-07A objects");

  console.log("Original R2-07A matrix preservation: 49 checks passed.");
  console.log(`R2-07A Docker matrix complete: ${checks} checks passed.`);
}

try {
  await run();
} finally {
  for (const container of containers) {
    docker(["stop", container], { allowFailure: true, timeout: 30000 });
  }
  const residue = docker(["ps", "-a", "--filter", `name=laxhornet-r207a-`, "--format", "{{.Names}}"], { allowFailure: true }).stdout.trim();
  if (residue) throw new Error(`R2-07A container residue remains:\n${residue}`);
  console.log("PASS: disposable Docker cleanup left zero R2-07A containers");
}
