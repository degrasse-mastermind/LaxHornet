-- LaxHornet Tracked Playing Time private data foundation.
-- Additive only. Participation is deliberately separate from performance events
-- and is never joined into public Live Share or public/family export payloads.

begin;

create table public.lh_game_clock_states (
  game_id text primary key,
  owner_user_id uuid not null,
  player_id text not null,
  team_id text,
  roster_player_id text,
  scope_type text not null,
  period_format text not null,
  regulation_period_duration_seconds integer not null,
  overtime_duration_seconds integer,
  current_period text not null,
  clock_seconds_remaining integer not null,
  is_running boolean not null default false,
  started_at timestamptz,
  paused_at timestamptz,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  recovery_state text not null default 'complete',
  revision integer not null default 1,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lh_game_clock_states_scope_type_check
    check (scope_type in ('personal', 'team_roster')),
  constraint lh_game_clock_states_scope_shape_check
    check (
      (
        scope_type = 'personal'
        and team_id is null
        and roster_player_id is null
        and owner_user_id = created_by_user_id
      )
      or (
        scope_type = 'team_roster'
        and team_id is not null
        and roster_player_id is not null
      )
    ),
  constraint lh_game_clock_states_period_format_check
    check (period_format in ('quarters', 'halves')),
  constraint lh_game_clock_states_period_check
    check (
      (period_format = 'quarters' and current_period in ('Q1', 'Q2', 'Q3', 'Q4', 'OT'))
      or (period_format = 'halves' and current_period in ('H1', 'H2', 'OT'))
    ),
  constraint lh_game_clock_states_regulation_duration_check
    check (regulation_period_duration_seconds > 0),
  constraint lh_game_clock_states_overtime_duration_check
    check (overtime_duration_seconds is null or overtime_duration_seconds > 0),
  constraint lh_game_clock_states_remaining_check
    check (
      clock_seconds_remaining >= 0
      and clock_seconds_remaining <= case
        when current_period = 'OT'
          then coalesce(overtime_duration_seconds, regulation_period_duration_seconds)
        else regulation_period_duration_seconds
      end
    ),
  constraint lh_game_clock_states_recovery_check
    check (recovery_state in ('complete', 'estimated', 'needs_review')),
  constraint lh_game_clock_states_revision_check
    check (revision >= 1),
  constraint lh_game_clock_states_team_scope_fk
    foreign key (game_id, team_id, roster_player_id)
    references public.lh_game_scopes(game_id, team_id, roster_player_id)
    on delete restrict
);

create table public.lh_participation_logical_events (
  logical_event_id text primary key,
  game_id text not null references public.lh_game_clock_states(game_id) on delete restrict,
  player_id text not null,
  team_id text,
  roster_player_id text,
  scope_type text not null,
  event_kind text not null,
  current_revision integer not null default 0,
  current_operation_id text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lh_participation_logical_events_game_identity_unique
    unique (game_id, logical_event_id),
  constraint lh_participation_logical_events_scope_type_check
    check (scope_type in ('personal', 'team_roster')),
  constraint lh_participation_logical_events_scope_shape_check
    check (
      (scope_type = 'personal' and team_id is null and roster_player_id is null)
      or (scope_type = 'team_roster' and team_id is not null and roster_player_id is not null)
    ),
  constraint lh_participation_logical_events_kind_check
    check (event_kind in ('player_in', 'player_out')),
  constraint lh_participation_logical_events_revision_check
    check (current_revision >= 0)
);

create table public.lh_participation_operations (
  operation_id text primary key,
  client_operation_id text not null unique,
  game_id text not null,
  logical_event_id text not null,
  operation_kind text not null,
  effective_event_kind text,
  target_operation_id text references public.lh_participation_operations(operation_id) on delete restrict,
  revision_sequence integer not null,
  player_id text not null,
  team_id text,
  roster_player_id text,
  scope_type text not null,
  period text,
  game_clock_seconds integer,
  occurred_at timestamptz,
  client_created_at timestamptz not null,
  source text not null,
  system_close_reason text,
  recovery_uncertain boolean not null default false,
  change_reason text not null default '',
  authored_by_user_id uuid not null,
  authored_by_grant_id text references public.lh_access_grants(id) on delete restrict,
  request_hash text not null,
  created_at timestamptz not null default now(),
  constraint lh_participation_operations_logical_fk
    foreign key (game_id, logical_event_id)
    references public.lh_participation_logical_events(game_id, logical_event_id)
    on delete restrict,
  constraint lh_participation_operations_revision_unique
    unique (logical_event_id, revision_sequence),
  constraint lh_participation_operations_kind_check
    check (operation_kind in ('player_in', 'player_out', 'correct', 'tombstone')),
  constraint lh_participation_operations_effective_kind_check
    check (effective_event_kind is null or effective_event_kind in ('player_in', 'player_out')),
  constraint lh_participation_operations_scope_type_check
    check (scope_type in ('personal', 'team_roster')),
  constraint lh_participation_operations_scope_shape_check
    check (
      (scope_type = 'personal' and team_id is null and roster_player_id is null and authored_by_grant_id is null)
      or (scope_type = 'team_roster' and team_id is not null and roster_player_id is not null)
    ),
  constraint lh_participation_operations_revision_check
    check (revision_sequence >= 1),
  constraint lh_participation_operations_clock_check
    check (game_clock_seconds is null or game_clock_seconds >= 0),
  constraint lh_participation_operations_source_check
    check (source in ('live', 'manual', 'recovery', 'system_period_end', 'system_game_end')),
  constraint lh_participation_operations_close_reason_check
    check (system_close_reason is null or system_close_reason in ('period_end', 'game_end')),
  constraint lh_participation_operations_operation_shape_check
    check (
      (
        operation_kind in ('player_in', 'player_out')
        and target_operation_id is null
        and effective_event_kind = operation_kind
        and period is not null
        and game_clock_seconds is not null
        and occurred_at is not null
        and revision_sequence = 1
      )
      or (
        operation_kind = 'correct'
        and target_operation_id is not null
        and effective_event_kind in ('player_in', 'player_out')
        and period is not null
        and game_clock_seconds is not null
        and occurred_at is not null
        and revision_sequence > 1
        and length(btrim(change_reason)) > 0
      )
      or (
        operation_kind = 'tombstone'
        and target_operation_id is not null
        and effective_event_kind is null
        and period is null
        and game_clock_seconds is null
        and occurred_at is null
        and revision_sequence > 1
        and length(btrim(change_reason)) > 0
      )
    ),
  constraint lh_participation_operations_system_close_shape_check
    check (
      (
        source = 'system_period_end'
        and effective_event_kind = 'player_out'
        and system_close_reason = 'period_end'
      )
      or (
        source = 'system_game_end'
        and effective_event_kind = 'player_out'
        and system_close_reason = 'game_end'
      )
      or (
        source in ('live', 'manual', 'recovery')
        and system_close_reason is null
      )
    )
);

