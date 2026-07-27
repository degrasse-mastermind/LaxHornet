# Architecture and Clock State

## Decision

Tracked Playing Time is a separate bounded context from stat events. Clock checkpoints are mutable latest-state records; participation facts are append-only operations. Existing `events`, Event Pipeline RPCs, public Live Share, and stat calculations remain unchanged.

## Clock schema

`public.lh_game_clock_states` has one row per game and records:

- canonical personal or team-roster scope;
- quarters or halves;
- regulation and optional OT duration;
- current period and seconds remaining;
- running state plus start/pause anchors;
- client and server update timestamps;
- `complete`, `estimated`, or `needs_review` recovery state;
- optimistic revision and actor metadata.

Constraints reject invalid periods, negative or over-duration clock values, mismatched personal/team scope, and inconsistent running/paused anchors.

## Deterministic transitions

- Start/resume persists a new running anchor.
- Projection subtracts bounded wall-clock elapsed time from the persisted checkpoint.
- Pause persists the projected remaining time and clears the running anchor.
- Q1–Q4, H1–H2, and OT transitions pause and reset to their configured duration.
- Refresh recovery projects only from a known anchor. Material uncertainty freezes the clock as `needs_review`.
- Game end supplies final clock context to an explicit system-generated close operation.

## Offline boundary

The companion service writes clock and operation state to local storage before attempting RPC synchronization. Network failure therefore leaves a retryable local queue and does not block game-day tracking.
