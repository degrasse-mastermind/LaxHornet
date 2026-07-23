begin;

create or replace function public.lh_release_capabilities()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'schemaVersion', 1,
    'trustSpineEvents', true,
    'secureLiveShare', true,
    'exportAudit', true,
    'personalGameSharing', false
  );
$function$;

comment on function public.lh_release_capabilities() is
  'Public-safe release capability handshake. Returns feature support only and no account, team, player, game, or event data.';

revoke all on function public.lh_release_capabilities() from public;
grant execute on function public.lh_release_capabilities() to anon, authenticated;

commit;
