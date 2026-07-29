\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(41);

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
  not has_function_privilege(
    'authenticated',
    'lh_trust_private.lh_public_event_evidence(jsonb)',
    'execute'
  ),
  'authenticated role cannot invoke the private evidence canonicalizer'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'lh_trust_private.lh_public_event_matches_game(jsonb,text,date)',
    'execute'
  ),
  'anonymous role cannot invoke the private game-evidence validator'
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
  '{"stat_type":"groundBall","stat_label":"Ground Ball","category":"Effort / IQ","point_value":2,"public":true}'::jsonb,
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
        "stat_label":"Goal",
        "category":"Offense",
        "point_value":5,
        "field_zone":"Offensive end"
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
  'create ingress stores the canonical public label'
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
        "stat_type":"groundBall",
        "stat_label":"Ground Ball",
        "category":"Effort / IQ",
        "point_value":2,
        "field_zone":"Midfield"
      },
      "annotations":{},
      "client_created_at":"2026-07-28T12:02:00Z"
    }'::jsonb
  ) ->> 'code',
  'created',
  'canonical ordinary event evidence is accepted'
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
      "client_operation_id":"v284-boundary-create-ground-ball-alias",
      "event_id":"v284-boundary-ground-ball-alias",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:02:30Z",
        "period":"Q1",
        "stat_type":"ground_ball",
        "stat_label":"Private Alias",
        "category":"Private",
        "point_value":2,
        "field_zone":"midfield"
      },
      "annotations":{},
      "client_created_at":"2026-07-28T12:02:30Z"
    }'::jsonb
  ) ->> 'code',
  'invalid_public_event_evidence',
  'noncanonical public-type evidence is rejected instead of being re-hashed'
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
        "stat_label":"Note",
        "category":"Note",
        "point_value":0,
        "field_zone":""
      },
      "annotations":{"note":"private synthetic note"}
    }'::jsonb
  ) ->> 'code',
  'created',
  'ordinary note remains compatible with the canonical Event Pipeline'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-poisoned-period",
      "event_id":"v284-boundary-poisoned-period",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:20Z",
        "period":"Shift 4",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Offense",
        "point_value":5,
        "field_zone":"Midfield"
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'invalid_public_event_evidence',
  'public-type evidence cannot smuggle private semantics through period'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-poisoned-zone",
      "event_id":"v284-boundary-poisoned-zone",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:21Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Offense",
        "point_value":5,
        "field_zone":"Player In at 12:34"
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'invalid_public_event_evidence',
  'public-type evidence cannot smuggle private semantics through field zone'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-poisoned-time",
      "event_id":"v284-boundary-poisoned-time",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2035-07-28T12:04:22Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Offense",
        "point_value":5,
        "field_zone":"Midfield"
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'invalid_public_event_evidence',
  'public-type evidence timestamp is bounded to the game date'
);
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-poisoned-points",
      "event_id":"v284-boundary-poisoned-points",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:23Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Offense",
        "point_value":1234,
        "field_zone":"Midfield"
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'invalid_public_event_evidence',
  'public-type evidence cannot smuggle data through point value'
);

do $fixture$
begin
  perform public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-create-tombstoned",
      "event_id":"v284-boundary-tombstoned",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:24Z",
        "period":"Q1",
        "stat_type":"assist",
        "stat_label":"Assist",
        "category":"Offense",
        "point_value":3,
        "field_zone":"Midfield"
      },
      "annotations":{}
    }'::jsonb
  );
  perform public.lh_tombstone_event(
    '{
      "client_operation_id":"v284-boundary-tombstone-fixture",
      "event_id":"v284-boundary-tombstoned",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "tombstone_reason":"Synthetic authorization-oracle fixture"
    }'::jsonb
  );
