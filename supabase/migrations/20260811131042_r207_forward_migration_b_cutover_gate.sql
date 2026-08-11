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
  then
    raise exception using errcode = 'P0001',
      message = 'R207_CUTOVER_GATE_PREFLIGHT_FAILED:CAPABILITY_SHAPE';
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
  if coalesce((select preview_enabled from public.r207_preview_control where control_id), false)
    and (
      pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_functiondef(
        'public.laxhornet_sync_game(jsonb)'::regprocedure
      ), pg_catalog.chr(13), '')) <> '5ed65c9a743d18d894389940402f5331'
      or pg_catalog.has_table_privilege('authenticated', 'public.games', 'update')
      or pg_catalog.has_table_privilege('authenticated', 'public.events', 'update')
      or pg_catalog.has_function_privilege('authenticated', 'public.lh_update_game_clock(jsonb)', 'execute')
      or not pg_catalog.has_function_privilege('authenticated', 'public.laxhornet_sync_game_v2(jsonb)', 'execute')
    )
  then
    raise exception using errcode = 'P0001',
      message = 'R207_CUTOVER_GATE_PREFLIGHT_FAILED:ACTIVE_STATE_DRIFT';
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

-- A v2 writer proves its authority with a transaction/backend-scoped row that
-- only the reviewed SECURITY DEFINER functions can issue. Persisted rows are
-- harmless after commit because transaction IDs are never reused concurrently.
create table lh_sync_private.r207_write_authorizations (
  backend_pid integer not null,
  transaction_id xid8 not null,
  authorized_at timestamptz not null default statement_timestamp(),
  primary key (backend_pid, transaction_id)
);

revoke all on table lh_sync_private.r207_write_authorizations
  from public, anon, authenticated;

create or replace function lh_sync_private.r207_authorize_versioned_write()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from lh_sync_private.r207_write_authorizations
  where backend_pid = pg_catalog.pg_backend_pid()
     or authorized_at < statement_timestamp() - interval '1 day';

  insert into lh_sync_private.r207_write_authorizations(backend_pid, transaction_id)
  values (pg_catalog.pg_backend_pid(), pg_catalog.pg_current_xact_id())
  on conflict do nothing;
end;
$function$;

revoke all on function lh_sync_private.r207_authorize_versioned_write()
  from public, anon, authenticated;

-- Instrument only definitions whose exact pre-activation hashes are certified
-- by the activation preflight. This keeps historical dormant migrations intact.
create or replace function lh_sync_private.r207_instrument_versioned_writer(
  p_function regprocedure
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  definition text := pg_catalog.pg_get_functiondef(p_function);
  marker constant text := 'perform lh_sync_private.r207_authorize_versioned_write();';
begin
  if pg_catalog.strpos(pg_catalog.lower(definition), marker) > 0 then
    return;
  end if;
  if definition !~* '[[:space:]]+begin[[:space:]]+' then
    raise exception using errcode = 'P0001',
      message = 'R207_VERSIONED_WRITER_INSTRUMENTATION_FAILED:' || p_function::text;
  end if;
  definition := pg_catalog.regexp_replace(
    definition,
    '[[:space:]]+begin[[:space:]]+',
    E'\nbegin\n  perform lh_sync_private.r207_authorize_versioned_write();\n',
    'i'
  );
  execute definition;
end;
$function$;

revoke all on function lh_sync_private.r207_instrument_versioned_writer(regprocedure)
  from public, anon, authenticated;

-- A persistent isolated PR Preview may already contain an earlier reviewed
-- activation attempt. Repair only that exact active shape by installing the
-- same private transaction authorization the fresh activation installs. A
-- fresh dormant target remains in legacy mode with unchanged v2 definitions.
do $active_preview_repair$
begin
  if coalesce((select preview_enabled from public.r207_preview_control where control_id), false) then
    perform lh_sync_private.r207_instrument_versioned_writer('public.laxhornet_sync_game_v2(jsonb)'::regprocedure);
    perform lh_sync_private.r207_instrument_versioned_writer('public.laxhornet_sync_event_v2(jsonb)'::regprocedure);
    perform lh_sync_private.r207_instrument_versioned_writer('public.lh_apply_game_clock_operation_v2(jsonb)'::regprocedure);
    perform lh_sync_private.r207_instrument_versioned_writer('public.lh_apply_game_clock_batch_v2(jsonb)'::regprocedure);
    perform lh_sync_private.r207_instrument_versioned_writer('public.laxhornet_resolve_game_conflict_v1(jsonb)'::regprocedure);
    perform lh_sync_private.r207_instrument_versioned_writer('public.laxhornet_delete_game_durable(jsonb)'::regprocedure);
    update public.r207_preview_control set cutover_mode = 'v2' where control_id;
  end if;
end;
$active_preview_repair$;

create or replace function public.laxhornet_r207_cutover_write_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  mode text;
  versioned_write boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('laxhornet:r207-forward-migration-b-activation', 0)
  );
  select control.cutover_mode
  into mode
  from public.r207_preview_control as control
  where control.control_id;

  select exists (
    select 1
    from lh_sync_private.r207_write_authorizations as auth_row
    where auth_row.backend_pid = pg_catalog.pg_backend_pid()
      and auth_row.transaction_id = pg_catalog.pg_current_xact_id()
  ) into versioned_write;

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
