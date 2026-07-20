-- LaxHornet Trust Spine Release 1 schema proposal
-- STAGING PROPOSAL ONLY.
-- Do not apply to production.
-- Do not run without LH-00 approval, staging environment, test fixtures, and rollback plan.

-- Design goals:
-- 1. Separate invitations from active authority.
-- 2. Limit Release 1 roles to parent, coach, and team_admin.
-- 3. Preserve original evidence through append-only revisions.
-- 4. Use tombstones instead of hard deletes for evidence-bearing events.
-- 5. Keep heuristic suggestions separate from authoritative evidence state.
-- 6. Deny ordinary client access at schema introduction.

begin;

create table if not exists public.lh_access_invitations (
  id text primary key,
  invited_user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null default '',
  role text not null,
  scope_type text not null,
  team_id text references public.teams(id) on delete cascade,
  roster_player_id text references public.roster_players(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  invited_by_grant_id text,
  status text not null default 'pending',
  invitation_code_hash text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  revocation_reason text not null default '',
  constraint lh_access_invitations_role_check check (role in ('parent', 'coach', 'team_admin')),
  constraint lh_access_invitations_scope_check check (scope_type in ('team', 'player')),
  constraint lh_access_invitations_status_check check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  constraint lh_access_invitations_parent_scope_check check (role <> 'parent' or (scope_type = 'player' and team_id is not null and roster_player_id is not null)),
  constraint lh_access_invitations_team_admin_scope_check check (role <> 'team_admin' or (scope_type = 'team' and team_id is not null and roster_player_id is null)),
  constraint lh_access_invitations_player_scope_requires_player check (scope_type <> 'player' or roster_player_id is not null),
  constraint lh_access_invitations_team_scope_no_player check (scope_type <> 'team' or roster_player_id is null)
);

create table if not exists public.lh_access_grants (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  scope_type text not null,
  team_id text references public.teams(id) on delete cascade,
  roster_player_id text references public.roster_players(id) on delete cascade,
  granted_by_user_id uuid references auth.users(id) on delete set null,
  granted_by_grant_id text,
  invitation_id text references public.lh_access_invitations(id) on delete set null,
  granted_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  revocation_reason text not null default '',
  constraint lh_access_grants_role_check check (role in ('parent', 'coach', 'team_admin')),
  constraint lh_access_grants_scope_check check (scope_type in ('team', 'player')),
  constraint lh_access_grants_parent_scope_check check (role <> 'parent' or (scope_type = 'player' and team_id is not null and roster_player_id is not null)),
  constraint lh_access_grants_team_admin_scope_check check (role <> 'team_admin' or (scope_type = 'team' and team_id is not null and roster_player_id is null)),
  constraint lh_access_grants_player_scope_requires_player check (scope_type <> 'player' or roster_player_id is not null),
  constraint lh_access_grants_team_scope_no_player check (scope_type <> 'team' or roster_player_id is null)
);

create unique index if not exists lh_access_grants_one_active_equivalent
on public.lh_access_grants (
  user_id,
  role,
  scope_type,
  coalesce(team_id, ''),
  coalesce(roster_player_id, '')
)
where revoked_at is null;

create index if not exists lh_access_grants_user_active_idx
on public.lh_access_grants (user_id, role, team_id, roster_player_id)
where revoked_at is null;

create index if not exists lh_access_grants_team_active_idx
on public.lh_access_grants (team_id, role)
where revoked_at is null;

create table if not exists public.lh_event_effective_versions (
  event_id text primary key references public.events(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  team_id text references public.teams(id) on delete set null,
  roster_player_id text references public.roster_players(id) on delete set null,
  server_event_version integer not null default 1,
  latest_revision_id text,
  updated_at timestamptz not null default now(),
  constraint lh_event_effective_versions_version_positive check (server_event_version > 0)
);

create table if not exists public.lh_event_correction_operations (
  id text primary key,
  client_operation_id text not null,
  target_event_id text not null references public.events(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  acting_grant_id text references public.lh_access_grants(id) on delete restrict,
  last_known_server_event_version integer,
  changed_evidence_fields jsonb not null default '{}'::jsonb,
  correction_reason text not null default '',
  source text not null default 'client',
  client_created_at timestamptz,
  server_received_at timestamptz not null default now(),
  outcome text not null default 'received',
  outcome_reason text not null default '',
  constraint lh_event_correction_operations_outcome_check check (
    outcome in (
      'received',
      'accepted',
      'accepted_merge',
      'conflicted',
      'rejected_authority_changed',
      'rejected_tombstoned',
      'rejected_invalid_base',
      'rejected_invalid_input',
      'unauthorized'
    )
  ),
  constraint lh_event_correction_operations_unique_client_op unique (actor_user_id, client_operation_id)
);

create index if not exists lh_event_correction_operations_event_idx
on public.lh_event_correction_operations (target_event_id, server_received_at);

create table if not exists public.lh_event_revisions (
  id text primary key,
  operation_id text not null references public.lh_event_correction_operations(id) on delete restrict,
  event_id text not null references public.events(id) on delete restrict,
  game_id text not null references public.games(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  acting_grant_id text references public.lh_access_grants(id) on delete restrict,
  base_server_event_version integer,
  revision_sequence integer not null,
  changed_evidence_fields jsonb not null default '{}'::jsonb,
  prior_evidence_snapshot jsonb not null default '{}'::jsonb,
  proposed_evidence_snapshot jsonb not null default '{}'::jsonb,
  accepted_evidence_snapshot jsonb,
  conflict_state text not null default 'accepted',
  source text not null default 'client',
  client_created_at timestamptz,
  server_received_at timestamptz not null default now(),
  constraint lh_event_revisions_sequence_positive check (revision_sequence > 0),
  constraint lh_event_revisions_conflict_state_check check (
    conflict_state in ('accepted', 'accepted_merge', 'conflicted', 'rejected_authority_changed', 'rejected_tombstoned', 'rejected_invalid_base', 'rejected_invalid_input', 'unauthorized')
  ),
  constraint lh_event_revisions_unique_sequence unique (event_id, revision_sequence)
);

create index if not exists lh_event_revisions_event_idx
on public.lh_event_revisions (event_id, revision_sequence);

create table if not exists public.lh_event_tombstones (
  event_id text primary key references public.events(id) on delete restrict,
  game_id text not null references public.games(id) on delete restrict,
  deleted_by_user_id uuid not null references auth.users(id) on delete restrict,
  deleted_by_grant_id text references public.lh_access_grants(id) on delete restrict,
  deleted_operation_id text references public.lh_event_correction_operations(id) on delete restrict,
  deletion_reason text not null default '',
  tombstoned_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by_user_id uuid references auth.users(id) on delete restrict,
  restore_operation_id text references public.lh_event_correction_operations(id) on delete restrict
);

create table if not exists public.lh_evidence_states (
  event_id text primary key references public.events(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  evidence_integrity text not null default 'clean',
  context_state text not null default 'not_required',
  authoritative_review_state text not null default 'unreviewed',
  heuristic_suggestion jsonb,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_grant_id text references public.lh_access_grants(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint lh_evidence_states_integrity_check check (evidence_integrity in ('clean', 'conflicted', 'incomplete', 'tombstoned')),
  constraint lh_evidence_states_context_check check (context_state in ('not_required', 'needed', 'present')),
  constraint lh_evidence_states_review_check check (authoritative_review_state in ('unreviewed', 'in_review', 'reviewed'))
);

create table if not exists public.lh_personal_review_progress (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  roster_player_id text references public.roster_players(id) on delete cascade,
  progress_state text not null default 'unreviewed',
  last_seen_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lh_personal_review_progress_state_check check (progress_state in ('unreviewed', 'in_review', 'reviewed')),
  constraint lh_personal_review_progress_unique unique (user_id, game_id)
);

create table if not exists public.lh_security_audit_events (
  id text primary key,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_grant_id text references public.lh_access_grants(id) on delete set null,
  team_id text references public.teams(id) on delete set null,
  roster_player_id text references public.roster_players(id) on delete set null,
  game_id text references public.games(id) on delete set null,
  target_event_id text references public.events(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lh_security_audit_events_type_check check (
    event_type in (
      'access_grant',
      'access_revocation',
      'failed_role_escalation',
      'correction_acceptance',
      'correction_conflict',
      'correction_rejection_authority_changed',
      'event_tombstone',
      'event_restoration',
      'live_share_token_created',
      'live_share_token_revoked',
      'sensitive_export'
    )
  )
);

create index if not exists lh_security_audit_events_team_idx
on public.lh_security_audit_events (team_id, created_at desc);

create index if not exists lh_security_audit_events_actor_idx
on public.lh_security_audit_events (actor_user_id, created_at desc);

alter table public.lh_access_invitations enable row level security;
alter table public.lh_access_grants enable row level security;
alter table public.lh_event_effective_versions enable row level security;
alter table public.lh_event_correction_operations enable row level security;
alter table public.lh_event_revisions enable row level security;
alter table public.lh_event_tombstones enable row level security;
alter table public.lh_evidence_states enable row level security;
alter table public.lh_personal_review_progress enable row level security;
alter table public.lh_security_audit_events enable row level security;

-- Deny-all additive introduction.
-- No ordinary anon/authenticated grants are included in this proposal.
revoke all on table public.lh_access_invitations from anon, authenticated;
revoke all on table public.lh_access_grants from anon, authenticated;
revoke all on table public.lh_event_effective_versions from anon, authenticated;
revoke all on table public.lh_event_correction_operations from anon, authenticated;
revoke all on table public.lh_event_revisions from anon, authenticated;
revoke all on table public.lh_event_tombstones from anon, authenticated;
revoke all on table public.lh_evidence_states from anon, authenticated;
revoke all on table public.lh_personal_review_progress from anon, authenticated;
revoke all on table public.lh_security_audit_events from anon, authenticated;

-- Future staging-only RPCs after LH-00 approval:
-- - public.lh_resolve_active_grants()
-- - public.lh_public_live_share_game(p_share_code text)
-- - public.lh_submit_event_correction(p_operation jsonb)
-- - public.lh_tombstone_event(p_operation jsonb)
-- - public.lh_record_sensitive_export(p_export_type text, p_game_id text)
--
-- These are intentionally not implemented here because Release 1 requires
-- tests before schema/runtime paths and explicit LH-00 approval before staging work.

rollback;
