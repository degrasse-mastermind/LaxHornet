-- R2-07E V2 complete-chain certification assertions.
-- Executed only against a fresh disposable PostgreSQL 17 database by
-- tools/test_r207e_complete_chain.mjs. This file is not a migration or seed.

do $certification$
declare
  missing_relations text[];
  missing_functions text[];
  unsafe_rls text[];
  recursive_team_policies text[];
begin
  select array_agg(expected.name order by expected.name)
  into missing_relations
  from unnest(array[
    'public.game_sync_operations',
    'public.game_sync_operation_attempts',
    'public.game_field_changes',
    'public.game_conflicts',
    'public.game_conflict_resolutions',
    'public.legacy_event_sync_operations',
    'public.legacy_event_sync_operation_attempts',
    'public.legacy_event_field_changes',
    'public.legacy_event_tombstones',
    'public.game_clock_commands',
    'public.game_clock_batches',
    'public.r207_preview_control'
  ]) as expected(name)
  where to_regclass(expected.name) is null;

  if missing_relations is not null then
    raise exception 'R207E_COMPLETE_CHAIN_MISSING_RELATIONS: %', missing_relations;
  end if;

  select array_agg(expected.name order by expected.name)
  into missing_functions
  from unnest(array[
    'public.laxhornet_sync_game_v2(jsonb)',
    'public.laxhornet_sync_event_v2(jsonb)',
    'public.laxhornet_read_game_conflicts_v1(jsonb)',
    'public.laxhornet_resolve_game_conflict_v1(jsonb)',
    'public.lh_apply_game_clock_operation_v2(jsonb)',
    'public.lh_apply_game_clock_batch_v2(jsonb)',
    'lh_rls_private.current_team_role(text)'
  ]) as expected(name)
  where to_regprocedure(expected.name) is null;

  if missing_functions is not null then
    raise exception 'R207E_COMPLETE_CHAIN_MISSING_FUNCTIONS: %', missing_functions;
  end if;

  select array_agg(class.relname order by class.relname)
  into unsafe_rls
  from pg_class as class
  join pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(array[
      'game_sync_operations',
      'game_sync_operation_attempts',
      'game_field_changes',
      'game_conflicts',
      'game_conflict_resolutions',
      'legacy_event_sync_operations',
      'legacy_event_sync_operation_attempts',
      'legacy_event_field_changes',
      'legacy_event_tombstones',
      'game_clock_commands',
      'game_clock_batches'
    ])
    and (not class.relrowsecurity or not class.relforcerowsecurity);

  if unsafe_rls is not null then
    raise exception 'R207E_COMPLETE_CHAIN_RLS_NOT_FORCED: %', unsafe_rls;
  end if;

  if coalesce(
    (select preview_enabled from public.r207_preview_control where control_id),
    true
  ) then
    raise exception 'R207E_COMPLETE_CHAIN_DEFAULT_ON';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.laxhornet_sync_game_v2(jsonb)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.laxhornet_sync_game_v2(jsonb)',
    'execute'
  ) then
    raise exception 'R207E_COMPLETE_CHAIN_GAME_RPC_GRANTS';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.lh_apply_game_clock_operation_v2(jsonb)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.lh_apply_game_clock_operation_v2(jsonb)',
    'execute'
  ) then
    raise exception 'R207E_COMPLETE_CHAIN_CLOCK_RPC_GRANTS';
  end if;

  if has_table_privilege('anon', 'public.game_conflicts', 'select')
    or has_table_privilege('authenticated', 'public.game_conflicts', 'insert')
    or has_table_privilege('anon', 'public.game_clock_batches', 'select')
    or has_table_privilege('authenticated', 'public.game_clock_batches', 'select')
  then
    raise exception 'R207E_COMPLETE_CHAIN_PRIVATE_TABLE_GRANTS';
  end if;

  select array_agg(policyname order by policyname)
  into recursive_team_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'team_members'
    and (
      coalesce(qual, '') ~* 'from[[:space:]]+(public[.])?team_members'
      or coalesce(with_check, '') ~* 'from[[:space:]]+(public[.])?team_members'
    );

  if recursive_team_policies is not null then
    raise exception 'R207E_COMPLETE_CHAIN_RECURSIVE_TEAM_POLICIES: %', recursive_team_policies;
  end if;
end;
$certification$;
