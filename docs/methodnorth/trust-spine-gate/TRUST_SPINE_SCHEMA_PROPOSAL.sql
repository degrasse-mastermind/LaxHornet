-- LaxHornet Trust Spine Release 1
-- DEPLOYABLE TO AN ISOLATED STAGING DATABASE ONLY.
--
-- This migration is additive. It does not alter legacy LaxHornet tables,
-- existing RLS policies, existing RPCs, runtime code, or production data.
-- The Trust Spine tables have RLS enabled and forced. No table privileges are
-- granted to anon or authenticated. Only the six explicitly granted staging
-- RPC wrappers are reachable through the Data API.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists lh_trust_private;
revoke all on schema lh_trust_private from public;
revoke all on schema lh_trust_private from anon, authenticated;

-- Legacy identifiers are preserved as immutable text snapshots instead of
-- foreign keys to deletable legacy rows. Internal Trust Spine relationships use
-- restrictive foreign keys so evidence history cannot disappear by cascade.
create table public.lh_team_scopes (
  team_id text primary key,
  team_name_snapshot text not null default '',
  registered_at timestamptz not null default now()
);

create table public.lh_player_scopes (
  team_id text not null references public.lh_team_scopes(team_id) on delete restrict,
  roster_player_id text not null,
  player_name_snapshot text not null default '',
  jersey_snapshot text not null default '',
  position_snapshot text not null default '',
  registered_at timestamptz not null default now(),
  primary key (team_id, roster_player_id)
);

create table public.lh_game_scopes (
  game_id text primary key,
  team_id text not null,
  roster_player_id text not null,
  opponent_snapshot text not null default '',
  game_date_snapshot date,
  period_format_snapshot text not null default 'quarters',
  final_score_for integer,
  final_score_against integer,
  registered_at timestamptz not null default now(),
  constraint lh_game_scopes_player_scope_fk
    foreign key (team_id, roster_player_id)
    references public.lh_player_scopes(team_id, roster_player_id)
    on delete restrict,
  constraint lh_game_scopes_period_format_check
    check (period_format_snapshot in ('quarters', 'halves')),
  constraint lh_game_scopes_scores_nonnegative
    check (
      (final_score_for is null or final_score_for >= 0)
      and (final_score_against is null or final_score_against >= 0)
    ),
  constraint lh_game_scopes_unique_scope unique (game_id, team_id, roster_player_id)
);

create table public.lh_access_invitations (
  id text primary key,
  invited_user_id uuid not null,
  invited_email text not null default '',
  role text not null,
  scope_type text not null,
  team_id text not null references public.lh_team_scopes(team_id) on delete restrict,
  roster_player_id text,
  invited_by_user_id uuid not null,
  invited_by_grant_id text,
  status text not null default 'pending',
  invitation_code_hash text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text not null default '',
  constraint lh_access_invitations_role_check
    check (role in ('parent', 'coach', 'team_admin')),
  constraint lh_access_invitations_scope_check
    check (scope_type in ('team', 'player')),
  constraint lh_access_invitations_status_check
    check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  constraint lh_access_invitations_scope_shape_check
    check (
      (scope_type = 'team' and roster_player_id is null)
      or (scope_type = 'player' and roster_player_id is not null)
    ),
  constraint lh_access_invitations_role_scope_check
    check (
      (role = 'parent' and scope_type = 'player')
      or (role = 'coach' and scope_type in ('team', 'player'))
      or (role = 'team_admin' and scope_type = 'team')
    ),
  constraint lh_access_invitations_player_scope_fk
    foreign key (team_id, roster_player_id)
    references public.lh_player_scopes(team_id, roster_player_id)
    on delete restrict
);

