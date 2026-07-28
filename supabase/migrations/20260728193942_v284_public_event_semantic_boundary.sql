-- v284 incident remediation: make public ordinary-event publication a closed,
-- canonical vocabulary. Existing evidence is preserved; unsupported semantics
-- remain private and are excluded from Live Share.
begin;

create or replace function lh_trust_private.lh_public_event_semantic(p_evidence jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  with normalized as (
    select pg_catalog.regexp_replace(
        pg_catalog.lower(
          pg_catalog.btrim(coalesce(p_evidence ->> 'stat_type', ''))
        ),
        '[^a-z0-9]+',
        '',
        'g'
      ) as token
  )
  select case token
    when 'goal' then '{"stat_type":"goal","stat_label":"Goal","category":"Offense","public":true}'::jsonb
    when 'assist' then '{"stat_type":"assist","stat_label":"Assist","category":"Offense","public":true}'::jsonb
    when 'shot' then '{"stat_type":"shot","stat_label":"Missed Shot","category":"Offense","public":true}'::jsonb
    when 'shotongoal' then '{"stat_type":"shotOnGoal","stat_label":"Shot on Goal","category":"Offense","public":true}'::jsonb
    when 'goaliesave' then '{"stat_type":"goalieSave","stat_label":"Save","category":"Goalie","public":true}'::jsonb
    when 'goalallowed' then '{"stat_type":"goalAllowed","stat_label":"Goal Allowed","category":"Goalie","public":true}'::jsonb
    when 'faceoffwin' then '{"stat_type":"faceoffWin","stat_label":"Faceoff Win","category":"Faceoff","public":true}'::jsonb
    when 'faceoffloss' then '{"stat_type":"faceoffLoss","stat_label":"Faceoff Loss","category":"Faceoff","public":true}'::jsonb
    when 'groundball' then '{"stat_type":"groundBall","stat_label":"Ground Ball","category":"Effort / IQ","public":true}'::jsonb
    when 'turnover' then '{"stat_type":"turnover","stat_label":"Turnover","category":"Possession","public":true}'::jsonb
    when 'causedturnover' then '{"stat_type":"causedTurnover","stat_label":"Caused Turnover","category":"Defense","public":true}'::jsonb
    when 'defensivestop' then '{"stat_type":"defensiveStop","stat_label":"Defensive Stop","category":"Defense","public":true}'::jsonb
    when 'successfulclear' then '{"stat_type":"successfulClear","stat_label":"Successful Clear","category":"Clearing","public":true}'::jsonb
    when 'failedclear' then '{"stat_type":"failedClear","stat_label":"Failed Clear","category":"Clearing","public":true}'::jsonb
    when 'hustleplay' then '{"stat_type":"hustlePlay","stat_label":"Hustle Play","category":"Effort / IQ","public":true}'::jsonb
    when 'backedupshot' then '{"stat_type":"backedUpShot","stat_label":"Backed Up Shot","category":"Effort / IQ","public":true}'::jsonb
    when 'smartplay' then '{"stat_type":"smartPlay","stat_label":"Smart Play","category":"Effort / IQ","public":true}'::jsonb
    when 'penalty' then '{"stat_type":"penalty","stat_label":"Penalty","category":"Discipline","public":true}'::jsonb
    when 'note' then '{"stat_type":"note","stat_label":"Note","category":"Note","public":false}'::jsonb
    else null
  end
  from normalized;
$$;

alter function lh_trust_private.lh_public_event_semantic(jsonb) owner to postgres;
revoke all on function lh_trust_private.lh_public_event_semantic(jsonb)
  from public, anon, authenticated;

create or replace function public.lh_create_event(p_operation jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  semantic jsonb;
  sanitized_operation jsonb;
begin
  if auth.uid() is null
    or lh_trust_private.lh_mutation_grant_for_game(
      auth.uid(),
      p_operation ->> 'game_id'
    ) is null
  then
    return lh_trust_private.lh_create_event_impl(p_operation);
  end if;

  semantic := lh_trust_private.lh_public_event_semantic(p_operation -> 'evidence');
  if semantic is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unsupported_event_semantics'
    );
  end if;

  sanitized_operation := pg_catalog.jsonb_set(
    p_operation,
    '{evidence}',
    (p_operation -> 'evidence') || (semantic - 'public'),
    true
  );
  return lh_trust_private.lh_create_event_impl(sanitized_operation);
end;
$$;

create or replace function public.lh_correct_event(p_operation jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_evidence jsonb;
  semantic jsonb;
  proposed_changes jsonb := p_operation -> 'changes';
  sanitized_changes jsonb;
  sanitized_operation jsonb;
begin
  if auth.uid() is null
    or lh_trust_private.lh_mutation_grant_for_game(
      auth.uid(),
      p_operation ->> 'game_id'
    ) is null
  then
    return lh_trust_private.lh_correct_event_impl(p_operation);
  end if;

  select effective.effective_evidence
  into current_evidence
  from public.lh_event_effective_versions as effective
  where effective.event_id = p_operation ->> 'event_id'
    and effective.game_id = p_operation ->> 'game_id';

  if not found then
    return lh_trust_private.lh_correct_event_impl(p_operation);
  end if;

  if lh_trust_private.lh_public_event_semantic(current_evidence) is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unsupported_event_semantics'
    );
  end if;

  semantic := lh_trust_private.lh_public_event_semantic(
    current_evidence || coalesce(proposed_changes, '{}'::jsonb)
  );
  if semantic is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unsupported_event_semantics'
    );
  end if;

  sanitized_changes := proposed_changes;
  if coalesce(proposed_changes, '{}'::jsonb) ?| array['stat_type', 'stat_label', 'category'] then
    sanitized_changes := (
      (proposed_changes - 'stat_type' - 'stat_label' - 'category') || (semantic - 'public')
    );
  end if;

  sanitized_operation := pg_catalog.jsonb_set(
    p_operation,
    '{changes}',
    sanitized_changes,
    true
  );
  return lh_trust_private.lh_correct_event_impl(sanitized_operation);
