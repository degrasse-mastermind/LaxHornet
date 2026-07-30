-- R2-06 durable legacy-game tombstones.
-- Additive repository migration only. Do not apply outside a separately approved release.

begin;

create schema if not exists lh_sync_private;
revoke all on schema lh_sync_private from public, anon, authenticated;

create table public.legacy_game_tombstones (
  game_id text primary key,
  owner_user_id uuid not null,
  team_id text references public.teams(id) on delete set null,
  roster_player_id text references public.roster_players(id) on delete set null,
  deleted_by uuid not null,
  deletion_id text not null unique,
  device_id text not null,
  known_game_saved_at timestamptz,
  deleted_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint legacy_game_tombstones_game_id_nonempty
    check (length(btrim(game_id)) between 1 and 160),
  constraint legacy_game_tombstones_deletion_id_nonempty
    check (length(btrim(deletion_id)) between 1 and 200),
  constraint legacy_game_tombstones_device_id_nonempty
    check (length(btrim(device_id)) between 1 and 200),
  constraint legacy_game_tombstones_ordered_timestamps
    check (created_at <= updated_at and deleted_at <= updated_at)
);

comment on table public.legacy_game_tombstones is
  'Private permanent deletion evidence for legacy games. Deleted game IDs are never reusable.';
comment on column public.legacy_game_tombstones.deletion_id is
  'Permanent client identity for one logical delete operation and all of its retries.';
comment on column public.legacy_game_tombstones.known_game_saved_at is
  'Newest game saved_at known to the deleting client, used to reject an older delete over a newer game write.';
comment on column public.legacy_game_tombstones.owner_user_id is
  'Retained authorization scope. Intentionally not an auth.users foreign key so durable evidence does not block account lifecycle.';
comment on column public.legacy_game_tombstones.deleted_by is
  'Actor recorded for replay identity. Intentionally not an auth.users foreign key so durable evidence does not block account lifecycle.';

create index legacy_game_tombstones_owner_deleted_idx
  on public.legacy_game_tombstones(owner_user_id, deleted_at desc);
create index legacy_game_tombstones_team_player_deleted_idx
  on public.legacy_game_tombstones(team_id, roster_player_id, deleted_at desc)
  where team_id is not null;

alter table public.legacy_game_tombstones enable row level security;
alter table public.legacy_game_tombstones force row level security;

revoke all on table public.legacy_game_tombstones from public, anon, authenticated;
grant select on table public.legacy_game_tombstones to authenticated;

create policy "laxhornet read authorized legacy game tombstones"
on public.legacy_game_tombstones
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or (select public.laxhornet_is_platform_reviewer())
  or (
    team_id is not null
    and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id))
  )
);

create or replace function lh_sync_private.reject_tombstoned_game_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  tombstone public.legacy_game_tombstones%rowtype;
  actor_id uuid := (select auth.uid());
