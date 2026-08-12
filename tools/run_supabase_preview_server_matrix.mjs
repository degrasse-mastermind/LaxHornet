#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const productionRef = "ulbmjcvnyznvmjgpstno";
const requiredMigrations = [
  "20260730151714",
  "20260806143128",
  "20260809155442",
  "20260809173500",
  "20260809201608",
  "20260811010813",
];
const env = {
  url: process.env.SUPABASE_PREVIEW_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  anon: process.env.SUPABASE_PREVIEW_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  database: process.env.SUPABASE_PREVIEW_DB_URL || process.env.POSTGRES_URL_NON_POOLING || "",
  projectRef: process.env.SUPABASE_PREVIEW_PROJECT_REF || "",
  branch: process.env.SUPABASE_PREVIEW_BRANCH || process.env.GITHUB_HEAD_REF || "",
  sha: process.env.SUPABASE_PREVIEW_SHA || process.env.GITHUB_SHA || "",
};

let checks = 0;
const results = [];
function check(condition, label, group, detail = "") {
  assert.ok(condition, `${group}: ${label}${detail ? ` (${detail})` : ""}`);
  checks += 1;
  results.push({ group, label, status: "PASS" });
  console.log(`PASS [${group}]: ${label}`);
}

function projectRefFromUrl(value) {
  try {
    return new URL(value).hostname.split(".")[0].toLowerCase();
  } catch {
    return "";
  }
}

function redact(value) {
  return String(value || "")
    .replaceAll(env.database, "[PREVIEW_DB_URL]")
    .replaceAll(env.anon, "[PREVIEW_KEY]");
}

function psql(sql, { allowFailure = false } = {}) {
  const result = spawnSync("psql", [env.database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], {
    cwd: root,
    encoding: "utf8",
    input: sql,
    timeout: 180000,
    env: { ...process.env, PAGER: "cat" },
  });
  const output = { status: result.status, stdout: result.stdout.trim(), stderr: redact(result.stderr.trim()) };
  if (result.status !== 0 && !allowFailure) throw new Error(output.stderr || "Preview PostgreSQL command failed");
  return output;
}

function psqlConcurrent(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [env.database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PAGER: "cat" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => { stdout += value; });
    child.stderr.on("data", (value) => { stderr += value; });
    child.on("error", reject);
    child.on("close", (status) => status === 0
      ? resolve(stdout.trim())
      : reject(new Error(redact(stderr || stdout))));
    child.stdin.end(sql);
  });
}

function actorSql(actor, sql, { role = true } = {}) {
  return `select set_config('request.jwt.claims', '{"sub":"${actor}","role":"authenticated","email":"synthetic-preview@example.invalid"}', false);\n${role ? "set role authenticated;" : ""}\n${sql}\n${role ? "reset role;" : ""}`;
}

function json(output) {
  const line = output.split(/\r?\n/).reverse().find((value) => value.trim().startsWith("{"));
  assert.ok(line, `No JSON response found in bounded output: ${output.slice(-400)}`);
  return JSON.parse(line);
}

const suffix = crypto.createHash("sha256").update(`${env.sha}:${Date.now()}`).digest("hex").slice(0, 10);
const prefix = `lh26b-${suffix}`;
const actors = {
  owner: `8b260000-0000-4000-8000-${suffix.padEnd(12, "0")}`,
  tracker: `8b260000-0000-4000-8001-${suffix.padEnd(12, "0")}`,
  other: `8b260000-0000-4000-8002-${suffix.padEnd(12, "0")}`,
};
const game = (label) => `${prefix}-${label}`;
const op = (label) => `${prefix}-${label}`;
const hash = (label) => crypto.createHash("sha256").update(`${prefix}:${label}`).digest("hex");

function gamePatch(label, gameId, base, changes, extra = {}) {
  return {
    client_operation_id: op(label), game_id: gameId, request_hash: hash(label),
    operation_type: "metadata_patch", field_group: "metadata", base_version: base,
    changed_fields: Object.keys(changes).sort(), changes,
    client_created_at: "2026-08-12T12:00:00Z", ...extra,
  };
}

