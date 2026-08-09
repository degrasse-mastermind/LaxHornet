-- R2-07B Preview hotfix: qualify the games identifier used by the public v2
-- wrapper. PostgreSQL raises 42702 when an unqualified identifier can be
-- resolved as either PL/pgSQL state or a table column. This migration changes
-- no operation, authorization, RLS, conflict, rollback, or activation rules.

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
    update public.games as game_row
    set saved_at = statement_timestamp()
    where game_row.id = btrim(coalesce(p_operation ->> 'game_id', ''))
    returning game_row.* into target_game;

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

revoke execute on function public.laxhornet_sync_game_v2(jsonb) from public, anon, authenticated;
grant execute on function public.laxhornet_sync_game_v2(jsonb) to authenticated;

comment on function public.laxhornet_sync_game_v2(jsonb) is
  'R2-07B field-operation bridge with explicitly qualified Preview game refresh. Executes only when the isolated-preview control is enabled.';
