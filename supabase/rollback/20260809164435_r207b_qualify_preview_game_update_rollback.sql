-- Safe recovery for the R2-07B identifier-qualification hotfix. Do not
-- reintroduce the ambiguous implementation; return the public wrapper to its
-- reviewed dormant response while preserving all operation evidence.

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

comment on function public.laxhornet_sync_game_v2(jsonb) is
  'R2-07B field-operation bridge disabled by safe hotfix rollback.';
