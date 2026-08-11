-- R2-07 Forward Migration B: atomic production activation cutover.
--
-- This artifact is inert until it is applied under separately authorized
-- R2-07F production-release authority. It is deliberately bound to the exact
-- 17-migration R2-07E certified pre-activation shape.

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
    '20260809201608', '20260811010813'
  ];
  actual_versions text[];
  relation_hash text;
  signature text;
  expected_hash text;
  actual_hash text;
  relation_name text;
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
        'games', 'events', 'r207_preview_control', 'game_sync_operations',
        'game_sync_operation_attempts', 'game_field_changes', 'game_conflicts',
        'game_conflict_resolutions', 'legacy_event_sync_operations',
        'legacy_event_sync_operation_attempts', 'legacy_event_field_changes',
        'legacy_event_tombstones', 'lh_game_clock_states',
        'game_clock_commands', 'game_clock_batches'
      ])
  ) as shape;
  if relation_hash is distinct from '4529b8192848e429d76d67d6021d78be' then
    raise exception using errcode = 'P0001',
      message = 'R207_ACTIVATION_PREFLIGHT_FAILED:RELATION_SHAPE_DRIFT';
  end if;

  for signature, expected_hash in
    select binding.signature, binding.expected_hash
    from (values
      ('public.laxhornet_sync_game(jsonb)', '54b6ca6bf4752f1bb3ef2fe98ae1e393'),
      ('public.laxhornet_r207_preview_capability()', '63bb9356af17f5571d8ae8e05e42b6b9'),
      ('public.laxhornet_sync_game_v2(jsonb)', '873759464eefa7d321765829f2cdc13f'),
      ('public.laxhornet_sync_event_v2(jsonb)', 'afc7cab909561c4f191bbb59b7911006'),
      ('public.lh_apply_game_clock_operation_v2(jsonb)', '93d3b57670aea4e7bd357c23bd49ec3b'),
      ('public.lh_apply_game_clock_batch_v2(jsonb)', 'eedf0882efa95b4e4d7ec05c72a2098a'),
      ('public.laxhornet_read_game_conflicts_v1(jsonb)', '73fcf1f9a7e7eaca5825491aa0b64d7a'),
      ('public.laxhornet_resolve_game_conflict_v1(jsonb)', 'eb79a8e1790561813961958dcb8a67cc'),
      ('public.laxhornet_delete_event(text)', '4ce6265c91ea7062371e4072f2112856'),
      ('public.laxhornet_delete_game(text)', '3970745ff956522cae43e050410ee41a'),
      ('public.lh_initialize_game_clock(jsonb)', '4e4a0aefe3cc2f68aff8b1c8b3546206'),
      ('public.lh_update_game_clock(jsonb)', 'fae4d47d017536c54dc98d7e106ef04a'),
      ('public.lh_reconcile_game_clock(jsonb)', '0b4f0872b60e2ebfb5acc15aab3b2d9e')
    ) as binding(signature, expected_hash)
  loop
    if pg_catalog.to_regprocedure(signature) is null then
      raise exception using errcode = 'P0001',
        message = 'R207_ACTIVATION_PREFLIGHT_FAILED:FUNCTION_MISSING:' || signature;
    end if;
    select pg_catalog.md5(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(signature)))
    into actual_hash;
    if actual_hash is distinct from expected_hash then
      raise exception using errcode = 'P0001',
        message = 'R207_ACTIVATION_PREFLIGHT_FAILED:FUNCTION_DRIFT:' || signature;
    end if;
  end loop;

  foreach relation_name in array array[
    'r207_preview_control', 'game_sync_operations',
    'game_sync_operation_attempts', 'game_field_changes', 'game_conflicts',
    'game_conflict_resolutions', 'legacy_event_sync_operations',
    'legacy_event_sync_operation_attempts', 'legacy_event_field_changes',
    'legacy_event_tombstones', 'game_clock_commands', 'game_clock_batches'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = relation_name
        and class.relrowsecurity
        and class.relforcerowsecurity
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

update public.r207_preview_control
set preview_enabled = true,
    updated_at = statement_timestamp()
where control_id;

-- Certification replaces this comment in-memory with an injected exception
-- to prove the entire cutover rolls back after the capability update.
-- R207_ACTIVATION_FAILURE_INJECTION_BOUNDARY

do $postflight$
begin
  if not coalesce((select preview_enabled from public.r207_preview_control where control_id), false)
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
