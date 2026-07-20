-- LaxHornet roster-player removal / Parent Request cleanup
-- Review and run in an isolated Supabase staging project before production.
-- This migration is intentionally not applied automatically.

begin;

alter table public.team_access_requests
  drop constraint if exists team_access_requests_status_check;

alter table public.team_access_requests
  add constraint team_access_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'player_removed'))
  not valid;

alter table public.team_access_requests
  validate constraint team_access_requests_status_check;

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
as $laxhornet_pending_team_access_requests$
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
          join public.roster_players claimed_players
            on claimed_players.id = claims.roster_player_id
           and claimed_players.team_id = claims.team_id
          where claims.team_id = requests.team_id
            and claims.user_id = requests.user_id
            and claimed_players.active = true
            and regexp_replace(lower(trim(coalesce(claimed_players.number, ''))), '^#\s*', '')
              = regexp_replace(lower(trim(coalesce(requests.child_jersey_number, ''))), '^#\s*', '')
        )
      )
    )
    and exists (
      select 1
      from public.roster_players requested_players
      where requested_players.team_id = requests.team_id
        and requested_players.active = true
        and regexp_replace(lower(trim(coalesce(requested_players.number, ''))), '^#\s*', '')
          = regexp_replace(lower(trim(coalesce(requests.child_jersey_number, ''))), '^#\s*', '')
    )
    and (
      (select public.laxhornet_is_platform_reviewer())
      or (select public.laxhornet_team_role(requests.team_id)) = 'admin'
    )
  order by
    case when requests.status = 'pending' then 0 else 1 end,
    requests.created_at asc;
$laxhornet_pending_team_access_requests$;

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
  limit 1
  for update;

  if not found then
    raise exception 'Team access request not found';
  end if;

  if not (
    (select public.laxhornet_is_platform_reviewer())
    or (select public.laxhornet_team_role(request_row.team_id)) = 'admin'
  ) then
    raise exception 'Team admin access required';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'Team access request is no longer pending';
  end if;

  if approve then
    if trim(coalesce(request_row.child_jersey_number, '')) = '' then
      raise exception 'Child jersey number required before approval';
    end if;

    select *
    into matched_roster_player
    from public.roster_players
    where roster_players.team_id = request_row.team_id
      and roster_players.active = true
      and regexp_replace(lower(trim(coalesce(roster_players.number, ''))), '^#\s*', '')
        = regexp_replace(lower(trim(coalesce(request_row.child_jersey_number, ''))), '^#\s*', '')
    order by roster_players.created_at asc
    limit 1
    for update;

    if not found then
      raise exception 'No active roster player found for jersey #% on this team', request_row.child_jersey_number;
    end if;

    insert into public.team_members (id, team_id, user_id, role)
    values (
      'member-' || request_row.team_id || '-' || request_row.user_id::text,
      request_row.team_id,
      request_row.user_id,
      request_row.requested_role
    )
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

  update public.team_access_requests
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = request_id
    and status = 'pending';

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
declare
  target_player public.roster_players%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  if not (
    (select public.laxhornet_is_platform_reviewer())
    or (select public.laxhornet_team_role(p_team_id)) = 'admin'
  ) then
    raise exception 'Team admin access required';
  end if;

  select *
  into target_player
  from public.roster_players
  where roster_players.id = p_roster_player_id
    and roster_players.team_id = p_team_id
  limit 1
  for update;

  if not found then
    raise exception 'Roster player not found';
  end if;

  update public.roster_players
  set active = false
  where roster_players.id = target_player.id
    and roster_players.team_id = target_player.team_id;

  delete from public.player_claims claims
  where claims.team_id = target_player.team_id
    and claims.roster_player_id = target_player.id;

  update public.team_access_requests requests
  set status = 'player_removed',
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where requests.team_id = target_player.team_id
    and requests.status in ('pending', 'approved')
    and regexp_replace(lower(trim(coalesce(requests.child_jersey_number, ''))), '^#\s*', '')
      = regexp_replace(lower(trim(coalesce(target_player.number, ''))), '^#\s*', '');

  return query
  select
    target_player.id,
    target_player.team_id,
    target_player.name,
    target_player.number,
    target_player.position,
    false,
    target_player.created_at;
end;
$laxhornet_remove_roster_player$;

revoke execute on function public.laxhornet_pending_team_access_requests() from public, anon;
revoke execute on function public.laxhornet_review_team_access_request(text, boolean) from public, anon;
revoke execute on function public.laxhornet_remove_roster_player(text, text) from public, anon;

grant execute on function public.laxhornet_pending_team_access_requests() to authenticated;
grant execute on function public.laxhornet_review_team_access_request(text, boolean) to authenticated;
grant execute on function public.laxhornet_remove_roster_player(text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
