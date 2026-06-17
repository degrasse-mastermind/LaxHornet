-- LaxHornet Supabase schema
-- Run this in Supabase Dashboard > SQL Editor.

create table if not exists public.games (
  id text primary key,
  player_id text,
  user_id uuid references auth.users(id) on delete cascade,
  share_code text not null unique,
  is_shared boolean not null default false,
  opponent text not null,
  game_date date not null,
  location text,
  game_type text,
  period_format text not null default 'quarters',
  player_snapshot jsonb not null default '{}'::jsonb,
  current_quarter text not null default 'Q1',
  status text not null default 'in-progress',
  created_at timestamptz not null default now(),
  saved_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.events (
  id text primary key,
  game_id text not null references public.games(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  timestamp timestamptz not null,
  quarter text not null,
  stat_type text not null,
  stat_label text not null,
  category text not null,
  point_value integer not null default 0,
  tags text[] not null default '{}'::text[],
  note text not null default '',
  field_zone text not null default '',
  corrected_at timestamptz,
  tags_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  invite_code text not null unique,
  tracker_code text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists public.roster_players (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  name text not null,
  number text not null default '',
  position text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  child_jersey_number text not null default '',
  onboarding_completed boolean not null default false,
  requested_role text not null default 'tracker',
  approved_role text not null default 'tracker',
  admin_status text not null default 'approved',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_access_requests (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  child_jersey_number text not null default '',
  requested_role text not null default 'tracker',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  constraint team_access_requests_team_user_key unique (team_id, user_id)
);

create table if not exists public.player_claims (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  roster_player_id text not null references public.roster_players(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint player_claims_team_user_key unique (team_id, user_id),
  constraint player_claims_team_user_player_key unique (team_id, user_id, roster_player_id)
);

create table if not exists public.notification_queue (
  id text primary key,
  event_type text not null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.games add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.games add column if not exists is_shared boolean not null default false;
alter table public.games add column if not exists period_format text not null default 'quarters';
alter table public.games add column if not exists player_id text;
alter table public.games add column if not exists team_id text references public.teams(id) on delete set null;
alter table public.games add column if not exists roster_player_id text references public.roster_players(id) on delete set null;
alter table public.events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.events add column if not exists team_id text references public.teams(id) on delete set null;
alter table public.events add column if not exists roster_player_id text references public.roster_players(id) on delete set null;
alter table public.teams add column if not exists tracker_code text unique;
alter table public.user_profiles add column if not exists first_name text not null default '';
alter table public.user_profiles add column if not exists last_name text not null default '';
alter table public.user_profiles add column if not exists phone text not null default '';
alter table public.user_profiles add column if not exists child_jersey_number text not null default '';
alter table public.user_profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.team_access_requests add column if not exists first_name text not null default '';
alter table public.team_access_requests add column if not exists last_name text not null default '';
alter table public.team_access_requests add column if not exists phone text not null default '';
alter table public.team_access_requests add column if not exists child_jersey_number text not null default '';
alter table public.user_profiles alter column requested_role set default 'tracker';
alter table public.user_profiles alter column approved_role set default 'tracker';
alter table public.team_access_requests alter column requested_role set default 'tracker';

update public.team_members
set role = 'tracker'
where role in ('member', 'viewer');

update public.user_profiles
set requested_role = 'tracker'
where requested_role = 'viewer';

update public.user_profiles
set approved_role = 'tracker'
where approved_role = 'viewer';

update public.team_access_requests
set requested_role = 'tracker'
where requested_role = 'viewer';

delete from public.player_claims older
using public.player_claims newer
where older.team_id = newer.team_id
  and older.user_id = newer.user_id
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id < newer.id)
  );

create index if not exists games_player_id_idx on public.games (player_id);
create index if not exists games_team_id_idx on public.games (team_id);
create index if not exists games_roster_player_id_idx on public.games (roster_player_id);
create index if not exists games_user_id_idx on public.games (user_id);
create index if not exists games_share_code_idx on public.games (share_code);
create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_team_id_idx on public.events (team_id);
create index if not exists events_roster_player_id_idx on public.events (roster_player_id);
create index if not exists events_game_id_timestamp_idx on public.events (game_id, timestamp);
create index if not exists teams_invite_code_idx on public.teams (invite_code);
create index if not exists teams_tracker_code_idx on public.teams (tracker_code);
create index if not exists teams_created_by_idx on public.teams (created_by);
create index if not exists team_members_team_id_idx on public.team_members (team_id);
create index if not exists team_members_user_id_idx on public.team_members (user_id);
create index if not exists roster_players_team_id_idx on public.roster_players (team_id);
create index if not exists team_access_requests_team_id_idx on public.team_access_requests (team_id);
create index if not exists team_access_requests_user_id_idx on public.team_access_requests (user_id);
create index if not exists notification_queue_status_idx on public.notification_queue (status, created_at);
create index if not exists player_claims_team_id_idx on public.player_claims (team_id);
create index if not exists player_claims_user_id_idx on public.player_claims (user_id);
create index if not exists player_claims_roster_player_id_idx on public.player_claims (roster_player_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_claims_team_user_key'
      and conrelid = 'public.player_claims'::regclass
  ) then
    if exists (
      select 1
      from pg_class indexes
      join pg_namespace schemas on schemas.oid = indexes.relnamespace
      where schemas.nspname = 'public'
        and indexes.relname = 'player_claims_team_user_unique_idx'
    ) then
      alter table public.player_claims
      add constraint player_claims_team_user_key
      unique using index player_claims_team_user_unique_idx;
    else
      alter table public.player_claims
      add constraint player_claims_team_user_key
      unique (team_id, user_id);
    end if;
  end if;
end $$;

create index if not exists user_profiles_email_idx on public.user_profiles (lower(email));
create index if not exists user_profiles_admin_status_idx on public.user_profiles (admin_status);

grant select on public.games to anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.games to authenticated;
grant insert, update, delete on public.events to authenticated;
grant select on public.teams to authenticated;
grant insert, update, delete on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant insert, update, delete on public.team_members to authenticated;
grant select on public.roster_players to authenticated;
grant insert, update, delete on public.roster_players to authenticated;
grant select on public.user_profiles to authenticated;
grant insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.team_access_requests to authenticated;
grant select, insert, update, delete on public.player_claims to authenticated;
grant select, insert, update on public.notification_queue to authenticated;

alter table public.games enable row level security;
alter table public.events enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.roster_players enable row level security;
alter table public.user_profiles enable row level security;
alter table public.team_access_requests enable row level security;
alter table public.player_claims enable row level security;
alter table public.notification_queue enable row level security;

create or replace function public.laxhornet_is_team_member(check_team_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = check_team_id
      and user_id = (select auth.uid())
  );
$$;

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
    else 'tracker'
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
  clean_role := lower(coalesce(requested_app_role, 'tracker'));
  if (select public.laxhornet_is_platform_reviewer()) then
    clean_role := 'admin';
  else
    clean_role := 'tracker';
  end if;

  user_email := lower(coalesce((auth.jwt() ->> 'email'), ''));

  if (select public.laxhornet_is_platform_reviewer()) then
    next_approved_role := 'admin';
    next_admin_status := 'approved';
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
        when (select public.laxhornet_is_platform_reviewer()) then 'admin'
        else 'tracker'
      end,
      admin_status = 'approved',
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
    perform public.laxhornet_request_user_role(coalesce((auth.jwt() -> 'user_metadata' ->> 'requested_role'), 'tracker'));
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

create or replace function public.laxhornet_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $laxhornet_handle_new_user$
declare
  metadata jsonb;
  requester_email text;
  requester_first_name text;
  requester_last_name text;
  requester_phone text;
  requested_team_code text;
  requested_child_jersey text;
  matched_team public.teams%rowtype;
  request_id text;
begin
  metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requester_email := lower(coalesce(new.email, metadata ->> 'email', ''));
  requester_first_name := trim(coalesce(metadata ->> 'first_name', ''));
  requester_last_name := trim(coalesce(metadata ->> 'last_name', ''));
  requester_phone := trim(coalesce(metadata ->> 'phone', ''));
  requested_team_code := upper(trim(coalesce(metadata ->> 'team_access_code', '')));
  requested_child_jersey := trim(coalesce(metadata ->> 'child_jersey_number', ''));

  insert into public.user_profiles (
    user_id,
    email,
    first_name,
    last_name,
    phone,
    child_jersey_number,
    requested_role,
    approved_role,
    admin_status,
    onboarding_completed
  )
  values (
    new.id,
    requester_email,
    requester_first_name,
    requester_last_name,
    requester_phone,
    requested_child_jersey,
    'tracker',
    'tracker',
    'approved',
    requester_first_name <> '' and requester_last_name <> ''
  )
  on conflict (user_id) do update
  set email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      child_jersey_number = excluded.child_jersey_number,
      requested_role = 'tracker',
      approved_role = 'tracker',
      admin_status = 'approved',
      onboarding_completed = excluded.onboarding_completed,
      updated_at = now();

  if requested_team_code <> '' then
    select *
    into matched_team
    from public.teams
    where upper(invite_code) = requested_team_code
       or upper(coalesce(tracker_code, '')) = requested_team_code
    limit 1;

    if found then
      request_id := 'access-' || matched_team.id || '-' || new.id::text;

      insert into public.team_access_requests (
        id,
        team_id,
        user_id,
        email,
        first_name,
        last_name,
        phone,
        child_jersey_number,
        requested_role,
        status
      )
      values (
        request_id,
        matched_team.id,
        new.id,
        requester_email,
        requester_first_name,
        requester_last_name,
        requester_phone,
        requested_child_jersey,
        'tracker',
        'pending'
      )
      on conflict on constraint team_access_requests_team_user_key do update
      set email = excluded.email,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          phone = excluded.phone,
          child_jersey_number = excluded.child_jersey_number,
          requested_role = 'tracker',
          status = case when public.team_access_requests.status = 'approved' then 'approved' else 'pending' end,
          created_at = case when public.team_access_requests.status = 'approved' then public.team_access_requests.created_at else now() end;

      insert into public.notification_queue (id, event_type, recipient_email, subject, body, payload)
      values (
        'notify-request-user-' || request_id,
        'team_access_requested_user',
        requester_email,
        'LaxHornet request submitted',
        'Your LaxHornet request was submitted for ' || matched_team.name || ', jersey #' || requested_child_jersey || '. Admin is reviewing your request.',
        jsonb_build_object(
          'team_id', matched_team.id,
          'team_name', matched_team.name,
          'email', requester_email,
          'first_name', requester_first_name,
          'last_name', requester_last_name,
          'child_jersey_number', requested_child_jersey
        )
      )
      on conflict (id) do nothing;

      insert into public.notification_queue (id, event_type, recipient_email, subject, body, payload)
      values (
        'notify-request-admin-' || request_id,
        'team_access_requested_admin',
        'degrassed@gmail.com',
        'LaxHornet team access request',
        requester_email || ' requested access to ' || matched_team.name || ', jersey #' || requested_child_jersey || '.',
        jsonb_build_object(
          'team_id', matched_team.id,
          'team_name', matched_team.name,
          'email', requester_email,
          'first_name', requester_first_name,
          'last_name', requester_last_name,
          'phone', requester_phone,
          'child_jersey_number', requested_child_jersey
        )
      )
      on conflict (id) do nothing;
    end if;
  end if;

  return new;
end;
$laxhornet_handle_new_user$;

drop trigger if exists laxhornet_on_auth_user_created on auth.users;

create trigger laxhornet_on_auth_user_created
after insert on auth.users
for each row execute function public.laxhornet_handle_new_user();

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
  set approved_role = case when approve then 'admin' else 'tracker' end,
      admin_status = case when approve then 'approved' else 'rejected' end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where user_profiles.user_id = request_user_id
    and user_profiles.requested_role = 'admin'
    and user_profiles.admin_status = 'pending';
end;
$$;

create or replace function public.laxhornet_team_role(check_team_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  member_role text;
begin
  select role
  into member_role
  from public.team_members
  where team_id = check_team_id
    and user_id = (select auth.uid())
  limit 1;

  member_role := coalesce(member_role, 'tracker');

  if member_role = 'admin' and not (select public.laxhornet_is_platform_reviewer()) then
    return 'tracker';
  end if;

  if member_role = 'viewer' or member_role = 'member' then
    return 'tracker';
  end if;

  return member_role;
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

create or replace function public.laxhornet_can_track_roster_player(check_team_id text, check_roster_player_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select (select public.laxhornet_is_platform_reviewer())
    or (select public.laxhornet_team_role(check_team_id)) = 'admin'
    or exists (
      select 1
      from public.player_claims claims
      where claims.team_id = check_team_id
        and claims.roster_player_id = check_roster_player_id
        and claims.user_id = (select auth.uid())
    );
$$;

create or replace function public.laxhornet_join_team_by_code(join_code text)
returns table(team_id text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row record;
begin
  select *
  into request_row
  from public.laxhornet_request_team_access(join_code)
  limit 1;

  if found then
    team_id := request_row.team_id;
    role := request_row.requested_role;
    return next;
  end if;
end;
$$;

create or replace function public.laxhornet_request_team_access(join_code text)
returns table(
  id text,
  team_id text,
  team_name text,
  user_id uuid,
  email text,
  requested_role text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $laxhornet_request_team_access$
declare
  matched_team public.teams%rowtype;
  next_role text;
  requester_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  select *
  into matched_team
  from public.teams
  where upper(invite_code) = upper(join_code)
     or upper(coalesce(tracker_code, '')) = upper(join_code)
  limit 1;

  if not found then
    return;
  end if;

  next_role := 'tracker';
  requester_email := lower(coalesce((auth.jwt() ->> 'email'), ''));

  insert into public.team_access_requests (id, team_id, user_id, email, requested_role, status)
  values (
    'access-' || matched_team.id || '-' || (select auth.uid())::text,
    matched_team.id,
    (select auth.uid()),
    requester_email,
    next_role,
    'pending'
  )
  on conflict on constraint team_access_requests_team_user_key do update
  set email = excluded.email,
      requested_role = excluded.requested_role,
      status = case when public.team_access_requests.status = 'approved' then 'approved' else 'pending' end,
      created_at = case when public.team_access_requests.status = 'approved' then public.team_access_requests.created_at else now() end;

  return query
  select
    requests.id,
    requests.team_id,
    matched_team.name,
    requests.user_id,
    requests.email,
    requests.requested_role,
    requests.status,
    requests.created_at
  from public.team_access_requests requests
  where requests.team_id = matched_team.id
    and requests.user_id = (select auth.uid());
end;
$laxhornet_request_team_access$;

drop function if exists public.laxhornet_request_team_player_access(text, text);

create or replace function public.laxhornet_request_team_player_access(join_code text, requested_child_jersey_number text default '')
returns table(
  id text,
  team_id text,
  team_name text,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  child_jersey_number text,
  requested_role text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $laxhornet_request_team_player_access$
declare
  matched_team public.teams%rowtype;
  requester_profile public.user_profiles%rowtype;
  requester_email text;
  jersey_number text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  select *
  into matched_team
  from public.teams
  where upper(invite_code) = upper(join_code)
     or upper(coalesce(tracker_code, '')) = upper(join_code)
  limit 1;

  if not found then
    return;
  end if;

  select *
  into requester_profile
  from public.user_profiles profiles
  where profiles.user_id = (select auth.uid())
  limit 1;

  requester_email := lower(coalesce((auth.jwt() ->> 'email'), requester_profile.email, ''));
  jersey_number := trim(coalesce(nullif(requested_child_jersey_number, ''), requester_profile.child_jersey_number, ''));

  insert into public.team_access_requests (
    id,
    team_id,
    user_id,
    email,
    first_name,
    last_name,
    phone,
    child_jersey_number,
    requested_role,
    status
  )
  values (
    'access-' || matched_team.id || '-' || (select auth.uid())::text,
    matched_team.id,
    (select auth.uid()),
    requester_email,
    coalesce(requester_profile.first_name, ''),
    coalesce(requester_profile.last_name, ''),
    coalesce(requester_profile.phone, ''),
    jersey_number,
    'tracker',
    'pending'
  )
  on conflict on constraint team_access_requests_team_user_key do update
  set email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      child_jersey_number = excluded.child_jersey_number,
      requested_role = 'tracker',
      status = case when public.team_access_requests.status = 'approved' then 'approved' else 'pending' end,
      created_at = case when public.team_access_requests.status = 'approved' then public.team_access_requests.created_at else now() end;

  return query
  select
    requests.id,
    requests.team_id,
    matched_team.name,
    requests.user_id,
    requests.email,
    requests.first_name,
    requests.last_name,
    requests.phone,
    requests.child_jersey_number,
    requests.requested_role,
    requests.status,
    requests.created_at
  from public.team_access_requests requests
  where requests.team_id = matched_team.id
    and requests.user_id = (select auth.uid());
end;
$laxhornet_request_team_player_access$;

drop function if exists public.laxhornet_pending_team_access_requests();

create or replace function public.laxhornet_pending_team_access_requests()
returns table(
  id text,
  team_id text,
  team_name text,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  child_jersey_number text,
  requested_role text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    requests.id,
    requests.team_id,
    teams.name as team_name,
    requests.user_id,
    requests.email,
    requests.first_name,
    requests.last_name,
    requests.phone,
    requests.child_jersey_number,
    requests.requested_role,
    requests.status,
    requests.created_at
  from public.team_access_requests requests
  join public.teams teams on teams.id = requests.team_id
  where requests.status = 'pending'
    and ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(requests.team_id)) = 'admin')
  order by requests.created_at asc;
$$;

drop function if exists public.laxhornet_my_team_access_requests();

create or replace function public.laxhornet_my_team_access_requests()
returns table(
  id text,
  team_id text,
  team_name text,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  child_jersey_number text,
  requested_role text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    requests.id,
    requests.team_id,
    teams.name as team_name,
    requests.user_id,
    requests.email,
    requests.first_name,
    requests.last_name,
    requests.phone,
    requests.child_jersey_number,
    requests.requested_role,
    requests.status,
    requests.created_at
  from public.team_access_requests requests
  join public.teams teams on teams.id = requests.team_id
  where requests.user_id = (select auth.uid())
  order by requests.created_at desc;
$$;

create or replace function public.laxhornet_review_team_access_request(request_id text, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $laxhornet_review_team_access_request$
declare
  request_row public.team_access_requests%rowtype;
  matched_roster_player public.roster_players%rowtype;
begin
  select *
  into request_row
  from public.team_access_requests
  where id = request_id
  limit 1;

  if not found then
    raise exception 'Team access request not found';
  end if;

  if not ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(request_row.team_id)) = 'admin') then
    raise exception 'Team admin access required';
  end if;

  update public.team_access_requests
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = request_id;

  if approve then
    if trim(coalesce(request_row.child_jersey_number, '')) = '' then
      raise exception 'Child jersey number required before approval';
    end if;

    select *
    into matched_roster_player
    from public.roster_players
    where roster_players.team_id = request_row.team_id
      and roster_players.active = true
      and trim(roster_players.number) = trim(request_row.child_jersey_number)
    order by roster_players.created_at asc
    limit 1;

    if not found then
      raise exception 'No active roster player found for jersey #% on this team', request_row.child_jersey_number;
    end if;

    insert into public.team_members (id, team_id, user_id, role)
    values ('member-' || request_row.team_id || '-' || request_row.user_id::text, request_row.team_id, request_row.user_id, request_row.requested_role)
    on conflict (team_id, user_id) do update
    set role = excluded.role;

    insert into public.player_claims (id, team_id, roster_player_id, user_id)
    values (
      'claim-' || request_row.team_id || '-' || request_row.user_id::text,
      request_row.team_id,
      matched_roster_player.id,
      request_row.user_id
    )
    on conflict on constraint player_claims_team_user_key do update
    set roster_player_id = excluded.roster_player_id;
  end if;

  insert into public.notification_queue (id, event_type, recipient_email, subject, body, payload)
  values (
    'notify-team-access-' || (case when approve then 'approved-' else 'rejected-' end) || request_id,
    case when approve then 'team_access_approved' else 'team_access_rejected' end,
    request_row.email,
    case when approve then 'LaxHornet access approved' else 'LaxHornet access update' end,
    case
      when approve then 'Your LaxHornet request was approved. Sign in to track your rostered player.'
      else 'Your LaxHornet request was not approved. Contact your team admin if this was unexpected.'
    end,
    jsonb_build_object(
      'team_id', request_row.team_id,
      'email', request_row.email,
      'first_name', request_row.first_name,
      'last_name', request_row.last_name,
      'child_jersey_number', request_row.child_jersey_number
    )
  )
  on conflict (id) do nothing;
end;
$laxhornet_review_team_access_request$;

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

  if not ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(p_team_id)) = 'admin') then
    raise exception 'Team admin access required';
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

  if not ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(p_team_id)) = 'admin') then
    raise exception 'Team admin access required';
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

  if not ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(p_team_id)) = 'admin') then
    raise exception 'Team admin access required';
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

drop function if exists public.laxhornet_claim_roster_player(text, text);

create or replace function public.laxhornet_claim_roster_player(
  p_team_id text,
  p_jersey_number text
)
returns table(
  id text,
  team_id text,
  roster_player_id text,
  user_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $laxhornet_claim_roster_player$
declare
  matched_roster_player public.roster_players%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  if not (select public.laxhornet_is_team_member(p_team_id)) then
    raise exception 'Approved team access required';
  end if;

  select *
  into matched_roster_player
  from public.roster_players
  where roster_players.team_id = p_team_id
    and roster_players.active = true
    and trim(roster_players.number) = trim(p_jersey_number)
  order by roster_players.created_at asc
  limit 1;

  if not found then
    raise exception 'No active roster player found for that jersey number';
  end if;

  return query
  insert into public.player_claims (id, team_id, roster_player_id, user_id)
  values ('claim-' || p_team_id || '-' || (select auth.uid())::text, p_team_id, matched_roster_player.id, (select auth.uid()))
  on conflict on constraint player_claims_team_user_key do update
  set roster_player_id = excluded.roster_player_id
  returning
    player_claims.id,
    player_claims.team_id,
    player_claims.roster_player_id,
    player_claims.user_id,
    player_claims.created_at;
end;
$laxhornet_claim_roster_player$;

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
  where claims.user_id = (select auth.uid());
$$;

create or replace function public.laxhornet_team_access_codes(check_team_id text)
returns table(invite_code text, tracker_code text)
language sql
security definer
set search_path = public
as $$
  select teams.invite_code, teams.tracker_code
  from public.teams
  where teams.id = check_team_id
    and ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(check_team_id)) = 'admin');
$$;

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
grant execute on function public.laxhornet_create_roster_player(text, text, text, text, text) to authenticated;
grant execute on function public.laxhornet_update_roster_player(text, text, text, text, text) to authenticated;
grant execute on function public.laxhornet_remove_roster_player(text, text) to authenticated;
grant execute on function public.laxhornet_claim_roster_player(text, text) to authenticated;
grant execute on function public.laxhornet_my_player_claims() to authenticated;
grant execute on function public.laxhornet_team_access_codes(text) to authenticated;

drop policy if exists "laxhornet public read games" on public.games;
drop policy if exists "laxhornet public insert games" on public.games;
drop policy if exists "laxhornet public update games" on public.games;
drop policy if exists "laxhornet public delete games" on public.games;
drop policy if exists "laxhornet public read events" on public.events;
drop policy if exists "laxhornet public insert events" on public.events;
drop policy if exists "laxhornet public update events" on public.events;
drop policy if exists "laxhornet public delete events" on public.events;
drop policy if exists "laxhornet read own or shared games" on public.games;
drop policy if exists "laxhornet insert own games" on public.games;
drop policy if exists "laxhornet update own games" on public.games;
drop policy if exists "laxhornet delete own games" on public.games;
drop policy if exists "laxhornet read own or shared events" on public.events;
drop policy if exists "laxhornet insert own events" on public.events;
drop policy if exists "laxhornet update own events" on public.events;
drop policy if exists "laxhornet delete own events" on public.events;
drop policy if exists "laxhornet read teams" on public.teams;
drop policy if exists "laxhornet insert teams" on public.teams;
drop policy if exists "laxhornet update teams" on public.teams;
drop policy if exists "laxhornet delete teams" on public.teams;
drop policy if exists "laxhornet read team members" on public.team_members;
drop policy if exists "laxhornet insert team members" on public.team_members;
drop policy if exists "laxhornet update team members" on public.team_members;
drop policy if exists "laxhornet delete team members" on public.team_members;
drop policy if exists "laxhornet read roster players" on public.roster_players;
drop policy if exists "laxhornet insert roster players" on public.roster_players;
drop policy if exists "laxhornet update roster players" on public.roster_players;
drop policy if exists "laxhornet delete roster players" on public.roster_players;
drop policy if exists "laxhornet read user profiles" on public.user_profiles;
drop policy if exists "laxhornet insert user profiles" on public.user_profiles;
drop policy if exists "laxhornet update user profiles" on public.user_profiles;
drop policy if exists "laxhornet read team access requests" on public.team_access_requests;
drop policy if exists "laxhornet insert team access requests" on public.team_access_requests;
drop policy if exists "laxhornet update team access requests" on public.team_access_requests;
drop policy if exists "laxhornet read player claims" on public.player_claims;
drop policy if exists "laxhornet insert player claims" on public.player_claims;
drop policy if exists "laxhornet read notification queue" on public.notification_queue;
drop policy if exists "laxhornet update notification queue" on public.notification_queue;

create policy "laxhornet read user profiles"
on public.user_profiles for select
to authenticated
using (user_id = (select auth.uid()) or (select public.laxhornet_is_platform_reviewer()));

create policy "laxhornet insert user profiles"
on public.user_profiles for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "laxhornet update user profiles"
on public.user_profiles for update
to authenticated
using (user_id = (select auth.uid()) or (select public.laxhornet_is_platform_reviewer()))
with check (user_id = (select auth.uid()) or (select public.laxhornet_is_platform_reviewer()));

create policy "laxhornet read team access requests"
on public.team_access_requests for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.laxhornet_is_platform_reviewer())
  or (select public.laxhornet_team_role(team_id)) = 'admin'
);

