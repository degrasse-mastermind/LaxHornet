-- R2-07F pre-activation reconciliation for independently observed production
-- policy drift. This migration is intentionally policy-only: it removes the
-- exact 12 unversioned team-wide policies certified below and refuses every
-- other catalog state, including the already-reconciled state.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('laxhornet:r207-policy-reconciliation', 0)
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
  policy_hash text;
  certified_policy_hash text;
  actual_hash text;
  relation_name text;
  policy_name text;
  expected_hash text;
  expected_force boolean;
begin
  if pg_catalog.to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:MIGRATION_HISTORY_MISSING';
  end if;

  select pg_catalog.array_agg(migration.version order by migration.version)
  into actual_versions
  from supabase_migrations.schema_migrations as migration;
  if actual_versions is distinct from expected_versions then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:MIGRATION_HISTORY_DRIFT';
  end if;

  if pg_catalog.to_regclass('public.r207_preview_control') is null
    or (select count(*) from public.r207_preview_control) <> 1
    or coalesce((select preview_enabled from public.r207_preview_control where control_id), true)
    or coalesce((select cutover_mode from public.r207_preview_control where control_id), '') <> 'legacy'
  then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:CAPABILITY_NOT_DORMANT';
  end if;

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
      on attribute.attrelid = class.oid and attribute.attnum > 0 and not attribute.attisdropped
    left join pg_catalog.pg_attrdef as default_value
      on default_value.adrelid = class.oid and default_value.adnum = attribute.attnum
    where namespace.nspname = 'public'
      and class.relname = any(array[
        'games', 'events', 'legacy_game_tombstones', 'r207_preview_control',
        'game_sync_operations', 'game_sync_operation_attempts', 'game_field_changes',
        'game_conflicts', 'game_conflict_resolutions', 'legacy_event_sync_operations',
        'legacy_event_sync_operation_attempts', 'legacy_event_field_changes',
        'legacy_event_tombstones', 'lh_game_clock_states', 'game_clock_commands',
        'game_clock_batches'
      ])
  ) as shape;
  if relation_hash is distinct from '41a0bbcbf5f3f486c14bd074635fd976' then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:RELATION_SHAPE_DRIFT:' || coalesce(relation_hash, 'null');
  end if;

  select pg_catalog.md5(pg_catalog.string_agg(policy.item, E'\n' order by policy.item))
  into policy_hash
  from (
    select class.relname || '|' || rule.polname || '|' || rule.polpermissive::text || '|'
      || rule.polcmd::text || '|' || coalesce((
        select pg_catalog.string_agg(
          case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end,
          ',' order by role_oid
        ) from pg_catalog.unnest(rule.polroles) as role_oid
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
  if policy_hash = '0c9fc6789e1401e149592e2d8c7f0334' then
    perform pg_catalog.set_config('laxhornet.r207_policy_reconciliation_needed', 'false', true);
  elsif policy_hash is distinct from 'e7bc2b4dab7dda61af7967dad18b50ca' then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:UNRECOGNIZED_POLICY_DRIFT:' || coalesce(policy_hash, 'null');
  else
    perform pg_catalog.set_config('laxhornet.r207_policy_reconciliation_needed', 'true', true);
  end if;

  select pg_catalog.md5(pg_catalog.string_agg(policy.item, E'\n' order by policy.item))
  into certified_policy_hash
  from (
    select class.relname || '|' || rule.polname || '|' || rule.polpermissive::text || '|'
      || rule.polcmd::text || '|' || coalesce((
        select pg_catalog.string_agg(
          case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end,
          ',' order by role_oid
        ) from pg_catalog.unnest(rule.polroles) as role_oid
      ), '') || '|' || coalesce(pg_catalog.pg_get_expr(rule.polqual, rule.polrelid), '')
      || '|' || coalesce(pg_catalog.pg_get_expr(rule.polwithcheck, rule.polrelid), '') as item
    from pg_catalog.pg_policy as rule
    join pg_catalog.pg_class as class on class.oid = rule.polrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = any(array['games','events','legacy_game_tombstones','game_conflict_resolutions','game_conflicts'])
      and rule.polname <> all(array[
        'events_delete_team','events_insert_team','events_select_team','events_update_team',
        'games_delete_team','games_insert_team','games_select_team','games_update_team'
      ])
  ) as policy;
  if certified_policy_hash is distinct from '0c9fc6789e1401e149592e2d8c7f0334' then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:CERTIFIED_POLICY_DRIFT';
  end if;

  if pg_catalog.current_setting('laxhornet.r207_policy_reconciliation_needed')::boolean then
    for relation_name, policy_name, expected_hash in
      select binding.relation_name, binding.policy_name, binding.expected_hash
      from (values
      ('events','events_delete_team','8c3cc2e9c68a467899d27d6b15ee568a'),
      ('events','events_insert_team','5c19ec6438bf1e8ef11bf8d52fce05ac'),
      ('events','events_select_team','0c42fefb5bdca4d43b2fd65a542825ae'),
      ('events','events_update_team','6f186ac99a9c16d7a31bb016f3f540fd'),
      ('games','games_delete_team','99bb6f286879671c080ef26ff96613ab'),
      ('games','games_insert_team','45fcb502fdb887439d378719763388cf'),
      ('games','games_select_team','d3346aa91cd6aac09acbb6433ac6f449'),
      ('games','games_update_team','73ebc5bef7bb6371c3192519cd12f696'),
      ('lh_game_clock_states','lh_game_clock_states_delete_team','0aecb742675ea958c660c4245e977506'),
      ('lh_game_clock_states','lh_game_clock_states_insert_team','d04277dec07f42d5fcf51f1504072545'),
      ('lh_game_clock_states','lh_game_clock_states_select_team','21dd01077cacd84da4cab147aa5d3ef7'),
      ('lh_game_clock_states','lh_game_clock_states_update_team','4303a30c429738ab480dc38a969effc5')
      ) as binding(relation_name, policy_name, expected_hash)
    loop
      select pg_catalog.md5(class.relname || '|' || rule.polname || '|'
      || rule.polpermissive::text || '|' || rule.polcmd::text || '|' || coalesce((
        select pg_catalog.string_agg(
          case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end,
          ',' order by role_oid
        ) from pg_catalog.unnest(rule.polroles) as role_oid
      ), '') || '|' || coalesce(pg_catalog.pg_get_expr(rule.polqual, rule.polrelid), '')
      || '|' || coalesce(pg_catalog.pg_get_expr(rule.polwithcheck, rule.polrelid), ''))
      into actual_hash
      from pg_catalog.pg_policy as rule
      join pg_catalog.pg_class as class on class.oid = rule.polrelid
      join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = relation_name and rule.polname = policy_name;
      if actual_hash is distinct from expected_hash then
        raise exception using errcode = 'P0001',
          message = 'R207_POLICY_RECONCILIATION_FAILED:POLICY_DEFINITION_DRIFT:' || relation_name || ':' || policy_name;
      end if;
    end loop;
  end if;

  if pg_catalog.md5(pg_catalog.replace(
      pg_catalog.pg_get_functiondef('public.laxhornet_can_track_roster_player(text,text)'::regprocedure),
      pg_catalog.chr(13), ''
    )) is distinct from '310efc6c975c2b9014ab1f6729a955e0'
  then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:AUTHORIZATION_FUNCTION_DRIFT';
  end if;

  for relation_name, expected_force in
    select binding.relation_name, binding.expected_force
    from (values ('games',false),('events',false),('lh_game_clock_states',true))
      as binding(relation_name, expected_force)
  loop
    if not exists (
      select 1 from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public' and class.relname = relation_name
        and class.relrowsecurity and class.relforcerowsecurity = expected_force
    ) then
      raise exception using errcode = 'P0001',
        message = 'R207_POLICY_RECONCILIATION_FAILED:RLS_DRIFT:' || relation_name;
    end if;
  end loop;
end;
$preflight$;

do $reconcile$
begin
  if pg_catalog.current_setting('laxhornet.r207_policy_reconciliation_needed')::boolean then
    execute 'drop policy events_delete_team on public.events';
    execute 'drop policy events_insert_team on public.events';
    execute 'drop policy events_select_team on public.events';
    execute 'drop policy events_update_team on public.events';
    execute 'drop policy games_delete_team on public.games';
    -- R207_POLICY_RECONCILIATION_FAILURE_INJECTION_BOUNDARY
    execute 'drop policy games_insert_team on public.games';
    execute 'drop policy games_select_team on public.games';
    execute 'drop policy games_update_team on public.games';
    execute 'drop policy lh_game_clock_states_delete_team on public.lh_game_clock_states';
    execute 'drop policy lh_game_clock_states_insert_team on public.lh_game_clock_states';
    execute 'drop policy lh_game_clock_states_select_team on public.lh_game_clock_states';
    execute 'drop policy lh_game_clock_states_update_team on public.lh_game_clock_states';
  end if;
end;
$reconcile$;

do $postflight$
declare
  policy_hash text;
begin
  select pg_catalog.md5(pg_catalog.string_agg(policy.item, E'\n' order by policy.item))
  into policy_hash
  from (
    select class.relname || '|' || rule.polname || '|' || rule.polpermissive::text || '|'
      || rule.polcmd::text || '|' || coalesce((
        select pg_catalog.string_agg(
          case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end,
          ',' order by role_oid
        ) from pg_catalog.unnest(rule.polroles) as role_oid
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
  if policy_hash is distinct from '0c9fc6789e1401e149592e2d8c7f0334'
    or (select count(*) from public.r207_preview_control) <> 1
    or coalesce((select preview_enabled from public.r207_preview_control where control_id), true)
    or coalesce((select cutover_mode from public.r207_preview_control where control_id), '') <> 'legacy'
  then
    raise exception using errcode = 'P0001',
      message = 'R207_POLICY_RECONCILIATION_FAILED:POSTCONDITION';
  end if;
end;
$postflight$;

commit;
