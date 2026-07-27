\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(37);

select extensions.has_table('public', 'lh_game_clock_states', 'clock table exists');
select extensions.has_table('public', 'lh_participation_logical_events', 'logical event table exists');
select extensions.has_table('public', 'lh_participation_operations', 'operation table exists');
select extensions.has_view('public', 'lh_effective_participation_operations', 'effective view exists');
select extensions.ok(
  not has_table_privilege('anon', 'public.lh_game_clock_states', 'select'),
  'anonymous role cannot read clock state'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.lh_participation_operations', 'select'),
  'anonymous role cannot read participation operations'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.lh_participation_operations', 'select'),
  'authenticated browser role cannot bypass private RPCs'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.lh_effective_participation_operations', 'select'),
  'anonymous role cannot read the effective participation view'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.lh_initialize_game_clock(jsonb)', 'execute'),
  'anonymous role cannot initialize clocks'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.lh_initialize_game_clock(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.lh_reconcile_participation_operations(jsonb)', 'execute'),
  'authenticated role can use the bounded private RPCs'
);

insert into auth.users(id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'tracked-owner@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'tracked-other@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'tracked-admin@example.test')
on conflict (id) do nothing;

insert into public.games(
  id,
  player_id,
  user_id,
  share_code,
  opponent,
  game_date,
  period_format,
  player_snapshot,
  current_quarter,
  status
)
values
  (
    'tracked-personal-a',
    'personal-player-a',
    '11111111-1111-4111-8111-111111111111',
    'TRACKED-PERSONAL-A',
    'Synthetic Opponent',
    date '2026-07-27',
    'quarters',
    '{"name":"Synthetic Player A"}'::jsonb,
    'Q1',
    'in-progress'
  ),
  (
    'tracked-personal-b',
    'personal-player-b',
    '22222222-2222-4222-8222-222222222222',
    'TRACKED-PERSONAL-B',
    'Synthetic Opponent',
    date '2026-07-27',
    'halves',
    '{"name":"Synthetic Player B"}'::jsonb,
    'H1',
    'in-progress'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_initialize_game_clock(
    '{
      "game_id":"tracked-personal-a",
      "period_format":"quarters",
      "regulation_period_duration_seconds":720,
      "overtime_duration_seconds":240,
      "current_period":"Q1",
      "clock_seconds_remaining":720,
      "is_running":false,
      "started_at":null,
      "paused_at":null,
      "client_updated_at":"2026-07-27T12:00:00Z",
      "recovery_state":"complete"
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'cross-account clock initialization is rejected neutrally'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_initialize_game_clock(
    '{
      "game_id":"tracked-personal-a",
      "period_format":"quarters",
      "regulation_period_duration_seconds":720,
      "overtime_duration_seconds":240,
      "current_period":"Q1",
      "clock_seconds_remaining":720,
      "is_running":false,
      "started_at":null,
      "paused_at":null,
      "client_updated_at":"2026-07-27T12:00:00Z",
      "recovery_state":"complete"
    }'::jsonb
  ) ->> 'code',
  'clock_initialized',
  'personal owner initializes clock'
);
select extensions.is(
  (public.lh_read_game_clock('tracked-personal-a') -> 'clockState' ->> 'periodFormat'),
  'quarters',
  'quarters clock configuration persists'
);
select extensions.is(
  public.lh_initialize_game_clock(
    '{
      "game_id":"tracked-personal-a",
      "period_format":"quarters",
      "regulation_period_duration_seconds":720,
      "overtime_duration_seconds":240,
      "current_period":"Q1",
      "clock_seconds_remaining":720,
      "is_running":false,
      "client_updated_at":"2026-07-27T12:00:00Z",
      "recovery_state":"complete"
    }'::jsonb
  ) ->> 'code',
  'clock_exists',
  'clock initialization is idempotent'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_read_game_clock('tracked-personal-a') ->> 'code',
  'unauthorized_scope',
  'cross-account clock read is rejected neutrally'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_read_game_clock('tracked-personal-a') ->> 'code',
  'clock_read',
  'personal owner reads clock'
);
select extensions.is(
  public.lh_update_game_clock(
    '{
      "game_id":"tracked-personal-a",
      "base_revision":1,
      "current_period":"Q1",
      "clock_seconds_remaining":660,
      "is_running":true,
      "started_at":"2026-07-27T12:00:00Z",
      "paused_at":null,
      "client_updated_at":"2026-07-27T12:01:00Z",
      "recovery_state":"needs_review"
    }'::jsonb
  ) ->> 'code',
  'clock_updated',
  'authorized clock update persists running state'
);
select extensions.is(
  public.lh_update_game_clock(
    '{
      "game_id":"tracked-personal-a",
      "base_revision":1,
      "current_period":"Q1",
      "clock_seconds_remaining":650,
      "is_running":true,
      "started_at":"2026-07-27T12:00:00Z",
      "paused_at":null,
      "client_updated_at":"2026-07-27T12:01:10Z",
      "recovery_state":"complete"
    }'::jsonb
  ) ->> 'code',
  'stale_clock_revision',
  'stale clock revision cannot overwrite newer state'
);
select extensions.is(
  (public.lh_read_game_clock('tracked-personal-a') -> 'clockState' ->> 'recoveryState'),
  'needs_review',
  'clock recovery state persists'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select extensions.is(
  (public.lh_initialize_game_clock(
    '{
      "game_id":"tracked-personal-b",
      "period_format":"halves",
      "regulation_period_duration_seconds":1200,
      "overtime_duration_seconds":240,
      "current_period":"H1",
      "clock_seconds_remaining":1200,
      "is_running":false,
      "client_updated_at":"2026-07-27T12:00:00Z",
      "recovery_state":"complete"
    }'::jsonb
  ) -> 'clockState' ->> 'periodFormat'),
  'halves',
  'halves clock configuration is supported'
);

