\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(23);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'lh_trust_private.lh_public_event_semantic(jsonb)',
    'execute'
  ),
  'anonymous role cannot invoke the private semantic resolver'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'lh_trust_private.lh_public_event_semantic(jsonb)',
    'execute'
  ),
  'authenticated role cannot invoke the private semantic resolver'
);
select extensions.ok(
  has_function_privilege('anon', 'public.lh_public_live_share_game(text)', 'execute')
  and has_function_privilege('authenticated', 'public.lh_public_live_share_game(text)', 'execute'),
  'safe Live Share is explicitly granted to browser roles'
);
select extensions.is(
  lh_trust_private.lh_public_event_semantic(
    '{"stat_type":"ground_ball","stat_label":"Private Alias","category":"Private"}'::jsonb
  ),
  '{"stat_type":"groundBall","stat_label":"Ground Ball","category":"Effort / IQ","public":true}'::jsonb,
  'known spelling variants resolve to canonical public semantics'
);
select extensions.is(
  lh_trust_private.lh_public_event_semantic('{"stat_type":"note"}'::jsonb) ->> 'public',
  'false',
  'ordinary note remains a canonical but non-public Event Pipeline semantic'
);
select extensions.is(
  lh_trust_private.lh_public_event_semantic(
    '{"stat_type":"legacy_shift_alias","stat_label":"Legacy Participation Alias"}'::jsonb
  ),
  null::jsonb,
  'legacy participation alias defaults private'
);
select extensions.is(
  lh_trust_private.lh_public_event_semantic(
    '{"stat_type":"player_in","stat_label":"Player In"}'::jsonb
  ),
  null::jsonb,
  'tracked-playing-time event defaults private'
);

insert into public.lh_team_scopes(team_id, team_name_snapshot)
values ('v284-boundary-team', 'Synthetic Boundary Team');

insert into public.lh_player_scopes(
  team_id,
  roster_player_id,
  player_name_snapshot,
  jersey_snapshot,
  position_snapshot
)
values (
  'v284-boundary-team',
  'v284-boundary-player',
  'Synthetic Boundary Player',
  '00',
  'Test'
);

insert into public.lh_game_scopes(
  game_id,
  team_id,
  roster_player_id,
  opponent_snapshot,
  game_date_snapshot,
  period_format_snapshot
)
values (
  'v284-boundary-game',
  'v284-boundary-team',
  'v284-boundary-player',
  'Synthetic Opponent',
  date '2026-07-28',
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
  'v284-boundary-admin-grant',
  '28428428-4284-4284-8284-284284284284',
  'team_admin',
  'team',
  'v284-boundary-team',
  'system_bootstrap',
  '28428428-4284-4284-8284-284284284284',
  timestamptz '2026-07-28 12:00:00+00'
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
    'v284-boundary-admin-grant-issued',
    'v284-boundary-admin-grant',
    1,
    'issued',
    '28428428-4284-4284-8284-284284284284',
    timestamptz '2026-07-28 12:00:01+00'
  ),
  (
    'v284-boundary-admin-grant-accepted',
    'v284-boundary-admin-grant',
    2,
    'accepted',
    '28428428-4284-4284-8284-284284284284',
    timestamptz '2026-07-28 12:00:02+00'
  );

insert into public.lh_access_invitations(
  id,
  invited_user_id,
  invited_email,
  role,
  scope_type,
  team_id,
  invited_by_user_id,
  invited_by_grant_id,
  status,
  created_at,
  accepted_at
)
values (
  'v284-boundary-coach-invitation',
  '28428428-4284-4284-8284-284284284285',
  'synthetic-coach@example.test',
  'coach',
  'team',
  'v284-boundary-team',
  '28428428-4284-4284-8284-284284284284',
  'v284-boundary-admin-grant',
  'accepted',
  timestamptz '2026-07-28 12:00:03+00',
  timestamptz '2026-07-28 12:00:04+00'
);

