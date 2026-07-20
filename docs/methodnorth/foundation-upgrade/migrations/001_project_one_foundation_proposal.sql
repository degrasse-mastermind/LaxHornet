-- REVIEW PROPOSAL ONLY.
-- Do not apply to production without explicit approval, staging validation, and RLS review.
-- Project One Foundation v1: additive tables for roles, evidence revisions, coach context,
-- review state, evidence status, and disclosure rules.

create table if not exists public.project_one_role_assignments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id text references public.teams(id) on delete cascade,
  roster_player_id text references public.roster_players(id) on delete cascade,
  role text not null,
  scope_type text not null,
  scope_id text,
  invitation_status text not null default 'accepted',
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  feature_version text not null default 'project_one_foundation_v1',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_one_role_assignments_role_check check (
    role in ('parent', 'coach', 'team_admin', 'club_admin', 'platform_admin')
  ),
  constraint project_one_role_assignments_scope_type_check check (
    scope_type in ('platform', 'club', 'team', 'player')
  ),
  constraint project_one_role_assignments_invitation_status_check check (
    invitation_status in ('pending', 'accepted', 'declined', 'revoked')
  )
);

create table if not exists public.project_one_event_revisions (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  revision_sequence integer not null,
  prior_value jsonb not null default '{}'::jsonb,
  corrected_value jsonb not null default '{}'::jsonb,
  changed_fields text[] not null default array[]::text[],
  correction_reason text,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text,
  source text not null default 'post_game_edit',
  approval_status text not null default 'not_required',
  feature_version text not null default 'project_one_foundation_v1',
  created_at timestamptz not null default now(),
  constraint project_one_event_revisions_sequence_positive check (revision_sequence > 0),
  constraint project_one_event_revisions_approval_status_check check (
    approval_status in ('not_required', 'pending', 'approved', 'rejected')
  ),
  constraint project_one_event_revisions_unique_sequence unique (event_id, revision_sequence)
);

create table if not exists public.project_one_coach_context (
  id text primary key,
  game_id text references public.games(id) on delete cascade,
  event_id text references public.events(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_role text not null,
  factual_context text not null,
  visibility text not null default 'coach_only',
  review_status text not null default 'draft',
  approval_status text not null default 'not_required',
  version_sequence integer not null default 1,
  supersedes_context_id text references public.project_one_coach_context(id) on delete set null,
  feature_version text not null default 'project_one_foundation_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_one_coach_context_target_check check (
    game_id is not null or event_id is not null
  ),
  constraint project_one_coach_context_visibility_check check (
    visibility in ('coach_only', 'reviewer_only', 'parent_visible', 'family_visible', 'withheld', 'review_required')
  ),
  constraint project_one_coach_context_review_status_check check (
    review_status in ('draft', 'submitted', 'reviewed', 'withheld')
  ),
  constraint project_one_coach_context_approval_status_check check (
    approval_status in ('not_required', 'pending', 'approved', 'rejected')
  )
);

create table if not exists public.project_one_game_review_state (
  id text primary key,
  game_id text not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id text references public.teams(id) on delete cascade,
  roster_player_id text references public.roster_players(id) on delete cascade,
  role text not null,
  review_state text not null default 'review_not_started',
  feature_version text not null default 'project_one_foundation_v1',
  deferred_at timestamptz,
  evidence_ready_at timestamptz,
  evidence_reviewed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_one_game_review_state_role_check check (
    role in ('parent', 'coach', 'team_admin', 'club_admin', 'platform_admin')
  ),
  constraint project_one_game_review_state_state_check check (
    review_state in ('review_not_started', 'review_deferred', 'evidence_incomplete', 'evidence_ready', 'evidence_reviewed')
  ),
  constraint project_one_game_review_state_unique_scope unique (game_id, user_id, role)
);

