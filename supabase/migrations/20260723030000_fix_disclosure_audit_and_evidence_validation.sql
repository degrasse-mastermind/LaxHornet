-- LaxHornet production-candidate corrective migration.
-- Resolves PR #9 P2 findings without changing prior migration history.

begin;

create or replace function lh_trust_private.lh_valid_evidence(
  p_value jsonb,
  p_require_complete boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null then false
    when p_require_complete is null then false
    when pg_catalog.jsonb_typeof(p_value) is distinct from 'object' then false
    else coalesce(
      lh_trust_private.lh_jsonb_has_only_keys(
        p_value,
        lh_trust_private.lh_evidence_fields()
      )
      and (
        not p_require_complete
        or p_value ?& array[
          'occurred_at',
          'period',
          'stat_type',
          'stat_label',
          'category',
          'point_value'
        ]::text[]
      )
      and (not (p_value ? 'occurred_at') or pg_catalog.jsonb_typeof(p_value -> 'occurred_at') = 'string')
      and (not (p_value ? 'period') or pg_catalog.jsonb_typeof(p_value -> 'period') = 'string')
      and (not (p_value ? 'stat_type') or pg_catalog.jsonb_typeof(p_value -> 'stat_type') = 'string')
      and (not (p_value ? 'stat_label') or pg_catalog.jsonb_typeof(p_value -> 'stat_label') = 'string')
      and (not (p_value ? 'category') or pg_catalog.jsonb_typeof(p_value -> 'category') = 'string')
      and (not (p_value ? 'point_value') or pg_catalog.jsonb_typeof(p_value -> 'point_value') = 'number')
      and (not (p_value ? 'field_zone') or pg_catalog.jsonb_typeof(p_value -> 'field_zone') = 'string')
      and (p_require_complete or p_value <> '{}'::jsonb),
      false
    )
  end;
$$;

create or replace function lh_trust_private.lh_record_disclosure_export_impl(
  p_export_type text,
  p_scope_type text,
  p_scope_id text,
  p_outcome text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  grant_id text;
  team_id text;
  roster_player_id text;
  game_id text;
  audit_id text := pg_catalog.gen_random_uuid()::text;
  recorded_at timestamptz := pg_catalog.now();
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;

  if p_export_type not in ('player_csv', 'full_backup') then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_export_type');
  end if;

  if p_scope_type not in ('game', 'player', 'account') then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_scope_type');
  end if;

  if p_outcome not in ('accepted', 'failed', 'cancelled') then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_export_outcome');
  end if;

  if p_scope_type = 'game' then
    select scope.team_id, scope.roster_player_id, scope.game_id
      into team_id, roster_player_id, game_id
    from public.lh_game_scopes as scope
    where scope.game_id = p_scope_id;

    grant_id := lh_trust_private.lh_export_grant_for_game(actor_id, p_scope_id);
    if game_id is null or grant_id is null then
      return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
    end if;
  elsif p_scope_type = 'player' then
    select
      active.grant_id,
      player_scope.team_id,
      player_scope.roster_player_id
    into grant_id, team_id, roster_player_id
    from public.lh_player_scopes as player_scope
    join lh_trust_private.lh_active_grants_for_user(actor_id, recorded_at) as active
      on active.team_id = player_scope.team_id
    where player_scope.roster_player_id = p_scope_id
      and (
        (
          active.grant_role = 'parent'
          and active.scope_type = 'player'
          and active.roster_player_id = player_scope.roster_player_id
        )
        or (
          active.grant_role = 'coach'
          and (
            active.scope_type = 'team'
            or (
              active.scope_type = 'player'
              and active.roster_player_id = player_scope.roster_player_id
            )
          )
        )
        or (
          active.grant_role = 'team_admin'
          and active.scope_type = 'team'
        )
      )
    order by
      case active.grant_role
        when 'team_admin' then 1
        when 'coach' then 2
        else 3
      end,
      case active.scope_type when 'player' then 1 else 2 end,
      active.grant_id,
      player_scope.team_id
    limit 1;

    if grant_id is null then
      return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
    end if;
  else
    if p_export_type <> 'full_backup' then
      return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'scope_export_mismatch');
    end if;

    if p_scope_id is distinct from actor_id::text then
      return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
    end if;
  end if;

  insert into public.lh_security_audit_events(
    audit_id,
    event_type,
    actor_user_id,
    actor_grant_id,
    team_id,
    roster_player_id,
    game_id,
    details,
    recorded_at
  )
  values (
    audit_id,
    'sensitive_export',
    actor_id,
    grant_id,
    team_id,
    roster_player_id,
    game_id,
    pg_catalog.jsonb_build_object(
      'exportType', p_export_type,
      'scopeType', p_scope_type,
      'scopeId', p_scope_id,
      'outcome', p_outcome
    ),
    recorded_at
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'export_audit_recorded',
    'auditId', audit_id,
    'recordedAt', recorded_at
  );
end;
$$;

alter function lh_trust_private.lh_valid_evidence(jsonb, boolean) owner to postgres;
alter function lh_trust_private.lh_record_disclosure_export_impl(text, text, text, text) owner to postgres;

revoke all on function lh_trust_private.lh_valid_evidence(jsonb, boolean)
  from public, anon, authenticated;
revoke all on function lh_trust_private.lh_record_disclosure_export_impl(text, text, text, text)
  from public, anon, authenticated;

commit;