create policy "laxhornet insert team access requests"
on public.team_access_requests for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "laxhornet update team access requests"
on public.team_access_requests for update
to authenticated
using ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(team_id)) = 'admin')
with check ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(team_id)) = 'admin');

create policy "laxhornet read player claims"
on public.player_claims for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.laxhornet_is_platform_reviewer())
  or (select public.laxhornet_team_role(team_id)) = 'admin'
);

create policy "laxhornet insert player claims"
on public.player_claims for insert
to authenticated
with check (false);

create policy "laxhornet read notification queue"
on public.notification_queue for select
to authenticated
using ((select public.laxhornet_is_platform_reviewer()));

create policy "laxhornet update notification queue"
on public.notification_queue for update
to authenticated
using ((select public.laxhornet_is_platform_reviewer()))
with check ((select public.laxhornet_is_platform_reviewer()));

create policy "laxhornet read teams"
on public.teams for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select public.laxhornet_is_team_member(id))
);

create policy "laxhornet insert teams"
on public.teams for insert
to authenticated
with check (created_by = (select auth.uid()) and (select public.laxhornet_can_create_team()));

create policy "laxhornet update teams"
on public.teams for update
to authenticated
using (created_by = (select auth.uid()) and (select public.laxhornet_can_create_team()))
with check (created_by = (select auth.uid()) and (select public.laxhornet_can_create_team()));

