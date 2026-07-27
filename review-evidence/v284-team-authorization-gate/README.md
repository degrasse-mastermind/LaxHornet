# V284 Team Authorization Gate

Date: 2026-07-27
Starting SHA: `27ef1712ac30c09456eac78e1665b0d8a13f7819`
Investigation branch: `investigate/v284-team-authorization-gate`
Focused disposition branch: `fix/v284-team-authorization-fixture`

## Result

Gate status: `V284 TEAM AUTHORIZATION GATE PASSED`

Primary classification: **fixture mismatch**.

The stopped rollout used an accepted, team-scoped `team_admin` grant as the
expected tracked-time controller. That assumption was not part of the reviewed
authority model. `lh_mutation_grant_for_game` allows only:

- an active player-scoped `parent` grant for the game's exact team/player; or
- an active `coach` grant for the game's exact team and applicable team/player
  scope.

`team_admin` is intentionally present only in the read/export helper. A team
admin may read the clock and list effective participation for the team, but
cannot initialize, update, create, correct, or tombstone tracked time without a
separate qualifying parent or coach grant.

No original migration, rollback, pgTAP file, runtime authorization function,
RLS policy, table grant, release marker, cache marker, or public disclosure
contract changed.

## Production disposition

- Project: `ulbmjcvnyznvmjgpstno`.
- Migration `20260727000000` was already present exactly once.
- The seven authorization-related production function definitions matched the
  local seven-migration reset after CRLF/LF normalization.
- The corrected gate used prefix `v284-authgate-ms3gikuu-1b2c35c7`.
- An accepted player-scoped parent grant plus matching player claim initialized,
  read, updated, created, corrected, tombstoned, and listed successfully.
- Wrong account, wrong player, wrong game, cross-team, stale-revision, and
  duplicate-operation boundaries behaved as reviewed.
- A team-admin-only actor was denied initialization and update but retained
  reviewed read/list access.

## Cleanup

Mutable remainder for the corrected prefix:

- auth users: `0`
- auth sessions: `0`
- legacy games, teams, roster players, memberships, and claims: `0`
- active Live Share tokens: `0`
- active grants: `0`

Required sanitized history retained:

- team scopes: `2`
- player scopes: `3`
- game scopes: `2`
- grants: `2`, both revoked
- invitations: `1`
- grant lifecycle events: `6`
- clocks: `1`
- logical participation events: `2`
- participation operations: `4`

No real user, team, player, family, or youth record was read or changed.

## Remaining boundary

This assignment stopped after authorization passed. It did not run public
disclosure verification, deploy the frontend, activate v284, or run browser
smoke tests. The next release gate is:

`Public disclosure verification before frontend deployment`
