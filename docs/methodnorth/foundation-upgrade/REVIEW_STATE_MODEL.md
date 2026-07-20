# Review State Model

## Purpose

Review state records where a game sits in the evidence-before-interpretation process. It must persist across devices and roles, unlike local-only "review later" state.

## Initial States

| State | Meaning |
| --- | --- |
| `review_not_started` | Game exists, but evidence review has not begun. |
| `review_deferred` | User intentionally chose to come back later. |
| `evidence_incomplete` | Evidence has unresolved gaps, corrections, or context needs. |
| `evidence_ready` | Evidence is ready for interpretation/review. |
| `evidence_reviewed` | Evidence has been reviewed at the current feature version. |

## Future Extensible States

Reserved for later Project One phases:

- `context_understood`
- `next_edge_proposed`
- `guidance_reviewed`
- `review_complete`
- `movement_tracking`

These should not be implemented in this phase beyond compatibility for state expansion.

## Scope

Review state should include:

- `game_id`
- `user_id`
- `role`
- optional `team_id`
- optional `roster_player_id`
- `review_state`
- `feature_version`
- timestamps for creation, updates, deferral, readiness, and review
- optional `deleted_at` for safe cleanup

Role-specific progress matters. A parent deferring review should not imply a coach has reviewed evidence.

## Transitions

Allowed initial transitions:

- `review_not_started` -> `review_deferred`
- `review_not_started` -> `evidence_incomplete`
- `review_not_started` -> `evidence_ready`
- `review_deferred` -> `evidence_ready`
- `evidence_incomplete` -> `evidence_ready` after needed context is added and reviewed
- `evidence_ready` -> `evidence_reviewed`

If a transition is not explicitly allowed, keep the current state and record a warning for review.

## Conflict Policy

Review state should not use blind last-write-wins.

Recommended conflict rules:

- `evidence_incomplete` wins over `evidence_ready` if a newer correction/context need exists.
- `review_deferred` is user-specific and should not block another role.
- `evidence_reviewed` is invalidated when new revisions arrive after review.
- Same-user same-game conflicts should keep the latest timestamp but retain prior audit trail.
- Cross-role conflicts should preserve both role-specific state rows.

## Deletion

When a game is deleted:

- review-state records should be tombstoned or cascade-deleted only through a trusted backend path.
- local deleted-game tombstones should prevent rehydration from stale sync.
- Live Share should stop resolving private review state after game deletion.

## Offline Limitation

A static PWA can queue review-state changes while offline, but it cannot enforce cross-device truth until sync succeeds. User-facing copy should say saved on this phone / will sync when online, not imply cloud review state is final.