function eventOperation(label, gameId, eventId, type, base, changes = {}, lifecycle = "active") {
  return {
    client_operation_id: op(label), game_id: gameId, event_id: eventId,
    operation_type: type, base_event_version: base, expected_game_lifecycle: lifecycle,
    changes, client_created_at: "2026-08-12T12:00:00Z",
  };
}

function clockOperation(label, gameId, base, command, args = {}, extra = {}) {
  return {
    client_operation_id: op(label), device_id: `${prefix}-device`, game_id: gameId,
    base_clock_version: base, status_base_version: extra.status ?? 1,
    expected_lifecycle: extra.lifecycle || "active", command, arguments: args,
    client_occurred_at: extra.occurred || "2026-08-12T12:00:00Z",
  };
}

function call(actor, functionName, request, options = {}) {
  return json(psql(actorSql(actor, `select public.${functionName}($json$${JSON.stringify(request)}$json$::jsonb)::text;`, options)).stdout);
}

async function preflight() {
  for (const [name, value] of Object.entries(env)) check(Boolean(value), `${name} is present`, "identity");
  const urlRef = projectRefFromUrl(env.url);
  check(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(env.url), "Preview URL is a canonical Supabase endpoint", "identity");
  check(urlRef === env.projectRef.toLowerCase(), "URL and declared Preview project identity agree", "identity");
  check(urlRef !== productionRef, "Preview project is not the production project", "identity");
  check(!env.database.toLowerCase().includes(productionRef), "database URL does not name production", "identity");
  check(!/^(?:main|master|production)$/i.test(env.branch), "branch identity is non-production", "identity");
  check(/^[0-9a-f]{40}$/i.test(env.sha), "exact PR SHA is bound", "identity");
  check(env.anon.length >= 20, "Preview publishable/anon credential is present", "identity");
  const health = await fetch(`${env.url}/auth/v1/health`, { headers: { apikey: env.anon }, signal: AbortSignal.timeout(15000) });
  check(health.ok, "Preview Auth service is healthy", "identity", String(health.status));
  check(spawnSync("psql", ["--version"], { encoding: "utf8" }).status === 0, "psql client is available", "identity");
  const databaseIdentity = psql("select current_database()||'|'||current_user||'|'||current_setting('server_version_num');").stdout;
  check(Boolean(databaseIdentity), "real hosted PostgreSQL session established", "identity");
  const migrationRows = psql("select version from supabase_migrations.schema_migrations order by version;").stdout;
  for (const migration of requiredMigrations) check(migrationRows.includes(migration), `migration ${migration} is installed`, "migration-state");
}

function schemaSecurityMatrix() {
  const forceTables = [
    "legacy_game_tombstones", "game_sync_operations", "game_conflicts",
    "legacy_event_sync_operations", "legacy_event_tombstones", "game_clock_batches",
  ];
  for (const table of forceTables) {
    const state = psql(`select relrowsecurity::text||','||relforcerowsecurity::text from pg_class where oid='public.${table}'::regclass;`).stdout;
    check(state === "true,true", `${table} has enabled and forced RLS`, "security");
  }
  const grants = psql("select has_function_privilege('authenticated','public.laxhornet_sync_game_v2(jsonb)','execute')::text||','||has_function_privilege('anon','public.laxhornet_sync_game_v2(jsonb)','execute')::text||','||has_function_privilege('authenticated','public.lh_apply_game_clock_batch_v2(jsonb)','execute')::text||','||has_function_privilege('anon','public.lh_apply_game_clock_batch_v2(jsonb)','execute')::text;").stdout;
  check(grants === "true,false,true,false", "authenticated-only RPC grants are enforced", "security");
  const paths = psql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','lh_sync_private') and p.prosecdef and coalesce(array_to_string(p.proconfig,','),'') not like '%search_path=%';").stdout;
  check(paths === "0", "SECURITY DEFINER functions set an explicit search_path", "security");
  const authProbe = psql(actorSql(actors.owner, "select auth.uid()::text;", { role: true })).stdout;
  check(authProbe === actors.owner, "auth.uid() resolves the independent authenticated session", "security");
}

