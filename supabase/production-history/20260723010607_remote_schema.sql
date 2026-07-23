-- Read-only evidence copied from supabase_migrations.schema_migrations
-- Project: ulbmjcvnyznvmjgpstno | Version: 20260723010607 | Name: remote_schema
-- Production was not mutated. Statements remain in original array order.

-- statement 1 | md5 956b60f8a0946477f2a967f3a98e23e2 | chars 25
SET statement_timeout = 0
;

-- statement 2 | md5 5fbd807e5e4f83b9cc283e6a8d126c6a | chars 20
SET lock_timeout = 0
;

-- statement 3 | md5 c02d3d1382c2b5d78bb3423f6e92dfce | chars 43
SET idle_in_transaction_session_timeout = 0
;

-- statement 4 | md5 37f37b5dc62aa1d2f75c1bd994ba42ee | chars 28
SET client_encoding = 'UTF8'
;

-- statement 5 | md5 41bc5aef75c908608d5dca89292f912a | chars 36
SET standard_conforming_strings = on
;

-- statement 6 | md5 e98bdc18604df8d4b816e5398e2abc2c | chars 54
SELECT pg_catalog.set_config('search_path', '', false)
;

-- statement 7 | md5 df0ab40b3b506d07fdd418c3a92c982d | chars 33
SET check_function_bodies = false
;

-- statement 8 | md5 9d0aae1b35c5957609fbf130fb348df2 | chars 23
SET xmloption = content
;

-- statement 9 | md5 13c4f4c95a04724f886cef9c0b57565a | chars 33
SET client_min_messages = warning
;

-- statement 10 | md5 4f7e2852a1ec8561eeaeaa2a0a1e23a6 | chars 22
SET row_security = off
;

-- statement 11 | md5 ead61478b55810df6a7df134dcf323cb | chars 54
COMMENT ON SCHEMA "public" IS 'standard public schema'
;

-- statement 12 | md5 325cf60fd5fe3e2b39ef900feb169503 | chars 76
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions"
;

-- statement 13 | md5 e3ab11002aa18e7b5a7268e9f53c022c | chars 66
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions"
;

-- statement 14 | md5 ea7a6862ccd059703dcf714c3f9cc803 | chars 67
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault"
;

-- statement 15 | md5 66ab9b20ba4f7a928919b412b1143f02 | chars 67
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions"
;

-- statement 16 | md5 3b51ddec51bb07fb84530c340f77d9ba | chars 281
CREATE OR REPLACE FUNCTION "public"."laxhornet_approved_app_role"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when (select public.laxhornet_is_platform_reviewer()) then 'admin'
    else 'tracker'
  end;
$$
;

-- statement 17 | md5 602ceb944892676c0c75c0b248be3874 | chars 75
ALTER FUNCTION "public"."laxhornet_approved_app_role"() OWNER TO "postgres"
;

-- statement 18 | md5 ad4c5df7e2f0d6d1b1ce678f0805aa0f | chars 232
CREATE OR REPLACE FUNCTION "public"."laxhornet_can_create_team"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (select public.laxhornet_approved_app_role()) = 'admin';
$$
;

-- statement 19 | md5 daafc35ce1251bb3d8fe70529df5d1dc | chars 73
ALTER FUNCTION "public"."laxhornet_can_create_team"() OWNER TO "postgres"
;