create policy "laxhornet delete teams"
on public.teams for delete
to authenticated
using (created_by = (select auth.uid()) and (select public.laxhornet_can_create_team()));

create policy "laxhornet read team members"
on public.team_members for select
to authenticated
using (user_id = (select auth.uid()) or (select public.laxhornet_is_team_member(team_id)));

create policy "laxhornet insert team members"
on public.team_members for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'admin'
  and (select public.laxhornet_can_create_team())
  and exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and teams.created_by = (select auth.uid())
  )
);

create policy "laxhornet update team members"
on public.team_members for update
to authenticated
using ((select public.laxhornet_team_role(team_id)) = 'admin')
with check ((select public.laxhornet_team_role(team_id)) = 'admin');

create policy "laxhornet delete team members"
on public.team_members for delete
to authenticated
using (user_id = (select auth.uid()) or (select public.laxhornet_team_role(team_id)) = 'admin');

create policy "laxhornet read roster players"
on public.roster_players for select
to authenticated
using (
  (select public.laxhornet_is_platform_reviewer())
  or (select public.laxhornet_team_role(team_id)) = 'admin'
  or exists (
    select 1
    from public.player_claims claims
    where claims.team_id = roster_players.team_id
      and claims.roster_player_id = roster_players.id
      and claims.user_id = (select auth.uid())
  )
);