function seedFixtures() {
  psql(`
    insert into auth.users(id,email,aud,role,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values
      ('${actors.owner}','${prefix}-owner@example.invalid','authenticated','authenticated','',statement_timestamp(),'{}','{}'),
      ('${actors.tracker}','${prefix}-tracker@example.invalid','authenticated','authenticated','',statement_timestamp(),'{}','{}'),
      ('${actors.other}','${prefix}-other@example.invalid','authenticated','authenticated','',statement_timestamp(),'{}','{}');
    update public.r207_preview_control set preview_enabled=true, updated_at=statement_timestamp() where control_id;
  `);
  check(true, "three synthetic authenticated identities created", "actors");
}

function insertGame(gameId, owner = actors.owner, status = "in-progress", lifecycle = "active") {
  psql(`insert into public.games(id,user_id,share_code,opponent,game_date,status,lifecycle_state)
    values ('${gameId}','${owner}',upper(substr(md5('${gameId}'),1,8)),'Synthetic Adult Opponent','2026-08-12','${status}','${lifecycle}');`);
}

async function tombstoneMatrix() {
  const gameId = game("tombstone");
  insertGame(gameId);
  const write = {
    operation_id: op("legacy-write"), device_id: `${prefix}-write`, payload_revision: 1,
    game_row: { id: gameId, user_id: actors.owner, share_code: "SYNTHA1", is_shared: false,
      opponent: "Stale", game_date: "2026-08-12", period_format: "quarters", player_snapshot: {},
      current_quarter: "Q1", status: "in-progress", created_at: "2026-08-12T12:00:00Z", saved_at: "2026-08-12T12:01:00Z" },
  };
  const deletion = { game_id: gameId, account_id: actors.owner, deletion_id: op("delete"), device_id: `${prefix}-delete`, deleted_at: "2026-08-12T12:02:00Z", known_game_saved_at: null };
  const [deleteResult, writeResult] = await Promise.all([
    psqlConcurrent(actorSql(actors.owner, `select public.laxhornet_delete_game_durable($json$${JSON.stringify(deletion)}$json$::jsonb)::text;`)),
    psqlConcurrent(actorSql(actors.owner, `select public.laxhornet_sync_game($json$${JSON.stringify(write)}$json$::jsonb)::text;`)),
  ]);
  check(Boolean(json(deleteResult).code || json(deleteResult).outcome), "concurrent delete returned a bounded result", "tombstone");
  check(Boolean(json(writeResult).code || json(writeResult).outcome), "concurrent stale write returned a bounded result", "tombstone");
  const state = psql(`select (not exists(select 1 from public.games where id='${gameId}'))::text||','||exists(select 1 from public.legacy_game_tombstones where game_id='${gameId}')::text;`).stdout;
  check(state === "true,true", "tombstone wins and the game cannot resurrect", "tombstone");
  const other = psql(actorSql(actors.other, `select count(*) from public.legacy_game_tombstones where game_id='${gameId}';`), { allowFailure: true });
  check(other.status !== 0 || other.stdout === "0", "unrelated actor cannot read private tombstone state", "tombstone");
}

