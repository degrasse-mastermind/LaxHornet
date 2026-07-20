\set ON_ERROR_STOP on

-- LaxHornet Trust Spine Release 1 staging tests.
-- Run only after TRUST_SPINE_SCHEMA_PROPOSAL.sql on an isolated Supabase
-- staging branch. All fixtures are synthetic and are rolled back.

begin;

-- Synthetic IDs.
-- parent_a:      11111111-1111-4111-8111-111111111111
-- coach_team_a:  22222222-2222-4222-8222-222222222222
-- coach_player:  33333333-3333-4333-8333-333333333333
-- admin_a:       44444444-4444-4444-8444-444444444444
-- pending_user:  55555555-5555-4555-8555-555555555555
-- expired_user:  66666666-6666-4666-8666-666666666666
-- revoked_user:  77777777-7777-4777-8777-777777777777
-- parent_b:      88888888-8888-4888-8888-888888888888
-- admin_b:       99999999-9999-4999-8999-999999999999
-- renewed_user:  aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa

-- Canonical legacy fixtures used only to exercise the scope-registration
-- bridge. They are rolled back with the suite.
insert into auth.users(id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'parent-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'coach-a@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'coach-player@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'admin-a@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'pending@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'expired@example.test'),
  ('77777777-7777-4777-8777-777777777777', 'revoked@example.test'),
  ('88888888-8888-4888-8888-888888888888', 'parent-b@example.test'),
  ('99999999-9999-4999-8999-999999999999', 'admin-b@example.test'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'renewed@example.test')
on conflict (id) do nothing;

insert into public.teams(id, name, invite_code, tracker_code, created_by)
values
  ('legacy-team-a', 'Legacy Demo Hornets', 'LEGACYA', 'TRACKA',
    '44444444-4444-4444-8444-444444444444'),
  ('legacy-team-b', 'Legacy Other Team', 'LEGACYB', 'TRACKB',
    '99999999-9999-4999-8999-999999999999');

insert into public.team_members(id, team_id, user_id, role)
values
  ('legacy-member-admin-a', 'legacy-team-a',
    '44444444-4444-4444-8444-444444444444', 'admin'),
  ('legacy-member-admin-b', 'legacy-team-b',
    '99999999-9999-4999-8999-999999999999', 'admin');

insert into public.roster_players(id, team_id, name, number, position, active)
values
  ('legacy-player-a', 'legacy-team-a', 'Offline Demo Player', '12', 'Midfield', true),
  ('legacy-player-b', 'legacy-team-b', 'Other Offline Player', '88', 'Defense', true);

insert into public.player_claims(id, team_id, roster_player_id, user_id)
values (
  'legacy-claim-parent-a',
  'legacy-team-a',
  'legacy-player-a',
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
  'offline-local-game-a',
  'legacy-player-a',
  '11111111-1111-4111-8111-111111111111',
  'OFFLINE-LOCAL-SHARE',
  'Offline Opponent',
  date '2026-07-20',
  'halves',
  '{"name":"Offline Demo Player","number":"12"}'::jsonb,
  'H1',
  'in-progress',
  'legacy-team-a',
  'legacy-player-a'
);

insert into public.lh_team_scopes(team_id, team_name_snapshot)
values
  ('team-a', 'Branford Demo Hornets'),
  ('team-b', 'Madison Demo');

insert into public.lh_player_scopes(
  team_id,
  roster_player_id,
  player_name_snapshot,
  jersey_snapshot,
  position_snapshot
)
values
  ('team-a', 'player-a1', 'Demo Player', '12', 'Midfield'),
  ('team-a', 'player-a2', 'Second Demo Player', '99', 'Attack'),
  ('team-b', 'player-b1', 'Other Team Player', '8', 'Defense');

insert into public.lh_game_scopes(
  game_id,
  team_id,
  roster_player_id,
  opponent_snapshot,
  game_date_snapshot,
  period_format_snapshot,
  final_score_for,
  final_score_against
)
values
  ('game-a1', 'team-a', 'player-a1', 'T-Birds 2033', date '2026-07-20', 'halves', 7, 9),
  ('game-a2', 'team-a', 'player-a2', 'Guilford Demo', date '2026-07-20', 'quarters', 8, 6),
  ('game-b1', 'team-b', 'player-b1', 'Branford Demo', date '2026-07-20', 'quarters', 5, 4);

-- Root team-admin grants. Direct table access is privileged fixture setup only.
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
values
  (
    'grant-admin-a',
    '44444444-4444-4444-8444-444444444444',
    'team_admin',
    'team',
    'team-a',
    'system_bootstrap',
    '44444444-4444-4444-8444-444444444444',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    'grant-admin-b',
    '99999999-9999-4999-8999-999999999999',
    'team_admin',
    'team',
    'team-b',
    'system_bootstrap',
    '99999999-9999-4999-8999-999999999999',
    timestamptz '2026-01-01 00:00:00+00'
  );

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, occurred_at
)
values
  (
    'life-admin-a-issued',
    'grant-admin-a',
    1,
    'issued',
    '44444444-4444-4444-8444-444444444444',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    'life-admin-b-issued',
    'grant-admin-b',
    1,
    'issued',
    '99999999-9999-4999-8999-999999999999',
    timestamptz '2026-01-01 00:00:00+00'
  );

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, occurred_at
)
values
  (
    'life-admin-a-accepted',
    'grant-admin-a',
    2,
    'accepted',
    '44444444-4444-4444-8444-444444444444',
    timestamptz '2026-01-01 00:01:00+00'
  ),
  (
    'life-admin-b-accepted',
    'grant-admin-b',
    2,
    'accepted',
    '99999999-9999-4999-8999-999999999999',
    timestamptz '2026-01-01 00:01:00+00'
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
values
  (
    'invite-parent-a',
    '11111111-1111-4111-8111-111111111111',
    'parent-a@example.test',
    'parent',
    'player',
    'team-a',
    'player-a1',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
  ),
  (
    'invite-coach-team-a',
    '22222222-2222-4222-8222-222222222222',
    'coach-a@example.test',
    'coach',
    'team',
    'team-a',
    null,
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
  ),
  (
    'invite-coach-player-a',
    '33333333-3333-4333-8333-333333333333',
    'coach-player@example.test',
    'coach',
    'player',
    'team-a',
    'player-a1',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
  ),
  (
    'invite-pending',
    '55555555-5555-4555-8555-555555555555',
    'pending@example.test',
    'parent',
    'player',
    'team-a',
    'player-a1',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
  ),
  (
    'invite-expired',
    '66666666-6666-4666-8666-666666666666',
    'expired@example.test',
    'parent',
    'player',
    'team-a',
    'player-a1',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
  ),
  (
    'invite-revoked',
    '77777777-7777-4777-8777-777777777777',
    'revoked@example.test',
    'parent',
    'player',
    'team-a',
    'player-a1',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
  ),
  (
    'invite-parent-b',
    '88888888-8888-4888-8888-888888888888',
    'parent-b@example.test',
    'parent',
    'player',
    'team-b',
    'player-b1',
    '99999999-9999-4999-8999-999999999999',
    'grant-admin-b',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
  ),
  (
    'invite-renewed-old',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'renewed@example.test',
    'parent',
    'player',
    'team-a',
    'player-a1',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'accepted',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-01-01 12:00:00+00'
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
  issued_at,
  expires_at
)
values
  (
    'grant-parent-a',
    '11111111-1111-4111-8111-111111111111',
    'parent',
    'player',
    'team-a',
    'player-a1',
    'invitation',
    'invite-parent-a',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    timestamptz '2026-01-02 00:00:00+00',
    null
  ),
  (
    'grant-coach-team-a',
    '22222222-2222-4222-8222-222222222222',
    'coach',
    'team',
    'team-a',
    null,
    'invitation',
    'invite-coach-team-a',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    timestamptz '2026-01-02 00:00:00+00',
    null
  ),
  (
    'grant-coach-player-a',
    '33333333-3333-4333-8333-333333333333',
    'coach',
    'player',
    'team-a',
    'player-a1',
    'invitation',
    'invite-coach-player-a',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    timestamptz '2026-01-02 00:00:00+00',
    null
  ),
  (
    'grant-pending',
    '55555555-5555-4555-8555-555555555555',
    'parent',
    'player',
    'team-a',
    'player-a1',
    'invitation',
    'invite-pending',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    timestamptz '2026-01-02 00:00:00+00',
    null
  ),
  (
    'grant-expired',
    '66666666-6666-4666-8666-666666666666',
    'parent',
    'player',
    'team-a',
    'player-a1',
    'invitation',
    'invite-expired',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-02-01 00:00:00+00'
  ),
  (
    'grant-revoked',
    '77777777-7777-4777-8777-777777777777',
    'parent',
    'player',
    'team-a',
    'player-a1',
    'invitation',
    'invite-revoked',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    timestamptz '2026-01-02 00:00:00+00',
    null
  ),
  (
    'grant-parent-b',
    '88888888-8888-4888-8888-888888888888',
    'parent',
    'player',
    'team-b',
    'player-b1',
    'invitation',
    'invite-parent-b',
    '99999999-9999-4999-8999-999999999999',
    'grant-admin-b',
    timestamptz '2026-01-02 00:00:00+00',
    null
  ),
  (
    'grant-renewed-old',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'parent',
    'player',
    'team-a',
    'player-a1',
    'invitation',
    'invite-renewed-old',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    timestamptz '2026-01-02 00:00:00+00',
    timestamptz '2026-07-01 00:00:00+00'
  );

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, actor_grant_id, occurred_at
)
select
  'life-' || id || '-issued',
  id,
  1,
  'issued',
  issued_by_user_id,
  issued_by_grant_id,
  issued_at
