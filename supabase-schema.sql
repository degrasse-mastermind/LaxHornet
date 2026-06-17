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

update public.team_members
set role = 'viewer'
where role = 'member';

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

alter table public.games enable row level security;
alter table public.events enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.roster_players enable row level security;

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

create or replace function public.laxhornet_team_role(check_team_id text)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.team_members
      where team_id = check_team_id
        and user_id = (select auth.uid())
      limit 1
    ),
    'viewer'
  );
$$;

create or replace function public.laxhornet_can_edit_team(check_team_id text)
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
      and role in ('admin', 'tracker')
  );
$$;

create or replace function public.laxhornet_join_team_by_code(join_code text)
returns table(team_id text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_team public.teams%rowtype;
  next_role text;
begin
  select *
  into matched_team
  from public.teams
  where upper(invite_code) = upper(join_code)
     or upper(coalesce(tracker_code, '')) = upper(join_code)
  limit 1;

  if not found then
    return;
  end if;

  next_role := case
    when upper(coalesce(matched_team.tracker_code, '')) = upper(join_code) then 'tracker'
    else 'viewer'
  end;

  insert into public.team_members (id, team_id, user_id, role)
  values (matched_team.id || '-' || (select auth.uid())::text, matched_team.id, (select auth.uid()), next_role)
  on conflict (team_id, user_id) do update
  set role = case
    when public.team_members.role = 'admin' then 'admin'
    when public.team_members.role = 'tracker' and excluded.role = 'viewer' then 'tracker'
    else excluded.role
  end;

  team_id := matched_team.id;
  role := (
    select team_members.role
    from public.team_members
    where team_members.team_id = matched_team.id
      and team_members.user_id = (select auth.uid())
    limit 1
  );
  return next;
end;
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
    and (select public.laxhornet_can_edit_team(check_team_id));
$$;

grant execute on function public.laxhornet_is_team_member(text) to authenticated;
grant execute on function public.laxhornet_team_role(text) to authenticated;
grant execute on function public.laxhornet_can_edit_team(text) to authenticated;
grant execute on function public.laxhornet_join_team_by_code(text) to authenticated;
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
with check (created_by = (select auth.uid()));

create policy "laxhornet update teams"
on public.teams for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "laxhornet delete teams"
on public.teams for delete
to authenticated
using (created_by = (select auth.uid()));

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
using ((select public.laxhornet_is_team_member(team_id)));

create policy "laxhornet insert roster players"
on public.roster_players for insert
to authenticated
with check ((select public.laxhornet_can_edit_team(team_id)));

create policy "laxhornet update roster players"
on public.roster_players for update
to authenticated
using ((select public.laxhornet_can_edit_team(team_id)))
with check ((select public.laxhornet_can_edit_team(team_id)));

create policy "laxhornet delete roster players"
on public.roster_players for delete
to authenticated
using ((select public.laxhornet_can_edit_team(team_id)));

create policy "laxhornet read own or shared games"
on public.games for select
to anon, authenticated
using (
  is_shared = true
  or (select auth.uid()) = user_id
  or (team_id is not null and (select public.laxhornet_is_team_member(team_id)))
);

create policy "laxhornet insert own games"
on public.games for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (team_id is null or (select public.laxhornet_can_edit_team(team_id)))
);

create policy "laxhornet update own games"
on public.games for update
to authenticated
using (
  (team_id is null and (select auth.uid()) = user_id)
  or (team_id is not null and (select public.laxhornet_can_edit_team(team_id)))
)
with check (
  (team_id is null and (select auth.uid()) = user_id)
  or (team_id is not null and (select public.laxhornet_can_edit_team(team_id)))
);

create policy "laxhornet delete own games"
on public.games for delete
to authenticated
using (
  (team_id is null and (select auth.uid()) = user_id)
  or (team_id is not null and (select public.laxhornet_can_edit_team(team_id)))
);

create policy "laxhornet read own or shared events"
on public.events for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or (team_id is not null and (select public.laxhornet_is_team_member(team_id)))
  or exists (
    select 1
    from public.games
    where games.id = events.game_id
      and (
        games.is_shared = true
        or (games.team_id is not null and (select public.laxhornet_is_team_member(games.team_id)))
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
        or (games.team_id is not null and (select public.laxhornet_can_edit_team(games.team_id)))
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
  or (team_id is not null and (select public.laxhornet_can_edit_team(team_id)))
  or exists (
    select 1 from public.games
    where games.id = events.game_id
      and games.team_id is not null
      and (select public.laxhornet_can_edit_team(games.team_id))
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
    or (team_id is not null and (select public.laxhornet_can_edit_team(team_id)))
    or exists (
      select 1 from public.games
      where games.id = events.game_id
        and games.team_id is not null
        and (select public.laxhornet_can_edit_team(games.team_id))
    )
  )
  and exists (
    select 1
    from public.games
    where games.id = events.game_id
      and (
        (games.team_id is null and games.user_id = (select auth.uid()))
        or (games.team_id is not null and (select public.laxhornet_can_edit_team(games.team_id)))
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
  or (team_id is not null and (select public.laxhornet_can_edit_team(team_id)))
  or exists (
    select 1 from public.games
    where games.id = events.game_id
      and games.team_id is not null
      and (select public.laxhornet_can_edit_team(games.team_id))
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
