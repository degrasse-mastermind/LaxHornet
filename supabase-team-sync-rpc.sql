create or replace function public.laxhornet_my_teams()
returns table(
  id text,
  name text,
  invite_code text,
  tracker_code text,
  role text,
  created_by uuid,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select distinct on (teams.id)
    teams.id,
    teams.name,
    teams.invite_code,
    teams.tracker_code,
    case
      when (select public.laxhornet_is_platform_reviewer()) then 'admin'::text
      when teams.created_by = (select auth.uid()) then 'admin'::text
      else coalesce(team_members.role, 'tracker'::text)
    end as role,
    teams.created_by,
    teams.created_at
  from public.teams teams
  left join public.team_members team_members
    on team_members.team_id = teams.id
   and team_members.user_id = (select auth.uid())
  where
    (select public.laxhornet_is_platform_reviewer())
    or teams.created_by = (select auth.uid())
    or team_members.user_id = (select auth.uid())
  order by teams.id, teams.created_at desc;
$$;

create or replace function public.laxhornet_visible_roster_players()
returns table(
  id text,
  team_id text,
  name text,
  number text,
  "position" text,
  active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select distinct on (roster_players.team_id, roster_players.id)
    roster_players.id,
    roster_players.team_id,
    roster_players.name,
    roster_players.number,
    roster_players.position,
    roster_players.active,
    roster_players.created_at
  from public.roster_players roster_players
  left join public.team_members team_members
    on team_members.team_id = roster_players.team_id
   and team_members.user_id = (select auth.uid())
  left join public.player_claims claims
    on claims.team_id = roster_players.team_id
   and claims.roster_player_id = roster_players.id
   and claims.user_id = (select auth.uid())
  where roster_players.active = true
    and (
      (select public.laxhornet_is_platform_reviewer())
      or coalesce(team_members.role, '') = 'admin'
      or claims.user_id = (select auth.uid())
    )
  order by roster_players.team_id, roster_players.id, roster_players.created_at asc;
$$;

grant execute on function public.laxhornet_my_teams() to authenticated;
grant execute on function public.laxhornet_visible_roster_players() to authenticated;