alter table public.lh_participation_logical_events
  add constraint lh_participation_logical_events_current_operation_fk
  foreign key (current_operation_id)
  references public.lh_participation_operations(operation_id)
  on delete restrict
  deferrable initially deferred;

create index lh_game_clock_states_owner_idx
  on public.lh_game_clock_states(owner_user_id, game_id);
create index lh_game_clock_states_team_player_idx
  on public.lh_game_clock_states(team_id, roster_player_id, game_id)
  where scope_type = 'team_roster';
create index lh_game_clock_states_team_scope_fk_idx
  on public.lh_game_clock_states(game_id, team_id, roster_player_id)
  where scope_type = 'team_roster';
create index lh_participation_logical_events_game_idx
  on public.lh_participation_logical_events(game_id, created_at, logical_event_id);
create index lh_participation_logical_events_current_operation_idx
  on public.lh_participation_logical_events(current_operation_id)
  where current_operation_id is not null;
create index lh_participation_operations_game_created_idx
  on public.lh_participation_operations(game_id, created_at, operation_id);
create index lh_participation_operations_logical_revision_idx
  on public.lh_participation_operations(logical_event_id, revision_sequence desc);
create index lh_participation_operations_game_logical_idx
  on public.lh_participation_operations(game_id, logical_event_id);
create index lh_participation_operations_target_idx
  on public.lh_participation_operations(target_operation_id)
  where target_operation_id is not null;
create index lh_participation_operations_grant_idx
  on public.lh_participation_operations(authored_by_grant_id)
  where authored_by_grant_id is not null;

create view public.lh_effective_participation_operations
with (security_invoker = true)
as
select
  operation.operation_id,
  operation.client_operation_id,
  operation.game_id,
  operation.logical_event_id,
  operation.effective_event_kind as operation_kind,
  operation.revision_sequence,
  operation.player_id,
  operation.team_id,
  operation.roster_player_id,
  operation.scope_type,
  operation.period,
  operation.game_clock_seconds,
  operation.occurred_at,
  operation.client_created_at,
  operation.source,
  operation.system_close_reason,
  operation.recovery_uncertain,
  operation.change_reason,
  operation.authored_by_user_id,
  operation.authored_by_grant_id,
  operation.created_at,
  (operation.revision_sequence > 1) as corrected
from public.lh_participation_logical_events as logical
join public.lh_participation_operations as operation
  on operation.operation_id = logical.current_operation_id
where operation.operation_kind <> 'tombstone';

comment on table public.lh_game_clock_states is
  'Private mutable game-clock configuration/state. Game-clock position, not wall time, is authoritative.';
comment on table public.lh_participation_operations is
  'Private append-only player-in/player-out history with correction and tombstone revisions.';
comment on table public.lh_participation_logical_events is
  'Stable private participation identities and concurrency-safe current revision pointers.';
comment on view public.lh_effective_participation_operations is
  'Private effective participation facts after correction and tombstone resolution.';

create or replace function lh_trust_private.lh_tracked_time_forbid_operation_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'tracked playing time participation history is append-only';
end;
$$;

create trigger lh_participation_operations_immutable
before update or delete on public.lh_participation_operations
for each row execute function lh_trust_private.lh_tracked_time_forbid_operation_mutation();

create or replace function lh_trust_private.lh_tracked_time_protect_logical_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if
    new.logical_event_id is distinct from old.logical_event_id
    or new.game_id is distinct from old.game_id
    or new.player_id is distinct from old.player_id
    or new.team_id is distinct from old.team_id
    or new.roster_player_id is distinct from old.roster_player_id
    or new.scope_type is distinct from old.scope_type
    or new.event_kind is distinct from old.event_kind
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'tracked playing time logical identity is immutable';
  end if;
  return new;
end;
$$;

create trigger lh_participation_logical_identity_immutable
before update on public.lh_participation_logical_events
for each row execute function lh_trust_private.lh_tracked_time_protect_logical_identity();