-- statement 20 | md5 8f8710a759da96d42b44e85572447a86 | chars 439
CREATE OR REPLACE FUNCTION "public"."laxhornet_can_edit_team"("check_team_id" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (select public.laxhornet_is_platform_reviewer())
    or exists (
      select 1
      from public.team_members
      where team_id = check_team_id
        and user_id = (select auth.uid())
        and role in ('admin', 'tracker')
    );
$$
;

-- statement 21 | md5 42d2a1b283f95ec931c7b80f963b40bc | chars 93
ALTER FUNCTION "public"."laxhornet_can_edit_team"("check_team_id" "text") OWNER TO "postgres"
;

-- statement 22 | md5 18d9c65c9fc1e694ab7f2665565c31ea | chars 593
CREATE OR REPLACE FUNCTION "public"."laxhornet_can_track_roster_player"("check_team_id" "text", "check_roster_player_id" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (select public.laxhornet_is_platform_reviewer())
    or (select public.laxhornet_team_role(check_team_id)) = 'admin'
    or exists (
      select 1
      from public.player_claims claims
      where claims.team_id = check_team_id
        and claims.roster_player_id = check_roster_player_id
        and claims.user_id = (select auth.uid())
    );
$$
;

-- statement 23 | md5 576b6c467e5e31afce832e023cbdce92 | chars 136
ALTER FUNCTION "public"."laxhornet_can_track_roster_player"("check_team_id" "text", "check_roster_player_id" "text") OWNER TO "postgres"
;

-- statement 24 | md5 229520a48fb217d249d371a37dfe17ae | chars 1517
CREATE OR REPLACE FUNCTION "public"."laxhornet_claim_roster_player"("p_team_id" "text", "p_jersey_number" "text") RETURNS TABLE("id" "text", "team_id" "text", "roster_player_id" "text", "user_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 25 | md5 9d51178930c1bafc73857e0c74ca23e2 | chars 121
ALTER FUNCTION "public"."laxhornet_claim_roster_player"("p_team_id" "text", "p_jersey_number" "text") OWNER TO "postgres"
;

-- statement 26 | md5 3cf9535b0fdb85e31af4d54938af883b | chars 1191
CREATE OR REPLACE FUNCTION "public"."laxhornet_create_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") RETURNS TABLE("id" "text", "team_id" "text", "name" "text", "number" "text", "position" "text", "active" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 27 | md5 010e27a00584b705eae4ba1e7436f4a0 | chars 182
ALTER FUNCTION "public"."laxhornet_create_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") OWNER TO "postgres"
;

-- statement 28 | md5 4915308f12322a8807001ddd805ab627 | chars 1628
CREATE OR REPLACE FUNCTION "public"."laxhornet_create_team"("p_team_id" "text", "p_team_name" "text", "p_invite_code" "text", "p_tracker_code" "text", "p_member_id" "text") RETURNS TABLE("id" "text", "name" "text", "invite_code" "text", "tracker_code" "text", "role" "text", "created_by" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 29 | md5 8f09c38ea3e9a7b32c4fef8dbd28311a | chars 180
ALTER FUNCTION "public"."laxhornet_create_team"("p_team_id" "text", "p_team_name" "text", "p_invite_code" "text", "p_tracker_code" "text", "p_member_id" "text") OWNER TO "postgres"
;

-- statement 30 | md5 fb02c3ae0e399603d0d642bc016165df | chars 1526
CREATE OR REPLACE FUNCTION "public"."laxhornet_delete_event"("p_event_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 31 | md5 ff23d29c4fc777f981a1d11475854a4f | chars 89
ALTER FUNCTION "public"."laxhornet_delete_event"("p_event_id" "text") OWNER TO "postgres"
;

-- statement 32 | md5 7cea74cde877551e59a6bb33b7de06a6 | chars 1059
CREATE OR REPLACE FUNCTION "public"."laxhornet_delete_game"("p_game_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 33 | md5 ec6337907c8710d62efc407b0030b0cc | chars 87
ALTER FUNCTION "public"."laxhornet_delete_game"("p_game_id" "text") OWNER TO "postgres"
;

-- statement 34 | md5 3398f8c9ede654796e9f3f120b82f4ba | chars 832
CREATE OR REPLACE FUNCTION "public"."laxhornet_delete_player_claim"("p_team_id" "text", "p_roster_player_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  deleted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required';
  end if;

  delete from public.player_claims
  where player_claims.team_id = p_team_id
    and player_claims.roster_player_id = p_roster_player_id
    and (
      player_claims.user_id = (select auth.uid())
      or (select public.laxhornet_is_platform_reviewer())
      or (select public.laxhornet_team_role(p_team_id)) = 'admin'
    );

  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'Player access not found';
  end if;
end;
$$
;

-- statement 35 | md5 b52b2d40177479bdacfc11c71217c525 | chars 124
ALTER FUNCTION "public"."laxhornet_delete_player_claim"("p_team_id" "text", "p_roster_player_id" "text") OWNER TO "postgres"
;

-- statement 36 | md5 4b479cd67ebd46f0141276a811aef585 | chars 714
CREATE OR REPLACE FUNCTION "public"."laxhornet_delete_team"("p_team_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  deleted_count integer;
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

  delete from public.teams
  where teams.id = p_team_id;

  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'Team not found';
  end if;
end;
$$
;

-- statement 37 | md5 d9e5e81087c52cffa81a2d3186e22939 | chars 87
ALTER FUNCTION "public"."laxhornet_delete_team"("p_team_id" "text") OWNER TO "postgres"
;

-- statement 38 | md5 787a0faec413fb832a66a9f11f64e74f | chars 4957
CREATE OR REPLACE FUNCTION "public"."laxhornet_handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
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
$$
;

-- statement 39 | md5 576631aed9e2a2ab164e2d0db772812f | chars 73
ALTER FUNCTION "public"."laxhornet_handle_new_user"() OWNER TO "postgres"
;

-- statement 40 | md5 8972c83293bab994ff19a537dcad5d0e | chars 439
CREATE OR REPLACE FUNCTION "public"."laxhornet_is_platform_reviewer"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 41 | md5 bc5348ea892d6f192bb4d07969c4fb8c | chars 78
ALTER FUNCTION "public"."laxhornet_is_platform_reviewer"() OWNER TO "postgres"
;

-- statement 42 | md5 2b21177434643d59ff3f24fb2939aaf6 | chars 331
CREATE OR REPLACE FUNCTION "public"."laxhornet_is_team_member"("check_team_id" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.team_members
    where team_id = check_team_id
      and user_id = (select auth.uid())
  );
$$
;

-- statement 43 | md5 eba3dce02bd26a5eff89c27ef00f9292 | chars 94
ALTER FUNCTION "public"."laxhornet_is_team_member"("check_team_id" "text") OWNER TO "postgres"
;

-- statement 44 | md5 9dcab11b7cd88179508a10a0135b8c5b | chars 491
CREATE OR REPLACE FUNCTION "public"."laxhornet_join_team_by_code"("join_code" "text") RETURNS TABLE("team_id" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 45 | md5 42a81b0a6f7bfc32ed421c76500ab83f | chars 93
ALTER FUNCTION "public"."laxhornet_join_team_by_code"("join_code" "text") OWNER TO "postgres"
;

-- statement 46 | md5 827d5843bf6e19f82cd1a016507bde30 | chars 610
CREATE OR REPLACE FUNCTION "public"."laxhornet_my_player_claims"() RETURNS TABLE("id" "text", "team_id" "text", "roster_player_id" "text", "user_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    claims.id,
    claims.team_id,
    claims.roster_player_id,
    claims.user_id,
    claims.created_at
  from public.player_claims claims
  where claims.user_id = (select auth.uid())
    or (select public.laxhornet_is_platform_reviewer())
    or (select public.laxhornet_team_role(claims.team_id)) = 'admin';
$$
;

-- statement 47 | md5 43110d2042926d54a5ff6db4f0de4b71 | chars 74
ALTER FUNCTION "public"."laxhornet_my_player_claims"() OWNER TO "postgres"
;

-- statement 48 | md5 53fef6a60084f09b6b92d24380bd984c | chars 1214
CREATE OR REPLACE FUNCTION "public"."laxhornet_my_profile"() RETURNS TABLE("user_id" "uuid", "email" "text", "requested_role" "text", "approved_role" "text", "admin_status" "text", "reviewed_by" "uuid", "reviewed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 49 | md5 f7ccdc7854d64b6d6ee4e9a6f5ba9698 | chars 68
ALTER FUNCTION "public"."laxhornet_my_profile"() OWNER TO "postgres"
;

-- statement 50 | md5 4246fda04ddd05b01b6a5548126adb16 | chars 818
CREATE OR REPLACE FUNCTION "public"."laxhornet_my_roster_players"() RETURNS TABLE("id" "text", "team_id" "text", "name" "text", "number" "text", "position" "text", "active" boolean, "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    roster_players.id,
    roster_players.team_id,
    roster_players.name,
    roster_players.number,
    roster_players.position,
    roster_players.active,
    roster_players.created_at
  from public.roster_players roster_players
  join public.player_claims claims
    on claims.team_id = roster_players.team_id
   and claims.roster_player_id = roster_players.id
  where claims.user_id = (select auth.uid())
    and roster_players.active = true
  order by roster_players.created_at asc;
$$
;

-- statement 51 | md5 d6f97d92d8fb5e0aa4ebd620487d6dc3 | chars 75
ALTER FUNCTION "public"."laxhornet_my_roster_players"() OWNER TO "postgres"
;

-- statement 52 | md5 1a613b85bc11fda6c2e2a8fd3b06de09 | chars 922
CREATE OR REPLACE FUNCTION "public"."laxhornet_my_team_access_requests"() RETURNS TABLE("id" "text", "team_id" "text", "team_name" "text", "user_id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "phone" "text", "child_jersey_number" "text", "requested_role" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 53 | md5 02fd1aca626f6e66bb0e4da35df52a17 | chars 81
ALTER FUNCTION "public"."laxhornet_my_team_access_requests"() OWNER TO "postgres"
;

-- statement 54 | md5 ce27a36f85b39dfbcb1d5fcda387e643 | chars 1068
CREATE OR REPLACE FUNCTION "public"."laxhornet_my_teams"() RETURNS TABLE("id" "text", "name" "text", "invite_code" "text", "tracker_code" "text", "role" "text", "created_by" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select distinct on (teams.id)
    teams.id,
    teams.name,
    teams.invite_code,
    teams.tracker_code,
    case
      when (select public.laxhornet_is_platform_reviewer()) then 'admin'::text
      when teams.created_by = (select auth.uid()) then 'admin'::text
      else coalesce(team_members.role, 'tracker'::text)
    end as role,
    teams.created_by,
    teams.created_at
  from public.teams teams
  left join public.team_members team_members
    on team_members.team_id = teams.id
   and team_members.user_id = (select auth.uid())
  where
    (select public.laxhornet_is_platform_reviewer())
    or teams.created_by = (select auth.uid())
    or team_members.user_id = (select auth.uid())
  order by teams.id, teams.created_at desc;
$$
;

-- statement 55 | md5 272b9a7517ef30e4d7f889fb6efb4821 | chars 66
ALTER FUNCTION "public"."laxhornet_my_teams"() OWNER TO "postgres"
;

-- statement 56 | md5 b20f0d20b2fc2e66c2a264942039ca76 | chars 881
CREATE OR REPLACE FUNCTION "public"."laxhornet_pending_admin_requests"() RETURNS TABLE("user_id" "uuid", "email" "text", "requested_role" "text", "approved_role" "text", "admin_status" "text", "reviewed_by" "uuid", "reviewed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 57 | md5 aa2bb7f4eb95d4fdce1ffd8a8be86958 | chars 80
ALTER FUNCTION "public"."laxhornet_pending_admin_requests"() OWNER TO "postgres"
;

-- statement 58 | md5 1c7317ad805a00507af9a6bd7d0c9986 | chars 2213
CREATE OR REPLACE FUNCTION "public"."laxhornet_pending_team_access_requests"() RETURNS TABLE("id" "text", "team_id" "text", "team_name" "text", "user_id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "phone" "text", "child_jersey_number" "text", "requested_role" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 59 | md5 4eee1846c701d519e056709fbe90fd1a | chars 86
ALTER FUNCTION "public"."laxhornet_pending_team_access_requests"() OWNER TO "postgres"
;

-- statement 60 | md5 e26366219e1ef199a67231f4bfaf5187 | chars 1933
CREATE OR REPLACE FUNCTION "public"."laxhornet_remove_roster_player"("p_roster_player_id" "text", "p_team_id" "text") RETURNS TABLE("id" "text", "team_id" "text", "name" "text", "number" "text", "position" "text", "active" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 61 | md5 389188e2fbddd9db487356d32adc6329 | chars 125
ALTER FUNCTION "public"."laxhornet_remove_roster_player"("p_roster_player_id" "text", "p_team_id" "text") OWNER TO "postgres"
;

-- statement 62 | md5 1a6ea5ec19f29919d122a5033c90ea58 | chars 1875
CREATE OR REPLACE FUNCTION "public"."laxhornet_repair_approved_player_claims"() RETURNS TABLE("id" "text", "team_id" "text", "roster_player_id" "text", "user_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 63 | md5 90bcc19c0afa24691f74810ab829dd42 | chars 87
ALTER FUNCTION "public"."laxhornet_repair_approved_player_claims"() OWNER TO "postgres"
;

-- statement 64 | md5 5ad80707e331926f9d8232c3549af935 | chars 1914
CREATE OR REPLACE FUNCTION "public"."laxhornet_request_team_access"("join_code" "text") RETURNS TABLE("id" "text", "team_id" "text", "team_name" "text", "user_id" "uuid", "email" "text", "requested_role" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 65 | md5 c29db80a6e78995e3fb4cccd9489a67f | chars 95
ALTER FUNCTION "public"."laxhornet_request_team_access"("join_code" "text") OWNER TO "postgres"
;

-- statement 66 | md5 1c712752290933a1c1c9a0c0fb1d4345 | chars 2910
CREATE OR REPLACE FUNCTION "public"."laxhornet_request_team_player_access"("join_code" "text", "requested_child_jersey_number" "text" DEFAULT ''::"text") RETURNS TABLE("id" "text", "team_id" "text", "team_name" "text", "user_id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "phone" "text", "child_jersey_number" "text", "requested_role" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 67 | md5 64379f20f759077c0b035672f7219ea5 | chars 142
ALTER FUNCTION "public"."laxhornet_request_team_player_access"("join_code" "text", "requested_child_jersey_number" "text") OWNER TO "postgres"
;

-- statement 68 | md5 9992b0538fa00f222dbffdd49e5649f9 | chars 2306
CREATE OR REPLACE FUNCTION "public"."laxhornet_request_user_role"("requested_app_role" "text") RETURNS TABLE("user_id" "uuid", "email" "text", "requested_role" "text", "approved_role" "text", "admin_status" "text", "reviewed_by" "uuid", "reviewed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 69 | md5 aaaee982329d02b9e626bf33b77a1100 | chars 102
ALTER FUNCTION "public"."laxhornet_request_user_role"("requested_app_role" "text") OWNER TO "postgres"
;

-- statement 70 | md5 30fd42c8a725618d7f15528ea4820eaa | chars 794
CREATE OR REPLACE FUNCTION "public"."laxhornet_review_admin_request"("request_user_id" "uuid", "approve" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 71 | md5 568642e9ca838abbe84a6fe6ea98f12a | chars 121
ALTER FUNCTION "public"."laxhornet_review_admin_request"("request_user_id" "uuid", "approve" boolean) OWNER TO "postgres"
;

-- statement 72 | md5 44504c4ce836177fa6b9e66e589abff2 | chars 3560
CREATE OR REPLACE FUNCTION "public"."laxhornet_review_team_access_request"("request_id" "text", "approve" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 73 | md5 e3130d243879ad869d58a8f67693e2b0 | chars 122
ALTER FUNCTION "public"."laxhornet_review_team_access_request"("request_id" "text", "approve" boolean) OWNER TO "postgres"
;

-- statement 74 | md5 e26025aceaf93259aa7effc4e55e7bb0 | chars 3093
CREATE OR REPLACE FUNCTION "public"."laxhornet_send_player_verification_reminder"("reminder_request_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 75 | md5 b5184ac3c1ebe76b6dd18e28394ba3b2 | chars 119
ALTER FUNCTION "public"."laxhornet_send_player_verification_reminder"("reminder_request_id" "text") OWNER TO "postgres"
;

-- statement 76 | md5 6e2fc383943918e33de9bd165d682441 | chars 460
CREATE OR REPLACE FUNCTION "public"."laxhornet_team_access_codes"("check_team_id" "text") RETURNS TABLE("invite_code" "text", "tracker_code" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select teams.invite_code, teams.tracker_code
  from public.teams
  where teams.id = check_team_id
    and ((select public.laxhornet_is_platform_reviewer()) or (select public.laxhornet_team_role(check_team_id)) = 'admin');
$$
;

-- statement 77 | md5 dce45657438ee6facf554d52ff5f9b35 | chars 97
ALTER FUNCTION "public"."laxhornet_team_access_codes"("check_team_id" "text") OWNER TO "postgres"
;

-- statement 78 | md5 8ea55197af810d33f633fd5968292164 | chars 675
CREATE OR REPLACE FUNCTION "public"."laxhornet_team_role"("check_team_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 79 | md5 dcf6c268bdec9a2a1dad53d9eddfce9e | chars 89
ALTER FUNCTION "public"."laxhornet_team_role"("check_team_id" "text") OWNER TO "postgres"
;

-- statement 80 | md5 440d4239d9b12f27dd6cc1aa11e6b35b | chars 1218
CREATE OR REPLACE FUNCTION "public"."laxhornet_update_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") RETURNS TABLE("id" "text", "team_id" "text", "name" "text", "number" "text", "position" "text", "active" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$
;

-- statement 81 | md5 f6196bf5ed2ccf6aa691424bdd9ef319 | chars 182
ALTER FUNCTION "public"."laxhornet_update_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") OWNER TO "postgres"
;

-- statement 82 | md5 3663d5b3f3b5b5f3907a6331ba07060e | chars 1250
CREATE OR REPLACE FUNCTION "public"."laxhornet_visible_roster_players"() RETURNS TABLE("id" "text", "team_id" "text", "name" "text", "number" "text", "position" "text", "active" boolean, "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select distinct on (roster_players.team_id, roster_players.id)
    roster_players.id,
    roster_players.team_id,
    roster_players.name,
    roster_players.number,
    roster_players.position,
    roster_players.active,
    roster_players.created_at
  from public.roster_players roster_players
  left join public.team_members team_members
    on team_members.team_id = roster_players.team_id
   and team_members.user_id = (select auth.uid())
  left join public.player_claims claims
    on claims.team_id = roster_players.team_id
   and claims.roster_player_id = roster_players.id
   and claims.user_id = (select auth.uid())
  where roster_players.active = true
    and (
      (select public.laxhornet_is_platform_reviewer())
      or coalesce(team_members.role, '') = 'admin'
      or claims.user_id = (select auth.uid())
    )
  order by roster_players.team_id, roster_players.id, roster_players.created_at asc;
$$
;

-- statement 83 | md5 949eadb920965edd8ed9c5f2fb98e99c | chars 80
ALTER FUNCTION "public"."laxhornet_visible_roster_players"() OWNER TO "postgres"
;

-- statement 84 | md5 ad5789dbcb211afdeb73311e2466fa6e | chars 27
SET default_tablespace = ''
;

-- statement 85 | md5 41445bf68e1ef9abb93e3cc1a3885eae | chars 40
SET default_table_access_method = "heap"
;

-- statement 86 | md5 9f650f462675f846a23ef0d3c61d6032 | chars 720
CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "text" NOT NULL,
    "game_id" "text" NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "quarter" "text" NOT NULL,
    "stat_type" "text" NOT NULL,
    "stat_label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "point_value" integer DEFAULT 0 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "field_zone" "text" DEFAULT ''::"text" NOT NULL,
    "corrected_at" timestamp with time zone,
    "tags_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "team_id" "text",
    "roster_player_id" "text"
)
;

-- statement 87 | md5 1015ba9d9c43c5e69e8e6340b0484306 | chars 49
ALTER TABLE "public"."events" OWNER TO "postgres"
;

-- statement 88 | md5 bbe85444f7fad7994d9e9482462266a0 | chars 761
CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "text" NOT NULL,
    "share_code" "text" NOT NULL,
    "opponent" "text" NOT NULL,
    "game_date" "date" NOT NULL,
    "location" "text",
    "game_type" "text",
    "player_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "current_quarter" "text" DEFAULT 'Q1'::"text" NOT NULL,
    "status" "text" DEFAULT 'in-progress'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "saved_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "user_id" "uuid",
    "is_shared" boolean DEFAULT false NOT NULL,
    "period_format" "text" DEFAULT 'quarters'::"text" NOT NULL,
    "player_id" "text",
    "team_id" "text",
    "roster_player_id" "text"
)
;

-- statement 89 | md5 6869002e590bccf1dbb168d8efd2c9b2 | chars 48
ALTER TABLE "public"."games" OWNER TO "postgres"
;

-- statement 90 | md5 5a3637073cdbf4188f1cf51d3386ed28 | chars 1110
CREATE TABLE IF NOT EXISTS "public"."notification_queue" (
    "id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "template_key" "text" DEFAULT ''::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_attempt_at" timestamp with time zone,
    "last_error" "text" DEFAULT ''::"text" NOT NULL,
    "provider_message_id" "text" DEFAULT ''::"text" NOT NULL,
    "delivered_at" timestamp with time zone,
    "bounced_at" timestamp with time zone,
    "complained_at" timestamp with time zone,
    "suppressed_at" timestamp with time zone,
    CONSTRAINT "notification_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'sent'::"text", 'failed'::"text", 'bounced'::"text", 'complained'::"text", 'suppressed'::"text", 'held'::"text"])))
)
;

-- statement 91 | md5 66477d4f99e5c8736dc573078835dbad | chars 61
ALTER TABLE "public"."notification_queue" OWNER TO "postgres"
;

-- statement 92 | md5 cda85feea81d5aea6406af5b04a883be | chars 163
COMMENT ON COLUMN "public"."notification_queue"."template_key" IS 'Optional server-side email template override. event_type remains the default template selector.'
;

-- statement 93 | md5 6d717d2df6777625a36759f64dba65c5 | chars 137
COMMENT ON COLUMN "public"."notification_queue"."attempts" IS 'Number of times the delivery worker atomically claimed this notification.'
;

-- statement 94 | md5 3e4849aec6bed1a70c1b8490f35d5ece | chars 129
COMMENT ON COLUMN "public"."notification_queue"."provider_message_id" IS 'Resend message ID used to reconcile delivery webhooks.'
;

-- statement 95 | md5 0ff2bff24db47aacbefaa8b80155cf16 | chars 250
CREATE TABLE IF NOT EXISTS "public"."player_claims" (
    "id" "text" NOT NULL,
    "team_id" "text" NOT NULL,
    "roster_player_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
)
;

-- statement 96 | md5 f0992fd56cbadb15821e717e43b61939 | chars 56
ALTER TABLE "public"."player_claims" OWNER TO "postgres"
;

-- statement 97 | md5 a875cac2dc15397c084631b0781dfa5a | chars 352
CREATE TABLE IF NOT EXISTS "public"."roster_players" (
    "id" "text" NOT NULL,
    "team_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "number" "text" DEFAULT ''::"text" NOT NULL,
    "position" "text" DEFAULT ''::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
)
;

-- statement 98 | md5 6da61d86156a69e662b46b55928aaa78 | chars 57
ALTER TABLE "public"."roster_players" OWNER TO "postgres"
;

-- statement 99 | md5 c81be1c8c44ae1ed28f57b96a2122d9c | chars 840
CREATE TABLE IF NOT EXISTS "public"."team_access_requests" (
    "id" "text" NOT NULL,
    "team_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "requested_role" "text" DEFAULT 'tracker'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "child_jersey_number" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "team_access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'player_removed'::"text"])))
)
;

-- statement 100 | md5 438459ee403cd8dfc3a8787d691d766a | chars 63
ALTER TABLE "public"."team_access_requests" OWNER TO "postgres"
;

-- statement 101 | md5 896bc1439ec562fdbeb28a54065d5118 | chars 262
CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "text" NOT NULL,
    "team_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
)
;

-- statement 102 | md5 6ccb351648fe16889cadac03ae393b02 | chars 55
ALTER TABLE "public"."team_members" OWNER TO "postgres"
;

-- statement 103 | md5 028a558d78435d440f81cd57755554c6 | chars 255
CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "invite_code" "text" NOT NULL,
    "tracker_code" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
)
;

-- statement 104 | md5 3642c8b0c3ddc76cb6710708ae3e1180 | chars 48
ALTER TABLE "public"."teams" OWNER TO "postgres"
;

-- statement 105 | md5 e1b5dc2d602a884a8d709f7112fa4b67 | chars 803
CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "requested_role" "text" DEFAULT 'tracker'::"text" NOT NULL,
    "approved_role" "text" DEFAULT 'tracker'::"text" NOT NULL,
    "admin_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "child_jersey_number" "text" DEFAULT ''::"text" NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL
)
;

-- statement 106 | md5 a088bad9225177a4512e597e1c748e6d | chars 56
ALTER TABLE "public"."user_profiles" OWNER TO "postgres"
;

-- statement 107 | md5 0419a1523369a408793335d2ed9dbd74 | chars 86
ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id")
;

-- statement 108 | md5 bbccf08d55c2532e4b4f98d8ffedd305 | chars 84
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id")
;

-- statement 109 | md5 bd5e7d948fa745e026759d7594e42e08 | chars 97
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_share_code_key" UNIQUE ("share_code")
;

-- statement 110 | md5 10ffa6c77a9be9b299e8494dd08767d0 | chars 110
ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
;

-- statement 111 | md5 f4de556aee1986b86ead73ff9897c9b3 | chars 100
ALTER TABLE ONLY "public"."player_claims"
    ADD CONSTRAINT "player_claims_pkey" PRIMARY KEY ("id")
;

-- statement 112 | md5 3dacbc3c2ecba12d2130f2b4f518c74f | chars 120
ALTER TABLE ONLY "public"."player_claims"
    ADD CONSTRAINT "player_claims_team_user_key" UNIQUE ("team_id", "user_id")
;

-- statement 113 | md5 9ea80eca373ac696aef9c2a950a53aaf | chars 147
ALTER TABLE ONLY "public"."player_claims"
    ADD CONSTRAINT "player_claims_team_user_player_key" UNIQUE ("team_id", "user_id", "roster_player_id")
;

-- statement 114 | md5 16b91cf38fa92d98b3c5feb431509c69 | chars 102
ALTER TABLE ONLY "public"."roster_players"
    ADD CONSTRAINT "roster_players_pkey" PRIMARY KEY ("id")
;

-- statement 115 | md5 65ef75a06313dfb43d34a5ef7def2ffa | chars 114
ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_pkey" PRIMARY KEY ("id")
;

-- statement 116 | md5 c088d6e7b589d26297c245ae85c0b895 | chars 134
ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_team_user_key" UNIQUE ("team_id", "user_id")
;

-- statement 117 | md5 69d88506b9363c926b5dd5d917d383f3 | chars 98
ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
;

-- statement 118 | md5 b372234182ebeffe811bc3e3315541a9 | chars 124
ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id")
;

-- statement 119 | md5 4c49dfa7f34d7e12c849ef0420552854 | chars 99
ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_invite_code_key" UNIQUE ("invite_code")
;

-- statement 120 | md5 70ffd62f6dd0eb0a9c230e45adc1eac3 | chars 84
ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
;

-- statement 121 | md5 cce03fc135794ae1c34be0ac64faa94d | chars 101
ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_tracker_code_key" UNIQUE ("tracker_code")
;

-- statement 122 | md5 86b20f0299e2f52b03de12cce95afb72 | chars 105
ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
;

-- statement 123 | md5 dbbdad3a83ab08e9567e2014c2d87646 | chars 103
CREATE INDEX "events_game_id_timestamp_idx" ON "public"."events" USING "btree" ("game_id", "timestamp")
;

-- statement 124 | md5 3ee60028cc2b8047ed895134160ce7aa | chars 98
CREATE INDEX "events_roster_player_id_idx" ON "public"."events" USING "btree" ("roster_player_id")
;

-- statement 125 | md5 8674252c01c842cc4d149b2d5cbf7bc4 | chars 80
CREATE INDEX "events_team_id_idx" ON "public"."events" USING "btree" ("team_id")
;

-- statement 126 | md5 b5bfe76b92e13537a8d01eb1fe3e53cc | chars 80
CREATE INDEX "events_user_id_idx" ON "public"."events" USING "btree" ("user_id")
;

-- statement 127 | md5 d47df92c91174125956b139d364ac504 | chars 82
CREATE INDEX "games_player_id_idx" ON "public"."games" USING "btree" ("player_id")
;

-- statement 128 | md5 edac84ace70a3630d94138f64f37f32e | chars 96
CREATE INDEX "games_roster_player_id_idx" ON "public"."games" USING "btree" ("roster_player_id")
;

-- statement 129 | md5 f9613acd591b07aecfa1b00a059e2200 | chars 84
CREATE INDEX "games_share_code_idx" ON "public"."games" USING "btree" ("share_code")
;

-- statement 130 | md5 934804e1a5c8a6769ae7030a6f4c300b | chars 78
CREATE INDEX "games_team_id_idx" ON "public"."games" USING "btree" ("team_id")
;

-- statement 131 | md5 4b8e73dec5f06f49b0b59f9b13316ea8 | chars 78
CREATE INDEX "games_user_id_idx" ON "public"."games" USING "btree" ("user_id")
;

-- statement 132 | md5 5f4878e60a90bee417aaf4d848a7bb46 | chars 116
CREATE INDEX "notification_queue_status_idx" ON "public"."notification_queue" USING "btree" ("status", "created_at")
;

-- statement 133 | md5 fb6cabe4658c6517c76ae91afca1bb9d | chars 112
CREATE INDEX "player_claims_roster_player_id_idx" ON "public"."player_claims" USING "btree" ("roster_player_id")
;

-- statement 134 | md5 fa3d659eff915727d9a73dbcbc8ab026 | chars 94
CREATE INDEX "player_claims_team_id_idx" ON "public"."player_claims" USING "btree" ("team_id")
;

-- statement 135 | md5 db214a9bfc961d3b82d37463a84ba0cb | chars 94
CREATE INDEX "player_claims_user_id_idx" ON "public"."player_claims" USING "btree" ("user_id")
;

-- statement 136 | md5 2606738e9658cf2fef8489334e3c5412 | chars 96
CREATE INDEX "roster_players_team_id_idx" ON "public"."roster_players" USING "btree" ("team_id")
;

-- statement 137 | md5 4c14ac6968541decf07f925e4afdc999 | chars 108
CREATE INDEX "team_access_requests_team_id_idx" ON "public"."team_access_requests" USING "btree" ("team_id")
;

-- statement 138 | md5 8f55185783f090fbba341bb0bb65d52c | chars 108
CREATE INDEX "team_access_requests_user_id_idx" ON "public"."team_access_requests" USING "btree" ("user_id")
;

-- statement 139 | md5 70fb2d6d3ab0387e468517e7d8d76a2c | chars 92
CREATE INDEX "team_members_team_id_idx" ON "public"."team_members" USING "btree" ("team_id")
;

-- statement 140 | md5 eb9a82a4c2e7151f707b108ad31132ca | chars 92
CREATE INDEX "team_members_user_id_idx" ON "public"."team_members" USING "btree" ("user_id")
;

-- statement 141 | md5 09701d62927a1559d876d9c215f11227 | chars 84
CREATE INDEX "teams_created_by_idx" ON "public"."teams" USING "btree" ("created_by")
;

-- statement 142 | md5 a9278fa4a178cc601ef6b2b771c7df12 | chars 86
CREATE INDEX "teams_invite_code_idx" ON "public"."teams" USING "btree" ("invite_code")
;

-- statement 143 | md5 9021884b2fe955bd6f5eb3a762a29546 | chars 88
CREATE INDEX "teams_tracker_code_idx" ON "public"."teams" USING "btree" ("tracker_code")
;

-- statement 144 | md5 898e28d96c17ae301fbcaf95ce3d73f4 | chars 104
CREATE INDEX "user_profiles_admin_status_idx" ON "public"."user_profiles" USING "btree" ("admin_status")
;

-- statement 145 | md5 1a40bc92db84ea0ee9a89dd027277cc0 | chars 99
CREATE INDEX "user_profiles_email_idx" ON "public"."user_profiles" USING "btree" ("lower"("email"))
;

-- statement 146 | md5 003df109667d219f0864812f33de9a8a | chars 151
ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE
;

-- statement 147 | md5 b2ce17c755af58f6e37bde4f900e6714 | chars 179
ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_roster_player_id_fkey" FOREIGN KEY ("roster_player_id") REFERENCES "public"."roster_players"("id") ON DELETE SET NULL
;

-- statement 148 | md5 708de4d987376b01a1122df6f1bd9803 | chars 152
ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL
;

-- statement 149 | md5 2c4c6c7eb203f12789ca647ff0d92092 | chars 149
ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
;

-- statement 150 | md5 a5b6f8c58daf52acd6893e7590363266 | chars 177
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_roster_player_id_fkey" FOREIGN KEY ("roster_player_id") REFERENCES "public"."roster_players"("id") ON DELETE SET NULL
;

-- statement 151 | md5 3e3651e03cc12274af70d3b234ab485d | chars 150
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL
;

-- statement 152 | md5 fc8900e049556ee969a08b1f2a398356 | chars 147
ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
;

-- statement 153 | md5 874dd93169008014d102095b8e455528 | chars 192
ALTER TABLE ONLY "public"."player_claims"
    ADD CONSTRAINT "player_claims_roster_player_id_fkey" FOREIGN KEY ("roster_player_id") REFERENCES "public"."roster_players"("id") ON DELETE CASCADE
;

-- statement 154 | md5 a1517cc455cfc683fdb3795ed76aef87 | chars 165
ALTER TABLE ONLY "public"."player_claims"
    ADD CONSTRAINT "player_claims_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE
;

-- statement 155 | md5 5d0484e29da3eeb396beded4716349a2 | chars 163
ALTER TABLE ONLY "public"."player_claims"
    ADD CONSTRAINT "player_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
;

-- statement 156 | md5 3c5d82c2735b25d2edeaa747168cbee7 | chars 167
ALTER TABLE ONLY "public"."roster_players"
    ADD CONSTRAINT "roster_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE
;

-- statement 157 | md5 7db67f97aa5621a141d733b6d6ab7de3 | chars 186
ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL
;

-- statement 158 | md5 0c40ea43e51519778f8c898d4d111187 | chars 179
ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE
;

-- statement 159 | md5 2077fb3beb7a891fe674790dc1cf2d03 | chars 177
ALTER TABLE ONLY "public"."team_access_requests"
    ADD CONSTRAINT "team_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
;

-- statement 160 | md5 f75cb3ab5fb7ceda664bd84eaf186606 | chars 163
ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE
;

-- statement 161 | md5 0ce0f7ec846d311b62379fc5e4067b0f | chars 161
ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
;

-- statement 162 | md5 1d0dec468b252778e3deec9421ab1cee | chars 154
ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL
;

-- statement 163 | md5 31273d06189fce5203bb8f0bbaa65ea0 | chars 172
ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL
;

-- statement 164 | md5 109c6c4aebdc615ed46b3fee5e74fe56 | chars 163
ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
;

-- statement 165 | md5 cc7dfdc19735a40a6ed71b8f29202f1e | chars 55
ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY
;

-- statement 166 | md5 29b8cdb36f627799a89dd508e005ea74 | chars 54
ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY
;

-- statement 167 | md5 13486c6ce226fa6c800e811468733100 | chars 744
CREATE POLICY "laxhornet delete own events" ON "public"."events" FOR DELETE TO "authenticated" USING ((((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ("games"."team_id" IS NOT NULL)))))) OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("events"."team_id", "events"."roster_player_id") AS "laxhornet_can_track_roster_player")) OR (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ("games"."team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))))
;

-- statement 168 | md5 a5fdd64058730e3b7fc941140455db0c | chars 350
CREATE POLICY "laxhornet delete own games" ON "public"."games" FOR DELETE TO "authenticated" USING (((("team_id" IS NULL) AND (( SELECT "auth"."uid"() AS "uid") = "user_id")) OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))
;

-- statement 169 | md5 5d02473b42ce0f2b144a6f0b3129ae1d | chars 323
CREATE POLICY "laxhornet delete roster players" ON "public"."roster_players" FOR DELETE TO "authenticated" USING ((( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("roster_players"."team_id") AS "laxhornet_team_role") = 'admin'::"text")))
;

-- statement 170 | md5 8d3d76aeb8e65d7dec1a22da25a1018c | chars 275
CREATE POLICY "laxhornet delete team members" ON "public"."team_members" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "public"."laxhornet_team_role"("team_members"."team_id") AS "laxhornet_team_role") = 'admin'::"text")))
;

-- statement 171 | md5 582e0ac516efb79c2cc0383e2a7c1d10 | chars 233
CREATE POLICY "laxhornet delete teams" ON "public"."teams" FOR DELETE TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."laxhornet_can_create_team"() AS "laxhornet_can_create_team")))
;

-- statement 172 | md5 799ae9091cd902975f76bcb1f605a766 | chars 531
CREATE POLICY "laxhornet insert own events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ((("games"."team_id" IS NULL) AND ("games"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("games"."team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))))))
;

-- statement 173 | md5 0b20d177f4d80754455eaa9cd1db413d | chars 325
CREATE POLICY "laxhornet insert own games" ON "public"."games" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (("team_id" IS NULL) OR ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))
;

