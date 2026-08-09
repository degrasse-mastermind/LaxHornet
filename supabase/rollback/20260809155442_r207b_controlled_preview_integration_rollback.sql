do $rollback$
begin
  if exists (select 1 from public.game_sync_operations) then
    raise exception using
      errcode = 'P0001',
      message = 'r207b_rollback_refused_after_operation_evidence';
  end if;
end;
$rollback$;

create or replace function public.laxhornet_sync_game_v2(p_operation jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
$function$;

revoke execute on function public.laxhornet_sync_game_v2(jsonb) from public, anon, authenticated;
grant execute on function public.laxhornet_sync_game_v2(jsonb) to authenticated;

drop function public.laxhornet_r207_preview_capability();
drop table public.r207_preview_control;
