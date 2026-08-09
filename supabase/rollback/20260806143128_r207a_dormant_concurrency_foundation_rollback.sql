-- R2-07A pre-activation rollback only.
-- Refuse destructive rollback after any R2-07 evidence exists. After activation
-- or evidence creation, repair forward and retain immutable history.

begin;

do $block$
begin
  if exists (select 1 from public.game_sync_operations)
    or exists (select 1 from public.game_sync_operation_attempts)
    or exists (select 1 from public.game_field_changes)
    or exists (select 1 from public.game_conflicts)
    or exists (select 1 from public.game_conflict_resolutions)
    or exists (select 1 from public.game_clock_commands)
  then
    raise exception using
      errcode = 'P0001',
      message = 'R207A_ROLLBACK_REFUSED_EVIDENCE_EXISTS';
  end if;

  if exists (
    select 1 from public.games
    where game_revision <> 1
      or metadata_version <> 1
      or score_version <> 1
      or status_version <> 1
      or roster_context_version <> 1
      or sharing_version <> 1
      or score_known
      or score_for <> 0
      or score_against <> 0
      or final_score_for is not null
      or final_score_against is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'R207A_ROLLBACK_REFUSED_VERSIONED_GAME_STATE_EXISTS';
  end if;

  if exists (
    select 1 from public.lh_game_clock_states
    where revision > 2147483647
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'R207A_ROLLBACK_REFUSED_CLOCK_REVISION_OUT_OF_RANGE';
  end if;
end;
$block$;

drop function if exists public.laxhornet_read_game_conflicts_v1(jsonb);
drop function if exists public.laxhornet_resolve_game_conflict_v1(jsonb);
drop function if exists public.lh_apply_game_clock_batch_v2(jsonb);
drop function if exists public.lh_apply_game_clock_operation_v2(jsonb);
drop function if exists public.laxhornet_sync_game_v2(jsonb);
drop function if exists lh_sync_private.r207_apply_clock_operation_for_test(jsonb);
drop function if exists lh_sync_private.r207_apply_game_operation_for_test(jsonb, boolean);
drop function if exists lh_sync_private.r207_tombstone_authority(uuid, public.legacy_game_tombstones);
drop function if exists lh_sync_private.r207_current_authority(uuid, public.games);
drop function if exists lh_sync_private.r207_game_versions(public.games);
drop function if exists lh_sync_private.r207_sorted_unique(text[]);

drop table public.r207_retention_control;
drop table public.game_clock_commands;
drop table public.game_conflict_resolutions;
alter table public.game_sync_operations
  drop constraint game_sync_operations_conflict_r207_fk;
drop table public.game_conflicts;
drop table public.game_field_changes;
drop table public.game_sync_operation_attempts;
drop table public.game_sync_operations;
drop function if exists lh_sync_private.r207_forbid_history_mutation();

alter table public.lh_game_clock_states
  drop constraint lh_game_clock_states_anchor_remaining_r207_check,
  drop column anchor_server_at,
  drop column anchor_clock_seconds_remaining,
  alter column revision type integer;

alter table public.games
  drop constraint games_game_revision_r207_check,
  drop constraint games_metadata_version_r207_check,
  drop constraint games_score_version_r207_check,
  drop constraint games_status_version_r207_check,
  drop constraint games_roster_context_version_r207_check,
  drop constraint games_sharing_version_r207_check,
  drop constraint games_lifecycle_state_r207_check,
  drop constraint games_score_r207_check,
  drop constraint games_final_score_r207_check,
  drop column game_revision,
  drop column metadata_version,
  drop column score_version,
  drop column status_version,
  drop column roster_context_version,
  drop column sharing_version,
  drop column lifecycle_state,
  drop column score_for,
  drop column score_against,
  drop column score_known,
  drop column final_score_for,
  drop column final_score_against;

commit;