end;
$fixture$;

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
select extensions.is(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-unauthorized-unknown-game",
      "event_id":"v284-boundary-unauthorized-unknown",
      "game_id":"v284-boundary-unknown-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:04:31Z",
        "period":"Q1",
        "stat_type":"goal",
        "stat_label":"Goal",
        "category":"Offense",
        "point_value":5,
        "field_zone":""
      },
      "annotations":{}
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'unknown and known cross-scope games return one authorization result'
);
select extensions.is(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-unauthorized-active",
      "event_id":"v284-boundary-goal",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "changes":{"field_zone":"Midfield"},
      "correction_reason":"Synthetic authorization probe"
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'cross-scope active event state is not disclosed'
);
select extensions.is(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-unauthorized-missing",
      "event_id":"v284-boundary-missing",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "changes":{"field_zone":"Midfield"},
      "correction_reason":"Synthetic authorization probe"
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'cross-scope missing event state is not disclosed'
);
select extensions.is(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-unauthorized-tombstoned",
      "event_id":"v284-boundary-tombstoned",
      "game_id":"v284-boundary-game",
      "base_server_event_version":2,
      "changes":{"field_zone":"Midfield"},
      "correction_reason":"Synthetic authorization probe"
    }'::jsonb
  ) ->> 'code',
  'unauthorized_scope',
  'cross-scope tombstoned event state is not disclosed'
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

insert into public.lh_events(
  event_id,
  game_id,
  team_id,
  roster_player_id,
  created_by_user_id,
  created_by_grant_id,
  original_evidence
)
values
  (
    'v284-boundary-historical-public-poisoned-fields',
    'v284-boundary-game',
    'v284-boundary-team',
    'v284-boundary-player',
    '28428428-4284-4284-8284-284284284285',
    'v284-boundary-coach-grant',
    '{
      "occurred_at":"2026-07-28T12:05:10Z",
      "period":"Q1",
      "stat_type":"goal",
      "stat_label":"Player In at 12:34",
      "category":"Participation",
      "point_value":999,
      "field_zone":"Midfield"
    }'::jsonb
  ),
  (
    'v284-boundary-historical-public-invalid-zone',
    'v284-boundary-game',
    'v284-boundary-team',
    'v284-boundary-player',
    '28428428-4284-4284-8284-284284284285',
    'v284-boundary-coach-grant',
    '{
      "occurred_at":"2026-07-28T12:05:20Z",
      "period":"Q1",
      "stat_type":"goal",
      "stat_label":"Goal",
      "category":"Offense",
      "point_value":5,
      "field_zone":"Player In at 12:34"
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
where event_id in (
  'v284-boundary-historical-public-poisoned-fields',
  'v284-boundary-historical-public-invalid-zone'
);

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
  3,
  'Live Share includes only three ordinary events after private and poisoned evidence attempts'
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
select extensions.ok(
  not (
    public.lh_public_live_share_game('v284-boundary-share') -> 'events'
  ) @> '[{"event_id":"v284-boundary-historical-public-invalid-zone"}]'::jsonb,
  'historical public-type evidence with an invalid field is excluded from anonymous egress'
);
select extensions.ok(
  (
    select event
    from pg_catalog.jsonb_array_elements(
      public.lh_public_live_share_game('v284-boundary-share') -> 'events'
    ) as event
    where event ->> 'event_id' = 'v284-boundary-historical-public-poisoned-fields'
  ) @> '{
    "stat_type":"goal",
    "stat_label":"Goal",
    "category":"Offense",
    "point_value":5,
    "field_zone":"Midfield"
  }'::jsonb,
  'historical public-type evidence is canonicalized across every public field at egress'
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

insert into public.lh_event_operations(
  operation_id,
  actor_user_id,
  client_operation_id,
  operation_type,
  game_id,
  event_id,
  request_hash,
  outcome_class,
  outcome_code,
  result_server_event_version,
  actor_grant_id
)
values
  (
    'v284-boundary-premigration-private-operation',
    '28428428-4284-4284-8284-284284284285',
    'v284-boundary-premigration-private-retry',
    'create_event',
    'v284-boundary-game',
    'v284-boundary-premigration-private',
    lh_trust_private.lh_operation_hash(
      '{
        "client_operation_id":"v284-boundary-premigration-private-retry",
        "event_id":"v284-boundary-premigration-private",
        "game_id":"v284-boundary-game",
        "evidence":{
          "occurred_at":"2026-07-28T12:05:30Z",
          "period":"Q1",
          "stat_type":"legacy_shift_alias",
          "stat_label":"Legacy Participation Alias",
          "category":"Participation",
          "point_value":0
        },
        "annotations":{}
      }'::jsonb
    ),
    'accepted',
    'created',
    1,
    'v284-boundary-coach-grant'
  ),
  (
    'v284-boundary-premigration-public-operation',
    '28428428-4284-4284-8284-284284284285',
    'v284-boundary-premigration-public-retry',
    'create_event',
    'v284-boundary-game',
    'v284-boundary-premigration-public',
    lh_trust_private.lh_operation_hash(
      '{
        "client_operation_id":"v284-boundary-premigration-public-retry",
        "event_id":"v284-boundary-premigration-public",
        "game_id":"v284-boundary-game",
        "evidence":{
          "occurred_at":"2026-07-28T12:05:31Z",
          "period":"Q1",
          "stat_type":"ground_ball",
          "stat_label":"Legacy Ground Ball",
          "category":"Legacy",
          "point_value":2
        },
        "annotations":{}
      }'::jsonb
    ),
    'accepted',
    'created',
    1,
    'v284-boundary-coach-grant'
  ),
  (
    'v284-boundary-premigration-correction-operation',
    '28428428-4284-4284-8284-284284284285',
    'v284-boundary-premigration-correction-retry',
    'correct_event',
    'v284-boundary-game',
    'v284-boundary-goal',
    lh_trust_private.lh_operation_hash(
      '{
        "client_operation_id":"v284-boundary-premigration-correction-retry",
        "event_id":"v284-boundary-goal",
        "game_id":"v284-boundary-game",
        "base_server_event_version":1,
        "changes":{"stat_label":"Legacy Goal Label"},
        "correction_reason":"Pre-migration accepted operation"
      }'::jsonb
    ),
    'accepted',
    'corrected',
    2,
    'v284-boundary-coach-grant'
  );

