-- R2-07 Forward Migration B: inert pre-cutover concurrency gate.
--
-- This migration does not enable R2-07 production writes and does not revoke
-- legacy authority. It makes every later canonical game/event/clock mutation
-- participate in the same transaction-scoped advisory gate used by the
-- separately applied activation and fail-closed recovery artifacts.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.r207_preview_control') is null
    or (select count(*) from public.r207_preview_control) <> 1
    or coalesce((select preview_enabled from public.r207_preview_control where control_id), true)
  then
    raise exception using errcode = 'P0001',
      message = 'R207_CUTOVER_GATE_PREFLIGHT_FAILED:CAPABILITY_NOT_DORMANT';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'r207_preview_control'
      and column_name = 'cutover_mode'
  ) then
    raise exception using errcode = 'P0001',
      message = 'R207_CUTOVER_GATE_ALREADY_INSTALLED';
  end if;
end;
$preflight$;

-- Drain statements planned before the trigger definitions become visible.
-- A later activation cannot overtake those queued writers because PostgreSQL
-- grants their already-waiting RowExclusive locks before the later cutover.
lock table public.games in access exclusive mode;
lock table public.events in access exclusive mode;
lock table public.lh_game_clock_states in access exclusive mode;

alter table public.r207_preview_control
  add column cutover_mode text not null default 'legacy'
  constraint r207_preview_control_cutover_mode_check
  check (cutover_mode in ('legacy', 'v2', 'fail_closed'));

create or replace function public.laxhornet_r207_cutover_write_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  mode text;
  versioned_write boolean := coalesce(
    pg_catalog.current_setting('laxhornet.r207_versioned_write', true),
    'false'
  ) = 'true';
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('laxhornet:r207-forward-migration-b-activation', 0)
  );
  select control.cutover_mode
  into mode
  from public.r207_preview_control as control
  where control.control_id;

  if mode = 'legacy' or (mode = 'v2' and versioned_write) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  raise exception using errcode = 'P0001',
    message = 'R207_LEGACY_MUTATION_DISABLED:client_upgrade_required';
end;
$function$;

revoke all on function public.laxhornet_r207_cutover_write_gate()
  from public, anon, authenticated;

create trigger laxhornet_r207_cutover_games
before insert or update or delete on public.games
for each row execute function public.laxhornet_r207_cutover_write_gate();

create trigger laxhornet_r207_cutover_events
before insert or update or delete on public.events
for each row execute function public.laxhornet_r207_cutover_write_gate();

create trigger laxhornet_r207_cutover_clock
before insert or update or delete on public.lh_game_clock_states
for each row execute function public.laxhornet_r207_cutover_write_gate();

comment on function public.laxhornet_r207_cutover_write_gate() is
  'Inert-until-activation canonical write gate. Legacy mode preserves existing writes; v2 and fail-closed modes reject unmarked mutation.';

commit;
