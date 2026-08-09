-- R2-07A dormant concurrency foundation.
-- Repository migration only. Applying or activating this migration requires a
-- separately authorized release. Existing v1 functions, grants, and behavior
-- are intentionally untouched.

begin;

alter table public.games
  add column game_revision bigint not null default 1,
  add column metadata_version bigint not null default 1,
  add column score_version bigint not null default 1,
  add column status_version bigint not null default 1,
  add column roster_context_version bigint not null default 1,
  add column sharing_version bigint not null default 1,
  add column lifecycle_state text not null default 'active',
  add column score_for integer not null default 0,
  add column score_against integer not null default 0,
  add column score_known boolean not null default false,
  add column final_score_for integer,
  add column final_score_against integer;

update public.games
set lifecycle_state = case when status = 'complete' then 'completed' else 'active' end;

alter table public.games
  add constraint games_game_revision_r207_check check (game_revision >= 1),
  add constraint games_metadata_version_r207_check check (metadata_version >= 1),
  add constraint games_score_version_r207_check check (score_version >= 1),
  add constraint games_status_version_r207_check check (status_version >= 1),
  add constraint games_roster_context_version_r207_check check (roster_context_version >= 1),
  add constraint games_sharing_version_r207_check check (sharing_version >= 1),
  add constraint games_lifecycle_state_r207_check
    check (lifecycle_state in ('active', 'paused', 'completed')),
  add constraint games_score_r207_check check (score_for >= 0 and score_against >= 0),
  add constraint games_final_score_r207_check check (
    (final_score_for is null and final_score_against is null)
    or (final_score_for >= 0 and final_score_against >= 0)
  );

alter table public.lh_game_clock_states
  alter column revision type bigint,
  add column anchor_server_at timestamptz,
  add column anchor_clock_seconds_remaining integer;

update public.lh_game_clock_states
set anchor_server_at = server_updated_at,
    anchor_clock_seconds_remaining = clock_seconds_remaining;

alter table public.lh_game_clock_states
  add constraint lh_game_clock_states_anchor_remaining_r207_check check (
    (anchor_server_at is null and anchor_clock_seconds_remaining is null)
    or (
      anchor_server_at is not null
      and anchor_clock_seconds_remaining >= 0
      and anchor_clock_seconds_remaining <= case
        when current_period = 'OT'
          then coalesce(overtime_duration_seconds, regulation_period_duration_seconds)
        else regulation_period_duration_seconds
      end
    )
  );

create table public.game_sync_operations (
  operation_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  client_operation_id text not null,
  game_id text not null,
  operation_type text not null,
  request_hash text not null,
  changed_fields text[] not null default '{}'::text[],
  outcome_class text not null,
  outcome_code text not null,
  conflict_id uuid,
  result_versions jsonb not null default '{}'::jsonb,
  canonical_result jsonb not null,
  correction_reason text,
  client_created_at timestamptz,
  server_received_at timestamptz not null default statement_timestamp(),
  constraint game_sync_operations_actor_client_r207_key
    unique (actor_user_id, client_operation_id),
  constraint game_sync_operations_client_id_r207_check
    check (length(btrim(client_operation_id)) between 1 and 200),
  constraint game_sync_operations_game_id_r207_check
    check (length(btrim(game_id)) between 1 and 200),
  constraint game_sync_operations_type_r207_check check (operation_type in (
    'metadata_patch', 'score_delta', 'score_correction', 'status_transition',
    'roster_context_patch', 'sharing_patch', 'clock_start', 'clock_pause',
    'clock_set_remaining', 'clock_batch', 'conflict_resolution'
  )),
  constraint game_sync_operations_hash_r207_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint game_sync_operations_fields_r207_check
    check (cardinality(changed_fields) <= 16),
  constraint game_sync_operations_outcome_r207_check
    check (outcome_class in ('accepted', 'merged', 'conflicted', 'deleted', 'rejected')),
  constraint game_sync_operations_code_r207_check
    check (length(btrim(outcome_code)) between 1 and 100),
  constraint game_sync_operations_versions_r207_check
    check (jsonb_typeof(result_versions) = 'object' and pg_column_size(result_versions) <= 2048),
  constraint game_sync_operations_result_r207_check
    check (jsonb_typeof(canonical_result) = 'object' and pg_column_size(canonical_result) <= 4096),
  constraint game_sync_operations_correction_reason_r207_check check (
    correction_reason is null
    or correction_reason in (
      'scoreboard_correction', 'official_result_correction', 'data_entry_correction'
    )
  )
);

create index game_sync_operations_game_received_r207_idx
  on public.game_sync_operations(game_id, server_received_at desc);

create table public.game_sync_operation_attempts (
  attempt_id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  client_operation_id text not null,
  canonical_operation_id uuid not null
    references public.game_sync_operations(operation_id) on delete restrict,
  attempt_code text not null check (attempt_code in (
    'idempotent_replay', 'duplicate_operation_id_payload_mismatch',
    'duplicate_operation_id_scope_mismatch'
  )),
  received_at timestamptz not null default statement_timestamp()
);

create index game_sync_operation_attempts_identity_r207_idx
  on public.game_sync_operation_attempts(actor_user_id, client_operation_id, received_at desc);
