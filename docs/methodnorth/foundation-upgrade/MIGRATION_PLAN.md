# Migration Plan

## Status

No migrations have been applied. The SQL in `migrations/001_project_one_foundation_proposal.sql` is a review-only proposal.

## Migration Principles

- Additive only.
- Preserve existing users, teams, roster players, games, and events.
- Preserve current app behavior until feature flags are enabled.
- Enable RLS on every new public table.
- Index foreign keys and RLS lookup columns.
- Do not expose private context through Live Share.
- Do not use user-editable metadata for authorization.
- Avoid destructive rewrites of event history.

## Proposed Additions

1. `project_one_role_assignments`
   - Scoped roles for parent, coach, team admin, club admin, and platform admin.
   - Additive to existing `team_members` and `player_claims`.

2. `project_one_event_revisions`
   - Immutable correction history for events.
   - Preserves prior and corrected values, author, role, reason, source, and approval status.

3. `project_one_coach_context`
   - Factual context attached to an event or game.
   - Separate from note, tag, interpretation, and recommendation.

4. `project_one_game_review_state`
   - Cloud review state per user/role/game.
   - Supports review later and evidence-first state.

5. `project_one_evidence_status`
   - Authoritative and heuristic evidence status per event.
   - Separates human review state from automated suggestions.

6. `project_one_disclosure_rules`
   - Explicit visibility state for foundation record types.
   - Allows conservative rollout before richer policy implementation.

## Legacy Data Strategy

- Existing events load normally.
- Existing edited events with `correctedAt` are labeled as edited before revision history where needed.
- Existing parent access remains governed by current player claims until explicit role migration.
- Existing team admins remain current admins until explicit role migration.
- No athlete-facing user is created.

## Feature Flag Strategy

Recommended flags:

- `PROJECT_ONE_FOUNDATION`
- `PROJECT_ONE_EVIDENCE_REVIEW`

Both default off. Production activation should be team-scoped or account-scoped by trusted config, not by ordinary user controls.

Foundation records should include `feature_version`, starting at `project_one_foundation_v1`.

## Review-Only SQL

The proposal intentionally lives in docs, not in the app's production schema file. It should be copied into a real Supabase migration only after architecture/security review.

Before applying a real migration:

1. Re-check current Supabase docs and changelog.
2. Review RLS policies.
3. Run in a local or staging Supabase project.
4. Run database advisors if available.
5. Test role boundaries with real authenticated sessions.
6. Verify Live Share cannot read private foundation records.

## Rollback Notes

If a proposal is applied to staging and fails:

- Disable feature flags first.
- Revoke direct grants if needed.
- Keep tables for forensic review until data retention is decided.
- Drop only unused proposal tables after confirming no production behavior depends on them.

If applied to production by mistake, do not immediately drop data. Disable flags and restrict grants first.