insert into public.teams(id, name, invite_code, tracker_code, created_by)
values (
  'tracked-team-a',
  'Synthetic Hornets',
  'TRACKEDA',
  'TRACKER-A',
  '33333333-3333-4333-8333-333333333333'
);
insert into public.team_members(id, team_id, user_id, role)
values (
  'tracked-admin-member',
  'tracked-team-a',
  '33333333-3333-4333-8333-333333333333',
  'admin'
);
insert into public.roster_players(id, team_id, name, number, position, active)
values ('tracked-roster-a', 'tracked-team-a', 'Synthetic Roster Player', '12', 'Midfield', true);
insert into public.player_claims(id, team_id, roster_player_id, user_id)
values (
  'tracked-player-claim',
  'tracked-team-a',
  'tracked-roster-a',
  '11111111-1111-4111-8111-111111111111'
);
insert into public.games(
  id,
  player_id,
  user_id,
  share_code,
  opponent,
  game_date,
  period_format,
  player_snapshot,
  current_quarter,
  status,
  team_id,
  roster_player_id
)
values (
  'tracked-team-game-a',
  'tracked-roster-a',
  '11111111-1111-4111-8111-111111111111',
  'TRACKED-TEAM-A',
  'Synthetic Team Opponent',
  date '2026-07-27',
  'quarters',
  '{"name":"Synthetic Roster Player","number":"12"}'::jsonb,
  'Q1',
  'in-progress',
  'tracked-team-a',
  'tracked-roster-a'
);

insert into public.lh_team_scopes(team_id, team_name_snapshot)
values ('tracked-team-a', 'Synthetic Hornets');
insert into public.lh_player_scopes(
  team_id,
  roster_player_id,
  player_name_snapshot,
  jersey_snapshot,
  position_snapshot
)
values ('tracked-team-a', 'tracked-roster-a', 'Synthetic Roster Player', '12', 'Midfield');
insert into public.lh_game_scopes(
  game_id,
  team_id,
  roster_player_id,
  opponent_snapshot,
  game_date_snapshot,
  period_format_snapshot
)
values (
  'tracked-team-game-a',
  'tracked-team-a',
  'tracked-roster-a',
  'Synthetic Team Opponent',
  date '2026-07-27',
  'quarters'
);