from public.lh_access_grants
where provenance_type = 'invitation';

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, actor_grant_id, occurred_at
)
select
  'life-' || id || '-accepted',
  id,
  2,
  'accepted',
  user_id,
  null,
  issued_at + interval '1 minute'
from public.lh_access_grants
where provenance_type = 'invitation'
  and id <> 'grant-pending';

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, actor_grant_id, reason, occurred_at
)
values
  (
    'life-expired-expired',
    'grant-expired',
    3,
    'expired',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'Fixture expiration',
    timestamptz '2026-02-01 00:00:00+00'
  ),
  (
    'life-revoked-revoked',
    'grant-revoked',
    3,
    'revoked',
    '44444444-4444-4444-8444-444444444444',
    'grant-admin-a',
    'Fixture revocation',
    timestamptz '2026-03-01 00:00:00+00'
  );

-- Renewal creates a new grant and preserves the old grant and lifecycle.
insert into public.lh_access_grants(
  id,
  user_id,
  role,
  scope_type,
  team_id,
  roster_player_id,
  provenance_type,
  renewed_from_grant_id,
  issued_by_user_id,
  issued_by_grant_id,
  issued_at,
  expires_at
)
values (
  'grant-renewed-new',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'parent',
  'player',
  'team-a',
  'player-a1',
  'renewal',
  'grant-renewed-old',
  '44444444-4444-4444-8444-444444444444',
  'grant-admin-a',
  timestamptz '2026-07-01 00:00:01+00',
  timestamptz '2027-07-01 00:00:00+00'
);

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, actor_grant_id, occurred_at
)
values (
  'life-renewed-new-issued',
  'grant-renewed-new',
  1,
  'issued',
  '44444444-4444-4444-8444-444444444444',
  'grant-admin-a',
  timestamptz '2026-07-01 00:00:01+00'
);

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id, occurred_at
)
values (
  'life-renewed-new-accepted',
  'grant-renewed-new',
  2,
  'accepted',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  timestamptz '2026-07-01 00:01:00+00'
);