select extensions.ok(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-premigration-private-retry",
      "event_id":"v284-boundary-premigration-private",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:05:30Z",
        "period":"Q1",
        "stat_type":"legacy_shift_alias",
        "stat_label":"Legacy Participation Alias",
        "category":"Participation",
        "point_value":0
      },
      "annotations":{}
    }'::jsonb
  ) @> '{"outcome":"accepted","code":"created","replay":true}'::jsonb,
  'pre-migration private operation replays before new semantic validation'
);
select extensions.ok(
  public.lh_create_event(
    '{
      "client_operation_id":"v284-boundary-premigration-public-retry",
      "event_id":"v284-boundary-premigration-public",
      "game_id":"v284-boundary-game",
      "evidence":{
        "occurred_at":"2026-07-28T12:05:31Z",
        "period":"Q1",
        "stat_type":"ground_ball",
        "stat_label":"Legacy Ground Ball",
        "category":"Legacy",
        "point_value":2
      },
      "annotations":{}
    }'::jsonb
  ) @> '{"outcome":"accepted","code":"created","replay":true}'::jsonb,
  'pre-migration noncanonical public operation replays against its raw immutable hash'
);
select extensions.ok(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-premigration-correction-retry",
      "event_id":"v284-boundary-goal",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "changes":{"stat_label":"Legacy Goal Label"},
      "correction_reason":"Pre-migration accepted operation"
    }'::jsonb
  ) @> '{"outcome":"accepted","code":"corrected","replay":true}'::jsonb,
  'pre-migration correction replays before canonical evidence validation'
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
  'invalid_public_event_evidence',
  'caller-controlled semantic labels are rejected before operation hashing'
);
select extensions.is(
  (
    select effective_evidence ->> 'stat_label'
    from public.lh_event_effective_versions
    where event_id = 'v284-boundary-goal'
  ),
  'Goal',
  'rejected correction leaves the canonical public label unchanged'
);
select extensions.is(
  public.lh_correct_event(
    '{
      "client_operation_id":"v284-boundary-valid-field-zone-correction",
      "event_id":"v284-boundary-goal",
      "game_id":"v284-boundary-game",
      "base_server_event_version":1,
      "changes":{"field_zone":"Midfield"},
      "correction_reason":"Synthetic canonical correction",
      "client_created_at":"2026-07-28T12:09:00Z"
    }'::jsonb
  ) ->> 'code',
  'corrected',
  'canonical ordinary evidence remains correctable'
);
select extensions.is(
  (
    select effective_evidence ->> 'field_zone'
    from public.lh_event_effective_versions
    where event_id = 'v284-boundary-goal'
  ),
  'Midfield',
  'accepted correction stores only the canonical field zone'
);

select extensions.finish();
rollback;
