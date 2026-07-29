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
    when 'goal' then '{"stat_type":"goal","stat_label":"Goal","category":"Offense","point_value":5,"public":true}'::jsonb
    when 'assist' then '{"stat_type":"assist","stat_label":"Assist","category":"Offense","point_value":3,"public":true}'::jsonb
    when 'shot' then '{"stat_type":"shot","stat_label":"Missed Shot","category":"Offense","point_value":-0.5,"public":true}'::jsonb
    when 'shotongoal' then '{"stat_type":"shotOnGoal","stat_label":"Shot on Goal","category":"Offense","point_value":1,"public":true}'::jsonb
    when 'goaliesave' then '{"stat_type":"goalieSave","stat_label":"Save","category":"Goalie","point_value":3,"public":true}'::jsonb
    when 'goalallowed' then '{"stat_type":"goalAllowed","stat_label":"Goal Allowed","category":"Goalie","point_value":-1,"public":true}'::jsonb
    when 'faceoffwin' then '{"stat_type":"faceoffWin","stat_label":"Faceoff Win","category":"Faceoff","point_value":2,"public":true}'::jsonb
    when 'faceoffloss' then '{"stat_type":"faceoffLoss","stat_label":"Faceoff Loss","category":"Faceoff","point_value":-1,"public":true}'::jsonb
    when 'groundball' then '{"stat_type":"groundBall","stat_label":"Ground Ball","category":"Effort / IQ","point_value":2,"public":true}'::jsonb
    when 'turnover' then '{"stat_type":"turnover","stat_label":"Turnover","category":"Possession","point_value":-2,"public":true}'::jsonb
    when 'causedturnover' then '{"stat_type":"causedTurnover","stat_label":"Caused Turnover","category":"Defense","point_value":3,"public":true}'::jsonb
    when 'defensivestop' then '{"stat_type":"defensiveStop","stat_label":"Defensive Stop","category":"Defense","point_value":3,"public":true}'::jsonb
    when 'successfulclear' then '{"stat_type":"successfulClear","stat_label":"Successful Clear","category":"Clearing","point_value":1,"public":true}'::jsonb
    when 'failedclear' then '{"stat_type":"failedClear","stat_label":"Failed Clear","category":"Clearing","point_value":-2,"public":true}'::jsonb
    when 'hustleplay' then '{"stat_type":"hustlePlay","stat_label":"Hustle Play","category":"Effort / IQ","point_value":1,"public":true}'::jsonb
    when 'backedupshot' then '{"stat_type":"backedUpShot","stat_label":"Backed Up Shot","category":"Effort / IQ","point_value":2,"public":true}'::jsonb
    when 'smartplay' then '{"stat_type":"smartPlay","stat_label":"Smart Play","category":"Effort / IQ","point_value":1,"public":true}'::jsonb
    when 'penalty' then '{"stat_type":"penalty","stat_label":"Penalty","category":"Discipline","point_value":-2,"public":true}'::jsonb
    when 'note' then '{"stat_type":"note","stat_label":"Note","category":"Note","point_value":0,"public":false}'::jsonb
    else null
  end
  from normalized;
$$;

alter function lh_trust_private.lh_public_event_semantic(jsonb) owner to postgres;
revoke all on function lh_trust_private.lh_public_event_semantic(jsonb)
  from public, anon, authenticated;

create or replace function lh_trust_private.lh_public_event_evidence(p_evidence jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  semantic jsonb := lh_trust_private.lh_public_event_semantic(p_evidence);
  occurred_at text := pg_catalog.btrim(coalesce(p_evidence ->> 'occurred_at', ''));
  period text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_evidence ->> 'period', '')));
  field_zone text;
begin
  if semantic is null
    or occurred_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
    or period not in ('Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'OT')
  then
    return null;
  end if;

  begin
    perform occurred_at::timestamptz;
  exception when others then
    return null;
  end;

  field_zone := case pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_evidence ->> 'field_zone', ''))
  )
    when '' then ''
    when 'offensive end' then 'Offensive end'
    when 'midfield' then 'Midfield'
    when 'defensive end' then 'Defensive end'
    when 'sideline' then 'Sideline'
    when 'endline' then 'Endline'
    when 'crease' then 'Crease'
    else null
  end;
  if field_zone is null then
    return null;
  end if;

  return semantic || pg_catalog.jsonb_build_object(
    'occurred_at', occurred_at,
    'period', period,
    'field_zone', field_zone
  );
