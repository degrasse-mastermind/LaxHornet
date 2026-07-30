-- R2-06 pre-activation reversal only.
-- After any client can create tombstones, retain this migration and its write guard.
-- Rolling back application code alone is safe because old writes remain blocked.

begin;

do $rollback_guard$
begin
  if to_regclass('public.legacy_game_tombstones') is not null
    and exists (select 1 from public.legacy_game_tombstones)
  then
    raise exception
      'Rollback refused: retain durable legacy game tombstones after activation to prevent resurrection.';
  end if;
end;
$rollback_guard$;

drop trigger if exists laxhornet_reject_tombstoned_game_write on public.games;
drop function if exists lh_sync_private.reject_tombstoned_game_write();
drop function if exists public.laxhornet_sync_game(jsonb);
drop function if exists public.laxhornet_delete_game_durable(jsonb);

create or replace function public.laxhornet_delete_game(p_game_id text)
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
      and (select public.laxhornet_can_track_roster_player(
        game_row.team_id,
        game_row.roster_player_id
      ))
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

revoke execute on function public.laxhornet_delete_game(text)
  from public, anon, authenticated;
grant execute on function public.laxhornet_delete_game(text) to authenticated;
grant delete on table public.games to authenticated;

drop table if exists public.legacy_game_tombstones;
drop schema if exists lh_sync_private;

commit;
