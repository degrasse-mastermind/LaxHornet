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

create or replace function public.laxhornet_request_user_role(requested_app_role text)
returns table(
  user_id uuid,
  email text,
  requested_role text,
  approved_role text,
  admin_status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_role text;
  user_email text;
  next_approved_role text;
  next_admin_status text;
begin
  clean_role := lower(coalesce(requested_app_role, 'viewer'));
  if clean_role not in ('viewer', 'tracker', 'admin') then
    clean_role := 'viewer';
  end if;

  user_email := lower(coalesce((auth.jwt() ->> 'email'), ''));

  if (select public.laxhornet_is_platform_reviewer()) then
    next_approved_role := 'admin';
    next_admin_status := 'approved';
  elsif clean_role = 'admin' then
    next_approved_role := 'viewer';
    next_admin_status := 'pending';
  else
    next_approved_role := clean_role;
    next_admin_status := 'approved';
  end if;

  insert into public.user_profiles (
    user_id,
    email,
    requested_role,
    approved_role,
    admin_status,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  )
  values (
    (select auth.uid()),
    user_email,
    clean_role,
    next_approved_role,
    next_admin_status,
    case when next_admin_status = 'approved' and clean_role = 'admin' then (select auth.uid()) else null end,
    case when next_admin_status = 'approved' and clean_role = 'admin' then now() else null end,
    now(),
    now()
  )
  on conflict on constraint user_profiles_pkey do update
  set email = excluded.email,
      requested_role = excluded.requested_role,
      approved_role = case
        when public.user_profiles.approved_role = 'admin' then 'admin'
        else excluded.approved_role
      end,
      admin_status = case
        when public.user_profiles.approved_role = 'admin' then 'approved'
        else excluded.admin_status
      end,
      updated_at = now();

  return query
  select
    profiles.user_id,
    profiles.email,
    profiles.requested_role,
    profiles.approved_role,
    profiles.admin_status,
    profiles.reviewed_by,
    profiles.reviewed_at,
    profiles.created_at,
    profiles.updated_at
  from public.user_profiles profiles
  where profiles.user_id = (select auth.uid());
end;
$$;

create or replace function public.laxhornet_my_profile()
returns table(
  user_id uuid,
  email text,
  requested_role text,
  approved_role text,
  admin_status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.user_profiles where user_profiles.user_id = (select auth.uid())) then
    perform public.laxhornet_request_user_role(coalesce((auth.jwt() -> 'user_metadata' ->> 'requested_role'), 'viewer'));
  end if;

  return query
  select
    profiles.user_id,
    profiles.email,
    profiles.requested_role,
    case when (select public.laxhornet_is_platform_reviewer()) then 'admin' else profiles.approved_role end as approved_role,
    case when (select public.laxhornet_is_platform_reviewer()) then 'approved' else profiles.admin_status end as admin_status,
    profiles.reviewed_by,
    profiles.reviewed_at,
    profiles.created_at,
    profiles.updated_at
  from public.user_profiles profiles
  where profiles.user_id = (select auth.uid());
end;
$$;

create or replace function public.laxhornet_pending_admin_requests()
returns table(
  user_id uuid,
  email text,
  requested_role text,
  approved_role text,
  admin_status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    profiles.user_id,
    profiles.email,
    profiles.requested_role,
    profiles.approved_role,
    profiles.admin_status,
    profiles.reviewed_by,
    profiles.reviewed_at,
    profiles.created_at,
    profiles.updated_at
  from public.user_profiles profiles
  where (select public.laxhornet_is_platform_reviewer())
    and profiles.requested_role = 'admin'
    and profiles.admin_status = 'pending'
  order by profiles.created_at asc;
$$;

create or replace function public.laxhornet_review_admin_request(request_user_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select public.laxhornet_is_platform_reviewer()) then
    raise exception 'Not authorized to review admin requests';
  end if;

  update public.user_profiles
  set approved_role = case when approve then 'admin' else 'viewer' end,
      admin_status = case when approve then 'approved' else 'rejected' end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where user_profiles.user_id = request_user_id
    and user_profiles.requested_role = 'admin'
    and user_profiles.admin_status = 'pending';
end;
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
grant execute on function public.laxhornet_request_user_role(text) to authenticated;
grant execute on function public.laxhornet_my_profile() to authenticated;
grant execute on function public.laxhornet_pending_admin_requests() to authenticated;
grant execute on function public.laxhornet_review_admin_request(uuid, boolean) to authenticated;
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

create or replace function public.laxhornet_update_roster_player(
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
as $laxhornet_update_roster_player$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  if not (select public.laxhornet_can_edit_team(p_team_id)) then
    raise exception 'Team editor access required';
  end if;

  return query
  update public.roster_players
  set name = nullif(trim(p_name), ''),
      number = trim(coalesce(p_number, '')),
      position = trim(coalesce(p_position, '')),
      active = true
  where roster_players.id = p_roster_player_id
    and roster_players.team_id = p_team_id
  returning
    roster_players.id,
    roster_players.team_id,
    roster_players.name,
    roster_players.number,
    roster_players.position,
    roster_players.active,
    roster_players.created_at;
end;
$laxhornet_update_roster_player$;

create or replace function public.laxhornet_remove_roster_player(
  p_roster_player_id text,
  p_team_id text
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
as $laxhornet_remove_roster_player$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  if not (select public.laxhornet_can_edit_team(p_team_id)) then
    raise exception 'Team editor access required';
  end if;

  return query
  update public.roster_players
  set active = false
  where roster_players.id = p_roster_player_id
    and roster_players.team_id = p_team_id
  returning
    roster_players.id,
    roster_players.team_id,
    roster_players.name,
    roster_players.number,
    roster_players.position,
    roster_players.active,
    roster_players.created_at;
end;
$laxhornet_remove_roster_player$;

grant execute on function public.laxhornet_update_roster_player(text, text, text, text, text) to authenticated;
grant execute on function public.laxhornet_remove_roster_player(text, text) to authenticated;

notify pgrst, 'reload schema';

select
  'laxhornet roster functions installed' as status,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'laxhornet_my_profile',
    'laxhornet_request_user_role',
    'laxhornet_pending_admin_requests',
    'laxhornet_review_admin_request',
    'laxhornet_create_team',
    'laxhornet_create_roster_player',
    'laxhornet_update_roster_player',
    'laxhornet_remove_roster_player'
  )
order by routine_name;
