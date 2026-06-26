-- LaxHornet player verification reminder update
-- Run this in Supabase SQL Editor to support the admin "Email Reminder"
-- button for approved parents who still need verified player access.

begin;

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
  where (
      requests.status = 'pending'
      or (
        requests.status = 'approved'
        and not exists (
          select 1
          from public.player_claims claims
          where claims.team_id = requests.team_id
            and claims.user_id = requests.user_id
        )
      )
    )
    and ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(requests.team_id)) = 'admin')
  order by
    case when requests.status = 'pending' then 0 else 1 end,
    requests.created_at asc;
$$;

create or replace function public.laxhornet_send_player_verification_reminder(reminder_request_id text)
returns void
language plpgsql
security definer
set search_path = public
as $laxhornet_send_player_verification_reminder$
declare
  request_row public.team_access_requests%rowtype;
  team_row public.teams%rowtype;
  roster_row public.roster_players%rowtype;
  parent_name text;
begin
  select *
  into request_row
  from public.team_access_requests
  where id = reminder_request_id
  limit 1;

  if not found then
    raise exception 'Team access request not found';
  end if;

  if not ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(request_row.team_id)) = 'admin') then
    raise exception 'Team admin access required';
  end if;

  if request_row.status <> 'approved' then
    raise exception 'Approve access before sending a player verification reminder';
  end if;

  if exists (
    select 1
    from public.player_claims claims
    where claims.team_id = request_row.team_id
      and claims.user_id = request_row.user_id
  ) then
    raise exception 'This parent already has verified player access';
  end if;

  select *
  into team_row
  from public.teams
  where id = request_row.team_id
  limit 1;

  select *
  into roster_row
  from public.roster_players
  where roster_players.team_id = request_row.team_id
    and roster_players.active = true
    and trim(roster_players.number) = trim(request_row.child_jersey_number)
  order by roster_players.created_at asc
  limit 1;

  parent_name := trim(concat_ws(' ', nullif(request_row.first_name, ''), nullif(request_row.last_name, '')));

  insert into public.notification_queue (id, event_type, recipient_email, subject, body, payload, status, created_at, sent_at)
  values (
    'notify-player-verification-reminder-' || reminder_request_id,
    'player_verification_reminder',
    request_row.email,
    'LaxHornet player verification reminder',
    'Hi ' || coalesce(nullif(request_row.first_name, ''), 'there') || ', your LaxHornet access for ' || coalesce(team_row.name, 'your team') || ' was approved. Sign in and verify jersey #' || coalesce(nullif(request_row.child_jersey_number, ''), 'provided') || ' to open your player tracker.',
    jsonb_build_object(
      'team_id', request_row.team_id,
      'team_name', coalesce(team_row.name, ''),
      'request_id', request_row.id,
      'email', request_row.email,
      'first_name', request_row.first_name,
      'last_name', request_row.last_name,
      'parent_name', parent_name,
      'child_jersey_number', request_row.child_jersey_number,
      'roster_player_id', coalesce(roster_row.id, ''),
      'roster_player_name', coalesce(roster_row.name, '')
    ),
    'pending',
    now(),
    null
  )
  on conflict (id) do update
  set status = 'pending',
      created_at = now(),
      sent_at = null,
      recipient_email = excluded.recipient_email,
      subject = excluded.subject,
      body = excluded.body,
      payload = excluded.payload;
end;
$laxhornet_send_player_verification_reminder$;

create or replace function public.laxhornet_repair_approved_player_claims()
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
as $laxhornet_repair_approved_player_claims$
begin
  return query
  with repairable as (
    select
      requests.team_id,
      requests.user_id,
      roster_player.id as roster_player_id
    from public.team_access_requests requests
    join lateral (
      select players.id
      from public.roster_players players
      where players.team_id = requests.team_id
        and players.active = true
        and trim(players.number) = trim(requests.child_jersey_number)
      order by players.created_at asc
      limit 1
    ) roster_player on true
    where requests.status = 'approved'
      and trim(coalesce(requests.child_jersey_number, '')) <> ''
      and (
        requests.user_id = (select auth.uid())
        or (select public.laxhornet_is_platform_reviewer())
        or (select public.laxhornet_team_role(requests.team_id)) = 'admin'
      )
      and not exists (
        select 1
        from public.player_claims claims
        where claims.team_id = requests.team_id
          and claims.user_id = requests.user_id
      )
  )
  insert into public.player_claims (id, team_id, roster_player_id, user_id)
  select
    'claim-' || repairable.team_id || '-' || repairable.user_id::text,
    repairable.team_id,
    repairable.roster_player_id,
    repairable.user_id
  from repairable
  on conflict on constraint player_claims_team_user_key do update
  set roster_player_id = excluded.roster_player_id
  returning
    player_claims.id,
    player_claims.team_id,
    player_claims.roster_player_id,
    player_claims.user_id,
    player_claims.created_at;
end;
$laxhornet_repair_approved_player_claims$;

revoke execute on function public.laxhornet_send_player_verification_reminder(text) from public, anon;
revoke execute on function public.laxhornet_repair_approved_player_claims() from public, anon;
grant execute on function public.laxhornet_pending_team_access_requests() to authenticated;
grant execute on function public.laxhornet_send_player_verification_reminder(text) to authenticated;
grant execute on function public.laxhornet_repair_approved_player_claims() to authenticated;

notify pgrst, 'reload schema';

commit;