create policy "laxhornet insert roster players"
on public.roster_players for insert
to authenticated
with check ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(team_id)) = 'admin');

create policy "laxhornet update roster players"
on public.roster_players for update
to authenticated
using ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(team_id)) = 'admin')
with check ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(team_id)) = 'admin');

create policy "laxhornet delete roster players"
on public.roster_players for delete
to authenticated
using ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(team_id)) = 'admin');

create policy "laxhornet read own or shared games"
on public.games for select
to anon, authenticated
using (
  is_shared = true
  or (select auth.uid()) = user_id
  or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
);

create policy "laxhornet insert own games"
on public.games for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (team_id is null or (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
);

create policy "laxhornet update own games"
on public.games for update
to authenticated
using (
  (team_id is null and (select auth.uid()) = user_id)
  or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
)
with check (
  (team_id is null and (select auth.uid()) = user_id)
  or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
);

create policy "laxhornet delete own games"
on public.games for delete
to authenticated
using (
  (team_id is null and (select auth.uid()) = user_id)
  or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
);

create policy "laxhornet read own or shared events"
on public.events for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
  or exists (
    select 1
    from public.games
    where games.id = events.game_id
      and (
        games.is_shared = true
        or (games.team_id is not null and (select public.laxhornet_can_track_roster_player(games.team_id, games.roster_player_id)))
      )
  )
);

