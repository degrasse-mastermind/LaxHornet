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

alter table public.games add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.games add column if not exists is_shared boolean not null default false;
alter table public.games add column if not exists period_format text not null default 'quarters';
alter table public.games add column if not exists player_id text;
alter table public.events add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists games_player_id_idx on public.games (player_id);
create index if not exists games_user_id_idx on public.games (user_id);
create index if not exists games_share_code_idx on public.games (share_code);
create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_game_id_timestamp_idx on public.events (game_id, timestamp);

grant select on public.games to anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.games to authenticated;
grant insert, update, delete on public.events to authenticated;

alter table public.games enable row level security;
alter table public.events enable row level security;

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

create policy "laxhornet read own or shared games"
on public.games for select
to anon, authenticated
using (is_shared = true or auth.uid() = user_id);

create policy "laxhornet insert own games"
on public.games for insert
to authenticated
with check (auth.uid() = user_id);

create policy "laxhornet update own games"
on public.games for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "laxhornet delete own games"
on public.games for delete
to authenticated
using (auth.uid() = user_id);

create policy "laxhornet read own or shared events"
on public.events for select
to anon, authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.games
    where games.id = events.game_id
      and games.is_shared = true
  )
);

create policy "laxhornet insert own events"
on public.events for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.games
    where games.id = events.game_id
      and games.user_id = auth.uid()
  )
);

create policy "laxhornet update own events"
on public.events for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.games
    where games.id = events.game_id
      and games.user_id = auth.uid()
  )
);

create policy "laxhornet delete own events"
on public.events for delete
to authenticated
using (auth.uid() = user_id);

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
end $$;