-- statement 174 | md5 042cfc1b862ede341bd3af2fc55382b5 | chars 123
CREATE POLICY "laxhornet insert player claims" ON "public"."player_claims" FOR INSERT TO "authenticated" WITH CHECK (false)
;

-- statement 175 | md5 6c6d9d6ee4ada43b28623ca04161e1e5 | chars 328
CREATE POLICY "laxhornet insert roster players" ON "public"."roster_players" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("roster_players"."team_id") AS "laxhornet_team_role") = 'admin'::"text")))
;

-- statement 176 | md5 ffc9cf8283bcfa87171477487b085e68 | chars 179
CREATE POLICY "laxhornet insert team access requests" ON "public"."team_access_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")))
;

-- statement 177 | md5 454168e9c7b8c614cd6e961e04ae9a23 | chars 445
CREATE POLICY "laxhornet insert team members" ON "public"."team_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("role" = 'admin'::"text") AND ( SELECT "public"."laxhornet_can_create_team"() AS "laxhornet_can_create_team") AND (EXISTS ( SELECT 1
   FROM "public"."teams"
  WHERE (("teams"."id" = "team_members"."team_id") AND ("teams"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))))
;

-- statement 178 | md5 9715d5a5690ea56b58438bbdc5766742 | chars 238
CREATE POLICY "laxhornet insert teams" ON "public"."teams" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."laxhornet_can_create_team"() AS "laxhornet_can_create_team")))
;

