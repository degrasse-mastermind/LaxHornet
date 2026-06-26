-- LaxHornet team/player access audit
-- Run these read-only checks in Supabase SQL Editor when a parent was approved
-- but a roster player still appears unverified in the app.

-- 1. Approved requests that do not have a matching player claim.
select
  requests.id as request_id,
  requests.status,
  requests.email,
  requests.first_name,
  requests.last_name,
  requests.child_jersey_number,
  teams.name as team_name,
  teams.invite_code as team_code,
  roster_players.id as matched_roster_player_id,
  roster_players.name as matched_roster_player_name,
  roster_players.number as matched_roster_player_number,
  claims.id as claim_id
from public.team_access_requests requests
join public.teams teams on teams.id = requests.team_id
left join public.roster_players roster_players
  on roster_players.team_id = requests.team_id
 and roster_players.active = true
 and trim(roster_players.number) = trim(requests.child_jersey_number)
left join public.player_claims claims
  on claims.team_id = requests.team_id
 and claims.user_id = requests.user_id
 and claims.roster_player_id = roster_players.id
where requests.status = 'approved'
  and claims.id is null
order by requests.reviewed_at desc nulls last, requests.created_at desc;

-- 2. Verified player claims by team/player.
select
  teams.name as team_name,
  teams.invite_code as team_code,
  roster_players.name as player_name,
  roster_players.number as jersey_number,
  roster_players.position,
  count(claims.id) as verified_parent_count,
  string_agg(coalesce(profiles.email, claims.user_id::text), ', ' order by profiles.email) as verified_accounts
from public.roster_players roster_players
join public.teams teams on teams.id = roster_players.team_id
left join public.player_claims claims
  on claims.team_id = roster_players.team_id
 and claims.roster_player_id = roster_players.id
left join public.user_profiles profiles on profiles.user_id = claims.user_id
where roster_players.active = true
group by teams.name, teams.invite_code, roster_players.name, roster_players.number, roster_players.position
order by teams.name, nullif(regexp_replace(roster_players.number, '\D', '', 'g'), '')::int nulls last, roster_players.number;

-- 3. Duplicate active jersey numbers on the same team.
select
  teams.name as team_name,
  teams.invite_code as team_code,
  roster_players.number as jersey_number,
  count(*) as active_players_with_number,
  string_agg(roster_players.name || ' (' || roster_players.id || ')', ', ' order by roster_players.name) as players
from public.roster_players roster_players
join public.teams teams on teams.id = roster_players.team_id
where roster_players.active = true
group by teams.name, teams.invite_code, roster_players.team_id, roster_players.number
having count(*) > 1
order by teams.name, roster_players.number;

-- 4. Recent request/approval communication queue.
select
  created_at,
  event_type,
  status,
  recipient_email,
  subject,
  body
from public.notification_queue
order by created_at desc
limit 50;