create table public.lh_access_grants (
  id text primary key,
  user_id uuid not null,
  role text not null,
  scope_type text not null,
  team_id text not null references public.lh_team_scopes(team_id) on delete restrict,
  roster_player_id text,
  provenance_type text not null,
  invitation_id text references public.lh_access_invitations(id) on delete restrict,
  renewed_from_grant_id text references public.lh_access_grants(id) on delete restrict,
  issued_by_user_id uuid not null,
  issued_by_grant_id text references public.lh_access_grants(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint lh_access_grants_role_check
    check (role in ('parent', 'coach', 'team_admin')),
  constraint lh_access_grants_scope_check
    check (scope_type in ('team', 'player')),
  constraint lh_access_grants_scope_shape_check
    check (
      (scope_type = 'team' and roster_player_id is null)
      or (scope_type = 'player' and roster_player_id is not null)
    ),
  constraint lh_access_grants_role_scope_check
    check (
      (role = 'parent' and scope_type = 'player')
      or (role = 'coach' and scope_type in ('team', 'player'))
      or (role = 'team_admin' and scope_type = 'team')
    ),
  constraint lh_access_grants_provenance_check
    check (provenance_type in ('system_bootstrap', 'invitation', 'renewal')),
  constraint lh_access_grants_provenance_shape_check
    check (
      (
        provenance_type = 'system_bootstrap'
        and role = 'team_admin'
        and scope_type = 'team'
        and invitation_id is null
        and renewed_from_grant_id is null
        and issued_by_grant_id is null
      )
      or (
        provenance_type = 'invitation'
        and invitation_id is not null
        and renewed_from_grant_id is null
        and issued_by_grant_id is not null
      )
      or (
        provenance_type = 'renewal'
        and invitation_id is null
        and renewed_from_grant_id is not null
        and issued_by_grant_id is not null
      )
    ),
  constraint lh_access_grants_expiry_after_issue
    check (expires_at is null or expires_at > issued_at),
  constraint lh_access_grants_player_scope_fk
    foreign key (team_id, roster_player_id)
    references public.lh_player_scopes(team_id, roster_player_id)
    on delete restrict
);

alter table public.lh_access_invitations
  add constraint lh_access_invitations_issuer_grant_fk
  foreign key (invited_by_grant_id)
  references public.lh_access_grants(id)
  on delete restrict;

create table public.lh_grant_lifecycle_events (
  id text primary key,
  grant_id text not null references public.lh_access_grants(id) on delete restrict,
  sequence integer not null,
  event_type text not null,
  actor_user_id uuid not null,
  actor_grant_id text references public.lh_access_grants(id) on delete restrict,
  related_grant_id text references public.lh_access_grants(id) on delete restrict,
  reason text not null default '',
  occurred_at timestamptz not null default now(),
  constraint lh_grant_lifecycle_events_sequence_positive check (sequence > 0),
  constraint lh_grant_lifecycle_events_type_check
    check (event_type in ('issued', 'accepted', 'expired', 'revoked', 'renewed')),
  constraint lh_grant_lifecycle_events_related_shape_check
    check (
      (event_type = 'renewed' and related_grant_id is not null)
      or (event_type <> 'renewed' and related_grant_id is null)
    ),
  constraint lh_grant_lifecycle_events_unique_sequence unique (grant_id, sequence)
);

create table public.lh_events (
  event_id text primary key,
  game_id text not null,
  team_id text not null,
  roster_player_id text not null,
  created_by_user_id uuid not null,
  created_by_grant_id text not null references public.lh_access_grants(id) on delete restrict,
  original_evidence jsonb not null,
  created_at timestamptz not null default now(),
  constraint lh_events_game_scope_fk
    foreign key (game_id, team_id, roster_player_id)
    references public.lh_game_scopes(game_id, team_id, roster_player_id)
    on delete restrict
);

create table public.lh_event_effective_versions (
  event_id text primary key references public.lh_events(event_id) on delete restrict,
  game_id text not null,
  team_id text not null,
  roster_player_id text not null,
  server_event_version integer not null,
  lifecycle_state text not null default 'active',
  effective_evidence jsonb not null,
  updated_at timestamptz not null default now(),
  constraint lh_event_effective_versions_version_positive
    check (server_event_version > 0),
  constraint lh_event_effective_versions_state_check
    check (lifecycle_state in ('active', 'tombstoned')),
  constraint lh_event_effective_versions_event_scope_fk
    foreign key (event_id)
    references public.lh_events(event_id)
    on delete restrict,
  constraint lh_event_effective_versions_game_scope_fk
    foreign key (game_id, team_id, roster_player_id)
    references public.lh_game_scopes(game_id, team_id, roster_player_id)
    on delete restrict
);

create table public.lh_event_operations (
  operation_id text primary key,
  actor_user_id uuid not null,
  client_operation_id text not null,
  operation_type text not null,
  -- Rejected requests must remain auditable even when the supplied game is
  -- unknown. Accepted operation detail tables enforce the canonical game FK.
  game_id text,
  event_id text,
  request_hash text not null,
  outcome_class text not null,
  outcome_code text not null,
  result_server_event_version integer,
  actor_grant_id text references public.lh_access_grants(id) on delete restrict,
  client_created_at timestamptz,
  server_received_at timestamptz not null default now(),
  constraint lh_event_operations_type_check
    check (operation_type in ('create_event', 'correct_event', 'tombstone_event', 'restore_event')),
  constraint lh_event_operations_outcome_class_check
    check (outcome_class in ('accepted', 'rejected', 'conflicted')),
  constraint lh_event_operations_unique_client_operation
    unique (actor_user_id, client_operation_id)
);

create table public.lh_event_operation_attempts (
  attempt_id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  client_operation_id text not null,
  operation_type text not null,
  request_hash text not null,
  canonical_operation_id text references public.lh_event_operations(operation_id) on delete restrict,
  outcome_class text not null,
  outcome_code text not null,
  received_at timestamptz not null default now(),
  constraint lh_event_operation_attempts_type_check
    check (operation_type in ('create_event', 'correct_event', 'tombstone_event', 'restore_event')),
  constraint lh_event_operation_attempts_outcome_check
    check (outcome_class in ('accepted', 'rejected', 'conflicted'))
);

create table public.lh_event_create_operations (
  operation_id text primary key references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  evidence jsonb not null
);

create table public.lh_event_correction_operations (
  operation_id text primary key references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null references public.lh_events(event_id) on delete restrict,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  base_server_event_version integer not null,
  changed_evidence_fields jsonb not null,
  correction_reason text not null default '',
  constraint lh_event_correction_operations_base_positive
    check (base_server_event_version > 0)
);

create table public.lh_event_tombstone_operations (
  operation_id text primary key references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null references public.lh_events(event_id) on delete restrict,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  base_server_event_version integer not null,
  tombstone_reason text not null default '',
  constraint lh_event_tombstone_operations_base_positive
    check (base_server_event_version > 0)
);

create table public.lh_event_restore_operations (
  operation_id text primary key references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null references public.lh_events(event_id) on delete restrict,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  tombstone_id text not null,
  base_server_event_version integer not null,
  restore_reason text not null default '',
  constraint lh_event_restore_operations_base_positive
    check (base_server_event_version > 0)
);

create table public.lh_event_revisions (
  revision_id text primary key,
  operation_id text not null references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null references public.lh_events(event_id) on delete restrict,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  revision_sequence integer not null,
  base_server_event_version integer not null,
  proposed_evidence_fields jsonb not null,
  prior_evidence_snapshot jsonb not null,
  accepted_evidence_snapshot jsonb,
  outcome_class text not null,
  outcome_code text not null,
  actor_user_id uuid not null,
  actor_grant_id text references public.lh_access_grants(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint lh_event_revisions_sequence_positive check (revision_sequence > 0),
  constraint lh_event_revisions_base_positive check (base_server_event_version > 0),
  constraint lh_event_revisions_outcome_check
    check (outcome_class in ('accepted', 'rejected', 'conflicted')),
  constraint lh_event_revisions_unique_sequence unique (event_id, revision_sequence)
);

create table public.lh_event_tombstones (
  tombstone_id text primary key,
  operation_id text not null unique references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null references public.lh_events(event_id) on delete restrict,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  tombstone_sequence integer not null,
  actor_user_id uuid not null,
  actor_grant_id text references public.lh_access_grants(id) on delete restrict,
  reason text not null default '',
  recorded_at timestamptz not null default now(),
  constraint lh_event_tombstones_sequence_positive check (tombstone_sequence > 0),
  constraint lh_event_tombstones_unique_sequence unique (event_id, tombstone_sequence)
);

create table public.lh_event_restorations (
  restoration_id text primary key,
  operation_id text not null unique references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null references public.lh_events(event_id) on delete restrict,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  tombstone_id text not null references public.lh_event_tombstones(tombstone_id) on delete restrict,
  actor_user_id uuid not null,
  actor_grant_id text references public.lh_access_grants(id) on delete restrict,
  reason text not null default '',
  recorded_at timestamptz not null default now()
);

alter table public.lh_event_restore_operations
  add constraint lh_event_restore_operations_tombstone_fk
  foreign key (tombstone_id)
  references public.lh_event_tombstones(tombstone_id)
  on delete restrict;

create table public.lh_event_conflicts (
  conflict_id text primary key,
  operation_id text not null unique references public.lh_event_operations(operation_id) on delete restrict,
  event_id text not null references public.lh_events(event_id) on delete restrict,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  current_server_event_version integer not null,
  base_server_event_version integer not null,
  overlapping_fields text[] not null,
  current_evidence_snapshot jsonb not null,
  proposed_evidence_fields jsonb not null,
  recorded_at timestamptz not null default now(),
  constraint lh_event_conflicts_versions_positive
    check (current_server_event_version > 0 and base_server_event_version > 0),
  constraint lh_event_conflicts_overlap_nonempty
    check (cardinality(overlapping_fields) > 0)
);

create table public.lh_conflict_adjudications (
  adjudication_id text primary key,
  conflict_id text not null references public.lh_event_conflicts(conflict_id) on delete restrict,
  adjudication_sequence integer not null,
  previous_adjudication_id text references public.lh_conflict_adjudications(adjudication_id) on delete restrict,
  decision text not null,
  accepted_evidence_fields jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null,
  actor_grant_id text not null references public.lh_access_grants(id) on delete restrict,
  rationale text not null default '',
  recorded_at timestamptz not null default now(),
  constraint lh_conflict_adjudications_sequence_positive
    check (adjudication_sequence > 0),
  constraint lh_conflict_adjudications_decision_check
    check (decision in ('keep_effective', 'accept_proposed', 'accept_custom_patch')),
  constraint lh_conflict_adjudications_unique_sequence
    unique (conflict_id, adjudication_sequence)
);

create table public.lh_live_share_tokens (
  token_id text primary key,
  token_hash text not null unique,
  game_id text not null references public.lh_game_scopes(game_id) on delete restrict,
  created_by_user_id uuid not null,
  created_by_grant_id text references public.lh_access_grants(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint lh_live_share_tokens_expiry_after_create
    check (expires_at is null or expires_at > created_at)
);

create table public.lh_security_audit_events (
  audit_id text primary key,
  event_type text not null,
  actor_user_id uuid,
  actor_grant_id text references public.lh_access_grants(id) on delete restrict,
  team_id text,
  roster_player_id text,
  game_id text,
  target_event_id text,
  details jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  constraint lh_security_audit_events_type_check
    check (
      event_type in (
        'operation_accepted',
        'operation_rejected',
        'operation_conflicted',
        'operation_tampering',
        'event_tombstoned',
        'sensitive_export'
      )
    )
);

-- Foreign-key and lookup indexes. PostgreSQL does not create these for FKs.
create index lh_player_scopes_team_idx on public.lh_player_scopes(team_id);
create index lh_game_scopes_player_idx on public.lh_game_scopes(team_id, roster_player_id);
create index lh_access_invitations_user_idx on public.lh_access_invitations(invited_user_id, status);
create index lh_access_invitations_issuer_idx on public.lh_access_invitations(invited_by_grant_id);
create index lh_access_grants_user_scope_idx
  on public.lh_access_grants(user_id, team_id, roster_player_id, role);
create index lh_access_grants_invitation_idx on public.lh_access_grants(invitation_id);
create index lh_access_grants_renewed_from_idx on public.lh_access_grants(renewed_from_grant_id);
create index lh_access_grants_issuer_idx on public.lh_access_grants(issued_by_grant_id);
create index lh_grant_lifecycle_grant_idx
  on public.lh_grant_lifecycle_events(grant_id, sequence desc);
create index lh_grant_lifecycle_actor_grant_idx on public.lh_grant_lifecycle_events(actor_grant_id);
create index lh_events_game_idx on public.lh_events(game_id);
create index lh_events_grant_idx on public.lh_events(created_by_grant_id);
create index lh_event_effective_game_idx on public.lh_event_effective_versions(game_id, lifecycle_state);
create index lh_event_operations_actor_idx
  on public.lh_event_operations(actor_user_id, server_received_at desc);
create index lh_event_operations_game_idx on public.lh_event_operations(game_id, server_received_at desc);
create index lh_event_operation_attempts_client_idx
  on public.lh_event_operation_attempts(actor_user_id, client_operation_id, received_at desc);
create index lh_event_revisions_event_idx on public.lh_event_revisions(event_id, revision_sequence);
create index lh_event_revisions_operation_idx on public.lh_event_revisions(operation_id);
create index lh_event_tombstones_event_idx on public.lh_event_tombstones(event_id, tombstone_sequence desc);
create index lh_event_restorations_event_idx on public.lh_event_restorations(event_id, recorded_at desc);
create index lh_event_conflicts_event_idx on public.lh_event_conflicts(event_id, recorded_at desc);
create index lh_conflict_adjudications_conflict_idx
  on public.lh_conflict_adjudications(conflict_id, adjudication_sequence desc);
create index lh_live_share_tokens_game_idx on public.lh_live_share_tokens(game_id);
create index lh_security_audit_team_idx on public.lh_security_audit_events(team_id, recorded_at desc);
create index lh_security_audit_actor_idx on public.lh_security_audit_events(actor_user_id, recorded_at desc);

-- Strict field allowlists.
create or replace function lh_trust_private.lh_jsonb_has_only_keys(
  p_value jsonb,
  p_allowed text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    pg_catalog.jsonb_typeof(p_value) = 'object'
    and not exists (
      select 1
      from pg_catalog.jsonb_object_keys(p_value) as supplied(key)
      where not (supplied.key = any (p_allowed))
    );
$$;

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

create or replace function lh_trust_private.lh_valid_evidence(
  p_value jsonb,
  p_require_complete boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
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
    and (not (p_value ? 'tags') or pg_catalog.jsonb_typeof(p_value -> 'tags') = 'array')
    and (not (p_value ? 'note') or pg_catalog.jsonb_typeof(p_value -> 'note') = 'string')
    and (not (p_value ? 'field_zone') or pg_catalog.jsonb_typeof(p_value -> 'field_zone') = 'string')
    and (p_require_complete or p_value <> '{}'::jsonb);
$$;

alter table public.lh_events
  add constraint lh_events_original_evidence_allowlist
  check (lh_trust_private.lh_valid_evidence(original_evidence, true));

alter table public.lh_event_effective_versions
  add constraint lh_event_effective_evidence_allowlist
  check (lh_trust_private.lh_valid_evidence(effective_evidence, true));

alter table public.lh_event_create_operations
  add constraint lh_event_create_evidence_allowlist
  check (lh_trust_private.lh_valid_evidence(evidence, true));

alter table public.lh_event_correction_operations
  add constraint lh_event_correction_evidence_allowlist
  check (lh_trust_private.lh_valid_evidence(changed_evidence_fields, false));

alter table public.lh_event_revisions
  add constraint lh_event_revisions_proposed_allowlist
  check (lh_trust_private.lh_valid_evidence(proposed_evidence_fields, false));

alter table public.lh_event_revisions
  add constraint lh_event_revisions_prior_allowlist
  check (lh_trust_private.lh_valid_evidence(prior_evidence_snapshot, true));

alter table public.lh_event_revisions
  add constraint lh_event_revisions_accepted_allowlist
  check (
    accepted_evidence_snapshot is null
    or lh_trust_private.lh_valid_evidence(accepted_evidence_snapshot, true)
  );

alter table public.lh_event_conflicts
  add constraint lh_event_conflicts_current_allowlist
  check (lh_trust_private.lh_valid_evidence(current_evidence_snapshot, true));

alter table public.lh_event_conflicts
  add constraint lh_event_conflicts_proposed_allowlist
  check (lh_trust_private.lh_valid_evidence(proposed_evidence_fields, false));

alter table public.lh_conflict_adjudications
  add constraint lh_conflict_adjudications_evidence_allowlist
  check (
    accepted_evidence_fields = '{}'::jsonb
    or lh_trust_private.lh_valid_evidence(accepted_evidence_fields, false)
  );

-- Immutable history protection.
create or replace function lh_trust_private.lh_forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Trust Spine history is append-only'
    using errcode = '55000';
end;
$$;

create trigger lh_access_grants_immutable
before update or delete on public.lh_access_grants
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_grant_lifecycle_immutable
before update or delete on public.lh_grant_lifecycle_events
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_events_immutable
before update or delete on public.lh_events
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_operations_immutable
before update or delete on public.lh_event_operations
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_attempts_immutable
before update or delete on public.lh_event_operation_attempts
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_create_operations_immutable
before update or delete on public.lh_event_create_operations
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_correction_operations_immutable
before update or delete on public.lh_event_correction_operations
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_tombstone_operations_immutable
before update or delete on public.lh_event_tombstone_operations
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_restore_operations_immutable
before update or delete on public.lh_event_restore_operations
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_revisions_immutable
before update or delete on public.lh_event_revisions
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_tombstones_immutable
before update or delete on public.lh_event_tombstones
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_restorations_immutable
before update or delete on public.lh_event_restorations
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_event_conflicts_immutable
before update or delete on public.lh_event_conflicts
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_conflict_adjudications_immutable
before update or delete on public.lh_conflict_adjudications
for each row execute function lh_trust_private.lh_forbid_mutation();

create trigger lh_security_audit_immutable
before update or delete on public.lh_security_audit_events
for each row execute function lh_trust_private.lh_forbid_mutation();

-- Active grant resolution is based on the latest append-only lifecycle entry,
-- an accepted state, and a non-expired grant.
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

create or replace function lh_trust_private.lh_validate_grant_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  issuer public.lh_access_grants%rowtype;
  invitation public.lh_access_invitations%rowtype;
  prior_grant public.lh_access_grants%rowtype;
begin
  if new.provenance_type = 'system_bootstrap' then
    return new;
  end if;

  select * into issuer
  from public.lh_access_grants
  where id = new.issued_by_grant_id;

  if not found
    or issuer.user_id <> new.issued_by_user_id
    or issuer.role <> 'team_admin'
    or issuer.scope_type <> 'team'
    or issuer.team_id <> new.team_id
    or not exists (
      select 1
      from lh_trust_private.lh_active_grants_for_user(new.issued_by_user_id, new.issued_at) as active
      where active.grant_id = issuer.id
    )
  then
    raise exception 'Grant provenance requires an active same-team team-admin grant'
      using errcode = '42501';
  end if;

  if new.provenance_type = 'invitation' then
    select * into invitation
    from public.lh_access_invitations
    where id = new.invitation_id;

    if not found
      or invitation.status <> 'accepted'
      or invitation.invited_user_id <> new.user_id
      or invitation.role <> new.role
      or invitation.scope_type <> new.scope_type
      or invitation.team_id <> new.team_id
      or invitation.roster_player_id is distinct from new.roster_player_id
      or invitation.invited_by_grant_id <> new.issued_by_grant_id
    then
      raise exception 'Invitation provenance does not match the grant'
        using errcode = '23514';
    end if;
  elsif new.provenance_type = 'renewal' then
    select * into prior_grant
    from public.lh_access_grants
    where id = new.renewed_from_grant_id;

    if not found
      or prior_grant.user_id <> new.user_id
      or prior_grant.role <> new.role
      or prior_grant.scope_type <> new.scope_type
      or prior_grant.team_id <> new.team_id
      or prior_grant.roster_player_id is distinct from new.roster_player_id
    then
      raise exception 'Renewal provenance does not match the prior grant'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger lh_access_grants_validate_provenance
before insert on public.lh_access_grants
for each row execute function lh_trust_private.lh_validate_grant_provenance();

create or replace function lh_trust_private.lh_validate_grant_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_type text;
  expected_sequence integer;
  renewed_grant public.lh_access_grants%rowtype;
begin
  select coalesce(max(sequence), 0) + 1
  into expected_sequence
  from public.lh_grant_lifecycle_events
  where grant_id = new.grant_id;

  if new.sequence <> expected_sequence then
    raise exception 'Grant lifecycle sequence must be %', expected_sequence
      using errcode = '23514';
  end if;

  select event_type
  into prior_type
  from public.lh_grant_lifecycle_events
  where grant_id = new.grant_id
  order by sequence desc
  limit 1;

  if new.sequence = 1 and new.event_type <> 'issued' then
    raise exception 'The first grant lifecycle event must be issued'
      using errcode = '23514';
  elsif new.sequence > 1 then
    if new.event_type = 'accepted' and prior_type <> 'issued' then
      raise exception 'Only an issued grant can be accepted'
        using errcode = '23514';
    elsif new.event_type in ('expired', 'revoked', 'renewed') and prior_type <> 'accepted' then
      raise exception 'Only an accepted grant can be expired, revoked, or renewed'
        using errcode = '23514';
    elsif new.event_type = 'issued' then
      raise exception 'Issued can appear only once'
        using errcode = '23514';
    end if;
  end if;

  if new.event_type = 'renewed' then
    select * into renewed_grant
    from public.lh_access_grants
    where id = new.related_grant_id;

    if not found or renewed_grant.renewed_from_grant_id <> new.grant_id then
      raise exception 'Renewed lifecycle event must reference its renewal grant'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger lh_grant_lifecycle_validate
before insert on public.lh_grant_lifecycle_events
for each row execute function lh_trust_private.lh_validate_grant_lifecycle();

create or replace function lh_trust_private.lh_operation_hash(p_operation jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(coalesce(p_operation, '{}'::jsonb)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function lh_trust_private.lh_operation_result(
  p_operation public.lh_event_operations
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'operationId', p_operation.operation_id,
    'clientOperationId', p_operation.client_operation_id,
    'operationType', p_operation.operation_type,
    'outcome', p_operation.outcome_class,
    'code', p_operation.outcome_code,
    'serverEventVersion', p_operation.result_server_event_version,
    'eventId', p_operation.event_id,
    'gameId', p_operation.game_id
  );
$$;

create or replace function lh_trust_private.lh_replay_or_tamper(
  p_actor_user_id uuid,
  p_client_operation_id text,
  p_operation_type text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.lh_event_operations%rowtype;
begin
  select * into existing
  from public.lh_event_operations
  where actor_user_id = p_actor_user_id
    and client_operation_id = p_client_operation_id;

  if not found then
    return null;
  end if;

  if existing.operation_type = p_operation_type
    and existing.request_hash = p_request_hash
  then
    insert into public.lh_event_operation_attempts (
      actor_user_id,
      client_operation_id,
      operation_type,
      request_hash,
      canonical_operation_id,
      outcome_class,
      outcome_code
    )
    values (
      p_actor_user_id,
      p_client_operation_id,
      p_operation_type,
      p_request_hash,
      existing.operation_id,
      existing.outcome_class,
      'idempotent_replay'
    );

    return lh_trust_private.lh_operation_result(existing)
      || pg_catalog.jsonb_build_object('replay', true);
  end if;

  insert into public.lh_event_operation_attempts (
    actor_user_id,
    client_operation_id,
    operation_type,
    request_hash,
    canonical_operation_id,
    outcome_class,
    outcome_code
  )
  values (
    p_actor_user_id,
    p_client_operation_id,
    p_operation_type,
    p_request_hash,
    existing.operation_id,
    'rejected',
    'duplicate_operation_id_payload_mismatch'
  );

  insert into public.lh_security_audit_events (
    audit_id,
    event_type,
    actor_user_id,
    actor_grant_id,
    game_id,
    target_event_id,
    details
  )
  values (
    pg_catalog.gen_random_uuid()::text,
    'operation_tampering',
    p_actor_user_id,
    existing.actor_grant_id,
    existing.game_id,
    existing.event_id,
    pg_catalog.jsonb_build_object(
      'clientOperationId', p_client_operation_id,
      'expectedType', existing.operation_type,
      'attemptedType', p_operation_type
    )
  );

  return pg_catalog.jsonb_build_object(
    'operationId', existing.operation_id,
    'clientOperationId', p_client_operation_id,
    'operationType', p_operation_type,
    'outcome', 'rejected',
    'code', 'duplicate_operation_id_payload_mismatch',
    'serverEventVersion', existing.result_server_event_version,
    'eventId', existing.event_id,
    'gameId', existing.game_id,
    'replay', true
  );
end;
$$;

create or replace function lh_trust_private.lh_record_operation(
  p_actor_user_id uuid,
  p_client_operation_id text,
  p_operation_type text,
  p_game_id text,
  p_event_id text,
  p_request_hash text,
  p_outcome_class text,
  p_outcome_code text,
  p_result_version integer,
  p_actor_grant_id text,
  p_client_created_at timestamptz
)
returns public.lh_event_operations
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.lh_event_operations%rowtype;
begin
  insert into public.lh_event_operations (
    operation_id,
    actor_user_id,
    client_operation_id,
    operation_type,
    game_id,
    event_id,
    request_hash,
    outcome_class,
    outcome_code,
    result_server_event_version,
    actor_grant_id,
    client_created_at
  )
  values (
    pg_catalog.gen_random_uuid()::text,
    p_actor_user_id,
    p_client_operation_id,
    p_operation_type,
    p_game_id,
    p_event_id,
    p_request_hash,
    p_outcome_class,
    p_outcome_code,
    p_result_version,
    p_actor_grant_id,
    p_client_created_at
  )
  returning * into created;

  insert into public.lh_event_operation_attempts (
    actor_user_id,
    client_operation_id,
    operation_type,
    request_hash,
    canonical_operation_id,
    outcome_class,
    outcome_code
  )
  values (
    p_actor_user_id,
    p_client_operation_id,
    p_operation_type,
    p_request_hash,
    created.operation_id,
    p_outcome_class,
    p_outcome_code
  );

  insert into public.lh_security_audit_events (
    audit_id,
    event_type,
    actor_user_id,
    actor_grant_id,
    game_id,
    target_event_id,
    details
  )
  values (
    pg_catalog.gen_random_uuid()::text,
    case p_outcome_class
      when 'accepted' then 'operation_accepted'
      when 'conflicted' then 'operation_conflicted'
      else 'operation_rejected'
    end,
    p_actor_user_id,
    p_actor_grant_id,
    p_game_id,
    p_event_id,
    pg_catalog.jsonb_build_object(
      'operationType', p_operation_type,
      'outcomeCode', p_outcome_code
    )
  );

  return created;
end;
$$;

create or replace function lh_trust_private.lh_mutation_grant_for_game(
  p_user_id uuid,
  p_game_id text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select active.grant_id
  from lh_trust_private.lh_active_grants_for_user(p_user_id, pg_catalog.now()) as active
  join public.lh_game_scopes as game_scope
    on game_scope.game_id = p_game_id
  where
    (
      active.grant_role = 'parent'
      and active.scope_type = 'player'
      and active.team_id = game_scope.team_id
      and active.roster_player_id = game_scope.roster_player_id
    )
    or (
      active.grant_role = 'coach'
      and active.team_id = game_scope.team_id
      and (
        active.scope_type = 'team'
        or (
          active.scope_type = 'player'
          and active.roster_player_id = game_scope.roster_player_id
        )
      )
    )
  order by case active.grant_role when 'coach' then 1 else 2 end
  limit 1;
$$;

create or replace function lh_trust_private.lh_export_grant_for_game(
  p_user_id uuid,
  p_game_id text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select active.grant_id
  from lh_trust_private.lh_active_grants_for_user(p_user_id, pg_catalog.now()) as active
  join public.lh_game_scopes as game_scope
    on game_scope.game_id = p_game_id
  where active.team_id = game_scope.team_id
    and (
      (
        active.grant_role = 'parent'
        and active.scope_type = 'player'
        and active.roster_player_id = game_scope.roster_player_id
      )
      or (
        active.grant_role = 'coach'
        and (
          active.scope_type = 'team'
          or active.roster_player_id = game_scope.roster_player_id
        )
      )
      or (
        active.grant_role = 'team_admin'
        and active.scope_type = 'team'
      )
    )
  order by case active.grant_role when 'team_admin' then 1 when 'coach' then 2 else 3 end
  limit 1;
$$;

create or replace function lh_trust_private.lh_had_prior_mutation_grant(
  p_user_id uuid,
  p_game_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lh_access_grants as grants
    join public.lh_game_scopes as game_scope
      on game_scope.game_id = p_game_id
    where grants.user_id = p_user_id
      and grants.team_id = game_scope.team_id
      and grants.role in ('parent', 'coach')
      and (
        grants.scope_type = 'team'
        or grants.roster_player_id = game_scope.roster_player_id
      )
  );
$$;

create or replace function lh_trust_private.lh_next_revision_sequence(p_event_id text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(revision_sequence), 0) + 1
  from public.lh_event_revisions
  where event_id = p_event_id;
$$;

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

-- Public Data API wrappers. The privilege-bearing implementations remain in
-- the non-exposed private schema with fixed search paths and explicit auth/scope
-- checks.
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

create or replace function public.lh_create_event(p_operation jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_create_event_impl(p_operation);
$$;

create or replace function public.lh_correct_event(p_operation jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_correct_event_impl(p_operation);
$$;

create or replace function public.lh_tombstone_event(p_operation jsonb)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_tombstone_event_impl(p_operation);
$$;

create or replace function public.lh_public_live_share_game(p_share_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select lh_trust_private.lh_public_live_share_game_impl(p_share_code);
$$;

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

-- Deny-all table posture.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'lh_team_scopes',
    'lh_player_scopes',
    'lh_game_scopes',
    'lh_access_invitations',
    'lh_access_grants',
    'lh_grant_lifecycle_events',
    'lh_events',
    'lh_event_effective_versions',
    'lh_event_operations',
    'lh_event_operation_attempts',
    'lh_event_create_operations',
    'lh_event_correction_operations',
    'lh_event_tombstone_operations',
    'lh_event_restore_operations',
    'lh_event_revisions',
    'lh_event_tombstones',
    'lh_event_restorations',
    'lh_event_conflicts',
    'lh_conflict_adjudications',
    'lh_live_share_tokens',
    'lh_security_audit_events'
  ]
  loop
    execute pg_catalog.format('alter table public.%I enable row level security', table_name);
    execute pg_catalog.format('alter table public.%I force row level security', table_name);
    execute pg_catalog.format(
      'revoke all on table public.%I from public, anon, authenticated',
      table_name
    );
  end loop;
end;
$$;

revoke all on all functions in schema lh_trust_private from public, anon, authenticated;
grant usage on schema lh_trust_private to anon, authenticated;

grant execute on function lh_trust_private.lh_active_grants_for_user(uuid, timestamptz)
  to authenticated;
grant execute on function lh_trust_private.lh_create_event_impl(jsonb)
  to authenticated;
grant execute on function lh_trust_private.lh_correct_event_impl(jsonb)
  to authenticated;
grant execute on function lh_trust_private.lh_tombstone_event_impl(jsonb)
  to authenticated;
grant execute on function lh_trust_private.lh_public_live_share_game_impl(text)
  to anon, authenticated;
grant execute on function lh_trust_private.lh_record_sensitive_export_impl(text, text)
  to authenticated;

revoke execute on function public.lh_resolve_active_grants() from public, anon, authenticated;
revoke execute on function public.lh_create_event(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_correct_event(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_tombstone_event(jsonb) from public, anon, authenticated;
revoke execute on function public.lh_public_live_share_game(text) from public, anon, authenticated;
revoke execute on function public.lh_record_sensitive_export(text, text) from public, anon, authenticated;

grant execute on function public.lh_resolve_active_grants() to authenticated;
grant execute on function public.lh_create_event(jsonb) to authenticated;
grant execute on function public.lh_correct_event(jsonb) to authenticated;
grant execute on function public.lh_tombstone_event(jsonb) to authenticated;
grant execute on function public.lh_public_live_share_game(text) to anon, authenticated;
grant execute on function public.lh_record_sensitive_export(text, text) to authenticated;

commit;
