# R2-06I synthetic runner browser remediation

Status: `READY FOR INDEPENDENT REVIEW`

Risk level: `LEVEL 3`

Branch: `fix/r2-06i-browser-readiness-failure-reporting`

Starting point:
`bf72d740960bb2947aecb8724de8c27aa7d2181b`

## Incident basis and production boundary

The first separately authorized R2-06 runner attempt passed the repository,
artifact, preflight, and credential gates; created the two bounded synthetic
Auth users and profiles; established the owner session; and then failed while
starting the challenger's isolated browser session. Cleanup-only mode removed
all mutable/Auth residue. The authorized incident closeout recorded zero
games, events, Live Share tokens, operations, and tombstones after cleanup.

The strongest supported cause is the sanitized native classification
`ERR_MODULE_NOT_FOUND` for `playwright`. This is an inference from the
classified runtime failure and the prior absence of a repository-provisioned
Playwright module for direct Windows execution. The production keys are not a
supported cause: the same run passed credential gates and used the accepted
credentials to create both bounded Auth users and profiles and establish the
owner session before browser startup failed.

The consumed incident authorization is not reusable. This remediation did not
open, modify, or replace its private authorization or failed-run evidence.
No production credentials were used, no production endpoint was contacted,
and no production mutation or cleanup was performed.

## Browser readiness and dependency provisioning

`tools/r206_browser_runtime.mjs` resolves Playwright only from the reviewed
runner-local package at `tools/r206-browser-runtime`. It verifies and imports
the module, requires the Chromium browser type, checks the executable, launches
and closes one headless persistent context with a newly created temporary
profile, and removes that profile. It does not navigate, reuse a real browser
profile, accept production credentials, or perform network mutation.

Pinned identities:

- Playwright `1.61.1`;
- Chromium revision `1228`;
- Chrome for Testing `149.0.7827.55`.

Windows provisioning is separate from runner execution:

```powershell
npm ci --ignore-scripts --prefix tools\r206-browser-runtime
node tools\r206-browser-runtime\node_modules\playwright\cli.js install chromium
node tools\run_r206_synthetic_verification.mjs --check-browser-runtime
```

The production command never runs an installer. Browser readiness executes
before production configuration reads runtime credentials, before the core
sets `mutationStarted`, and before any Auth or database mutation. Missing
module, executable, launch, or readiness-profile cleanup fails closed.

## Classified failure envelope

The CLI now emits one sanitized JSON object. Known `R206StopError` codes remain
classified instead of being replaced by `UNEXPECTED_EXECUTION_FAILURE`.
Unexpected native failures keep that generic public classification while
retaining only a safe native exception name and code.

The envelope includes:

- `ok`, `code`, and sanitized `message`;
- `currentOperation`, `phase`, and `lastSuccessfullyCompletedPhase`;
- `completedActionCount`;
- `mutationStarted`, `cleanupOnlyStarted`, and `cleanupCompleted`;
- integer-only `residueCounts`;
- an opaque `privateCheckpointReference`;
- `retainedTombstone` and `manualCleanupRequired`;
- `authorizationConsumed` and `authorizationState`;
- safe `nativeError.name` and `nativeError.code`;
- immutable `releaseCloseoutApproved: false`.

It excludes exact UUIDs, synthetic emails and IDs, browser paths, credentials,
headers, tokens, private row content, and raw stack traces.

New runner classifications include:

- `BROWSER_RUNTIME_UNAVAILABLE`;
- `BROWSER_RUNTIME_VERSION_MISMATCH`;
- `BROWSER_EXECUTABLE_MISSING`;
- `BROWSER_LAUNCH_FAILED`;
- `BROWSER_READINESS_CLEANUP_FAILED`;
- `BROWSER_SESSION_LAUNCH_FAILED`;
- `BROWSER_SESSION_FAILURE`;
- `NETWORK_REQUEST_FAILED`;
- `JSON_PARSE_FAILURE`;
- `PRODUCTION_AUTHORIZATION_ALREADY_CONSUMED`.

## Authorization consumption

Future production execution creates
`R2-06_AUTHORIZATION_CONSUMPTION.json` in the reviewed private evidence store
after all preflight gates pass and before the first mutation. The record is
separate from and never overwrites the authorization artifact. It records a
hash of that artifact, the reviewed runner SHA, sanitized
`executionStartedAt`, whether mutation began, terminal outcome, cleanup
outcome, and consumed state.

The first write uses create-new semantics. Later state transitions atomically
update only the consumption record. Any existing consumption record blocks
reuse even when the original authorization JSON still says `unused`.
Pre-readiness failures are reported as `failed_unused`; failures after the
consumption checkpoint are `failed_consumed`.

## Cleanup correction

Failure cleanup no longer references the undefined `deletionId`. The core and
both adapters use `ledger.deletions.deletion_a` and the existing
`ledger.game.deviceId`. They do not accept a caller-supplied cleanup deletion
identity, generate a replacement identity, enumerate unrelated data, or add a
broad cleanup fallback.

A focused regression enters cleanup after game creation but before an accepted
durable deletion. It proves there is no `ReferenceError`, the reviewed RPC
receives the ledger-owned deletion and device identities, cleanup remains
bounded, and exactly one tombstone is retained when the cleanup delete is
accepted.

## Verification

The reviewed checks cover missing module, missing executable, launch failure,
isolated-profile creation/removal, no credential or Auth path on readiness
failure, classified/native error preservation, complete sanitized envelopes,
authorization consumption/reuse, failed-unused versus failed-consumed state,
post-user and post-game cleanup, exact ledger ownership, CLI JSON behavior,
false release closeout, and disposable behavior.

The final implementation closeout records the exact focused, disposable,
canonical-plus-additive, and CI results. Disposable output remains explicitly
not production evidence.

Local results on the final shared runtime diff:

- credential-free pinned Chromium readiness: passed;
- browser/failure-envelope suite: `11/11`;
- runner/cleanup/authorization suite: `29/29`;
- disposable R2-06/R2-06A integration: passed, not production evidence;
- Linux Docker browser/runner/disposable surfaces: passed;
- manifest reconciliation: `8/8`;
- phase-aware preflight: `22/22`;
- phase-aware containment: `33/33`;
- Pages deployment contracts: `21/21`;
- tombstone migration/rollback: `13/13`;
- PostgreSQL concurrency: `8/8`;
- secret scan, release-manifest validation, JavaScript syntax, and diff
  hygiene: passed;
- complete canonical-plus-additive regression: `46/46`.

The first complete-suite attempt used the disabled Windows Store `python`
alias, so its local Product Alignment HTTP server did not start. The isolated
failed browser check passed `15/15` with the bundled Python runtime, and the
complete suite then passed `46/46` with that explicit runtime. This was an
environment correction; no product or runner code changed for it.

Exact-head draft-PR CI remains pending.

## Remaining gate

Synthetic verification authorization, synthetic verification completion,
cleanup completion, and release closeout remain false. A future production run
requires a new authorization and fresh named read-only preflight bound to the
independently reviewed exact runner SHA. Independent exact-PR-SHA Level 3
review is required before merge.
