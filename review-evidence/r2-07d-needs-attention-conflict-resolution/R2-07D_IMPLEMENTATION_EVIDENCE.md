# R2-07D Minimum Safe Needs Attention Conflict Resolution - Implementation Evidence

Status: `IMPLEMENTED - EXACT-HEAD LEVEL 3 REVIEW REQUIRED`

Risk level: `LEVEL 3`

Starting main: `91950cc32c641f309e89fd66e44f77966a8b4b7c`

Branch: `feature/r2-07d-needs-attention-conflict-resolution`

## Implementation

- `20260809201608_r207d_conflict_resolution_foundation.sql` keeps the existing
  server Preview control disabled and replaces only the dormant conflict read
  and resolution wrappers. It adds bounded stored-value constraints,
  tombstone/current-authority helpers, forced-RLS authenticated SELECT, global
  operation-identity serialization before the per-game lock, and append-only
  keep/proposal/allowlisted-patch/dismiss/delete-terminal resolution evidence.
- The server derives the canonical resolution hash from the bounded request,
  checks tombstone and current authority before replay, refuses stale expected
  versions without canonical mutation, and creates a linked latest conflict.
- `event-operation-service.js` owns a separate account-scoped conflict domain,
  durable offline resolution operations, immutable attempted payloads,
  receipt-before-compaction, safe projections/labels, linked stale-conflict
  replacement, authority purge, and account-switch response rejection.
- `app.js` reads authorized conflict summaries on Game Review and renders only
  the minimum Needs Attention comparison and four bounded actions. Existing
  event conflicts retain the local saved proposal while capturing the safe
  refreshed value for keep/proposal/dismiss selection.
- `runtime-config.js` defaults `r207dConflictResolution` to false. The managed
  Preview builder enables it only in the isolated Preview artifact and asserts
  that the repository default remains off.

## Security and concurrency results

- Direct app-role SELECT and the read RPC derive the same current personal or
  team tracker authority; anon access and conflict/resolution DML remain
  ungranted. Forced RLS remains enabled.
- Revoked team authority and copied owner identity cannot disclose conflict
  existence or values. Personal and team authority paths remain distinct.
- A repeated identical resolution returns the canonical result. A stale
  expected version appends no successful resolution and cannot overwrite newer
  game evidence. Game deletion wins and appends the terminal resolution.
- Client reads accept only allowlisted groups, keys, and bounded value types.
  Roster identifiers are rendered only as selected/not selected, and cached
  private values are purged after authority loss.
- Offline resolution intent persists before network work. An authorized
  refresh cannot discard a pending intent. Accepted evidence persists before
  compaction, and a late response from another account is ignored.

## Verification record

- R2-07D client/adversarial matrix: `32/32 PASS`, including serialized reload,
  stale no-retry, independent queue progress, future-schema non-mutation,
  bounded RPC error storage, accessibility contracts, and Live Share isolation.
- R2-07D disposable PostgreSQL migration/resolution/RLS/rollback matrix:
  `23/23 PASS`, including stale `apply_patch`, with zero disposable-container
  residue.
- Actual app Browser journey, desktop `1280x900`: exact copy and safe current /
  saved comparison visible; correction expands and accepts input; all four
  actions visible and 52px high; no horizontal overflow; no console errors.
- Actual synthetic conflict Browser journey, mobile `360x800`: one-column comparison/actions,
  readable tertiary-action contrast, all four actions 52px high, no horizontal
  overflow, and no console errors.
- Protected Vercel Preview app smoke, mobile `390x844`: correct page identity,
  meaningful app content, no horizontal overflow, labeled inputs/buttons,
  visible controls 44-52px high, Help interaction changed the rendered screen,
  and no console warnings/errors.
- Desktop screenshot: external task evidence `r207d-desktop.png`.
- Mobile screenshot: external task evidence `r207d-mobile.png`.
- R2-07A preservation: `71/71 PASS`; R2-07B client/migration/browser:
  `32/32`, `13/13`, and `12/12 PASS`; R2-07C client/migration/browser/safety:
  `30/30`, `25/25`, `7/7`, and `37/37 PASS`; tombstone concurrency: `8/8
  PASS`. All disposable Docker checks left zero residue.
- Complete canonical-plus-additive regression after the final implementation
  diff stabilized: `65/65 PASS`. The Windows run used the supported bundled
  Python override and a temporary cached test-runtime junction for Playwright
  and PGlite; the junction and all disposable Docker resources were removed.
- Node syntax, `git diff --check`, and secret/host scan: `PASS`.
- Migration SHA-256:
  `586f46373c6068a050083aff1034d7e661d5b5f046afe88d5a481d8f095894dd`.
- Rollback SHA-256:
  `57b550f5a136a610c85e89912cd8322239fd220456dbb4446be223da35e5bd2b`.
- Draft PR #68 previously passed GitHub Docker/regression, Vercel, and isolated
  Supabase Preview at `a1b54d77eea5dfe509846fe7be45d1998246ddce`.
  The final exact-head status is recorded after this evidence update is pushed.

## Boundaries and rollback

No local, manual, CLI, linked-main, Dashboard, persistent shared-environment,
or production migration was applied. No production data, credentials,
migration history, deployment, activation, release/cache marker, retention,
Live Share, or public disclosure state changed.

The rollback requires the Preview control to be disabled, refuses after any
conflict-resolution operation or resolution evidence, removes only D-owned
helpers/policies/constraints, and restores the dormant authenticated wrappers
when zero evidence exists.

The configured GitHub integration may automatically apply repository
migrations to its isolated, data-less, separately credentialed ephemeral
Supabase Preview branch tied to the draft PR. When it does, that status is:

`AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION - ACCEPTED CI VERIFICATION`

Material limitation: the exact `390x844` protected Preview smoke reached the
ordinary app entry state, not the synthetic signed-in conflict fixture. The
conflict-specific interaction evidence remains the local synthetic desktop and
mobile Browser journey above, supplemented by the exact focused contracts.

R2-07E remains conditional on R2-07D exact-head Level 3 PASS and merge. No
production mutation is authorized in this phase.