create or replace function lh_trust_private.lh_tracked_time_request_hash(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(coalesce(p_payload, '{}'::jsonb)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function lh_trust_private.lh_tracked_time_valid_period(
  p_period_format text,
  p_period text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_period_format = 'quarters' then p_period in ('Q1', 'Q2', 'Q3', 'Q4', 'OT')
    when p_period_format = 'halves' then p_period in ('H1', 'H2', 'OT')
    else false
  end;
$$;

create or replace function lh_trust_private.lh_tracked_time_clock_payload(p_game_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'gameId', clock.game_id,
    'ownerUserId', clock.owner_user_id,
    'playerId', clock.player_id,
    'teamId', clock.team_id,
    'rosterPlayerId', clock.roster_player_id,
    'scopeType', clock.scope_type,
    'periodFormat', clock.period_format,
    'regulationPeriodDurationSeconds', clock.regulation_period_duration_seconds,
    'overtimeDurationSeconds', clock.overtime_duration_seconds,
    'currentPeriod', clock.current_period,
    'clockSecondsRemaining', clock.clock_seconds_remaining,
    'isRunning', clock.is_running,
    'startedAt', clock.started_at,
    'pausedAt', clock.paused_at,
    'clientUpdatedAt', clock.client_updated_at,
    'serverUpdatedAt', clock.server_updated_at,
    'recoveryState', clock.recovery_state,
    'revision', clock.revision
  )
  from public.lh_game_clock_states as clock
  where clock.game_id = p_game_id;
$$;

create or replace function lh_trust_private.lh_tracked_time_initialize_scope(
  p_user_id uuid,
  p_game_id text
)
returns table (
  owner_user_id uuid,
  player_id text,
  team_id text,
  roster_player_id text,
  scope_type text,
  actor_grant_id text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  canonical_game public.games%rowtype;
  registration jsonb;
  mutation_grant text;
begin
  if p_user_id is null then
    return;
  end if;

  select * into canonical_game
  from public.games
  where id = p_game_id;

  if not found then
    return;
  end if;

  if canonical_game.team_id is null and canonical_game.roster_player_id is null then
    if canonical_game.user_id is distinct from p_user_id then
      return;
    end if;
    return query
    select
      canonical_game.user_id,
      coalesce(nullif(canonical_game.player_id, ''), canonical_game.id),
      null::text,
      null::text,
      'personal'::text,
      null::text;
    return;
  end if;

  if canonical_game.team_id is null or canonical_game.roster_player_id is null then
    return;
  end if;

  registration := lh_trust_private.lh_register_game_scope_impl(p_game_id);
  if registration ->> 'outcome' <> 'accepted' then
    return;
  end if;

  mutation_grant := lh_trust_private.lh_mutation_grant_for_game(p_user_id, p_game_id);
  if mutation_grant is null then
    return;
  end if;

  return query
  select
    coalesce(canonical_game.user_id, p_user_id),
    coalesce(nullif(canonical_game.player_id, ''), canonical_game.roster_player_id),
    canonical_game.team_id,
    canonical_game.roster_player_id,
    'team_roster'::text,
    mutation_grant;
end;
$$;

create or replace function lh_trust_private.lh_tracked_time_mutation_grant(
  p_user_id uuid,
  p_game_id text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when clock.scope_type = 'personal' and clock.owner_user_id = p_user_id then ''
    when clock.scope_type = 'team_roster'
      then lh_trust_private.lh_mutation_grant_for_game(p_user_id, p_game_id)
    else null
  end
  from public.lh_game_clock_states as clock
  where clock.game_id = p_game_id;
$$;

create or replace function lh_trust_private.lh_tracked_time_can_read(
  p_user_id uuid,
  p_game_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        (clock.scope_type = 'personal' and clock.owner_user_id = p_user_id)
        or (
          clock.scope_type = 'team_roster'
          and lh_trust_private.lh_export_grant_for_game(p_user_id, p_game_id) is not null
        )
      from public.lh_game_clock_states as clock
      where clock.game_id = p_game_id
    ),
    false
  );
$$;

create or replace function lh_trust_private.lh_initialize_game_clock_impl(p_clock jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := auth.uid();
  authorized_scope record;
  game_id text;
  period_format text;
  regulation_duration integer;
  overtime_duration integer;
  current_period text;
  remaining integer;
  running boolean;
  started timestamptz;
  paused timestamptz;
  client_time timestamptz;
  recovery text;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if pg_catalog.jsonb_typeof(p_clock) <> 'object'
    or not lh_trust_private.lh_jsonb_has_only_keys(
      p_clock,
      array[
        'game_id',
        'period_format',
        'regulation_period_duration_seconds',
        'overtime_duration_seconds',
        'current_period',
        'clock_seconds_remaining',
        'is_running',
        'started_at',
        'paused_at',
        'client_updated_at',
        'recovery_state'
      ]::text[]
    )
    or not p_clock ?& array[
      'game_id',
      'period_format',
      'regulation_period_duration_seconds',
      'current_period',
      'clock_seconds_remaining',
      'is_running',
      'client_updated_at',
      'recovery_state'
    ]::text[]
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  begin
    game_id := nullif(pg_catalog.btrim(p_clock ->> 'game_id'), '');
    period_format := p_clock ->> 'period_format';
    regulation_duration := (p_clock ->> 'regulation_period_duration_seconds')::integer;
    overtime_duration := nullif(p_clock ->> 'overtime_duration_seconds', '')::integer;
    current_period := p_clock ->> 'current_period';
    remaining := (p_clock ->> 'clock_seconds_remaining')::integer;
    running := (p_clock ->> 'is_running')::boolean;
    started := nullif(p_clock ->> 'started_at', '')::timestamptz;
    paused := nullif(p_clock ->> 'paused_at', '')::timestamptz;
    client_time := (p_clock ->> 'client_updated_at')::timestamptz;
    recovery := p_clock ->> 'recovery_state';
  exception when others then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end;

  if game_id is null
    or period_format not in ('quarters', 'halves')
    or regulation_duration <= 0
    or (overtime_duration is not null and overtime_duration <= 0)
    or not lh_trust_private.lh_tracked_time_valid_period(period_format, current_period)
    or remaining < 0
    or remaining > (
      case
      when current_period = 'OT' then coalesce(overtime_duration, regulation_duration)
      else regulation_duration
      end
    )
    or recovery not in ('complete', 'estimated', 'needs_review')
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  perform 1
  from public.lh_game_clock_states
  where public.lh_game_clock_states.game_id = game_id;

  if found then
    if not lh_trust_private.lh_tracked_time_can_read(actor_id, game_id) then
      return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
    end if;
    return pg_catalog.jsonb_build_object(
      'outcome', 'accepted',
      'code', 'clock_exists',
      'clockState', lh_trust_private.lh_tracked_time_clock_payload(game_id)
    );
  end if;

  select * into authorized_scope
  from lh_trust_private.lh_tracked_time_initialize_scope(actor_id, game_id);
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;

  insert into public.lh_game_clock_states(
    game_id,
    owner_user_id,
    player_id,
    team_id,
    roster_player_id,
    scope_type,
    period_format,
    regulation_period_duration_seconds,
    overtime_duration_seconds,
    current_period,
    clock_seconds_remaining,
    is_running,
    started_at,
    paused_at,
    client_updated_at,
    recovery_state,
    revision,
    created_by_user_id
  )
  values (
    game_id,
    authorized_scope.owner_user_id,
    authorized_scope.player_id,
    authorized_scope.team_id,
    authorized_scope.roster_player_id,
    authorized_scope.scope_type,
    period_format,
    regulation_duration,
    overtime_duration,
    current_period,
    remaining,
    running,
    started,
    paused,
    client_time,
    recovery,
    1,
    actor_id
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'clock_initialized',
    'clockState', lh_trust_private.lh_tracked_time_clock_payload(game_id)
  );
exception when unique_violation then
  if lh_trust_private.lh_tracked_time_can_read(actor_id, game_id) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'accepted',
      'code', 'clock_exists',
      'clockState', lh_trust_private.lh_tracked_time_clock_payload(game_id)
    );
  end if;
  return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
end;
$$;

create or replace function lh_trust_private.lh_update_game_clock_impl(p_clock jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := auth.uid();
  current_clock public.lh_game_clock_states%rowtype;
  mutation_grant text;
  game_id text;
  base_revision integer;
  current_period text;
  remaining integer;
  running boolean;
  started timestamptz;
  paused timestamptz;
  client_time timestamptz;
  recovery text;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if pg_catalog.jsonb_typeof(p_clock) <> 'object'
    or not lh_trust_private.lh_jsonb_has_only_keys(
      p_clock,
      array[
        'game_id',
        'base_revision',
        'current_period',
        'clock_seconds_remaining',
        'is_running',
        'started_at',
        'paused_at',
        'client_updated_at',
        'recovery_state'
      ]::text[]
    )
    or not p_clock ?& array[
      'game_id',
      'base_revision',
      'current_period',
      'clock_seconds_remaining',
      'is_running',
      'client_updated_at',
      'recovery_state'
    ]::text[]
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  begin
    game_id := nullif(pg_catalog.btrim(p_clock ->> 'game_id'), '');
    base_revision := (p_clock ->> 'base_revision')::integer;
    current_period := p_clock ->> 'current_period';
    remaining := (p_clock ->> 'clock_seconds_remaining')::integer;
    running := (p_clock ->> 'is_running')::boolean;
    started := nullif(p_clock ->> 'started_at', '')::timestamptz;
    paused := nullif(p_clock ->> 'paused_at', '')::timestamptz;
    client_time := (p_clock ->> 'client_updated_at')::timestamptz;
    recovery := p_clock ->> 'recovery_state';
  exception when others then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end;

  select * into current_clock
  from public.lh_game_clock_states
  where public.lh_game_clock_states.game_id = game_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;

  mutation_grant := lh_trust_private.lh_tracked_time_mutation_grant(actor_id, game_id);
  if mutation_grant is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;
  if base_revision <> current_clock.revision then
    return pg_catalog.jsonb_build_object(
      'outcome', 'conflicted',
      'code', 'stale_clock_revision',
      'serverRevision', current_clock.revision,
      'clockState', lh_trust_private.lh_tracked_time_clock_payload(game_id)
    );
  end if;
  if not lh_trust_private.lh_tracked_time_valid_period(current_clock.period_format, current_period)
    or remaining < 0
    or remaining > (
      case
      when current_period = 'OT'
        then coalesce(current_clock.overtime_duration_seconds, current_clock.regulation_period_duration_seconds)
      else current_clock.regulation_period_duration_seconds
      end
    )
    or recovery not in ('complete', 'estimated', 'needs_review')
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  update public.lh_game_clock_states
  set
    current_period = current_period,
    clock_seconds_remaining = remaining,
    is_running = running,
    started_at = started,
    paused_at = paused,
    client_updated_at = client_time,
    server_updated_at = pg_catalog.now(),
    recovery_state = recovery,
    revision = current_clock.revision + 1,
    updated_at = pg_catalog.now()
  where public.lh_game_clock_states.game_id = game_id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'clock_updated',
    'clockState', lh_trust_private.lh_tracked_time_clock_payload(game_id)
  );
end;
$$;

create or replace function lh_trust_private.lh_read_game_clock_impl(p_game_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if not lh_trust_private.lh_tracked_time_can_read(actor_id, p_game_id) then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;
  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'clock_read',
    'clockState', lh_trust_private.lh_tracked_time_clock_payload(p_game_id)
  );
end;
$$;

create or replace function lh_trust_private.lh_participation_replay(
  p_client_operation_id text,
  p_request_hash text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when operation.request_hash = p_request_hash then pg_catalog.jsonb_build_object(
      'outcome', 'accepted',
      'code', 'operation_replayed',
      'operationId', operation.operation_id,
      'clientOperationId', operation.client_operation_id,
      'logicalEventId', operation.logical_event_id,
      'revision', operation.revision_sequence
    )
    else pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'duplicate_client_operation_id'
    )
  end
  from public.lh_participation_operations as operation
  where operation.client_operation_id = p_client_operation_id;
$$;

create or replace function lh_trust_private.lh_create_participation_operation_impl(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := auth.uid();
  clock public.lh_game_clock_states%rowtype;
  mutation_grant text;
  replay jsonb;
  request_hash text;
  operation_id text;
  client_operation_id text;
  logical_event_id text;
  game_id text;
  operation_kind text;
  player_id text;
  period text;
  game_clock_seconds integer;
  occurred_at timestamptz;
  client_created_at timestamptz;
  source text;
  close_reason text;
  recovery_uncertain boolean;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if pg_catalog.jsonb_typeof(p_operation) <> 'object'
    or not lh_trust_private.lh_jsonb_has_only_keys(
      p_operation,
      array[
        'operation_id',
        'client_operation_id',
        'logical_event_id',
        'game_id',
        'operation_kind',
        'player_id',
        'period',
        'game_clock_seconds',
        'occurred_at',
        'client_created_at',
        'source',
        'system_close_reason',
        'recovery_uncertain'
      ]::text[]
    )
    or not p_operation ?& array[
      'operation_id',
      'client_operation_id',
      'logical_event_id',
      'game_id',
      'operation_kind',
      'player_id',
      'period',
      'game_clock_seconds',
      'occurred_at',
      'client_created_at',
      'source',
      'recovery_uncertain'
    ]::text[]
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  begin
    operation_id := nullif(pg_catalog.btrim(p_operation ->> 'operation_id'), '');
    client_operation_id := nullif(pg_catalog.btrim(p_operation ->> 'client_operation_id'), '');
    logical_event_id := nullif(pg_catalog.btrim(p_operation ->> 'logical_event_id'), '');
    game_id := nullif(pg_catalog.btrim(p_operation ->> 'game_id'), '');
    operation_kind := p_operation ->> 'operation_kind';
    player_id := nullif(pg_catalog.btrim(p_operation ->> 'player_id'), '');
    period := p_operation ->> 'period';
    game_clock_seconds := (p_operation ->> 'game_clock_seconds')::integer;
    occurred_at := (p_operation ->> 'occurred_at')::timestamptz;
    client_created_at := (p_operation ->> 'client_created_at')::timestamptz;
    source := p_operation ->> 'source';
    close_reason := nullif(p_operation ->> 'system_close_reason', '');
    recovery_uncertain := (p_operation ->> 'recovery_uncertain')::boolean;
  exception when others then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end;

  request_hash := lh_trust_private.lh_tracked_time_request_hash(p_operation);
  replay := lh_trust_private.lh_participation_replay(client_operation_id, request_hash);
  if replay is not null then
    return replay;
  end if;

  select * into clock
  from public.lh_game_clock_states
  where public.lh_game_clock_states.game_id = game_id;
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;
  mutation_grant := lh_trust_private.lh_tracked_time_mutation_grant(actor_id, game_id);
  if mutation_grant is null or player_id is distinct from clock.player_id then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;
  if operation_id is null
    or client_operation_id is null
    or logical_event_id is null
    or operation_kind not in ('player_in', 'player_out')
    or not lh_trust_private.lh_tracked_time_valid_period(clock.period_format, period)
    or game_clock_seconds < 0
    or game_clock_seconds > (
      case
      when period = 'OT' then coalesce(clock.overtime_duration_seconds, clock.regulation_period_duration_seconds)
      else clock.regulation_period_duration_seconds
      end
    )
    or source not in ('live', 'manual', 'recovery', 'system_period_end', 'system_game_end')
    or (
      source = 'system_period_end'
      and (operation_kind <> 'player_out' or close_reason is distinct from 'period_end')
    )
    or (
      source = 'system_game_end'
      and (operation_kind <> 'player_out' or close_reason is distinct from 'game_end')
    )
    or (
      source in ('live', 'manual', 'recovery')
      and close_reason is not null
    )
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  insert into public.lh_participation_logical_events(
    logical_event_id,
    game_id,
    player_id,
    team_id,
    roster_player_id,
    scope_type,
    event_kind,
    current_revision,
    created_by_user_id
  )
  values (
    logical_event_id,
    game_id,
    clock.player_id,
    clock.team_id,
    clock.roster_player_id,
    clock.scope_type,
    operation_kind,
    0,
    actor_id
  )
  on conflict on constraint lh_participation_logical_events_pkey do nothing;
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'logical_event_exists');
  end if;

  insert into public.lh_participation_operations(
    operation_id,
    client_operation_id,
    game_id,
    logical_event_id,
    operation_kind,
    effective_event_kind,
    revision_sequence,
    player_id,
    team_id,
    roster_player_id,
    scope_type,
    period,
    game_clock_seconds,
    occurred_at,
    client_created_at,
    source,
    system_close_reason,
    recovery_uncertain,
    authored_by_user_id,
    authored_by_grant_id,
    request_hash
  )
  values (
    operation_id,
    client_operation_id,
    game_id,
    logical_event_id,
    operation_kind,
    operation_kind,
    1,
    clock.player_id,
    clock.team_id,
    clock.roster_player_id,
    clock.scope_type,
    period,
    game_clock_seconds,
    occurred_at,
    client_created_at,
    source,
    close_reason,
    recovery_uncertain,
    actor_id,
    nullif(mutation_grant, ''),
    request_hash
  );

  update public.lh_participation_logical_events
  set
    current_revision = 1,
    current_operation_id = operation_id,
    updated_at = pg_catalog.now()
  where public.lh_participation_logical_events.logical_event_id = logical_event_id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'participation_operation_created',
    'operationId', operation_id,
    'clientOperationId', client_operation_id,
    'logicalEventId', logical_event_id,
    'revision', 1
  );
exception when unique_violation then
  replay := lh_trust_private.lh_participation_replay(client_operation_id, request_hash);
  return coalesce(
    replay,
    pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_identity')
  );
end;
$$;

create or replace function lh_trust_private.lh_correct_participation_operation_impl(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := auth.uid();
  logical public.lh_participation_logical_events%rowtype;
  current_operation public.lh_participation_operations%rowtype;
  clock public.lh_game_clock_states%rowtype;
  mutation_grant text;
  replay jsonb;
  request_hash text;
  operation_id text;
  client_operation_id text;
  logical_event_id text;
  target_operation_id text;
  game_id text;
  period text;
  game_clock_seconds integer;
  occurred_at timestamptz;
  client_created_at timestamptz;
  source text;
  recovery_uncertain boolean;
  change_reason text;
  next_revision integer;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if pg_catalog.jsonb_typeof(p_operation) <> 'object'
    or not lh_trust_private.lh_jsonb_has_only_keys(
      p_operation,
      array[
        'operation_id',
        'client_operation_id',
        'logical_event_id',
        'target_operation_id',
        'game_id',
        'operation_kind',
        'period',
        'game_clock_seconds',
        'occurred_at',
        'client_created_at',
        'source',
        'recovery_uncertain',
        'change_reason'
      ]::text[]
    )
    or not p_operation ?& array[
      'operation_id',
      'client_operation_id',
      'logical_event_id',
      'target_operation_id',
      'game_id',
      'operation_kind',
      'period',
      'game_clock_seconds',
      'occurred_at',
      'client_created_at',
      'source',
      'recovery_uncertain',
      'change_reason'
    ]::text[]
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  begin
    operation_id := nullif(pg_catalog.btrim(p_operation ->> 'operation_id'), '');
    client_operation_id := nullif(pg_catalog.btrim(p_operation ->> 'client_operation_id'), '');
    logical_event_id := nullif(pg_catalog.btrim(p_operation ->> 'logical_event_id'), '');
    target_operation_id := nullif(pg_catalog.btrim(p_operation ->> 'target_operation_id'), '');
    game_id := nullif(pg_catalog.btrim(p_operation ->> 'game_id'), '');
    period := p_operation ->> 'period';
    game_clock_seconds := (p_operation ->> 'game_clock_seconds')::integer;
    occurred_at := (p_operation ->> 'occurred_at')::timestamptz;
    client_created_at := (p_operation ->> 'client_created_at')::timestamptz;
    source := p_operation ->> 'source';
    recovery_uncertain := (p_operation ->> 'recovery_uncertain')::boolean;
    change_reason := pg_catalog.btrim(p_operation ->> 'change_reason');
  exception when others then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end;

  if p_operation ->> 'operation_kind' <> 'correct' then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;
  request_hash := lh_trust_private.lh_tracked_time_request_hash(p_operation);
  replay := lh_trust_private.lh_participation_replay(client_operation_id, request_hash);
  if replay is not null then
    return replay;
  end if;

  select * into logical
  from public.lh_participation_logical_events
  where public.lh_participation_logical_events.logical_event_id = logical_event_id
    and public.lh_participation_logical_events.game_id = game_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;

  mutation_grant := lh_trust_private.lh_tracked_time_mutation_grant(actor_id, game_id);
  if mutation_grant is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;
  if target_operation_id is distinct from logical.current_operation_id then
    return pg_catalog.jsonb_build_object(
      'outcome', 'conflicted',
      'code', 'stale_participation_revision',
      'currentOperationId', logical.current_operation_id,
      'currentRevision', logical.current_revision
    );
  end if;

  select * into current_operation
  from public.lh_participation_operations
  where public.lh_participation_operations.operation_id = logical.current_operation_id;
  if current_operation.operation_kind = 'tombstone' then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'participation_event_tombstoned');
  end if;
  select * into clock
  from public.lh_game_clock_states
  where public.lh_game_clock_states.game_id = game_id;

  if operation_id is null
    or client_operation_id is null
    or target_operation_id is null
    or length(change_reason) = 0
    or source not in ('manual', 'recovery')
    or not lh_trust_private.lh_tracked_time_valid_period(clock.period_format, period)
    or game_clock_seconds < 0
    or game_clock_seconds > (
      case
      when period = 'OT' then coalesce(clock.overtime_duration_seconds, clock.regulation_period_duration_seconds)
      else clock.regulation_period_duration_seconds
      end
    )
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  next_revision := logical.current_revision + 1;
  insert into public.lh_participation_operations(
    operation_id,
    client_operation_id,
    game_id,
    logical_event_id,
    operation_kind,
    effective_event_kind,
    target_operation_id,
    revision_sequence,
    player_id,
    team_id,
    roster_player_id,
    scope_type,
    period,
    game_clock_seconds,
    occurred_at,
    client_created_at,
    source,
    recovery_uncertain,
    change_reason,
    authored_by_user_id,
    authored_by_grant_id,
    request_hash
  )
  values (
    operation_id,
    client_operation_id,
    game_id,
    logical_event_id,
    'correct',
    logical.event_kind,
    target_operation_id,
    next_revision,
    logical.player_id,
    logical.team_id,
    logical.roster_player_id,
    logical.scope_type,
    period,
    game_clock_seconds,
    occurred_at,
    client_created_at,
    source,
    recovery_uncertain,
    change_reason,
    actor_id,
    nullif(mutation_grant, ''),
    request_hash
  );

  update public.lh_participation_logical_events
  set
    current_revision = next_revision,
    current_operation_id = operation_id,
    updated_at = pg_catalog.now()
  where public.lh_participation_logical_events.logical_event_id = logical_event_id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'participation_operation_corrected',
    'operationId', operation_id,
    'clientOperationId', client_operation_id,
    'logicalEventId', logical_event_id,
    'revision', next_revision
  );
exception when unique_violation then
  replay := lh_trust_private.lh_participation_replay(client_operation_id, request_hash);
  return coalesce(
    replay,
    pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_identity')
  );
end;
$$;

create or replace function lh_trust_private.lh_tombstone_participation_operation_impl(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_id uuid := auth.uid();
  logical public.lh_participation_logical_events%rowtype;
  current_operation public.lh_participation_operations%rowtype;
  mutation_grant text;
  replay jsonb;
  request_hash text;
  operation_id text;
  client_operation_id text;
  logical_event_id text;
  target_operation_id text;
  game_id text;
  client_created_at timestamptz;
  source text;
  recovery_uncertain boolean;
  change_reason text;
  next_revision integer;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if pg_catalog.jsonb_typeof(p_operation) <> 'object'
    or not lh_trust_private.lh_jsonb_has_only_keys(
      p_operation,
      array[
        'operation_id',
        'client_operation_id',
        'logical_event_id',
        'target_operation_id',
        'game_id',
        'operation_kind',
        'client_created_at',
        'source',
        'recovery_uncertain',
        'change_reason'
      ]::text[]
    )
    or not p_operation ?& array[
      'operation_id',
      'client_operation_id',
      'logical_event_id',
      'target_operation_id',
      'game_id',
      'operation_kind',
      'client_created_at',
      'source',
      'recovery_uncertain',
      'change_reason'
    ]::text[]
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  begin
    operation_id := nullif(pg_catalog.btrim(p_operation ->> 'operation_id'), '');
    client_operation_id := nullif(pg_catalog.btrim(p_operation ->> 'client_operation_id'), '');
    logical_event_id := nullif(pg_catalog.btrim(p_operation ->> 'logical_event_id'), '');
    target_operation_id := nullif(pg_catalog.btrim(p_operation ->> 'target_operation_id'), '');
    game_id := nullif(pg_catalog.btrim(p_operation ->> 'game_id'), '');
    client_created_at := (p_operation ->> 'client_created_at')::timestamptz;
    source := p_operation ->> 'source';
    recovery_uncertain := (p_operation ->> 'recovery_uncertain')::boolean;
    change_reason := pg_catalog.btrim(p_operation ->> 'change_reason');
  exception when others then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end;

  if p_operation ->> 'operation_kind' <> 'tombstone' then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;
  request_hash := lh_trust_private.lh_tracked_time_request_hash(p_operation);
  replay := lh_trust_private.lh_participation_replay(client_operation_id, request_hash);
  if replay is not null then
    return replay;
  end if;

  select * into logical
  from public.lh_participation_logical_events
  where public.lh_participation_logical_events.logical_event_id = logical_event_id
    and public.lh_participation_logical_events.game_id = game_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;

  mutation_grant := lh_trust_private.lh_tracked_time_mutation_grant(actor_id, game_id);
  if mutation_grant is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;
  if target_operation_id is distinct from logical.current_operation_id then
    return pg_catalog.jsonb_build_object(
      'outcome', 'conflicted',
      'code', 'stale_participation_revision',
      'currentOperationId', logical.current_operation_id,
      'currentRevision', logical.current_revision
    );
  end if;
  select * into current_operation
  from public.lh_participation_operations
  where public.lh_participation_operations.operation_id = logical.current_operation_id;
  if current_operation.operation_kind = 'tombstone' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'accepted',
      'code', 'participation_event_already_tombstoned',
      'logicalEventId', logical_event_id,
      'revision', logical.current_revision
    );
  end if;
  if operation_id is null
    or client_operation_id is null
    or target_operation_id is null
    or length(change_reason) = 0
    or source not in ('manual', 'recovery')
  then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  next_revision := logical.current_revision + 1;
  insert into public.lh_participation_operations(
    operation_id,
    client_operation_id,
    game_id,
    logical_event_id,
    operation_kind,
    effective_event_kind,
    target_operation_id,
    revision_sequence,
    player_id,
    team_id,
    roster_player_id,
    scope_type,
    client_created_at,
    source,
    recovery_uncertain,
    change_reason,
    authored_by_user_id,
    authored_by_grant_id,
    request_hash
  )
  values (
    operation_id,
    client_operation_id,
    game_id,
    logical_event_id,
    'tombstone',
    null,
    target_operation_id,
    next_revision,
    logical.player_id,
    logical.team_id,
    logical.roster_player_id,
    logical.scope_type,
    client_created_at,
    source,
    recovery_uncertain,
    change_reason,
    actor_id,
    nullif(mutation_grant, ''),
    request_hash
  );

  update public.lh_participation_logical_events
  set
    current_revision = next_revision,
    current_operation_id = operation_id,
    updated_at = pg_catalog.now()
  where public.lh_participation_logical_events.logical_event_id = logical_event_id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'participation_operation_tombstoned',
    'operationId', operation_id,
    'clientOperationId', client_operation_id,
    'logicalEventId', logical_event_id,
    'revision', next_revision
  );
exception when unique_violation then
  replay := lh_trust_private.lh_participation_replay(client_operation_id, request_hash);
  return coalesce(
    replay,
    pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_identity')
  );
end;
$$;

create or replace function lh_trust_private.lh_list_effective_participation_impl(p_game_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  operations jsonb;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if not lh_trust_private.lh_tracked_time_can_read(actor_id, p_game_id) then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'operationId', effective.operation_id,
        'clientOperationId', effective.client_operation_id,
        'gameId', effective.game_id,
        'logicalEventId', effective.logical_event_id,
        'operationKind', effective.operation_kind,
        'revision', effective.revision_sequence,
        'playerId', effective.player_id,
        'teamId', effective.team_id,
        'rosterPlayerId', effective.roster_player_id,
        'scopeType', effective.scope_type,
        'period', effective.period,
        'gameClockSeconds', effective.game_clock_seconds,
        'occurredAt', effective.occurred_at,
        'clientCreatedAt', effective.client_created_at,
        'source', effective.source,
        'systemCloseReason', effective.system_close_reason,
        'recoveryUncertain', effective.recovery_uncertain,
        'changeReason', effective.change_reason,
        'corrected', effective.corrected
      )
      order by effective.period, effective.game_clock_seconds desc, effective.logical_event_id
    ),
    '[]'::jsonb
  )
  into operations
  from public.lh_effective_participation_operations as effective
  where effective.game_id = p_game_id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'effective_participation_listed',
    'operations', operations
  );