end;
$$;

create or replace function lh_trust_private.lh_public_event_matches_game(
  p_evidence jsonb,
  p_period_format text,
  p_game_date date
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  canonical jsonb := lh_trust_private.lh_public_event_evidence(p_evidence);
  occurred_date date;
begin
  if canonical is null or p_game_date is null then
    return false;
  end if;

  occurred_date := (
    (canonical ->> 'occurred_at')::timestamptz at time zone 'UTC'
  )::date;
  return (
    (
      p_period_format = 'quarters'
      and canonical ->> 'period' in ('Q1', 'Q2', 'Q3', 'Q4', 'OT')
    )
    or (
      p_period_format = 'halves'
      and canonical ->> 'period' in ('H1', 'H2', 'OT')
    )
  )
    and occurred_date between p_game_date - 1 and p_game_date + 1;
end;
$$;

alter function lh_trust_private.lh_public_event_evidence(jsonb) owner to postgres;
alter function lh_trust_private.lh_public_event_matches_game(jsonb, text, date)
  owner to postgres;
revoke all on function lh_trust_private.lh_public_event_evidence(jsonb)
  from public, anon, authenticated;
revoke all on function lh_trust_private.lh_public_event_matches_game(jsonb, text, date)
  from public, anon, authenticated;

create or replace function public.lh_create_event(p_operation jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  grant_id text;
  replay jsonb;
  semantic jsonb;
  evidence jsonb := p_operation -> 'evidence';
  canonical jsonb;
  game_scope public.lh_game_scopes%rowtype;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unauthorized_scope'
    );
  end if;

  grant_id := lh_trust_private.lh_mutation_grant_for_game(
    actor_id,
    p_operation ->> 'game_id'
  );
  if grant_id is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unauthorized_scope'
    );
  end if;

  if coalesce(p_operation ->> 'client_operation_id', '') <> '' then
    replay := lh_trust_private.lh_replay_or_tamper(
      actor_id,
      p_operation ->> 'client_operation_id',
      'create_event',
      lh_trust_private.lh_operation_hash(p_operation)
    );
    if replay is not null then
      return replay;
    end if;
  end if;

  semantic := lh_trust_private.lh_public_event_semantic(evidence);
  if semantic is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unsupported_event_semantics'
    );
  end if;

  canonical := lh_trust_private.lh_public_event_evidence(evidence);
  if canonical is null
    or not evidence ?& array[
      'occurred_at',
      'period',
      'stat_type',
      'stat_label',
      'category',
      'point_value',
      'field_zone'
    ]::text[]
    or evidence ->> 'occurred_at' <> canonical ->> 'occurred_at'
    or evidence ->> 'period' <> canonical ->> 'period'
    or evidence ->> 'stat_type' <> canonical ->> 'stat_type'
    or evidence ->> 'stat_label' <> canonical ->> 'stat_label'
    or evidence ->> 'category' <> canonical ->> 'category'
    or evidence -> 'point_value' <> canonical -> 'point_value'
    or evidence ->> 'field_zone' <> canonical ->> 'field_zone'
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_public_event_evidence'
    );
  end if;

  select game.* into game_scope
  from public.lh_game_scopes as game
  where game.game_id = p_operation ->> 'game_id';
  if not found
    or not lh_trust_private.lh_public_event_matches_game(
      canonical,
      game_scope.period_format_snapshot,
      game_scope.game_date_snapshot
    )
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_public_event_evidence'
    );
  end if;

  return lh_trust_private.lh_create_event_impl(p_operation);
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
  actor_id uuid := auth.uid();
  grant_id text;
  replay jsonb;
  current_evidence jsonb;
  semantic jsonb;
  proposed_changes jsonb := coalesce(p_operation -> 'changes', '{}'::jsonb);
  canonical jsonb;
  game_scope public.lh_game_scopes%rowtype;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unauthorized_scope'
    );
  end if;

  grant_id := lh_trust_private.lh_mutation_grant_for_game(
    actor_id,
    p_operation ->> 'game_id'
  );
  if grant_id is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unauthorized_scope'
    );
  end if;

  if coalesce(p_operation ->> 'client_operation_id', '') <> '' then
    replay := lh_trust_private.lh_replay_or_tamper(
      actor_id,
      p_operation ->> 'client_operation_id',
      'correct_event',
      lh_trust_private.lh_operation_hash(p_operation)
    );
    if replay is not null then
      return replay;
    end if;
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

  canonical := lh_trust_private.lh_public_event_evidence(
    current_evidence || proposed_changes
  );
  semantic := lh_trust_private.lh_public_event_semantic(
    current_evidence || proposed_changes
  );
  if semantic is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'unsupported_event_semantics'
    );
  end if;

  if canonical is null
    or (
      proposed_changes ? 'stat_type'
      and not proposed_changes ?& array[
        'stat_type',
        'stat_label',
        'category',
        'point_value'
      ]::text[]
    )
    or (
      proposed_changes ? 'occurred_at'
      and proposed_changes ->> 'occurred_at'
        is distinct from canonical ->> 'occurred_at'
    )
    or (
      proposed_changes ? 'period'
      and proposed_changes ->> 'period'
        is distinct from canonical ->> 'period'
    )
    or (
      proposed_changes ? 'stat_type'
      and proposed_changes ->> 'stat_type'
        is distinct from canonical ->> 'stat_type'
    )
    or (
      proposed_changes ? 'stat_label'
      and proposed_changes ->> 'stat_label'
        is distinct from canonical ->> 'stat_label'
    )
    or (
      proposed_changes ? 'category'
      and proposed_changes ->> 'category'
        is distinct from canonical ->> 'category'
    )
    or (
      proposed_changes ? 'point_value'
      and proposed_changes -> 'point_value'
        is distinct from canonical -> 'point_value'
    )
    or (
      proposed_changes ? 'field_zone'
      and proposed_changes ->> 'field_zone'
        is distinct from canonical ->> 'field_zone'
    )
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_public_event_evidence'
    );
  end if;

  select game.* into game_scope
  from public.lh_game_scopes as game
  where game.game_id = p_operation ->> 'game_id';
  if not found
    or not lh_trust_private.lh_public_event_matches_game(
      canonical,
      game_scope.period_format_snapshot,
      game_scope.game_date_snapshot
    )
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_public_event_evidence'
    );
  end if;

  return lh_trust_private.lh_correct_event_impl(p_operation);
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
        'occurred_at', canonical.value ->> 'occurred_at',
        'period', canonical.value ->> 'period',
        'stat_type', canonical.value ->> 'stat_type',
        'stat_label', canonical.value ->> 'stat_label',
        'category', canonical.value ->> 'category',
        'point_value', canonical.value -> 'point_value',
        'field_zone', canonical.value ->> 'field_zone'
      )
      order by canonical.value ->> 'occurred_at', effective.event_id
    ),
    '[]'::jsonb
  )
  into event_rows
  from public.lh_event_effective_versions as effective
  cross join lateral (
    select lh_trust_private.lh_public_event_evidence(
      effective.effective_evidence
    ) as value
  ) as canonical
  where effective.game_id = game_scope.game_id
    and effective.lifecycle_state = 'active'
    and canonical.value is not null
    and canonical.value ->> 'public' = 'true'
    and lh_trust_private.lh_public_event_matches_game(
      canonical.value,
      game_scope.period_format_snapshot,
      game_scope.game_date_snapshot
    );

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
comment on function lh_trust_private.lh_public_event_evidence(jsonb) is
  'Canonicalizes every public event field and rejects invalid timestamps, periods, and field zones.';
comment on function lh_trust_private.lh_public_event_matches_game(jsonb, text, date) is
  'Restricts canonical event evidence to the game period format and a bounded UTC game-date window.';
comment on function public.lh_create_event(jsonb) is
  'Creates only complete canonical ordinary events after uniform scope authorization and raw-request replay.';
comment on function public.lh_correct_event(jsonb) is
  'Corrects only canonical ordinary evidence after uniform scope authorization and raw-request replay.';
comment on function public.lh_public_live_share_game(text) is
  'Returns minimum-necessary game data and canonical ordinary events only.';

commit;
