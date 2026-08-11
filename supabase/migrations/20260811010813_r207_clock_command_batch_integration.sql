-- R2-07 clock command and atomic offline-batch integration.
-- Default-off: the public bridges execute only while the existing isolated
-- Preview/test control is explicitly enabled. Production v1 writes, release
-- markers, and capability defaults remain unchanged.

begin;

alter table public.game_sync_operations
  drop constraint game_sync_operations_type_r207_check,
  add constraint game_sync_operations_type_r207_check check (operation_type in (
    'metadata_patch', 'score_delta', 'score_correction', 'status_transition',
    'roster_context_patch', 'sharing_patch', 'clock_initialize', 'clock_start',
    'clock_pause', 'clock_resume', 'clock_persist_position',
    'clock_advance_period', 'clock_set_remaining', 'clock_correct_remaining',
    'clock_complete', 'clock_batch', 'conflict_resolution'
  ));

alter table public.game_clock_commands
  drop constraint game_clock_commands_command_check,
  drop constraint game_clock_commands_base_clock_version_check,
  add column device_id text,
  add column client_occurred_at timestamptz,
  add column current_period text,
  add constraint game_clock_commands_command_check check (command in (
    'initialize', 'start', 'pause', 'resume', 'persist_position',
    'advance_period', 'set_remaining', 'correct_remaining', 'complete'
  )),
  add constraint game_clock_commands_base_clock_version_check
    check (base_clock_version >= 0),
  add constraint game_clock_commands_device_r207clock_check check (
    device_id is null or length(btrim(device_id)) between 1 and 200
  ),
  add constraint game_clock_commands_period_r207clock_check check (
    current_period is null or current_period in ('Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'OT')
  );

create table public.game_clock_batches (
  clock_batch_id uuid primary key default gen_random_uuid(),
  batch_operation_id uuid not null unique
    references public.game_sync_operations(operation_id) on delete restrict,
  actor_user_id uuid not null,
  client_batch_id text not null,
  game_id text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  base_clock_version bigint not null check (base_clock_version >= 1),
  command_count integer not null check (command_count between 1 and 32),
  result_clock_version bigint not null check (result_clock_version >= base_clock_version),
  recorded_at timestamptz not null default statement_timestamp(),
  constraint game_clock_batches_actor_client_r207clock_key
    unique (actor_user_id, client_batch_id),
  constraint game_clock_batches_client_id_r207clock_check
    check (length(btrim(client_batch_id)) between 1 and 200),
  constraint game_clock_batches_game_id_r207clock_check
    check (length(btrim(game_id)) between 1 and 200)
);

create index game_clock_batches_game_r207clock_idx
  on public.game_clock_batches(game_id, recorded_at desc);

create trigger game_clock_batches_append_only_r207clock
before update or delete on public.game_clock_batches
for each row execute function lh_sync_private.r207_forbid_history_mutation();

alter table public.game_clock_batches enable row level security;
alter table public.game_clock_batches force row level security;
revoke all on table public.game_clock_batches from public, anon, authenticated;

create or replace function lh_sync_private.r207_conflict_values_valid(
  p_field_group text,
  p_values jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select jsonb_typeof(p_values) = 'object'
    and pg_column_size(p_values) <= 4096
    and case p_field_group
      when 'metadata' then
        p_values - array['game_date', 'game_type', 'location', 'opponent']::text[] = '{}'::jsonb
        and not exists (
          select 1 from jsonb_each(p_values) as item(key, value)
          where jsonb_typeof(item.value) <> 'string'
            or length(item.value #>> '{}') > 160
            or (item.key = 'game_date' and item.value #>> '{}' !~ '^\d{4}-\d{2}-\d{2}$')
        )
      when 'score' then
        p_values - array['score_against', 'score_for']::text[] = '{}'::jsonb
        and not exists (
          select 1 from jsonb_each(p_values) as item(key, value)
          where jsonb_typeof(item.value) <> 'number'
            or item.value #>> '{}' !~ '^\d{1,4}$'
        )
      when 'status' then
        p_values - array['lifecycle_state']::text[] = '{}'::jsonb
        and not exists (
          select 1 from jsonb_each(p_values) as item(key, value)
          where jsonb_typeof(item.value) <> 'string'
            or item.value #>> '{}' not in ('active', 'paused', 'completed')
        )
      when 'roster_context' then
        p_values - array['player_id']::text[] = '{}'::jsonb
        and not exists (
          select 1 from jsonb_each(p_values) as item(key, value)
          where jsonb_typeof(item.value) not in ('string', 'null')
            or (jsonb_typeof(item.value) = 'string'
              and length(btrim(item.value #>> '{}')) not between 1 and 200)
        )
      when 'sharing' then
        p_values - array['is_shared']::text[] = '{}'::jsonb
        and not exists (
          select 1 from jsonb_each(p_values) as item(key, value)
          where jsonb_typeof(item.value) <> 'boolean'
        )
      when 'clock' then
        p_values - array['clock_seconds_remaining', 'command', 'is_running']::text[] = '{}'::jsonb
        and not exists (
          select 1 from jsonb_each(p_values) as item(key, value)
          where (item.key = 'clock_seconds_remaining' and (
              jsonb_typeof(item.value) <> 'number'
              or item.value #>> '{}' !~ '^\d{1,6}$'
            ))
            or (item.key = 'command' and (
              jsonb_typeof(item.value) <> 'string'
              or item.value #>> '{}' not in (
                'initialize', 'start', 'pause', 'resume', 'persist_position',
                'advance_period', 'set_remaining', 'correct_remaining', 'complete'
              )
            ))
            or (item.key = 'is_running' and jsonb_typeof(item.value) <> 'boolean')
        )
      else false
    end;
$function$;

create or replace function lh_sync_private.r207_clock_current_remaining(
  p_clock public.lh_game_clock_states,
  p_anchor_at timestamptz
)
returns integer
language sql
stable
set search_path = ''
as $function$
  select case
    when not p_clock.is_running then p_clock.clock_seconds_remaining
    else greatest(
      0,
      coalesce(p_clock.anchor_clock_seconds_remaining, p_clock.clock_seconds_remaining)
      - greatest(
          0,
          floor(extract(epoch from (
            p_anchor_at - coalesce(p_clock.anchor_server_at, p_clock.server_updated_at)
          )))::integer
        )
    )
  end;
$function$;

create or replace function lh_sync_private.r207_clock_payload(
  p_game_id text,
  p_anchor_at timestamptz default statement_timestamp()
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'game_id', clock.game_id,
    'period_format', clock.period_format,
    'regulation_period_duration_seconds', clock.regulation_period_duration_seconds,
    'overtime_duration_seconds', clock.overtime_duration_seconds,
    'current_period', clock.current_period,
    'clock_seconds_remaining', lh_sync_private.r207_clock_current_remaining(clock, p_anchor_at),
    'is_running', clock.is_running
      and lh_sync_private.r207_clock_current_remaining(clock, p_anchor_at) > 0,
    'started_at', clock.started_at,
    'paused_at', clock.paused_at,
    'client_updated_at', clock.client_updated_at,
    'server_updated_at', clock.server_updated_at,
    'recovery_state', clock.recovery_state,
    'clock_version', clock.revision,
    'anchor_server_at', clock.anchor_server_at,
    'anchor_clock_seconds_remaining', clock.anchor_clock_seconds_remaining
  )
  from public.lh_game_clock_states as clock
  where clock.game_id = p_game_id;
$function$;

create or replace function lh_sync_private.r207_clock_request_hash(p_request jsonb)
returns text
language sql
immutable
set search_path = ''
as $function$
  select encode(
    extensions.digest(
      pg_catalog.convert_to((p_request - 'request_hash')::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$function$;

create or replace function lh_sync_private.r207_clock_operation_shape_valid(
  p_operation jsonb,
  p_allow_initialize boolean default true
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select jsonb_typeof(p_operation) = 'object'
    and pg_column_size(p_operation) <= 8192
    and p_operation - array[
      'arguments', 'base_clock_version', 'client_occurred_at',
      'client_operation_id', 'command', 'device_id', 'expected_lifecycle',
      'game_id', 'status_base_version'
    ]::text[] = '{}'::jsonb
    and p_operation ?& array[
      'arguments', 'base_clock_version', 'client_occurred_at',
      'client_operation_id', 'command', 'device_id', 'expected_lifecycle',
      'game_id', 'status_base_version'
    ]::text[]
    and jsonb_typeof(p_operation -> 'arguments') = 'object'
    and length(btrim(p_operation ->> 'client_operation_id')) between 1 and 200
    and length(btrim(p_operation ->> 'device_id')) between 1 and 200
    and length(btrim(p_operation ->> 'game_id')) between 1 and 200
    and p_operation ->> 'expected_lifecycle' in ('active', 'paused', 'completed')
    and p_operation ->> 'command' in (
      case when p_allow_initialize then 'initialize' else 'start' end,
      'start', 'pause', 'resume', 'persist_position', 'advance_period',
      'set_remaining', 'correct_remaining', 'complete'
    );
$function$;

create or replace function lh_sync_private.r207_clock_command_locked(
  p_actor_id uuid,
  p_operation jsonb,
  p_request_hash text,
  p_batch_id text default null,
  p_batch_sequence integer default null,
  p_fail_after_mutation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  client_id text := btrim(p_operation ->> 'client_operation_id');
  device_id_value text := btrim(p_operation ->> 'device_id');
  target_game_id text := btrim(p_operation ->> 'game_id');
  command_name text := p_operation ->> 'command';
  expected_lifecycle text := p_operation ->> 'expected_lifecycle';
  arguments jsonb := p_operation -> 'arguments';
  client_time timestamptz;
  base_version bigint;
  status_base bigint;
  target_game public.games%rowtype;
  target_clock public.lh_game_clock_states%rowtype;
  authorized_scope record;
  operation_uuid uuid := gen_random_uuid();
  conflict_uuid uuid;
  anchor_at timestamptz := statement_timestamp();
  remaining integer;
  next_remaining integer;
  next_period text;
  maximum_remaining integer;
  next_lifecycle text;
  result jsonb;
  result_versions jsonb;
  operation_type text;
begin
  begin
    base_version := (p_operation ->> 'base_clock_version')::bigint;
    status_base := (p_operation ->> 'status_base_version')::bigint;
    client_time := (p_operation ->> 'client_occurred_at')::timestamptz;
  exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
  end;
  if base_version is null or base_version < 0 or status_base is null or status_base < 1 then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
  end if;

  select game_row.* into target_game
  from public.games as game_row
  where game_row.id = target_game_id
  for update;
  if not found or not lh_sync_private.r207_current_authority(p_actor_id, target_game) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  if target_game.lifecycle_state <> expected_lifecycle then
    return jsonb_build_object('outcome', 'rejected', 'code', 'stale_lifecycle_state');
  end if;
  if target_game.status_version <> status_base then
    return jsonb_build_object('outcome', 'rejected', 'code', 'stale_status_version');
  end if;
  if target_game.lifecycle_state = 'completed' then
    return jsonb_build_object('outcome', 'rejected', 'code', 'completed_game_clock_change_forbidden');
  end if;

  if command_name = 'initialize' then
    if base_version <> 0 or arguments - array[
      'clock_seconds_remaining', 'current_period', 'overtime_duration_seconds',
      'period_format', 'regulation_period_duration_seconds'
    ]::text[] <> '{}'::jsonb
      or not arguments ?& array[
        'clock_seconds_remaining', 'current_period', 'period_format',
        'regulation_period_duration_seconds'
      ]::text[]
    then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
    end if;
    select clock_row.* into target_clock
    from public.lh_game_clock_states as clock_row
    where clock_row.game_id = target_game_id
    for update;
    if found then
      return jsonb_build_object('outcome', 'rejected', 'code', 'clock_already_initialized');
    end if;
    begin
      next_remaining := (arguments ->> 'clock_seconds_remaining')::integer;
      next_period := arguments ->> 'current_period';
      maximum_remaining := (arguments ->> 'regulation_period_duration_seconds')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
    end;
    if arguments ->> 'period_format' not in ('quarters', 'halves')
      or maximum_remaining <= 0
      or next_remaining < 0
      or not lh_trust_private.lh_tracked_time_valid_period(arguments ->> 'period_format', next_period)
    then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
    end if;
    if next_period = 'OT' then
      begin
        maximum_remaining := coalesce(
          nullif(arguments ->> 'overtime_duration_seconds', '')::integer,
          maximum_remaining
        );
      exception when invalid_text_representation or numeric_value_out_of_range then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
      end;
    end if;
    if next_remaining > maximum_remaining then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
    end if;
    select * into authorized_scope
    from lh_trust_private.lh_tracked_time_initialize_scope(p_actor_id, target_game_id);
    if not found then
      return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
    end if;
    insert into public.lh_game_clock_states(
      game_id, owner_user_id, player_id, team_id, roster_player_id, scope_type,
      period_format, regulation_period_duration_seconds, overtime_duration_seconds,
      current_period, clock_seconds_remaining, is_running, started_at, paused_at,
      client_updated_at, server_updated_at, recovery_state, revision,
      created_by_user_id, anchor_server_at, anchor_clock_seconds_remaining
    ) values (
      target_game_id, authorized_scope.owner_user_id, authorized_scope.player_id,
      authorized_scope.team_id, authorized_scope.roster_player_id,
      authorized_scope.scope_type, arguments ->> 'period_format',
      (arguments ->> 'regulation_period_duration_seconds')::integer,
      nullif(arguments ->> 'overtime_duration_seconds', '')::integer,
      next_period, next_remaining, false, null, anchor_at,
      client_time, anchor_at, 'complete', 1, p_actor_id, anchor_at, next_remaining
    ) returning * into target_clock;
  else
    if base_version < 1 then
      return jsonb_build_object('outcome', 'rejected', 'code', 'missing_base_clock_version');
    end if;
    select clock_row.* into target_clock
    from public.lh_game_clock_states as clock_row
    where clock_row.game_id = target_game_id
    for update;
    if not found then
      return jsonb_build_object('outcome', 'rejected', 'code', 'clock_not_initialized');
    end if;
    if base_version > target_clock.revision then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_base_clock_version');
    end if;
    if base_version <> target_clock.revision then
      conflict_uuid := gen_random_uuid();
      result := jsonb_build_object(
        'outcome', 'conflicted', 'code', 'clock_conflict',
        'conflict_id', conflict_uuid, 'clock_version', target_clock.revision,
        'replay', false
      );
      insert into public.game_sync_operations(
        operation_id, actor_user_id, client_operation_id, game_id, operation_type,
        request_hash, changed_fields, outcome_class, outcome_code, conflict_id,
        result_versions, canonical_result, client_created_at
      ) values (
        operation_uuid, p_actor_id, client_id, target_game_id,
        'clock_' || command_name, p_request_hash, array['clock'], 'conflicted',
        'clock_conflict', conflict_uuid,
        jsonb_build_object('clock', target_clock.revision), result, client_time
      );
      insert into public.game_conflicts(
        conflict_id, account_id, game_id, team_id, roster_player_id, actor_user_id,
        operation_id, conflict_type, field_group, client_base_version,
        current_server_version, overlapping_fields, current_values,
        proposed_values, audit_metadata
      ) values (
        conflict_uuid, target_game.user_id, target_game_id, target_game.team_id,
        target_game.roster_player_id, p_actor_id, operation_uuid, 'clock_stale',
        'clock', base_version, target_clock.revision, array['clock'],
        jsonb_build_object(
          'clock_seconds_remaining', lh_sync_private.r207_clock_current_remaining(target_clock, anchor_at),
          'is_running', target_clock.is_running
        ),
        jsonb_strip_nulls(jsonb_build_object(
          'command', command_name,
          'clock_seconds_remaining', case when command_name in ('set_remaining', 'correct_remaining')
            then arguments -> 'clock_seconds_remaining' else null end
        )),
        jsonb_build_object('protocol', 'r207-clock-v2')
      );
      return result;
    end if;

    remaining := lh_sync_private.r207_clock_current_remaining(target_clock, anchor_at);
    next_remaining := remaining;
    next_period := target_clock.current_period;
    next_lifecycle := target_game.lifecycle_state;
    if command_name in ('start', 'pause', 'resume', 'persist_position', 'complete')
      and arguments <> '{}'::jsonb
    then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_arguments');
    elsif command_name in ('set_remaining', 'correct_remaining') then
      if arguments - 'clock_seconds_remaining' <> '{}'::jsonb
        or not arguments ? 'clock_seconds_remaining'
      then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_arguments');
      end if;
      begin
        next_remaining := (arguments ->> 'clock_seconds_remaining')::integer;
      exception when invalid_text_representation or numeric_value_out_of_range then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_arguments');
      end;
    elsif command_name = 'advance_period' then
      if arguments - 'next_period' <> '{}'::jsonb or not arguments ? 'next_period' then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_arguments');
      end if;
      next_period := arguments ->> 'next_period';
    else
      if command_name = 'initialize' or command_name not in (
        'start', 'pause', 'resume', 'persist_position', 'advance_period',
        'set_remaining', 'correct_remaining', 'complete'
      ) then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_command');
      end if;
    end if;

    maximum_remaining := case when next_period = 'OT'
      then coalesce(target_clock.overtime_duration_seconds, target_clock.regulation_period_duration_seconds)
      else target_clock.regulation_period_duration_seconds end;
    if next_remaining < 0 or next_remaining > maximum_remaining then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_arguments');
    end if;

    if command_name = 'start' then
      if target_game.lifecycle_state <> 'active' or target_clock.is_running or remaining = 0 then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_transition');
      end if;
    elsif command_name = 'pause' then
      if target_game.lifecycle_state <> 'active' or not target_clock.is_running then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_transition');
      end if;
      next_lifecycle := 'paused';
    elsif command_name = 'resume' then
      if target_game.lifecycle_state <> 'paused' or target_clock.is_running or remaining = 0 then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_transition');
      end if;
      next_lifecycle := 'active';
    elsif command_name = 'advance_period' then
      if not (
        (target_clock.period_format = 'quarters' and (
          (target_clock.current_period = 'Q1' and next_period = 'Q2')
          or (target_clock.current_period = 'Q2' and next_period = 'Q3')
          or (target_clock.current_period = 'Q3' and next_period = 'Q4')
          or (target_clock.current_period = 'Q4' and next_period = 'OT'
            and target_clock.overtime_duration_seconds is not null)
        ))
        or (target_clock.period_format = 'halves' and (
          (target_clock.current_period = 'H1' and next_period = 'H2')
          or (target_clock.current_period = 'H2' and next_period = 'OT'
            and target_clock.overtime_duration_seconds is not null)
        ))
      ) then
        return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_period_transition');
      end if;
      next_remaining := case when next_period = 'OT'
        then target_clock.overtime_duration_seconds
        else target_clock.regulation_period_duration_seconds end;
      next_lifecycle := 'paused';
    elsif command_name = 'complete' then
      next_lifecycle := 'completed';
    end if;

    update public.lh_game_clock_states as clock_row set
      current_period = next_period,
      clock_seconds_remaining = next_remaining,
      is_running = case
        when command_name in ('start', 'resume') then true
        when command_name in ('pause', 'advance_period', 'complete') then false
        else clock_row.is_running and next_remaining > 0
      end,
      started_at = case
        when command_name in ('start', 'resume') then coalesce(clock_row.started_at, anchor_at)
        when command_name = 'advance_period' then null
        else clock_row.started_at
      end,
      paused_at = case
        when command_name in ('start', 'resume') then null
        when command_name in ('pause', 'advance_period', 'complete') then anchor_at
        else clock_row.paused_at
      end,
      client_updated_at = client_time,
      server_updated_at = anchor_at,
      recovery_state = 'complete',
      revision = clock_row.revision + 1,
      updated_at = anchor_at,
      anchor_server_at = anchor_at,
      anchor_clock_seconds_remaining = next_remaining
    where clock_row.game_id = target_game_id
    returning clock_row.* into target_clock;

    if next_lifecycle <> target_game.lifecycle_state then
      update public.games as game_row set
        lifecycle_state = next_lifecycle,
        status = case when next_lifecycle = 'completed' then 'complete' else 'in-progress' end,
        final_score_for = case when next_lifecycle = 'completed' and game_row.score_known
          then game_row.score_for else game_row.final_score_for end,
        final_score_against = case when next_lifecycle = 'completed' and game_row.score_known
          then game_row.score_against else game_row.final_score_against end,
        status_version = game_row.status_version + 1,
        game_revision = game_row.game_revision + 1,
        saved_at = anchor_at
      where game_row.id = target_game_id
      returning game_row.* into target_game;
    end if;
  end if;

  if p_fail_after_mutation then
    raise exception using errcode = 'P0001', message = 'r207_clock_injected_atomicity_failure';
  end if;

  operation_type := 'clock_' || command_name;
  result_versions := jsonb_build_object(
    'clock', target_clock.revision,
    'status', target_game.status_version
  );
  result := jsonb_build_object(
    'outcome', 'accepted',
    'code', 'clock_command_accepted',
    'client_operation_id', client_id,
    'clock_version', target_clock.revision,
    'status_version', target_game.status_version,
    'lifecycle_state', target_game.lifecycle_state,
    'clock_state', lh_sync_private.r207_clock_payload(target_game_id, anchor_at),
    'replay', false
  );
  insert into public.game_sync_operations(
    operation_id, actor_user_id, client_operation_id, game_id, operation_type,
    request_hash, changed_fields, outcome_class, outcome_code, result_versions,
    canonical_result, client_created_at
  ) values (
    operation_uuid, p_actor_id, client_id, target_game_id, operation_type,
    p_request_hash, array['clock'], 'accepted', 'clock_command_accepted',
    result_versions, result, client_time
  );
  insert into public.game_clock_commands(
    operation_id, game_id, batch_id, batch_sequence, command,
    base_clock_version, result_clock_version, clock_seconds_remaining,
    device_id, client_occurred_at, current_period
  ) values (
    operation_uuid, target_game_id, p_batch_id, p_batch_sequence, command_name,
    base_version, target_clock.revision,
    case when command_name in ('initialize', 'set_remaining', 'correct_remaining',
      'persist_position', 'pause', 'advance_period', 'complete')
      then target_clock.clock_seconds_remaining else null end,
    device_id_value, client_time, target_clock.current_period
  );
  return result;
end;
$function$;

create or replace function lh_sync_private.r207_apply_clock_operation(
  p_operation jsonb,
  p_fail_after_mutation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  client_id text;
  target_game_id text;
  request_hash text;
  target_game public.games%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
  stored_operation public.game_sync_operations%rowtype;
  result jsonb;
begin
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  if not lh_sync_private.r207_clock_operation_shape_valid(p_operation, true) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
  end if;
  client_id := btrim(p_operation ->> 'client_operation_id');
  target_game_id := btrim(p_operation ->> 'game_id');
  request_hash := lh_sync_private.r207_clock_request_hash(p_operation);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'laxhornet:r207-operation:' || actor_id::text || ':' || client_id, 0
  ));
  perform 1 from public.game_sync_operations
  where actor_user_id = actor_id and client_operation_id = client_id;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('laxhornet:legacy-game:' || target_game_id, 0)
  );

  select tombstone_row.* into tombstone
  from public.legacy_game_tombstones as tombstone_row
  where tombstone_row.game_id = target_game_id;
  if found then
    if lh_sync_private.r207_tombstone_authority(actor_id, tombstone) then
      return jsonb_build_object('outcome', 'deleted', 'code', 'game_deleted');
    end if;
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  select game_row.* into target_game
  from public.games as game_row
  where game_row.id = target_game_id
  for update;
  if not found or not lh_sync_private.r207_current_authority(actor_id, target_game) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select operation_row.* into stored_operation
  from public.game_sync_operations as operation_row
  where operation_row.actor_user_id = actor_id
    and operation_row.client_operation_id = client_id;
  if found then
    if stored_operation.game_id <> target_game_id then
      insert into public.game_sync_operation_attempts(
        actor_user_id, client_operation_id, canonical_operation_id, attempt_code
      ) values (
        actor_id, client_id, stored_operation.operation_id,
        'duplicate_operation_id_scope_mismatch'
      );
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'duplicate_operation_id_scope_mismatch'
      );
    elsif stored_operation.request_hash <> request_hash then
      insert into public.game_sync_operation_attempts(
        actor_user_id, client_operation_id, canonical_operation_id, attempt_code
      ) values (
        actor_id, client_id, stored_operation.operation_id,
        'duplicate_operation_id_payload_mismatch'
      );
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'duplicate_operation_id_payload_mismatch'
      );
    end if;
    insert into public.game_sync_operation_attempts(
      actor_user_id, client_operation_id, canonical_operation_id, attempt_code
    ) values (actor_id, client_id, stored_operation.operation_id, 'idempotent_replay');
    return stored_operation.canonical_result || jsonb_build_object('replay', true);
  end if;

  result := lh_sync_private.r207_clock_command_locked(
    actor_id, p_operation, request_hash, null, null, p_fail_after_mutation
  );
  return result;
end;
$function$;

create or replace function lh_sync_private.r207_apply_clock_batch(
  p_batch jsonb,
  p_fail_after_mutation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  batch_client_id text;
  target_game_id text;
  expected_lifecycle text;
  batch_hash text;
  base_version bigint;
  status_base bigint;
  command_count integer;
  identity text;
  command_item jsonb;
  command_operation jsonb;
  command_hash text;
  command_index integer := 0;
  current_clock_version bigint;
  current_status_version bigint;
  target_game public.games%rowtype;
  target_clock public.lh_game_clock_states%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
  stored_batch public.game_sync_operations%rowtype;
  stored_command public.game_sync_operations%rowtype;
  batch_operation_uuid uuid := gen_random_uuid();
  conflict_uuid uuid;
  result jsonb;
  command_result jsonb;
  receipts jsonb := '[]'::jsonb;
  failed_result jsonb;
  anchor_at timestamptz := statement_timestamp();
begin
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  if jsonb_typeof(p_batch) <> 'object'
    or pg_column_size(p_batch) > 65536
    or p_batch - array[
      'base_clock_version', 'client_batch_id', 'commands', 'expected_lifecycle',
      'game_id', 'status_base_version'
    ]::text[] <> '{}'::jsonb
    or not p_batch ?& array[
      'base_clock_version', 'client_batch_id', 'commands', 'expected_lifecycle',
      'game_id', 'status_base_version'
    ]::text[]
    or jsonb_typeof(p_batch -> 'commands') <> 'array'
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_batch');
  end if;
  batch_client_id := btrim(p_batch ->> 'client_batch_id');
  target_game_id := btrim(p_batch ->> 'game_id');
  expected_lifecycle := p_batch ->> 'expected_lifecycle';
  command_count := jsonb_array_length(p_batch -> 'commands');
  begin
    base_version := (p_batch ->> 'base_clock_version')::bigint;
    status_base := (p_batch ->> 'status_base_version')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_batch');
  end;
  if length(batch_client_id) not between 1 and 200
    or length(target_game_id) not between 1 and 200
    or expected_lifecycle not in ('active', 'paused')
    or base_version < 1 or status_base < 1
    or command_count not between 1 and 32
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_batch');
  end if;

  create temporary table if not exists pg_temp.r207_clock_batch_identities(
    identity text primary key
  ) on commit drop;
  truncate table pg_temp.r207_clock_batch_identities;
  insert into pg_temp.r207_clock_batch_identities(identity) values (batch_client_id);
  for command_item in select value from jsonb_array_elements(p_batch -> 'commands') loop
    if not lh_sync_private.r207_clock_operation_shape_valid(
      command_item || jsonb_build_object(
        'game_id', target_game_id,
        'base_clock_version', base_version,
        'status_base_version', status_base
      ),
      false
    ) then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_batch');
    end if;
    if command_item ->> 'command' = 'initialize' then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_batch');
    end if;
    begin
      insert into pg_temp.r207_clock_batch_identities(identity)
      values (btrim(command_item ->> 'client_operation_id'));
    exception when unique_violation then
      return jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_clock_batch_operation_id');
    end;
  end loop;
  batch_hash := lh_sync_private.r207_clock_request_hash(p_batch);

  for identity in select item.identity from pg_temp.r207_clock_batch_identities as item order by item.identity loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'laxhornet:r207-operation:' || actor_id::text || ':' || identity, 0
    ));
  end loop;
  perform 1 from public.game_sync_operations
  where actor_user_id = actor_id
    and client_operation_id in (
      select item.identity from pg_temp.r207_clock_batch_identities as item
    );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('laxhornet:legacy-game:' || target_game_id, 0)
  );

  select tombstone_row.* into tombstone
  from public.legacy_game_tombstones as tombstone_row
  where tombstone_row.game_id = target_game_id;
  if found then
    if lh_sync_private.r207_tombstone_authority(actor_id, tombstone) then
      return jsonb_build_object('outcome', 'deleted', 'code', 'game_deleted');
    end if;
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  select game_row.* into target_game
  from public.games as game_row
  where game_row.id = target_game_id
  for update;
  if not found or not lh_sync_private.r207_current_authority(actor_id, target_game) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select operation_row.* into stored_batch
  from public.game_sync_operations as operation_row
  where operation_row.actor_user_id = actor_id
    and operation_row.client_operation_id = batch_client_id;
  if found then
    if stored_batch.game_id <> target_game_id then
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'duplicate_operation_id_scope_mismatch'
      );
    elsif stored_batch.request_hash <> batch_hash
      or stored_batch.operation_type <> 'clock_batch'
    then
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'duplicate_operation_id_payload_mismatch'
      );
    end if;
    insert into public.game_sync_operation_attempts(
      actor_user_id, client_operation_id, canonical_operation_id, attempt_code
    ) values (actor_id, batch_client_id, stored_batch.operation_id, 'idempotent_replay');
    return stored_batch.canonical_result || jsonb_build_object('replay', true);
  end if;

  for command_item in select value from jsonb_array_elements(p_batch -> 'commands') loop
    select operation_row.* into stored_command
    from public.game_sync_operations as operation_row
    where operation_row.actor_user_id = actor_id
      and operation_row.client_operation_id = btrim(command_item ->> 'client_operation_id');
    if found then
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'clock_batch_partial_replay_mismatch'
      );
    end if;
  end loop;

  if target_game.lifecycle_state <> expected_lifecycle then
    return jsonb_build_object('outcome', 'rejected', 'code', 'stale_lifecycle_state');
  end if;
  if target_game.status_version <> status_base then
    return jsonb_build_object('outcome', 'rejected', 'code', 'stale_status_version');
  end if;
  select clock_row.* into target_clock
  from public.lh_game_clock_states as clock_row
  where clock_row.game_id = target_game_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'rejected', 'code', 'clock_not_initialized');
  end if;
  if base_version > target_clock.revision then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_base_clock_version');
  end if;
  if base_version <> target_clock.revision then
    conflict_uuid := gen_random_uuid();
    result := jsonb_build_object(
      'outcome', 'conflicted', 'code', 'clock_conflict',
      'conflict_id', conflict_uuid, 'clock_version', target_clock.revision,
      'receipts', '[]'::jsonb, 'replay', false
    );
    insert into public.game_sync_operations(
      operation_id, actor_user_id, client_operation_id, game_id, operation_type,
      request_hash, changed_fields, outcome_class, outcome_code, conflict_id,
      result_versions, canonical_result
    ) values (
      batch_operation_uuid, actor_id, batch_client_id, target_game_id,
      'clock_batch', batch_hash, array['clock'], 'conflicted', 'clock_conflict',
      conflict_uuid, jsonb_build_object('clock', target_clock.revision), result
    );
    insert into public.game_conflicts(
      conflict_id, account_id, game_id, team_id, roster_player_id, actor_user_id,
      operation_id, conflict_type, field_group, client_base_version,
      current_server_version, overlapping_fields, current_values,
      proposed_values, audit_metadata
    ) values (
      conflict_uuid, target_game.user_id, target_game_id, target_game.team_id,
      target_game.roster_player_id, actor_id, batch_operation_uuid,
      'clock_stale', 'clock', base_version, target_clock.revision, array['clock'],
      jsonb_build_object(
        'clock_seconds_remaining', lh_sync_private.r207_clock_current_remaining(target_clock, anchor_at),
        'is_running', target_clock.is_running
      ),
      jsonb_build_object('command', p_batch -> 'commands' -> 0 ->> 'command'),
      jsonb_build_object('protocol', 'r207-clock-batch-v2')
    );
    insert into public.game_clock_batches(
      batch_operation_id, actor_user_id, client_batch_id, game_id, request_hash,
      base_clock_version, command_count, result_clock_version
    ) values (
      batch_operation_uuid, actor_id, batch_client_id, target_game_id,
      batch_hash, base_version, command_count, target_clock.revision
    );
    return result;
  end if;

  begin
    current_clock_version := target_clock.revision;
    current_status_version := target_game.status_version;
    command_index := 0;
    for command_item in select value from jsonb_array_elements(p_batch -> 'commands') loop
      command_index := command_index + 1;
      command_operation := command_item || jsonb_build_object(
        'game_id', target_game_id,
        'base_clock_version', current_clock_version,
        'status_base_version', current_status_version
      );
      command_hash := lh_sync_private.r207_clock_request_hash(
        command_item || jsonb_build_object(
          'batch_id', batch_client_id,
          'batch_sequence', command_index,
          'game_id', target_game_id,
          'batch_base_clock_version', base_version
        )
      );
      command_result := lh_sync_private.r207_clock_command_locked(
        actor_id, command_operation, command_hash, batch_client_id,
        command_index, p_fail_after_mutation and command_index = command_count
      );
      if command_result ->> 'outcome' <> 'accepted' then
        failed_result := command_result;
        raise exception using errcode = 'P0002', message = 'r207_clock_batch_atomic_rejection';
      end if;
      current_clock_version := (command_result ->> 'clock_version')::bigint;
      current_status_version := (command_result ->> 'status_version')::bigint;
      receipts := receipts || jsonb_build_array(jsonb_build_object(
        'client_operation_id', command_result ->> 'client_operation_id',
        'clock_version', current_clock_version,
        'status_version', current_status_version,
        'code', command_result ->> 'code'
      ));
    end loop;

    result := jsonb_build_object(
      'outcome', 'accepted', 'code', 'clock_batch_accepted',
      'client_batch_id', batch_client_id,
      'clock_version', current_clock_version,
      'status_version', current_status_version,
      'lifecycle_state', (
        select game_row.lifecycle_state from public.games as game_row
        where game_row.id = target_game_id
      ),
      'clock_state', lh_sync_private.r207_clock_payload(target_game_id, statement_timestamp()),
      'receipts', receipts, 'replay', false
    );
    insert into public.game_sync_operations(
      operation_id, actor_user_id, client_operation_id, game_id, operation_type,
      request_hash, changed_fields, outcome_class, outcome_code, result_versions,
      canonical_result
    ) values (
      batch_operation_uuid, actor_id, batch_client_id, target_game_id,
      'clock_batch', batch_hash, array['clock'], 'accepted',
      'clock_batch_accepted', jsonb_build_object(
        'clock', current_clock_version, 'status', current_status_version
      ), result
    );
    insert into public.game_clock_batches(
      batch_operation_id, actor_user_id, client_batch_id, game_id, request_hash,
      base_clock_version, command_count, result_clock_version
    ) values (
      batch_operation_uuid, actor_id, batch_client_id, target_game_id,
      batch_hash, base_version, command_count, current_clock_version
    );
  exception when sqlstate 'P0002' then
    return failed_result || jsonb_build_object('batch_atomic', true, 'receipts', '[]'::jsonb);
  end;
  return result;
end;
$function$;

create or replace function public.lh_apply_game_clock_operation_v2(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not coalesce((
    select control.preview_enabled
    from public.r207_preview_control as control
    where control.control_id
  ), false) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
  end if;
  return lh_sync_private.r207_apply_clock_operation(p_operation, false);
end;
$function$;

create or replace function public.lh_apply_game_clock_batch_v2(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not coalesce((
    select control.preview_enabled
    from public.r207_preview_control as control
    where control.control_id
  ), false) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
  end if;
  return lh_sync_private.r207_apply_clock_batch(p_batch, false);
end;
$function$;

revoke execute on function lh_sync_private.r207_clock_current_remaining(
  public.lh_game_clock_states, timestamptz
) from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_clock_payload(text, timestamptz)
  from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_clock_request_hash(jsonb)
  from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_clock_operation_shape_valid(jsonb, boolean)
  from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_clock_command_locked(
  uuid, jsonb, text, text, integer, boolean
) from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_apply_clock_operation(jsonb, boolean)
  from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_apply_clock_batch(jsonb, boolean)
  from public, anon, authenticated;
revoke execute on function public.lh_apply_game_clock_operation_v2(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_apply_game_clock_batch_v2(jsonb)
  from public, anon, authenticated;
grant execute on function public.lh_apply_game_clock_operation_v2(jsonb)
  to authenticated;
grant execute on function public.lh_apply_game_clock_batch_v2(jsonb)
  to authenticated;

comment on table public.game_clock_batches is
  'R2-07 private immutable atomic clock-batch receipt. No app-role table access.';
comment on function public.lh_apply_game_clock_operation_v2(jsonb) is
  'Default-off R2-07 server-anchored clock command bridge for isolated Preview/test only.';
comment on function public.lh_apply_game_clock_batch_v2(jsonb) is
  'Default-off R2-07 atomic ordered clock batch bridge for isolated Preview/test only.';

commit;