async function gameMatrix() {
  const gameId = game("r207-game");
  insertGame(gameId);
  const firstRequest = gamePatch("game-first", gameId, 1, { opponent: "Device A" });
  const first = call(actors.owner, "laxhornet_sync_game_v2", firstRequest);
  check(first.outcome === "accepted", "authenticated metadata operation is accepted", "r207a-r207b");
  const replay = call(actors.owner, "laxhornet_sync_game_v2", firstRequest);
  check(replay.replay === true || replay.code === "accepted", "identical permanent operation replays stably", "r207a-r207b");
  const altered = call(actors.owner, "laxhornet_sync_game_v2", { ...firstRequest, changes: { opponent: "Altered" } });
  check(altered.code === "duplicate_operation_id_payload_mismatch", "altered replay is rejected", "r207a-r207b");
  const denied = call(actors.other, "laxhornet_sync_game_v2", gamePatch("game-denied", gameId, 2, { opponent: "Probe" }));
  check(denied.code === "authorization_denied" && !JSON.stringify(denied).includes("Device A"), "unauthorized denial is non-enumerating", "r207a-r207b");
  const raceRequests = [
    gamePatch("game-race-a", gameId, 2, { opponent: "Race A" }),
    gamePatch("game-race-b", gameId, 2, { opponent: "Race B" }),
  ];
  const race = await Promise.all(raceRequests.map((request) => psqlConcurrent(actorSql(actors.owner, `select public.laxhornet_sync_game_v2($json$${JSON.stringify(request)}$json$::jsonb)::text;`)).then(json)));
  check(race.filter((item) => ["accepted", "merged"].includes(item.outcome)).length === 1 && race.some((item) => item.outcome === "conflicted"), "same-base concurrent writes serialize deterministically", "r207a-r207b");
  const atomicGame = game("atomic-game");
  insertGame(atomicGame);
  const injectedRequest = gamePatch("game-injected", atomicGame, 1, { opponent: "Must Roll Back" });
  const injected = psql(actorSql(actors.owner, `select lh_sync_private.r207_apply_game_operation_for_test($json$${JSON.stringify(injectedRequest)}$json$::jsonb,true);`, { role: false }), { allowFailure: true });
  check(injected.status !== 0 && /injected/i.test(injected.stderr), "injected failure reaches the real transaction rollback path", "r207a-r207b");
  const atomicState = psql(`select opponent||'|'||(select count(*) from public.game_sync_operations where client_operation_id='${injectedRequest.client_operation_id}') from public.games where id='${atomicGame}';`).stdout;
  check(atomicState === "Synthetic Adult Opponent|0", "injected failure leaves no state or receipt mutation", "r207a-r207b");
}

async function eventMatrix() {
  const gameId = game("event-game");
  const eventId = game("event-a");
  insertGame(gameId);
  const event = { timestamp: "2026-08-12T12:00:00Z", quarter: "Q1", stat_type: "goal", stat_label: "Goal", category: "Offense", point_value: 1, tags: [], note: "", field_zone: "" };
  const create = eventOperation("event-create", gameId, eventId, "create", 0, event);
  const created = call(actors.owner, "laxhornet_sync_event_v2", create);
  check(created.outcome === "accepted" && created.server_event_version === 1, "event create is versioned", "r207c");
  const replay = call(actors.owner, "laxhornet_sync_event_v2", create);
  check(replay.code === "created", "event replay is exactly-once", "r207c");
  const altered = call(actors.owner, "laxhornet_sync_event_v2", { ...create, changes: { ...event, note: "altered" } });
  check(altered.code === "duplicate_operation_id_payload_mismatch", "altered event replay is rejected", "r207c");
  const corrected = call(actors.owner, "laxhornet_sync_event_v2", eventOperation("event-correct", gameId, eventId, "correct", 1, { note: "corrected" }));
  check(corrected.outcome === "accepted", "current-base event correction is accepted", "r207c");
  const stale = call(actors.owner, "laxhornet_sync_event_v2", eventOperation("event-stale", gameId, eventId, "correct", 1, { note: "stale" }));
  check(stale.code === "same_field_conflict", "stale same-field event correction conflicts", "r207c");
  const deleted = call(actors.owner, "laxhornet_sync_event_v2", eventOperation("event-delete", gameId, eventId, "tombstone", 2));
  check(deleted.code === "tombstoned", "event tombstone is accepted exactly once", "r207c");
  const resurrection = call(actors.owner, "laxhornet_sync_event_v2", eventOperation("event-resurrect", gameId, eventId, "correct", 2, { note: "no" }));
  check(resurrection.code === "event_tombstoned", "event tombstone prevents resurrection", "r207c");
  const denied = call(actors.other, "laxhornet_sync_event_v2", eventOperation("event-denied", gameId, eventId, "correct", 2, { note: "probe" }));
  check(denied.code === "authorization_denied" && !JSON.stringify(denied).includes(eventId), "revoked/unrelated event access is non-enumerating", "r207c");
}