begin
  select *
  into tombstone
  from public.legacy_game_tombstones
  where game_id = new.id;

  if not found then
    return new;
  end if;

  if actor_id is not null and (
    tombstone.owner_user_id = actor_id
    or (select public.laxhornet_is_platform_reviewer())
    or (
      tombstone.team_id is not null
      and (select public.laxhornet_can_track_roster_player(
        tombstone.team_id,
        tombstone.roster_player_id
      ))
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'laxhornet_game_deleted';
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'laxhornet_game_id_unavailable';
end;
$function$;

revoke execute on function lh_sync_private.reject_tombstoned_game_write()
  from public, anon, authenticated;

drop trigger if exists laxhornet_reject_tombstoned_game_write on public.games;
create trigger laxhornet_reject_tombstoned_game_write
before insert or update on public.games
for each row
execute function lh_sync_private.reject_tombstoned_game_write();

create or replace function public.laxhornet_sync_game(p_operation jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  operation_id text := btrim(coalesce(p_operation ->> 'operation_id', ''));
  device_id text := btrim(coalesce(p_operation ->> 'device_id', ''));
  payload_revision integer;
  game_payload jsonb := p_operation -> 'game_row';
  incoming public.games%rowtype;
  stored public.games%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
begin
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  if operation_id = '' or length(operation_id) > 200
    or device_id = '' or length(device_id) > 200
    or jsonb_typeof(game_payload) <> 'object'
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_operation');
  end if;

  begin
    payload_revision := (p_operation ->> 'payload_revision')::integer;
    select *
    into incoming
    from jsonb_populate_record(null::public.games, game_payload);
  exception
    when others then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_operation');
  end;

  if payload_revision < 1
    or incoming.id is null
    or btrim(incoming.id) = ''
    or incoming.user_id is null
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_operation');
  end if;

  select *
  into tombstone
  from public.legacy_game_tombstones
  where game_id = incoming.id;

  if found then
    return jsonb_build_object(
      'outcome', 'conflicted',
      'code', 'game_deleted',
      'acknowledgment', 'durable_tombstone',
      'deletedAt', tombstone.deleted_at
    );
  end if;

  insert into public.games(
    id,
    player_id,
    user_id,
    share_code,
    is_shared,
    opponent,
    game_date,
    location,
    game_type,
    period_format,
    player_snapshot,
    current_quarter,
    status,
    created_at,
    saved_at,
    ended_at,
    team_id,
    roster_player_id
  )
  values (
    incoming.id,
    incoming.player_id,
    incoming.user_id,
    incoming.share_code,
    incoming.is_shared,
    incoming.opponent,
    incoming.game_date,
    incoming.location,
    incoming.game_type,
    incoming.period_format,
    incoming.player_snapshot,
    incoming.current_quarter,
    incoming.status,
    incoming.created_at,
    incoming.saved_at,
    incoming.ended_at,
    incoming.team_id,
    incoming.roster_player_id
  )
  on conflict (id) do update
  set
    player_id = excluded.player_id,
    user_id = excluded.user_id,
    share_code = excluded.share_code,
    is_shared = excluded.is_shared,
    opponent = excluded.opponent,
    game_date = excluded.game_date,
    location = excluded.location,
    game_type = excluded.game_type,
    period_format = excluded.period_format,
    player_snapshot = excluded.player_snapshot,
    current_quarter = excluded.current_quarter,
    status = excluded.status,
    created_at = excluded.created_at,
    saved_at = excluded.saved_at,
    ended_at = excluded.ended_at,
    team_id = excluded.team_id,
    roster_player_id = excluded.roster_player_id
  returning * into stored;

  return jsonb_build_object(
    'outcome', 'accepted',
    'code', 'legacy_game_write_accepted',
    'acknowledgment', 'guarded_game_upsert',
    'operationId', operation_id,
    'payloadRevision', payload_revision,
    'gameId', stored.id,
    'savedAt', stored.saved_at
  );
end;
$function$;

create or replace function public.laxhornet_delete_game_durable(p_deletion jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  supplied_account_id uuid;
  target_game_id text := btrim(coalesce(p_deletion ->> 'game_id', ''));
  deletion_id text := btrim(coalesce(p_deletion ->> 'deletion_id', ''));
  device_id text := btrim(coalesce(p_deletion ->> 'device_id', ''));
  requested_deleted_at timestamptz;
  known_saved_at timestamptz;
  server_deleted_at timestamptz := statement_timestamp();
  game_row public.games%rowtype;
  existing public.legacy_game_tombstones%rowtype;
begin
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;

  begin
    supplied_account_id := (p_deletion ->> 'account_id')::uuid;
    requested_deleted_at := (p_deletion ->> 'deleted_at')::timestamptz;
    known_saved_at := nullif(p_deletion ->> 'known_game_saved_at', '')::timestamptz;
  exception
    when others then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_delete_operation');
  end;

  if supplied_account_id is distinct from actor_id
    or target_game_id = '' or length(target_game_id) > 160
    or deletion_id = '' or length(deletion_id) > 200
    or device_id = '' or length(device_id) > 200
    or requested_deleted_at is null
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_game_delete_operation');
  end if;

  -- Serialize competing delete identities for one permanent game ID. The games
  -- row lock below covers write/delete races; this lock also covers replay when
  -- the game row has already disappeared.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_game_id, 0)
  );

  select *
  into existing
  from public.legacy_game_tombstones
  where legacy_game_tombstones.game_id = target_game_id
  for update;

  if found then
    if not (
      existing.owner_user_id = actor_id
      or (select public.laxhornet_is_platform_reviewer())
      or (
        existing.team_id is not null
        and (select public.laxhornet_can_track_roster_player(
          existing.team_id,
          existing.roster_player_id
        ))
      )
    ) then
      return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
    end if;

    if existing.deletion_id = deletion_id and existing.deleted_by = actor_id then
      update public.legacy_game_tombstones
      set updated_at = greatest(updated_at, statement_timestamp())
      where legacy_game_tombstones.game_id = target_game_id;
      return jsonb_build_object(
        'outcome', 'accepted',
        'code', 'game_delete_replayed',
        'acknowledgment', 'same_deletion_id',
        'gameId', target_game_id,
        'deletionId', deletion_id,
        'deletedAt', existing.deleted_at
      );
    end if;

    return jsonb_build_object(
      'outcome', 'conflicted',
      'code', 'game_already_deleted',
      'acknowledgment', 'different_deletion_id',
      'gameId', target_game_id,
      'deletedAt', existing.deleted_at
    );
  end if;

  select *
  into game_row
  from public.games
  where games.id = target_game_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'rejected', 'code', 'game_not_found');
  end if;

  if not (
    game_row.user_id = actor_id
    or (select public.laxhornet_is_platform_reviewer())
    or (
      game_row.team_id is not null
      and (select public.laxhornet_can_track_roster_player(
        game_row.team_id,
        game_row.roster_player_id
      ))
    )
  ) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  if known_saved_at is not null
    and game_row.saved_at is not null
    and game_row.saved_at > known_saved_at
  then
    return jsonb_build_object(
      'outcome', 'conflicted',
      'code', 'newer_game_revision',
      'acknowledgment', 'saved_at_ordering',
      'gameId', target_game_id,
      'serverSavedAt', game_row.saved_at
    );
  end if;

  insert into public.legacy_game_tombstones(
    game_id,
    owner_user_id,
    team_id,
    roster_player_id,
    deleted_by,
    deletion_id,
    device_id,
    known_game_saved_at,
    deleted_at,
    created_at,
    updated_at
  )
  values (
    target_game_id,
    game_row.user_id,
    game_row.team_id,
    game_row.roster_player_id,
    actor_id,
    deletion_id,
    device_id,
    known_saved_at,
    server_deleted_at,
    server_deleted_at,
    server_deleted_at
  );

  delete from public.games
  where games.id = target_game_id;

  return jsonb_build_object(
    'outcome', 'accepted',
    'code', 'game_deleted',
    'acknowledgment', 'new_durable_tombstone',
    'gameId', target_game_id,
    'deletionId', deletion_id,
    'deletedAt', server_deleted_at
  );
end;
$function$;

create or replace function public.laxhornet_delete_game(p_game_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  game_row public.games%rowtype;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'Sign in required';
  end if;

  if exists (
    select 1
    from public.legacy_game_tombstones
    where game_id = p_game_id
      and (
        owner_user_id = actor_id
        or (select public.laxhornet_is_platform_reviewer())
        or (
          team_id is not null
          and (select public.laxhornet_can_track_roster_player(team_id, roster_player_id))
        )
      )
  ) then
    return;
  end if;

  select *
  into game_row
  from public.games
  where id = p_game_id;

  result := public.laxhornet_delete_game_durable(jsonb_build_object(
    'game_id', p_game_id,
    'account_id', actor_id,
    'deletion_id', 'legacy-' || pg_catalog.gen_random_uuid()::text,
    'device_id', 'legacy-client',
    'deleted_at', statement_timestamp(),
    'known_game_saved_at', game_row.saved_at
  ));

  if result ->> 'outcome' <> 'accepted' then
    raise exception '%', coalesce(result ->> 'code', 'Game not deleted');
  end if;
end;
$function$;

revoke execute on function public.laxhornet_sync_game(jsonb)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_delete_game_durable(jsonb)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_delete_game(text)
  from public, anon, authenticated;
grant execute on function public.laxhornet_sync_game(jsonb) to authenticated;
grant execute on function public.laxhornet_delete_game_durable(jsonb) to authenticated;
grant execute on function public.laxhornet_delete_game(text) to authenticated;

-- Direct authenticated game deletion is no longer necessary; all client deletion
-- must pass through an RPC that writes permanent evidence in the same transaction.
revoke delete on table public.games from authenticated;

commit;
