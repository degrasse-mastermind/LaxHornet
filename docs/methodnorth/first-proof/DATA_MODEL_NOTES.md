# Data Model Notes

Status: audit only

## Existing Fields Available

### Game

From local `normalizeGame` and Supabase `public.games`:

- `id`
- `playerId`
- `teamId`
- `rosterPlayerId`
- `userId`
- `shareCode`
- `isShared`
- `opponent`
- `date` / `game_date`
- `periodFormat`
- `currentQuarter`
- `status`
- `playerSnapshot`
- `scoreFor`
- `scoreAgainst`
- `finalScoreFor`
- `finalScoreAgainst`
- `createdAt`
- `savedAt`
- `endedAt`

### Event

From local `normalizeEvent` and Supabase `public.events`:

- `id`
- `gameId`
- `userId`
- `teamId`
- `rosterPlayerId`
- `timestamp`
- `quarter`
- `statType`
- `statLabel`
- `category`
- `pointValue`
- `tags`
- `note`
- `fieldZone`
- `correctedAt`
- `tagsUpdatedAt`
- `scoreForAtEvent`
- `scoreAgainstAtEvent`
- `scoreMarginAtEvent`
- `scoreStateAtEvent`
- `gameSegmentAtEvent`
- `scoreAutoIncrement`
- `scoreForBeforeEvent`
- `scoreAgainstBeforeEvent`

## Derived Fields

These can be derived without schema changes:

- event order
- game segment from period
- factual event description from stat label, period, timestamp, field zone, and score context
- source as `system/user-recorded event`
- context-needed heuristic based on missing timestamp, unknown field zone, note absence, or stat types requiring human context
- completion status for a minimal development adapter
- parent-safe selected moments
- event count
- final result if score context exists

## Fields Requiring Additions For Production-Grade Project One

Likely additions:

- `review_state`
- `review_deferred_at`
- `evidence_status`
- `event_source_type`
- `event_source_user_id`
- `coach_context`
- `coach_context_author`
- `coach_context_created_at`
- immutable event revisions or correction-history table
- original value
- corrected value
- correction author
- correction timestamp
- correction reason
- role-specific disclosure state
- feature/version marker

## Current Correction Support

Current event editing updates the event in place and stores `correctedAt`. That is useful as a minimal "this was changed" signal but does not preserve:

- original event value
- corrected event value
- correction author
- correction timestamp beyond one timestamp
- correction reason
- multiple corrections
- visibility of original record after correction

## Can Existing Data Preserve Original Evidence After Correction?

Decision: not fully.

The current model can preserve original evidence only if a development-only adapter snapshots an event before edit into local review metadata. That would not be production-grade, cross-device, or enforceable through the backend.

Production-grade preservation likely requires schema additions.

## Can Existing Data Support Coach-Added Context?

Decision: not safely as a distinct data class.

The `note` field exists but it is not role-scoped and may already be used by parent trackers. Using it for coach-added context would blur source authority and disclosure boundaries.

## Can Existing Data Support Completion / Context Needed?

Decision: yes for heuristic display, no for authoritative workflow.

A flagged prototype can derive `Complete` and `Context needed` from existing event completeness. A production workflow needs explicit status storage and reviewer authority.

## Can Existing Data Support Review Later?

Decision: yes locally, not reliably across devices without additional persistence.

Local storage can store deferred review state keyed by user/game. If the feature promises cross-device review continuity, it needs cloud storage.

## Local-Storage Limitations

- Device-specific.
- Can be cleared by browser/device reset.
- Not authoritative for role disclosure.
- Not suitable for audit history.
- Can diverge from cloud if sync fails.

## Backend Limitations

- No coach role.
- No evidence review state.
- No correction history table.
- No coach-context table.
- Existing `events` table stores current event state, not immutable revisions.

## Migration Considerations

No migration is required for an audit-only pass or for a strictly development-only flagged adapter.

Production-grade Project One likely requires additive migrations. Destructive migrations should not be required and should be treated as a stop condition.

## Privacy Implications

- Notes and tags may contain sensitive information and should not be exposed broadly.
- Parent-visible evidence should be scoped to approved player access.
- Coach context should remain hidden unless explicitly approved.
- Live Share must stay read-only and should not include private Project One context.
