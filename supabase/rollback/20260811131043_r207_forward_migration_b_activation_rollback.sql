-- R2-07 Forward Migration B emergency recovery.
--
-- This is intentionally not a reverse migration. It fail-closes v2 mutation,
-- retains the v1 client_upgrade_required stub, and never restores direct or
-- last-write-wins v285 mutation authority, even when evidence exists.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '60s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('laxhornet:r207-forward-migration-b-activation', 0)
);

do $preflight$
begin
  if pg_catalog.to_regclass('public.r207_preview_control') is null
    or pg_catalog.to_regprocedure('public.laxhornet_sync_game(jsonb)') is null
  then
    raise exception using errcode = 'P0001',
      message = 'R207_RECOVERY_REFUSED:ACTIVATION_CONTRACT_MISSING';
  end if;

  if pg_catalog.md5(pg_catalog.replace(
      pg_catalog.pg_get_functiondef(
        'public.laxhornet_sync_game(jsonb)'::regprocedure
      ),
      pg_catalog.chr(13),
      ''
    )) <> '5ed65c9a743d18d894389940402f5331'
  then
    raise exception using errcode = 'P0001',
      message = 'R207_RECOVERY_REFUSED:V1_STUB_DRIFT';
  end if;
end;
$preflight$;

update public.r207_preview_control
set preview_enabled = false,
    updated_at = statement_timestamp()
where control_id;

revoke execute on function public.laxhornet_sync_game_v2(jsonb)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_sync_event_v2(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_apply_game_clock_operation_v2(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_apply_game_clock_batch_v2(jsonb)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_resolve_game_conflict_v1(jsonb)
  from public, anon, authenticated;

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

do $postflight$
begin
  if coalesce((select preview_enabled from public.r207_preview_control where control_id), true)
    or pg_catalog.has_table_privilege('authenticated', 'public.games', 'update')
    or pg_catalog.has_table_privilege('authenticated', 'public.events', 'update')
    or pg_catalog.has_function_privilege(
      'authenticated', 'public.laxhornet_sync_game_v2(jsonb)', 'execute')
    or pg_catalog.has_function_privilege(
      'authenticated', 'public.laxhornet_delete_event(text)', 'execute')
  then
    raise exception using errcode = 'P0001',
      message = 'R207_RECOVERY_FAILED:WRITE_AUTHORITY_REMAINS';
  end if;
end;
$postflight$;

comment on function public.laxhornet_sync_game(jsonb) is
  'R2-07 fail-closed recovery retains the stable client_upgrade_required stub; legacy mutation is never restored.';

commit;
