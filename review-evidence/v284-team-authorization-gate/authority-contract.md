# Approved Authority Contract

## Role matrix

| Operation | Personal owner | Active parent/player grant | Active coach grant | Team admin only | Legacy tracker label | Service role without user subject |
| --- | --- | --- | --- | --- | --- | --- |
| Initialize clock | Allow | Allow with matching claim | Allow with matching legacy registration relationship | Deny | Deny | Deny |
| Read clock | Allow | Allow for exact player scope | Allow within grant scope | Allow for team | Deny | Deny |
| Update clock | Allow | Allow for exact player scope | Allow within grant scope | Deny | Deny | Deny |
| Create participation | Allow | Allow for exact player scope | Allow within grant scope | Deny | Deny | Deny |
| Correct participation | Allow | Allow for exact player scope | Allow within grant scope | Deny | Deny | Deny |
| Tombstone participation | Allow | Allow for exact player scope | Allow within grant scope | Deny | Deny | Deny |
| List effective participation | Allow | Allow for exact player scope | Allow within grant scope | Allow for team | Deny | Deny |

There is no standalone approved `tracker` role or capability in the Trust Spine
grant model.

## Required active-grant state

`lh_active_grants_for_user` requires:

1. the grant's `user_id` equals the authenticated subject;
2. the latest lifecycle event is exactly `accepted`;
3. `expires_at` is absent or later than the evaluation time.

Pending, revoked, expired, and renewed-away grants do not resolve as active.

## Mutation scope

`lh_mutation_grant_for_game` requires one of:

- `parent` + `player` scope + exact game team + exact roster player; or
- `coach` + exact game team + either team scope or exact roster-player scope.

It deliberately contains no `team_admin` branch.

## Read scope

`lh_export_grant_for_game`, reused by tracked-time read/list, allows:

- exact player-scoped parent;
- applicable team/player-scoped coach;
- team-scoped team admin for the exact game team.

## Initialization-only registration condition

Team-roster initialization first calls `lh_register_game_scope_impl`. In
addition to an active mutation grant, the actor must be able to register the
canonical legacy scope:

- a same-team legacy membership whose role is `admin`; or
- a matching legacy player claim.

This registration relationship is not itself tracked-time mutation authority.
Local reproduction showed that a qualifying parent or coach grant without this
relationship can mutate/read an existing clock but cannot initialize a new one.