insert into public.lh_grant_lifecycle_events(
  id,
  grant_id,
  sequence,
  event_type,
  actor_user_id,
  actor_grant_id,
  related_grant_id,
  occurred_at
)
values (
  'life-renewed-old-renewed',
  'grant-renewed-old',
  3,
  'renewed',
  '44444444-4444-4444-8444-444444444444',
  'grant-admin-a',
  'grant-renewed-new',
  timestamptz '2026-07-01 00:02:00+00'
);

-- 1. Parent resolves only the accepted player-scoped grant.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  grant_count integer;
  resolved_team text;
  resolved_player text;
begin
  select count(*), min(team_id), min(roster_player_id)
  into grant_count, resolved_team, resolved_player
  from public.lh_resolve_active_grants();
  if grant_count <> 1 or resolved_team <> 'team-a' or resolved_player <> 'player-a1' then
    raise exception 'TEST 1 failed: parent grant boundary';
  end if;
end;
$test$;
reset role;

-- 2. Team coach resolves a team-scoped coach grant.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
do $test$
declare
  grant_count integer;
begin
  select count(*) into grant_count
  from public.lh_resolve_active_grants()
  where grant_role = 'coach' and scope_type = 'team' and team_id = 'team-a';
  if grant_count <> 1 then
    raise exception 'TEST 2 failed: coach boundary';
  end if;
end;
$test$;
reset role;

-- 3. Team admin resolves authority but does not receive evidence-mutation authority.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  if (select count(*) from public.lh_resolve_active_grants() where grant_role = 'team_admin') <> 1 then
    raise exception 'TEST 3 failed: team admin grant resolution';
  end if;
  result := public.lh_create_event(
    '{
      "client_operation_id":"admin-create-denied",
      "event_id":"event-admin-denied",
      "game_id":"game-a1",
      "evidence":{
        "occurred_at":"2026-07-20T15:00:00Z",
        "period":"H1",
        "stat_type":"groundBall",
        "stat_label":"Ground Ball",
        "category":"Possession",
        "point_value":2
      }
    }'::jsonb
  );
  if result ->> 'outcome' <> 'rejected' or result ->> 'code' <> 'unauthorized_scope' then
    raise exception 'TEST 3 failed: team admin evidence mutation was not denied: %', result;
  end if;
end;
$test$;
reset role;

-- 4. Pending, expired, and revoked grants do not resolve.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);
do $test$
begin
  if exists (select 1 from public.lh_resolve_active_grants()) then
    raise exception 'TEST 4 failed: pending grant resolved';
  end if;
end;
$test$;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);
do $test$
begin
  if exists (select 1 from public.lh_resolve_active_grants()) then
    raise exception 'TEST 4 failed: expired grant resolved';
  end if;
end;
$test$;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);
do $test$
begin
  if exists (select 1 from public.lh_resolve_active_grants()) then
    raise exception 'TEST 4 failed: revoked grant resolved';
  end if;
end;
$test$;
reset role;

-- 5. Renewed grant resolves only the new accepted grant.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',
  true
);
do $test$
begin
  if (select count(*) from public.lh_resolve_active_grants()) <> 1
    or not exists (
      select 1 from public.lh_resolve_active_grants()
      where grant_id = 'grant-renewed-new'
    )
  then
    raise exception 'TEST 5 failed: renewal lifecycle';
  end if;
end;
$test$;
reset role;

-- 6. Parent can create an event only for the assigned player/game.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_create_event(
    '{
      "client_operation_id":"parent-create-main",
      "event_id":"event-main",
      "game_id":"game-a1",
      "client_created_at":"2026-07-20T15:00:00Z",
      "evidence":{
        "occurred_at":"2026-07-20T15:00:00Z",
        "period":"H1",
        "stat_type":"groundBall",
        "stat_label":"Ground Ball",
        "category":"Possession",
        "point_value":2,
        "field_zone":"midfield"
      },
      "annotations":{
        "tags":["Contested"],
        "note":"Private test note"
      }
    }'::jsonb
  );
  if result ->> 'outcome' <> 'accepted' or result ->> 'code' <> 'created' then
    raise exception 'TEST 6 failed: parent event creation: %', result;
  end if;
end;
$test$;
reset role;

do $test$
begin
  if not exists (
    select 1
    from public.lh_event_annotations
    where event_id = 'event-main'
      and annotations ->> 'note' = 'Private test note'
  ) then
    raise exception 'TEST 6 failed: private annotations were not separated';
  end if;
end;
$test$;

-- 7. Cross-player and cross-team create attempts are denied.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  cross_player jsonb;
  cross_team jsonb;
