-- LaxHornet create-team repair patch
-- Run this in Supabase Dashboard > SQL Editor if the app says:
-- "Could not find the function public.laxhornet_create_team..."

create or replace function public.laxhornet_is_platform_reviewer()
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(trim(
    coalesce(
      nullif(auth.jwt() ->> 'email', ''),
      (
        select users.email
        from auth.users users
        where users.id = (select auth.uid())
        limit 1
      ),
      ''
    )
  )) = 'degrassed@gmail.com';
$$;

create or replace function public.laxhornet_approved_app_role()
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when (select public.laxhornet_is_platform_reviewer()) then 'admin'
    else coalesce(
      (
        select approved_role
        from public.user_profiles
        where user_id = (select auth.uid())
        limit 1
      ),
      'viewer'
    )
  end;
$$;

create or replace function public.laxhornet_can_create_team()
returns boolean
language sql
security definer
set search_path = public
as $$
  select (select public.laxhornet_approved_app_role()) = 'admin';
$$;

create or replace function public.laxhornet_can_edit_team(check_team_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select (select public.laxhornet_is_platform_reviewer())
    or exists (
      select 1
      from public.team_members
      where team_id = check_team_id
        and user_id = (select auth.uid())
        and role in ('admin', 'tracker')
    );
$$;

create or replace function public.laxhornet_create_team(
  p_team_id text,
  p_team_name text,
  p_invite_code text,
  p_tracker_code text,
  p_member_id text
)
returns table(
  id text,
  name text,
  invite_code text,
  tracker_code text,
  role text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $laxhornet_create_team$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  if not (select public.laxhornet_can_create_team()) then
    raise exception 'Admin approval required';
  end if;

  return query
  with inserted_team as (
    insert into public.teams (id, name, invite_code, tracker_code, created_by)
    values (
      p_team_id,
      nullif(trim(p_team_name), ''),
      upper(p_invite_code),
      upper(p_tracker_code),
      (select auth.uid())
    )
    returning
      teams.id,
      teams.name,
      teams.invite_code,
      teams.tracker_code,
      teams.created_by,
      teams.created_at
  ),
  inserted_member as (
    insert into public.team_members (id, team_id, user_id, role)
    select p_member_id, inserted_team.id, (select auth.uid()), 'admin'
    from inserted_team
    on conflict (team_id, user_id) do update
    set role = 'admin'
    returning 1
  )
  select
    inserted_team.id,
    inserted_team.name,
    inserted_team.invite_code,
    inserted_team.tracker_code,
    'admin'::text,
    inserted_team.created_by,
    inserted_team.created_at
  from inserted_team
  cross join inserted_member;
end;
$laxhornet_create_team$;

grant execute on function public.laxhornet_is_platform_reviewer() to authenticated;
grant execute on function public.laxhornet_approved_app_role() to authenticated;
grant execute on function public.laxhornet_can_create_team() to authenticated;
grant execute on function public.laxhornet_can_edit_team(text) to authenticated;
grant execute on function public.laxhornet_create_team(text, text, text, text, text) to authenticated;

create or replace function public.laxhornet_create_roster_player(
  p_roster_player_id text,
  p_team_id text,
  p_name text,
  p_number text,
  p_position text
)
returns table(
  id text,
  team_id text,
  name text,
  number text,
  "position" text,
  active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $laxhornet_create_roster_player$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  if not (select public.laxhornet_can_edit_team(p_team_id)) then
    raise exception 'Team editor access required';
  end if;

  return query
  insert into public.roster_players (id, team_id, name, number, position, active)
  values (
    p_roster_player_id,
    p_team_id,
    nullif(trim(p_name), ''),
    trim(coalesce(p_number, '')),
    trim(coalesce(p_position, '')),
    true
  )
  returning
    roster_players.id,
    roster_players.team_id,
    roster_players.name,
    roster_players.number,
    roster_players.position,
    roster_players.active,
    roster_players.created_at;
end;
$laxhornet_create_roster_player$;

grant execute on function public.laxhornet_create_roster_player(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

select
  'laxhornet roster functions installed' as status,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('laxhornet_create_team', 'laxhornet_create_roster_player')
order by routine_name;