end;
$$;

create or replace function lh_trust_private.lh_reconcile_participation_operations_impl(
  p_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation jsonb;
  result jsonb;
  results jsonb := '[]'::jsonb;
  kind text;
begin
  if auth.uid() is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;
  if pg_catalog.jsonb_typeof(p_operations) <> 'array' then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input');
  end if;

  for operation in
    select value from pg_catalog.jsonb_array_elements(p_operations)
  loop
    kind := operation ->> 'operation_kind';
    result := case
      when kind in ('player_in', 'player_out')
        then lh_trust_private.lh_create_participation_operation_impl(operation)
      when kind = 'correct'
        then lh_trust_private.lh_correct_participation_operation_impl(operation)
      when kind = 'tombstone'
        then lh_trust_private.lh_tombstone_participation_operation_impl(operation)
      else pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_input')
    end;
    results := results || pg_catalog.jsonb_build_array(result);
  end loop;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'participation_reconciled',
    'results', results
  );
end;
$$;

create or replace function public.lh_initialize_game_clock(p_clock jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_initialize_game_clock_impl(p_clock);
$$;

create or replace function public.lh_update_game_clock(p_clock jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_update_game_clock_impl(p_clock);
$$;

create or replace function public.lh_reconcile_game_clock(p_clock jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_update_game_clock_impl(p_clock);
$$;

create or replace function public.lh_read_game_clock(p_game_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_read_game_clock_impl(p_game_id);
$$;

create or replace function public.lh_create_participation_operation(p_operation jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_create_participation_operation_impl(p_operation);
$$;

create or replace function public.lh_correct_participation_operation(p_operation jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_correct_participation_operation_impl(p_operation);
$$;

create or replace function public.lh_tombstone_participation_operation(p_operation jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_tombstone_participation_operation_impl(p_operation);
$$;

create or replace function public.lh_list_effective_participation(p_game_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_list_effective_participation_impl(p_game_id);
$$;

create or replace function public.lh_reconcile_participation_operations(p_operations jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_reconcile_participation_operations_impl(p_operations);
$$;

alter table public.lh_game_clock_states enable row level security;
alter table public.lh_game_clock_states force row level security;
alter table public.lh_participation_logical_events enable row level security;
alter table public.lh_participation_logical_events force row level security;
alter table public.lh_participation_operations enable row level security;
alter table public.lh_participation_operations force row level security;

revoke all on table public.lh_game_clock_states from public, anon, authenticated;
revoke all on table public.lh_participation_logical_events from public, anon, authenticated;
revoke all on table public.lh_participation_operations from public, anon, authenticated;
revoke all on table public.lh_effective_participation_operations from public, anon, authenticated;

revoke all on all functions in schema lh_trust_private from public, anon, authenticated;
revoke all on schema lh_trust_private from public, anon, authenticated;

alter function public.lh_initialize_game_clock(jsonb) owner to postgres;
alter function public.lh_update_game_clock(jsonb) owner to postgres;
alter function public.lh_reconcile_game_clock(jsonb) owner to postgres;
alter function public.lh_read_game_clock(text) owner to postgres;
alter function public.lh_create_participation_operation(jsonb) owner to postgres;
alter function public.lh_correct_participation_operation(jsonb) owner to postgres;
alter function public.lh_tombstone_participation_operation(jsonb) owner to postgres;
alter function public.lh_list_effective_participation(text) owner to postgres;
alter function public.lh_reconcile_participation_operations(jsonb) owner to postgres;

revoke execute on function public.lh_initialize_game_clock(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_update_game_clock(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_reconcile_game_clock(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_read_game_clock(text) from public, anon, authenticated;
revoke execute on function public.lh_create_participation_operation(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_correct_participation_operation(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_tombstone_participation_operation(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_list_effective_participation(text) from public, anon, authenticated;
revoke execute on function public.lh_reconcile_participation_operations(jsonb) from public, anon, authenticated;

grant execute on function public.lh_initialize_game_clock(jsonb) to authenticated;
grant execute on function public.lh_update_game_clock(jsonb) to authenticated;
grant execute on function public.lh_reconcile_game_clock(jsonb) to authenticated;
grant execute on function public.lh_read_game_clock(text) to authenticated;
grant execute on function public.lh_create_participation_operation(jsonb) to authenticated;
grant execute on function public.lh_correct_participation_operation(jsonb) to authenticated;
grant execute on function public.lh_tombstone_participation_operation(jsonb) to authenticated;
grant execute on function public.lh_list_effective_participation(text) to authenticated;
grant execute on function public.lh_reconcile_participation_operations(jsonb) to authenticated;

commit;
