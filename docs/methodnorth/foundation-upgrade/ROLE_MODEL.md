# Role Model

## Roles

| Role | Purpose | Scope | Notes |
| --- | --- | --- | --- |
| `parent` | Track and review approved player access | User, team, roster player | Existing Parent Tracker behavior maps here after explicit migration. |
| `coach` | Add factual context and review evidence where assigned | Team or roster player | A team admin is not automatically a coach. |
| `team_admin` | Manage team setup, roster, access requests, and safety operations | Team | Existing approved admin behavior maps here after explicit migration. |
| `club_admin` | Manage multiple teams inside an organization | Club/org, team set | Future role; no current automatic assignment. |
| `platform_admin` | Platform-level support and emergency administration | Platform | Reserved for explicitly assigned operator accounts. |

Athlete-facing accounts remain disabled and future-only.

## Role Assignment Principles

- A user may hold multiple roles.
- Roles are scoped. A user can be a parent for one player and a team admin for another team.
- Assignment and revocation must be auditable.
- Role changes should not silently alter existing production access.
- No role may be inferred from user-editable metadata.

## Scope Model

Recommended scope fields:

- `scope_type`: `platform`, `club`, `team`, or `player`.
- `team_id`: present for team/player scopes.
- `roster_player_id`: present for player scope.
- `assigned_by`: authenticated user who granted the role.
- `revoked_at`: null means active.
- `invitation_status`: `pending`, `accepted`, `declined`, `revoked`.

## Permission Matrix

| Capability | parent | coach | team_admin | club_admin | platform_admin |
| --- | --- | --- | --- | --- | --- |
| Track approved player games | Yes, scoped player | Optional if assigned | Only in Tracker View or if player-scoped | Optional by assignment | Optional by assignment |
| View own approved player stats | Yes | If assigned | Yes for managed team | Yes for managed club | Yes for support |
| View full roster | No | If team-scoped | Yes | Yes | Yes |
| Edit roster | No | No by default | Yes | Yes | Yes |
| Approve parent access | No | No by default | Yes | Yes | Yes |
| Add coach context | No | Yes | Only if also coach | If also coach | Support only with explicit reason |
| View coach-only context | No | Yes, scoped | If assigned | If assigned | Support only |
| View revision history | Limited/current own player only | Scoped | Scoped team | Scoped club | Platform |
| Change disclosure state | No | Suggest only | Team-scoped | Club-scoped | Platform |
| Delete team | No | No | Yes with confirmation | Yes | Yes |

## Existing User Migration

Migration must be explicit and additive:

- Existing Parent Trackers should be offered `parent` assignments based on active `player_claims`.
- Existing team admins/reviewer accounts should receive `team_admin` or `platform_admin` only through reviewed migration.
- Existing `team_members.role = admin` should not automatically grant `coach`.
- Existing unauthenticated or unapproved users should receive no new role.
- Current access remains readable until a planned migration switches authorization checks.

## Assignment, Revocation, and Invitation

Assignment:

1. Admin selects user and scope.
2. System writes role assignment with `assigned_by`, timestamps, scope, and feature version.
3. User receives only the access implied by that scoped role.

Revocation:

1. Admin revokes role by setting `revoked_at`.
2. Historical evidence authored by that user remains attributable.
3. User no longer sees private context or roster surfaces for that scope.

Invitation:

1. Invite is created as pending.
2. User accepts through authenticated account.
3. Assignment becomes active only after acceptance and approval where required.

Audit:

- Every assignment, revocation, role escalation, and disclosure change should be recorded.
- Audit records should not be editable through ordinary client UI.