function resolutionRequest(conflict, label, action, patch = {}) {
  return { client_resolution_operation_id: op(label), conflict_id: conflict.conflict_id, game_id: conflict.game_id,
    action, expected_versions: conflict.server_versions, patch, client_created_at: "2026-08-12T12:05:00Z", request_hash: hash(label) };
}

function makeConflict(gameId, label) {
  call(actors.owner, "laxhornet_sync_game_v2", gamePatch(`${label}-accepted`, gameId, 1, { opponent: `${label}-current` }));
  call(actors.owner, "laxhornet_sync_game_v2", gamePatch(`${label}-conflict`, gameId, 1, { opponent: `${label}-proposed` }));
  const read = call(actors.owner, "laxhornet_read_game_conflicts_v1", { game_id: gameId });
  return read.conflicts[0];
}

function conflictMatrix() {
  const keepGame = game("conflict-keep");
  const dismissGame = game("conflict-dismiss");
  insertGame(keepGame);
  insertGame(dismissGame);
  const unauthorized = call(actors.other, "laxhornet_read_game_conflicts_v1", { game_id: keepGame });
  check(unauthorized.code === "authorization_denied", "unauthorized conflict read is denied", "r207d");
  const keep = makeConflict(keepGame, "keep");
  const kept = call(actors.owner, "laxhornet_resolve_game_conflict_v1", resolutionRequest(keep, "keep-resolution", "keep_server"));
  check(kept.code === "resolution_kept", "keep_server records a terminal resolution", "r207d");
  const dismiss = makeConflict(dismissGame, "dismiss");
  const before = psql(`select opponent from public.games where id='${dismissGame}';`).stdout;
  const dismissed = call(actors.owner, "laxhornet_resolve_game_conflict_v1", resolutionRequest(dismiss, "dismiss-resolution", "dismiss"));
  const after = psql(`select opponent from public.games where id='${dismissGame}';`).stdout;
  check(dismissed.code === "resolution_dismissed" && before === after, "dismiss acknowledges without mutating canonical game value", "r207d");
  const directWrite = psql(actorSql(actors.owner, `delete from public.game_conflicts where game_id='${dismissGame}';`), { allowFailure: true });
  check(directWrite.status !== 0, "authenticated direct conflict writes are denied", "r207d");
}

function insertClock(gameId) {
  insertGame(gameId);
  psql(`insert into public.lh_game_clock_states(
    game_id,owner_user_id,player_id,scope_type,period_format,regulation_period_duration_seconds,overtime_duration_seconds,
    current_period,clock_seconds_remaining,is_running,started_at,paused_at,client_updated_at,server_updated_at,recovery_state,
    revision,created_by_user_id,anchor_server_at,anchor_clock_seconds_remaining)
    values ('${gameId}','${actors.owner}','${prefix}-player','personal','quarters',720,300,'Q1',720,false,null,statement_timestamp(),statement_timestamp(),statement_timestamp(),'complete',1,'${actors.owner}',statement_timestamp(),720);`);
}

