-- R2-07D pre-activation rollback. Refuse destructive rollback after any
-- conflict-resolution evidence exists. Production activation is not reversible
-- through this artifact.

begin;

do $rollback$
begin
  if coalesce((select preview_enabled from public.r207_preview_control where control_id), false) then
    raise exception using errcode = 'P0001', message = 'r207d_rollback_requires_disabled_preview';
  end if;
  if exists (select 1 from public.game_conflict_resolutions limit 1) then
    raise exception using errcode = 'P0001', message = 'r207d_rollback_refused_resolution_evidence';
  end if;
  if exists (
    select 1 from public.game_sync_operations
    where operation_type = 'conflict_resolution'
    limit 1
  ) then
    raise exception using errcode = 'P0001', message = 'r207d_rollback_refused_operation_evidence';
  end if;
end;
$rollback$;

drop trigger if exists legacy_game_tombstones_close_conflicts_r207d
on public.legacy_game_tombstones;
drop function if exists lh_sync_private.r207_close_conflicts_on_delete();

drop policy if exists game_conflict_resolutions_select_r207d
on public.game_conflict_resolutions;
drop policy if exists game_conflicts_select_r207d on public.game_conflicts;
revoke select on table public.game_conflict_resolutions from authenticated;
revoke select on table public.game_conflicts from authenticated;

create or replace function public.laxhornet_resolve_game_conflict_v1(p_resolution jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

create or replace function public.laxhornet_read_game_conflicts_v1(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

revoke execute on function public.laxhornet_resolve_game_conflict_v1(jsonb)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_read_game_conflicts_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.laxhornet_resolve_game_conflict_v1(jsonb)
  to authenticated;
grant execute on function public.laxhornet_read_game_conflicts_v1(jsonb)
  to authenticated;

alter table public.game_conflicts
  drop constraint if exists game_conflicts_bounded_values_r207d_check,
  drop constraint if exists game_conflicts_fields_r207d_check;

drop function if exists lh_sync_private.r207_conflict_versions(public.games);
drop function if exists lh_sync_private.r207_conflict_current_authority(text);
drop function if exists lh_sync_private.r207_conflict_values_valid(text, jsonb);

commit;
