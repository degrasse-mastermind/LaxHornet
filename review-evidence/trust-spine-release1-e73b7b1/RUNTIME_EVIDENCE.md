# Runtime Flow Evidence

## Included call graphs

The `runtime-flow/` folder contains files captured from implementation commit
`e73b7b1`:

- `AUTHORIZATION_CALL_GRAPH.md`
- `EVENT_MUTATION_CALL_GRAPH.md`
- `OFFLINE_SYNC_CURRENT_STATE.md`
- `LIVE_SHARE_AND_EXPORT_DATA_FLOW.md`
- `TRUST_SPINE_SYNC_STATE_MACHINE.md`

## Authorization

The migration provides:

- Active-grant resolution through `public.lh_resolve_active_grants()`.
- Private active-grant selection with accepted, unexpired, non-revoked
  lifecycle checks.
- Team, player, and game scope checks before evidence operations.

The existing browser runtime was intentionally not cut over to these RPCs.

## Event mutation

The migration provides separate public operations for:

- Create: `public.lh_create_event(jsonb)`
- Correct: `public.lh_correct_event(jsonb)`
- Tombstone: `public.lh_tombstone_event(jsonb)`

Private implementations record operation attempts, accepted/rejected/conflicted
outcomes, revisions, tombstones, and conflicts.

### Restore gap

Release 1 defines restore operation and restoration tables, lifecycle values,
and immutability triggers, but has no public or private restore-event RPC.
Restore cannot be executed through the approved RPC surface. This is a material
gap against the requested separate restore operation.

## Offline queue and receipts

The production app still stores full game state and deletion-ID arrays in
account-scoped local storage. It has no Trust Spine durable operation queue,
permanent operation IDs, server-version receipts, or accepted/conflicted replay
protocol.

The migration defines server-side operation receipts, but there is no browser
runtime integration. This is evidence of a designed server contract, not a
working offline Trust Spine flow.

## Live Share

`public.lh_public_live_share_game(text)` returns only explicit game/event fields.
It excludes notes, tags, author/grant IDs, revisions, conflicts, and workflow
state.

The current app is not wired to that RPC; its legacy shared-game flow remains in
place. See `EXPORT_AND_LIVE_SHARE_EVIDENCE.md`.

## Sensitive export

`public.lh_record_sensitive_export(text, text)` validates four export types,
checks grant scope, records a security-audit row, and returns the approved field
manifests.

It does not itself produce an export file. Browser CSV/JSON export was not cut
over, and separate family/public export modes were not implemented in this
release.