create index game_sync_operation_attempts_retention_r207_idx
  on public.game_sync_operation_attempts(received_at);

create table public.game_field_changes (
  change_id uuid primary key default gen_random_uuid(),
  operation_id uuid not null
    references public.game_sync_operations(operation_id) on delete restrict,
  game_id text not null,
  field_group text not null check (
    field_group in ('metadata', 'score', 'status', 'roster_context', 'sharing')
  ),
  base_version bigint not null check (base_version >= 1),
  result_version bigint not null check (result_version > base_version),
  changed_fields text[] not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint game_field_changes_operation_group_r207_key unique (operation_id, field_group),
  constraint game_field_changes_fields_r207_check check (
    cardinality(changed_fields) between 1 and 16
    and changed_fields <@ array[
      'opponent', 'game_date', 'location', 'game_type',
      'score_for', 'score_against', 'lifecycle_state',
      'player_id', 'team_id', 'roster_player_id', 'is_shared'
    ]::text[]
  )
);

create index game_field_changes_overlap_r207_idx
  on public.game_field_changes(game_id, field_group, result_version)
  include (changed_fields);

create table public.game_conflicts (
  conflict_id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  game_id text not null,
  team_id text,
  roster_player_id text,
  actor_user_id uuid not null,
  operation_id uuid not null
    references public.game_sync_operations(operation_id) on delete restrict
    deferrable initially deferred,
  parent_conflict_id uuid references public.game_conflicts(conflict_id) on delete restrict,
  conflict_type text not null check (conflict_type in (
    'field_overlap', 'score_absolute_stale', 'status_stale',
    'clock_stale', 'resolution_stale'
  )),
  field_group text not null check (
    field_group in ('metadata', 'score', 'status', 'roster_context', 'sharing', 'clock')
  ),
  client_base_version bigint not null check (client_base_version >= 1),
  current_server_version bigint not null check (current_server_version >= 1),
  overlapping_fields text[] not null check (cardinality(overlapping_fields) between 1 and 16),
  current_values jsonb not null,
  proposed_values jsonb not null,
  audit_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint game_conflicts_operation_r207_key unique (operation_id),
  constraint game_conflicts_scope_r207_check check (
    (team_id is null and roster_player_id is null)
    or (team_id is not null and roster_player_id is not null)
  ),
  constraint game_conflicts_current_values_r207_check check (
    jsonb_typeof(current_values) = 'object' and pg_column_size(current_values) <= 4096
  ),
  constraint game_conflicts_proposed_values_r207_check check (
    jsonb_typeof(proposed_values) = 'object' and pg_column_size(proposed_values) <= 4096
  ),
  constraint game_conflicts_audit_r207_check check (
    jsonb_typeof(audit_metadata) = 'object' and pg_column_size(audit_metadata) <= 1024
  )
);

alter table public.game_sync_operations
  add constraint game_sync_operations_conflict_r207_fk
  foreign key (conflict_id) references public.game_conflicts(conflict_id)
  on delete restrict deferrable initially deferred;

create index game_conflicts_account_r207_idx
  on public.game_conflicts(account_id, created_at desc);
create index game_conflicts_game_r207_idx
  on public.game_conflicts(game_id, created_at desc);
create index game_conflicts_team_player_r207_idx
  on public.game_conflicts(team_id, roster_player_id, created_at desc)
  where team_id is not null;
create index game_conflicts_parent_r207_idx
  on public.game_conflicts(parent_conflict_id)
  where parent_conflict_id is not null;

create table public.game_conflict_resolutions (
  resolution_id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.game_conflicts(conflict_id) on delete restrict,
  resolver_user_id uuid not null,
  client_resolution_operation_id text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  action text not null check (action in (
    'keep_server', 'apply_proposed', 'apply_patch', 'dismiss', 'superseded_by_delete'
  )),
  outcome_code text not null check (length(btrim(outcome_code)) between 1 and 100),
  result_versions jsonb not null default '{}'::jsonb,
  accepted_fields text[] not null default '{}'::text[] check (cardinality(accepted_fields) <= 16),
  resolved_at timestamptz not null default statement_timestamp(),
  constraint game_conflict_resolutions_actor_client_r207_key
    unique (resolver_user_id, client_resolution_operation_id),
  constraint game_conflict_resolutions_result_r207_check check (
    jsonb_typeof(result_versions) = 'object' and pg_column_size(result_versions) <= 2048
  )
);

create index game_conflict_resolutions_conflict_r207_idx
  on public.game_conflict_resolutions(conflict_id, resolved_at desc);

create table public.game_clock_commands (
  clock_command_id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique
    references public.game_sync_operations(operation_id) on delete restrict,
  game_id text not null,
  batch_id text,
  batch_sequence integer,
  command text not null check (command in ('start', 'pause', 'set_remaining')),
  base_clock_version bigint not null check (base_clock_version >= 1),
  result_clock_version bigint not null check (result_clock_version > base_clock_version),
  clock_seconds_remaining integer check (clock_seconds_remaining is null or clock_seconds_remaining >= 0),
  recorded_at timestamptz not null default statement_timestamp(),
  constraint game_clock_commands_batch_shape_r207_check check (
    (batch_id is null and batch_sequence is null)
    or (length(btrim(batch_id)) between 1 and 200 and batch_sequence >= 1)
  ),
  constraint game_clock_commands_batch_r207_key unique (game_id, batch_id, batch_sequence)
);

