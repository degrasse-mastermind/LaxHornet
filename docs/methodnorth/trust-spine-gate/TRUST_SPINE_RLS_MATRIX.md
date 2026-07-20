# Trust Spine RLS Matrix

Status: implemented by the Release 1 staging migration. It has not been applied
to production or cut into the runtime.

## Active roles

Release 1 active roles:

- `parent`
- `coach`
- `team_admin`

Deferred:

- `club_admin`
- athlete roles
- ordinary broad `platform_admin`

## Core rule

Every protected read/write must resolve to an active, unexpired, unrevoked `lh_access_grants` row. Pending invitations and client-submitted labels never authorize access.

## Implemented staging table/RPC access

| Surface | Parent | Coach | Team admin | Public share viewer | Notes |
|---|---|---|---|---|---|
| Own profile | Read/update own non-authority profile fields | Same | Same | Deny | Profile role labels are not authority |
| Access invitations | Read own invitation only | Read own invitation only | Create/revoke invitations inside team | Deny | Pending invitation never grants protected data |
| Active grants | Read own active grants | Read own active grants | Read team grants inside managed team | Deny | Revoked grants hidden from active resolver but audit retained |
| Team roster | Read only claimed player | Read players in grant scope | Manage roster in team scope | Deny | Player-scoped coach cannot read full roster |
| Game evidence | Read/write own granted player evidence through allowed RPCs | Read granted scope | Roster/admin maintenance only; not coach context by default | Public projection only | Direct table writes denied after cutover |
| Event evidence | Capture new events/correction drafts in player scope | Capture/correct in coach scope if allowed | Correction only if explicitly granted, not by admin role alone | Public projection only | Direct event update/delete denied |
| Event revisions | Read own relevant revision status only | Read grant-scope revisions if authorized | Read audit-level team correction metadata | Deny | Ordinary clients cannot update/delete revisions |
| Tombstones | See user-facing deleted status for owned/granted event | Same | Team audit view | Deny | Tombstones prevent resurrection |
| Coach context | Deny by default | Create/read within coach grant | Deny unless separate coach grant | Deny | Team admin is not coach |
| Evidence state | Read public-safe summary only | Read scope summary | Read team integrity summary | Deny | Internal states not exposed in Live Share |
| Personal review progress | Own progress only | Own progress only | Own progress only | Deny | Separate from evidence state |
| Security audit events | Own operation receipts only | Own operation receipts only | Team-scoped audit summary | Deny | Full audit retained backend-side |
| Live Share | Can create/revoke own game share | Can create/revoke if allowed by team policy | Can revoke unsafe team share | Read public-safe projection | No ordinary event table wildcard |
| Export | Own/granted player export | Scope export | Team export if team policy allows | Deny | Sensitive export audit required |

## Acceptance matrix

| Scenario | Expected result | Current repo status | Release 1 test |
|---|---|---|---|
| Parent reads assigned player's ordinary game evidence | Allow | Mostly allowed by `player_claims`/RLS | Auth session with parent grant and matching player |
| Parent reads another player on same team | Deny | Client/RLS intend deny, needs real-session test | Parent grant player A, query player B |
| Parent reads coach-only context | Deny | No coach context exists | Add staged coach-context fixture, assert deny |
| Coach reads assigned team/player evidence | Allow within scope | Coach role absent | Team-scoped and player-scoped coach fixtures |
| Player-scoped coach reads full roster | Deny | Coach role absent | Player-scoped coach roster query |
| Team admin manages roster | Allow | Admin can manage roster | Team admin grant fixture |
| Team admin adds coach context without coach grant | Deny | No coach context exists | Attempt coach-context insert with team_admin only |
| Pending invite reads protected records | Deny | Current request is not direct authority, but not first-class invitation | Pending invitation fixture |
| Revoked grant reads protected records | Deny | No grant revocation primitive | Revoked grant fixture |
| User spoofs `author_role=coach` | Deny or ignore | No authoritative coach role path | Mutation payload with spoofed label |
| User edits event row directly | Deny | Currently allowed by RLS for scoped users | Direct PostgREST update expected deny after cutover |
| Authorized correction RPC appends revision | Allow | RPC not present | Correction RPC acceptance test |
| User updates/deletes prior revision | Deny | Revision table absent | Direct update/delete expected deny |
| Cross-team correction attempt | Deny | Current RLS intends deny by claim/team | Correction RPC cross-team test |
| Live Share reads public-safe projection | Allow | Currently reads `events(*)` ordinary tables | Share code RPC/view test |
| Live Share reads revision/context/note/internal status | Deny | Future fields not present; current notes risk if selected | Public projection column assertion |
| Feature flag off but direct private query attempted | Deny | No foundation flags active | Direct query private tables expected deny |
| Duplicate offline operation replayed | One accepted operation only | No op IDs | Same client operation ID twice |
| Same-field concurrent corrections | Preserve both; flag conflict | No revision/conflict model | Two base-version edits same field |
| Different-field concurrent corrections | Merge if policy allows; preserve both revisions | No revision/conflict model | Two base-version edits different fields |
| Offline correction arrives after revocation | Reject; preserve local draft | No grant revocation/op receipt model | Revoke before replay |
| Offline edit targets tombstoned event | Do not resurrect; flag/reject | No durable tombstone | Tombstone then replay edit |

## RLS implementation notes

- Use `to authenticated` with scoped predicates, never as the only condition.
- Prefer `(select auth.uid())` inside policies for performance.
- Index all grant scope columns used by policies.
- Keep security-definer helper functions private where possible.
- Public-safe views should use `security_invoker = true` when exposed.
- Do not expose foundation tables to `anon` or `authenticated` during deny-all staging.
