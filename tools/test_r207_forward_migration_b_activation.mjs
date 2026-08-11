import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const image = "postgres:17-alpine";
const migrationFile = "20260811131043_r207_forward_migration_b_activation.sql";
const recoveryFile = "20260811131043_r207_forward_migration_b_activation_rollback.sql";
const migrations = [
  "20260723000000_laxhornet_legacy_baseline.sql",
  "20260723010000_trust_spine_release_1.sql",
  "20260723010607_remote_schema.sql",
  "20260723020000_minimum_necessary_disclosure.sql",
  "20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
  "20260723040000_event_pipeline_capabilities.sql",
  "20260727000000_tracked_playing_time_operations.sql",
  "20260728193942_v284_public_event_semantic_boundary.sql",
  "20260730004700_team_members_rls_recursion.sql",
  "20260730134439_durable_game_tombstones.sql",
  "20260730151714_durable_game_tombstone_concurrency.sql",
  "20260806143128_r207a_dormant_concurrency_foundation.sql",
  "20260809155442_r207b_controlled_preview_integration.sql",
  "20260809164435_r207b_qualify_preview_game_update.sql",
  "20260809173500_r207c_versioned_event_corrections.sql",
  "20260809201608_r207d_conflict_resolution_foundation.sql",
  "20260811010813_r207_clock_command_batch_integration.sql",
  "20260811131042_r207_forward_migration_b_cutover_gate.sql",
];
const OWNER = "00000000-0000-4000-8000-00000000000a";
const OTHER = "00000000-0000-4000-8000-00000000000b";
const NOW_MINUS_ONE_SECOND = new Date(Date.now() - 1_000).toISOString();
const NOW = new Date().toISOString();
const containers = new Set();
let checks = 0;

function check(condition, label, details = "") {
  assert.ok(condition, details ? `${label}: ${details}` : label);
  checks += 1;
  console.log(`PASS: ${label}`);
}

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    timeout: 180_000,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`docker exit=${result.status} signal=${result.signal || "none"}\n${result.stdout || ""}\n${result.stderr || ""}`);
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
  return new Promise((resolve) => {
    const child = spawn("docker", [
      "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
      "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    ], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.stdin.end(sql);
  });
}

const read = (folder, name) => fs.readFileSync(path.join(root, "supabase", folder, name), "utf8");
const claims = (actor) => `select set_config('request.jwt.claims', '{"sub":"${actor}","role":"authenticated"}', false); set role authenticated;`;
const parse = (text) => JSON.parse(text.split(/\r?\n/).reverse().find((line) => line.startsWith("{")));
const hash = (value) => Buffer.from(String(value)).toString("hex").padEnd(64, "0").slice(0, 64);
const gitBlobSha256 = (filePath) => crypto.createHash("sha256")
  .update(Buffer.from(fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n"), "utf8"))
  .digest("hex");

const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key, name text not null);
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
`;

async function start(label) {
  const container = `laxhornet-r207b-activation-${label}-${process.pid}`;
  containers.add(container);
  docker(["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=synthetic-only", image]);
  let ready = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const probe = docker(["exec", container, "pg_isready", "-U", "postgres"], { allowFailure: true });
    ready = probe.status === 0 ? ready + 1 : 0;
    if (ready >= 3) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready >= 3, `${label} disposable PostgreSQL target did not become ready`);
  psql(container, bootstrap);
  for (const name of migrations) {
    if (name === "20260730004700_team_members_rls_recursion.sql") {
      psql(container, `
        revoke all privileges on table public.team_members from anon, authenticated, service_role;
        grant truncate, references, trigger, maintain on table public.team_members to anon;
        grant all privileges on table public.team_members to authenticated;
        grant truncate, references, trigger, maintain on table public.team_members to service_role;
      `);
    }
    psql(container, read("migrations", name));
    const match = name.match(/^(\d+)_(.+)\.sql$/);
    assert.ok(match);
    psql(container, `insert into supabase_migrations.schema_migrations values ('${match[1]}','${match[2]}');`);
  }
  return container;
}

function gameInsert(game, owner = OWNER) {
  return `insert into public.games(id,user_id,share_code,opponent,game_date,status,lifecycle_state)
    values ('${game}','${owner}','${game.replace(/[^a-z0-9]/gi, "").slice(0, 8).padEnd(8, "0")}','Initial','2026-08-11','in-progress','active');`;
}

function clockInsert(game) {
  return `insert into public.lh_game_clock_states(
    game_id,owner_user_id,player_id,scope_type,period_format,
    regulation_period_duration_seconds,overtime_duration_seconds,current_period,
    clock_seconds_remaining,is_running,started_at,paused_at,client_updated_at,
    server_updated_at,recovery_state,revision,created_by_user_id,
    anchor_server_at,anchor_clock_seconds_remaining
  ) values (
    '${game}','${OWNER}','synthetic-player','personal','quarters',720,300,'Q1',
    720,false,null,statement_timestamp(),statement_timestamp(),statement_timestamp(),
    'complete',1,'${OWNER}',statement_timestamp(),720
  );`;
}

function legacyRequest(game, opponent = "Legacy accepted") {
  return {
    operation_id: `legacy-${game}`,
    device_id: "synthetic-stale-v285",
    payload_revision: 1,
    game_row: {
      id: game,
      user_id: OWNER,
      share_code: game.replace(/[^a-z0-9]/gi, "").slice(0, 8).padEnd(8, "0"),
      is_shared: false,
      opponent,
      game_date: "2026-08-11",
      location: "Synthetic Field",
      game_type: "Regular season",
      period_format: "quarters",
      player_snapshot: {},
      current_quarter: "Q1",
      status: "in-progress",
      created_at: "2026-08-11T12:00:00Z",
      saved_at: "2026-08-11T12:00:00Z",
    },
  };
}

function gameOperation(id, game, base, changes) {
  return {
    client_operation_id: id,
    game_id: game,
    operation_type: "metadata_patch",
    field_group: "metadata",
    base_version: base,
    changed_fields: Object.keys(changes).sort(),
    changes,
    request_hash: hash(id),
    client_created_at: "2026-08-11T12:05:00Z",
  };
}

function gameCall(container, actor, request) {
  return parse(psql(container, `${claims(actor)} select public.laxhornet_sync_game_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).stdout);
}

