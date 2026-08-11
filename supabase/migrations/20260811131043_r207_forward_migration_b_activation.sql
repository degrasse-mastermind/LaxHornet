-- R2-07 Forward Migration B: atomic production activation cutover.
--
-- This artifact is inert until it is applied under separately authorized
-- R2-07F production-release authority. It is deliberately bound to the exact
-- 18-migration certified pre-activation shape, including the inert cutover gate.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('laxhornet:r207-forward-migration-b-activation', 0)
);

do $preflight$
declare
  expected_versions constant text[] := array[
    '20260723000000', '20260723010000', '20260723010607',
    '20260723020000', '20260723030000', '20260723040000',
    '20260727000000', '20260728193942', '20260730004700',
    '20260730134439', '20260730151714', '20260806143128',
    '20260809155442', '20260809164435', '20260809173500',
    '20260809201608', '20260811010813', '20260811131042'
  ];
  actual_versions text[];
  relation_hash text;
  authorization_relation_hash text;
  policy_hash text;
  signature text;
  expected_hash text;
  actual_hash text;
  relation_name text;
  expected_force boolean;
begin
  if pg_catalog.to_regclass('public.r207_preview_control') is not null
    and coalesce((
      select control.preview_enabled
      from public.r207_preview_control as control
      where control.control_id
    ), false)
  then
    raise exception using
      errcode = 'P0001',
      message = 'R207_ACTIVATION_ALREADY_APPLIED';
  end if;

  if pg_catalog.to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:MIGRATION_HISTORY_MISSING';
  end if;

  select pg_catalog.array_agg(migration.version order by migration.version)
  into actual_versions
  from supabase_migrations.schema_migrations as migration;
  if actual_versions is distinct from expected_versions then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:MIGRATION_HISTORY_DRIFT';
  end if;

  foreach relation_name in array array[
    'games', 'events', 'legacy_game_tombstones', 'r207_preview_control',
    'game_sync_operations', 'game_sync_operation_attempts',
    'game_field_changes', 'game_conflicts', 'game_conflict_resolutions',
    'legacy_event_sync_operations', 'legacy_event_sync_operation_attempts',
    'legacy_event_field_changes', 'legacy_event_tombstones',
    'lh_game_clock_states', 'game_clock_commands', 'game_clock_batches'
  ]
  loop
    if pg_catalog.to_regclass('public.' || relation_name) is null then
      raise exception using errcode = 'P0001',
        message = 'R207_ACTIVATION_PREFLIGHT_FAILED:RELATION_MISSING:' || relation_name;
    end if;
  end loop;

  select pg_catalog.md5(pg_catalog.string_agg(shape.item, E'\n' order by shape.item))
  into relation_hash
  from (
    select class.relname || '|' || attribute.attname || '|'
      || pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) || '|'
      || attribute.attnotnull::text || '|'
      || coalesce(pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid), '') as item
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = class.oid
      and attribute.attnum > 0
      and not attribute.attisdropped
    left join pg_catalog.pg_attrdef as default_value
      on default_value.adrelid = class.oid
      and default_value.adnum = attribute.attnum
    where namespace.nspname = 'public'
      and class.relname = any(array[
        'games', 'events', 'legacy_game_tombstones', 'r207_preview_control', 'game_sync_operations',
        'game_sync_operation_attempts', 'game_field_changes', 'game_conflicts',
        'game_conflict_resolutions', 'legacy_event_sync_operations',
        'legacy_event_sync_operation_attempts', 'legacy_event_field_changes',
        'legacy_event_tombstones', 'lh_game_clock_states',
        'game_clock_commands', 'game_clock_batches'
      ])
  ) as shape;
  if relation_hash is distinct from '41a0bbcbf5f3f486c14bd074635fd976' then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:RELATION_SHAPE_DRIFT:' || coalesce(relation_hash, 'null');
  end if;

  select pg_catalog.md5(pg_catalog.string_agg(
    attribute.attname || '|' || pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
      || '|' || attribute.attnotnull::text || '|'
      || coalesce(pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid), ''),
    E'\n' order by attribute.attnum
  ))
  into authorization_relation_hash
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = class.oid and attribute.attnum > 0 and not attribute.attisdropped
  left join pg_catalog.pg_attrdef as default_value
    on default_value.adrelid = class.oid and default_value.adnum = attribute.attnum
  where namespace.nspname = 'lh_sync_private'
    and class.relname = 'r207_write_authorizations';
  if authorization_relation_hash is distinct from 'bcf664c5e4d80beca53d7998add20398' then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:WRITE_AUTHORITY_SHAPE_DRIFT';
  end if;

  select pg_catalog.md5(pg_catalog.string_agg(policy.item, E'\n' order by policy.item))
  into policy_hash
  from (
    select class.relname || '|' || rule.polname || '|' || rule.polpermissive::text || '|'
      || rule.polcmd::text || '|' || coalesce((
        select pg_catalog.string_agg(
          case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end,
          ',' order by role_oid
        )
        from pg_catalog.unnest(rule.polroles) as role_oid
      ), '') || '|' || coalesce(pg_catalog.pg_get_expr(rule.polqual, rule.polrelid), '')
      || '|' || coalesce(pg_catalog.pg_get_expr(rule.polwithcheck, rule.polrelid), '') as item
    from pg_catalog.pg_policy as rule
    join pg_catalog.pg_class as class on class.oid = rule.polrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = any(array[
        'games', 'events', 'legacy_game_tombstones', 'r207_preview_control',
        'game_sync_operations', 'game_sync_operation_attempts', 'game_field_changes',
        'game_conflicts', 'game_conflict_resolutions', 'legacy_event_sync_operations',
        'legacy_event_sync_operation_attempts', 'legacy_event_field_changes',
        'legacy_event_tombstones', 'lh_game_clock_states', 'game_clock_commands',
        'game_clock_batches'
      ])
  ) as policy;
  if policy_hash is distinct from '0c9fc6789e1401e149592e2d8c7f0334' then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:POLICY_DRIFT';
  end if;

  if (
    select pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.pg_get_triggerdef(trigger.oid, true), E'\n' order by class.relname
    ))
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as class on class.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and trigger.tgname like 'laxhornet_r207_cutover_%'
  ) is distinct from '54c058c1a496ca6dadebe6af88d97c87' then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:CUTOVER_TRIGGER_DRIFT';
  end if;

  for signature, expected_hash in
    select binding.signature, binding.expected_hash
    from (values
      ('public.laxhornet_sync_game(jsonb)', 'b768a13ed661414af84c72f16194c0b6'),
      ('public.laxhornet_r207_cutover_write_gate()', 'cff9d350bf904bc083d573dd762edd7f'),
      ('lh_sync_private.r207_authorize_versioned_write()', '71fb779bdb6fbc781421eed30be8db74'),
      ('lh_sync_private.r207_instrument_versioned_writer(regprocedure)', '4727f35d8a21a0b167a9f9b09f76e89f'),
      ('public.laxhornet_r207_preview_capability()', 'c72cc295ab1536e8ae361901bd1228bd'),
      ('public.laxhornet_sync_game_v2(jsonb)', '7b053d29f37620c6e1f2334a5f58c944'),
      ('public.laxhornet_sync_event_v2(jsonb)', '0414e1bd5f1ac670e1da9c533a9c5e5a'),
      ('public.lh_apply_game_clock_operation_v2(jsonb)', '8390daceb66c3aa887381856bae46dd6'),
      ('public.lh_apply_game_clock_batch_v2(jsonb)', 'd45cacd7f640a07766a62630653aa4f6'),
      ('public.laxhornet_read_game_conflicts_v1(jsonb)', 'a2341d6d4a3193d673c2452e19b6d7c2'),
      ('public.laxhornet_resolve_game_conflict_v1(jsonb)', 'd7b726ac2259f40c87c5337b5ce902e2'),
      ('public.laxhornet_delete_event(text)', '43fedf1f19742eeb032206192af47499'),
      ('public.laxhornet_delete_game(text)', 'db4e68499bb72c1eca9ae66a3a9f629b'),
      ('public.lh_initialize_game_clock(jsonb)', '3fbafbf7d9dc715c16cb798c609045b2'),
      ('public.lh_update_game_clock(jsonb)', 'f3b01610665c64d33d7536e6e1ff6713'),
      ('public.lh_reconcile_game_clock(jsonb)', 'bd4904dc45210bb037bfcabeb83eb328')
    ) as binding(signature, expected_hash)
  loop
    if pg_catalog.to_regprocedure(signature) is null then
      raise exception using errcode = 'P0001',
        message = 'R207_ACTIVATION_PREFLIGHT_FAILED:FUNCTION_MISSING:' || signature;
    end if;
    select pg_catalog.md5(pg_catalog.replace(
      pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(signature)),
      pg_catalog.chr(13),
      ''
    ))
    into actual_hash;
    if actual_hash is distinct from expected_hash then
      raise exception using errcode = 'P0001',
        message = 'R207_ACTIVATION_PREFLIGHT_FAILED:FUNCTION_DRIFT:' || signature;
    end if;
  end loop;

  if pg_catalog.has_table_privilege(
      'authenticated', 'lh_sync_private.r207_write_authorizations', 'select')
    or pg_catalog.has_table_privilege(
      'authenticated', 'lh_sync_private.r207_write_authorizations', 'insert')
    or pg_catalog.has_table_privilege(
      'authenticated', 'lh_sync_private.r207_write_authorizations', 'update')
    or pg_catalog.has_table_privilege(
      'authenticated', 'lh_sync_private.r207_write_authorizations', 'delete')
    or pg_catalog.has_table_privilege(
      'anon', 'lh_sync_private.r207_write_authorizations', 'select')
    or pg_catalog.has_function_privilege(
      'authenticated', 'lh_sync_private.r207_authorize_versioned_write()', 'execute')
    or pg_catalog.has_function_privilege(
      'authenticated', 'lh_sync_private.r207_instrument_versioned_writer(regprocedure)', 'execute')
    or pg_catalog.has_function_privilege(
      'anon', 'lh_sync_private.r207_authorize_versioned_write()', 'execute')
  then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:WRITE_AUTHORITY_GRANT_DRIFT';
  end if;

  for relation_name, expected_force in
    select binding.relation_name, binding.expected_force
    from (values
      ('games', false), ('events', false), ('legacy_game_tombstones', true),
      ('lh_game_clock_states', true), ('r207_preview_control', true),
      ('game_sync_operations', true), ('game_sync_operation_attempts', true),
      ('game_field_changes', true), ('game_conflicts', true),
      ('game_conflict_resolutions', true), ('legacy_event_sync_operations', true),
      ('legacy_event_sync_operation_attempts', true), ('legacy_event_field_changes', true),
      ('legacy_event_tombstones', true), ('game_clock_commands', true),
      ('game_clock_batches', true)
    ) as binding(relation_name, expected_force)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = relation_name
        and class.relrowsecurity
        and class.relforcerowsecurity = expected_force
    ) then
      raise exception using errcode = 'P0001',
        message = 'R207_ACTIVATION_PREFLIGHT_FAILED:RLS_DRIFT:' || relation_name;
    end if;
  end loop;

  if not pg_catalog.has_function_privilege(
      'authenticated', 'public.laxhornet_sync_game(jsonb)', 'execute')
    or pg_catalog.has_function_privilege(
      'anon', 'public.laxhornet_sync_game(jsonb)', 'execute')
    or not pg_catalog.has_table_privilege('authenticated', 'public.games', 'insert')
    or not pg_catalog.has_table_privilege('authenticated', 'public.games', 'update')
    or not pg_catalog.has_table_privilege('authenticated', 'public.events', 'insert')
    or not pg_catalog.has_table_privilege('authenticated', 'public.events', 'update')
    or not pg_catalog.has_table_privilege('authenticated', 'public.events', 'delete')
  then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:LEGACY_GRANT_DRIFT';
  end if;

  for signature in
    select unnest(array[
      'public.laxhornet_r207_preview_capability()',
      'public.laxhornet_sync_game_v2(jsonb)',
      'public.laxhornet_sync_event_v2(jsonb)',
      'public.lh_apply_game_clock_operation_v2(jsonb)',
      'public.lh_apply_game_clock_batch_v2(jsonb)',
      'public.laxhornet_read_game_conflicts_v1(jsonb)',
      'public.laxhornet_resolve_game_conflict_v1(jsonb)'
    ])
  loop
    if not pg_catalog.has_function_privilege('authenticated', signature, 'execute')
      or pg_catalog.has_function_privilege('anon', signature, 'execute')
    then
      raise exception using errcode = 'P0001',
        message = 'R207_ACTIVATION_PREFLIGHT_FAILED:V2_GRANT_DRIFT:' || signature;
    end if;
  end loop;

  if (select count(*) from public.r207_preview_control) <> 1
    or coalesce((select preview_enabled from public.r207_preview_control where control_id), true)
  then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:CAPABILITY_NOT_DORMANT';
  end if;

  if (select count(*) from public.game_sync_operations) <> 0
    or (select count(*) from public.game_sync_operation_attempts) <> 0
    or (select count(*) from public.game_field_changes) <> 0
    or (select count(*) from public.game_conflicts) <> 0
    or (select count(*) from public.game_conflict_resolutions) <> 0
    or (select count(*) from public.legacy_event_sync_operations) <> 0
    or (select count(*) from public.legacy_event_sync_operation_attempts) <> 0
    or (select count(*) from public.legacy_event_field_changes) <> 0
    or (select count(*) from public.legacy_event_tombstones) <> 0
    or (select count(*) from public.game_clock_commands) <> 0
    or (select count(*) from public.game_clock_batches) <> 0
  then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:PREACTIVATION_EVIDENCE_NOT_ZERO';
  end if;
