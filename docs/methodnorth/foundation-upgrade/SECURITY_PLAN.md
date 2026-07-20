# Security Plan

## Security Goal

The foundation must protect youth-player data by enforcing role and scope at the database/API boundary. UI hiding is not sufficient.

## RLS Requirements

- Enable RLS on every new public table.
- Use `TO authenticated` plus scoped authorization predicates.
- Avoid authorization based on user-editable metadata.
- Use `(select auth.uid())` patterns in RLS predicates for performance.
- Include both `USING` and `WITH CHECK` on update policies.
- Index columns used by RLS and foreign keys.
- Avoid `SECURITY DEFINER` unless a future reviewed internal function absolutely needs it.
- If views are created later, use `security_invoker = true` where supported.

## Access Boundaries

Parent:

- May access only approved player/team contexts.
- May not see full roster unless explicitly authorized.
- May not see coach-only context.
- May not see revision author identity by default.

Coach:

- May access assigned team/player evidence and coach context.
- May add factual context where assigned.
- Does not automatically inherit team-admin roster powers.

Team Admin:

- May manage team, roster, and parent requests.
- Does not automatically become coach.
- May not publish athlete-facing guidance without future review workflow.

Club Admin:

- Future role for organization-scoped administration.
- Must be explicitly assigned.

Platform Admin:

- Reserved for support/operator functions.
- Requires explicit assignment and audit.

## Audit Requirements

Record audit events for:

- role assignment
- role revocation
- access request approval/rejection
- event correction
- coach context creation/update
- disclosure state change
- review-state override
- delete/tombstone action

## Live Share Protections

Live Share should continue using its current read-only timeline behavior and must not expose foundation records unless a future explicit review says it is safe.

Private foundation records should not be returned from Live Share RPCs/views.

## Testing Requirements

Before enabling the foundation:

- Parent cannot select or query another player's foundation records.
- Parent cannot see full roster through foundation APIs.
- Coach can see only assigned context.
- Team admin can manage roster but does not get coach-only context by default.
- Unauthenticated users cannot read foundation tables.
- Live Share cannot read coach context, revisions, review state, or private tags.
- Deleted games do not rehydrate foundation data.

## Open Security Questions

- Whether coach context should ever be parent-visible by default.
- Whether team admins who are not coaches may read coach context.
- Whether platform support access should be through direct RLS or a controlled admin-only support RPC.
- Whether future athlete visibility requires a separate consent/assent table.