-- statement 179 | md5 f5ee01e01c9c5b82dbceb752f787de5f | chars 165
CREATE POLICY "laxhornet insert user profiles" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")))
;

-- statement 180 | md5 3e1d7f141b87044372413610258eaee1 | chars 210
CREATE POLICY "laxhornet read notification queue" ON "public"."notification_queue" FOR SELECT TO "authenticated" USING (( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer"))
;

-- statement 181 | md5 4f91fadf8ef18e9a11ec36326c4cbee9 | chars 656
CREATE POLICY "laxhornet read own or shared events" ON "public"."events" FOR SELECT TO "authenticated", "anon" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("events"."team_id", "events"."roster_player_id") AS "laxhornet_can_track_roster_player")) OR (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND (("games"."is_shared" = true) OR (("games"."team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))))))
;

-- statement 182 | md5 d00fa2ce3ada82932910975096be1441 | chars 364
CREATE POLICY "laxhornet read own or shared games" ON "public"."games" FOR SELECT TO "authenticated", "anon" USING ((("is_shared" = true) OR (( SELECT "auth"."uid"() AS "uid") = "user_id") OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))
;

-- statement 183 | md5 89fb14510cda3e677abf472f74fecab8 | chars 369
CREATE POLICY "laxhornet read player claims" ON "public"."player_claims" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("player_claims"."team_id") AS "laxhornet_team_role") = 'admin'::"text")))
;