end;
$preflight$;

-- This lock envelope gates the final legacy projection reconciliation and all
-- grant/function/capability changes until the transaction commits.
lock table public.games in share row exclusive mode;
lock table public.events in share row exclusive mode;
lock table public.lh_game_clock_states in share row exclusive mode;

update public.games as game_row
set lifecycle_state = case
  when game_row.status = 'complete' then 'completed'
  else 'active'
end
where game_row.lifecycle_state is distinct from case
  when game_row.status = 'complete' then 'completed'
  else 'active'
end;

alter table public.game_sync_operations
  drop constraint game_sync_operations_type_r207_check,
  add constraint game_sync_operations_type_r207_check check (operation_type in (
    'game_create', 'metadata_patch', 'score_delta', 'score_correction',
    'status_transition', 'roster_context_patch', 'sharing_patch',
    'clock_start', 'clock_pause', 'clock_set_remaining', 'clock_batch',
    'conflict_resolution'
  ));

create or replace function public.laxhornet_sync_game_v2(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  enabled boolean := false;
  actor_id uuid := (select auth.uid());
  client_id text := btrim(coalesce(p_operation ->> 'client_operation_id', ''));
  target_game_id text := btrim(coalesce(p_operation ->> 'game_id', ''));
  provided_request_hash text := lower(btrim(coalesce(p_operation ->> 'request_hash', '')));
  request_hash text;
  game_payload jsonb := p_operation -> 'game';
  target_game public.games%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
  stored_operation public.game_sync_operations%rowtype;
  result jsonb;
  operation_uuid uuid := gen_random_uuid();
  payload_team_id text;
  payload_roster_player_id text;
begin
  select control.preview_enabled into enabled
  from public.r207_preview_control as control
  where control.control_id;
  if not coalesce(enabled, false) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
  end if;
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;

  if coalesce(p_operation ->> 'operation_type', '') <> 'game_create' then
    result := lh_sync_private.r207_apply_game_operation_for_test(p_operation, false);
    if result ->> 'outcome' in ('accepted', 'merged') then
      update public.games as game_row set saved_at = statement_timestamp()
      where game_row.id = target_game_id returning game_row.* into target_game;
      if found then
        result := result || jsonb_build_object('server_game', jsonb_strip_nulls(jsonb_build_object(
          'id', target_game.id, 'opponent', target_game.opponent,
          'game_date', target_game.game_date, 'location', target_game.location,
          'game_type', target_game.game_type, 'lifecycle_state', target_game.lifecycle_state,
          'score_for', target_game.score_for, 'score_against', target_game.score_against,
          'score_known', target_game.score_known, 'saved_at', target_game.saved_at
        )));
      end if;
    end if;
    return result;
  end if;

  if client_id = '' or length(client_id) > 200
    or target_game_id = '' or length(target_game_id) > 200
    or provided_request_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(game_payload) <> 'object'
    or pg_column_size(game_payload) > 16384
    or exists (
      select 1 from jsonb_object_keys(game_payload) as key
      where key <> all(array[
        'id','player_id','team_id','roster_player_id','share_code','is_shared',
        'opponent','game_date','location','game_type','period_format','player_snapshot',
        'current_quarter','status','created_at','saved_at','ended_at','score_for',
        'score_against','score_known','lifecycle_state'
      ])
    )
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_create');
  end if;
  request_hash := encode(extensions.digest(
    pg_catalog.convert_to((p_operation - 'request_hash')::text, 'UTF8'),
    'sha256'
  ), 'hex');
  if btrim(coalesce(game_payload ->> 'id', '')) <> target_game_id
    or length(btrim(coalesce(game_payload ->> 'share_code', ''))) not between 1 and 64
    or length(btrim(coalesce(game_payload ->> 'opponent', ''))) not between 1 and 200
    or length(coalesce(game_payload ->> 'location', '')) > 500
    or length(coalesce(game_payload ->> 'game_type', '')) > 100
    or coalesce(game_payload ->> 'period_format', '') not in ('quarters', 'halves')
    or coalesce(game_payload ->> 'status', '') not in ('in-progress', 'complete')
    or coalesce(game_payload ->> 'lifecycle_state', '') not in ('active', 'paused', 'completed')
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_create');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'laxhornet:r207-operation:' || actor_id::text || ':' || client_id, 0
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('laxhornet:legacy-game:' || target_game_id, 0)
  );
  select * into tombstone from public.legacy_game_tombstones where game_id = target_game_id;
  if found then
    if lh_sync_private.r207_tombstone_authority(actor_id, tombstone) then
      return jsonb_build_object('outcome', 'deleted', 'code', 'game_deleted');
    end if;
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  select * into stored_operation from public.game_sync_operations
  where actor_user_id = actor_id and client_operation_id = client_id;
  if found then
    if stored_operation.game_id <> target_game_id then
      return jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_id_scope_mismatch');
    elsif stored_operation.request_hash <> request_hash then
      return jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_id_payload_mismatch');
    end if;
    insert into public.game_sync_operation_attempts(
      actor_user_id, client_operation_id, canonical_operation_id, attempt_code
    ) values (actor_id, client_id, stored_operation.operation_id, 'idempotent_replay');
    return stored_operation.canonical_result || jsonb_build_object('replay', true);
  end if;
  if exists (select 1 from public.games where id = target_game_id) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  payload_team_id := nullif(btrim(coalesce(game_payload ->> 'team_id', '')), '');
  payload_roster_player_id := nullif(btrim(coalesce(game_payload ->> 'roster_player_id', '')), '');
  if (payload_team_id is null) <> (payload_roster_player_id is null)
    or (payload_team_id is not null and not public.laxhornet_can_track_roster_player(
      payload_team_id, payload_roster_player_id
    ))
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  insert into public.games(
    id, player_id, user_id, team_id, roster_player_id, share_code, is_shared,
    opponent, game_date, location, game_type, period_format, player_snapshot,
    current_quarter, status, created_at, saved_at, ended_at, lifecycle_state,
    score_for, score_against, score_known, final_score_for, final_score_against
  ) values (
    target_game_id, nullif(game_payload ->> 'player_id', ''), actor_id,
    payload_team_id, payload_roster_player_id, btrim(game_payload ->> 'share_code'),
    coalesce((game_payload ->> 'is_shared')::boolean, false),
    btrim(game_payload ->> 'opponent'), (game_payload ->> 'game_date')::date,
    coalesce(game_payload ->> 'location', ''), coalesce(game_payload ->> 'game_type', ''),
    game_payload ->> 'period_format', coalesce(game_payload -> 'player_snapshot', '{}'::jsonb),
    coalesce(game_payload ->> 'current_quarter', 'Q1'), game_payload ->> 'status',
    coalesce((game_payload ->> 'created_at')::timestamptz, statement_timestamp()),
    coalesce((game_payload ->> 'saved_at')::timestamptz, statement_timestamp()),
    nullif(game_payload ->> 'ended_at', '')::timestamptz,
    game_payload ->> 'lifecycle_state',
    coalesce((game_payload ->> 'score_for')::integer, 0),
    coalesce((game_payload ->> 'score_against')::integer, 0),
    coalesce((game_payload ->> 'score_known')::boolean, false),
    case when game_payload ->> 'lifecycle_state' = 'completed' and coalesce((game_payload ->> 'score_known')::boolean, false)
      then coalesce((game_payload ->> 'score_for')::integer, 0) end,
    case when game_payload ->> 'lifecycle_state' = 'completed' and coalesce((game_payload ->> 'score_known')::boolean, false)
      then coalesce((game_payload ->> 'score_against')::integer, 0) end
  ) returning * into target_game;

  result := jsonb_build_object(
    'outcome', 'accepted', 'code', 'game_created', 'replay', false,
    'versions', lh_sync_private.r207_game_versions(target_game),
    'server_game', jsonb_strip_nulls(jsonb_build_object(
      'id', target_game.id, 'opponent', target_game.opponent,
      'game_date', target_game.game_date, 'location', target_game.location,
      'game_type', target_game.game_type, 'lifecycle_state', target_game.lifecycle_state,
      'score_for', target_game.score_for, 'score_against', target_game.score_against,
      'score_known', target_game.score_known, 'saved_at', target_game.saved_at
    ))
  );
  insert into public.game_sync_operations(
    operation_id, actor_user_id, client_operation_id, game_id, operation_type,
    request_hash, changed_fields, outcome_class, outcome_code, result_versions,
    canonical_result, client_created_at
  ) values (
    operation_uuid, actor_id, client_id, target_game_id, 'game_create', request_hash,
    array['game'], 'accepted', 'game_created',
    lh_sync_private.r207_game_versions(target_game), result,
    nullif(p_operation ->> 'client_created_at', '')::timestamptz
  );
  return result;