end;
$$;

create or replace function lh_trust_private.lh_public_live_share_game_impl(p_share_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_hash text;
  game_scope public.lh_game_scopes%rowtype;
  team_scope public.lh_team_scopes%rowtype;
  player_scope public.lh_player_scopes%rowtype;
  event_rows jsonb;
begin
  if p_share_code is null or pg_catalog.length(pg_catalog.btrim(p_share_code)) < 8 then
    return null;
  end if;

  requested_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(pg_catalog.upper(pg_catalog.btrim(p_share_code)), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select game.* into game_scope
  from public.lh_live_share_tokens as token
  join public.lh_game_scopes as game on game.game_id = token.game_id
  where token.token_hash = requested_hash
    and token.revoked_at is null
    and (token.expires_at is null or token.expires_at > pg_catalog.now())
  limit 1;

  if not found then
    return null;
  end if;

  select * into team_scope
  from public.lh_team_scopes
  where team_id = game_scope.team_id;

  select * into player_scope
  from public.lh_player_scopes
  where team_id = game_scope.team_id
    and roster_player_id = game_scope.roster_player_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'event_id', effective.event_id,
        'occurred_at', effective.effective_evidence ->> 'occurred_at',
        'period', effective.effective_evidence ->> 'period',
        'stat_type', semantic.value ->> 'stat_type',
        'stat_label', semantic.value ->> 'stat_label',
        'category', semantic.value ->> 'category',
        'point_value', effective.effective_evidence -> 'point_value',
        'field_zone', effective.effective_evidence ->> 'field_zone'
      )
      order by effective.effective_evidence ->> 'occurred_at', effective.event_id
    ),
    '[]'::jsonb
  )
  into event_rows
  from public.lh_event_effective_versions as effective
  cross join lateral (
    select lh_trust_private.lh_public_event_semantic(
      effective.effective_evidence
    ) as value
  ) as semantic
  where effective.game_id = game_scope.game_id
    and effective.lifecycle_state = 'active'
    and semantic.value is not null
    and semantic.value ->> 'public' = 'true';

  return pg_catalog.jsonb_build_object(
    'game',
    pg_catalog.jsonb_build_object(
      'game_id', game_scope.game_id,
      'team_name', team_scope.team_name_snapshot,
      'player_name', player_scope.player_name_snapshot,
      'jersey_number', player_scope.jersey_snapshot,
      'position', player_scope.position_snapshot,
      'opponent', game_scope.opponent_snapshot,
      'game_date', game_scope.game_date_snapshot,
      'period_format', game_scope.period_format_snapshot,
      'final_score_for', game_scope.final_score_for,
      'final_score_against', game_scope.final_score_against
    ),
    'events',
    event_rows
  );
end;
$$;

alter function public.lh_create_event(jsonb) owner to postgres;
alter function public.lh_correct_event(jsonb) owner to postgres;
alter function lh_trust_private.lh_public_live_share_game_impl(text) owner to postgres;

revoke execute on function public.lh_create_event(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_correct_event(jsonb)
  from public, anon, authenticated;
revoke execute on function public.lh_public_live_share_game(text)
  from public, anon, authenticated;
revoke all on function lh_trust_private.lh_public_live_share_game_impl(text)
  from public, anon, authenticated;

grant execute on function public.lh_create_event(jsonb) to authenticated;
grant execute on function public.lh_correct_event(jsonb) to authenticated;
grant execute on function public.lh_public_live_share_game(text) to anon, authenticated;

comment on function lh_trust_private.lh_public_event_semantic(jsonb) is
  'Closed v284 ordinary-event vocabulary. Unsupported semantics are private by default.';
comment on function public.lh_create_event(jsonb) is
  'Creates only canonical ordinary performance events; unsupported participation-like semantics are rejected.';
comment on function public.lh_correct_event(jsonb) is
  'Corrects only canonical ordinary performance events and prevents conversion to private semantics.';
comment on function public.lh_public_live_share_game(text) is
  'Returns minimum-necessary game data and canonical ordinary events only.';

commit;
