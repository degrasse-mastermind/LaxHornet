# Trust Spine Sync State Machine

Status: proposed Release 1 sync contract. Not implemented.

## Current problem

Current sync replays local game/event state through direct upserts and delete calls. It does not produce permanent operation receipts, server versions, or conflict outcomes. Trust Spine requires an operation-state machine for evidence-bearing changes.

## Operation identity

Every queued evidence operation must include:

- `client_operation_id`: permanent UUID generated once.
- `target_event_id`: stable event UUID.
- `game_id`.
- `last_known_server_event_version`.
- `changed_evidence_fields`.
- `client_created_at`.
- `source`: `live_capture`, `review_edit`, `tag_edit`, `delete`, `import_recovery`, or similar.

## States

```text
local_draft
  -> queued
  -> sending
  -> accepted
  -> accepted_merge
  -> conflicted
  -> rejected_authority_changed
  -> rejected_tombstoned
  -> rejected_invalid_base
  -> rejected_invalid_input
  -> unauthorized
```

## State definitions

| State | Meaning | User impact |
|---|---|---|
| `local_draft` | User created a correction locally | Visible only to creator |
| `queued` | Ready to send when online | Shows waiting status |
| `sending` | In flight | Disable duplicate submit |
| `accepted` | Server accepted and applied | Update effective event row |
| `accepted_merge` | Server merged non-overlapping change | Show synced with note if needed |
| `conflicted` | Same-field or policy conflict | Keep local draft; ask for review |
| `rejected_authority_changed` | User lost access before sync | Preserve local draft, do not apply |
| `rejected_tombstoned` | Target event was deleted/tombstoned | Preserve draft as rejected, do not resurrect |
| `rejected_invalid_base` | Unknown/stale base version | Preserve draft, ask user to refresh |
| `rejected_invalid_input` | Payload failed validation | Preserve draft with fix prompt |
| `unauthorized` | No active scoped grant | Do not apply |

## Server responsibilities

The server owns:

- Current authority at receipt time.
- Server event version.
- Revision sequence.
- Conflict classification.
- Receipt ordering.
- Tombstone rejection.
- Audit-event insertion.

Client time is provenance only.

## Merge rules

- Same operation ID replay: return previous result; do not duplicate revision.
- Different-field concurrent changes: may merge only when policy allows; preserve both revisions.
- Same-field concurrent changes: preserve both proposed revisions and mark conflict.
- Tombstoned target: do not update effective event row.
- Authority revoked: reject even if operation was created while authorized.

## Release 1 offline boundary

Offline allowed:

- New game capture.
- New event capture.
- Correction drafts.
- Queue status.

Online-only:

- Grant/invitation changes.
- Role revocation.
- Disclosure release.
- Coach-context release.
- Authoritative conflict adjudication.
- Support elevation.

## Client receipt handling

On receipt:

- `accepted`: update local effective event and clear queue item.
- `accepted_merge`: update local effective event; keep revision receipt.
- `conflicted`: keep local draft, display conflict state, do not overwrite.
- `rejected_authority_changed`: keep draft exportable for creator, remove shared visibility.
- `rejected_tombstoned`: keep draft, show event was removed.
- `invalid_base`: refresh server event and ask user to retry/review.

No receipt should silently delete local work.