exception
  when check_violation or foreign_key_violation or unique_violation
    or invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_create');
end;
$function$;

create or replace function public.laxhornet_sync_game(p_operation jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'outcome', 'rejected',
    'code', 'client_upgrade_required',
    'action', 'update_required',
    'message', 'Update LaxHornet before cloud sync. Your game remains saved on this device.'
  );
$function$;

create or replace function public.laxhornet_r207_preview_capability()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'enabled', coalesce((
      select control.preview_enabled
      from public.r207_preview_control as control
      where control.control_id
    ), false),
    'protocol', 'r207',
    'productionActivation', coalesce((
      select control.preview_enabled
      from public.r207_preview_control as control
      where control.control_id
    ), false)
  );
$function$;

revoke insert, update, delete on table public.games
  from public, anon, authenticated;
revoke insert, update, delete on table public.events
  from public, anon, authenticated;

revoke execute on function public.laxhornet_delete_game(text)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_delete_event(text)
  from public, anon, authenticated;
revoke execute on function public.lh_initialize_game_clock(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_update_game_clock(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_reconcile_game_clock(jsonb)
  from public, anon, authenticated;

revoke execute on function public.laxhornet_sync_game(jsonb)
  from public, anon, authenticated;
grant execute on function public.laxhornet_sync_game(jsonb) to authenticated;

revoke execute on function public.laxhornet_r207_preview_capability()
  from public, anon, authenticated;
grant execute on function public.laxhornet_r207_preview_capability()
  to authenticated;

grant execute on function public.laxhornet_sync_game_v2(jsonb)
  to authenticated;
grant execute on function public.laxhornet_sync_event_v2(jsonb)
  to authenticated;
grant execute on function public.lh_apply_game_clock_operation_v2(jsonb)
  to authenticated;
grant execute on function public.lh_apply_game_clock_batch_v2(jsonb)
  to authenticated;
grant execute on function public.laxhornet_read_game_conflicts_v1(jsonb)
  to authenticated;
grant execute on function public.laxhornet_resolve_game_conflict_v1(jsonb)
  to authenticated;

-- The inert pre-cutover triggers reject canonical mutation in v2 mode unless
-- the reviewed SECURITY DEFINER entrypoint issues the private transaction row.
select lh_sync_private.r207_instrument_versioned_writer(
  'public.laxhornet_sync_game_v2(jsonb)'::regprocedure);
select lh_sync_private.r207_instrument_versioned_writer(
  'public.laxhornet_sync_event_v2(jsonb)'::regprocedure);
select lh_sync_private.r207_instrument_versioned_writer(
  'public.lh_apply_game_clock_operation_v2(jsonb)'::regprocedure);
select lh_sync_private.r207_instrument_versioned_writer(
  'public.lh_apply_game_clock_batch_v2(jsonb)'::regprocedure);
select lh_sync_private.r207_instrument_versioned_writer(
  'public.laxhornet_resolve_game_conflict_v1(jsonb)'::regprocedure);
select lh_sync_private.r207_instrument_versioned_writer(
  'public.laxhornet_delete_game_durable(jsonb)'::regprocedure);

update public.r207_preview_control
set preview_enabled = true,
    cutover_mode = 'v2',
    updated_at = statement_timestamp()
where control_id;

-- Certification replaces this comment in-memory with an injected exception
-- to prove the entire cutover rolls back after the capability update.
-- R207_ACTIVATION_FAILURE_INJECTION_BOUNDARY

do $postflight$
begin
  if not coalesce((select preview_enabled from public.r207_preview_control where control_id), false)
    or coalesce((select cutover_mode from public.r207_preview_control where control_id), '') <> 'v2'
    or not pg_catalog.has_function_privilege(
      'authenticated', 'public.laxhornet_sync_game(jsonb)', 'execute')
    or pg_catalog.has_table_privilege('authenticated', 'public.games', 'insert')
    or pg_catalog.has_table_privilege('authenticated', 'public.games', 'update')
    or pg_catalog.has_table_privilege('authenticated', 'public.events', 'insert')
    or pg_catalog.has_table_privilege('authenticated', 'public.events', 'update')
    or pg_catalog.has_table_privilege('authenticated', 'public.events', 'delete')
    or pg_catalog.has_function_privilege(
      'authenticated', 'public.laxhornet_delete_event(text)', 'execute')
    or pg_catalog.has_function_privilege(
      'authenticated', 'public.lh_update_game_clock(jsonb)', 'execute')
  then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_POSTFLIGHT_FAILED:NO_DUAL_AUTHORITY';
  end if;
end;
$postflight$;

comment on function public.laxhornet_sync_game(jsonb) is
  'R2-07 Forward Migration B stable legacy rejection stub. It never mutates and returns client_upgrade_required.';
comment on function public.laxhornet_r207_preview_capability() is
  'Canonical authenticated R2-07 server capability. productionActivation is true only after atomic Forward Migration B activation.';

commit;