-- statement 184 | md5 4353e7e119fdd74c442986d92a449626 | chars 566
CREATE POLICY "laxhornet read roster players" ON "public"."roster_players" FOR SELECT TO "authenticated" USING ((( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("roster_players"."team_id") AS "laxhornet_team_role") = 'admin'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."player_claims" "claims"
  WHERE (("claims"."team_id" = "roster_players"."team_id") AND ("claims"."roster_player_id" = "roster_players"."id") AND ("claims"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))
;

-- statement 185 | md5 886808d43c02bd59ee771edc1bef57cd | chars 390
CREATE POLICY "laxhornet read team access requests" ON "public"."team_access_requests" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("team_access_requests"."team_id") AS "laxhornet_team_role") = 'admin'::"text")))
;

-- statement 186 | md5 c4e929094133bdf91a716eacbf7e24cb | chars 263
CREATE POLICY "laxhornet read team members" ON "public"."team_members" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."laxhornet_is_team_member"("team_members"."team_id") AS "laxhornet_is_team_member")))
;

-- statement 187 | md5 33459763208d2b8e04db4a36528a728c | chars 240
CREATE POLICY "laxhornet read teams" ON "public"."teams" FOR SELECT TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."laxhornet_is_team_member"("teams"."id") AS "laxhornet_is_team_member")))
;

-- statement 188 | md5 8120c133ec64ed334108dc1a95937719 | chars 253
CREATE POLICY "laxhornet read user profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer")))
;

-- statement 189 | md5 5b1d80787802d871746929339c4a78a9 | chars 315
CREATE POLICY "laxhornet update notification queue" ON "public"."notification_queue" FOR UPDATE TO "authenticated" USING (( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer")) WITH CHECK (( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer"))
;

-- statement 190 | md5 609924546939562ef4997c9bb1425290 | chars 1775
CREATE POLICY "laxhornet update own events" ON "public"."events" FOR UPDATE TO "authenticated" USING ((((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ("games"."team_id" IS NOT NULL)))))) OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("events"."team_id", "events"."roster_player_id") AS "laxhornet_can_track_roster_player")) OR (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ("games"."team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player")))))) WITH CHECK (((((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ("games"."team_id" IS NOT NULL)))))) OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("events"."team_id", "events"."roster_player_id") AS "laxhornet_can_track_roster_player")) OR (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ("games"."team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))) AND (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "events"."game_id") AND ((("games"."team_id" IS NULL) AND ("games"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("games"."team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))))))
;

-- statement 191 | md5 462d024f07fd1df5ecc62ca1c36ed3f3 | chars 613
CREATE POLICY "laxhornet update own games" ON "public"."games" FOR UPDATE TO "authenticated" USING (((("team_id" IS NULL) AND (( SELECT "auth"."uid"() AS "uid") = "user_id")) OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player")))) WITH CHECK (((("team_id" IS NULL) AND (( SELECT "auth"."uid"() AS "uid") = "user_id")) OR (("team_id" IS NOT NULL) AND ( SELECT "public"."laxhornet_can_track_roster_player"("games"."team_id", "games"."roster_player_id") AS "laxhornet_can_track_roster_player"))))
;

-- statement 192 | md5 d79b143bac804cbdbf04219d3ad53774 | chars 545
CREATE POLICY "laxhornet update roster players" ON "public"."roster_players" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("roster_players"."team_id") AS "laxhornet_team_role") = 'admin'::"text"))) WITH CHECK ((( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("roster_players"."team_id") AS "laxhornet_team_role") = 'admin'::"text")))
;

-- statement 193 | md5 12e118f3b997119cd609cbd4d5f4377b | chars 569
CREATE POLICY "laxhornet update team access requests" ON "public"."team_access_requests" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("team_access_requests"."team_id") AS "laxhornet_team_role") = 'admin'::"text"))) WITH CHECK ((( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer") OR (( SELECT "public"."laxhornet_team_role"("team_access_requests"."team_id") AS "laxhornet_team_role") = 'admin'::"text")))
;

-- statement 194 | md5 3652adefe6397bc9a72d7d7fc6c132ce | chars 347
CREATE POLICY "laxhornet update team members" ON "public"."team_members" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."laxhornet_team_role"("team_members"."team_id") AS "laxhornet_team_role") = 'admin'::"text")) WITH CHECK ((( SELECT "public"."laxhornet_team_role"("team_members"."team_id") AS "laxhornet_team_role") = 'admin'::"text"))
;

-- statement 195 | md5 cc13ea7761db3ad3a27b57cce47002b0 | chars 383
CREATE POLICY "laxhornet update teams" ON "public"."teams" FOR UPDATE TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."laxhornet_can_create_team"() AS "laxhornet_can_create_team"))) WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."laxhornet_can_create_team"() AS "laxhornet_can_create_team")))
;

-- statement 196 | md5 952c6b952abd50532f01f52466bd80d5 | chars 411
CREATE POLICY "laxhornet update user profiles" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."laxhornet_is_platform_reviewer"() AS "laxhornet_is_platform_reviewer")))
;

-- statement 197 | md5 a16e236ee78550755a797b50e13d418e | chars 67
ALTER TABLE "public"."notification_queue" ENABLE ROW LEVEL SECURITY
;

-- statement 198 | md5 14b5b5ac52825c79cb52086c1fbc68a0 | chars 62
ALTER TABLE "public"."player_claims" ENABLE ROW LEVEL SECURITY
;

-- statement 199 | md5 ab8ce40bb082a69a54011b983cb9e0fa | chars 63
ALTER TABLE "public"."roster_players" ENABLE ROW LEVEL SECURITY
;

-- statement 200 | md5 1e3bd58750642ba60c176c19cd8c14a0 | chars 69
ALTER TABLE "public"."team_access_requests" ENABLE ROW LEVEL SECURITY
;

-- statement 201 | md5 34338045fa800a4ebf5d85bbb2a1077a | chars 61
ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY
;

