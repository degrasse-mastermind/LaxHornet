-- Optional one-time cleanup for stale production data after
-- supabase-player-removal-request-cleanup.sql has been reviewed and deployed.
-- Review the SELECT preview first. Do not run this file blindly.

-- Preview stale requests whose jersey maps only to inactive roster players.
select
  requests.id,
  requests.team_id,
  requests.user_id,
  requests.child_jersey_number,
  requests.status
from public.team_access_requests requests
where requests.status in ('pending', 'approved')
  and exists (
    select 1
    from public.roster_players inactive_players
    where inactive_players.team_id = requests.team_id
      and inactive_players.active = false
      and regexp_replace(lower(trim(coalesce(inactive_players.number, ''))), '^#\s*', '')
        = regexp_replace(lower(trim(coalesce(requests.child_jersey_number, ''))), '^#\s*', '')
  )
  and not exists (
    select 1
    from public.roster_players active_players
    where active_players.team_id = requests.team_id
      and active_players.active = true
      and regexp_replace(lower(trim(coalesce(active_players.number, ''))), '^#\s*', '')
        = regexp_replace(lower(trim(coalesce(requests.child_jersey_number, ''))), '^#\s*', '')
  )
order by requests.team_id, requests.created_at;

-- Apply only after reviewing the preview above.
-- begin;
--
-- delete from public.player_claims claims
-- using public.roster_players players
-- where players.id = claims.roster_player_id
--   and players.team_id = claims.team_id
--   and players.active = false;
--
-- update public.team_access_requests requests
-- set status = 'player_removed',
--     reviewed_at = now()
-- where requests.status in ('pending', 'approved')
--   and exists (
--     select 1
--     from public.roster_players inactive_players
--     where inactive_players.team_id = requests.team_id
--       and inactive_players.active = false
--       and regexp_replace(lower(trim(coalesce(inactive_players.number, ''))), '^#\s*', '')
--         = regexp_replace(lower(trim(coalesce(requests.child_jersey_number, ''))), '^#\s*', '')
--   )
--   and not exists (
--     select 1
--     from public.roster_players active_players
--     where active_players.team_id = requests.team_id
--       and active_players.active = true
--       and regexp_replace(lower(trim(coalesce(active_players.number, ''))), '^#\s*', '')
--         = regexp_replace(lower(trim(coalesce(requests.child_jersey_number, ''))), '^#\s*', '')
--   );
--
-- commit;
