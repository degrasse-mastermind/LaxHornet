-- LaxHornet Trust Spine Release 1 RPC evidence
-- Source: final-staging-migration.sql
-- This file extracts exact definitions from the implementation migration.
-- It is review evidence, not a standalone migration.
--
-- Deliberate gap: no public or private restore-event RPC exists in Release 1.
-- Restore operation tables and lifecycle records exist, but runtime restore
-- cannot be exercised through the approved public RPC surface.

-- -----------------------------------------------------------------
-- lh_trust_private.lh_evidence_fields
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_evidence_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'occurred_at',
    'period',
    'stat_type',
    'stat_label',
    'category',
    'point_value',
    'tags',
    'note',
    'field_zone'
  ]::text[];
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_live_share_game_fields
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_live_share_game_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'game_id',
    'team_name',
    'player_name',
    'jersey_number',
    'position',
    'opponent',
    'game_date',
    'period_format',
    'final_score_for',
    'final_score_against'
  ]::text[];
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_live_share_event_fields
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_live_share_event_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'event_id',
    'occurred_at',
    'period',
    'stat_type',
    'stat_label',
    'category',
    'point_value',
    'field_zone'
  ]::text[];
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_sensitive_export_game_fields
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_sensitive_export_game_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'game_id',
    'team_id',
    'roster_player_id',
    'team_name',
    'player_name',
    'jersey_number',
    'position',
    'opponent',
    'game_date',
    'period_format',
    'final_score_for',
    'final_score_against'
  ]::text[];
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_sensitive_export_event_fields
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_sensitive_export_event_fields()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'event_id',
    'occurred_at',
    'period',
    'stat_type',
    'stat_label',
    'category',
    'point_value',
    'tags',
    'note',
    'field_zone'
  ]::text[];
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_active_grants_for_user
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_active_grants_for_user(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns table (
  grant_id text,
  grant_role text,
  scope_type text,
  team_id text,
  roster_player_id text,
  accepted_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (lifecycle.grant_id)
      lifecycle.grant_id,
      lifecycle.event_type,
      lifecycle.occurred_at
    from public.lh_grant_lifecycle_events as lifecycle
    order by lifecycle.grant_id, lifecycle.sequence desc
  )
  select
    grants.id,
    grants.role,
    grants.scope_type,
    grants.team_id,
    grants.roster_player_id,
    latest.occurred_at,
    grants.expires_at
  from public.lh_access_grants as grants
  join latest on latest.grant_id = grants.id
  where grants.user_id = p_user_id
    and latest.event_type = 'accepted'
    and (grants.expires_at is null or grants.expires_at > p_at);
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_create_event_impl
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_create_event_impl(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  client_operation_id text := p_operation ->> 'client_operation_id';
  event_id text := p_operation ->> 'event_id';
  game_id text := p_operation ->> 'game_id';
  evidence jsonb := p_operation -> 'evidence';
  request_hash text := lh_trust_private.lh_operation_hash(p_operation);
  replay jsonb;
  grant_id text;
  game_scope public.lh_game_scopes%rowtype;
  operation public.lh_event_operations%rowtype;
  outcome_code text;
  client_time timestamptz;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;

  if client_operation_id is null or client_operation_id = '' then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'missing_client_operation_id');
  end if;

  replay := lh_trust_private.lh_replay_or_tamper(
    actor_id,
    client_operation_id,
    'create_event',
    request_hash
  );
  if replay is not null then
    return replay;
  end if;

  if not lh_trust_private.lh_jsonb_has_only_keys(
    p_operation,
    array['client_operation_id', 'event_id', 'game_id', 'evidence', 'client_created_at']
  )
    or event_id is null
    or event_id = ''
    or game_id is null
    or game_id = ''
    or not lh_trust_private.lh_valid_evidence(evidence, true)
  then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id,
      client_operation_id,
      'create_event',
      game_id,
      event_id,
      request_hash,
      'rejected',
      'invalid_input',
      null,
      null,
      null
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  begin
    client_time := nullif(p_operation ->> 'client_created_at', '')::timestamptz;
  exception when others then
    client_time := null;
  end;

  select * into game_scope
  from public.lh_game_scopes
  where public.lh_game_scopes.game_id = p_operation ->> 'game_id';

  if not found then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'create_event', game_id, event_id,
      request_hash, 'rejected', 'unknown_game_scope', null, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  grant_id := lh_trust_private.lh_mutation_grant_for_game(actor_id, game_id);
  if grant_id is null then
    outcome_code := case
      when lh_trust_private.lh_had_prior_mutation_grant(actor_id, game_id)
        then 'authority_changed'
      else 'unauthorized_scope'
    end;
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'create_event', game_id, event_id,
      request_hash, 'rejected', outcome_code, null, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  if exists (
    select 1
    from public.lh_events
    where lh_events.event_id = p_operation ->> 'event_id'
  )
    or exists (
      select 1
      from public.lh_event_tombstones
      where lh_event_tombstones.event_id = p_operation ->> 'event_id'
    )
  then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'create_event', game_id, event_id,
      request_hash, 'rejected', 'event_id_already_used', null, grant_id, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  select * into operation
  from lh_trust_private.lh_record_operation(
    actor_id, client_operation_id, 'create_event', game_id, event_id,
    request_hash, 'accepted', 'created', 1, grant_id, client_time
  );

  insert into public.lh_event_create_operations(operation_id, event_id, game_id, evidence)
  values (operation.operation_id, event_id, game_id, evidence);

  insert into public.lh_events(
    event_id,
    game_id,
    team_id,
    roster_player_id,
    created_by_user_id,
    created_by_grant_id,
    original_evidence
  )
  values (
    event_id,
    game_id,
    game_scope.team_id,
    game_scope.roster_player_id,
    actor_id,
    grant_id,
    evidence
  );

  insert into public.lh_event_effective_versions(
    event_id,
    game_id,
    team_id,
    roster_player_id,
    server_event_version,
    lifecycle_state,
    effective_evidence
  )
  values (
    event_id,
    game_id,
    game_scope.team_id,
    game_scope.roster_player_id,
    1,
    'active',
    evidence
  );

  return lh_trust_private.lh_operation_result(operation);
exception
  when unique_violation then
    raise exception 'Concurrent duplicate event or operation'
      using errcode = '40001';
end;
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_correct_event_impl
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_correct_event_impl(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  client_operation_id text := p_operation ->> 'client_operation_id';
  event_id text := p_operation ->> 'event_id';
  game_id text := p_operation ->> 'game_id';
  changes jsonb := p_operation -> 'changes';
  base_version integer;
  request_hash text := lh_trust_private.lh_operation_hash(p_operation);
  replay jsonb;
  grant_id text;
  effective public.lh_event_effective_versions%rowtype;
  operation public.lh_event_operations%rowtype;
  merged_evidence jsonb;
  overlapping_fields text[];
  revision_sequence integer;
  outcome_code text;
  outcome_class text;
  result_version integer;
  client_time timestamptz;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;

  if client_operation_id is null or client_operation_id = '' then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'missing_client_operation_id');
  end if;

  replay := lh_trust_private.lh_replay_or_tamper(
    actor_id,
    client_operation_id,
    'correct_event',
    request_hash
  );
  if replay is not null then
    return replay;
  end if;

  begin
    base_version := (p_operation ->> 'base_server_event_version')::integer;
    client_time := nullif(p_operation ->> 'client_created_at', '')::timestamptz;
  exception when others then
    base_version := null;
    client_time := null;
  end;

  if not lh_trust_private.lh_jsonb_has_only_keys(
    p_operation,
    array[
      'client_operation_id',
      'event_id',
      'game_id',
      'base_server_event_version',
      'changes',
      'correction_reason',
      'client_created_at'
    ]
  )
    or event_id is null
    or game_id is null
    or base_version is null
    or base_version < 1
    or not lh_trust_private.lh_valid_evidence(changes, false)
  then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'correct_event', game_id,
      event_id, request_hash, 'rejected', 'invalid_input', null, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  select * into effective
  from public.lh_event_effective_versions
  where lh_event_effective_versions.event_id = p_operation ->> 'event_id'
    and lh_event_effective_versions.game_id = p_operation ->> 'game_id'
  for update;

  if not found then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'correct_event', game_id, event_id,
      request_hash, 'rejected', 'event_not_found', null, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  if effective.lifecycle_state = 'tombstoned' then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'correct_event', game_id, event_id,
      request_hash, 'rejected', 'event_tombstoned',
      effective.server_event_version, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  grant_id := lh_trust_private.lh_mutation_grant_for_game(actor_id, game_id);
  if grant_id is null then
    outcome_code := case
      when lh_trust_private.lh_had_prior_mutation_grant(actor_id, game_id)
        then 'authority_changed'
      else 'unauthorized_scope'
    end;
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'correct_event', game_id, event_id,
      request_hash, 'rejected', outcome_code,
      effective.server_event_version, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  if base_version > effective.server_event_version then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'correct_event', game_id, event_id,
      request_hash, 'rejected', 'invalid_base_version',
      effective.server_event_version, grant_id, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  select coalesce(array_agg(distinct proposed.key), '{}'::text[])
  into overlapping_fields
  from pg_catalog.jsonb_object_keys(changes) as proposed(key)
  where exists (
    select 1
    from public.lh_event_revisions as revisions,
      lateral pg_catalog.jsonb_object_keys(revisions.proposed_evidence_fields) as accepted(key)
    where revisions.event_id = p_operation ->> 'event_id'
      and revisions.outcome_class = 'accepted'
      and revisions.base_server_event_version >= base_version
      and accepted.key = proposed.key
  );

  revision_sequence := lh_trust_private.lh_next_revision_sequence(event_id);

  if cardinality(overlapping_fields) > 0
    and base_version < effective.server_event_version
  then
    outcome_class := 'conflicted';
    outcome_code := 'same_field_conflict';
    result_version := effective.server_event_version;
  else
    outcome_class := 'accepted';
    outcome_code := case
      when base_version = effective.server_event_version then 'corrected'
      else 'merged_non_overlapping'
    end;
    merged_evidence := effective.effective_evidence || changes;
    result_version := effective.server_event_version + 1;
  end if;

  select * into operation
  from lh_trust_private.lh_record_operation(
    actor_id, client_operation_id, 'correct_event', game_id, event_id,
    request_hash, outcome_class, outcome_code, result_version, grant_id, client_time
  );

  insert into public.lh_event_correction_operations(
    operation_id,
    event_id,
    game_id,
    base_server_event_version,
    changed_evidence_fields,
    correction_reason
  )
  values (
    operation.operation_id,
    event_id,
    game_id,
    base_version,
    changes,
    coalesce(p_operation ->> 'correction_reason', '')
  );

  insert into public.lh_event_revisions(
    revision_id,
    operation_id,
    event_id,
    game_id,
    revision_sequence,
    base_server_event_version,
    proposed_evidence_fields,
    prior_evidence_snapshot,
    accepted_evidence_snapshot,
    outcome_class,
    outcome_code,
    actor_user_id,
    actor_grant_id
  )
  values (
    pg_catalog.gen_random_uuid()::text,
    operation.operation_id,
    event_id,
    game_id,
    revision_sequence,
    base_version,
    changes,
    effective.effective_evidence,
    case when outcome_class = 'accepted' then merged_evidence else null end,
    outcome_class,
    outcome_code,
    actor_id,
    grant_id
  );

  if outcome_class = 'conflicted' then
    insert into public.lh_event_conflicts(
      conflict_id,
      operation_id,
      event_id,
      game_id,
      current_server_event_version,
      base_server_event_version,
      overlapping_fields,
      current_evidence_snapshot,
      proposed_evidence_fields
    )
    values (
      pg_catalog.gen_random_uuid()::text,
      operation.operation_id,
      event_id,
      game_id,
      effective.server_event_version,
      base_version,
      overlapping_fields,
      effective.effective_evidence,
      changes
    );
  else
    update public.lh_event_effective_versions
    set
      server_event_version = result_version,
      effective_evidence = merged_evidence,
      updated_at = pg_catalog.now()
    where lh_event_effective_versions.event_id = p_operation ->> 'event_id';
  end if;

  return lh_trust_private.lh_operation_result(operation);
end;
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_tombstone_event_impl
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_tombstone_event_impl(p_operation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  client_operation_id text := p_operation ->> 'client_operation_id';
  event_id text := p_operation ->> 'event_id';
  game_id text := p_operation ->> 'game_id';
  base_version integer;
  request_hash text := lh_trust_private.lh_operation_hash(p_operation);
  replay jsonb;
  grant_id text;
  effective public.lh_event_effective_versions%rowtype;
  operation public.lh_event_operations%rowtype;
  outcome_code text;
  client_time timestamptz;
  next_sequence integer;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;

  if client_operation_id is null or client_operation_id = '' then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'missing_client_operation_id');
  end if;

  replay := lh_trust_private.lh_replay_or_tamper(
    actor_id,
    client_operation_id,
    'tombstone_event',
    request_hash
  );
  if replay is not null then
    return replay;
  end if;

  begin
    base_version := (p_operation ->> 'base_server_event_version')::integer;
    client_time := nullif(p_operation ->> 'client_created_at', '')::timestamptz;
  exception when others then
    base_version := null;
    client_time := null;
  end;

  if not lh_trust_private.lh_jsonb_has_only_keys(
    p_operation,
    array[
      'client_operation_id',
      'event_id',
      'game_id',
      'base_server_event_version',
      'tombstone_reason',
      'client_created_at'
    ]
  )
    or event_id is null
    or game_id is null
    or base_version is null
    or base_version < 1
  then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'tombstone_event', game_id,
      event_id, request_hash, 'rejected', 'invalid_input', null, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  select * into effective
  from public.lh_event_effective_versions
  where lh_event_effective_versions.event_id = p_operation ->> 'event_id'
    and lh_event_effective_versions.game_id = p_operation ->> 'game_id'
  for update;

  if not found then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'tombstone_event', game_id, event_id,
      request_hash, 'rejected', 'event_not_found', null, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  if effective.lifecycle_state = 'tombstoned' then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'tombstone_event', game_id, event_id,
      request_hash, 'rejected', 'already_tombstoned',
      effective.server_event_version, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  grant_id := lh_trust_private.lh_mutation_grant_for_game(actor_id, game_id);
  if grant_id is null then
    outcome_code := case
      when lh_trust_private.lh_had_prior_mutation_grant(actor_id, game_id)
        then 'authority_changed'
      else 'unauthorized_scope'
    end;
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'tombstone_event', game_id, event_id,
      request_hash, 'rejected', outcome_code,
      effective.server_event_version, null, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  if base_version <> effective.server_event_version then
    select * into operation
    from lh_trust_private.lh_record_operation(
      actor_id, client_operation_id, 'tombstone_event', game_id, event_id,
      request_hash, 'conflicted', 'stale_tombstone_base',
      effective.server_event_version, grant_id, client_time
    );
    return lh_trust_private.lh_operation_result(operation);
  end if;

  select * into operation
  from lh_trust_private.lh_record_operation(
    actor_id, client_operation_id, 'tombstone_event', game_id, event_id,
    request_hash, 'accepted', 'tombstoned',
    effective.server_event_version + 1, grant_id, client_time
  );

  insert into public.lh_event_tombstone_operations(
    operation_id,
    event_id,
    game_id,
    base_server_event_version,
    tombstone_reason
  )
  values (
    operation.operation_id,
    event_id,
    game_id,
    base_version,
    coalesce(p_operation ->> 'tombstone_reason', '')
  );

  select coalesce(max(tombstone_sequence), 0) + 1
  into next_sequence
  from public.lh_event_tombstones
  where lh_event_tombstones.event_id = p_operation ->> 'event_id';

  insert into public.lh_event_tombstones(
    tombstone_id,
    operation_id,
    event_id,
    game_id,
    tombstone_sequence,
    actor_user_id,
    actor_grant_id,
    reason
  )
  values (
    pg_catalog.gen_random_uuid()::text,
    operation.operation_id,
    event_id,
    game_id,
    next_sequence,
    actor_id,
    grant_id,
    coalesce(p_operation ->> 'tombstone_reason', '')
  );

  update public.lh_event_effective_versions
  set
    server_event_version = effective.server_event_version + 1,
    lifecycle_state = 'tombstoned',
    updated_at = pg_catalog.now()
  where lh_event_effective_versions.event_id = p_operation ->> 'event_id';

  insert into public.lh_security_audit_events(
    audit_id,
    event_type,
    actor_user_id,
    actor_grant_id,
    team_id,
    roster_player_id,
    game_id,
    target_event_id,
    details
  )
  values (
    pg_catalog.gen_random_uuid()::text,
    'event_tombstoned',
    actor_id,
    grant_id,
    effective.team_id,
    effective.roster_player_id,
    game_id,
    event_id,
    pg_catalog.jsonb_build_object('serverEventVersion', effective.server_event_version + 1)
  );

  return lh_trust_private.lh_operation_result(operation);
end;
$$;

-- -----------------------------------------------------------------
-- lh_trust_private.lh_public_live_share_game_impl
-- -----------------------------------------------------------------
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
        'stat_type', effective.effective_evidence ->> 'stat_type',
        'stat_label', effective.effective_evidence ->> 'stat_label',
        'category', effective.effective_evidence ->> 'category',
        'point_value', effective.effective_evidence -> 'point_value',
        'field_zone', effective.effective_evidence ->> 'field_zone'
      )
      order by effective.effective_evidence ->> 'occurred_at', effective.event_id
    ),
    '[]'::jsonb
  )
  into event_rows
  from public.lh_event_effective_versions as effective
  where effective.game_id = game_scope.game_id
    and effective.lifecycle_state = 'active';

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

