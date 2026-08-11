-- R2-07 Forward Migration B: inert post-activation verification.
--
-- This migration performs no repair and changes no capability, grants,
-- functions, triggers, policies, or data. It exists so a persistent isolated
-- Supabase Preview lineage must prove the same exact committed state that a
-- fresh gate + activation sequence produces.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $verification$
declare
  signature text;
begin
  if pg_catalog.to_regclass('public.r207_preview_control') is null
    or pg_catalog.to_regclass('lh_sync_private.r207_write_authorizations') is null
    or not coalesce((select preview_enabled from public.r207_preview_control where control_id), false)
    or coalesce((select cutover_mode from public.r207_preview_control where control_id), '') <> 'v2'
  then
    raise exception using errcode = 'P0001',
      message = 'R207_POSTACTIVATION_VERIFICATION_FAILED:CAPABILITY_STATE';
  end if;

  if pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_functiondef(
      'public.laxhornet_r207_cutover_write_gate()'::regprocedure
    ), pg_catalog.chr(13), '')) <> 'cff9d350bf904bc083d573dd762edd7f'
    or pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_functiondef(
      'lh_sync_private.r207_authorize_versioned_write()'::regprocedure
    ), pg_catalog.chr(13), '')) <> '71fb779bdb6fbc781421eed30be8db74'
    or pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_functiondef(
      'lh_sync_private.r207_instrument_versioned_writer(regprocedure)'::regprocedure
    ), pg_catalog.chr(13), '')) <> '4727f35d8a21a0b167a9f9b09f76e89f'
  then
    raise exception using errcode = 'P0001',
      message = 'R207_POSTACTIVATION_VERIFICATION_FAILED:AUTHORITY_DEFINITION';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as class on class.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and trigger.tgname like 'laxhornet_r207_cutover_%'
      and not trigger.tgisinternal
  ) <> 3 then
    raise exception using errcode = 'P0001',
      message = 'R207_POSTACTIVATION_VERIFICATION_FAILED:CUTOVER_TRIGGERS';
  end if;

  for signature in
    select pg_catalog.unnest(array[
      'public.laxhornet_sync_game_v2(jsonb)',
      'public.laxhornet_sync_event_v2(jsonb)',
      'public.lh_apply_game_clock_operation_v2(jsonb)',
      'public.lh_apply_game_clock_batch_v2(jsonb)',
      'public.laxhornet_resolve_game_conflict_v1(jsonb)',
      'public.laxhornet_delete_game_durable(jsonb)'
    ])
  loop
    if pg_catalog.to_regprocedure(signature) is null
      or pg_catalog.strpos(pg_catalog.lower(pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure(signature)
      )), 'perform lh_sync_private.r207_authorize_versioned_write();') = 0
    then
      raise exception using errcode = 'P0001',
        message = 'R207_POSTACTIVATION_VERIFICATION_FAILED:UNMARKED_WRITER:' || signature;
    end if;
  end loop;

  if pg_catalog.has_table_privilege(
      'authenticated', 'lh_sync_private.r207_write_authorizations', 'select')
    or pg_catalog.has_table_privilege(
      'authenticated', 'lh_sync_private.r207_write_authorizations', 'insert')
    or pg_catalog.has_function_privilege(
      'authenticated', 'lh_sync_private.r207_authorize_versioned_write()', 'execute')
    or pg_catalog.has_function_privilege(
      'anon', 'lh_sync_private.r207_authorize_versioned_write()', 'execute')
    or pg_catalog.has_table_privilege('authenticated', 'public.games', 'insert')
    or pg_catalog.has_table_privilege('authenticated', 'public.games', 'update')
    or pg_catalog.has_table_privilege('authenticated', 'public.events', 'insert')
    or pg_catalog.has_table_privilege('authenticated', 'public.events', 'update')
    or pg_catalog.has_table_privilege('authenticated', 'public.events', 'delete')
    or pg_catalog.has_function_privilege(
      'authenticated', 'public.lh_update_game_clock(jsonb)', 'execute')
  then
    raise exception using errcode = 'P0001',
      message = 'R207_POSTACTIVATION_VERIFICATION_FAILED:NO_DUAL_AUTHORITY';
  end if;

  if pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_functiondef(
      'public.laxhornet_sync_game(jsonb)'::regprocedure
    ), pg_catalog.chr(13), '')) <> '5ed65c9a743d18d894389940402f5331'
  then
    raise exception using errcode = 'P0001',
      message = 'R207_POSTACTIVATION_VERIFICATION_FAILED:V1_STUB';
  end if;
end;
$verification$;

commit;