insert into public.lh_access_grants(
  id,
  user_id,
  role,
  scope_type,
  team_id,
  provenance_type,
  issued_by_user_id,
  issued_at
)
values (
  'tracked-grant-admin',
  '33333333-3333-4333-8333-333333333333',
  'team_admin',
  'team',
  'tracked-team-a',
  'system_bootstrap',
  '33333333-3333-4333-8333-333333333333',
  timestamptz '2026-07-27 10:00:00+00'
);
insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, occurred_at
)
values
  (
    'tracked-admin-issued',
    'tracked-grant-admin',
    1,
    'issued',
    '33333333-3333-4333-8333-333333333333',
    timestamptz '2026-07-27 10:00:00+00'
  ),
  (
    'tracked-admin-accepted',
    'tracked-grant-admin',
    2,
    'accepted',
    '33333333-3333-4333-8333-333333333333',
    timestamptz '2026-07-27 10:01:00+00'
  );
insert into public.lh_access_invitations(
  id,
  invited_user_id,
  invited_email,
  role,
  scope_type,
  team_id,
  roster_player_id,
  invited_by_user_id,
  invited_by_grant_id,
  status,
  accepted_at,
  created_at
)
values (
  'tracked-parent-invite',
  '11111111-1111-4111-8111-111111111111',
  'tracked-owner@example.test',
  'parent',
  'player',
  'tracked-team-a',
  'tracked-roster-a',
  '33333333-3333-4333-8333-333333333333',
  'tracked-grant-admin',
  'accepted',
  timestamptz '2026-07-27 10:02:00+00',
  timestamptz '2026-07-27 10:01:00+00'
);
insert into public.lh_access_grants(
  id,
  user_id,
  role,
  scope_type,
  team_id,
  roster_player_id,
  provenance_type,
  invitation_id,
  issued_by_user_id,
  issued_by_grant_id,
  issued_at
)
values (
  'tracked-grant-parent',
  '11111111-1111-4111-8111-111111111111',
  'parent',
  'player',
  'tracked-team-a',
  'tracked-roster-a',
  'invitation',
  'tracked-parent-invite',
  '33333333-3333-4333-8333-333333333333',
  'tracked-grant-admin',
  timestamptz '2026-07-27 10:02:00+00'
);
insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, actor_grant_id, occurred_at
)
values
  (
    'tracked-parent-issued',
    'tracked-grant-parent',
    1,
    'issued',
    '33333333-3333-4333-8333-333333333333',
    'tracked-grant-admin',
    timestamptz '2026-07-27 10:02:00+00'
  ),
  (
    'tracked-parent-accepted',
    'tracked-grant-parent',
    2,
    'accepted',
    '11111111-1111-4111-8111-111111111111',
    'tracked-grant-parent',
    timestamptz '2026-07-27 10:03:00+00'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_initialize_game_clock(
    '{
      "game_id":"tracked-team-game-a",
      "period_format":"quarters",
      "regulation_period_duration_seconds":600,
      "overtime_duration_seconds":180,
      "current_period":"Q1",
      "clock_seconds_remaining":600,
      "is_running":false,
      "client_updated_at":"2026-07-27T13:00:00Z",
      "recovery_state":"complete"
    }'::jsonb
  ) ->> 'code',
  'clock_initialized',
  'authorized team-roster tracker initializes clock'
);
select extensions.is(
  (public.lh_read_game_clock('tracked-team-game-a') -> 'clockState' ->> 'scopeType'),
  'team_roster',
  'team-roster scope is stored explicitly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_update_game_clock(
    '{
      "game_id":"tracked-team-game-a",
      "base_revision":1,
      "current_period":"Q1",
      "clock_seconds_remaining":590,
      "is_running":true,
      "started_at":"2026-07-27T13:00:00Z",
      "client_updated_at":"2026-07-27T13:00:10Z",
      "recovery_state":"complete"
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'cross-team or ungranted clock mutation is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_create_participation_operation(
    '{
      "operation_id":"tracked-op-in-1",
      "client_operation_id":"tracked-client-in-1",
      "logical_event_id":"tracked-logical-in-1",
      "game_id":"tracked-team-game-a",
      "operation_kind":"player_in",
      "player_id":"tracked-roster-a",
      "period":"Q1",
      "game_clock_seconds":600,
      "occurred_at":"2026-07-27T13:00:00Z",
      "client_created_at":"2026-07-27T13:00:00Z",
      "source":"live",
      "system_close_reason":null,
      "recovery_uncertain":false
    }'::jsonb
  ) ->> 'code',
  'participation_operation_created',
  'authorized player-in operation succeeds'
);
select extensions.is(
  public.lh_create_participation_operation(
    '{
      "operation_id":"tracked-op-out-1",
      "client_operation_id":"tracked-client-out-1",
      "logical_event_id":"tracked-logical-out-1",
      "game_id":"tracked-team-game-a",
      "operation_kind":"player_out",
      "player_id":"tracked-roster-a",
      "period":"Q1",
      "game_clock_seconds":450,
      "occurred_at":"2026-07-27T13:02:30Z",
      "client_created_at":"2026-07-27T13:02:30Z",
      "source":"live",
      "system_close_reason":null,
      "recovery_uncertain":false
    }'::jsonb
  ) ->> 'code',
  'participation_operation_created',
  'authorized player-out operation succeeds'
);
select extensions.is(
  public.lh_create_participation_operation(
    '{
      "operation_id":"tracked-op-in-1",
      "client_operation_id":"tracked-client-in-1",
      "logical_event_id":"tracked-logical-in-1",
      "game_id":"tracked-team-game-a",
      "operation_kind":"player_in",
      "player_id":"tracked-roster-a",
      "period":"Q1",
      "game_clock_seconds":600,
      "occurred_at":"2026-07-27T13:00:00Z",
      "client_created_at":"2026-07-27T13:00:00Z",
      "source":"live",
      "system_close_reason":null,
      "recovery_uncertain":false
    }'::jsonb
  ) ->> 'code',
  'operation_replayed',
  'duplicate client operation ID is idempotent'
);
select extensions.is(
  public.lh_create_participation_operation(
    '{
      "operation_id":"tracked-op-wrong-player",
      "client_operation_id":"tracked-client-wrong-player",
      "logical_event_id":"tracked-logical-wrong-player",
      "game_id":"tracked-team-game-a",
      "operation_kind":"player_in",
      "player_id":"tracked-roster-other",
      "period":"Q1",
      "game_clock_seconds":440,
      "occurred_at":"2026-07-27T13:02:40Z",
      "client_created_at":"2026-07-27T13:02:40Z",
      "source":"live",
      "system_close_reason":null,
      "recovery_uncertain":false
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'cross-player participation write is rejected neutrally'
);
select extensions.is(
  public.lh_correct_participation_operation(
    '{
      "operation_id":"tracked-op-in-correct-1",
      "client_operation_id":"tracked-client-in-correct-1",
      "logical_event_id":"tracked-logical-in-1",
      "target_operation_id":"tracked-op-in-1",
      "game_id":"tracked-team-game-a",
      "operation_kind":"correct",
      "period":"Q1",
      "game_clock_seconds":580,
      "occurred_at":"2026-07-27T13:00:20Z",
      "client_created_at":"2026-07-27T13:05:00Z",
      "source":"manual",
      "recovery_uncertain":true,
      "change_reason":"Correct missed tap"
    }'::jsonb
  ) ->> 'code',
  'participation_operation_corrected',
  'correction appends a revision'
);
select extensions.is(
  (select count(*)::integer from public.lh_participation_operations),
  3,
  'correction preserves the two original operations'
);
select extensions.is(
  (
    public.lh_list_effective_participation('tracked-team-game-a')
      -> 'operations' -> 0 ->> 'revision'
  )::integer,
  2,
  'effective resolver returns the corrected revision'
);
select extensions.is(
  public.lh_tombstone_participation_operation(
    '{
      "operation_id":"tracked-op-out-tombstone-1",
      "client_operation_id":"tracked-client-out-tombstone-1",
      "logical_event_id":"tracked-logical-out-1",
      "target_operation_id":"tracked-op-out-1",
      "game_id":"tracked-team-game-a",
      "operation_kind":"tombstone",
      "client_created_at":"2026-07-27T13:06:00Z",
      "source":"manual",
      "recovery_uncertain":false,
      "change_reason":"Remove invalid out tap"
    }'::jsonb
  ) ->> 'code',
  'participation_operation_tombstoned',
  'tombstone appends a revision'
);
select extensions.is(
  pg_catalog.jsonb_array_length(
    public.lh_list_effective_participation('tracked-team-game-a') -> 'operations'
  ),
  1,
  'tombstoned logical event is absent from effective results'
);
select extensions.is(
  public.lh_create_participation_operation(
    '{
      "operation_id":"tracked-op-invalid-close",
      "client_operation_id":"tracked-client-invalid-close",
      "logical_event_id":"tracked-logical-invalid-close",
      "game_id":"tracked-team-game-a",
      "operation_kind":"player_out",
      "player_id":"tracked-roster-a",
      "period":"Q1",
      "game_clock_seconds":0,
      "occurred_at":"2026-07-27T13:10:00Z",
      "client_created_at":"2026-07-27T13:10:00Z",
      "source":"system_period_end",
      "system_close_reason":"game_end",
      "recovery_uncertain":false
    }'::jsonb
  ) ->> 'code',
  'invalid_input',
  'system-close reason is constrained to the matching source'
);
select extensions.ok(
  exists (
    select 1
    from public.lh_participation_operations
    where operation_id = 'tracked-op-in-correct-1'
      and source = 'manual'
      and recovery_uncertain is true
  ),
  'manual source and recovery uncertainty are preserved'
);
select extensions.is(
  public.lh_reconcile_participation_operations(
    jsonb_build_array(
      '{
        "operation_id":"tracked-op-in-1",
        "client_operation_id":"tracked-client-in-1",
        "logical_event_id":"tracked-logical-in-1",
        "game_id":"tracked-team-game-a",
        "operation_kind":"player_in",
        "player_id":"tracked-roster-a",
        "period":"Q1",
        "game_clock_seconds":600,
        "occurred_at":"2026-07-27T13:00:00Z",
        "client_created_at":"2026-07-27T13:00:00Z",
        "source":"live",
        "system_close_reason":null,
        "recovery_uncertain":false
      }'::jsonb
    )
  ) ->> 'code',
  'participation_reconciled',
  'offline reconciliation safely replays accepted operations'
);
select extensions.throws_ok(
  $$update public.lh_participation_operations
    set change_reason = 'destructive rewrite'
    where operation_id = 'tracked-op-in-1'$$,
  'P0001',
  'tracked playing time participation history is append-only',
  'accepted participation history cannot be rewritten'
);

select extensions.ok(
  position(
    'lh_participation'
    in lower(pg_get_functiondef('public.lh_public_live_share_game(text)'::regprocedure))
  ) = 0
  and position(
    'lh_game_clock'
    in lower(pg_get_functiondef('public.lh_public_live_share_game(text)'::regprocedure))
  ) = 0,
  'public Live Share RPC remains independent of private clock and participation data'
);

select * from extensions.finish();
rollback;