create table if not exists public.project_one_evidence_status (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  authoritative_status text not null default 'recorded',
  heuristic_status text,
  status_reason text,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewer_role text,
  visibility text not null default 'parent_visible',
  feature_version text not null default 'project_one_foundation_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_one_evidence_status_authoritative_check check (
    authoritative_status in ('recorded', 'context_needed', 'context_added', 'reviewed')
  ),
  constraint project_one_evidence_status_heuristic_check check (
    heuristic_status is null or heuristic_status in ('recorded', 'context_needed', 'context_added', 'reviewed')
  ),
  constraint project_one_evidence_status_visibility_check check (
    visibility in ('coach_only', 'reviewer_only', 'parent_visible', 'family_visible', 'withheld', 'review_required')
  ),
  constraint project_one_evidence_status_event_unique unique (event_id)
);

create table if not exists public.project_one_disclosure_rules (
  id text primary key,
  record_type text not null,
  record_id text not null,
  visibility text not null default 'review_required',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approval_note text,
  feature_version text not null default 'project_one_foundation_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_one_disclosure_rules_record_type_check check (
    record_type in (
      'original_event',
      'current_event',
      'event_revision',
      'coach_context',
      'private_note',
      'public_tag',
      'private_process_tag',
      'evidence_status',
      'incomplete_interpretation',
      'future_recommendation',
      'parent_summary',
      'athlete_guidance_future'
    )
  ),
  constraint project_one_disclosure_rules_visibility_check check (
    visibility in ('coach_only', 'reviewer_only', 'parent_visible', 'family_visible', 'athlete_visible_future', 'withheld', 'review_required')
  ),
  constraint project_one_disclosure_rules_unique_record unique (record_type, record_id)
);

create index if not exists project_one_role_assignments_user_idx
  on public.project_one_role_assignments (user_id)
  where revoked_at is null;

create index if not exists project_one_role_assignments_team_idx
  on public.project_one_role_assignments (team_id, role)
  where revoked_at is null;

create index if not exists project_one_role_assignments_player_idx
  on public.project_one_role_assignments (roster_player_id, role)
  where revoked_at is null;

create index if not exists project_one_event_revisions_event_idx
  on public.project_one_event_revisions (event_id, revision_sequence);

create index if not exists project_one_event_revisions_game_idx
  on public.project_one_event_revisions (game_id);

create index if not exists project_one_coach_context_game_idx
  on public.project_one_coach_context (game_id);

create index if not exists project_one_coach_context_event_idx
  on public.project_one_coach_context (event_id);

create index if not exists project_one_game_review_state_game_user_idx
  on public.project_one_game_review_state (game_id, user_id, role);

create index if not exists project_one_game_review_state_player_idx
  on public.project_one_game_review_state (roster_player_id, review_state);

create index if not exists project_one_evidence_status_game_idx
  on public.project_one_evidence_status (game_id, authoritative_status);

create index if not exists project_one_disclosure_rules_record_idx
  on public.project_one_disclosure_rules (record_type, record_id);

alter table public.project_one_role_assignments enable row level security;
alter table public.project_one_event_revisions enable row level security;
alter table public.project_one_coach_context enable row level security;
alter table public.project_one_game_review_state enable row level security;
alter table public.project_one_evidence_status enable row level security;
alter table public.project_one_disclosure_rules enable row level security;

grant select, insert, update on public.project_one_role_assignments to authenticated;
grant select, insert on public.project_one_event_revisions to authenticated;
grant select, insert, update on public.project_one_coach_context to authenticated;
grant select, insert, update on public.project_one_game_review_state to authenticated;
grant select, insert, update on public.project_one_evidence_status to authenticated;
grant select, insert, update on public.project_one_disclosure_rules to authenticated;

-- Conservative RLS proposal.
-- These policies intentionally lean narrow. They should be tested in staging with real JWTs
-- and then refined before production.

create policy "project one roles visible to assignee or current admin"
on public.project_one_role_assignments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.laxhornet_can_edit_team(team_id)
  or public.laxhornet_is_platform_reviewer()
);

create policy "project one roles managed by current admin"
on public.project_one_role_assignments
for insert
to authenticated
with check (
  public.laxhornet_can_edit_team(team_id)
  or public.laxhornet_is_platform_reviewer()
);

