-- LaxHornet Product Alignment Remediation v2
-- Disposable staging only. Apply after 00_TRUST_SPINE_BASE_STAGING_MIGRATION.sql.
-- This migration is additive and must not be applied to production in this sprint.

begin;

-- Staging cutover: public viewers must use the allowlisted RPC, never legacy
-- games/events table reads or Postgres Changes subscriptions.
revoke select on table public.games from anon;
revoke select on table public.events from anon;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'games'
      and policyname = 'laxhornet read own or shared games'
  ) then
    execute 'alter policy "laxhornet read own or shared games" on public.games to authenticated';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'laxhornet read own or shared events'
  ) then
    execute 'alter policy "laxhornet read own or shared events" on public.events to authenticated';
  end if;
end;
$$;

alter table public.lh_security_audit_events
  drop constraint if exists lh_security_audit_events_type_check;

alter table public.lh_security_audit_events
  add constraint lh_security_audit_events_type_check
  check (
    event_type in (
      'operation_accepted',
      'operation_rejected',
      'operation_conflicted',
      'operation_tampering',
      'event_tombstoned',
      'sensitive_export',
      'live_share_token_created',
      'live_share_token_revoked'
    )
  );

create or replace function lh_trust_private.lh_create_live_share_token_impl(
  p_game_id text,
  p_expires_at timestamptz default null
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
  game_scope public.lh_game_scopes%rowtype;
  raw_token text;
  token_hash text;
  token_id text := pg_catalog.gen_random_uuid()::text;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
  end if;

  if p_expires_at is not null and p_expires_at <= pg_catalog.now() then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'invalid_expiration');
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

  -- A new share decision replaces prior active tokens for this game.
  update public.lh_live_share_tokens
  set revoked_at = pg_catalog.now()
  where game_id = p_game_id
    and revoked_at is null;

  raw_token := pg_catalog.upper(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''));
  token_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.lh_live_share_tokens(
    token_id,
    token_hash,
    game_id,
    created_by_user_id,
    created_by_grant_id,
    created_at,
    expires_at
  )
  values (
    token_id,
    token_hash,
    p_game_id,
    actor_id,
    grant_id,
    pg_catalog.now(),
    p_expires_at
  );

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
    pg_catalog.gen_random_uuid()::text,
    'live_share_token_created',
    actor_id,
    grant_id,
    game_scope.team_id,
    game_scope.roster_player_id,
    p_game_id,
    pg_catalog.jsonb_build_object(
      'expiresAt', p_expires_at,
      'tokenId', token_id
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'live_share_token_created',
    'shareCode', raw_token,
    'expiresAt', p_expires_at
  );
end;
$$;

create or replace function lh_trust_private.lh_revoke_live_share_tokens_impl(p_game_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  grant_id text;
  game_scope public.lh_game_scopes%rowtype;
  revoked_count integer := 0;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'rejected', 'code', 'unauthorized');
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

  update public.lh_live_share_tokens
  set revoked_at = pg_catalog.now()
  where game_id = p_game_id
    and revoked_at is null;
  get diagnostics revoked_count = row_count;

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
    pg_catalog.gen_random_uuid()::text,
    'live_share_token_revoked',
    actor_id,
    grant_id,
    game_scope.team_id,
    game_scope.roster_player_id,
    p_game_id,
    pg_catalog.jsonb_build_object('revokedTokenCount', revoked_count)
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'code', 'live_share_tokens_revoked',
    'revokedTokenCount', revoked_count
  );
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
    select active.grant_id, active.team_id, active.roster_player_id
      into grant_id, team_id, roster_player_id
    from lh_trust_private.lh_active_grants_for_user(actor_id, recorded_at) as active
    where active.roster_player_id = p_scope_id
    order by case active.grant_role when 'team_admin' then 1 when 'coach' then 2 else 3 end
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

create or replace function public.lh_create_live_share_token(
  p_game_id text,
  p_expires_at timestamptz default null
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_create_live_share_token_impl(p_game_id, p_expires_at);
$$;

create or replace function public.lh_revoke_live_share_tokens(p_game_id text)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_revoke_live_share_tokens_impl(p_game_id);
$$;

create or replace function public.lh_record_disclosure_export(
  p_export_type text,
  p_scope_type text,
  p_scope_id text,
  p_outcome text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select lh_trust_private.lh_record_disclosure_export_impl(
    p_export_type,
    p_scope_type,
    p_scope_id,
    p_outcome
  );
$$;

alter function lh_trust_private.lh_create_live_share_token_impl(text, timestamptz) owner to postgres;
alter function lh_trust_private.lh_revoke_live_share_tokens_impl(text) owner to postgres;
alter function lh_trust_private.lh_record_disclosure_export_impl(text, text, text, text) owner to postgres;
alter function public.lh_create_live_share_token(text, timestamptz) owner to postgres;
alter function public.lh_revoke_live_share_tokens(text) owner to postgres;
alter function public.lh_record_disclosure_export(text, text, text, text) owner to postgres;

revoke all on function lh_trust_private.lh_create_live_share_token_impl(text, timestamptz) from public, anon, authenticated;
revoke all on function lh_trust_private.lh_revoke_live_share_tokens_impl(text) from public, anon, authenticated;
revoke all on function lh_trust_private.lh_record_disclosure_export_impl(text, text, text, text) from public, anon, authenticated;

revoke all on function public.lh_create_live_share_token(text, timestamptz) from public, anon, authenticated;
revoke all on function public.lh_revoke_live_share_tokens(text) from public, anon, authenticated;
revoke all on function public.lh_record_disclosure_export(text, text, text, text) from public, anon, authenticated;
revoke all on function public.lh_public_live_share_game(text) from public, anon, authenticated;

grant execute on function public.lh_create_live_share_token(text, timestamptz) to authenticated;
grant execute on function public.lh_revoke_live_share_tokens(text) to authenticated;
grant execute on function public.lh_record_disclosure_export(text, text, text, text) to authenticated;
grant execute on function public.lh_public_live_share_game(text) to anon, authenticated;

commit;