create index game_clock_commands_game_r207_idx
  on public.game_clock_commands(game_id, result_clock_version);

create table public.r207_retention_control (
  control_id boolean primary key default true check (control_id),
  execution_enabled boolean not null default false check (not execution_enabled),
  approved_retention_days integer,
  privacy_legal_authorization text,
  updated_at timestamptz not null default statement_timestamp(),
  constraint r207_retention_control_unapproved_r207_check check (
    approved_retention_days is null and privacy_legal_authorization is null
  )
);

insert into public.r207_retention_control(control_id) values (true);

create or replace function lh_sync_private.r207_forbid_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception using errcode = 'P0001', message = 'r207_append_only_history';
end;
$function$;

create trigger game_sync_operations_append_only_r207
before update or delete on public.game_sync_operations
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger game_sync_operation_attempts_append_only_r207
before update or delete on public.game_sync_operation_attempts
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger game_field_changes_append_only_r207
before update or delete on public.game_field_changes
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger game_conflicts_append_only_r207
before update or delete on public.game_conflicts
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger game_conflict_resolutions_append_only_r207
before update or delete on public.game_conflict_resolutions
for each row execute function lh_sync_private.r207_forbid_history_mutation();
create trigger game_clock_commands_append_only_r207
before update or delete on public.game_clock_commands
for each row execute function lh_sync_private.r207_forbid_history_mutation();

create or replace function lh_sync_private.r207_sorted_unique(p_values text[])
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(
    cardinality(p_values) = (
      select count(distinct value)::integer from unnest(p_values) as value
    )
    and p_values = (
      select coalesce(array_agg(value order by value), '{}'::text[])
      from unnest(p_values) as value
    ),
    false
  );
$function$;

create or replace function lh_sync_private.r207_game_versions(p_game public.games)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select jsonb_build_object(
    'game', p_game.game_revision,
    'metadata', p_game.metadata_version,
    'score', p_game.score_version,
    'status', p_game.status_version,
    'roster_context', p_game.roster_context_version,
    'sharing', p_game.sharing_version
  );
$function$;

create or replace function lh_sync_private.r207_current_authority(
  p_actor uuid,
  p_game public.games
)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select p_actor is not null
    and p_actor = (select auth.uid())
    and (
      (p_game.team_id is null and p_game.user_id = p_actor)
      or (
        p_game.team_id is not null
        and (select public.laxhornet_can_track_roster_player(
          p_game.team_id,
          p_game.roster_player_id
        ))
      )
      or (select public.laxhornet_is_platform_reviewer())
    );
$function$;

create or replace function lh_sync_private.r207_tombstone_authority(
  p_actor uuid,
  p_tombstone public.legacy_game_tombstones
)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select p_actor is not null
    and p_actor = (select auth.uid())
    and (
      (
        p_tombstone.team_id is null
        and p_tombstone.owner_user_id = p_actor
      )
      or (
        p_tombstone.team_id is not null
        and (select public.laxhornet_can_track_roster_player(
          p_tombstone.team_id,
          p_tombstone.roster_player_id
        ))
      )
      or (select public.laxhornet_is_platform_reviewer())
    );
$function$;