-- statement 202 | md5 10b6991602cab0f285aebcb6a9398aac | chars 54
ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY
;

-- statement 203 | md5 b2fa410136a740eaec864d6fbe120785 | chars 62
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY
;

-- statement 204 | md5 0a461fc83c24f887b20d15af68555058 | chars 57
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres"
;

-- statement 205 | md5 e8ffe8a18bdd606a3ea195957f25c764 | chars 70
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."events"
;

-- statement 206 | md5 8b67b4edded985a1dd33deda01ba1a91 | chars 69
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."games"
;

-- statement 207 | md5 1b4ab5a30feff0ef869622f1aedc0f34 | chars 78
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."roster_players"
;

-- statement 208 | md5 ebc3e5771d8faaa7ce371675f12cac2b | chars 44
GRANT USAGE ON SCHEMA "public" TO "postgres"
;

-- statement 209 | md5 a3b268841b66363c5a31604c345e3686 | chars 40
GRANT USAGE ON SCHEMA "public" TO "anon"
;

-- statement 210 | md5 4690b98669fa6806b97d618df74b8e00 | chars 49
GRANT USAGE ON SCHEMA "public" TO "authenticated"
;

-- statement 211 | md5 d3cfb5aa0603ff9371d5964e7c7eb7c0 | chars 48
GRANT USAGE ON SCHEMA "public" TO "service_role"
;

-- statement 212 | md5 deed7f03095f1681d0f71ce0e1226e8d | chars 75
REVOKE ALL ON FUNCTION "public"."laxhornet_approved_app_role"() FROM PUBLIC
;

-- statement 213 | md5 3e7797a67ea5078b532f4ff3c4013864 | chars 80
GRANT ALL ON FUNCTION "public"."laxhornet_approved_app_role"() TO "service_role"
;

-- statement 214 | md5 b9c433ad8c251184ee3c04ce61b21dbf | chars 81
GRANT ALL ON FUNCTION "public"."laxhornet_approved_app_role"() TO "authenticated"
;

-- statement 215 | md5 30f282d5fa88db14eb6b4b2735650c41 | chars 73
REVOKE ALL ON FUNCTION "public"."laxhornet_can_create_team"() FROM PUBLIC
;

-- statement 216 | md5 2546b04af6de01338894b84b26bce807 | chars 78
GRANT ALL ON FUNCTION "public"."laxhornet_can_create_team"() TO "service_role"
;

-- statement 217 | md5 0ef5d78a168e325a8138f04ca8e8b555 | chars 79
GRANT ALL ON FUNCTION "public"."laxhornet_can_create_team"() TO "authenticated"
;

-- statement 218 | md5 54eb3613dca0485f95868292c16023dc | chars 93
REVOKE ALL ON FUNCTION "public"."laxhornet_can_edit_team"("check_team_id" "text") FROM PUBLIC
;

-- statement 219 | md5 a51c61d1c3f9fdc32fb2d6363a06b86b | chars 98
GRANT ALL ON FUNCTION "public"."laxhornet_can_edit_team"("check_team_id" "text") TO "service_role"
;

-- statement 220 | md5 5421779f18f55aa962e23f45d48e2b70 | chars 99
GRANT ALL ON FUNCTION "public"."laxhornet_can_edit_team"("check_team_id" "text") TO "authenticated"
;

-- statement 221 | md5 eece1153de1bc2f4a4b60c9ec5a1af1d | chars 136
REVOKE ALL ON FUNCTION "public"."laxhornet_can_track_roster_player"("check_team_id" "text", "check_roster_player_id" "text") FROM PUBLIC
;

-- statement 222 | md5 3c5f232ea0b27b875e653ad6fb8b0dc6 | chars 141
GRANT ALL ON FUNCTION "public"."laxhornet_can_track_roster_player"("check_team_id" "text", "check_roster_player_id" "text") TO "service_role"
;

-- statement 223 | md5 9fc9a9672c8b1ec49c184cfa019788db | chars 142
GRANT ALL ON FUNCTION "public"."laxhornet_can_track_roster_player"("check_team_id" "text", "check_roster_player_id" "text") TO "authenticated"
;

-- statement 224 | md5 2f46bec73de89de9ec4d75cc4f5bb849 | chars 121
REVOKE ALL ON FUNCTION "public"."laxhornet_claim_roster_player"("p_team_id" "text", "p_jersey_number" "text") FROM PUBLIC
;

-- statement 225 | md5 10c013cef998da1d78a049f3ef4c0ddd | chars 126
GRANT ALL ON FUNCTION "public"."laxhornet_claim_roster_player"("p_team_id" "text", "p_jersey_number" "text") TO "service_role"
;

-- statement 226 | md5 74f81eace6417f3d0898d71325c176ee | chars 127
GRANT ALL ON FUNCTION "public"."laxhornet_claim_roster_player"("p_team_id" "text", "p_jersey_number" "text") TO "authenticated"
;

-- statement 227 | md5 d62abb00203fe476c8f8fde4aad510ba | chars 182
REVOKE ALL ON FUNCTION "public"."laxhornet_create_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") FROM PUBLIC
;

-- statement 228 | md5 fb603faf30dad2017d9e41f5226034a2 | chars 187
GRANT ALL ON FUNCTION "public"."laxhornet_create_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") TO "service_role"
;

-- statement 229 | md5 21213b967c12a6c7f0486bed351262fe | chars 188
GRANT ALL ON FUNCTION "public"."laxhornet_create_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") TO "authenticated"
;

-- statement 230 | md5 ea1e500b3c1ab43259e9a743c59664bd | chars 180
REVOKE ALL ON FUNCTION "public"."laxhornet_create_team"("p_team_id" "text", "p_team_name" "text", "p_invite_code" "text", "p_tracker_code" "text", "p_member_id" "text") FROM PUBLIC
;

-- statement 231 | md5 977f707f44d319a16656605b90ad7b84 | chars 185
GRANT ALL ON FUNCTION "public"."laxhornet_create_team"("p_team_id" "text", "p_team_name" "text", "p_invite_code" "text", "p_tracker_code" "text", "p_member_id" "text") TO "service_role"
;

-- statement 232 | md5 4ddf930e5e60cc850be9f3d979cd4382 | chars 186
GRANT ALL ON FUNCTION "public"."laxhornet_create_team"("p_team_id" "text", "p_team_name" "text", "p_invite_code" "text", "p_tracker_code" "text", "p_member_id" "text") TO "authenticated"
;

-- statement 233 | md5 bd61348420f61e65c3a24260a753cb76 | chars 89
REVOKE ALL ON FUNCTION "public"."laxhornet_delete_event"("p_event_id" "text") FROM PUBLIC
;

-- statement 234 | md5 3cb0151e3942d83f91cc5129d2d9fb46 | chars 95
GRANT ALL ON FUNCTION "public"."laxhornet_delete_event"("p_event_id" "text") TO "authenticated"
;

-- statement 235 | md5 c434bd0fbb89e2b385ddaca6f49318d4 | chars 94
GRANT ALL ON FUNCTION "public"."laxhornet_delete_event"("p_event_id" "text") TO "service_role"
;

-- statement 236 | md5 50f687424f91606c7607ef8100f2c3e2 | chars 87
REVOKE ALL ON FUNCTION "public"."laxhornet_delete_game"("p_game_id" "text") FROM PUBLIC
;

-- statement 237 | md5 f03aecd6ad635fe778667c32d88fb48f | chars 93
GRANT ALL ON FUNCTION "public"."laxhornet_delete_game"("p_game_id" "text") TO "authenticated"
;

-- statement 238 | md5 0a2a6f0ab351191a287e663ebc576fa4 | chars 92
GRANT ALL ON FUNCTION "public"."laxhornet_delete_game"("p_game_id" "text") TO "service_role"
;

-- statement 239 | md5 f74ba4941ada3661bf53ddfeb127f2a4 | chars 124
REVOKE ALL ON FUNCTION "public"."laxhornet_delete_player_claim"("p_team_id" "text", "p_roster_player_id" "text") FROM PUBLIC
;

-- statement 240 | md5 067d9a335037bb44040743b797e936c7 | chars 129
GRANT ALL ON FUNCTION "public"."laxhornet_delete_player_claim"("p_team_id" "text", "p_roster_player_id" "text") TO "service_role"
;

-- statement 241 | md5 4e085e79de06bff886828112acb9c15e | chars 130
GRANT ALL ON FUNCTION "public"."laxhornet_delete_player_claim"("p_team_id" "text", "p_roster_player_id" "text") TO "authenticated"
;

-- statement 242 | md5 498d2ac6ee39f35e15571bc920e26f37 | chars 87
REVOKE ALL ON FUNCTION "public"."laxhornet_delete_team"("p_team_id" "text") FROM PUBLIC
;

-- statement 243 | md5 1aa48a4405a6d664c3bfbe4d7ecd546b | chars 92
GRANT ALL ON FUNCTION "public"."laxhornet_delete_team"("p_team_id" "text") TO "service_role"
;

-- statement 244 | md5 8abbc5e0a29cd0860fe45c283a1c65ff | chars 93
GRANT ALL ON FUNCTION "public"."laxhornet_delete_team"("p_team_id" "text") TO "authenticated"
;

-- statement 245 | md5 ac357de866ad2bc1369cecd56a0ddeb7 | chars 73
REVOKE ALL ON FUNCTION "public"."laxhornet_handle_new_user"() FROM PUBLIC
;

-- statement 246 | md5 5f78a50ca884db85bdce398d74e88247 | chars 78
GRANT ALL ON FUNCTION "public"."laxhornet_handle_new_user"() TO "service_role"
;

-- statement 247 | md5 b192501b8b884dd9765cbfd06add3873 | chars 78
REVOKE ALL ON FUNCTION "public"."laxhornet_is_platform_reviewer"() FROM PUBLIC
;

-- statement 248 | md5 31d33f9b13306de5bfaece2ee1d066be | chars 83
GRANT ALL ON FUNCTION "public"."laxhornet_is_platform_reviewer"() TO "service_role"
;

