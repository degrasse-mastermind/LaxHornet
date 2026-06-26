-- LaxHornet player verification visibility update
-- Run this in the Supabase SQL Editor if admins can approve a parent/player
-- request but the roster still shows that player as "Unverified Player."
--
-- What this fixes:
-- - Parent Trackers still see only their own verified player claims.
-- - Team admins/reviewer can see player claims for teams they manage.
-- - The app can correctly show "Verified Player" on admin roster cards.

begin;

create or replace function public.laxhornet_my_player_claims()
returns table(
  id text,
  team_id text,
  roster_player_id text,
  user_id uuid,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    claims.id,
    claims.team_id,
    claims.roster_player_id,
    claims.user_id,
    claims.created_at
  from public.player_claims claims
  where claims.user_id = (select auth.uid())
    or (select public.laxhornet_is_platform_reviewer())
    or (select public.laxhornet_team_role(claims.team_id)) = 'admin';
$$;

revoke execute on function public.laxhornet_my_player_claims() from public, anon;
grant execute on function public.laxhornet_my_player_claims() to authenticated;

notify pgrst, 'reload schema';

commit;