-- Privileged executable certification engine. It is deliberately ungranted to
-- app roles; public v2 wrappers below remain inert until a future activation
-- migration replaces them after exact-head review.
create or replace function lh_sync_private.r207_apply_game_operation_for_test(
  p_operation jsonb,
  p_fail_after_mutation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
<<r207_apply>>
declare
  actor_id uuid := (select auth.uid());
  client_id text := btrim(coalesce(p_operation ->> 'client_operation_id', ''));
  target_game_id text := btrim(coalesce(p_operation ->> 'game_id', ''));
  request_hash text := lower(btrim(coalesce(p_operation ->> 'request_hash', '')));
  operation_type text := btrim(coalesce(p_operation ->> 'operation_type', ''));
  field_group text := btrim(coalesce(p_operation ->> 'field_group', ''));
  base_version bigint;
  status_base_version bigint;
  current_version bigint;
  result_version bigint;
  changed_fields text[];
  changes jsonb := coalesce(p_operation -> 'changes', '{}'::jsonb);
  expected_lifecycle text := nullif(btrim(coalesce(p_operation ->> 'expected_lifecycle', '')), '');
  correction_reason text := nullif(btrim(coalesce(p_operation ->> 'correction_reason', '')), '');
  stored_operation public.game_sync_operations%rowtype;
  target_game public.games%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
  operation_uuid uuid := gen_random_uuid();
  conflict_uuid uuid;
  outcome_class text := 'accepted';
  outcome_code text := 'operation_accepted';
  result jsonb;
  current_values jsonb := '{}'::jsonb;
  conflict_type text;
  overlap boolean := false;
begin
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;

  begin
    base_version := (p_operation ->> 'base_version')::bigint;
    select coalesce(array_agg(value order by value), '{}'::text[])
    into changed_fields
    from jsonb_array_elements_text(p_operation -> 'changed_fields') as value;
  exception when others then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
  end;

  if client_id = '' or length(client_id) > 200
    or target_game_id = '' or length(target_game_id) > 200
    or request_hash !~ '^[0-9a-f]{64}$'
    or operation_type not in (
      'metadata_patch', 'score_delta', 'score_correction', 'status_transition',
      'roster_context_patch', 'sharing_patch'
    )
    or field_group not in ('metadata', 'score', 'status', 'roster_context', 'sharing')
    or base_version is null
    or base_version < 1
    or cardinality(changed_fields) < 1
    or cardinality(changed_fields) > 16
    or not lh_sync_private.r207_sorted_unique(changed_fields)
    or jsonb_typeof(changes) <> 'object'
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
  end if;

  if (operation_type = 'metadata_patch' and field_group <> 'metadata')
    or (operation_type in ('score_delta', 'score_correction') and field_group <> 'score')
    or (operation_type = 'status_transition' and field_group <> 'status')
    or (operation_type = 'roster_context_patch' and field_group <> 'roster_context')
    or (operation_type = 'sharing_patch' and field_group <> 'sharing')
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
  end if;

  -- Universal order: operation identity before the single requested-game key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'laxhornet:r207-operation:' || actor_id::text || ':' || client_id,
      0
    )
  );

  -- Preliminary lookup intentionally retains only an existence bit. Scope and
  -- result are not read until requested-game deletion/authority is checked.
  perform 1
  from public.game_sync_operations
  where actor_user_id = actor_id and client_operation_id = client_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('laxhornet:legacy-game:' || target_game_id, 0)
  );

  select * into tombstone
  from public.legacy_game_tombstones
  where game_id = target_game_id;

  if found then
    if lh_sync_private.r207_tombstone_authority(actor_id, tombstone) then
      return jsonb_build_object('outcome', 'deleted', 'code', 'game_deleted');
    end if;
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select * into target_game
  from public.games
  where id = target_game_id
  for update;

  if not found or not lh_sync_private.r207_current_authority(actor_id, target_game) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select * into stored_operation
  from public.game_sync_operations
  where actor_user_id = actor_id and client_operation_id = client_id;

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
    end if;
    if stored_operation.request_hash <> request_hash then
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
    ) values (
      actor_id, client_id, stored_operation.operation_id, 'idempotent_replay'
    );
    return stored_operation.canonical_result || jsonb_build_object('replay', true);
  end if;

  if operation_type in ('score_delta', 'score_correction', 'status_transition') then
    if expected_lifecycle is null then
      return jsonb_build_object('outcome', 'rejected', 'code', 'missing_expected_lifecycle');
    end if;
    if expected_lifecycle not in ('active', 'paused', 'completed') then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_expected_lifecycle');
    end if;
    if not (p_operation ? 'status_base_version') then
      return jsonb_build_object('outcome', 'rejected', 'code', 'missing_status_base_version');
    end if;
    begin
      status_base_version := (p_operation ->> 'status_base_version')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_status_base_version');
    end;
    if status_base_version is null or status_base_version < 1 then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_status_base_version');
    end if;
    if expected_lifecycle <> target_game.lifecycle_state then
      return jsonb_build_object('outcome', 'rejected', 'code', 'stale_lifecycle_state');
    end if;
    if status_base_version <> target_game.status_version then
      return jsonb_build_object('outcome', 'rejected', 'code', 'stale_status_version');
    end if;
  end if;

  if target_game.lifecycle_state = 'completed' and operation_type = 'score_delta' then
    return jsonb_build_object(
      'outcome', 'rejected', 'code', 'completed_game_score_correction_required'
    );
  end if;

  if target_game.lifecycle_state = 'completed' and operation_type = 'score_correction' then
    if correction_reason is null then
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'completed_game_score_correction_reason_required'
      );
    end if;
    if correction_reason not in (
      'scoreboard_correction', 'official_result_correction', 'data_entry_correction'
    ) then
      return jsonb_build_object(
        'outcome', 'rejected', 'code', 'invalid_completed_game_score_correction_reason'
      );
    end if;
    if base_version <> target_game.score_version then
      return jsonb_build_object('outcome', 'rejected', 'code', 'stale_score_version');
    end if;
  else
    correction_reason := null;
  end if;

  current_version := case field_group
    when 'metadata' then target_game.metadata_version
    when 'score' then target_game.score_version
    when 'status' then target_game.status_version
    when 'roster_context' then target_game.roster_context_version
    when 'sharing' then target_game.sharing_version
  end;

  if base_version > current_version then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_base_version');
  end if;

  if operation_type = 'metadata_patch' then
    if not (changed_fields <@ array['game_date', 'game_type', 'location', 'opponent']::text[]) then
      return jsonb_build_object('outcome', 'rejected', 'code', 'unsupported_metadata_field');
    end if;
    if changes - array['game_date', 'game_type', 'location', 'opponent']::text[] <> '{}'::jsonb
      or pg_column_size(changes) > 4096
    then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_conflict_values');
    end if;
    select exists (
      select 1 from public.game_field_changes as journal
      where journal.game_id = target_game_id and journal.field_group = 'metadata'
        and journal.result_version > r207_apply.base_version
        and journal.changed_fields && r207_apply.changed_fields
    ) into overlap;
    current_values := jsonb_strip_nulls(jsonb_build_object(
      'opponent', target_game.opponent, 'game_date', target_game.game_date,
      'location', target_game.location, 'game_type', target_game.game_type
    ));
  elsif operation_type = 'score_delta' then
    if not (changed_fields <@ array['score_against', 'score_for']::text[]) then
      return jsonb_build_object('outcome', 'rejected', 'code', 'unsupported_score_field');
    end if;
    if changes - array['score_against_delta', 'score_for_delta']::text[] <> '{}'::jsonb
      or pg_column_size(changes) > 4096
    then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_score_delta');
    end if;
    overlap := false;
  elsif operation_type = 'score_correction' then
    if not (changed_fields <@ array['score_against', 'score_for']::text[]) then
      return jsonb_build_object('outcome', 'rejected', 'code', 'unsupported_score_field');
    end if;
    if changes - array['score_against', 'score_for']::text[] <> '{}'::jsonb
      or pg_column_size(changes) > 4096
    then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_score_correction');
    end if;
    overlap := base_version < current_version;
    conflict_type := 'score_absolute_stale';
    current_values := jsonb_build_object(
      'score_for', target_game.score_for, 'score_against', target_game.score_against
    );
  elsif operation_type = 'status_transition' then
    if changed_fields <> array['lifecycle_state']::text[] then
      return jsonb_build_object('outcome', 'rejected', 'code', 'unsupported_status_field');
    end if;
    if changes - array['lifecycle_state']::text[] <> '{}'::jsonb then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_lifecycle_transition');
    end if;
    if target_game.lifecycle_state = 'completed'
      and coalesce(changes ->> 'lifecycle_state', '') <> 'completed'
    then
      return jsonb_build_object('outcome', 'rejected', 'code', 'completed_game_reopen_forbidden');
    end if;
    overlap := base_version < current_version;
    conflict_type := 'status_stale';
    current_values := jsonb_build_object('lifecycle_state', target_game.lifecycle_state);
  elsif operation_type = 'roster_context_patch' then
    if changed_fields <> array['player_id']::text[] then
      return jsonb_build_object('outcome', 'rejected', 'code', 'unsupported_roster_context_field');
    end if;
    if changes - array['player_id']::text[] <> '{}'::jsonb then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_roster_context');
    end if;
    select exists (
      select 1 from public.game_field_changes as journal
      where journal.game_id = target_game_id and journal.field_group = 'roster_context'
        and journal.result_version > r207_apply.base_version
        and journal.changed_fields && r207_apply.changed_fields
    ) into overlap;
    current_values := jsonb_build_object('player_id', target_game.player_id);
  elsif operation_type = 'sharing_patch' then
    if changed_fields <> array['is_shared']::text[] then
      return jsonb_build_object('outcome', 'rejected', 'code', 'unsupported_sharing_field');
    end if;
    if changes - array['is_shared']::text[] <> '{}'::jsonb then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_sharing_change');
    end if;
    select exists (
      select 1 from public.game_field_changes as journal
      where journal.game_id = target_game_id and journal.field_group = 'sharing'
        and journal.result_version > r207_apply.base_version
        and journal.changed_fields && r207_apply.changed_fields
    ) into overlap;
    current_values := jsonb_build_object('is_shared', target_game.is_shared);
  end if;

  if overlap then
    conflict_uuid := gen_random_uuid();
    conflict_type := coalesce(conflict_type, 'field_overlap');
    result := jsonb_build_object(
      'outcome', 'conflicted', 'code', 'field_conflict',
      'conflict_id', conflict_uuid, 'field_group', field_group,
      'versions', lh_sync_private.r207_game_versions(target_game)
    );
    insert into public.game_sync_operations(
      operation_id, actor_user_id, client_operation_id, game_id, operation_type,
      request_hash, changed_fields, outcome_class, outcome_code, conflict_id,
      result_versions, canonical_result
    ) values (
      operation_uuid, actor_id, client_id, target_game_id, operation_type,
      request_hash, changed_fields, 'conflicted', 'field_conflict', conflict_uuid,
      lh_sync_private.r207_game_versions(target_game), result
    );
    insert into public.game_conflicts(
      conflict_id, account_id, game_id, team_id, roster_player_id,
      actor_user_id, operation_id, conflict_type, field_group,
      client_base_version, current_server_version, overlapping_fields,
      current_values, proposed_values, audit_metadata
    ) values (
      conflict_uuid, target_game.user_id, target_game_id, target_game.team_id,
      target_game.roster_player_id, actor_id, operation_uuid, conflict_type,
      field_group, base_version, current_version, changed_fields,
      current_values, changes, jsonb_build_object('protocol', 'r207a')
    );
    return result;
  end if;

  outcome_class := case when base_version < current_version then 'merged' else 'accepted' end;
  outcome_code := case when outcome_class = 'merged' then 'non_overlapping_merge' else 'operation_accepted' end;
  result_version := current_version + 1;

  if operation_type = 'metadata_patch' then
    update public.games set
      opponent = case when 'opponent' = any(changed_fields) then changes ->> 'opponent' else opponent end,
      game_date = case when 'game_date' = any(changed_fields) then (changes ->> 'game_date')::date else game_date end,
      location = case when 'location' = any(changed_fields) then changes ->> 'location' else location end,
      game_type = case when 'game_type' = any(changed_fields) then changes ->> 'game_type' else game_type end,
      metadata_version = result_version,
      game_revision = game_revision + 1
    where id = target_game_id returning * into target_game;
  elsif operation_type = 'score_delta' then
    update public.games set
      score_for = score_for + coalesce((changes ->> 'score_for_delta')::integer, 0),
      score_against = score_against + coalesce((changes ->> 'score_against_delta')::integer, 0),
      score_known = true,
      final_score_for = case when lifecycle_state = 'completed'
        then score_for + coalesce((changes ->> 'score_for_delta')::integer, 0)
        else final_score_for end,
      final_score_against = case when lifecycle_state = 'completed'
        then score_against + coalesce((changes ->> 'score_against_delta')::integer, 0)
        else final_score_against end,
      score_version = result_version,
      game_revision = game_revision + 1
    where id = target_game_id returning * into target_game;
  elsif operation_type = 'score_correction' then
    update public.games set
      score_for = (changes ->> 'score_for')::integer,
      score_against = (changes ->> 'score_against')::integer,
      score_known = true,
      final_score_for = case when lifecycle_state = 'completed' then (changes ->> 'score_for')::integer else null end,
      final_score_against = case when lifecycle_state = 'completed' then (changes ->> 'score_against')::integer else null end,
      score_version = result_version,
      game_revision = game_revision + 1
    where id = target_game_id returning * into target_game;
  elsif operation_type = 'status_transition' then
    if coalesce(changes ->> 'lifecycle_state', '') not in ('active', 'paused', 'completed') then
      return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_lifecycle_transition');
    end if;
    update public.games set
      lifecycle_state = changes ->> 'lifecycle_state',
      status = case when changes ->> 'lifecycle_state' = 'completed' then 'complete' else 'in-progress' end,
      final_score_for = case when changes ->> 'lifecycle_state' = 'completed' and score_known then score_for else null end,
      final_score_against = case when changes ->> 'lifecycle_state' = 'completed' and score_known then score_against else null end,
      status_version = result_version,
      game_revision = game_revision + 1
    where id = target_game_id returning * into target_game;
  elsif operation_type = 'roster_context_patch' then
    update public.games set player_id = changes ->> 'player_id',
      roster_context_version = result_version, game_revision = game_revision + 1
    where id = target_game_id returning * into target_game;
  elsif operation_type = 'sharing_patch' then
    update public.games set is_shared = (changes ->> 'is_shared')::boolean,
      sharing_version = result_version, game_revision = game_revision + 1
    where id = target_game_id returning * into target_game;
  end if;

  if p_fail_after_mutation then
    raise exception using errcode = 'P0001', message = 'r207_injected_atomicity_failure';
  end if;

  result := jsonb_build_object(
    'outcome', outcome_class, 'code', outcome_code,
    'versions', lh_sync_private.r207_game_versions(target_game), 'replay', false
  );
  insert into public.game_sync_operations(
    operation_id, actor_user_id, client_operation_id, game_id, operation_type,
    request_hash, changed_fields, outcome_class, outcome_code,
    result_versions, canonical_result, correction_reason
  ) values (
    operation_uuid, actor_id, client_id, target_game_id, operation_type,
    request_hash, changed_fields, outcome_class, outcome_code,
    lh_sync_private.r207_game_versions(target_game), result, correction_reason
  );
  insert into public.game_field_changes(
    operation_id, game_id, field_group, base_version, result_version, changed_fields
  ) values (
    operation_uuid, target_game_id, field_group, base_version, result_version, changed_fields
  );
  return result;
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_operation');
end;
$function$;

