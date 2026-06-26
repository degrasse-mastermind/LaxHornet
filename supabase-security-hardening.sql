-- LaxHornet Supabase security hardening
-- Run this in the Supabase SQL Editor after the main schema/RPC setup.
--
-- Purpose:
-- - Remove anonymous/public EXECUTE access from LaxHornet SECURITY DEFINER RPCs.
-- - Preserve the authenticated RPC access that the app needs after sign-in.
-- - Keep the auth.users trigger function non-callable through PostgREST.
--
-- Notes:
-- - Supabase may still warn that signed-in users can execute SECURITY DEFINER
--   functions. That is intentional for the RPCs below; each function performs
--   its own auth.uid(), reviewer, team-admin, team-member, or player-claim checks.
-- - The leaked-password warning from Supabase Auth must be fixed in the
--   Supabase Dashboard, not with SQL.

begin;

-- Future functions created by the role running this script should not be
-- executable by everyone by default.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- First remove broad/default execution from every LaxHornet function.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'laxhornet\_%' escape '\'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end $$;

-- Grant only the signed-in RPC/function access LaxHornet currently needs.
grant execute on function public.laxhornet_is_team_member(text) to authenticated;
grant execute on function public.laxhornet_is_platform_reviewer() to authenticated;
grant execute on function public.laxhornet_approved_app_role() to authenticated;
grant execute on function public.laxhornet_can_create_team() to authenticated;
grant execute on function public.laxhornet_request_user_role(text) to authenticated;
grant execute on function public.laxhornet_my_profile() to authenticated;
grant execute on function public.laxhornet_pending_admin_requests() to authenticated;
grant execute on function public.laxhornet_review_admin_request(uuid, boolean) to authenticated;
grant execute on function public.laxhornet_team_role(text) to authenticated;
grant execute on function public.laxhornet_can_edit_team(text) to authenticated;
grant execute on function public.laxhornet_can_track_roster_player(text, text) to authenticated;
grant execute on function public.laxhornet_join_team_by_code(text) to authenticated;
grant execute on function public.laxhornet_request_team_access(text) to authenticated;
grant execute on function public.laxhornet_request_team_player_access(text, text) to authenticated;
grant execute on function public.laxhornet_pending_team_access_requests() to authenticated;
grant execute on function public.laxhornet_my_team_access_requests() to authenticated;
grant execute on function public.laxhornet_review_team_access_request(text, boolean) to authenticated;
grant execute on function public.laxhornet_create_team(text, text, text, text, text) to authenticated;
grant execute on function public.laxhornet_delete_team(text) to authenticated;
grant execute on function public.laxhornet_create_roster_player(text, text, text, text, text) to authenticated;
grant execute on function public.laxhornet_update_roster_player(text, text, text, text, text) to authenticated;
grant execute on function public.laxhornet_remove_roster_player(text, text) to authenticated;
grant execute on function public.laxhornet_claim_roster_player(text, text) to authenticated;
grant execute on function public.laxhornet_delete_player_claim(text, text) to authenticated;
grant execute on function public.laxhornet_my_player_claims() to authenticated;
grant execute on function public.laxhornet_my_roster_players() to authenticated;
grant execute on function public.laxhornet_my_teams() to authenticated;
grant execute on function public.laxhornet_visible_roster_players() to authenticated;
grant execute on function public.laxhornet_team_access_codes(text) to authenticated;

-- This function is fired by an auth.users trigger. It should not be callable
-- directly through /rest/v1/rpc.
revoke execute on function public.laxhornet_handle_new_user() from public, anon, authenticated;

commit;
