# Tracked Playing Time Foundation

Status: review-only foundation  
Branch: `feature/tracked-playing-time-foundation`  
Production state: not applied, deployed, activated, or exposed in the UI

## Boundary

Tracked Playing Time is intentionally separate from the existing stat Event Pipeline:

- `lh_game_clock_states` holds the latest authoritative private game-clock checkpoint.
- `lh_participation_logical_events` holds stable player-in/player-out identities.
- `lh_participation_operations` holds append-only create, correction, and tombstone history.
- `lh_effective_participation_operations` resolves the current non-tombstoned operation for each stable identity.

No existing event table, event RPC, public Live Share RPC, service-worker marker, or runtime capability flag is changed.

## Clock model

Clock state records the period format, configured regulation and overtime durations, current period, seconds remaining, running/paused anchors, client/server update times, recovery state, and optimistic revision. Quarters, halves, and OT are explicit. The client computes elapsed game time from a persisted anchor; pause freezes it and period transitions reset it to the configured duration.

Refresh recovery is bounded:

- `complete`: the persisted checkpoint is sufficient.
- `estimated`: the client can project a bounded running interval from a known anchor.
- `needs_review`: uncertainty is material, so the clock remains frozen for review rather than inventing elapsed time.

Game-end closure records the final clock context on system-generated player-out operations.

## Stable identity and append-only correction

`logical_event_id` is the stable identity of a player-in or player-out fact. Every accepted operation has its own `operation_id`, request hash, actor, revision sequence, clock context, and recovery state. Corrections and tombstones target the current operation but preserve the stable logical identity and the complete prior history.

The resolver reads the logical row's current operation and excludes tombstones. Reusing an operation ID with the same request is idempotent; reusing it with different content is rejected.

## Authorization

Direct browser access to all three tables and the effective view is revoked. RLS is enabled and forced. Browser clients use nine `security definer`, fixed-search-path RPC wrappers granted only to `authenticated`.

- Personal games: the authenticated account must own the canonical game and the tracked player is fixed by that game.
- Team-roster games: initialization must match the canonical Trust Spine game scope; mutations reuse active Trust Spine mutation grants; reads reuse the existing read/export scope rules.
- Cross-account, cross-team, cross-game, and cross-player attempts return bounded rejection results.

## Disclosure and backup

Clock and participation history are private child-associated operational data.

- Public Live Share: excluded.
- User-previewed recap: excluded.
- Selected CSV: excluded because the existing CSV contract iterates stat events only.
- Private full backup: included when stored under the game's `trackedPlayingTime` property because game normalization preserves private game fields and the full backup serializes normalized games.
- Authorized future structured export: requires a separate ticket and explicit field-level scope.

## Local-first service

`tracked-playing-time-service.js` is a companion contract module. It persists state and queued operations before network retry, projects clocks deterministically, resolves effective operations locally, and reconciles through injected RPC callbacks. It is deliberately not loaded by `app.html`; UI integration is a later ticket.

## Migration and rollback

Forward migration:
`supabase/migrations/20260727000000_tracked_playing_time_operations.sql`

Rollback reference:
`supabase/rollback/20260727000000_tracked_playing_time_operations_rollback.sql`

The rollback is safe only before participation history is accepted. It fails closed when such history exists, then drops only this foundation's RPCs, helpers, view, triggers, and tables. It does not alter the existing Event Pipeline or public Live Share function.