insert into public.lh_access_grants(
  id,
  user_id,
  role,
  scope_type,
  team_id,
  provenance_type,
  invitation_id,
  issued_by_user_id,
  issued_by_grant_id,
  issued_at
)
values (
  'v284-boundary-coach-grant',
  '28428428-4284-4284-8284-284284284285',
  'coach',
  'team',
  'v284-boundary-team',
  'invitation',
  'v284-boundary-coach-invitation',
  '28428428-4284-4284-8284-284284284284',
  'v284-boundary-admin-grant',
  timestamptz '2026-07-28 12:00:05+00'
);

insert into public.lh_grant_lifecycle_events(
  id,
  grant_id,
  sequence,
  event_type,
  actor_user_id,
  actor_grant_id,
  occurred_at
)
values
  (
    'v284-boundary-coach-grant-issued',
    'v284-boundary-coach-grant',
    1,
    'issued',
    '28428428-4284-4284-8284-284284284284',
    'v284-boundary-admin-grant',
    timestamptz '2026-07-28 12:00:05+00'
  ),
  (
    'v284-boundary-coach-grant-accepted',
    'v284-boundary-coach-grant',
    2,
    'accepted',
    '28428428-4284-4284-8284-284284284285',
    null,
    timestamptz '2026-07-28 12:00:06+00'
  );

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"28428428-4284-4284-8284-284284284285","role":"authenticated"}',
  true
);

select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-create-goal",
      "event_id":"v284-boundary-goal",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:01:00Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Private Participation Phrase",
        "category":"Private",
        "point_value":5,
        "field_zone":"attack"
      },
      "annotations":{},
      "client_created_at":"2026-07-28T12:01:00Z"
    }'::jsonb
  ) ->> 'code',
  'created',
  'ordinary goal is accepted'
);
select extensions.is(
  (
    select effective_evidence ->> 'stat_label'
    from public.lh_event_effective_versions
    where event_id = 'v284-boundary-goal'
  ),
  'Goal',
  'create ingress replaces caller labels with the canonical public label'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-create-ground-ball",
      "event_id":"v284-boundary-ground-ball",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:02:00Z",
        "period":"Q1",
        "stat_type":"ground_ball",
        "stat_label":"Private Alias",
        "category":"Private",
        "point_value":2,
        "field_zone":"midfield"
      },
      "annotations":{},
      "client_created_at":"2026-07-28T12:02:00Z"
    }'::jsonb
  ) ->> 'code',
  'created',
  'known ordinary spelling variant is accepted'
);
select extensions.is(
  (
    select effective_evidence ->> 'stat_type'
    from public.lh_event_effective_versions
    where event_id = 'v284-boundary-ground-ball'
  ),
  'groundBall',
  'create ingress stores the canonical stat type'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-create-shift-alias",
      "event_id":"v284-boundary-shift-alias",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:03:00Z",
        "period":"Q1",
        "stat_type":"legacy_shift_alias",
        "stat_label":"Legacy Participation Alias",
        "category":"Participation",
        "point_value":0
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'unsupported_event_semantics',
  'legacy shift alias is rejected at authenticated ingress'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-create-player-in",
      "event_id":"v284-boundary-player-in",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:00Z",
        "period":"Q1",
        "stat_type":"player_in",
        "stat_label":"Player In",
        "category":"Participation",
        "point_value":0
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'unsupported_event_semantics',
  'tracked-playing-time event is rejected at authenticated ingress'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-create-private-note",
      "event_id":"v284-boundary-private-note",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:15Z",
        "period":"Q1",
        "stat_type":"note",
        "stat_label":"Caller Note Label",
        "category":"Private",
        "point_value":0
      },
      "annotations":{"note":"private synthetic note"}
    }'::jsonb
  ) ->> 'code',
  'created',
  'ordinary note remains compatible with the canonical Event Pipeline'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"28428428-4284-4284-8284-284284284299","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-unauthorized-private-probe",
      "event_id":"v284-boundary-unauthorized-private",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:30Z",
        "period":"Q1",
        "stat_type":"player_in",
        "stat_label":"Player In",
        "category":"Participation",
        "point_value":0
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'semantic boundary does not reveal private classifications across authorization scopes'
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"28428428-4284-4284-8284-284284284285","role":"authenticated"}',
  true
);

