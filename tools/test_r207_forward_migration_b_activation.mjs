import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

const read = (folder, name) => fs.readFileSync(path.join(root, "supabase", folder, name), "utf8");
const claims = (actor) => `select set_config('request.jwt.claims', '{"sub":"${actor}","role":"authenticated"}', false); set role authenticated;`;
const parse = (text) => JSON.parse(text.split(/\r?\n/).reverse().find((line) => line.startsWith("{")));
const hash = (value) => Buffer.from(String(value)).toString("hex").padEnd(64, "0").slice(0, 64);

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
  `);

  const liveShareHashBefore = psql(main, "select md5(pg_get_functiondef('public.lh_public_live_share_game(text)'::regprocedure));").stdout;
  const legacy = legacyRequest("legacy-game");
  const legacyBefore = parse(psql(main, `${claims(OWNER)} select public.laxhornet_sync_game($json$${JSON.stringify(legacy)}$json$::jsonb)::text; reset role;`).stdout);
  const dormant = gameCall(main, OWNER, gameOperation("dormant", "metadata-game", 1, { opponent: "No" }));
  check(legacyBefore.code === "legacy_game_write_accepted" && dormant.code === "r207_not_activated",
    "pre-activation v1 is active and v2 is dormant");
  check(psql(main, "select has_table_privilege('authenticated','public.games','update')::text||','||has_table_privilege('authenticated','public.events','update')::text;").stdout === "true,true",
    "pre-activation direct legacy grants match the certified envelope");

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

  psql(main, read("rollback", recoveryFile));
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
  const residue = docker([
    "ps", "-a", "--filter", "name=laxhornet-r207b-activation-", "--format", "{{.Names}}",
  ], { allowFailure: true }).stdout.trim();
  assert.equal(residue, "", `disposable activation container residue remains: ${residue}`);
  console.log("PASS: disposable activation certification left zero container residue");
}