begin
  cross_player := public.lh_create_event(
    '{
      "client_operation_id":"parent-cross-player",
      "event_id":"event-cross-player",
      "game_id":"game-a2",
      "evidence":{
        "occurred_at":"2026-07-20T15:01:00Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Scoring",
        "point_value":5
      }
    }'::jsonb
  );
  cross_team := public.lh_create_event(
    '{
      "client_operation_id":"parent-cross-team",
      "event_id":"event-cross-team",
      "game_id":"game-b1",
      "evidence":{
        "occurred_at":"2026-07-20T15:02:00Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Scoring",
        "point_value":5
      }
    }'::jsonb
  );
  if cross_player ->> 'outcome' <> 'rejected'
    or cross_team ->> 'outcome' <> 'rejected'
  then
    raise exception 'TEST 7 failed: cross-scope denial: %, %', cross_player, cross_team;
  end if;
end;
$test$;
reset role;

-- 8. Team coach may create for another player on the same team.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_create_event(
    '{
      "client_operation_id":"coach-team-create",
      "event_id":"event-coach-team",
      "game_id":"game-a2",
      "evidence":{
        "occurred_at":"2026-07-20T15:03:00Z",
        "period":"Q1",
        "stat_type":"assist",
        "stat_label":"Assist",
        "category":"Scoring",
        "point_value":3
      }
    }'::jsonb
  );
  if result ->> 'outcome' <> 'accepted' then
    raise exception 'TEST 8 failed: team coach scope: %', result;
  end if;
end;
$test$;
reset role;

-- 9. Player-scoped coach cannot create for a different player.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_create_event(
    '{
      "client_operation_id":"coach-player-cross-player",
      "event_id":"event-coach-player-denied",
      "game_id":"game-a2",
      "evidence":{
        "occurred_at":"2026-07-20T15:04:00Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Scoring",
        "point_value":5
      }
    }'::jsonb
  );
  if result ->> 'outcome' <> 'rejected' then
    raise exception 'TEST 9 failed: player coach cross-player denial: %', result;
  end if;
end;
$test$;
reset role;

-- 10. Grant-authority escalation and direct event update/delete are denied.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  denied boolean := false;
begin
  begin
    insert into public.lh_access_grants(
      id, user_id, role, scope_type, team_id, provenance_type,
      issued_by_user_id, issued_at
    )
    values (
      'forged-admin',
      '11111111-1111-4111-8111-111111111111',
      'team_admin',
      'team',
      'team-a',
      'system_bootstrap',
      '11111111-1111-4111-8111-111111111111',
      pg_catalog.now()
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'TEST 10 failed: grant escalation insert was not denied';
  end if;

  denied := false;
  begin
    update public.lh_events
    set original_evidence = original_evidence || '{"note":"tampered"}'::jsonb
    where event_id = 'event-main';
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'TEST 10 failed: direct event update was not denied';
  end if;

  denied := false;
  begin
    delete from public.lh_events where event_id = 'event-main';
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'TEST 10 failed: direct event delete was not denied';
  end if;
end;
$test$;
reset role;

-- 11. Unknown/spoofed operation fields are rejected by strict allowlists.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_create_event(
    '{
      "client_operation_id":"spoof-role-field",
      "event_id":"event-spoof",
      "game_id":"game-a1",
      "author_role":"team_admin",
      "evidence":{
        "occurred_at":"2026-07-20T15:05:00Z",
        "period":"H1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Scoring",
        "point_value":5
      }
    }'::jsonb
  );
  if result ->> 'outcome' <> 'rejected' or result ->> 'code' <> 'invalid_input' then
    raise exception 'TEST 11 failed: strict operation allowlist: %', result;
  end if;
end;
$test$;
reset role;

-- 12. First correction is accepted.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_correct_event(
    '{
      "client_operation_id":"corr-zone",
      "event_id":"event-main",
      "game_id":"game-a1",
      "base_server_event_version":1,
      "changes":{"field_zone":"offensive_end"},
      "correction_reason":"Zone correction"
    }'::jsonb
  );
  if result ->> 'outcome' <> 'accepted'
    or result ->> 'code' <> 'corrected'
    or (result ->> 'serverEventVersion')::integer <> 2
  then
    raise exception 'TEST 12 failed: correction acceptance: %', result;
  end if;
end;
$test$;
reset role;

-- 13. Concurrent different-field correction merges.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_correct_event(
    '{
      "client_operation_id":"corr-label",
      "event_id":"event-main",
      "game_id":"game-a1",
      "base_server_event_version":1,
      "changes":{"stat_label":"Loose Ball Win"},
      "correction_reason":"Label correction"
    }'::jsonb
  );
  if result ->> 'outcome' <> 'accepted'
    or result ->> 'code' <> 'merged_non_overlapping'
    or (result ->> 'serverEventVersion')::integer <> 3
  then
    raise exception 'TEST 13 failed: different-field merge: %', result;
  end if;
end;
$test$;
reset role;

-- 14. Concurrent same-field correction is preserved as a conflict.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_correct_event(
    '{
      "client_operation_id":"corr-zone-stale",
      "event_id":"event-main",
      "game_id":"game-a1",
      "base_server_event_version":1,
      "changes":{"field_zone":"defensive_end"},
      "correction_reason":"Conflicting zone correction"
    }'::jsonb
  );
  if result ->> 'outcome' <> 'conflicted'
    or result ->> 'code' <> 'same_field_conflict'
    or (result ->> 'serverEventVersion')::integer <> 3
  then
    raise exception 'TEST 14 failed: same-field conflict: %', result;
  end if;
end;
$test$;
reset role;