-- statement 249 | md5 b9b43df35dccb42d52609d6800a54e8b | chars 84
GRANT ALL ON FUNCTION "public"."laxhornet_is_platform_reviewer"() TO "authenticated"
;

-- statement 250 | md5 6da28fdbd9f37cb2aa44d90e09e1c0fd | chars 94
REVOKE ALL ON FUNCTION "public"."laxhornet_is_team_member"("check_team_id" "text") FROM PUBLIC
;

-- statement 251 | md5 5c8787a99f694be5cc3942fd90302965 | chars 99
GRANT ALL ON FUNCTION "public"."laxhornet_is_team_member"("check_team_id" "text") TO "service_role"
;

-- statement 252 | md5 fdc22a0691ab4d6abd18c80984e93538 | chars 100
GRANT ALL ON FUNCTION "public"."laxhornet_is_team_member"("check_team_id" "text") TO "authenticated"
;

-- statement 253 | md5 dd7da7eedb030cedfac6c7c762bc758c | chars 93
REVOKE ALL ON FUNCTION "public"."laxhornet_join_team_by_code"("join_code" "text") FROM PUBLIC
;

-- statement 254 | md5 f9cf28b38db45e1695e32cab60014c8c | chars 98
GRANT ALL ON FUNCTION "public"."laxhornet_join_team_by_code"("join_code" "text") TO "service_role"
;

-- statement 255 | md5 297890810e754f4b31b5831ad4ae3d98 | chars 99
GRANT ALL ON FUNCTION "public"."laxhornet_join_team_by_code"("join_code" "text") TO "authenticated"
;

-- statement 256 | md5 07974e962d5f647726ad95638c3f80fc | chars 74
REVOKE ALL ON FUNCTION "public"."laxhornet_my_player_claims"() FROM PUBLIC
;

-- statement 257 | md5 372231742c6dc14197e89f7fe8dd81ab | chars 79
GRANT ALL ON FUNCTION "public"."laxhornet_my_player_claims"() TO "service_role"
;

-- statement 258 | md5 67e943dd8e281c29e9e9a5e45970cba1 | chars 80
GRANT ALL ON FUNCTION "public"."laxhornet_my_player_claims"() TO "authenticated"
;

-- statement 259 | md5 c6264a333fe04926dbe1441df7465a81 | chars 68
REVOKE ALL ON FUNCTION "public"."laxhornet_my_profile"() FROM PUBLIC
;

-- statement 260 | md5 114e904230c3ff8f337ffd733e04681d | chars 73
GRANT ALL ON FUNCTION "public"."laxhornet_my_profile"() TO "service_role"
;

-- statement 261 | md5 e161d77b7c0e26422a28ed36afdb8508 | chars 74
GRANT ALL ON FUNCTION "public"."laxhornet_my_profile"() TO "authenticated"
;

-- statement 262 | md5 d8568a022b5599113ebef766ab44e3d0 | chars 75
REVOKE ALL ON FUNCTION "public"."laxhornet_my_roster_players"() FROM PUBLIC
;

-- statement 263 | md5 05177abf73f2d6e9d8c9d9be73c2d116 | chars 80
GRANT ALL ON FUNCTION "public"."laxhornet_my_roster_players"() TO "service_role"
;

-- statement 264 | md5 99bff3d5ad68be559be810f4639fede3 | chars 81
GRANT ALL ON FUNCTION "public"."laxhornet_my_roster_players"() TO "authenticated"
;

-- statement 265 | md5 a6437b5cbe1ff12e90ec879233be4e35 | chars 81
REVOKE ALL ON FUNCTION "public"."laxhornet_my_team_access_requests"() FROM PUBLIC
;

-- statement 266 | md5 ec901d9f2f08a68af8ccc3cb09f1ce05 | chars 86
GRANT ALL ON FUNCTION "public"."laxhornet_my_team_access_requests"() TO "service_role"
;

-- statement 267 | md5 21b5f0e0f8d830611d6aa82a25bc41fb | chars 87
GRANT ALL ON FUNCTION "public"."laxhornet_my_team_access_requests"() TO "authenticated"
;

-- statement 268 | md5 c7e49dea5be2c6ce158994e6df5428ae | chars 66
REVOKE ALL ON FUNCTION "public"."laxhornet_my_teams"() FROM PUBLIC
;

-- statement 269 | md5 1ce76d91f53914b4a356bfb9ff6a41a5 | chars 71
GRANT ALL ON FUNCTION "public"."laxhornet_my_teams"() TO "service_role"
;

-- statement 270 | md5 3dff0c226b6eec74cf50edd17640c083 | chars 72
GRANT ALL ON FUNCTION "public"."laxhornet_my_teams"() TO "authenticated"
;

-- statement 271 | md5 610520bffd479de402b62060f259ab42 | chars 80
REVOKE ALL ON FUNCTION "public"."laxhornet_pending_admin_requests"() FROM PUBLIC
;

-- statement 272 | md5 35bf9e28552195c567a7539f9b3a239c | chars 85
GRANT ALL ON FUNCTION "public"."laxhornet_pending_admin_requests"() TO "service_role"
;

-- statement 273 | md5 2841de1778da9ba45fa18cfbccc5135b | chars 86
GRANT ALL ON FUNCTION "public"."laxhornet_pending_admin_requests"() TO "authenticated"
;

-- statement 274 | md5 9d1129412d29b4f3ed0bf39a761b96b2 | chars 86
REVOKE ALL ON FUNCTION "public"."laxhornet_pending_team_access_requests"() FROM PUBLIC
;

-- statement 275 | md5 e275def216fc47e8f4068a1307717460 | chars 91
GRANT ALL ON FUNCTION "public"."laxhornet_pending_team_access_requests"() TO "service_role"
;

-- statement 276 | md5 e689b58f801ea8b6f7e44aa67a6a8b37 | chars 92
GRANT ALL ON FUNCTION "public"."laxhornet_pending_team_access_requests"() TO "authenticated"
;

-- statement 277 | md5 d869a1e4f9969530a77c796970fe2bd1 | chars 125
REVOKE ALL ON FUNCTION "public"."laxhornet_remove_roster_player"("p_roster_player_id" "text", "p_team_id" "text") FROM PUBLIC
;

-- statement 278 | md5 0c5f81ac4e4e081dc3f2fb8281c0612a | chars 130
GRANT ALL ON FUNCTION "public"."laxhornet_remove_roster_player"("p_roster_player_id" "text", "p_team_id" "text") TO "service_role"
;

-- statement 279 | md5 b67f120657ffc1ec6bae0a60772bee45 | chars 131
GRANT ALL ON FUNCTION "public"."laxhornet_remove_roster_player"("p_roster_player_id" "text", "p_team_id" "text") TO "authenticated"
;

-- statement 280 | md5 205e133029665a74d6a0926cf007e94f | chars 87
REVOKE ALL ON FUNCTION "public"."laxhornet_repair_approved_player_claims"() FROM PUBLIC
;

-- statement 281 | md5 7f9293b76d124f1cd3b0389740ec1f6f | chars 93
GRANT ALL ON FUNCTION "public"."laxhornet_repair_approved_player_claims"() TO "authenticated"
;

-- statement 282 | md5 6d9b6f573169abe16ffddcf7183f3f3e | chars 92
GRANT ALL ON FUNCTION "public"."laxhornet_repair_approved_player_claims"() TO "service_role"
;

-- statement 283 | md5 3eb250de70c6ec5601b0c13fe0875672 | chars 95
REVOKE ALL ON FUNCTION "public"."laxhornet_request_team_access"("join_code" "text") FROM PUBLIC
;

-- statement 284 | md5 477d1bd707f3e32ac2ef668e524eb3f6 | chars 100
GRANT ALL ON FUNCTION "public"."laxhornet_request_team_access"("join_code" "text") TO "service_role"
;

-- statement 285 | md5 83785be2425a4a710e0dc3d7c1775aaf | chars 101
GRANT ALL ON FUNCTION "public"."laxhornet_request_team_access"("join_code" "text") TO "authenticated"
;

-- statement 286 | md5 a2daa149dcd25b401c2ef8172df87aae | chars 142
REVOKE ALL ON FUNCTION "public"."laxhornet_request_team_player_access"("join_code" "text", "requested_child_jersey_number" "text") FROM PUBLIC
;

-- statement 287 | md5 e2aeef8ff54f009179d00c293fb1e6b6 | chars 147
GRANT ALL ON FUNCTION "public"."laxhornet_request_team_player_access"("join_code" "text", "requested_child_jersey_number" "text") TO "service_role"
;

-- statement 288 | md5 2ab21f64bbaf59355718f11682b95e10 | chars 148
GRANT ALL ON FUNCTION "public"."laxhornet_request_team_player_access"("join_code" "text", "requested_child_jersey_number" "text") TO "authenticated"
;

-- statement 289 | md5 91e5c5f89f865582667b68149d838796 | chars 102
REVOKE ALL ON FUNCTION "public"."laxhornet_request_user_role"("requested_app_role" "text") FROM PUBLIC
;

-- statement 290 | md5 99b131fe35ed519d209e4b2dc5ea5019 | chars 107
GRANT ALL ON FUNCTION "public"."laxhornet_request_user_role"("requested_app_role" "text") TO "service_role"
;

-- statement 291 | md5 8658941052e84adb4d79c07bd8d39131 | chars 108
GRANT ALL ON FUNCTION "public"."laxhornet_request_user_role"("requested_app_role" "text") TO "authenticated"
;

-- statement 292 | md5 26e68b22f176b62d6588c4326f6f293d | chars 121
REVOKE ALL ON FUNCTION "public"."laxhornet_review_admin_request"("request_user_id" "uuid", "approve" boolean) FROM PUBLIC
;

-- statement 293 | md5 9baed957d93a2c807f33b478c953db65 | chars 126
GRANT ALL ON FUNCTION "public"."laxhornet_review_admin_request"("request_user_id" "uuid", "approve" boolean) TO "service_role"
;

-- statement 294 | md5 2f442c73ca1ebb862a1d0e8ebaea8d86 | chars 127
GRANT ALL ON FUNCTION "public"."laxhornet_review_admin_request"("request_user_id" "uuid", "approve" boolean) TO "authenticated"
;

