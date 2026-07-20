# Project One Foundation Upgrade

Status: architecture and migration proposal only.

Branch: `feature/project-one-foundation`

This folder defines the production-oriented foundation LaxHornet needs before any Project One user experience is built. It intentionally does not implement AI interpretation, athlete guidance, Next Edge, movement tracking, parent conversation support, or a redesigned review surface.

## Source Material

This plan was built from:

- The completed audit artifacts on `feature/project-one-evidence-review` under `docs/methodnorth/first-proof`.
- The MethodNorth Observatory doctrine in `C:/Users/user/Documents/methodnorth-observatory`.
- The existing LaxHornet data and role concepts in the current app and Supabase schema.

MethodNorth remains read-only source material. No MethodNorth files were changed.

## Documents

- `ARCHITECTURE_PLAN.md` - foundation architecture and staged implementation.
- `ROLE_MODEL.md` - explicit role and scope model.
- `EVIDENCE_MODEL.md` - immutable event evidence and revisions.
- `DISCLOSURE_MODEL.md` - role-enforced visibility and approval states.
- `REVIEW_STATE_MODEL.md` - cloud-persisted review progress and evidence state.
- `MIGRATION_PLAN.md` - additive migration strategy.
- `SECURITY_PLAN.md` - RLS, access, and audit requirements.
- `BACKWARD_COMPATIBILITY.md` - legacy game, event, user, and Live Share behavior.
- `ROLLBACK_PLAN.md` - rollback strategy if any proposed migration is later applied.
- `FOUNDATION_REVIEW.md` - implementation readiness review.
- `migrations/001_project_one_foundation_proposal.sql` - review-only Supabase SQL proposal. It has not been applied.

## Non-Goals

- No production migration is applied in this phase.
- No runtime code is changed in this phase.
- No app UI is changed in this phase.
- No athlete-facing account behavior is introduced.
- No existing parent, tracker, or admin permission is silently changed.
- No private context is exposed through Live Share.

## Governing Principle

LaxHornet can capture quickly during a game, but review must be humane, source-aware, and context-aware. The foundation separates recorded evidence, human-provided context, interpretation, recommendation, and final human decision.