-- 15. Exact correction replay is idempotent.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_correct_event(
    '{
      "client_operation_id":"corr-label",
      "event_id":"event-main",
      "game_id":"game-a1",
      "base_server_event_version":1,
      "changes":{"stat_label":"Loose Ball Win"},
      "correction_reason":"Label correction"
    }'::jsonb
  );
  if result ->> 'outcome' <> 'accepted'
    or coalesce((result ->> 'replay')::boolean, false) is not true
  then
    raise exception 'TEST 15 failed: correction idempotency: %', result;
  end if;
end;
$test$;
reset role;

do $test$
begin
  if (select count(*) from public.lh_event_revisions where event_id = 'event-main') <> 2 then
    raise exception 'TEST 15 failed: replay created a duplicate revision';
  end if;
end;
$test$;

-- 16. Reusing an operation ID with altered payload is rejected and audited.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_correct_event(
    '{
      "client_operation_id":"corr-label",
      "event_id":"event-main",
      "game_id":"game-a1",
      "base_server_event_version":1,
      "changes":{"stat_label":"Tampered duplicate payload"},
      "correction_reason":"Label correction"
    }'::jsonb
  );
  if result ->> 'outcome' <> 'rejected'
    or result ->> 'code' <> 'duplicate_operation_id_payload_mismatch'
  then
    raise exception 'TEST 16 failed: duplicate operation tampering: %', result;
  end if;
end;
$test$;
reset role;

-- 17. Tombstone is accepted only at the current version.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  result jsonb;
begin
  result := public.lh_tombstone_event(
    '{
      "client_operation_id":"tombstone-main",
      "event_id":"event-main",
      "game_id":"game-a1",
      "base_server_event_version":3,
      "tombstone_reason":"User removed event"
    }'::jsonb
  );
  if result ->> 'outcome' <> 'accepted'
    or result ->> 'code' <> 'tombstoned'
    or (result ->> 'serverEventVersion')::integer <> 4
  then
    raise exception 'TEST 17 failed: tombstone operation: %', result;
  end if;
end;
$test$;
reset role;

-- 18. Corrections and create attempts cannot resurrect a tombstoned event.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  correction jsonb;
  recreate jsonb;
begin
  correction := public.lh_correct_event(
    '{
      "client_operation_id":"corr-after-tombstone",
      "event_id":"event-main",
      "game_id":"game-a1",
      "base_server_event_version":4,
      "changes":{"stat_label":"Should not resurrect"}
    }'::jsonb
  );
  recreate := public.lh_create_event(
    '{
      "client_operation_id":"recreate-after-tombstone",
      "event_id":"event-main",
      "game_id":"game-a1",
      "evidence":{
        "occurred_at":"2026-07-20T15:06:00Z",
        "period":"H2",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Scoring",
        "point_value":5
      }
    }'::jsonb
  );
  if correction ->> 'code' <> 'event_tombstoned'
    or recreate ->> 'code' <> 'event_id_already_used'
  then
    raise exception 'TEST 18 failed: tombstone resurrection prevention: %, %', correction, recreate;
  end if;
end;
$test$;
reset role;

do $test$
begin
  if (
    select lifecycle_state
    from public.lh_event_effective_versions
    where event_id = 'event-main'
  ) <> 'tombstoned'
  then
    raise exception 'TEST 18 failed: tombstoned effective state changed';
  end if;
end;
$test$;

-- 19. Create a second event and correction before revocation.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  created jsonb;
  corrected jsonb;
begin
  created := public.lh_create_event(
    '{
      "client_operation_id":"parent-create-revocation-case",
      "event_id":"event-revocation-case",
      "game_id":"game-a1",
      "evidence":{
        "occurred_at":"2026-07-20T15:07:00Z",
        "period":"H2",
        "stat_type":"successfulClear",
        "stat_label":"Successful Clear",
        "category":"Possession",
        "point_value":1,
        "field_zone":"defensive_end"
      },
      "annotations":{"tags":[],"note":""}
    }'::jsonb
  );
  corrected := public.lh_correct_event(
    '{
      "client_operation_id":"corr-before-revocation",
      "event_id":"event-revocation-case",
      "game_id":"game-a1",
      "base_server_event_version":1,
      "changes":{"field_zone":"midfield"},
      "correction_reason":"Pre-revocation correction"
    }'::jsonb
  );
  if created ->> 'outcome' <> 'accepted' or corrected ->> 'outcome' <> 'accepted' then
    raise exception 'TEST 19 setup failed: %, %', created, corrected;
  end if;
end;
$test$;
reset role;

insert into public.lh_grant_lifecycle_events(
  id,
  grant_id,
  sequence,
  event_type,
  actor_user_id,
  actor_grant_id,
  reason,
  occurred_at
)
values (
  'life-parent-a-revoked',
  'grant-parent-a',
  3,
  'revoked',
  '44444444-4444-4444-8444-444444444444',
  'grant-admin-a',
  'Revocation replay test',
  pg_catalog.now()
);

-- 20. Exact accepted replay survives revocation; a new correction does not.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  replay jsonb;
  new_correction jsonb;
begin
  replay := public.lh_correct_event(
    '{
      "client_operation_id":"corr-before-revocation",
      "event_id":"event-revocation-case",
      "game_id":"game-a1",
      "base_server_event_version":1,
      "changes":{"field_zone":"midfield"},
      "correction_reason":"Pre-revocation correction"
    }'::jsonb
  );
  new_correction := public.lh_correct_event(
    '{
      "client_operation_id":"corr-created-before-sync-after-revocation",
      "event_id":"event-revocation-case",
      "game_id":"game-a1",
      "base_server_event_version":2,
      "changes":{"category":"Transition"}
    }'::jsonb
  );
  if replay ->> 'outcome' <> 'accepted'
    or coalesce((replay ->> 'replay')::boolean, false) is not true
    or new_correction ->> 'outcome' <> 'rejected'
    or new_correction ->> 'code' <> 'authority_changed'
  then
    raise exception 'TEST 20 failed: correction replay after revocation: %, %', replay, new_correction;
  end if;
