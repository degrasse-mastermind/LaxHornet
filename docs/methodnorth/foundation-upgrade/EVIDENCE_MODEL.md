# Evidence Model

## Principle

Recorded events are evidence. Corrections may change the current view, but they must not destroy the original record.

## Existing Event Model

Current events include useful evidence fields such as:

- `id`
- `gameId`
- `timestamp`
- `quarter` or period
- `statType`
- `category`
- `pointValue`
- `note`
- `tags`
- `fieldZone`
- score and game-context fields where available
- `correctedAt` on edited records

The current `correctedAt` field is not complete revision history. It indicates that a correction occurred, not what changed, who changed it, why, or how many corrections happened.

## Additive Revision Model

Each correction should create an immutable revision record with:

- `revision_id`
- `event_id`
- `game_id`
- `revision_sequence`
- `prior_value`
- `corrected_value`
- `changed_fields`
- `correction_reason`
- `author_user_id`
- `author_role`
- `created_at`
- `source`
- `approval_status`

The original event remains recoverable. The current event may still be stored efficiently on the event row for fast loading, but revision history becomes the source for audit.

## Revision Rules

- Never overwrite a prior revision.
- Never delete revisions when an event is edited.
- Preserve current-state efficiency for the mobile app.
- Store full before/after snapshots for changed fields.
- Require a correction reason for coach/admin review surfaces, but allow a fallback such as `sideline correction` for parent MVP edits.
- Track whether the revision came from live tracking, post-game edit, import, sync conflict, admin correction, or future coach context.

## Legacy Event Handling

Legacy events without revision records remain valid.

Legacy corrected events should be represented as:

- original event: unknown prior state unless it was preserved elsewhere.
- current event: current event row.
- revision history: unavailable before Project One foundation.
- display: "Edited before revision history was enabled" where appropriate.

Do not reconstruct prior values from guesswork.

## Offline Sync

Offline edits should create pending revision envelopes:

- client-generated revision ID
- target event ID
- base known event hash or updated timestamp
- changed fields
- local created timestamp
- sync status

When synced:

- append revision if no conflict exists
- if a remote revision already changed the same field, preserve both revisions and mark event evidence `context_needed` or `evidence_incomplete`
- do not silently collapse revisions through last-write-wins

## Evidence Status

Evidence status belongs beside events, not inside interpretation copy:

- `recorded`
- `context_needed`
- `context_added`
- `reviewed`

Heuristics may suggest `context_needed`, but a human reviewer controls authoritative status.

## What Must Not Be Inferred From Raw Evidence

Raw events alone must not infer:

- motivation
- confidence
- intent
- effort level
- attitude
- decision quality
- coach judgment
- family guidance readiness

Those require context, review, or cautious language.
