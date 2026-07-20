# Rollback Plan

## Current Phase

No production migration or runtime change has been applied. Rollback for this phase is simply removing or revising this documentation branch before merge.

## If Migration Proposals Are Applied Later

Rollback order:

1. Disable `PROJECT_ONE_EVIDENCE_REVIEW`.
2. Disable `PROJECT_ONE_FOUNDATION`.
3. Revoke grants from new tables if exposure is suspected.
4. Confirm current LaxHornet games, events, access, sync, exports, and Live Share still work.
5. Preserve foundation tables for audit until data retention is reviewed.
6. Drop proposal tables only if they contain no needed user data.

## Do Not Do This

- Do not drop revision history if users have already made corrections through it.
- Do not delete coach context without export/review.
- Do not rewrite events to "undo" Project One.
- Do not revoke current production access by mapping old roles incorrectly.

## Data Preservation

If rollback happens after partial use:

- Event originals remain in the existing event table.
- Current event state remains readable.
- Revision records remain archived unless explicitly purged after review.
- Review state may be ignored by the UI but should not be silently deleted.

## User-Facing Fallback

If foundation features are disabled:

- Parents continue using current Home, Track, Review, Season, and More flows.
- Admins continue using current team and roster tools.
- Existing local/offline tracking remains available.

## Validation After Rollback

Run:

- app smoke test
- parent access test
- admin roster test
- game save/delete/sync test
- Live Share privacy test
- export/import smoke test

Rollback is not complete until current production behavior is verified.