end;
$test$;
reset role;

-- Live Share fixture. The raw share code is DEMO-SHARE-123.
insert into public.lh_live_share_tokens(
  token_id,
  token_hash,
  game_id,
  created_by_user_id,
  created_by_grant_id
)
values (
  'share-token-a1',
  pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to('DEMO-SHARE-123', 'UTF8'),
      'sha256'
    ),
    'hex'
  ),
  'game-a1',
  '22222222-2222-4222-8222-222222222222',
  'grant-coach-team-a'
);

-- 21. Public-safe Live Share returns only explicit game/event fields and hides
-- tombstoned events, notes, tags, grants, operations, and revisions.
set local role anon;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
do $test$
declare
  response jsonb;
  game_key text;
  event_value jsonb;
  event_key text;
begin
  response := public.lh_public_live_share_game('demo-share-123');
  if response is null then
    raise exception 'TEST 21 failed: Live Share returned no payload';
  end if;

  for game_key in select pg_catalog.jsonb_object_keys(response -> 'game')
  loop
    if not game_key = any (array[
      'game_id', 'team_name', 'player_name', 'jersey_number', 'position',
      'opponent', 'game_date', 'period_format', 'final_score_for', 'final_score_against'
    ]) then
      raise exception 'TEST 21 failed: private game field leaked: %', game_key;
    end if;
  end loop;

  for event_value in select value from pg_catalog.jsonb_array_elements(response -> 'events')
  loop
    if event_value ->> 'event_id' = 'event-main' then
      raise exception 'TEST 21 failed: tombstoned event leaked';
    end if;
    if event_value ? 'note' or event_value ? 'tags' then
      raise exception 'TEST 21 failed: private event field leaked';
    end if;
    for event_key in select pg_catalog.jsonb_object_keys(event_value)
    loop
      if not event_key = any (array[
        'event_id', 'occurred_at', 'period', 'stat_type', 'stat_label',
        'category', 'point_value', 'field_zone'
      ]) then
        raise exception 'TEST 21 failed: unallowlisted event field leaked: %', event_key;
      end if;
    end loop;
  end loop;
end;
$test$;
reset role;

-- 22. Sensitive export audit returns a strict manifest and records the audit.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
do $test$
declare
  response jsonb;
  expected_game_fields jsonb := '[
    "game_id", "team_id", "roster_player_id", "team_name", "player_name",
    "jersey_number", "position", "opponent", "game_date", "period_format",
    "final_score_for", "final_score_against"
  ]'::jsonb;
  expected_event_fields jsonb := '[
    "event_id", "occurred_at", "period", "stat_type", "stat_label",
    "category", "point_value", "field_zone"
  ]'::jsonb;
  expected_annotation_fields jsonb := '["note", "tags"]'::jsonb;
begin
  response := public.lh_record_sensitive_export('player_json', 'game-a1');
  if response ->> 'outcome' <> 'accepted'
    or response ->> 'code' <> 'export_audit_recorded'
  then
    raise exception 'TEST 22 failed: export audit: %', response;
  end if;

  if response -> 'gameFields' <> expected_game_fields then
    raise exception 'TEST 22 failed: game export manifest drifted: %',
      response -> 'gameFields';
  end if;

  if response -> 'eventFields' <> expected_event_fields then
    raise exception 'TEST 22 failed: event export manifest drifted: %',
      response -> 'eventFields';
  end if;

  if response -> 'annotationFields' <> expected_annotation_fields then
    raise exception 'TEST 22 failed: annotation export manifest drifted: %',
      response -> 'annotationFields';
  end if;
end;
$test$;
reset role;

do $test$
begin
  if not exists (
    select 1
    from public.lh_security_audit_events
    where event_type = 'sensitive_export'
      and actor_user_id = '22222222-2222-4222-8222-222222222222'
      and game_id = 'game-a1'
  ) then
    raise exception 'TEST 22 failed: sensitive export audit row missing';
  end if;
end;
$test$;

-- 23. Conflict adjudication history is append-only even for privileged callers.
insert into public.lh_conflict_adjudications(
  adjudication_id,
  conflict_id,
  adjudication_sequence,
  decision,
  actor_user_id,
  actor_grant_id,
  rationale
)
select
  'adjudication-1',
  conflict_id,
  1,
  'keep_effective',
  '44444444-4444-4444-8444-444444444444',
  'grant-admin-a',
  'Synthetic staging adjudication'
from public.lh_event_conflicts
where operation_id = (
  select operation_id
  from public.lh_event_operations
  where client_operation_id = 'corr-zone-stale'
);

do $test$
declare
  denied boolean := false;
begin
  begin
    update public.lh_conflict_adjudications
    set rationale = 'Mutated'
    where adjudication_id = 'adjudication-1';
  exception when sqlstate '55000' then
    denied := true;
  end;
  if not denied then
    raise exception 'TEST 23 failed: adjudication update was not blocked';
  end if;
end;
$test$;

