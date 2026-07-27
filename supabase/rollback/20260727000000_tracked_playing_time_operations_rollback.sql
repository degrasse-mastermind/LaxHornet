-- Rollback reference for the private Tracked Playing Time foundation.
-- This rollback refuses to destroy accepted participation history.

begin;

do $$
begin
  if to_regclass('public.lh_participation_operations') is not null
    and exists (select 1 from public.lh_participation_operations limit 1)
  then
    raise exception
      'Rollback refused: export or explicitly dispose of tracked playing time participation history first.';
  end if;
end;
$$;

revoke execute on function public.lh_initialize_game_clock(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_update_game_clock(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_reconcile_game_clock(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_read_game_clock(text) from public, anon, authenticated;
revoke execute on function public.lh_create_participation_operation(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_correct_participation_operation(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_tombstone_participation_operation(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_list_effective_participation(text) from public, anon, authenticated;
revoke execute on function public.lh_reconcile_participation_operations(jsonb) from public, anon, authenticated;

drop function if exists public.lh_reconcile_participation_operations(jsonb);
drop function if exists public.lh_list_effective_participation(text);
drop function if exists public.lh_tombstone_participation_operation(jsonb);
drop function if exists public.lh_correct_participation_operation(jsonb);
drop function if exists public.lh_create_participation_operation(jsonb);
drop function if exists public.lh_read_game_clock(text);
drop function if exists public.lh_reconcile_game_clock(jsonb);
drop function if exists public.lh_update_game_clock(jsonb);
drop function if exists public.lh_initialize_game_clock(jsonb);

drop function if exists lh_trust_private.lh_reconcile_participation_operations_impl(jsonb);
drop function if exists lh_trust_private.lh_list_effective_participation_impl(text);
drop function if exists lh_trust_private.lh_tombstone_participation_operation_impl(jsonb);
drop function if exists lh_trust_private.lh_correct_participation_operation_impl(jsonb);
drop function if exists lh_trust_private.lh_create_participation_operation_impl(jsonb);
drop function if exists lh_trust_private.lh_participation_replay(text, text);
drop function if exists lh_trust_private.lh_read_game_clock_impl(text);
drop function if exists lh_trust_private.lh_update_game_clock_impl(jsonb);
drop function if exists lh_trust_private.lh_initialize_game_clock_impl(jsonb);
drop function if exists lh_trust_private.lh_tracked_time_can_read(uuid, text);
drop function if exists lh_trust_private.lh_tracked_time_mutation_grant(uuid, text);
drop function if exists lh_trust_private.lh_tracked_time_initialize_scope(uuid, text);
drop function if exists lh_trust_private.lh_tracked_time_clock_payload(text);
drop function if exists lh_trust_private.lh_tracked_time_valid_period(text, text);
drop function if exists lh_trust_private.lh_tracked_time_request_hash(jsonb);

drop view if exists public.lh_effective_participation_operations;

alter table if exists public.lh_participation_logical_events
  drop constraint if exists lh_participation_logical_events_current_operation_fk;
drop table if exists public.lh_participation_operations;
drop table if exists public.lh_participation_logical_events;
drop table if exists public.lh_game_clock_states;

drop function if exists lh_trust_private.lh_tracked_time_protect_logical_identity();
drop function if exists lh_trust_private.lh_tracked_time_forbid_operation_mutation();

commit;