create policy "project one roles revoked by current admin"
on public.project_one_role_assignments
for update
to authenticated
using (
  public.laxhornet_can_edit_team(team_id)
  or public.laxhornet_is_platform_reviewer()
)
with check (
  public.laxhornet_can_edit_team(team_id)
  or public.laxhornet_is_platform_reviewer()
);

create policy "project one review state visible to owner or current admin"
on public.project_one_game_review_state
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.laxhornet_can_edit_team(team_id)
  or public.laxhornet_is_platform_reviewer()
);

create policy "project one review state owner insert"
on public.project_one_game_review_state
for insert
to authenticated
with check (
  user_id = (select auth.uid())
);

create policy "project one review state owner update"
on public.project_one_game_review_state
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.laxhornet_can_edit_team(team_id)
  or public.laxhornet_is_platform_reviewer()
)
with check (
  user_id = (select auth.uid())
  or public.laxhornet_can_edit_team(team_id)
  or public.laxhornet_is_platform_reviewer()
);

create policy "project one revisions visible to authorized game access"
on public.project_one_event_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.games g
    where g.id = project_one_event_revisions.game_id
      and (
        g.user_id = (select auth.uid())
        or public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
);

create policy "project one revisions appended by authorized game access"
on public.project_one_event_revisions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.games g
    where g.id = project_one_event_revisions.game_id
      and (
        g.user_id = (select auth.uid())
        or public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
);

create policy "project one coach context visible to scoped staff"
on public.project_one_coach_context
for select
to authenticated
using (
  (
    visibility in ('parent_visible', 'family_visible')
    and exists (
      select 1
      from public.games g
      left join public.events e on e.game_id = g.id
      where (g.id = project_one_coach_context.game_id or e.id = project_one_coach_context.event_id)
        and g.user_id = (select auth.uid())
    )
  )
  or exists (
    select 1
    from public.games g
    left join public.events e on e.game_id = g.id
    where (g.id = project_one_coach_context.game_id or e.id = project_one_coach_context.event_id)
      and (
        public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
);

create policy "project one coach context added by scoped staff"
on public.project_one_coach_context
for insert
to authenticated
with check (
  exists (
    select 1
    from public.games g
    left join public.events e on e.game_id = g.id
    where (g.id = project_one_coach_context.game_id or e.id = project_one_coach_context.event_id)
      and (
        public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
);

create policy "project one evidence status visible to authorized game access"
on public.project_one_evidence_status
for select
to authenticated
using (
  exists (
    select 1
    from public.games g
    where g.id = project_one_evidence_status.game_id
      and (
        g.user_id = (select auth.uid())
        or public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
);

create policy "project one evidence status managed by staff"
on public.project_one_evidence_status
for insert
to authenticated
with check (
  exists (
    select 1
    from public.games g
    where g.id = project_one_evidence_status.game_id
      and (
        public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
);

create policy "project one evidence status updated by staff"
on public.project_one_evidence_status
for update
to authenticated
using (
  exists (
    select 1
    from public.games g
    where g.id = project_one_evidence_status.game_id
      and (
        public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
)
with check (
  exists (
    select 1
    from public.games g
    where g.id = project_one_evidence_status.game_id
      and (
        public.laxhornet_can_edit_team(g.team_id)
        or public.laxhornet_is_platform_reviewer()
      )
  )
);

create policy "project one disclosure rules visible to staff"
on public.project_one_disclosure_rules
for select
to authenticated
using (
  public.laxhornet_is_platform_reviewer()
);

create policy "project one disclosure rules managed by platform"
on public.project_one_disclosure_rules
for insert
to authenticated
with check (
  public.laxhornet_is_platform_reviewer()
);

create policy "project one disclosure rules updated by platform"
on public.project_one_disclosure_rules
for update
to authenticated
using (
  public.laxhornet_is_platform_reviewer()
)
with check (
  public.laxhornet_is_platform_reviewer()
);