-- 24. Every new table is RLS-enabled, forced, and has no anon/authenticated
-- table privileges.
do $test$
declare
  expected_tables text[] := array[
    'lh_team_scopes',
    'lh_player_scopes',
    'lh_game_scopes',
    'lh_access_invitations',
    'lh_access_grants',
    'lh_grant_lifecycle_events',
    'lh_events',
    'lh_event_effective_versions',
    'lh_event_operations',
    'lh_event_operation_attempts',
    'lh_event_create_operations',
    'lh_event_correction_operations',
    'lh_event_tombstone_operations',
    'lh_event_revisions',
    'lh_event_tombstones',
    'lh_event_annotations',
    'lh_event_conflicts',
    'lh_conflict_adjudications',
    'lh_live_share_tokens',
    'lh_security_audit_events'
  ];
  table_name text;
  rls_enabled boolean;
  rls_forced boolean;
begin
  foreach table_name in array expected_tables
  loop
    select relrowsecurity, relforcerowsecurity
    into rls_enabled, rls_forced
    from pg_catalog.pg_class
    where oid = pg_catalog.to_regclass('public.' || table_name);

    if coalesce(rls_enabled, false) is not true or coalesce(rls_forced, false) is not true then
      raise exception 'TEST 24 failed: RLS posture for %', table_name;
    end if;

    if pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'SELECT')
      or pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'SELECT')
      or pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
      or pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
      or pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'DELETE')
    then
      raise exception 'TEST 24 failed: direct table privilege exists for %', table_name;
    end if;
  end loop;
end;
$test$;

-- 25. Authenticated clients cannot invoke private helpers directly.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
do $test$
declare
  denied boolean := false;
begin
  begin
    perform lh_trust_private.lh_active_grants_for_user(
      auth.uid(),
      pg_catalog.now()
    );
  exception when insufficient_privilege then
    denied := true;
  end;

  if not denied then
    raise exception 'TEST 25 failed: private helper invocation was not denied';
  end if;
end;
$test$;
reset role;

-- 26. Revision history contains accepted evidence only. Rejected and
-- conflicted operations have no revision row.
do $test$
declare
  sequences integer[];
begin
  select pg_catalog.array_agg(revision_sequence order by revision_sequence)
  into sequences
  from public.lh_event_revisions
  where event_id = 'event-main';

  if sequences <> array[1, 2] then
    raise exception 'TEST 26 failed: accepted revision sequence drifted: %', sequences;
  end if;

  if exists (
    select 1
    from public.lh_event_revisions as revision
    join public.lh_event_operations as operation
      on operation.operation_id = revision.operation_id
    where operation.outcome_class <> 'accepted'
  ) then
    raise exception 'TEST 26 failed: non-accepted operation created a revision';
  end if;

  if exists (
    select 1
    from public.lh_event_revisions
    where accepted_evidence_snapshot is null
  ) then
    raise exception 'TEST 26 failed: accepted revision has no accepted snapshot';
  end if;
end;
$test$;

-- 27. Annotation fields cannot be submitted as evidence corrections and
-- initial annotations never enter the authoritative evidence object.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
do $test$
declare
  response jsonb;
begin
  response := public.lh_correct_event(
    '{
      "client_operation_id":"annotation-as-evidence",
      "event_id":"event-coach-team",
      "game_id":"game-a2",
      "base_server_event_version":1,
      "changes":{"note":"Must remain an annotation"}
    }'::jsonb
  );

  if response ->> 'outcome' <> 'rejected'
    or response ->> 'code' <> 'invalid_input'
  then
    raise exception 'TEST 27 failed: annotation entered correction history: %', response;
  end if;

end;
$test$;
reset role;

do $test$
begin
  if exists (
    select 1
    from public.lh_event_effective_versions
    where event_id = 'event-main'
      and (effective_evidence ? 'note' or effective_evidence ? 'tags')
  ) then
    raise exception 'TEST 27 failed: annotations leaked into effective evidence';
  end if;
end;
$test$;

-- 28. Existing legacy scopes can be registered and refreshed idempotently
-- without manufacturing a Trust Spine grant.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);
do $test$
declare
  team_result jsonb;
  player_result jsonb;
  game_result jsonb;
  replay_result jsonb;
  grant_count_before integer;
begin
  select count(*) into grant_count_before
  from public.lh_resolve_active_grants();

  team_result := public.lh_register_team_scope('legacy-team-a');
  player_result := public.lh_register_player_scope('legacy-team-a', 'legacy-player-a');
  game_result := public.lh_register_game_scope('offline-local-game-a');

  replay_result := public.lh_register_game_scope('offline-local-game-a');

  if team_result ->> 'outcome' <> 'accepted'
    or player_result ->> 'outcome' <> 'accepted'
    or game_result ->> 'outcome' <> 'accepted'
    or replay_result ->> 'outcome' <> 'accepted'
  then
    raise exception 'TEST 28 failed: scope registration: %, %, %, %',
      team_result, player_result, game_result, replay_result;
  end if;

  if (select count(*) from public.lh_resolve_active_grants()) <> grant_count_before then
    raise exception 'TEST 28 failed: scope registration manufactured a grant';
  end if;
end;
$test$;
reset role;

do $test$
begin
  if (select count(*) from public.lh_team_scopes where team_id = 'legacy-team-a') <> 1
    or (
      select count(*)
      from public.lh_player_scopes
      where team_id = 'legacy-team-a'
        and roster_player_id = 'legacy-player-a'
    ) <> 1
    or (
      select count(*)
      from public.lh_game_scopes
      where game_id = 'offline-local-game-a'
    ) <> 1
  then
    raise exception 'TEST 28 failed: idempotent scope row counts';
  end if;

  if exists (
    select 1
    from public.lh_access_grants
    where team_id = 'legacy-team-a'
  ) then
    raise exception 'TEST 28 failed: scope registration manufactured a grant';
  end if;
