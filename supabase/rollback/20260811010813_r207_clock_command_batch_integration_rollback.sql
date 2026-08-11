-- R2-07 clock command/batch pre-activation rollback.
-- Refuse after any command accepted through this integration so immutable
-- clock evidence is never discarded.

begin;

do $rollback$
begin
  if exists (select 1 from public.game_clock_batches)
    or exists (
      select 1 from public.game_clock_commands
      where device_id is not null
        or client_occurred_at is not null
        or current_period is not null
        or command not in ('start', 'pause', 'set_remaining')
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'R2-07 clock rollback refused: immutable command/batch evidence exists';
  end if;
end;
$rollback$;

create or replace function public.lh_apply_game_clock_operation_v2(p_operation jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

create or replace function public.lh_apply_game_clock_batch_v2(p_batch jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('outcome', 'rejected', 'code', 'authentication_required');
  end if;
  return jsonb_build_object('outcome', 'rejected', 'code', 'r207_not_activated');
end;
$function$;

revoke execute on function public.lh_apply_game_clock_operation_v2(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_apply_game_clock_batch_v2(jsonb)
  from public, anon, authenticated;
grant execute on function public.lh_apply_game_clock_operation_v2(jsonb)
  to authenticated;
grant execute on function public.lh_apply_game_clock_batch_v2(jsonb)
  to authenticated;

drop function lh_sync_private.r207_apply_clock_batch(jsonb, boolean);
drop function lh_sync_private.r207_apply_clock_operation(jsonb, boolean);
drop function lh_sync_private.r207_clock_command_locked(uuid, jsonb, text, text, integer, boolean);
drop function lh_sync_private.r207_clock_operation_shape_valid(jsonb, boolean);
drop function lh_sync_private.r207_clock_request_hash(jsonb);
drop function lh_sync_private.r207_clock_payload(text, timestamptz);
drop function lh_sync_private.r207_clock_current_remaining(public.lh_game_clock_states, timestamptz);

drop table public.game_clock_batches;

alter table public.game_clock_commands
  drop constraint game_clock_commands_command_check,
  drop constraint game_clock_commands_base_clock_version_check,
  drop constraint game_clock_commands_device_r207clock_check,
  drop constraint game_clock_commands_period_r207clock_check,
  drop column device_id,
  drop column client_occurred_at,
  drop column current_period,
  add constraint game_clock_commands_command_check
    check (command in ('start', 'pause', 'set_remaining')),
  add constraint game_clock_commands_base_clock_version_check
    check (base_clock_version >= 1);

alter table public.game_sync_operations
  drop constraint game_sync_operations_type_r207_check,
  add constraint game_sync_operations_type_r207_check check (operation_type in (
    'metadata_patch', 'score_delta', 'score_correction', 'status_transition',
    'roster_context_patch', 'sharing_patch', 'clock_start', 'clock_pause',
    'clock_set_remaining', 'clock_batch', 'conflict_resolution'
  ));

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

comment on function public.lh_apply_game_clock_operation_v2(jsonb) is
  'R2-07A dormant public clock-operation contract. No v2 write is activated.';
comment on function public.lh_apply_game_clock_batch_v2(jsonb) is
  'R2-07A dormant public clock-batch contract. No v2 write is activated.';

commit;
