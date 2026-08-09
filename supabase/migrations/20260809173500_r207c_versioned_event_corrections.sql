-- R2-07C versioned legacy-event bridge. Default-off and executable only in an
-- explicitly enabled isolated Supabase Preview branch.

alter table public.events
  add column server_event_version bigint not null default 1
    check (server_event_version >= 1),
  add column event_lifecycle_state text not null default 'active'
    check (event_lifecycle_state in ('active'));

create table public.legacy_event_sync_operations (
  operation_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  client_operation_id text not null,
  game_id text not null,
  event_id text not null,
  operation_type text not null check (operation_type in ('create', 'correct', 'tombstone')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  base_event_version bigint not null check (base_event_version >= 0),
  expected_game_lifecycle text not null check (expected_game_lifecycle in ('active', 'paused', 'completed')),
  changed_fields text[] not null default '{}'::text[],
  outcome_class text not null check (outcome_class in ('accepted', 'merged', 'conflicted', 'deleted', 'rejected')),
  outcome_code text not null,
  result_event_version bigint,
  canonical_result jsonb not null check (jsonb_typeof(canonical_result) = 'object' and pg_column_size(canonical_result) <= 4096),
  client_created_at timestamptz,
  server_received_at timestamptz not null default statement_timestamp(),
  unique (actor_user_id, client_operation_id)
);

create index legacy_event_sync_operations_event_version_idx
  on public.legacy_event_sync_operations(event_id, result_event_version)
  where outcome_class in ('accepted', 'merged');

create table public.legacy_event_sync_operation_attempts (
  attempt_id bigint generated always as identity primary key,
  canonical_operation_id uuid not null references public.legacy_event_sync_operations(operation_id) on delete restrict,
  actor_user_id uuid not null,
  client_operation_id text not null,
  attempt_code text not null check (attempt_code in (
    'idempotent_replay', 'duplicate_operation_id_payload_mismatch',
    'duplicate_operation_id_scope_mismatch'
  )),
  received_at timestamptz not null default statement_timestamp()
);

create table public.legacy_event_field_changes (
  change_id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.legacy_event_sync_operations(operation_id) on delete restrict,
  game_id text not null,
  event_id text not null,
  base_event_version bigint not null check (base_event_version >= 0),
  result_event_version bigint not null check (result_event_version > base_event_version),
  changed_fields text[] not null check (cardinality(changed_fields) between 1 and 11),
  prior_values jsonb not null check (jsonb_typeof(prior_values) = 'object' and pg_column_size(prior_values) <= 8192),
  accepted_values jsonb not null check (jsonb_typeof(accepted_values) = 'object' and pg_column_size(accepted_values) <= 8192),
  recorded_at timestamptz not null default statement_timestamp(),
  unique (operation_id)
);

create index legacy_event_field_changes_overlap_idx
  on public.legacy_event_field_changes(event_id, result_event_version)
  include (changed_fields);

create table public.legacy_event_tombstones (
  event_id text primary key,
  game_id text not null,
  operation_id uuid not null unique references public.legacy_event_sync_operations(operation_id) on delete restrict,
  final_event_version bigint not null check (final_event_version >= 2),
  actor_user_id uuid not null,
  deleted_at timestamptz not null default statement_timestamp()
);

create trigger legacy_event_sync_operations_append_only_r207c
before update or delete on public.legacy_event_sync_operations
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger legacy_event_sync_operation_attempts_append_only_r207c
before update or delete on public.legacy_event_sync_operation_attempts
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger legacy_event_field_changes_append_only_r207c
before update or delete on public.legacy_event_field_changes
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger legacy_event_tombstones_append_only_r207c
before update or delete on public.legacy_event_tombstones
for each row execute function lh_sync_private.r207_forbid_history_mutation();

alter table public.legacy_event_sync_operations enable row level security;
alter table public.legacy_event_sync_operations force row level security;
alter table public.legacy_event_sync_operation_attempts enable row level security;
alter table public.legacy_event_sync_operation_attempts force row level security;
alter table public.legacy_event_field_changes enable row level security;
alter table public.legacy_event_field_changes force row level security;
alter table public.legacy_event_tombstones enable row level security;
alter table public.legacy_event_tombstones force row level security;
revoke all on table public.legacy_event_sync_operations from public, anon, authenticated;
revoke all on table public.legacy_event_sync_operation_attempts from public, anon, authenticated;
revoke all on table public.legacy_event_field_changes from public, anon, authenticated;
revoke all on table public.legacy_event_tombstones from public, anon, authenticated;

create or replace function lh_sync_private.r207_event_values_valid(p_values jsonb, p_require_complete boolean)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select jsonb_typeof(p_values) = 'object'
    and pg_column_size(p_values) <= 8192
    and not exists (
      select 1 from jsonb_object_keys(p_values) as key(value)
      where value not in (
        'timestamp', 'quarter', 'stat_type', 'stat_label', 'category',
        'point_value', 'tags', 'note', 'field_zone', 'corrected_at', 'tags_updated_at'
      )
    )
    and (not p_require_complete or p_values ?& array[
      'timestamp', 'quarter', 'stat_type', 'stat_label', 'category', 'point_value', 'tags', 'note', 'field_zone'
    ])
    and (not (p_values ? 'timestamp') or jsonb_typeof(p_values -> 'timestamp') = 'string')
    and (not (p_values ? 'quarter') or (jsonb_typeof(p_values -> 'quarter') = 'string' and length(p_values ->> 'quarter') between 1 and 20))
    and (not (p_values ? 'stat_type') or (jsonb_typeof(p_values -> 'stat_type') = 'string' and length(p_values ->> 'stat_type') between 1 and 80))
    and (not (p_values ? 'stat_label') or (jsonb_typeof(p_values -> 'stat_label') = 'string' and length(p_values ->> 'stat_label') between 1 and 160))
    and (not (p_values ? 'category') or (jsonb_typeof(p_values -> 'category') = 'string' and length(p_values ->> 'category') between 1 and 80))
    and (not (p_values ? 'point_value') or (jsonb_typeof(p_values -> 'point_value') = 'number' and (p_values ->> 'point_value')::integer between -100 and 100))
    and (not (p_values ? 'tags') or (jsonb_typeof(p_values -> 'tags') = 'array' and jsonb_array_length(p_values -> 'tags') <= 20 and not exists (
      select 1 from jsonb_array_elements(p_values -> 'tags') as tag(value)
      where jsonb_typeof(value) <> 'string' or length(value #>> '{}') > 80
    )))
    and (not (p_values ? 'note') or (jsonb_typeof(p_values -> 'note') = 'string' and length(p_values ->> 'note') <= 2000))
    and (not (p_values ? 'field_zone') or (jsonb_typeof(p_values -> 'field_zone') = 'string' and length(p_values ->> 'field_zone') <= 80))
    and (not (p_values ? 'corrected_at') or jsonb_typeof(p_values -> 'corrected_at') in ('string', 'null'))
    and (not (p_values ? 'tags_updated_at') or jsonb_typeof(p_values -> 'tags_updated_at') in ('string', 'null'));
$function$;

create or replace function public.laxhornet_sync_event_v2(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
<<r207_event>>
declare
  actor_id uuid := (select auth.uid());
  client_id text := btrim(coalesce(p_operation ->> 'client_operation_id', ''));
  target_game_id text := btrim(coalesce(p_operation ->> 'game_id', ''));
  target_event_id text := btrim(coalesce(p_operation ->> 'event_id', ''));
  operation_type text := btrim(coalesce(p_operation ->> 'operation_type', ''));
  expected_lifecycle text := btrim(coalesce(p_operation ->> 'expected_game_lifecycle', ''));
  base_version bigint;
  client_time timestamptz;
  changes jsonb := coalesce(p_operation -> 'changes', '{}'::jsonb);
  changed_fields text[];
  overlapping_fields text[];
  request_hash text;
  stored_operation public.legacy_event_sync_operations%rowtype;
  target_game public.games%rowtype;
  target_event public.events%rowtype;
  game_tombstone public.legacy_game_tombstones%rowtype;
  event_tombstone public.legacy_event_tombstones%rowtype;
  result jsonb;
  result_version bigint;
  outcome_class text;
  outcome_code text;
  prior_values jsonb;
  accepted_values jsonb;
  operation_uuid uuid := gen_random_uuid();
begin
  if not coalesce((select preview_enabled from public.r207_preview_control where control_id), false) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
  end if;
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  begin
    base_version := (p_operation ->> 'base_event_version')::bigint;
    client_time := nullif(p_operation ->> 'client_created_at', '')::timestamptz;
    select coalesce(array_agg(value order by value), '{}'::text[])
      into changed_fields from jsonb_object_keys(changes) as value;
  exception when others then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
  end;
  if client_id = '' or length(client_id) > 200
    or target_game_id = '' or length(target_game_id) > 200
    or target_event_id = '' or length(target_event_id) > 200
    or operation_type not in ('create', 'correct', 'tombstone')
    or expected_lifecycle not in ('active', 'paused', 'completed')
    or base_version is null or base_version < 0
    or (operation_type = 'create' and (base_version <> 0 or not lh_sync_private.r207_event_values_valid(changes, true)))
    or (operation_type = 'correct' and (base_version < 1 or cardinality(changed_fields) < 1 or not lh_sync_private.r207_event_values_valid(changes, false)))
    or (operation_type = 'tombstone' and (base_version < 1 or changes <> '{}'::jsonb))
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
  end if;

  request_hash := encode(extensions.digest(convert_to(p_operation::text, 'UTF8'), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('laxhornet:r207-event-operation:' || actor_id::text || ':' || client_id, 0));
  perform 1 from public.legacy_event_sync_operations
    where actor_user_id = actor_id and client_operation_id = client_id;
  perform pg_advisory_xact_lock(hashtextextended('laxhornet:legacy-game:' || target_game_id, 0));

  select tombstone_row.* into game_tombstone
    from public.legacy_game_tombstones as tombstone_row where tombstone_row.game_id = target_game_id;
  if found then
    if lh_sync_private.r207_tombstone_authority(actor_id, game_tombstone) then
      return jsonb_build_object('outcome', 'deleted', 'code', 'game_deleted');
    end if;
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select game_row.* into target_game from public.games as game_row
    where game_row.id = target_game_id for update;
  if not found or not lh_sync_private.r207_current_authority(actor_id, target_game) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select operation_row.* into stored_operation
    from public.legacy_event_sync_operations as operation_row
    where operation_row.actor_user_id = actor_id and operation_row.client_operation_id = client_id;
  if found then
    if stored_operation.game_id <> target_game_id or stored_operation.event_id <> target_event_id then
      insert into public.legacy_event_sync_operation_attempts(canonical_operation_id, actor_user_id, client_operation_id, attempt_code)
      values (stored_operation.operation_id, actor_id, client_id, 'duplicate_operation_id_scope_mismatch');
      return jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_id_scope_mismatch');
    end if;
    if stored_operation.request_hash <> request_hash then
      insert into public.legacy_event_sync_operation_attempts(canonical_operation_id, actor_user_id, client_operation_id, attempt_code)
      values (stored_operation.operation_id, actor_id, client_id, 'duplicate_operation_id_payload_mismatch');
      return jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_id_payload_mismatch');
    end if;
    insert into public.legacy_event_sync_operation_attempts(canonical_operation_id, actor_user_id, client_operation_id, attempt_code)
    values (stored_operation.operation_id, actor_id, client_id, 'idempotent_replay');
    return stored_operation.canonical_result;
  end if;

  if target_game.lifecycle_state <> expected_lifecycle then
    result := jsonb_build_object('outcome', 'conflicted', 'code', 'lifecycle_conflict');
    insert into public.legacy_event_sync_operations values (
      operation_uuid, actor_id, client_id, target_game_id, target_event_id, operation_type, request_hash,
      base_version, expected_lifecycle, changed_fields, 'conflicted', 'lifecycle_conflict', null, result,
      client_time, statement_timestamp()
    );
    return result;
  end if;

  select tombstone_row.* into event_tombstone from public.legacy_event_tombstones as tombstone_row
    where tombstone_row.event_id = target_event_id and tombstone_row.game_id = target_game_id;
  if found then
    result := jsonb_build_object('outcome', 'deleted', 'code', 'event_tombstoned', 'server_event_version', event_tombstone.final_event_version);
    insert into public.legacy_event_sync_operations values (
      operation_uuid, actor_id, client_id, target_game_id, target_event_id, operation_type, request_hash,
      base_version, expected_lifecycle, changed_fields, 'deleted', 'event_tombstoned', event_tombstone.final_event_version,
      result, client_time, statement_timestamp()
    );
    return result;
  end if;

  if operation_type = 'create' then
    if target_game.lifecycle_state = 'completed' then
      result := jsonb_build_object('outcome', 'conflicted', 'code', 'completed_game_event_append_rejected');
      outcome_class := 'conflicted'; outcome_code := 'completed_game_event_append_rejected'; result_version := null;
    elsif exists (select 1 from public.events as event_row where event_row.id = target_event_id)
      or exists (select 1 from public.legacy_event_tombstones as tombstone_row where tombstone_row.event_id = target_event_id)
    then
      result := jsonb_build_object('outcome', 'rejected', 'code', 'event_id_already_used');
      outcome_class := 'rejected'; outcome_code := 'event_id_already_used'; result_version := null;
    else
      accepted_values := changes;
      result_version := 1;
      insert into public.events(
        id, game_id, user_id, team_id, roster_player_id, timestamp, quarter, stat_type, stat_label,
        category, point_value, tags, note, field_zone, corrected_at, tags_updated_at, server_event_version
      ) values (
        target_event_id, target_game_id, actor_id, target_game.team_id, target_game.roster_player_id,
        (changes ->> 'timestamp')::timestamptz, changes ->> 'quarter', changes ->> 'stat_type',
        changes ->> 'stat_label', changes ->> 'category', (changes ->> 'point_value')::integer,
        array(select jsonb_array_elements_text(changes -> 'tags')), changes ->> 'note', changes ->> 'field_zone',
        nullif(changes ->> 'corrected_at', '')::timestamptz, nullif(changes ->> 'tags_updated_at', '')::timestamptz, 1
      );
      result := jsonb_build_object('outcome', 'accepted', 'code', 'created', 'server_event_version', 1, 'server_event', accepted_values);
      outcome_class := 'accepted'; outcome_code := 'created';
    end if;
  else
    select event_row.* into target_event from public.events as event_row
      where event_row.id = target_event_id and event_row.game_id = target_game_id for update;
    if not found then
      result := jsonb_build_object('outcome', 'rejected', 'code', 'event_not_found');
      outcome_class := 'rejected'; outcome_code := 'event_not_found'; result_version := null;
    elsif operation_type = 'tombstone' then
      if base_version <> target_event.server_event_version then
        result := jsonb_build_object('outcome', 'conflicted', 'code', 'stale_event_version', 'server_event_version', target_event.server_event_version);
        outcome_class := 'conflicted'; outcome_code := 'stale_event_version'; result_version := target_event.server_event_version;
      else
        result_version := target_event.server_event_version + 1;
        result := jsonb_build_object('outcome', 'accepted', 'code', 'tombstoned', 'server_event_version', result_version);
        outcome_class := 'accepted'; outcome_code := 'tombstoned';
      end if;
    else
      if base_version > target_event.server_event_version then
        result := jsonb_build_object('outcome', 'rejected', 'code', 'invalid_base_version', 'server_event_version', target_event.server_event_version);
        outcome_class := 'rejected'; outcome_code := 'invalid_base_version'; result_version := target_event.server_event_version;
      else
        select coalesce(array_agg(distinct proposed.value order by proposed.value), '{}'::text[])
          into overlapping_fields
        from unnest(changed_fields) as proposed(value)
        where exists (
          select 1 from public.legacy_event_field_changes as journal
          where journal.event_id = target_event_id and journal.result_event_version > base_version
            and proposed.value = any(journal.changed_fields)
        );
        if base_version < target_event.server_event_version and cardinality(overlapping_fields) > 0 then
          result := jsonb_build_object('outcome', 'conflicted', 'code', 'same_field_conflict', 'server_event_version', target_event.server_event_version);
          outcome_class := 'conflicted'; outcome_code := 'same_field_conflict'; result_version := target_event.server_event_version;
        else
          prior_values := to_jsonb(target_event) - array['user_id', 'team_id', 'roster_player_id', 'created_at', 'event_lifecycle_state'];
          update public.events as event_row set
            timestamp = case when changes ? 'timestamp' then (changes ->> 'timestamp')::timestamptz else event_row.timestamp end,
            quarter = case when changes ? 'quarter' then changes ->> 'quarter' else event_row.quarter end,
            stat_type = case when changes ? 'stat_type' then changes ->> 'stat_type' else event_row.stat_type end,
            stat_label = case when changes ? 'stat_label' then changes ->> 'stat_label' else event_row.stat_label end,
            category = case when changes ? 'category' then changes ->> 'category' else event_row.category end,
            point_value = case when changes ? 'point_value' then (changes ->> 'point_value')::integer else event_row.point_value end,
            tags = case when changes ? 'tags' then array(select jsonb_array_elements_text(changes -> 'tags')) else event_row.tags end,
            note = case when changes ? 'note' then changes ->> 'note' else event_row.note end,
            field_zone = case when changes ? 'field_zone' then changes ->> 'field_zone' else event_row.field_zone end,
            corrected_at = case when changes ? 'corrected_at' then nullif(changes ->> 'corrected_at', '')::timestamptz else event_row.corrected_at end,
            tags_updated_at = case when changes ? 'tags_updated_at' then nullif(changes ->> 'tags_updated_at', '')::timestamptz else event_row.tags_updated_at end,
            server_event_version = event_row.server_event_version + 1
          where event_row.id = target_event_id returning * into target_event;
          accepted_values := to_jsonb(target_event) - array['user_id', 'team_id', 'roster_player_id', 'created_at', 'event_lifecycle_state'];
          result_version := target_event.server_event_version;
          outcome_class := case when base_version < result_version - 1 then 'merged' else 'accepted' end;
          outcome_code := case when outcome_class = 'merged' then 'merged_non_overlapping' else 'corrected' end;
          result := jsonb_build_object('outcome', outcome_class, 'code', outcome_code, 'server_event_version', result_version, 'server_event', accepted_values);
        end if;
      end if;
    end if;
  end if;

  insert into public.legacy_event_sync_operations values (
    operation_uuid, actor_id, client_id, target_game_id, target_event_id, operation_type, request_hash,
    base_version, expected_lifecycle, changed_fields, outcome_class, outcome_code, result_version, result,
    client_time, statement_timestamp()
  );
  if outcome_class in ('accepted', 'merged') and operation_type in ('create', 'correct') then
    insert into public.legacy_event_field_changes(
      operation_id, game_id, event_id, base_event_version, result_event_version,
      changed_fields, prior_values, accepted_values
    ) values (
      operation_uuid, target_game_id, target_event_id, base_version, result_version,
      changed_fields, coalesce(prior_values, '{}'::jsonb), accepted_values
    );
  elsif outcome_class = 'accepted' and operation_type = 'tombstone' then
    insert into public.legacy_event_tombstones(event_id, game_id, operation_id, final_event_version, actor_user_id)
    values (target_event_id, target_game_id, operation_uuid, result_version, actor_id);
    delete from public.events as event_row where event_row.id = target_event_id;
  end if;
  return result;
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
end;
$function$;

revoke execute on function lh_sync_private.r207_event_values_valid(jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.laxhornet_sync_event_v2(jsonb) from public, anon, authenticated;
grant execute on function public.laxhornet_sync_event_v2(jsonb) to authenticated;

comment on function public.laxhornet_sync_event_v2(jsonb) is
  'R2-07C per-event optimistic concurrency bridge. Default-off; isolated Preview only.';