end;
$test$;

-- 29. Cross-team, cross-player, and unauthorized scope registration is denied.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);
do $test$
declare
  invalid_player jsonb;
begin
  invalid_player := public.lh_register_player_scope(
    'legacy-team-a',
    'legacy-player-b'
  );
  if invalid_player ->> 'outcome' <> 'rejected'
    or invalid_player ->> 'code' <> 'invalid_player_team_scope'
  then
    raise exception 'TEST 29 failed: cross-team player registration: %', invalid_player;
  end if;
end;
$test$;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
do $test$
declare
  unauthorized_team jsonb;
begin
  unauthorized_team := public.lh_register_team_scope('legacy-team-b');
  if unauthorized_team ->> 'outcome' <> 'rejected'
    or unauthorized_team ->> 'code' <> 'unauthorized_scope'
  then
    raise exception 'TEST 29 failed: unauthorized team registration: %', unauthorized_team;
  end if;
end;
$test$;
reset role;

-- 30. Tombstones are permanent in Release 1; no restore table, operation, or
-- public/private restore function exists.
do $test$
begin
  if pg_catalog.to_regclass('public.lh_event_restore_operations') is not null
    or pg_catalog.to_regclass('public.lh_event_restorations') is not null
    or exists (
      select 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname in ('public', 'lh_trust_private')
        and procedure.proname like '%restore%event%'
    )
  then
    raise exception 'TEST 30 failed: restore-event scope remains';
  end if;
end;
$test$;

-- 31. Expired and revoked anonymous Live Share tokens fail closed.
insert into public.lh_live_share_tokens(
  token_id,
  token_hash,
  game_id,
  created_by_user_id,
  created_by_grant_id,
  created_at,
  expires_at,
  revoked_at
)
values
  (
    'share-expired',
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to('EXPIRED-SHARE', 'UTF8'), 'sha256'),
      'hex'
    ),
    'game-a1',
    '22222222-2222-4222-8222-222222222222',
    'grant-coach-team-a',
    pg_catalog.now() - interval '2 days',
    pg_catalog.now() - interval '1 day',
    null
  ),
  (
    'share-revoked',
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to('REVOKED-SHARE', 'UTF8'), 'sha256'),
      'hex'
    ),
    'game-a1',
    '22222222-2222-4222-8222-222222222222',
    'grant-coach-team-a',
    pg_catalog.now() - interval '1 day',
    pg_catalog.now() + interval '1 day',
    pg_catalog.now()
  );

set local role anon;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
do $test$
begin
  if public.lh_public_live_share_game('expired-share') is not null
    or public.lh_public_live_share_game('revoked-share') is not null
  then
    raise exception 'TEST 31 failed: inactive Live Share token returned data';
  end if;
end;
$test$;
reset role;

-- 32. Public wrappers are postgres-owned SECURITY DEFINER entrypoints with
-- explicit role grants; private helpers remain unreachable.
do $test$
declare
  expected_public text[] := array[
    'lh_register_team_scope(text)',
    'lh_register_player_scope(text,text)',
    'lh_register_game_scope(text)',
    'lh_resolve_active_grants()',
    'lh_create_event(jsonb)',
    'lh_correct_event(jsonb)',
    'lh_tombstone_event(jsonb)',
    'lh_public_live_share_game(text)',
    'lh_record_sensitive_export(text,text)'
  ];
  function_signature text;
  function_oid regprocedure;
begin
  if pg_catalog.has_schema_privilege('anon', 'lh_trust_private', 'USAGE')
    or pg_catalog.has_schema_privilege('authenticated', 'lh_trust_private', 'USAGE')
  then
    raise exception 'TEST 32 failed: private schema usage remains';
  end if;

  foreach function_signature in array expected_public
  loop
    function_oid := ('public.' || function_signature)::regprocedure;

    if (
      select owner.rolname <> 'postgres' or procedure.prosecdef is not true
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_roles as owner on owner.oid = procedure.proowner
      where procedure.oid = function_oid
    ) then
      raise exception 'TEST 32 failed: owner/security mode for %', function_signature;
    end if;

    if not pg_catalog.has_function_privilege(
      'authenticated',
      function_oid,
      'EXECUTE'
    ) then
      raise exception 'TEST 32 failed: authenticated grant missing for %',
        function_signature;
    end if;
  end loop;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.lh_create_event(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'TEST 32 failed: anon can create evidence';
  end if;
end;
$test$;

-- 33. The effective-row counter and accepted revisions agree, proving the
-- sequence allocator does not use max(sequence)+1.
do $test$
declare
  accepted_counter integer;
  accepted_max integer;
begin
  select accepted_revision_sequence into accepted_counter
  from public.lh_event_effective_versions
  where event_id = 'event-main';

  select coalesce(max(revision_sequence), 0) into accepted_max
  from public.lh_event_revisions
  where event_id = 'event-main';

  if accepted_counter <> accepted_max or accepted_counter <> 2 then
    raise exception 'TEST 33 failed: concurrency-safe revision counter: %, %',
      accepted_counter, accepted_max;
  end if;
end;
$test$;

select pg_catalog.jsonb_build_object(
  'suite', 'LaxHornet Trust Spine Release 1',
  'sqlTestsPassed', 33,
  'fixtures', 'synthetic',
  'transaction', 'rolled_back'
) as trust_spine_test_result;

rollback;
