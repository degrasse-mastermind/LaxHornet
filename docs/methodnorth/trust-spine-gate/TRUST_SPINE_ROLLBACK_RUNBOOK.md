# Trust Spine Rollback Runbook

Status: proposed rollback plan for future staging/pilot only.

## Rollback principle

Rollback may disable new Trust Spine paths, but it must not delete production evidence, revisions, tombstones, grant history, or audit records merely to simplify recovery.

## Immediate rollback levers

1. Disable client routing to Trust Spine RPCs.
2. Disable new correction/tombstone submit buttons or route them back to legacy flow only if safe.
3. Disable public-safe projection cutover and return to legacy Live Share only if no private fields were introduced to ordinary tables.
4. Stop shadow writes if they are causing failures.
5. Keep foundation tables read-only for investigation.

## Application version

Rollback must name the exact app version to restore before any pilot:

- Static assets.
- `app.js`.
- `styles.css`.
- `service-worker.js`.
- `version.json`.
- `manifest.json` if touched.

No app version is changed by this package.

## Database paths disabled

Rollback should disable:

- Correction RPC entrypoint.
- Tombstone RPC entrypoint.
- Grant-management RPC entrypoint.
- Public-safe Live Share RPC if broken.
- Sensitive export audit RPC if broken.

Rollback should not:

- Drop revision rows.
- Drop tombstones.
- Delete access-grant history.
- Delete audit events.

## Queued offline operations

If rollback occurs while clients have queued operations:

- Mark queued operations as waiting locally.
- Do not replay them through legacy direct updates.
- Do not silently discard them.
- Let user export local drafts if access was revoked or server path is disabled.

## Cache invalidation

If runtime assets were part of rollback:

- Bump static version and cache name.
- Confirm `version.json` reports the rollback version.
- Verify installed/home-screen app receives the update.

## Session handling

If access policy behavior changed:

- Force profile/grant refresh.
- Consider sign-out for pilot accounts if stale JWT/app state could preserve old UI.
- Do not rely on client labels or hidden UI for rollback safety.

## Live Share/export after rollback

Before re-enabling public share/export:

- Confirm no private foundation fields are on ordinary wildcard-selected tables.
- Confirm share code still reads only intended public data.
- Confirm export output is expected for the selected export mode.

## Re-enable after rollback

Before re-enable:

- Reconcile queued operations by operation ID.
- Deduplicate accepted operations.
- Preserve conflicts.
- Verify tombstoned events are not resurrected.
- Run acceptance matrix again.