async function clockMatrix() {
  const gameId = game("clock");
  insertClock(gameId);
  const start = clockOperation("clock-start", gameId, 1, "start");
  const started = call(actors.owner, "lh_apply_game_clock_operation_v2", start);
  check(started.outcome === "accepted" && started.clock_version === 2, "online clock command is accepted", "clock-batch");
  const replay = call(actors.owner, "lh_apply_game_clock_operation_v2", start);
  check(replay.replay === true, "clock command replay returns stored receipt", "clock-batch");
  const altered = call(actors.owner, "lh_apply_game_clock_operation_v2", { ...start, command: "pause" });
  check(altered.code === "duplicate_operation_id_payload_mismatch", "altered clock replay is rejected", "clock-batch");
  const raceGame = game("clock-race");
  insertClock(raceGame);
  const race = await Promise.all([
    clockOperation("clock-race-a", raceGame, 1, "start"),
    clockOperation("clock-race-b", raceGame, 1, "start"),
  ].map((request) => psqlConcurrent(actorSql(actors.owner, `select public.lh_apply_game_clock_operation_v2($json$${JSON.stringify(request)}$json$::jsonb)::text;`)).then(json)));
  check(race.filter((item) => item.outcome === "accepted").length === 1 && race.some((item) => item.outcome === "conflicted"), "concurrent start/start serializes", "clock-batch");
  const batchGame = game("clock-batch");
  insertClock(batchGame);
  const commands = [
    { client_operation_id: op("batch-start"), device_id: `${prefix}-offline`, expected_lifecycle: "active", command: "start", arguments: {}, client_occurred_at: "2026-08-12T12:00:00Z" },
    { client_operation_id: op("batch-pause"), device_id: `${prefix}-offline`, expected_lifecycle: "active", command: "pause", arguments: {}, client_occurred_at: "2026-08-12T12:00:05Z" },
  ];
  const batch = { client_batch_id: op("batch"), game_id: batchGame, base_clock_version: 1, status_base_version: 1, expected_lifecycle: "active", commands };
  const accepted = call(actors.owner, "lh_apply_game_clock_batch_v2", batch);
  check(accepted.outcome === "accepted" && accepted.receipts.length === 2, "offline batch commits atomically in chronology", "clock-batch");
  const conflict = call(actors.owner, "lh_apply_game_clock_batch_v2", { ...batch, client_batch_id: op("batch-stale"), commands: commands.map((item) => ({ ...item, client_operation_id: `${item.client_operation_id}-stale` })) });
  check(conflict.outcome === "conflicted" && conflict.receipts.length === 0, "changed-base batch applies zero operations", "clock-batch");
  const denied = call(actors.other, "lh_apply_game_clock_operation_v2", clockOperation("clock-denied", gameId, 2, "pause"));
  check(denied.code === "authorization_denied", "revoked/unrelated clock actor is denied", "clock-batch");
}

function cleanup() {
  const cleanupResult = psql(`
    delete from public.games where id like '${prefix}%';
    delete from public.teams where id like '${prefix}%';
    delete from auth.users where id in ('${actors.owner}','${actors.tracker}','${actors.other}');
  `, { allowFailure: true });
  return cleanupResult.status === 0;
}

async function main() {
  let cleanupComplete = false;
  let mutationsStarted = false;
  try {
    await preflight();
    schemaSecurityMatrix();
    seedFixtures();
    mutationsStarted = true;
    await tombstoneMatrix();
    await gameMatrix();
    await eventMatrix();
    conflictMatrix();
    await clockMatrix();
  } finally {
    if (mutationsStarted) {
      cleanupComplete = cleanup();
      console.log(cleanupComplete
        ? "PASS [cleanup]: mutable synthetic fixtures removed"
        : "NOTICE [cleanup]: immutable evidence may remain; isolated Preview disposal is the cleanup boundary");
    } else {
      console.log("PASS [cleanup]: no mutation began");
    }
  }
  const summary = { status: "PASS", exactSha: env.sha, previewProjectRef: env.projectRef, branch: env.branch, checks, cleanupComplete, groups: [...new Set(results.map((item) => item.group))] };
  const evidencePath = process.env.LAXHORNET_PREVIEW_MATRIX_EVIDENCE_FILE || "";
  if (evidencePath) fs.writeFileSync(evidencePath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Hosted Supabase Preview server matrix: ${checks}/${checks} passed.`);
}

main().catch((error) => {
  console.error(`HOSTED_PREVIEW_MATRIX_FAILED: ${redact(error?.stack || error)}`);
  process.exitCode = 1;
});
