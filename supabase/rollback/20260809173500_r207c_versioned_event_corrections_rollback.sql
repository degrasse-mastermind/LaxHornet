do $rollback$
begin
  if to_regclass('public.legacy_event_sync_operations') is not null
    and exists (select 1 from public.legacy_event_sync_operations)
  then
    raise exception 'r207c_rollback_refused_after_event_operation_evidence';
  end if;
end;
$rollback$;

drop function if exists public.laxhornet_sync_event_v2(jsonb);
drop function if exists lh_sync_private.r207_event_values_valid(jsonb, boolean);
drop table if exists public.legacy_event_tombstones;
drop table if exists public.legacy_event_field_changes;
drop table if exists public.legacy_event_sync_operation_attempts;
drop table if exists public.legacy_event_sync_operations;
alter table public.events drop column if exists event_lifecycle_state;
alter table public.events drop column if exists server_event_version;
