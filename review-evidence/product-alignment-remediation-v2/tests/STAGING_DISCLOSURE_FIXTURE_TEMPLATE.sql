-- Replace __TEST_USER_ID__ with the UUID returned by disposable-staging Auth signup.
-- Synthetic data only. Do not run on production.

begin;

insert into public.lh_team_scopes(team_id, team_name_snapshot)
values ('disclosure-team', 'Branford Demo Hornets');

insert into public.lh_player_scopes(
  team_id,
  roster_player_id,
  player_name_snapshot,
  jersey_snapshot,
  position_snapshot
)
values ('disclosure-team', 'disclosure-player', 'Demo Player', '12', 'Midfield');

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
values (
  'disclosure-game',
  'disclosure-team',
  'disclosure-player',
  'Madison Demo',
  date '2026-07-22',
  'quarters',
  6,
  4
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
  'disclosure-admin-grant',
  '__TEST_USER_ID__'::uuid,
  'team_admin',
  'team',
  'disclosure-team',
  'system_bootstrap',
  '__TEST_USER_ID__'::uuid,
  pg_catalog.now() - interval '1 hour'
);

insert into public.lh_grant_lifecycle_events(
  id,
  grant_id,
  sequence,
  event_type,
  actor_user_id,
  occurred_at
)
values
  (
    'disclosure-grant-issued',
    'disclosure-admin-grant',
    1,
    'issued',
    '__TEST_USER_ID__'::uuid,
    pg_catalog.now() - interval '1 hour'
  ),
  (
    'disclosure-grant-accepted',
    'disclosure-admin-grant',
    2,
    'accepted',
    '__TEST_USER_ID__'::uuid,
    pg_catalog.now() - interval '59 minutes'
  );

insert into public.lh_events(
  event_id,
  game_id,
  team_id,
  roster_player_id,
  created_by_user_id,
  created_by_grant_id,
  original_evidence
)
values (
  'disclosure-event-1',
  'disclosure-game',
  'disclosure-team',
  'disclosure-player',
  '__TEST_USER_ID__'::uuid,
  'disclosure-admin-grant',
  '{
    "occurred_at":"2026-07-22T18:10:00Z",
    "period":"Q2",
    "stat_type":"groundBall",
    "stat_label":"Ground Ball",
    "category":"Possession",
    "point_value":2,
    "field_zone":"Midfield"
  }'::jsonb
);

insert into public.lh_event_effective_versions(
  event_id,
  game_id,
  team_id,
  roster_player_id,
  server_event_version,
  lifecycle_state,
  effective_evidence
)
select
  event_id,
  game_id,
  team_id,
  roster_player_id,
  1,
  'active',
  original_evidence
from public.lh_events
where event_id = 'disclosure-event-1';

insert into public.lh_event_annotations(
  event_id,
  game_id,
  annotations,
  created_by_user_id,
  created_by_grant_id
)
values (
  'disclosure-event-1',
  'disclosure-game',
  '{
    "note":"Synthetic private note that must never be public",
    "tags":["Created Advantage","Synthetic private tag"]
  }'::jsonb,
  '__TEST_USER_ID__'::uuid,
  'disclosure-admin-grant'
);

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
    'disclosure-expired-token',
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to('EXPIREDTOKEN1234567890', 'UTF8'), 'sha256'),
      'hex'
    ),
    'disclosure-game',
    '__TEST_USER_ID__'::uuid,
    'disclosure-admin-grant',
    pg_catalog.now() - interval '2 hours',
    pg_catalog.now() - interval '1 hour',
    null
  ),
  (
    'disclosure-revoked-token',
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to('REVOKEDTOKEN1234567890', 'UTF8'), 'sha256'),
      'hex'
    ),
    'disclosure-game',
    '__TEST_USER_ID__'::uuid,
    'disclosure-admin-grant',
    pg_catalog.now() - interval '2 hours',
    null,
    pg_catalog.now() - interval '1 hour'
  );

commit;
