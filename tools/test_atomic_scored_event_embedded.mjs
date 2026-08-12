import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const { PGlite } = await import(
  process.env.LAXHORNET_PGLITE_MODULE || "@electric-sql/pglite"
);

const root = path.resolve(import.meta.dirname, "..");
const migrationNames = [
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
const OWNER = "00000000-0000-4000-8000-00000000000a";
const OTHER = "00000000-0000-4000-8000-00000000000b";
let checks = 0;

const read = (folder, file) => fs.readFileSync(path.join(root, "supabase", folder, file), "utf8");
const compatible = (sql) => sql.replace(
  /^create extension if not exists pgcrypto with schema extensions;\s*$/gim,
  "-- Embedded harness supplies the digest signature; Supabase Preview supplies pgcrypto.",
);
const check = (condition, label, evidence = null) => {
  assert.ok(condition, evidence ? `${label}: ${JSON.stringify(evidence)}` : label);
  checks += 1;
  console.log(`PASS: ${label}`);
};

async function bootstrap(db) {
  await db.exec(`
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
    create function extensions.digest(value bytea, algorithm text)
    returns bytea language sql immutable strict as $$
      select decode(md5(encode(value, 'hex')) || md5(encode(value, 'hex')), 'hex')
    $$;
    grant usage on schema auth, extensions to anon, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
    create publication supabase_realtime;
  `);
  for (const name of migrationNames) {
    await db.exec(compatible(read("migrations", name)));
  }
  await db.exec(read("", "seed.sql"));
}

async function asAccount(db, actor, request) {
  await db.exec("reset role");
  await db.exec(`select set_config(
    'request.jwt.claims',
    '{"sub":"${actor}","role":"authenticated"}',
    false
  )`);
  await db.exec("set role authenticated");
  try {
    const result = await db.query(
      "select public.laxhornet_apply_scored_event_v1($1::jsonb) as result",
      [JSON.stringify(request)],
    );
    return result.rows[0].result;
  } finally {
    await db.exec("reset role");
  }
}

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

const db = new PGlite();
try {
  await bootstrap(db);
  await db.exec(`
    insert into auth.users(id,email) values
      ('${OWNER}','owner@example.invalid'),
      ('${OTHER}','other@example.invalid');
    insert into public.games(
      id,user_id,share_code,opponent,game_date,status,lifecycle_state,
      score_for,score_against,score_known
    ) values
      ('game-a','${OWNER}','LH25GAMEA','Synthetic A','2026-08-12','in-progress','active',0,0,true),
      ('game-complete','${OWNER}','LH25DONE','Synthetic Complete','2026-08-12','complete','completed',2,1,true);
  `);

  const createRequest = operation({ id: "atomic-create-a", eventId: "event-a" });
  const created = await asAccount(db, OWNER, createRequest);
  check(created.outcome === "accepted" && created.code === "scored_event_created",
    "scored-event create is accepted", created);

  let state = await db.query("select score_for, score_against, score_version from public.games where id='game-a'");
  check(state.rows[0].score_for === 1 && state.rows[0].score_against === 0
    && Number(state.rows[0].score_version) === 2,
  "Goal increments the canonical score exactly once", state.rows[0]);
  let rows = await db.query("select count(*)::int as count from public.events where id='event-a'");
  check(rows.rows[0].count === 1, "Goal creates one canonical event head");

  const replay = await asAccount(db, OWNER, createRequest);
  state = await db.query("select score_for, score_version from public.games where id='game-a'");
  check(replay.replay === true && state.rows[0].score_for === 1
    && Number(state.rows[0].score_version) === 2,
  "lost-response replay cannot duplicate the score effect", replay);

  const tampered = await asAccount(db, OWNER, {
    ...createRequest,
    changes: event({ note: "changed payload" }),
  });
  check(tampered.code === "duplicate_operation_id_payload_mismatch",
    "same identity with a changed payload is rejected", tampered);
  rows = await db.query(`
    select count(*)::int as count
    from public.atomic_scored_event_operation_attempts
    where attempt_code='duplicate_operation_id_payload_mismatch'
  `);
  check(rows.rows[0].count === 1, "tamper attempt is append-only evidence");

  const unauthorized = await asAccount(db, OTHER, operation({
    id: "atomic-private", eventId: "event-private", scoreVersion: 2,
  }));
  check(unauthorized.code === "authorization_denied"
    && Object.keys(unauthorized).sort().join(",") === "code,outcome",
  "unauthorized response is bounded and non-enumerating", unauthorized);

  const stale = await asAccount(db, OWNER, operation({
    id: "atomic-stale", eventId: "event-stale", scoreVersion: 1,
  }));
  rows = await db.query("select count(*)::int as count from public.events where id='event-stale'");
  check(stale.code === "stale_score_version" && rows.rows[0].count === 0,
    "stale score base conflicts before event mutation", stale);

  const injectedAfterEventRequest = operation({
    id: "atomic-injected-event", eventId: "event-injected-event", scoreVersion: 2,
  });
  await db.exec(`select set_config(
    'request.jwt.claims', '{"sub":"${OWNER}","role":"authenticated"}', false
  )`);
  const injectedAfterEvent = await db.query(
    "select lh_sync_private.r207_apply_atomic_scored_event($1::jsonb, true, false) as result",
    [JSON.stringify(injectedAfterEventRequest)],
  );
  check(injectedAfterEvent.rows[0].result.code === "injected_after_event",
    "post-event injected failure returns a bounded rejection", injectedAfterEvent.rows[0].result);

  const injectedAfterScoreRequest = operation({
    id: "atomic-injected-score", eventId: "event-injected-score", scoreVersion: 2,
  });
  const injectedAfterScore = await db.query(
    "select lh_sync_private.r207_apply_atomic_scored_event($1::jsonb, false, true) as result",
    [JSON.stringify(injectedAfterScoreRequest)],
  );
  check(injectedAfterScore.rows[0].result.code === "injected_after_score",
    "post-score injected failure returns a bounded rejection", injectedAfterScore.rows[0].result);
  rows = await db.query(`
    select
      (select count(*)::int from public.events where id in ('event-injected-event','event-injected-score')) as events,
      (select count(*)::int from public.legacy_event_sync_operations
        where client_operation_id in ('atomic-injected-event:event','atomic-injected-score:event')) as event_ops,
      (select count(*)::int from public.game_sync_operations
        where client_operation_id='atomic-injected-score:score') as score_ops,
      (select score_for from public.games where id='game-a') as score_for
  `);
  check(rows.rows[0].events === 0 && rows.rows[0].event_ops === 0
    && rows.rows[0].score_ops === 0 && rows.rows[0].score_for === 1,
    "child failure rolls back event, score, and child journals", rows.rows[0]);

  const corrected = await asAccount(db, OWNER, operation({
    id: "atomic-correct-a",
    eventId: "event-a",
    action: "correct",
    changes: { stat_type: "goalAllowed", stat_label: "Goal Allowed", category: "Defense" },
    eventVersion: 1,
    scoreVersion: 2,
  }));
  check(corrected.code === "scored_event_corrected",
    "scoring-type correction is accepted", corrected);
  state = await db.query("select score_for, score_against, score_version from public.games where id='game-a'");
  check(state.rows[0].score_for === 0 && state.rows[0].score_against === 1
    && Number(state.rows[0].score_version) === 3,
  "correction applies one server-derived net delta", state.rows[0]);

  const tombstoneRequest = operation({
    id: "atomic-undo-a", eventId: "event-a", action: "tombstone",
    eventVersion: 2, scoreVersion: 3,
  });
  const tombstoned = await asAccount(db, OWNER, tombstoneRequest);
  check(tombstoned.code === "scored_event_tombstoned",
    "Undo tombstones the event", tombstoned);
  const tombstoneReplay = await asAccount(db, OWNER, tombstoneRequest);
  state = await db.query("select score_for, score_against, score_version from public.games where id='game-a'");
  check(tombstoneReplay.replay === true && state.rows[0].score_for === 0
    && state.rows[0].score_against === 0 && Number(state.rows[0].score_version) === 4,
  "repeated Undo cannot reverse the score twice", state.rows[0]);

  const complete = await asAccount(db, OWNER, operation({
    id: "atomic-complete", eventId: "event-complete", gameId: "game-complete",
    lifecycle: "completed",
  }));
  check(complete.code === "completed_game_event_append_rejected",
    "completed-game append is rejected atomically", complete);

  const acl = await db.query(`
    select
      has_table_privilege('authenticated','public.atomic_scored_event_operations','select') as table_read,
      has_function_privilege('authenticated','public.laxhornet_apply_scored_event_v1(jsonb)','execute') as auth_exec,
      has_function_privilege('anon','public.laxhornet_apply_scored_event_v1(jsonb)','execute') as anon_exec,
      (select relrowsecurity and relforcerowsecurity from pg_class
        where oid='public.atomic_scored_event_operations'::regclass) as forced_rls
  `);
  check(acl.rows[0].table_read === false && acl.rows[0].auth_exec === true
    && acl.rows[0].anon_exec === false && acl.rows[0].forced_rls === true,
  "parent evidence is FORCE RLS and the RPC is authenticated-only", acl.rows[0]);

  let rollbackRefused = false;
  try {
    await db.exec(read("rollback", "20260812005627_atomic_scored_event_command_rollback.sql"));
  } catch (error) {
    rollbackRefused = /LH25_ATOMIC_SCORED_EVENT_ROLLBACK_REFUSED/.test(String(error));
  }
  check(rollbackRefused, "rollback refuses after accepted immutable evidence");

  console.log(`LH-25 embedded atomic scored-event matrix: ${checks}/${checks} passed`);
  console.log("REAL_POSTGRES_CONCURRENCY: REQUIRED_FROM_ISOLATED_SUPABASE_PREVIEW_AND_EXACT_SHA_REVIEW");
} finally {
  await db.close();
}