-- statement 295 | md5 be0e0b9aa39b5fd3a459e3aa7c8907a2 | chars 122
REVOKE ALL ON FUNCTION "public"."laxhornet_review_team_access_request"("request_id" "text", "approve" boolean) FROM PUBLIC
;

-- statement 296 | md5 c646109bfa8ffda1ca0a608e94ecbd0e | chars 127
GRANT ALL ON FUNCTION "public"."laxhornet_review_team_access_request"("request_id" "text", "approve" boolean) TO "service_role"
;

-- statement 297 | md5 5daaf24453fd5562771defbb942b0092 | chars 128
GRANT ALL ON FUNCTION "public"."laxhornet_review_team_access_request"("request_id" "text", "approve" boolean) TO "authenticated"
;

-- statement 298 | md5 ecd761aa845a7396e563f753b46f95f5 | chars 119
REVOKE ALL ON FUNCTION "public"."laxhornet_send_player_verification_reminder"("reminder_request_id" "text") FROM PUBLIC
;

-- statement 299 | md5 0ec65c314d84217a665a40f43642539c | chars 125
GRANT ALL ON FUNCTION "public"."laxhornet_send_player_verification_reminder"("reminder_request_id" "text") TO "authenticated"
;

-- statement 300 | md5 173ec50ae493751758399e5e70748705 | chars 124
GRANT ALL ON FUNCTION "public"."laxhornet_send_player_verification_reminder"("reminder_request_id" "text") TO "service_role"
;

-- statement 301 | md5 bd4673dae29fd4fd84ab0612010d9685 | chars 97
REVOKE ALL ON FUNCTION "public"."laxhornet_team_access_codes"("check_team_id" "text") FROM PUBLIC
;

-- statement 302 | md5 c3b2f7515f55dacc461bf81f32f12711 | chars 102
GRANT ALL ON FUNCTION "public"."laxhornet_team_access_codes"("check_team_id" "text") TO "service_role"
;

-- statement 303 | md5 ebeaa03b2a24b2ca96bedb1cb29e7c52 | chars 103
GRANT ALL ON FUNCTION "public"."laxhornet_team_access_codes"("check_team_id" "text") TO "authenticated"
;

-- statement 304 | md5 0335bcaff3dfdaa0d8bf16bfd478986d | chars 89
REVOKE ALL ON FUNCTION "public"."laxhornet_team_role"("check_team_id" "text") FROM PUBLIC
;

-- statement 305 | md5 0f750aa31e6cbe0aa1e50ec198fd3a04 | chars 94
GRANT ALL ON FUNCTION "public"."laxhornet_team_role"("check_team_id" "text") TO "service_role"
;

-- statement 306 | md5 82655b5a450023ec4262f285330a6d25 | chars 95
GRANT ALL ON FUNCTION "public"."laxhornet_team_role"("check_team_id" "text") TO "authenticated"
;

-- statement 307 | md5 9a3db47ce229f79eb09df16dfcf80e56 | chars 182
REVOKE ALL ON FUNCTION "public"."laxhornet_update_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") FROM PUBLIC
;

-- statement 308 | md5 ad835feb41600540019efef5b28b20d5 | chars 187
GRANT ALL ON FUNCTION "public"."laxhornet_update_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") TO "service_role"
;

-- statement 309 | md5 bec80811f38cfc4beeadcbcf0c6147a7 | chars 188
GRANT ALL ON FUNCTION "public"."laxhornet_update_roster_player"("p_roster_player_id" "text", "p_team_id" "text", "p_name" "text", "p_number" "text", "p_position" "text") TO "authenticated"
;

-- statement 310 | md5 3b2b7eab6f9e98f9dacea8e8ef21110f | chars 80
REVOKE ALL ON FUNCTION "public"."laxhornet_visible_roster_players"() FROM PUBLIC
;

-- statement 311 | md5 4ec028f563cc8d98a136706cf1f0d8d1 | chars 85
GRANT ALL ON FUNCTION "public"."laxhornet_visible_roster_players"() TO "service_role"
;

-- statement 312 | md5 2e0ab5c52ca5948867fb9273725d0e5c | chars 86
GRANT ALL ON FUNCTION "public"."laxhornet_visible_roster_players"() TO "authenticated"
;

-- statement 313 | md5 de802ab5a623e55bb3fe094dea9b2800 | chars 46
GRANT ALL ON TABLE "public"."events" TO "anon"
;

-- statement 314 | md5 ab92c91ff33352f609ec5ccd4593f10b | chars 55
GRANT ALL ON TABLE "public"."events" TO "authenticated"
;

-- statement 315 | md5 3bd3d8bec2898793c4cdd9489087bfe4 | chars 54
GRANT ALL ON TABLE "public"."events" TO "service_role"
;

-- statement 316 | md5 e7d64ab164d8b95940a398276227a6c3 | chars 45
GRANT ALL ON TABLE "public"."games" TO "anon"
;

-- statement 317 | md5 7b15fa7422e713fd1bd3452545d73a4b | chars 54
GRANT ALL ON TABLE "public"."games" TO "authenticated"
;

-- statement 318 | md5 b72f63d8f9f791b0794df97f3c2ca3cb | chars 53
GRANT ALL ON TABLE "public"."games" TO "service_role"
;

-- statement 319 | md5 bd621b8903faced1048f9ea92d5e688a | chars 58
GRANT ALL ON TABLE "public"."notification_queue" TO "anon"
;

-- statement 320 | md5 a4c62551cae5d61e14b17525b6259e0e | chars 67
GRANT ALL ON TABLE "public"."notification_queue" TO "authenticated"
;

-- statement 321 | md5 cc30016d92a3052dc3e4b0f58480f861 | chars 66
GRANT ALL ON TABLE "public"."notification_queue" TO "service_role"
;

-- statement 322 | md5 86a903ce6c5e84efe35374537c0a5a28 | chars 53
GRANT ALL ON TABLE "public"."player_claims" TO "anon"
;

-- statement 323 | md5 bf0a9cec5048e4b930a22f1cf4f873b4 | chars 62
GRANT ALL ON TABLE "public"."player_claims" TO "authenticated"
;

-- statement 324 | md5 20bfe316d202b4d58d6ac28d573f8fef | chars 61
GRANT ALL ON TABLE "public"."player_claims" TO "service_role"
;

-- statement 325 | md5 627a0e41bf260f2481e2309f0086bfc2 | chars 54
GRANT ALL ON TABLE "public"."roster_players" TO "anon"
;

-- statement 326 | md5 eb6181f397834358c6e99e7992a9bf30 | chars 63
GRANT ALL ON TABLE "public"."roster_players" TO "authenticated"
;

-- statement 327 | md5 1ad0a899b47a66e2dce23bf28080eeff | chars 62
GRANT ALL ON TABLE "public"."roster_players" TO "service_role"
;

-- statement 328 | md5 86a91fdd192948e0afa37fb77e2ac470 | chars 60
GRANT ALL ON TABLE "public"."team_access_requests" TO "anon"
;

-- statement 329 | md5 f4c563f508a9c587a2818d57ccd7a068 | chars 69
GRANT ALL ON TABLE "public"."team_access_requests" TO "authenticated"
;

-- statement 330 | md5 0cb9771480bd3aa84048ae09631e56e0 | chars 68
GRANT ALL ON TABLE "public"."team_access_requests" TO "service_role"
;

-- statement 331 | md5 0494fecc9c23a402d169033b14da2e7c | chars 52
GRANT ALL ON TABLE "public"."team_members" TO "anon"
;

-- statement 332 | md5 942b78db62069aa698d2c7371f1cab77 | chars 61
GRANT ALL ON TABLE "public"."team_members" TO "authenticated"
;

-- statement 333 | md5 926b9bdb4c815e1a751fd6b344697b83 | chars 60
GRANT ALL ON TABLE "public"."team_members" TO "service_role"
;

-- statement 334 | md5 e8a249bb376af1b9706231ead0604987 | chars 45
GRANT ALL ON TABLE "public"."teams" TO "anon"
;

-- statement 335 | md5 df1eb6f8d509a2330079393489f9c2ba | chars 54
GRANT ALL ON TABLE "public"."teams" TO "authenticated"
;

-- statement 336 | md5 2efc428975f1c2b708b3749d00513058 | chars 53
GRANT ALL ON TABLE "public"."teams" TO "service_role"
;

-- statement 337 | md5 0f42394a9ce8a9a8f4feccc0a244075f | chars 53
GRANT ALL ON TABLE "public"."user_profiles" TO "anon"
;

-- statement 338 | md5 8b6b4a632a7277c1d5c6e95bddbe98c6 | chars 62
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated"
;

-- statement 339 | md5 a7db258c8f4d6d06d6a321046649c42a | chars 61
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role"
;

-- statement 340 | md5 05b6d9ac4d047c67ea499e658e2a8ff7 | chars 100
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres"
;

-- statement 341 | md5 71bc59878196d4066ed891cf869be3c9 | chars 96
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon"
;

-- statement 342 | md5 03b6475bd1b61a5920c39b4958cf3de5 | chars 105
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated"
;

-- statement 343 | md5 fefedd1063a86cb1d9a432d6ca314cd4 | chars 104
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role"
;

-- statement 344 | md5 c14fee1ca57c777e62d55bd689261686 | chars 100
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres"
;

-- statement 345 | md5 9960cd7c6c547a1efe4817dbb9bda775 | chars 105
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated"
;

-- statement 346 | md5 bc865410eb58499e5fb6fe01387c1762 | chars 104
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role"
;

-- statement 347 | md5 c79735e5f6255722944bade652c30581 | chars 97
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres"
;

-- statement 348 | md5 0b1581cadf2be6ace15f69e7ad4f9e24 | chars 93
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon"
;

-- statement 349 | md5 91244e02dde3e3056aa6036c77b3a95c | chars 102
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated"
;

-- statement 350 | md5 6d4418580708fc5d2f4324948fa815be | chars 101
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role"
;
