-- LaxHornet cloud delete repair.
-- Run this in Supabase Dashboard > SQL Editor.
--
-- Purpose:
-- Allows a signed-in user to permanently delete a saved game/event from the
-- backend when that same user owns it, is the platform reviewer, or has
-- approved access to track that roster player.

create or replace function public.laxhornet_delete_game(
  p_game_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $laxhornet_delete_game$
declare
  game_row public.games%rowtype;
  deleted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  select *
  into game_row
  from public.games
  where games.id = p_game_id
  limit 1;

  if not found then
    raise exception 'Game not found';
  end if;

  if not (
    game_row.user_id = (select auth.uid())
    or (select public.laxhornet_is_platform_reviewer())
    or (
      game_row.team_id is not null
      and (select public.laxhornet_can_track_roster_player(game_row.team_id, game_row.roster_player_id))
    )
  ) then
    raise exception 'Game delete access required';
  end if;

  delete from public.games
  where games.id = p_game_id;

  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'Game not deleted';
  end if;
end;
$laxhornet_delete_game$;

create or replace function public.laxhornet_delete_event(
  p_event_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $laxhornet_delete_event$
declare
  event_row public.events%rowtype;
  game_row public.games%rowtype;
  game_found boolean;
  deleted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  select *
  into event_row
  from public.events
  where events.id = p_event_id
  limit 1;

  if not found then
    raise exception 'Event not found';
  end if;

  select *
  into game_row
  from public.games
  where games.id = event_row.game_id
  limit 1;
  game_found := found;

  if not (
    event_row.user_id = (select auth.uid())
    or (select public.laxhornet_is_platform_reviewer())
    or (
      event_row.team_id is not null
      and (select public.laxhornet_can_track_roster_player(event_row.team_id, event_row.roster_player_id))
    )
    or (
      game_found
      and game_row.team_id is not null
      and (select public.laxhornet_can_track_roster_player(game_row.team_id, game_row.roster_player_id))
    )
    or (
      game_found
      and game_row.user_id = (select auth.uid())
    )
  ) then
    raise exception 'Event delete access required';
  end if;

  delete from public.events
  where events.id = p_event_id;

  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'Event not deleted';
  end if;
end;
$laxhornet_delete_event$;

-- PostgreSQL grants new functions to PUBLIC by default. These SECURITY DEFINER
-- RPCs must be callable only by signed-in users; authorization is then enforced
-- again inside each function.
revoke execute on function public.laxhornet_delete_game(text) from public, anon;
revoke execute on function public.laxhornet_delete_event(text) from public, anon;

grant execute on function public.laxhornet_delete_game(text) to authenticated;
grant execute on function public.laxhornet_delete_event(text) to authenticated;
