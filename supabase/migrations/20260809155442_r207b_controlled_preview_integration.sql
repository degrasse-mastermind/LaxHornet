-- R2-07B controlled preview bridge. This migration does not activate the
-- production client or the legacy v1 cutover. The single control row is false
-- by default; Supabase Preview seed data explicitly enables it only on the
-- isolated pull-request branch.

create table public.r207_preview_control (
  control_id boolean primary key default true check (control_id),
  preview_enabled boolean not null default false,
  updated_at timestamptz not null default statement_timestamp(),
  constraint r207_preview_control_disabled_by_default_check
    check (preview_enabled in (true, false))
);

insert into public.r207_preview_control(control_id, preview_enabled)
values (true, false);

alter table public.r207_preview_control enable row level security;
alter table public.r207_preview_control force row level security;
revoke all on table public.r207_preview_control from public, anon, authenticated;

create or replace function public.laxhornet_r207_preview_capability()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'enabled', coalesce((
      select control.preview_enabled
      from public.r207_preview_control as control
      where control.control_id
    ), false),
    'protocol', 'r207b',
    'productionActivation', false
  );
$function$;

create or replace function public.laxhornet_sync_game_v2(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  enabled boolean := false;
  result jsonb;
  target_game public.games%rowtype;
begin
  select control.preview_enabled into enabled
  from public.r207_preview_control as control
  where control.control_id;

  if not coalesce(enabled, false) then
    return jsonb_build_object(
      'outcome', 'rejected',
      'code', 'r207_not_activated'
    );
  end if;

  result := lh_sync_private.r207_apply_game_operation_for_test(p_operation, false);

  if result ->> 'outcome' in ('accepted', 'merged') then
    update public.games
    set saved_at = statement_timestamp()
    where id = btrim(coalesce(p_operation ->> 'game_id', ''))
    returning * into target_game;

    if found then
      result := result || jsonb_build_object(
        'server_game', jsonb_strip_nulls(jsonb_build_object(
          'id', target_game.id,
          'opponent', target_game.opponent,
          'game_date', target_game.game_date,
          'location', target_game.location,
          'game_type', target_game.game_type,
          'lifecycle_state', target_game.lifecycle_state,
          'score_for', target_game.score_for,
          'score_against', target_game.score_against,
          'score_known', target_game.score_known,
          'saved_at', target_game.saved_at
        ))
      );
    end if;
  end if;

  return result;
end;
$function$;

revoke execute on function public.laxhornet_r207_preview_capability() from public, anon, authenticated;
revoke execute on function public.laxhornet_sync_game_v2(jsonb) from public, anon, authenticated;
grant execute on function public.laxhornet_r207_preview_capability() to authenticated;
grant execute on function public.laxhornet_sync_game_v2(jsonb) to authenticated;

comment on table public.r207_preview_control is
  'R2-07B server gate. False by migration default; isolated Preview seed may enable it. No app-role table access.';
comment on function public.laxhornet_r207_preview_capability() is
  'Authenticated non-secret R2-07B preview capability. It does not represent production activation.';
comment on function public.laxhornet_sync_game_v2(jsonb) is
  'R2-07B field-operation bridge. Executes only when the isolated-preview control is explicitly enabled.';