create policy "laxhornet insert own events"
on public.events for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.games
    where games.id = events.game_id
      and (
        (games.team_id is null and games.user_id = (select auth.uid()))
        or (games.team_id is not null and (select public.laxhornet_can_track_roster_player(games.team_id, games.roster_player_id)))
      )
  )
);

create policy "laxhornet update own events"
on public.events for update
to authenticated
using (
  (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.games
      where games.id = events.game_id
        and games.team_id is not null
    )
  )
  or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
  or exists (
    select 1 from public.games
    where games.id = events.game_id
      and games.team_id is not null
      and (select public.laxhornet_can_track_roster_player(games.team_id, games.roster_player_id))
  )
)
with check (
  (
    (
      (select auth.uid()) = user_id
      and not exists (
        select 1 from public.games
        where games.id = events.game_id
          and games.team_id is not null
      )
    )
    or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
    or exists (
      select 1 from public.games
      where games.id = events.game_id
        and games.team_id is not null
        and (select public.laxhornet_can_track_roster_player(games.team_id, games.roster_player_id))
    )
  )
  and exists (
    select 1
    from public.games
    where games.id = events.game_id
      and (
        (games.team_id is null and games.user_id = (select auth.uid()))
        or (games.team_id is not null and (select public.laxhornet_can_track_roster_player(games.team_id, games.roster_player_id)))
      )
  )
);

create policy "laxhornet delete own events"
on public.events for delete
to authenticated
using (
  (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.games
      where games.id = events.game_id
        and games.team_id is not null
    )
  )
  or (team_id is not null and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id)))
  or exists (
    select 1 from public.games
    where games.id = events.game_id
      and games.team_id is not null
      and (select public.laxhornet_can_track_roster_player(games.team_id, games.roster_player_id))
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'roster_players'
  ) then
    alter publication supabase_realtime add table public.roster_players;
  end if;
end $$;

notify pgrst, 'reload schema';
