-- LaxHornet delete RPC permission hardening.
-- Run this once in Supabase Dashboard > SQL Editor.
--
-- This patch changes function permissions only. It does not change tables,
-- rows, RLS policies, function bodies, or saved game/event data.
--
-- Expected result:
-- - anon/PUBLIC cannot invoke the privileged delete RPCs.
-- - authenticated users can invoke them.
-- - Each RPC still performs its existing auth.uid() and player/team access
--   checks before deleting anything.

begin;

revoke execute on function public.laxhornet_delete_game(text) from public, anon;
revoke execute on function public.laxhornet_delete_event(text) from public, anon;

grant execute on function public.laxhornet_delete_game(text) to authenticated;
grant execute on function public.laxhornet_delete_event(text) to authenticated;

commit;

-- Verification: both anonymous columns should be false and both authenticated
-- columns should be true.
select
  has_function_privilege(
    'anon',
    'public.laxhornet_delete_game(text)',
    'execute'
  ) as anon_can_delete_game,
  has_function_privilege(
    'anon',
    'public.laxhornet_delete_event(text)',
    'execute'
  ) as anon_can_delete_event,
  has_function_privilege(
    'authenticated',
    'public.laxhornet_delete_game(text)',
    'execute'
  ) as authenticated_can_delete_game,
  has_function_privilege(
    'authenticated',
    'public.laxhornet_delete_event(text)',
    'execute'
  ) as authenticated_can_delete_event;

-- Emergency rollback, only if signed-in deletion unexpectedly stops working:
-- grant execute on function public.laxhornet_delete_game(text) to authenticated;
-- grant execute on function public.laxhornet_delete_event(text) to authenticated;
--
-- Do not grant either function to PUBLIC or anon. That would restore the
-- security-advisor finding.