function eventCall(container, actor, request) {
  return parse(psql(container, `${claims(actor)} select public.laxhornet_sync_event_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).stdout);
}

function clockCall(container, actor, request) {
  return parse(psql(container, `${claims(actor)} select public.lh_apply_game_clock_operation_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).stdout);
}

function batchCall(container, actor, request) {
  return parse(psql(container, `${claims(actor)} select public.lh_apply_game_clock_batch_v2($json$${JSON.stringify(request)}$json$::jsonb)::text; reset role;`).stdout);
}

try {
  const productionConfig = fs.readFileSync(
    path.join(root, "release", "r2-07-forward-migration-b-runtime-config.js"),
    "utf8",
  );
  const defaultConfig = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");
  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const binding = JSON.parse(fs.readFileSync(path.join(
    root, "review-evidence", "r2-07-forward-migration-b-activation", "ACTIVATION_BINDING.json",
  ), "utf8"));
  const releaseManifest = JSON.parse(fs.readFileSync(path.join(root, "release", "laxhornet-release-manifest.json"), "utf8"));
  check(
    /r207ProductionActivation:\s*true/.test(productionConfig)
      && [
        "r207bControlledPreview", "r207cVersionedEventCorrections",
        "r207dConflictResolution", "r207ClockCommandBatch",
      ].every((flag) => new RegExp(`${flag}:\\s*true`).test(productionConfig))
      && /r207ProductionActivation:\s*false/.test(defaultConfig),
    "production-capable client profile is exact and remains dormant by default",
  );
  check(
    !/supabase\.co|searchParams|query[-_ ]string|debug override/i.test(productionConfig)
      && appSource.includes("r207ProductionActivationConfirmed()")
      && appSource.includes("r207LegacyMutationAvailable()")
      && appSource.includes("client_upgrade_required"),
    "production client has server-authoritative activation, no URL/debug bypass, and no active-state v1 fallback",
  );
  const runtimeEntries = Object.entries(binding.client.runtimeClientFiles);
  const exactRuntimeSet = runtimeEntries.map(([file, expected]) => {
    const actual = gitBlobSha256(path.join(root, file));
    assert.equal(actual, expected, `${file} exact Git-blob hash binding`);
    return `${file}|${actual}`;
  }).join("\n");
  check(
    gitBlobSha256(path.join(root, binding.cutoverGate.path)) === binding.cutoverGate.sha256
      && gitBlobSha256(path.join(root, binding.activation.path)) === binding.activation.sha256
      && gitBlobSha256(path.join(root, binding.recovery.path)) === binding.recovery.sha256
      && crypto.createHash("sha256").update(exactRuntimeSet).digest("hex")
        === binding.client.runtimeClientSetSha256,
    "activation, recovery, and runtime evidence bind canonical exact Git-blob bytes",
  );
  check(
    releaseManifest.r207ForwardMigrationBActivation.cutoverGateMigrationSha256 === binding.cutoverGate.sha256
      && releaseManifest.r207ForwardMigrationBActivation.activationMigrationSha256 === binding.activation.sha256
      && releaseManifest.r207ForwardMigrationBActivation.recoveryArtifactSha256 === binding.recovery.sha256
      && releaseManifest.r207ForwardMigrationBActivation.runtimeClientSetSha256 === binding.client.runtimeClientSetSha256
      && releaseManifest.r207ForwardMigrationBActivation.preActivationRelationShapeMd5 === binding.preActivationCatalog.relationShapeMd5
      && releaseManifest.r207ForwardMigrationBActivation.preActivationPolicyDefinitionMd5 === binding.preActivationCatalog.policyDefinitionMd5
      && releaseManifest.r207ForwardMigrationBActivation.preActivationCutoverGateFunctionMd5 === binding.preActivationCatalog.cutoverGateFunctionMd5
      && releaseManifest.r207ForwardMigrationBActivation.preActivationCutoverTriggerSetMd5 === binding.preActivationCatalog.cutoverTriggerSetMd5
      && releaseManifest.r207ForwardMigrationBActivation.preActivationWriteAuthorizationFunctionMd5 === binding.preActivationCatalog.writeAuthorizationFunctionMd5
      && releaseManifest.r207ForwardMigrationBActivation.preActivationWriterInstrumentationFunctionMd5 === binding.preActivationCatalog.writerInstrumentationFunctionMd5
      && releaseManifest.r207ForwardMigrationBActivation.preActivationWriteAuthorizationRelationMd5 === binding.preActivationCatalog.writeAuthorizationRelationMd5,
    "release manifest binds the exact activation, recovery, runtime set, and relation shape",
  );
  const loadCloudGamesSource = appSource.slice(
    appSource.indexOf("async function loadCloudGames(options = {})"),
    appSource.indexOf("async function refreshCloudGames()"),
  );
  const firstDurableProcessor = loadCloudGamesSource.indexOf("processDurableSyncOperations()");
  const guardedDurableProcessor = loadCloudGamesSource.indexOf(
    "if (!productionActivated) await processDurableSyncOperations();",
  );
  check(
    appSource.indexOf("if (active) return syncGameWithR207Operations(game, options)")
        < appSource.indexOf("const queued = queueLegacyGameOperation(game, options)")
      && appSource.includes("buildCreateOperation")
      && appSource.includes("queueR207VersionedEvent(synchronized, event)")
      && appSource.includes("await r207PreviewCapabilityAvailable({ force: true })")
      && guardedDurableProcessor >= 0
      && guardedDurableProcessor < firstDurableProcessor
      && loadCloudGamesSource.indexOf("syncLocalGamesToCloud({ allowCreate: true })")
        < loadCloudGamesSource.lastIndexOf("processDurableSyncOperations()"),
    "fresh-load production activation routes game creation, field writes, and events to v2 before legacy work",
  );

  const main = await start("main");
  psql(main, `
    insert into auth.users(id,email) values
      ('${OWNER}','owner@example.invalid'),('${OTHER}','other@example.invalid');
    ${gameInsert("metadata-game")}
    ${gameInsert("event-game")}
    ${gameInsert("clock-single")}${clockInsert("clock-single")}
    ${gameInsert("clock-batch")}${clockInsert("clock-batch")}
    ${gameInsert("conflict-game")}
    ${gameInsert("deleted-game")}
    ${gameInsert("recovery-race")}
  `);

  const liveShareHashBefore = psql(main, "select md5(pg_get_functiondef('public.lh_public_live_share_game(text)'::regprocedure));").stdout;
  const legacy = legacyRequest("legacy-game");
  const legacyBefore = parse(psql(main, `${claims(OWNER)} select public.laxhornet_sync_game($json$${JSON.stringify(legacy)}$json$::jsonb)::text; reset role;`).stdout);
  const dormant = gameCall(main, OWNER, gameOperation("dormant", "metadata-game", 1, { opponent: "No" }));
  check(legacyBefore.code === "legacy_game_write_accepted" && dormant.code === "r207_not_activated",
    "pre-activation v1 is active and v2 is dormant");
  check(psql(main, "select has_table_privilege('authenticated','public.games','update')::text||','||has_table_privilege('authenticated','public.events','update')::text;").stdout === "true,true",
    "pre-activation direct legacy grants match the certified envelope");
  const cutoverGateBinding = psql(main, `select
    md5(replace(pg_get_functiondef('public.laxhornet_r207_cutover_write_gate()'::regprocedure), chr(13), ''))||'|'||
    md5(string_agg(pg_get_triggerdef(trigger.oid, true), E'\\n' order by class.relname))
    from pg_trigger as trigger
    join pg_class as class on class.oid=trigger.tgrelid
    join pg_namespace as namespace on namespace.oid=class.relnamespace
    where namespace.nspname='public' and trigger.tgname like 'laxhornet_r207_cutover_%';`).stdout;
  check(cutoverGateBinding === "cff9d350bf904bc083d573dd762edd7f|54c058c1a496ca6dadebe6af88d97c87",
    "pre-activation cutover gate function and triggers match the certified binding", cutoverGateBinding);
  const writerAuthorizationBinding = psql(main, `select
    md5(replace(pg_get_functiondef('lh_sync_private.r207_authorize_versioned_write()'::regprocedure), chr(13), ''))||'|'||
    md5(replace(pg_get_functiondef('lh_sync_private.r207_instrument_versioned_writer(regprocedure)'::regprocedure), chr(13), ''))||'|'||
    md5(string_agg(attribute.attname||'|'||format_type(attribute.atttypid, attribute.atttypmod)||'|'||attribute.attnotnull::text||'|'||coalesce(pg_get_expr(default_value.adbin, default_value.adrelid),''), E'\\n' order by attribute.attnum))
    from pg_class as class
    join pg_namespace as namespace on namespace.oid=class.relnamespace
    join pg_attribute as attribute on attribute.attrelid=class.oid and attribute.attnum>0 and not attribute.attisdropped
    left join pg_attrdef as default_value on default_value.adrelid=class.oid and default_value.adnum=attribute.attnum
    where namespace.nspname='lh_sync_private' and class.relname='r207_write_authorizations';`).stdout;
  check(writerAuthorizationBinding === "71fb779bdb6fbc781421eed30be8db74|4727f35d8a21a0b167a9f9b09f76e89f|bcf664c5e4d80beca53d7998add20398",
    "private versioned-writer authority matches the certified binding", writerAuthorizationBinding);
  check(psql(main, `select
    has_table_privilege('authenticated','lh_sync_private.r207_write_authorizations','select')::text||','||
    has_table_privilege('authenticated','lh_sync_private.r207_write_authorizations','insert')::text||','||
    has_function_privilege('authenticated','lh_sync_private.r207_authorize_versioned_write()','execute')::text||','||
    has_function_privilege('anon','lh_sync_private.r207_authorize_versioned_write()','execute')::text;`).stdout === "false,false,false,false",
    "browser roles cannot forge private versioned-writer authority");

  psql(main, read("migrations", migrationFile));
  psql(main, "insert into supabase_migrations.schema_migrations values ('20260811131043','r207_forward_migration_b_activation');");
  check(true, "activation preconditions accept the exact certified schema");

  const capability = parse(psql(main, `${claims(OWNER)} select public.laxhornet_r207_preview_capability()::text; reset role;`).stdout);
  const stubBefore = psql(main, "select opponent from public.games where id='legacy-game';").stdout;
  const staleResponse = parse(psql(main, `${claims(OWNER)} select public.laxhornet_sync_game($json$${JSON.stringify(legacyRequest("legacy-game", "Must not write"))}$json$::jsonb)::text; reset role;`).stdout);
  const stubAfter = psql(main, "select opponent from public.games where id='legacy-game';").stdout;
  check(capability.enabled === true && capability.productionActivation === true,
    "Forward Migration B enables the authoritative production capability");
  check(staleResponse.code === "client_upgrade_required" && staleResponse.outcome === "rejected",
    "v1 returns the stable bounded client_upgrade_required response");
  check(stubBefore === stubAfter && !JSON.stringify(staleResponse).includes("legacy-game"),
    "stale v285 mutation is rejected without mutation or private game detail");

  const grants = psql(main, `select
    has_table_privilege('authenticated','public.games','insert')::text||','||
    has_table_privilege('authenticated','public.games','update')::text||','||
    has_table_privilege('authenticated','public.events','insert')::text||','||
    has_table_privilege('authenticated','public.events','update')::text||','||
    has_table_privilege('authenticated','public.events','delete')::text||','||
    has_function_privilege('authenticated','public.laxhornet_delete_event(text)','execute')::text||','||
    has_function_privilege('authenticated','public.lh_update_game_clock(jsonb)','execute')::text;`).stdout;
  check(grants === "false,false,false,false,false,false,false",
    "direct game/event grants and legacy event/clock mutation RPCs are revoked");
  check(capability.enabled === true && staleResponse.code === "client_upgrade_required" && grants.startsWith("false,false"),
    "committed state has v2 authority without dual v1/direct authority");

  const metadata = gameCall(main, OWNER, gameOperation("metadata-accepted", "metadata-game", 1, { opponent: "Accepted v2" }));
  check(metadata.outcome === "accepted" && psql(main, "select opponent from public.games where id='metadata-game';").stdout === "Accepted v2",
    "v2 metadata write is accepted after activation");

  const createRequest = {
    client_operation_id: "create-game-v2", game_id: "created-game-v2",
    operation_type: "game_create", field_group: "create",
    game: {
      id: "created-game-v2", player_id: "player-created", team_id: null,
      roster_player_id: null, share_code: "CREATEV2", is_shared: false,
      opponent: "Created opponent", game_date: "2026-08-11", location: "",
      game_type: "league", period_format: "quarters", player_snapshot: {},
      current_quarter: "Q1", status: "in-progress", created_at: NOW,
      saved_at: NOW, ended_at: null, score_for: 0, score_against: 0,
      score_known: false, lifecycle_state: "active",
    },
    client_created_at: NOW,
  };
  createRequest.request_hash = hash(JSON.stringify(createRequest));
  const created = gameCall(main, OWNER, createRequest);
  const createdReplay = gameCall(main, OWNER, createRequest);
  const changedCreateRequest = structuredClone(createRequest);
  changedCreateRequest.game.opponent = "Changed payload";
  const changedCreateReplay = gameCall(main, OWNER, changedCreateRequest);
  check(created.code === "game_created" && createdReplay.replay === true
    && changedCreateReplay.code === "duplicate_operation_id_payload_mismatch"
    && psql(main, "select count(*) from public.games where id='created-game-v2';").stdout === "1",
  "v2 creates a new game idempotently after activation");

  const event = eventCall(main, OWNER, {
    client_operation_id: "event-create", game_id: "event-game", event_id: "event-v2",
    operation_type: "create", base_event_version: 0, expected_game_lifecycle: "active",
    changes: {
      timestamp: "2026-08-11T12:10:00Z", quarter: "Q1", stat_type: "goal",
      stat_label: "Goal", category: "Offense", point_value: 1, tags: [], note: "", field_zone: "",
    },
    client_created_at: "2026-08-11T12:10:00Z",
  });
  check(event.outcome === "accepted" && event.server_event_version === 1,
    "v2 event create is accepted after activation");

  const single = clockCall(main, OWNER, {
    client_operation_id: "clock-start", device_id: "synthetic-device", game_id: "clock-single",
    base_clock_version: 1, status_base_version: 1, expected_lifecycle: "active",
    command: "start", arguments: {}, client_occurred_at: NOW_MINUS_ONE_SECOND,
  });
  check(single.outcome === "accepted" && single.clock_version === 2,
    "v2 clock single command is accepted after activation");

  const batch = batchCall(main, OWNER, {
    client_batch_id: "clock-batch-id", game_id: "clock-batch", base_clock_version: 1,
    status_base_version: 1, expected_lifecycle: "active",
    commands: [
      { client_operation_id: "batch-start", device_id: "synthetic-device", expected_lifecycle: "active", command: "start", arguments: {}, client_occurred_at: NOW_MINUS_ONE_SECOND },
      { client_operation_id: "batch-pause", device_id: "synthetic-device", expected_lifecycle: "active", command: "pause", arguments: {}, client_occurred_at: NOW },
    ],
  });
  check(batch.outcome === "accepted" && batch.code === "clock_batch_accepted" && batch.receipts.length === 2,
    "v2 atomic clock batch is accepted after activation", JSON.stringify(batch));

  const accepted = gameCall(main, OWNER, gameOperation("conflict-first", "conflict-game", 1, { opponent: "Current" }));
  const conflicted = gameCall(main, OWNER, gameOperation("conflict-second", "conflict-game", 1, { opponent: "Proposed" }));
  const readConflict = parse(psql(main, `${claims(OWNER)} select public.laxhornet_read_game_conflicts_v1('{"game_id":"conflict-game"}'::jsonb)::text; reset role;`).stdout).conflicts[0];
  const resolved = parse(psql(main, `${claims(OWNER)} select public.laxhornet_resolve_game_conflict_v1($json$${JSON.stringify({
    client_resolution_operation_id: "resolution-keep", conflict_id: readConflict.conflict_id,
    game_id: "conflict-game", action: "keep_server", expected_versions: readConflict.server_versions,
    patch: {}, client_created_at: "2026-08-11T12:15:00Z", request_hash: hash("resolution-keep"),
  })}$json$::jsonb)::text; reset role;`).stdout);
  check(accepted.outcome === "accepted" && conflicted.outcome === "conflicted",
    "v2 same-field conflict remains immutable and non-overwriting");
  check(resolved.code === "resolution_kept",
    "v2 conflict resolution is accepted after activation");

  const denied = gameCall(main, OTHER, gameOperation("unauthorized", "metadata-game", 2, { opponent: "Probe" }));
  check(denied.code === "authorization_denied" && !JSON.stringify(denied).includes("Accepted v2"),
    "unauthorized v2 actor is blocked without current-value disclosure");

  const deletedAt = "2026-08-11T12:20:00Z";
  const deleteResult = parse(psql(main, `${claims(OWNER)} select public.laxhornet_delete_game_durable($json$${JSON.stringify({
    game_id: "deleted-game", account_id: OWNER, deletion_id: "delete-r207",
    device_id: "synthetic-device", deleted_at: deletedAt, known_game_saved_at: null,
  })}$json$::jsonb)::text; reset role;`).stdout);
  const afterDelete = gameCall(main, OWNER, gameOperation("after-delete", "deleted-game", 1, { opponent: "Resurrect" }));
  check(deleteResult.outcome === "accepted" && afterDelete.code === "game_deleted",
    "durable tombstone precedence still outranks activated v2 writes");

  const rls = psql(main, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('r207_preview_control','game_sync_operations','game_sync_operation_attempts','game_field_changes','game_conflicts','game_conflict_resolutions','legacy_event_sync_operations','legacy_event_sync_operation_attempts','legacy_event_field_changes','legacy_event_tombstones','game_clock_commands','game_clock_batches')
      and c.relrowsecurity and c.relforcerowsecurity;`).stdout;
  check(rls === "12" && psql(main, "select has_table_privilege('anon','public.game_conflicts','select');").stdout === "f",
    "activation preserves RLS, FORCE RLS, and anonymous conflict isolation");
  check(psql(main, "select md5(pg_get_functiondef('public.lh_public_live_share_game(text)'::regprocedure));").stdout === liveShareHashBefore,
    "Live Share function bytes are unchanged by activation");

  const replay = psql(main, read("migrations", migrationFile), true);
  check(replay.status !== 0 && /R207_ACTIVATION_ALREADY_APPLIED/.test(replay.stderr),
    "activation replay deterministically refuses without recreating legacy grants");

  const drift = await start("drift");
  psql(drift, "alter function public.laxhornet_sync_game(jsonb) security definer;");
  const driftApply = psql(drift, read("migrations", migrationFile), true);
  check(driftApply.status !== 0 && /FUNCTION_DRIFT:public.laxhornet_sync_game\(jsonb\)/.test(driftApply.stderr)
    && psql(drift, "select preview_enabled from public.r207_preview_control where control_id;").stdout === "f",
  "certified-schema drift refuses before capability activation");

  const policyDrift = await start("policy-drift");
  psql(policyDrift, "drop policy \"laxhornet insert own games\" on public.games; create policy r207_permissive_probe on public.games for insert to authenticated with check (true);");
  const policyDriftApply = psql(policyDrift, read("migrations", migrationFile), true);
  check(policyDriftApply.status !== 0 && /POLICY_DRIFT/.test(policyDriftApply.stderr),
    "policy-definition drift refuses before capability activation");

  const rlsDrift = await start("rls-drift");
  psql(rlsDrift, "alter table public.games disable row level security;");
  const rlsDriftApply = psql(rlsDrift, read("migrations", migrationFile), true);
  check(rlsDriftApply.status !== 0 && /RLS_DRIFT:games/.test(rlsDriftApply.stderr),
    "critical-table RLS drift refuses before capability activation");

  const failure = await start("failure");
  const injected = read("migrations", migrationFile).replace(
    "-- R207_ACTIVATION_FAILURE_INJECTION_BOUNDARY",
    "do $injected$ begin raise exception 'R207_SYNTHETIC_ACTIVATION_FAILURE'; end; $injected$;",
  );
  const failedApply = psql(failure, injected, true);
  const failedState = psql(failure, `select preview_enabled::text||','||
    has_table_privilege('authenticated','public.games','update')::text||','||
    (md5(replace(
      pg_get_functiondef('public.laxhornet_sync_game(jsonb)'::regprocedure),
      chr(13),
      ''
    ))='b768a13ed661414af84c72f16194c0b6')::text
    from public.r207_preview_control where control_id;`).stdout;
  check(failedApply.status !== 0 && /R207_SYNTHETIC_ACTIVATION_FAILURE/.test(failedApply.stderr)
    && failedState === "false,true,true",
  "mid-transaction failure rolls back capability, grants, and v1 function together");

  const activationRace = await start("activation-race");
  psql(activationRace, `insert into auth.users(id,email) values ('${OWNER}','race@example.invalid'); ${gameInsert("activation-race-game")}`);
  const legacyWriter = psqlAsync(activationRace, `begin;
    update public.games set opponent='legacy transaction completed' where id='activation-race-game';
    select pg_sleep(2); commit;`);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const activationStartedAt = Date.now();
  psql(activationRace, read("migrations", migrationFile));
  const activationElapsedMs = Date.now() - activationStartedAt;
  const legacyWriterResult = await legacyWriter;
  check(legacyWriterResult.status === 0 && activationElapsedMs >= 1200,
    "activation drains an in-flight legacy RowExclusive writer before v2 authority commits",
    `elapsed=${activationElapsedMs} stderr=${legacyWriterResult.stderr}`);

  const arrivalRace = await start("activation-arrival-race");
  psql(arrivalRace, `insert into auth.users(id,email) values ('${OWNER}','arrival@example.invalid');
    ${gameInsert("activation-arrival-game")}${clockInsert("activation-arrival-game")}`);
  const pausedActivationSql = read("migrations", migrationFile).replace(
    "lock table public.lh_game_clock_states in share row exclusive mode;",
    "lock table public.lh_game_clock_states in share row exclusive mode; select pg_sleep(2);",
  );
  const arrivingActivation = psqlAsync(arrivalRace, pausedActivationSql);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const staleClockPayload = {
    game_id: "activation-arrival-game",
    base_revision: 1,
    current_period: "Q1",
    clock_seconds_remaining: 719,
    is_running: false,
    started_at: null,
    paused_at: "2026-08-11T12:00:01Z",
    client_updated_at: "2026-08-11T12:00:01Z",
    recovery_state: "complete",
  };
  const arrivingLegacyClock = psqlAsync(arrivalRace, `${claims(OWNER)}
    select public.lh_update_game_clock($json$${JSON.stringify(staleClockPayload)}$json$::jsonb)::text;
    reset role;`);
  const arrivingDirectWrite = psqlAsync(arrivalRace, `${claims(OWNER)}
    update public.games set opponent='queued direct write' where id='activation-arrival-game';
    reset role;`);
  const arrivingActivationResult = await arrivingActivation;
  const arrivingLegacyClockResult = await arrivingLegacyClock;
  const arrivingDirectWriteResult = await arrivingDirectWrite;
  const arrivalClockState = psql(arrivalRace, `select revision||','||clock_seconds_remaining
    from public.lh_game_clock_states where game_id='activation-arrival-game';`).stdout;
  const arrivalOpponent = psql(arrivalRace, `select opponent from public.games
    where id='activation-arrival-game';`).stdout;
  check(arrivingActivationResult.status === 0
    && arrivingLegacyClockResult.status !== 0
    && arrivingDirectWriteResult.status !== 0
    && arrivalClockState === "1,720"
    && arrivalOpponent === "Initial",
  "legacy RPC and direct DML arriving during activation cannot commit after v2 authority",
  `rpc_status=${arrivingLegacyClockResult.status} direct_status=${arrivingDirectWriteResult.status} clock=${arrivalClockState} opponent=${arrivalOpponent}`);

  const raceOperation = gameOperation("recovery-race-operation", "recovery-race", 1, { opponent: "Drained before recovery" });
  const inFlight = psqlAsync(main, `begin; ${claims(OWNER)}
    select public.laxhornet_sync_game_v2($json$${JSON.stringify(raceOperation)}$json$::jsonb)::text;
    select pg_sleep(2); commit; reset role;`);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const recoveryStartedAt = Date.now();
  psql(main, read("rollback", recoveryFile));
  const recoveryElapsedMs = Date.now() - recoveryStartedAt;
  const inFlightResult = await inFlight;
  check(inFlightResult.status === 0 && recoveryElapsedMs >= 1200,
    "recovery drains an in-flight v2 writer before fail-closed completion",
    `elapsed=${recoveryElapsedMs} stderr=${inFlightResult.stderr}`);
  const recoveryState = psql(main, `select preview_enabled::text||','||
    has_function_privilege('authenticated','public.laxhornet_sync_game_v2(jsonb)','execute')::text||','||
    has_table_privilege('authenticated','public.games','update')::text
    from public.r207_preview_control where control_id;`).stdout;
  const recoveredStub = parse(psql(main, `${claims(OWNER)} select public.laxhornet_sync_game('{}'::jsonb)::text; reset role;`).stdout);
  check(recoveryState === "false,false,false" && recoveredStub.code === "client_upgrade_required",
    "post-evidence recovery fail-closes v2 and retains the v1 upgrade stub");
  check(!psql(main, "select has_function_privilege('authenticated','public.laxhornet_delete_event(text)','execute');").stdout.includes("t"),
    "recovery never restores last-write-wins event, game, or clock mutation");

  check(checks >= 20, `all permanent activation scenarios executed (${checks})`);
  console.log(`R2-07 Forward Migration B disposable activation certification: PASS (${checks} checks)`);
} finally {
  for (const container of containers) docker(["rm", "-f", container], { allowFailure: true });
  const listResidue = () => docker([
    "ps", "-a", "--filter", "name=laxhornet-r207b-activation-", "--format", "{{.Names}}",
  ], { allowFailure: true }).stdout.trim();
  let residue = listResidue();
  for (const container of residue.split(/\r?\n/).filter(Boolean)) {
    docker(["rm", "-f", container], { allowFailure: true });
  }
  residue = listResidue();
  assert.equal(residue, "", `disposable activation container residue remains: ${residue}`);
  console.log("PASS: disposable activation certification left zero container residue");
}
