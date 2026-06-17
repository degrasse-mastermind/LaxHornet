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

create or replace function public.laxhornet_create_team(
  team_id text,
  team_name text,
  invite_code text,
  tracker_code text,
  member_id text
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
as $$
declare
  created_team public.teams%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  if not (select public.laxhornet_can_create_team()) then
    raise exception 'Admin approval required';
  end if;

  insert into public.teams (id, name, invite_code, tracker_code, created_by)
  values (
    team_id,
    nullif(trim(team_name), ''),
    upper(invite_code),
    upper(tracker_code),
    (select auth.uid())
  )
  returning * into created_team;

  insert into public.team_members (id, team_id, user_id, role)
  values (member_id, created_team.id, (select auth.uid()), 'admin')
  on conflict (team_id, user_id) do update
  set role = 'admin';

  return query
  select
    created_team.id,
    created_team.name,
    created_team.invite_code,
    created_team.tracker_code,
    'admin'::text,
    created_team.created_by,
    created_team.created_at;
end;
$$;

grant execute on function public.laxhornet_is_platform_reviewer() to authenticated;
grant execute on function public.laxhornet_approved_app_role() to authenticated;
grant execute on function public.laxhornet_can_create_team() to authenticated;
grant execute on function public.laxhornet_create_team(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

select
  'laxhornet_create_team installed' as status,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'laxhornet_create_team';
