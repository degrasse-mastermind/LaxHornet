-- LH-25 pre-activation rollback.
-- Refuse to discard any accepted or merged composite receipt because the
-- corresponding child event and score journals are immutable evidence.

begin;

do $rollback$
begin
  if exists (
    select 1
    from public.atomic_scored_event_operations
    where outcome_class in ('accepted', 'merged')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'LH25_ATOMIC_SCORED_EVENT_ROLLBACK_REFUSED:ACCEPTED_EVIDENCE_EXISTS';
  end if;
end;
$rollback$;

revoke execute on function public.laxhornet_apply_scored_event_v1(jsonb)
  from public, anon, authenticated;

drop function public.laxhornet_apply_scored_event_v1(jsonb);
drop function lh_sync_private.r207_apply_atomic_scored_event(jsonb, boolean, boolean);
drop function lh_sync_private.r207_atomic_result_class(jsonb);
drop function lh_sync_private.r207_scoring_effect(text);

drop trigger atomic_scored_event_operation_attempts_append_only
  on public.atomic_scored_event_operation_attempts;
drop trigger atomic_scored_event_operations_append_only
  on public.atomic_scored_event_operations;

drop table public.atomic_scored_event_operation_attempts;
drop table public.atomic_scored_event_operations;

commit;