-- -----------------------------------------------------------------
-- lh_trust_private.lh_record_sensitive_export_impl
-- -----------------------------------------------------------------
create or replace function lh_trust_private.lh_record_sensitive_export_impl(
  p_export_type text,
  p_game_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  grant_id text;
  game_scope public.lh_game_scopes%rowtype;
  audit_id text := pg_catalog.gen_random_uuid()::text;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;

  if p_export_type not in ('player_csv', 'player_json', 'team_csv', 'team_json') then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_export_type');
  end if;

  select * into game_scope
  from public.lh_game_scopes
  where game_id = p_game_id;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unknown_game_scope');
  end if;

  grant_id := lh_trust_private.lh_export_grant_for_game(actor_id, p_game_id);
  if grant_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized_scope');
  end if;

  insert into public.lh_security_audit_events(
    audit_id,
    event_type,
    actor_user_id,
    actor_grant_id,
    team_id,
    roster_player_id,
    game_id,
    details
  )
  values (
    audit_id,
    'sensitive_export',
    actor_id,
    grant_id,
    game_scope.team_id,
    game_scope.roster_player_id,
    p_game_id,
    pg_catalog.jsonb_build_object(
      'exportType', p_export_type,
      'gameFields', to_jsonb(lh_trust_private.lh_sensitive_export_game_fields()),
      'eventFields', to_jsonb(lh_trust_private.lh_sensitive_export_event_fields())
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'export_audit_recorded',
    'auditId', audit_id,
    'gameFields', to_jsonb(lh_trust_private.lh_sensitive_export_game_fields()),
    'eventFields', to_jsonb(lh_trust_private.lh_sensitive_export_event_fields())
  );
end;
$$;

-- -----------------------------------------------------------------
-- public.lh_resolve_active_grants
-- -----------------------------------------------------------------
create or replace function public.lh_resolve_active_grants()
returns table (
  grant_id text,
  grant_role text,
  scope_type text,
  team_id text,
  roster_player_id text,
  accepted_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from lh_trust_private.lh_active_grants_for_user(auth.uid(), pg_catalog.now());
$$;

-- -----------------------------------------------------------------
-- public.lh_create_event
-- -----------------------------------------------------------------
create or replace function public.lh_create_event(p_operation jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_create_event_impl(p_operation);
$$;

-- -----------------------------------------------------------------
-- public.lh_correct_event
-- -----------------------------------------------------------------
create or replace function public.lh_correct_event(p_operation jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_correct_event_impl(p_operation);
$$;

-- -----------------------------------------------------------------
-- public.lh_tombstone_event
-- -----------------------------------------------------------------
create or replace function public.lh_tombstone_event(p_operation jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_tombstone_event_impl(p_operation);
$$;

-- -----------------------------------------------------------------
-- public.lh_public_live_share_game
-- -----------------------------------------------------------------
create or replace function public.lh_public_live_share_game(p_share_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_public_live_share_game_impl(p_share_code);
$$;

-- -----------------------------------------------------------------
-- public.lh_record_sensitive_export
-- -----------------------------------------------------------------
create or replace function public.lh_record_sensitive_export(
  p_export_type text,
  p_game_id text
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_record_sensitive_export_impl(p_export_type, p_game_id);
$$;