create or replace function lh_sync_private.r207_apply_clock_operation_for_test(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  client_id text := btrim(coalesce(p_operation ->> 'client_operation_id', ''));
  target_game_id text := btrim(coalesce(p_operation ->> 'game_id', ''));
  request_hash text := lower(btrim(coalesce(p_operation ->> 'request_hash', '')));
  command_name text := btrim(coalesce(p_operation ->> 'command', ''));
  expected_lifecycle text := nullif(btrim(coalesce(p_operation ->> 'expected_lifecycle', '')), '');
  base_version bigint;
  status_base_version bigint;
  target_game public.games%rowtype;
  target_clock public.lh_game_clock_states%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
  stored_operation public.game_sync_operations%rowtype;
  operation_uuid uuid := gen_random_uuid();
  conflict_uuid uuid;
  result jsonb;
begin
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  begin
    base_version := (p_operation ->> 'base_clock_version')::bigint;
  exception when others then
    return jsonb_build_object('outcome', 'rejected', 'code', 'missing_base_clock_version');
  end;
  if base_version is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'missing_base_clock_version');
  end if;
  if client_id = '' or target_game_id = '' or request_hash !~ '^[0-9a-f]{64}$'
    or command_name not in ('start', 'pause', 'set_remaining') or base_version < 1
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'laxhornet:r207-operation:' || actor_id::text || ':' || client_id, 0
  ));
  perform 1 from public.game_sync_operations
    where actor_user_id = actor_id and client_operation_id = client_id;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('laxhornet:legacy-game:' || target_game_id, 0)
  );

  select * into tombstone from public.legacy_game_tombstones where game_id = target_game_id;
  if found then
    if lh_sync_private.r207_tombstone_authority(actor_id, tombstone) then
      return jsonb_build_object('outcome', 'deleted', 'code', 'game_deleted');
    end if;
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  select * into target_game from public.games where id = target_game_id for update;
  if not found or not lh_sync_private.r207_current_authority(actor_id, target_game) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select * into stored_operation from public.game_sync_operations
  where actor_user_id = actor_id and client_operation_id = client_id;
  if found then
    if stored_operation.game_id <> target_game_id then
      insert into public.game_sync_operation_attempts(actor_user_id, client_operation_id, canonical_operation_id, attempt_code)
      values (actor_id, client_id, stored_operation.operation_id, 'duplicate_operation_id_scope_mismatch');
      return jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_id_scope_mismatch');
    elsif stored_operation.request_hash <> request_hash then
      insert into public.game_sync_operation_attempts(actor_user_id, client_operation_id, canonical_operation_id, attempt_code)
      values (actor_id, client_id, stored_operation.operation_id, 'duplicate_operation_id_payload_mismatch');
      return jsonb_build_object('outcome', 'rejected', 'code', 'duplicate_operation_id_payload_mismatch');
    end if;
    insert into public.game_sync_operation_attempts(actor_user_id, client_operation_id, canonical_operation_id, attempt_code)
    values (actor_id, client_id, stored_operation.operation_id, 'idempotent_replay');
    return stored_operation.canonical_result || jsonb_build_object('replay', true);
  end if;

  if expected_lifecycle is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'missing_expected_lifecycle');
  end if;
  if expected_lifecycle not in ('active', 'paused', 'completed') then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_expected_lifecycle');
  end if;
  if not (p_operation ? 'status_base_version') then
    return jsonb_build_object('outcome', 'rejected', 'code', 'missing_status_base_version');
  end if;
  begin
    status_base_version := (p_operation ->> 'status_base_version')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_status_base_version');
  end;
  if status_base_version is null or status_base_version < 1 then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_status_base_version');
  end if;
  if expected_lifecycle <> target_game.lifecycle_state then
    return jsonb_build_object('outcome', 'rejected', 'code', 'stale_lifecycle_state');
  end if;
  if status_base_version <> target_game.status_version then
    return jsonb_build_object('outcome', 'rejected', 'code', 'stale_status_version');
  end if;
  if target_game.lifecycle_state = 'completed' then
    return jsonb_build_object('outcome', 'rejected', 'code', 'completed_game_clock_change_forbidden');
  end if;

  select * into target_clock from public.lh_game_clock_states
  where game_id = target_game_id for update;
  if not found then
    return jsonb_build_object('outcome', 'rejected', 'code', 'clock_not_initialized');
  end if;

  if base_version <> target_clock.revision then
    conflict_uuid := gen_random_uuid();
    result := jsonb_build_object(
      'outcome', 'conflicted', 'code', 'stale_clock_revision',
      'conflict_id', conflict_uuid, 'clock_version', target_clock.revision
    );
    insert into public.game_sync_operations(
      operation_id, actor_user_id, client_operation_id, game_id, operation_type,
      request_hash, changed_fields, outcome_class, outcome_code, conflict_id,
      result_versions, canonical_result
    ) values (
      operation_uuid, actor_id, client_id, target_game_id, 'clock_' || command_name,
      request_hash, array['clock'], 'conflicted', 'stale_clock_revision', conflict_uuid,
      jsonb_build_object('clock', target_clock.revision), result
    );
    insert into public.game_conflicts(
      conflict_id, account_id, game_id, team_id, roster_player_id, actor_user_id,
      operation_id, conflict_type, field_group, client_base_version,
      current_server_version, overlapping_fields, current_values, proposed_values,
      audit_metadata
    ) values (
      conflict_uuid, target_game.user_id, target_game_id, target_game.team_id,
      target_game.roster_player_id, actor_id, operation_uuid, 'clock_stale', 'clock',
      base_version, target_clock.revision, array['clock'],
      jsonb_build_object('is_running', target_clock.is_running),
      jsonb_build_object('command', command_name),
      jsonb_build_object('protocol', 'r207a')
    );
    return result;
  end if;

  update public.lh_game_clock_states set
    is_running = case when command_name = 'start' then true when command_name = 'pause' then false else is_running end,
    clock_seconds_remaining = case when command_name = 'set_remaining'
      then (p_operation ->> 'clock_seconds_remaining')::integer else clock_seconds_remaining end,
    anchor_clock_seconds_remaining = case when command_name = 'set_remaining'
      then (p_operation ->> 'clock_seconds_remaining')::integer else clock_seconds_remaining end,
    anchor_server_at = statement_timestamp(),
    started_at = case when command_name = 'start' then statement_timestamp() else started_at end,
    paused_at = case when command_name = 'pause' then statement_timestamp() else paused_at end,
    revision = revision + 1,
    server_updated_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where game_id = target_game_id returning * into target_clock;

  result := jsonb_build_object(
    'outcome', 'accepted', 'code', 'clock_command_accepted',
    'clock_version', target_clock.revision,
    'anchor_server_at', target_clock.anchor_server_at,
    'anchor_clock_seconds_remaining', target_clock.anchor_clock_seconds_remaining,
    'replay', false
  );
  insert into public.game_sync_operations(
    operation_id, actor_user_id, client_operation_id, game_id, operation_type,
    request_hash, changed_fields, outcome_class, outcome_code,
    result_versions, canonical_result
  ) values (
    operation_uuid, actor_id, client_id, target_game_id, 'clock_' || command_name,
    request_hash, array['clock'], 'accepted', 'clock_command_accepted',
    jsonb_build_object('clock', target_clock.revision), result
  );
  insert into public.game_clock_commands(
    operation_id, game_id, batch_id, batch_sequence, command,
    base_clock_version, result_clock_version, clock_seconds_remaining
  ) values (
    operation_uuid, target_game_id, nullif(p_operation ->> 'batch_id', ''),
    case when p_operation ? 'batch_sequence' then (p_operation ->> 'batch_sequence')::integer end,
    command_name, base_version, target_clock.revision,
    case when command_name = 'set_remaining' then (p_operation ->> 'clock_seconds_remaining')::integer end
  );
  return result;
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_clock_operation');
end;
$function$;

