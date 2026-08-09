-- R2-07D production-minimum conflict resolution foundation. This migration
-- remains default-off behind the existing R2-07 Preview control. It does not
-- activate production writes, change the v1 contract, or enable retention.

begin;

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
              or item.value #>> '{}' not in ('start', 'pause', 'set_remaining')
            ))
            or (item.key = 'is_running' and jsonb_typeof(item.value) <> 'boolean')
        )
      else false
    end;
$function$;

alter table public.game_conflicts
  add constraint game_conflicts_fields_r207d_check check (
    overlapping_fields <@ array[
      'clock', 'game_date', 'game_type', 'is_shared', 'lifecycle_state',
      'location', 'opponent', 'player_id', 'score_against', 'score_for'
    ]::text[]
    and lh_sync_private.r207_sorted_unique(overlapping_fields)
  ),
  add constraint game_conflicts_bounded_values_r207d_check check (
    lh_sync_private.r207_conflict_values_valid(field_group, current_values)
    and lh_sync_private.r207_conflict_values_valid(field_group, proposed_values)
  );

create or replace function lh_sync_private.r207_conflict_current_authority(p_game_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.games as game_row
    where game_row.id = p_game_id
      and (
        (game_row.team_id is null and game_row.user_id = (select auth.uid()))
        or (
          game_row.team_id is not null
          and (select public.laxhornet_can_track_roster_player(
            game_row.team_id,
            game_row.roster_player_id
          ))
        )
        or (select public.laxhornet_is_platform_reviewer())
      )
  )
  and not exists (
    select 1 from public.legacy_game_tombstones as tombstone
    where tombstone.game_id = p_game_id
  );
$function$;

create or replace function lh_sync_private.r207_conflict_versions(p_game public.games)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select lh_sync_private.r207_game_versions(p_game) || jsonb_build_object(
    'clock', coalesce((
      select clock_row.revision
      from public.lh_game_clock_states as clock_row
      where clock_row.game_id = p_game.id
    ), 0)
  );
$function$;

drop policy if exists game_conflicts_select_r207d on public.game_conflicts;
create policy game_conflicts_select_r207d
on public.game_conflicts
for select
to authenticated
using (lh_sync_private.r207_conflict_current_authority(game_id));

drop policy if exists game_conflict_resolutions_select_r207d on public.game_conflict_resolutions;
create policy game_conflict_resolutions_select_r207d
on public.game_conflict_resolutions
for select
to authenticated
using (
  exists (
    select 1
    from public.game_conflicts as conflict
    where conflict.conflict_id = game_conflict_resolutions.conflict_id
      and lh_sync_private.r207_conflict_current_authority(conflict.game_id)
  )
);

grant select on table public.game_conflicts to authenticated;
grant select on table public.game_conflict_resolutions to authenticated;