-- Production-shaped historical contamination: retained evidence that predates
-- this boundary. It is inserted directly only to prove public egress filters it.
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
  'v284-boundary-historical-private',
  'v284-boundary-game',
  'v284-boundary-team',
  'v284-boundary-player',
  '28428428-4284-4284-8284-284284284285',
  'v284-boundary-coach-grant',
  '{
    "occurred_at":"2026-07-28T12:05:00Z",
    "period":"Q1",
    "stat_type":"legacy_shift_alias",
    "stat_label":"Private Legacy Alias",
    "category":"Participation",
    "point_value":0
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
where event_id = 'v284-boundary-historical-private';

insert into public.lh_live_share_tokens(
  token_id,
  token_hash,
  game_id,
  created_by_user_id,
  created_by_grant_id
)
values (
  'v284-boundary-share-token',
  pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to('V284-BOUNDARY-SHARE', 'UTF8'),
      'sha256'
    ),
    'hex'
  ),
  'v284-boundary-game',
  '28428428-4284-4284-8284-284284284285',
  'v284-boundary-coach-grant'
);

select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
select extensions.is(
  pg_catalog.jsonb_array_length(
    public.lh_public_live_share_game('v284-boundary-share') -> 'events'
  ),
  2,
  'Live Share stays at two ordinary events after private alias attempts and historical contamination'
);
select extensions.ok(
  not (
    public.lh_public_live_share_game('v284-boundary-share') -> 'events'
  ) @> '[{"event_id":"v284-boundary-historical-private"}]'::jsonb,
  'historical private evidence is excluded from anonymous egress'
);
select extensions.ok(
  not (
    public.lh_public_live_share_game('v284-boundary-share') -> 'events'
  ) @> '[{"event_id":"v284-boundary-private-note"}]'::jsonb,
  'ordinary private note events and their annotations are excluded from anonymous egress'
);
select extensions.is(
  public.lh_public_live_share_game('v284-boundary-share')
    -> 'events' -> 0 ->> 'stat_label',
  'Goal',
  'anonymous egress emits canonical labels only'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"28428428-4284-4284-8284-284284284285","role":"authenticated"}',
  true
);
select extensions.is(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-correct-to-player-in",
      "event_id":"v284-boundary-goal",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "changes":{
        "stat_type":"player_in",
        "stat_label":"Player In",
        "category":"Participation"
      },
      "correction_reason":"Synthetic boundary probe",
      "client_created_at":"2026-07-28T12:06:00Z"
    }'::jsonb
  ) ->> 'code',
  'unsupported_event_semantics',
  'ordinary event cannot be corrected into private semantics'
);
select extensions.is(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-correct-historical-private",
      "event_id":"v284-boundary-historical-private",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "changes":{"stat_type":"goal"},
      "correction_reason":"Synthetic boundary probe",
      "client_created_at":"2026-07-28T12:07:00Z"
    }'::jsonb
  ) ->> 'code',
  'unsupported_event_semantics',
  'historical private event cannot cross into the ordinary Event Pipeline'
);
select extensions.is(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-canonical-label-correction",
      "event_id":"v284-boundary-goal",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "changes":{"stat_label":"Private Participation Phrase"},
      "correction_reason":"Synthetic boundary probe",
      "client_created_at":"2026-07-28T12:08:00Z"
    }'::jsonb
  ) ->> 'code',
  'corrected',
  'allowed correction canonicalizes caller-controlled semantic labels'
);
select extensions.is(
  (
    select effective_evidence ->> 'stat_label'
    from public.lh_event_effective_versions
    where event_id = 'v284-boundary-goal'
  ),
  'Goal',
  'corrected evidence retains the canonical public label'
);

select extensions.finish();
rollback;
