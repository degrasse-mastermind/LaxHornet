-- LH-25: additive atomic scored-event command.
--
-- The browser persists scored events locally before cloud work. This migration
-- gives the activated R2-07 path one authenticated operation identity and one
-- PostgreSQL transaction for the versioned event head plus its score effect.

begin;

create table public.atomic_scored_event_operations (
  operation_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  client_operation_id text not null,
  game_id text not null,
  event_id text not null,
  action text not null check (action in ('create', 'correct', 'tombstone')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  base_event_version bigint not null check (base_event_version >= 0),
  base_score_version bigint not null check (base_score_version >= 1),
  base_status_version bigint not null check (base_status_version >= 1),
  expected_game_lifecycle text not null
    check (expected_game_lifecycle in ('active', 'paused', 'completed')),
  score_for_delta integer not null default 0,
  score_against_delta integer not null default 0,
  event_client_operation_id text not null,
  score_client_operation_id text,
  outcome_class text not null
    check (outcome_class in ('accepted', 'merged', 'conflicted', 'deleted', 'rejected')),
  outcome_code text not null,
  result_event_version bigint,
  result_score_version bigint,
  canonical_result jsonb not null
    check (jsonb_typeof(canonical_result) = 'object' and pg_column_size(canonical_result) <= 16384),
  client_created_at timestamptz,
  server_received_at timestamptz not null default statement_timestamp(),
  unique (actor_user_id, client_operation_id)
);

create index atomic_scored_event_operations_game_event_idx
  on public.atomic_scored_event_operations(game_id, event_id, server_received_at desc);

create table public.atomic_scored_event_operation_attempts (
  attempt_id bigint generated always as identity primary key,
  canonical_operation_id uuid not null
    references public.atomic_scored_event_operations(operation_id) on delete restrict,
  actor_user_id uuid not null,
  client_operation_id text not null,
  attempt_code text not null check (attempt_code in (
    'idempotent_replay',
    'duplicate_operation_id_payload_mismatch',
    'duplicate_operation_id_scope_mismatch'
  )),
  received_at timestamptz not null default statement_timestamp()
);

create trigger atomic_scored_event_operations_append_only
before update or delete on public.atomic_scored_event_operations
for each row execute function lh_sync_private.r207_forbid_history_mutation();

create trigger atomic_scored_event_operation_attempts_append_only
before update or delete on public.atomic_scored_event_operation_attempts
for each row execute function lh_sync_private.r207_forbid_history_mutation();

alter table public.atomic_scored_event_operations enable row level security;
alter table public.atomic_scored_event_operations force row level security;
alter table public.atomic_scored_event_operation_attempts enable row level security;
alter table public.atomic_scored_event_operation_attempts force row level security;

revoke all on table public.atomic_scored_event_operations
  from public, anon, authenticated;
revoke all on table public.atomic_scored_event_operation_attempts
  from public, anon, authenticated;

create or replace function lh_sync_private.r207_scoring_effect(p_stat_type text)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $function$
  select case coalesce(p_stat_type, '')
    when 'goal' then jsonb_build_object('score_for', 1, 'score_against', 0)
    when 'assist' then jsonb_build_object('score_for', 1, 'score_against', 0)
    when 'goalAllowed' then jsonb_build_object('score_for', 0, 'score_against', 1)
    else jsonb_build_object('score_for', 0, 'score_against', 0)
  end;
$function$;

create or replace function lh_sync_private.r207_atomic_result_class(p_result jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $function$
  select case coalesce(p_result ->> 'outcome', '')
    when 'accepted' then 'accepted'
    when 'merged' then 'merged'
    when 'conflicted' then 'conflicted'
    when 'deleted' then 'deleted'
    else 'rejected'
  end;
$function$;

create or replace function lh_sync_private.r207_apply_atomic_scored_event(
  p_operation jsonb,
  p_fail_after_event boolean default false,
  p_fail_after_score boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
<<atomic_scored_event>>
declare
  actor_id uuid := (select auth.uid());
  client_id text := btrim(coalesce(p_operation ->> 'client_operation_id', ''));
  target_game_id text := btrim(coalesce(p_operation ->> 'game_id', ''));
  target_event_id text := btrim(coalesce(p_operation ->> 'event_id', ''));
  action_name text := btrim(coalesce(p_operation ->> 'action', ''));
  expected_lifecycle text := btrim(coalesce(p_operation ->> 'expected_game_lifecycle', ''));
  changes jsonb := coalesce(p_operation -> 'changes', '{}'::jsonb);
  base_event_version bigint;
  base_score_version bigint;
  base_status_version bigint;
  client_time timestamptz;
  request_hash text;
  event_client_id text;
  score_client_id text;
  event_operation jsonb;
  score_operation jsonb;
  event_result jsonb;
  score_result jsonb;
  result jsonb;
  failure_detail text;
  failure_state text;
  old_effect jsonb := jsonb_build_object('score_for', 0, 'score_against', 0);
  new_effect jsonb := jsonb_build_object('score_for', 0, 'score_against', 0);
  score_for_delta integer := 0;
  score_against_delta integer := 0;
  prior_stat_type text := '';
  next_stat_type text := '';
  operation_uuid uuid := gen_random_uuid();
  stored_operation public.atomic_scored_event_operations%rowtype;
  target_game public.games%rowtype;
  target_event public.events%rowtype;
  game_tombstone public.legacy_game_tombstones%rowtype;
  outcome_class text;
  outcome_code text;
  result_event_version bigint;
  result_score_version bigint;
begin
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;

  begin
    base_event_version := (p_operation ->> 'base_event_version')::bigint;
    base_score_version := (p_operation ->> 'base_score_version')::bigint;
    base_status_version := (p_operation ->> 'base_status_version')::bigint;
    client_time := nullif(p_operation ->> 'client_created_at', '')::timestamptz;
  exception when invalid_text_representation or numeric_value_out_of_range
    or datetime_field_overflow then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
  end;

  if client_id = '' or length(client_id) > 160
    or target_game_id = '' or length(target_game_id) > 200
    or target_event_id = '' or length(target_event_id) > 200
    or action_name not in ('create', 'correct', 'tombstone')
    or expected_lifecycle not in ('active', 'paused', 'completed')
    or base_event_version is null or base_event_version < 0
    or base_score_version is null or base_score_version < 1
    or base_status_version is null or base_status_version < 1
    or jsonb_typeof(changes) <> 'object'
    or pg_column_size(changes) > 8192
    or exists (
      select 1 from jsonb_object_keys(p_operation) as key
      where key <> all(array[
        'client_operation_id', 'game_id', 'event_id', 'action', 'changes',
        'base_event_version', 'base_score_version', 'base_status_version',
        'expected_game_lifecycle', 'client_created_at'
      ])
    )
    or (action_name = 'create' and base_event_version <> 0)
    or (action_name in ('correct', 'tombstone') and base_event_version < 1)
    or (action_name = 'tombstone' and changes <> '{}'::jsonb)
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
  end if;

  request_hash := encode(extensions.digest(
    convert_to(p_operation::text, 'UTF8'), 'sha256'
  ), 'hex');
  event_client_id := client_id || ':event';
  score_client_id := client_id || ':score';

  -- Lock every operation identity before the requested game key. The child
  -- RPCs take the same locks reentrantly, preserving the R2-07 lock order.
  perform pg_advisory_xact_lock(hashtextextended(
    'laxhornet:r207-atomic-scored-event:' || actor_id::text || ':' || client_id, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'laxhornet:r207-event-operation:' || actor_id::text || ':' || event_client_id, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'laxhornet:r207-operation:' || actor_id::text || ':' || score_client_id, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'laxhornet:legacy-game:' || target_game_id, 0
  ));

  select tombstone_row.* into game_tombstone
  from public.legacy_game_tombstones as tombstone_row
  where tombstone_row.game_id = target_game_id;
  if found then
    if lh_sync_private.r207_tombstone_authority(actor_id, game_tombstone) then
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
  from public.atomic_scored_event_operations as operation_row
  where operation_row.actor_user_id = actor_id
    and operation_row.client_operation_id = client_id;
  if found then
    if stored_operation.game_id <> target_game_id
      or stored_operation.event_id <> target_event_id
      or stored_operation.action <> action_name
    then
      insert into public.atomic_scored_event_operation_attempts(
        canonical_operation_id, actor_user_id, client_operation_id, attempt_code
      ) values (
        stored_operation.operation_id, actor_id, client_id,
        'duplicate_operation_id_scope_mismatch'
      );
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'duplicate_operation_id_scope_mismatch'
      );
    end if;
    if stored_operation.request_hash <> request_hash then
      insert into public.atomic_scored_event_operation_attempts(
        canonical_operation_id, actor_user_id, client_operation_id, attempt_code
      ) values (
        stored_operation.operation_id, actor_id, client_id,
        'duplicate_operation_id_payload_mismatch'
      );
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'duplicate_operation_id_payload_mismatch'
      );
    end if;
    insert into public.atomic_scored_event_operation_attempts(
      canonical_operation_id, actor_user_id, client_operation_id, attempt_code
    ) values (
      stored_operation.operation_id, actor_id, client_id, 'idempotent_replay'
    );
    return stored_operation.canonical_result || jsonb_build_object('replay', true);
  end if;

  if target_game.lifecycle_state <> expected_lifecycle then
    result := jsonb_build_object(
      'outcome', 'conflicted', 'code', 'lifecycle_conflict',
      'versions', lh_sync_private.r207_game_versions(target_game)
    );
  elsif target_game.status_version <> base_status_version then
    result := jsonb_build_object(
      'outcome', 'conflicted', 'code', 'stale_status_version',
      'versions', lh_sync_private.r207_game_versions(target_game)
    );
  elsif target_game.score_version <> base_score_version then
    result := jsonb_build_object(
      'outcome', 'conflicted', 'code', 'stale_score_version',
      'versions', lh_sync_private.r207_game_versions(target_game)
    );
  end if;

  if result is not null then
    outcome_class := 'conflicted';
    outcome_code := result ->> 'code';
    insert into public.atomic_scored_event_operations(
      operation_id, actor_user_id, client_operation_id, game_id, event_id,
      action, request_hash, base_event_version, base_score_version,
      base_status_version, expected_game_lifecycle, event_client_operation_id,
      outcome_class, outcome_code, canonical_result, client_created_at
    ) values (
      operation_uuid, actor_id, client_id, target_game_id, target_event_id,
      action_name, request_hash, base_event_version, base_score_version,
      base_status_version, expected_lifecycle, event_client_id,
      outcome_class, outcome_code, result, client_time
    );
    return result;
  end if;

  if action_name in ('correct', 'tombstone') then
    select event_row.* into target_event
    from public.events as event_row
    where event_row.id = target_event_id and event_row.game_id = target_game_id
    for update;
    if not found then
      result := jsonb_build_object('outcome', 'rejected', 'code', 'event_not_found');
    else
      prior_stat_type := target_event.stat_type;
    end if;
  end if;

  if result is null then
    next_stat_type := case
      when action_name = 'create' then coalesce(changes ->> 'stat_type', '')
      when action_name = 'correct' then coalesce(changes ->> 'stat_type', prior_stat_type)
      else ''
    end;
    old_effect := lh_sync_private.r207_scoring_effect(prior_stat_type);
    new_effect := lh_sync_private.r207_scoring_effect(next_stat_type);
    score_for_delta := (new_effect ->> 'score_for')::integer
      - (old_effect ->> 'score_for')::integer;
    score_against_delta := (new_effect ->> 'score_against')::integer
      - (old_effect ->> 'score_against')::integer;

    if action_name = 'create' and score_for_delta = 0 and score_against_delta = 0 then
      result := jsonb_build_object('outcome', 'rejected', 'code', 'non_scoring_event');
    elsif action_name in ('correct', 'tombstone')
      and (old_effect ->> 'score_for')::integer = 0
      and (old_effect ->> 'score_against')::integer = 0
      and (new_effect ->> 'score_for')::integer = 0
      and (new_effect ->> 'score_against')::integer = 0
    then
      result := jsonb_build_object('outcome', 'rejected', 'code', 'non_scoring_event');
    elsif target_game.score_for + score_for_delta < 0
      or target_game.score_against + score_against_delta < 0
    then
      result := jsonb_build_object('outcome', 'rejected', 'code', 'invalid_score_effect');
    end if;
  end if;

  if result is not null then
    outcome_class := lh_sync_private.r207_atomic_result_class(result);
    outcome_code := result ->> 'code';
    insert into public.atomic_scored_event_operations(
      operation_id, actor_user_id, client_operation_id, game_id, event_id,
      action, request_hash, base_event_version, base_score_version,
      base_status_version, expected_game_lifecycle, score_for_delta,
      score_against_delta, event_client_operation_id, outcome_class,
      outcome_code, canonical_result, client_created_at
    ) values (
      operation_uuid, actor_id, client_id, target_game_id, target_event_id,
      action_name, request_hash, base_event_version, base_score_version,
      base_status_version, expected_lifecycle, score_for_delta,
      score_against_delta, event_client_id, outcome_class,
      outcome_code, result, client_time
    );
    return result;
  end if;

  event_operation := jsonb_build_object(
    'client_operation_id', event_client_id,
    'game_id', target_game_id,
    'event_id', target_event_id,
    'operation_type', action_name,
    'base_event_version', base_event_version,
    'expected_game_lifecycle', expected_lifecycle,
    'changes', changes,
    'client_created_at', client_time
  );

  if score_for_delta <> 0 or score_against_delta <> 0 then
    score_operation := jsonb_build_object(
      'client_operation_id', score_client_id,
      'game_id', target_game_id,
      'operation_type', case when expected_lifecycle = 'completed'
        then 'score_correction' else 'score_delta' end,
      'field_group', 'score',
      'base_version', base_score_version,
      'changed_fields', case
        when expected_lifecycle = 'completed'
          then jsonb_build_array('score_against', 'score_for')
        when score_for_delta <> 0 and score_against_delta <> 0
          then jsonb_build_array('score_against', 'score_for')
        when score_against_delta <> 0 then jsonb_build_array('score_against')
        else jsonb_build_array('score_for')
      end,
      'changes', case when expected_lifecycle = 'completed'
        then jsonb_strip_nulls(jsonb_build_object(
          'score_for', target_game.score_for + score_for_delta,
          'score_against', target_game.score_against + score_against_delta
        ))
        else jsonb_strip_nulls(jsonb_build_object(
          'score_for_delta', case when score_for_delta <> 0 then score_for_delta end,
          'score_against_delta', case when score_against_delta <> 0 then score_against_delta end
        ))
      end,
      'expected_lifecycle', expected_lifecycle,
      'status_base_version', base_status_version,
      'client_created_at', client_time
    );
    if expected_lifecycle = 'completed' then
      score_operation := score_operation || jsonb_build_object(
        'correction_reason', 'data_entry_correction'
      );
    end if;
    score_operation := score_operation || jsonb_build_object(
      'request_hash', encode(extensions.digest(
        convert_to(score_operation::text, 'UTF8'), 'sha256'
      ), 'hex')
    );
  end if;

  -- A handled exception rolls back both child RPCs to this subtransaction
  -- boundary. Only the parent rejection receipt is written afterward.
  begin
    event_result := public.laxhornet_sync_event_v2(event_operation);
    if coalesce(event_result ->> 'outcome', '') not in ('accepted', 'merged') then
      raise exception using errcode = 'P0001',
        message = 'atomic_scored_event_child_rejected',
        detail = jsonb_build_object('stage', 'event', 'child_result', event_result)::text;
    end if;
    if p_fail_after_event then
      raise exception using errcode = 'P0001',
        message = 'atomic_scored_event_injected_failure',
        detail = jsonb_build_object(
          'stage', 'event',
          'child_result', jsonb_build_object('outcome', 'rejected', 'code', 'injected_after_event')
        )::text;
    end if;

    if score_operation is not null then
      score_result := public.laxhornet_sync_game_v2(score_operation);
      if coalesce(score_result ->> 'outcome', '') not in ('accepted', 'merged') then
        raise exception using errcode = 'P0001',
          message = 'atomic_scored_event_child_rejected',
          detail = jsonb_build_object('stage', 'score', 'child_result', score_result)::text;
      end if;
    else
      score_result := jsonb_build_object(
        'outcome', 'accepted', 'code', 'no_score_change',
        'versions', lh_sync_private.r207_game_versions(target_game), 'replay', false
      );
    end if;

    if p_fail_after_score then
      raise exception using errcode = 'P0001',
        message = 'atomic_scored_event_injected_failure',
        detail = jsonb_build_object(
          'stage', 'score',
          'child_result', jsonb_build_object('outcome', 'rejected', 'code', 'injected_after_score')
        )::text;
    end if;
  exception when others then
    get stacked diagnostics failure_detail = pg_exception_detail,
      failure_state = returned_sqlstate;
    begin
      result := failure_detail::jsonb -> 'child_result';
    exception when others then
      result := jsonb_build_object(
        'outcome', 'rejected', 'code', 'atomic_child_failure',
        'sqlstate', failure_state
      );
    end;
  end;

  if result is not null then
    outcome_class := lh_sync_private.r207_atomic_result_class(result);
    outcome_code := coalesce(result ->> 'code', 'atomic_child_failure');
    insert into public.atomic_scored_event_operations(
      operation_id, actor_user_id, client_operation_id, game_id, event_id,
      action, request_hash, base_event_version, base_score_version,
      base_status_version, expected_game_lifecycle, score_for_delta,
      score_against_delta, event_client_operation_id, score_client_operation_id,
      outcome_class, outcome_code, canonical_result, client_created_at
    ) values (
      operation_uuid, actor_id, client_id, target_game_id, target_event_id,
      action_name, request_hash, base_event_version, base_score_version,
      base_status_version, expected_lifecycle, score_for_delta,
      score_against_delta, event_client_id,
      case when score_operation is null then null else score_client_id end,
      outcome_class, outcome_code, result, client_time
    );
    return result;
  end if;

  select game_row.* into target_game
  from public.games as game_row where game_row.id = target_game_id;
  result_event_version := nullif(event_result ->> 'server_event_version', '')::bigint;
  result_score_version := target_game.score_version;
  outcome_class := case
    when event_result ->> 'outcome' = 'merged' or score_result ->> 'outcome' = 'merged'
      then 'merged'
    else 'accepted'
  end;
  outcome_code := case action_name
    when 'create' then 'scored_event_created'
    when 'correct' then 'scored_event_corrected'
    else 'scored_event_tombstoned'
  end;

  result := jsonb_build_object(
    'outcome', outcome_class,
    'code', outcome_code,
    'replay', false,
    'game_id', target_game_id,
    'event_id', target_event_id,
    'action', action_name,
    'server_event_version', result_event_version,
    'versions', lh_sync_private.r207_game_versions(target_game),
    'score_effect', jsonb_build_object(
      'score_for_delta', score_for_delta,
      'score_against_delta', score_against_delta
    ),
    'server_game', jsonb_build_object(
      'score_for', target_game.score_for,
      'score_against', target_game.score_against,
      'score_known', target_game.score_known,
      'lifecycle_state', target_game.lifecycle_state
    )
  );

  insert into public.atomic_scored_event_operations(
    operation_id, actor_user_id, client_operation_id, game_id, event_id,
    action, request_hash, base_event_version, base_score_version,
    base_status_version, expected_game_lifecycle, score_for_delta,
    score_against_delta, event_client_operation_id, score_client_operation_id,
    outcome_class, outcome_code, result_event_version, result_score_version,
    canonical_result, client_created_at
  ) values (
    operation_uuid, actor_id, client_id, target_game_id, target_event_id,
    action_name, request_hash, base_event_version, base_score_version,
    base_status_version, expected_lifecycle, score_for_delta,
    score_against_delta, event_client_id,
    case when score_operation is null then null else score_client_id end,
    outcome_class, outcome_code, result_event_version, result_score_version,
    result, client_time
  );
  return result;
exception
  when check_violation or foreign_key_violation or unique_violation
    or invalid_text_representation or numeric_value_out_of_range
    or datetime_field_overflow then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
end;
$function$;

create or replace function public.laxhornet_apply_scored_event_v1(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return lh_sync_private.r207_apply_atomic_scored_event(p_operation, false, false);
end;
$function$;

revoke all on function lh_sync_private.r207_scoring_effect(text)
  from public, anon, authenticated;
revoke all on function lh_sync_private.r207_atomic_result_class(jsonb)
  from public, anon, authenticated;
revoke all on function lh_sync_private.r207_apply_atomic_scored_event(jsonb, boolean, boolean)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_apply_scored_event_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.laxhornet_apply_scored_event_v1(jsonb)
  to authenticated;

comment on function public.laxhornet_apply_scored_event_v1(jsonb) is
  'LH-25 authenticated idempotent R2-07 scored-event create/correct/tombstone command. Applies event and score effect in one transaction.';

comment on table public.atomic_scored_event_operations is
  'Append-only parent receipts for atomic R2-07 scored-event operations.';

commit;
