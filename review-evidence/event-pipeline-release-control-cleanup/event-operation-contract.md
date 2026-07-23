# Event Operation Contract

`createGameEventOperation`, `correctGameEventOperation`, and `tombstoneGameEventOperation`:

1. apply and persist the local mutation synchronously;
2. create a deterministic authoritative operation when the game is `team_roster`;
3. retain the legacy event/game row only for private-screen and recovery compatibility;
4. retry the authoritative operation idempotently;
5. retain pending, accepted, conflicted, and failed state in the account-scoped Trust Spine store.

`reconcileGameEventOperations` is required before secure token creation. Notes and private tags are not part of the Trust Spine evidence allowlist.
