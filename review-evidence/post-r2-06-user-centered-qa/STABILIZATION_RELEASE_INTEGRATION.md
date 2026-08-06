# QA-S1 Stabilization Release Integration

Date: 2026-08-05

Risk level: Level 3

Starting SHA: `c956c025e99f97cffae7814bdcd741b1b52764b6`

Source: PR #60, branch `qa/post-r2-06-user-centered-audit`

## Integrated product fixes

1. Active-game recovery: Home detects the actual active game, identifies its
   player, period, and opponent, and offers `Resume Live Game` directly to the
   tracker instead of a misleading new-game-only action.
2. Saved-review player alignment: the just-saved review selects the player
   attached to the saved game before opening Review, preserving game ownership
   and the correct Review and Season context.

The completed audit, `41/41` disposable browser journey, and lower-severity
backlog remain in `USER_CENTERED_QA_AUDIT.md` and `QA_FINDINGS_BACKLOG.md`.

## Release identity

The fixes change runtime behavior in `app.js`. Repository release contracts
require the application marker, service-worker cache, asset query markers, and
release manifest to identify that exact runtime together. The repository marker
therefore advances from `v284` to `v285`, and the cache marker advances from
`laxhornet-v284` to `laxhornet-v285`. Production remains at `v284`.

Exact runtime files changed for the coordinated marker are:

- `version.json`, `app.js`, and `service-worker.js`
- `app.html`, `index.html`, `access-and-trust.html`, `coach-alignment.html`
- `parent-experience.html`, `player-development.html`, `privacy.html`
- `program-value.html`, `rollout-guide.html`, `terms.html`, and
  `tracking-framework.html`

The service-worker application asset inventory uses only the v285 query marker.
Pages and update contracts now derive or verify the current marker.

## Manifest and historical boundary

The manifest retains `r206ReleaseControl` byte-for-byte as it existed at the
closed R2-06 baseline `f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37`.
Its approval, mixed-evidence action classifications, cleanup attestation,
retained tombstone disposition, evidence paths and hashes, runner identity, and
disabled future authorization are historical facts and are not repurposed as
latest-runtime fields.

A separate `postR206Stabilization` section identifies v285, PR #60, the audited
baseline, the two Important fixes, and exact current runtime/control hashes.
It records no schema or backend change, no production access, and no authorized
or completed deployment.

The R2-06R checklist test now compares the protected historical R2-06 control
object and asserts its essential closeout facts. It permits append-only,
truthful post-closeout work packages instead of freezing the entire checklist.
Mutation-probe coverage confirms that removing or changing a protected R2-06
fact still fails.

## Verification

- User-centered disposable browser journey: `41/41` passed on the integrated
  fixes.
- Focused runtime, offline/service-worker, isolation, hydration/tombstone,
  sync/storage, tracked-time, Pages, manifest, historical-preservation,
  preflight, containment, syntax, secret/host, and diff-hygiene checks are the
  mandatory QA-S1 gates.
- Complete canonical-plus-additive regression: `52 passed, 0 failed`. The
  authoritative transcript is retained as
  `stabilization-full-regression-output.txt`.
- Exact-head portable and Docker CI are required before independent review.

No unrelated rollout stage is advanced. Proposed R2-07 remains unapproved and
unstarted.

Deployment status: `not authorized`

Production status: `not accessed`

Migration/backend status: `no change`

Merge recommendation: merge only after all mandatory local gates, the complete
canonical-plus-additive regression, exact-head portable and Docker CI, and an
independent exact-PR-SHA Level 3 review pass. This evidence does not authorize
merge or deployment.
