# Participation Identity and RPC Contracts

## Tables and resolver

- `lh_participation_logical_events`: stable logical identity, player-in/player-out kind, canonical scope, current revision, and current operation pointer.
- `lh_participation_operations`: immutable operation ID, logical ID, operation type, target, revision, clock context, source/recovery metadata, actor/grant, request hash, and timestamps.
- `lh_effective_participation_operations`: security-invoker projection of each logical row's current operation, excluding tombstones.

Corrections and tombstones never rewrite accepted history. Database triggers reject update/delete attempts against both logical identity and operation history. The correction RPC advances the revision and current pointer atomically.

## Idempotency

The client supplies `operation_id`. A repeated identical request returns the previously accepted result. Reusing the same ID with a different request hash is rejected as an idempotency conflict.

## Authenticated RPCs

Clock:

- `lh_initialize_game_clock(jsonb)`
- `lh_update_game_clock(jsonb)`
- `lh_reconcile_game_clock(jsonb)`
- `lh_read_game_clock(text)`

Participation:

- `lh_create_participation_operation(jsonb)`
- `lh_correct_participation_operation(jsonb)`
- `lh_tombstone_participation_operation(jsonb)`
- `lh_list_effective_participation(text)`
- `lh_reconcile_participation_operations(jsonb)`

All wrappers use `security definer`, an empty fixed search path, private helper functions, JSON allowlists, and bounded result codes. Execution is revoked from `public` and `anon` and granted only to `authenticated`.