create or replace function public.laxhornet_sync_game_v2(p_operation jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

create or replace function public.lh_apply_game_clock_operation_v2(p_operation jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

create or replace function public.lh_apply_game_clock_batch_v2(p_batch jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

create or replace function public.laxhornet_resolve_game_conflict_v1(p_resolution jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

create or replace function public.laxhornet_read_game_conflicts_v1(p_request jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

alter table public.game_sync_operations enable row level security;
alter table public.game_sync_operations force row level security;
alter table public.game_sync_operation_attempts enable row level security;
alter table public.game_sync_operation_attempts force row level security;
alter table public.game_field_changes enable row level security;
alter table public.game_field_changes force row level security;
alter table public.game_conflicts enable row level security;
alter table public.game_conflicts force row level security;
alter table public.game_conflict_resolutions enable row level security;
alter table public.game_conflict_resolutions force row level security;
alter table public.game_clock_commands enable row level security;
alter table public.game_clock_commands force row level security;
alter table public.r207_retention_control enable row level security;
alter table public.r207_retention_control force row level security;

revoke all on table public.game_sync_operations from public, anon, authenticated;
revoke all on table public.game_sync_operation_attempts from public, anon, authenticated;
revoke all on table public.game_field_changes from public, anon, authenticated;
revoke all on table public.game_conflicts from public, anon, authenticated;
revoke all on table public.game_conflict_resolutions from public, anon, authenticated;
revoke all on table public.game_clock_commands from public, anon, authenticated;
revoke all on table public.r207_retention_control from public, anon, authenticated;

revoke execute on function lh_sync_private.r207_forbid_history_mutation() from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_sorted_unique(text[]) from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_game_versions(public.games) from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_current_authority(uuid, public.games) from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_tombstone_authority(uuid, public.legacy_game_tombstones) from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_apply_game_operation_for_test(jsonb, boolean) from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_apply_clock_operation_for_test(jsonb) from public, anon, authenticated;

revoke execute on function public.laxhornet_sync_game_v2(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_apply_game_clock_operation_v2(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_apply_game_clock_batch_v2(jsonb) from public, anon, authenticated;
revoke execute on function public.laxhornet_resolve_game_conflict_v1(jsonb) from public, anon, authenticated;
revoke execute on function public.laxhornet_read_game_conflicts_v1(jsonb) from public, anon, authenticated;
grant execute on function public.laxhornet_sync_game_v2(jsonb) to authenticated;
grant execute on function public.lh_apply_game_clock_operation_v2(jsonb) to authenticated;
grant execute on function public.lh_apply_game_clock_batch_v2(jsonb) to authenticated;
grant execute on function public.laxhornet_resolve_game_conflict_v1(jsonb) to authenticated;
grant execute on function public.laxhornet_read_game_conflicts_v1(jsonb) to authenticated;

comment on table public.game_sync_operations is
  'R2-07A private immutable global idempotency and canonical-result journal. No app-role table access.';
comment on table public.game_field_changes is
  'R2-07A private immutable field-group revision proof for non-overlap decisions.';
comment on table public.game_conflicts is
  'R2-07A private immutable bounded conflict evidence. Current authority is never inferred from copied scope.';
comment on table public.game_clock_commands is
  'R2-07A private immutable optimistic clock command history; no device lease.';
comment on table public.r207_retention_control is
  'Retention execution is disabled. No purge function, trigger, cron, or approved duration exists.';
comment on function public.laxhornet_sync_game_v2(jsonb) is
  'Dormant R2-07A signature. Always returns r207_not_activated for authenticated callers until a separate activation migration.';

commit;