create or replace function public.laxhornet_read_game_conflicts_v1(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  target_game_id text := btrim(coalesce(p_request ->> 'game_id', ''));
  include_resolved boolean := coalesce((p_request ->> 'include_resolved')::boolean, false);
  target_game public.games%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
  summaries jsonb;
begin
  if not coalesce((select preview_enabled from public.r207_preview_control where control_id), false) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
  end if;
  if actor_id is null or target_game_id = '' or length(target_game_id) > 200 then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

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
  for share;
  if not found or not lh_sync_private.r207_current_authority(actor_id, target_game) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;

  select coalesce(jsonb_agg(summary order by summary ->> 'created_at'), '[]'::jsonb)
  into summaries
  from (
    select jsonb_build_object(
      'conflict_id', conflict.conflict_id,
      'game_id', conflict.game_id,
      'field_group', conflict.field_group,
      'overlapping_fields', conflict.overlapping_fields,
      'current_values', conflict.current_values,
      'proposed_values', conflict.proposed_values,
      'server_versions', lh_sync_private.r207_conflict_versions(target_game),
      'resolution_status', case
        when terminal.action = 'superseded_by_delete' then 'superseded_by_delete'
        when terminal.resolution_id is not null then 'resolved'
        else 'open'
      end,
      'resolved_at', terminal.resolved_at,
      'created_at', conflict.created_at
    ) as summary
    from public.game_conflicts as conflict
    left join lateral (
      select resolution.resolution_id, resolution.action, resolution.resolved_at
      from public.game_conflict_resolutions as resolution
      where resolution.conflict_id = conflict.conflict_id
        and resolution.outcome_code in (
          'resolution_applied', 'resolution_dismissed', 'resolution_kept',
          'superseded_by_delete'
        )
      order by resolution.resolved_at desc
      limit 1
    ) as terminal on true
    where conflict.game_id = target_game_id
      and (
        include_resolved
        or (
          terminal.resolution_id is null
          and not exists (
            select 1 from public.game_conflicts as child
            where child.parent_conflict_id = conflict.conflict_id
          )
        )
      )
    order by conflict.created_at
    limit 50
  ) as bounded;

  return jsonb_build_object(
    'outcome', 'accepted',
    'code', 'conflicts_read',
    'game_id', target_game_id,
    'conflicts', summaries
  );
exception
  when invalid_text_representation then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_request');
end;
$function$;

create or replace function public.laxhornet_resolve_game_conflict_v1(p_resolution jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
<<r207_resolve>>
declare
  actor_id uuid := (select auth.uid());
  client_id text := btrim(coalesce(p_resolution ->> 'client_resolution_operation_id', ''));
  target_game_id text := btrim(coalesce(p_resolution ->> 'game_id', ''));
  action_name text := btrim(coalesce(p_resolution ->> 'action', ''));
  request_hash text;
  calculated_hash text;
  conflict_uuid uuid;
  expected_version bigint;
  current_version bigint;
  expected_versions jsonb := coalesce(p_resolution -> 'expected_versions', '{}'::jsonb);
  patch jsonb := coalesce(p_resolution -> 'patch', '{}'::jsonb);
  changed_fields text[];
  target_game public.games%rowtype;
  target_clock public.lh_game_clock_states%rowtype;
  tombstone public.legacy_game_tombstones%rowtype;
  conflict public.game_conflicts%rowtype;
  stored_operation public.game_sync_operations%rowtype;
  stored_resolution public.game_conflict_resolutions%rowtype;
  operation_uuid uuid := gen_random_uuid();
  stale_conflict_uuid uuid;
  current_values jsonb := '{}'::jsonb;
  proposed_values jsonb := '{}'::jsonb;
  apply_operation jsonb;
  apply_result jsonb;
  result jsonb;
  outcome_code text;
begin
  if not coalesce((select preview_enabled from public.r207_preview_control where control_id), false) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
  end if;
  if actor_id is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authorization_denied');
  end if;
  begin
    conflict_uuid := (p_resolution ->> 'conflict_id')::uuid;
  exception when others then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_resolution');
  end;
  calculated_hash := encode(
    extensions.digest(convert_to((p_resolution - 'request_hash')::text, 'UTF8'), 'sha256'),
    'hex'
  );
  request_hash := calculated_hash;
  if client_id = '' or length(client_id) > 200
    or target_game_id = '' or length(target_game_id) > 200
    or action_name not in ('keep_server', 'apply_proposed', 'apply_patch', 'dismiss')
    or jsonb_typeof(expected_versions) <> 'object'
    or jsonb_typeof(patch) <> 'object'
    or pg_column_size(patch) > 4096
    or (action_name <> 'apply_patch' and patch <> '{}'::jsonb)
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_resolution');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'laxhornet:r207-operation:' || actor_id::text || ':' || client_id,
    0
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
    end if;
    select resolution_row.* into stored_resolution
    from public.game_conflict_resolutions as resolution_row
    where resolution_row.resolver_user_id = actor_id
      and resolution_row.client_resolution_operation_id = client_id;
    if stored_operation.request_hash <> request_hash
      or not found
      or stored_resolution.conflict_id <> conflict_uuid
    then
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
    return stored_operation.canonical_result || jsonb_build_object(
      'conflict_id', conflict_uuid,
      'resolution_status', case
        when stored_resolution.outcome_code = 'resolution_stale' then 'open'
        else 'resolved'
      end,
      'replay', true
    );
  end if;

  select conflict_row.* into conflict
  from public.game_conflicts as conflict_row
  where conflict_row.conflict_id = conflict_uuid
    and conflict_row.game_id = target_game_id;
  if not found then
    return jsonb_build_object('outcome', 'rejected', 'code', 'conflict_not_found');
  end if;
  if exists (
    select 1 from public.game_conflict_resolutions as resolution
    where resolution.conflict_id = conflict_uuid
      and resolution.outcome_code in (
        'resolution_applied', 'resolution_dismissed', 'resolution_kept',
        'superseded_by_delete'
      )
  ) then
    return jsonb_build_object('outcome', 'rejected', 'code', 'conflict_already_resolved');
  end if;

  if conflict.field_group = 'clock' then
    select clock_row.* into target_clock
    from public.lh_game_clock_states as clock_row
    where clock_row.game_id = target_game_id
    for update;
    if not found then
      return jsonb_build_object('outcome', 'rejected', 'code', 'clock_not_initialized');
    end if;
    current_version := target_clock.revision;
    current_values := jsonb_build_object(
      'is_running', target_clock.is_running,
      'clock_seconds_remaining', target_clock.clock_seconds_remaining
    );
  else
    current_version := case conflict.field_group
      when 'metadata' then target_game.metadata_version
      when 'score' then target_game.score_version
      when 'status' then target_game.status_version
      when 'roster_context' then target_game.roster_context_version
      when 'sharing' then target_game.sharing_version
    end;
    current_values := case conflict.field_group
      when 'metadata' then jsonb_strip_nulls(jsonb_build_object(
        'opponent', target_game.opponent,
        'game_date', target_game.game_date,
        'location', target_game.location,
        'game_type', target_game.game_type
      ))
      when 'score' then jsonb_build_object(
        'score_for', target_game.score_for,
        'score_against', target_game.score_against
      )
      when 'status' then jsonb_build_object('lifecycle_state', target_game.lifecycle_state)
      when 'roster_context' then jsonb_build_object('player_id', target_game.player_id)
      when 'sharing' then jsonb_build_object('is_shared', target_game.is_shared)
    end;
  end if;

  begin
    expected_version := (expected_versions ->> conflict.field_group)::bigint;
  exception when others then
    expected_version := null;
  end;
  proposed_values := case
    when action_name = 'apply_patch' then patch
    else conflict.proposed_values
  end;
  if expected_version is null or expected_version <> current_version then
    stale_conflict_uuid := gen_random_uuid();
    result := jsonb_build_object(
      'outcome', 'conflicted',
      'code', 'resolution_stale',
      'conflict_id', stale_conflict_uuid,
      'parent_conflict_id', conflict_uuid,
      'field_group', conflict.field_group,
      'server_versions', lh_sync_private.r207_conflict_versions(target_game),
      'resolution_status', 'open',
      'replay', false
    );
    insert into public.game_sync_operations(
      operation_id, actor_user_id, client_operation_id, game_id, operation_type,
      request_hash, changed_fields, outcome_class, outcome_code, conflict_id,
      result_versions, canonical_result
    ) values (
      operation_uuid, actor_id, client_id, target_game_id, 'conflict_resolution',
      request_hash, conflict.overlapping_fields, 'conflicted', 'resolution_stale',
      stale_conflict_uuid, lh_sync_private.r207_conflict_versions(target_game), result
    );
    insert into public.game_conflicts(
      conflict_id, account_id, game_id, team_id, roster_player_id,
      actor_user_id, operation_id, parent_conflict_id, conflict_type,
      field_group, client_base_version, current_server_version,
      overlapping_fields, current_values, proposed_values, audit_metadata
    ) values (
      stale_conflict_uuid, target_game.user_id, target_game_id, target_game.team_id,
      target_game.roster_player_id, actor_id, operation_uuid, conflict_uuid,
      'resolution_stale', conflict.field_group, conflict.current_server_version,
      current_version, conflict.overlapping_fields, current_values, proposed_values,
      jsonb_build_object('protocol', 'r207d', 'resolution_action', action_name)
    );
    insert into public.game_conflict_resolutions(
      conflict_id, resolver_user_id, client_resolution_operation_id,
      request_hash, action, outcome_code, result_versions, accepted_fields
    ) values (
      conflict_uuid, actor_id, client_id, request_hash, action_name,
      'resolution_stale', lh_sync_private.r207_conflict_versions(target_game),
      '{}'::text[]
    );
    return result || jsonb_build_object(
      'conflict', jsonb_build_object(
        'conflict_id', stale_conflict_uuid,
        'game_id', target_game_id,
        'field_group', conflict.field_group,
        'overlapping_fields', conflict.overlapping_fields,
        'current_values', current_values,
        'proposed_values', proposed_values,
        'server_versions', lh_sync_private.r207_conflict_versions(target_game),
        'resolution_status', 'open',
        'created_at', statement_timestamp()
      )
    );
  end if;

  if action_name in ('keep_server', 'dismiss') then
    outcome_code := case action_name
      when 'keep_server' then 'resolution_kept'
      else 'resolution_dismissed'
    end;
    result := jsonb_build_object(
      'outcome', 'accepted',
      'code', outcome_code,
      'conflict_id', conflict_uuid,
      'server_versions', lh_sync_private.r207_conflict_versions(target_game),
      'resolution_status', 'resolved',
      'replay', false
    );
    insert into public.game_sync_operations(
      operation_id, actor_user_id, client_operation_id, game_id, operation_type,
      request_hash, changed_fields, outcome_class, outcome_code, conflict_id,
      result_versions, canonical_result
    ) values (
      operation_uuid, actor_id, client_id, target_game_id, 'conflict_resolution',
      request_hash, '{}'::text[], 'accepted', outcome_code, conflict_uuid,
      lh_sync_private.r207_conflict_versions(target_game), result
    );
    insert into public.game_conflict_resolutions(
      conflict_id, resolver_user_id, client_resolution_operation_id,
      request_hash, action, outcome_code, result_versions, accepted_fields
    ) values (
      conflict_uuid, actor_id, client_id, request_hash, action_name, outcome_code,
      lh_sync_private.r207_conflict_versions(target_game), '{}'::text[]
    );
    return result;
  end if;

  if not lh_sync_private.r207_conflict_values_valid(conflict.field_group, proposed_values)
    or proposed_values = '{}'::jsonb
  then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_resolution_patch');
  end if;
  select coalesce(array_agg(key order by key), '{}'::text[])
  into changed_fields
  from jsonb_object_keys(proposed_values) as key;

  if conflict.field_group = 'clock' then
    apply_operation := jsonb_build_object(
      'client_operation_id', client_id,
      'game_id', target_game_id,
      'request_hash', request_hash,
      'command', proposed_values ->> 'command',
      'base_clock_version', current_version,
      'expected_lifecycle', target_game.lifecycle_state,
      'status_base_version', target_game.status_version
    );
    if proposed_values ? 'clock_seconds_remaining' then
      apply_operation := apply_operation || jsonb_build_object(
        'clock_seconds_remaining', proposed_values -> 'clock_seconds_remaining'
      );
    end if;
    apply_result := lh_sync_private.r207_apply_clock_operation_for_test(apply_operation);
  else
    if conflict.field_group = 'score' then
      proposed_values := jsonb_build_object(
        'score_for', coalesce((proposed_values ->> 'score_for')::integer, target_game.score_for),
        'score_against', coalesce((proposed_values ->> 'score_against')::integer, target_game.score_against)
      );
    end if;
    apply_operation := jsonb_build_object(
      'client_operation_id', client_id,
      'game_id', target_game_id,
      'request_hash', request_hash,
      'operation_type', case conflict.field_group
        when 'metadata' then 'metadata_patch'
        when 'score' then 'score_correction'
        when 'status' then 'status_transition'
        when 'roster_context' then 'roster_context_patch'
        when 'sharing' then 'sharing_patch'
      end,
      'field_group', conflict.field_group,
      'base_version', current_version,
      'changed_fields', to_jsonb(changed_fields),
      'changes', proposed_values,
      'expected_lifecycle', target_game.lifecycle_state,
      'status_base_version', target_game.status_version
    );
    if conflict.field_group = 'score' and target_game.lifecycle_state = 'completed' then
      apply_operation := apply_operation || jsonb_build_object(
        'correction_reason', coalesce(
          nullif(p_resolution ->> 'correction_reason', ''),
          'data_entry_correction'
        )
      );
    end if;
    apply_result := lh_sync_private.r207_apply_game_operation_for_test(apply_operation, false);
  end if;

  if apply_result ->> 'outcome' not in ('accepted', 'merged') then
    return jsonb_build_object(
      'outcome', 'rejected',
      'code', 'resolution_apply_failed'
    );
  end if;
  result := apply_result || jsonb_build_object(
    'code', 'resolution_applied',
    'conflict_id', conflict_uuid,
    'resolution_status', 'resolved',
    'replay', false
  );
  insert into public.game_conflict_resolutions(
    conflict_id, resolver_user_id, client_resolution_operation_id,
    request_hash, action, outcome_code, result_versions, accepted_fields
  ) values (
    conflict_uuid, actor_id, client_id, request_hash, action_name,
    'resolution_applied', coalesce(apply_result -> 'versions', '{}'::jsonb),
    changed_fields
  );
  return result;
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('outcome', 'rejected', 'code', 'invalid_resolution');
end;
$function$;

create or replace function lh_sync_private.r207_close_conflicts_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.game_conflict_resolutions(
    conflict_id, resolver_user_id, client_resolution_operation_id,
    request_hash, action, outcome_code, result_versions, accepted_fields,
    resolved_at
  )
  select
    conflict.conflict_id,
    new.deleted_by,
    left('delete:' || new.deletion_id || ':' || conflict.conflict_id::text, 200),
    encode(extensions.digest(convert_to(
      new.deletion_id || ':' || conflict.conflict_id::text,
      'UTF8'
    ), 'sha256'), 'hex'),
    'superseded_by_delete',
    'superseded_by_delete',
    '{}'::jsonb,
    '{}'::text[],
    new.deleted_at
  from public.game_conflicts as conflict
  where conflict.game_id = new.game_id
    and not exists (
      select 1 from public.game_conflict_resolutions as resolution
      where resolution.conflict_id = conflict.conflict_id
        and resolution.outcome_code in (
          'resolution_applied', 'resolution_dismissed', 'resolution_kept',
          'superseded_by_delete'
        )
    );
  return new;
end;
$function$;

drop trigger if exists legacy_game_tombstones_close_conflicts_r207d
on public.legacy_game_tombstones;
create trigger legacy_game_tombstones_close_conflicts_r207d
after insert on public.legacy_game_tombstones
for each row execute function lh_sync_private.r207_close_conflicts_on_delete();

revoke execute on function lh_sync_private.r207_conflict_values_valid(text, jsonb)
  from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_conflict_current_authority(text)
  from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_conflict_versions(public.games)
  from public, anon, authenticated;
revoke execute on function lh_sync_private.r207_close_conflicts_on_delete()
  from public, anon, authenticated;
revoke execute on function public.laxhornet_read_game_conflicts_v1(jsonb)
  from public, anon, authenticated;
revoke execute on function public.laxhornet_resolve_game_conflict_v1(jsonb)
  from public, anon, authenticated;
grant execute on function lh_sync_private.r207_conflict_current_authority(text)
  to authenticated;
grant execute on function public.laxhornet_read_game_conflicts_v1(jsonb)
  to authenticated;
grant execute on function public.laxhornet_resolve_game_conflict_v1(jsonb)
  to authenticated;

comment on function public.laxhornet_read_game_conflicts_v1(jsonb) is
  'R2-07D bounded private conflict read. Default-off and current-authority/tombstone checked.';
comment on function public.laxhornet_resolve_game_conflict_v1(jsonb) is
  'R2-07D append-only conflict resolution. Default-off, idempotent, version checked, and delete terminal.';

commit;
