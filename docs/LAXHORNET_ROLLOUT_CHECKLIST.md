# LaxHornet Development & Rollout Checklist

**Owner:** David / MethodNorth  
**Product:** LaxHornet  
**Current production release:** v284  
**Purpose:** Keep product, engineering, review, and release work in the correct order without mixing unrelated scopes.

## Authority and maintenance

This executive roadmap summary is reviewed and maintained through closeout only when work has an approved roadmap or engineering ticket and materially changes rollout status, advances an existing checklist item, or adds a newly approved roadmap item. Routine work with no roadmap impact does not require checklist review or an update.

Every status change must be supported by durable repository evidence. Local implementation alone does not equal completion, and production items require separate release evidence. Product roadmap additions or status changes require David's approval. Historical or superseded material must remain in that state unless explicitly reapproved and must not be revived automatically.

This checklist does not replace `TICKETS.md`, `REPO_CURRENT_STATE.md`, Git history, pull requests, tests, implementation evidence, or the canonical decision register.

## Status Key

- [x] Complete
- [ ] Not started
- [~] In progress
- [!] Blocked or owner decision required

# 1. Completed Production Foundation

- [x] v284 Tracked Playing Time foundation implemented and released.
- [x] Tracked-time authority failure classified as a synthetic fixture mismatch.
- [x] Team Admin retained as read/list-only for tracked time; mutation authority was not broadened.
- [x] Public event semantic boundary remediated and production-applied.
- [x] `team_members` RLS recursion remediated and production-applied.
- [x] Public Live Share restricted to the approved event vocabulary.
- [x] Anonymous access to private tracked-time data denied.
- [x] GitHub Pages moved to the explicit allowlisted runtime artifact.
- [x] Production artifact limited to the approved 47 runtime files.
- [x] Repository-backed Codex task lifecycle documented.
- [x] Lean Development Workflow v2 adopted.
- [x] Read-only GitHub Actions regression workflow established.
- [x] Docker CI builder/test/runtime stages repaired and verified.
- [x] v284 production rollout and closeout evidence recorded.
- [x] No pending v284 production migration remains.

# 2. Completed Engineering Work

## LH-DEV-006 — Versioned Local-Storage Safety Foundation

**Status:** [x] Complete  
**Codex task:** `LH-DEV-006 | Version Local Storage Safely`  
**Branch:** `feature/lh-dev-006-versioned-local-storage`  
**Pull request:** #36  
**Implementation head:** `4a1cc4794702442151cc27e8353e5d11060376c5`  
**Merge SHA:** `255457b3cb51b07b5526c8270bf58d773cb70509`

### Implementation

- [x] Repository and current `main` baseline confirmed before work.
- [x] Ticket scope, exclusions, and implementation plan approved.
- [x] Storage-safety core implemented.
- [x] Existing primary keys and payload shapes preserved.
- [x] Canonical local schema version added.
- [x] Legacy read migration added and idempotent.
- [x] Account-scoped metadata sidecars added.
- [x] Staged-write verification added.
- [x] Bounded backup behavior added.
- [x] Bounded quarantine behavior added.
- [x] Future-version domains preserved and write-blocked.
- [x] Missing primaries prevented from restoring stale backups.
- [x] Intentional deletion removes primary and sidecars.
- [x] Storage-health notifications deduplicated.
- [x] Import validation hardened without changing export shapes.
- [x] Tracked-time and event-operation payloads preserved unchanged.
- [x] Public Live Share, recap, and CSV remain free of storage metadata.

### Verification and closeout

- [x] Focused storage-safety suite passed: `28/28`.
- [x] Existing event-operation, tracked-playing-time, and game-scope tests passed.
- [x] Public event semantic-boundary, Pages allowlist/deployment, import/export, and disclosure checks passed.
- [x] Complete canonical regression passed: `36/36`.
- [x] Product Alignment storage/static contracts passed: `33/33`.
- [x] Local browser startup, malformed-domain recovery, saved-game backup recovery, future-version preservation, active-game recovery, and offline event persistence passed.
- [x] Browser smoke passed: `5/5`.
- [x] Desktop and mobile console checks showed no unexpected errors.
- [x] `git diff --check` passed.
- [x] `TICKETS.md` and `REPO_CURRENT_STATE.md` updated with durable facts.
- [x] Required GitHub Actions regression passed before merge.
- [x] Production Pages deployment completed successfully.
- [x] Production smoke verified saved games remained available, active-game persistence survived refresh, and no repeated storage warnings appeared.
- [x] No SQL, migration, Supabase, authorization, disclosure, release-marker, or public-data behavior changed.

### Known limitations preserved

- `localStorage` cannot provide a true transaction across keys; failed writes restore the prior primary when possible and retain bounded staging/recovery data for diagnosis.
- A future-schema domain is preserved and write-blocked for the current session; the user must open it with a compatible newer client.

LH-DEV-006 completed under the approved accelerated closeout. Obsolete ceremony was superseded by Lean Development Workflow v2; implementation, exact-commit review, CI, merge, deployment, and production smoke provide the durable evidence.

## R2-01 — Current Local/Cloud Sync Inventory

**Status:** [x] Complete  
**Pull request:** #41  
**Reviewed final head:** `5985ce69c78d982ac03d0d7f887195b65e36a224`

- [x] Current local persistence, cloud reads/writes, identifiers, ordering, retries, deletion, authorization, conflict behavior, sync UI, and actual test coverage inventoried.
- [x] Same-ID cloud-wins overwrite, lossy mapping, legacy last-write-wins, missing durable clock retry, stale resurrection, and authorization ambiguity documented with current file/function evidence.
- [x] Trust Spine guarantees distinguished from weaker legacy game and tracked-clock paths.
- [x] Unknown production and multi-device behavior left explicitly unresolved rather than guessed.
- [x] R2-02 through R2-09 proposed as small ordered follow-up tickets.
- [x] Complete regression `36/36`, phase-aware containment `32/32`, and Trust Spine SQL acceptance/rollback `33` passed.
- [x] No runtime, SQL, migration, workflow, Supabase, deployment, or production state changed.

## R2-02 — Sync Characterization Tests

**Status:** [x] Complete  
**Pull request:** #42  
**Reviewed head:** `76d8a4fe3b1b8d2d14a732dadcaeae8d1b127d7e`

- [x] Deterministic synthetic characterization suite added.
- [x] All `17` R2-01 risks covered and remained confirmed.
- [x] Same-ID overwrite, lossy mapping, out-of-order response, stale resurrection, failed clock write, authorization ambiguity, partial success, refresh during pending work, namespace transition, and Trust Spine guarantees covered.
- [x] Characterization suite passed `17/17`.
- [x] Local storage `28/28`, tracked time `16/16`, `11/11`, `44/44`, Trust Spine `18/18` plus embedded SQL `33/33`, and Cancel Game `33/33` passed.
- [x] Portable regression and Docker test suite passed.
- [x] No runtime, SQL, migration, Supabase, deployment, release, or production state changed.

## R2-03 — Lossless Cloud Game Hydration

**Status:** [x] Complete  
**Pull request:** #43  
**Reviewed head:** `e8d40f7552ea146f1bea3c6b1b10096d05be3080`  
**Merge SHA:** `5f442b9f009eda644bbdb9892a6e05092e2cb608`

- [x] Same-ID game hydration changed from wholesale cloud replacement to explicit field ownership and preserve-if-omitted merge.
- [x] Scores, event score context, tracked-time, pending/recovery state, active-game evidence, and unknown local metadata preserved.
- [x] Same-ID events merge by stable ID without duplication.
- [x] Cloud-owned fields remain explicit.
- [x] Supported conflict-sensitive fields update only under the bounded `saved_at` freshness rule.
- [x] Monotonic request-generation and account guard prevents stale or prior-account responses from applying.
- [x] Corrected R2-02 assertions converted to desired R2-03 behavior contracts; unresolved risks remain characterized.
- [x] Sync characterization `28/28`, storage `28/28`, tracked-time `16/16`, `11/11`, `44/44`, `7/7`, Cancel Game `33/33`, and complete regression `37/37` passed.
- [x] Portable regression and Docker CI passed on the exact reviewed head.
- [x] No SQL, migration, RLS, RPC, queue, tombstone, namespace migration, sync/conflict UI, release, deployment, or production state changed.

# 3. Active Work Package

## R2-04 — Durable Game and Clock Operation States

**Status:** [x] Complete
**Risk level:** Level 3 — Critical synchronization and persistence behavior  
**Codex task:** `Implement R2-04 — Add Durable Game and Clock Operation States`  
**Branch:** `feature/r2-04-durable-game-clock-operations`  
**Starting point:** current `main`, including R2-03 merge `5f442b9f009eda644bbdb9892a6e05092e2cb608`
**Pull request:** #45
**Merge SHA:** `229face02c14dec3ee134c860d4516ebcfaa1ce3`

### Approved scope

- [x] Add durable local operation state for legacy game writes.
- [x] Add durable local operation state for tracked-clock writes.
- [x] Assign permanent client operation IDs before cloud attempts.
- [x] Persist explicit lifecycle states: pending, syncing, accepted, retryable, rejected, and conflicted.
- [x] Recover pending and stale-syncing work after refresh or reconnect.
- [x] Add receipt-backed acceptance and prevent older responses from falsely acknowledging newer local changes.
- [x] Add bounded retry metadata and prevent retry storms.
- [x] Preserve account isolation and keep signed-out namespace migration out of scope.
- [x] Keep queue metadata private and excluded from Live Share, recap, CSV, and public payloads.
- [x] Preserve existing Trust Spine replay, conflict, and tombstone behavior unchanged.

### Explicitly unchanged

- [x] No SQL or migration work authorized.
- [x] No RLS, grant, RPC-signature, or authorization-policy changes authorized.
- [x] No durable tombstone or game-field version implementation authorized.
- [x] No sync-status or conflict UI authorized.
- [x] No signed-out-to-account namespace migration authorized.
- [x] No deployment, release marker, Supabase, or production change authorized.

### Current gate

R2-04 implementation, focused tests, complete regression, and final-head CI
completed, and PR #45 merged as
`229face02c14dec3ee134c860d4516ebcfaa1ce3`. The GitHub review record preserves
an earlier correction-required exact-SHA review and a later automated final-SHA
review submitted after merge; it does not show the requested fresh owner
exact-SHA disposition before merge. That historical review-record gap is not
silently rewritten here. Local-first game-day capture remains fast and does not
wait on cloud processing. The overall R2 gate remains open.

## R2-05 — Sync Error Classification

**Status:** [~] In progress
**Risk level:** Level 3 — Critical synchronization, retry, and authorization behavior
**Codex task:** `Implement R2-05 — Separate Authorization Failures from Retryable Network Failures`
**Task ID:** `019fb2fc-fa08-7a53-b927-2a3e6967f319`
**Branch:** `feature/r2-05-sync-error-classification`
**Starting point:** R2-04 merge `229face02c14dec3ee134c860d4516ebcfaa1ce3`
**Draft pull request:** #46
**Implementation commit:** `0a12565b1e4723986c26c36964540b049b51390e`

### Implemented boundary

- [x] One deterministic classifier covers durable legacy-game and tracked-clock operations.
- [x] Offline, fetch, timeout, HTTP 408/429/5xx, and temporary service failures become `retryable`.
- [x] Missing/expired/revoked sessions and HTTP 401 become retained `authentication_required` rejections.
- [x] HTTP 403, RLS/`42501`, `unauthorized`, `unauthorized_*`, membership, role, and scope failures become retained `authorization_denied` rejections.
- [x] Malformed/unsupported input and non-capability HTTP 400/422 become retained `validation_rejected` rejections.
- [x] Missing/stale RPCs, `PGRST202`, schema-cache mismatch, and undeployed backend capability become retained `capability_unavailable` rejections.
- [x] HTTP 409, stale revision, and explicit server conflicts remain `conflicted`.
- [x] Unknown permanent failures fail closed as `unclassified_rejection`.
- [x] Rejected/conflicted work retains its account scope, operation identity, payload revision, base revision, and bounded sanitized evidence without ordinary retry timing.
- [x] Offline and missing-session handling create no network attempt or retry-counter storm.
- [x] Explicit sign-in/manual sync recovers only the signed-in account's authentication-required work.
- [x] Classification metadata remains private and excluded from Live Share, recap, CSV, analytics, normal exports, and private game backup.
- [x] Existing Trust Spine authorization, replay, conflict, state, tombstone, and RPC semantics remain unchanged.

### Verification and current gate

- [x] Sync error classification passed `22/22`.
- [x] Durable game/clock operations passed `29/29`, including account-isolated authorization rejection and stale-clock integration journeys.
- [x] Sync characterization passed `29/29`; only the broad authorization/network ambiguity became desired R2-05 behavior.
- [x] Local-storage safety passed `28/28`; tracked-time service passed `16/16`; event-operation and account-scope contracts passed.
- [x] Secure-disclosure activation passed `20/20`.
- [x] Signed-in secure-disclosure browser passed `73/73` with no hosted Supabase request or browser/page error.
- [x] Complete canonical-plus-additive regression passed `39/39`.
- [x] No SQL, migration, RLS, grant, RPC signature, authorization-policy, release-marker, deployment, Supabase, or production state changed.
- [ ] Final draft-PR CI must pass.
- [ ] Exact final PR head requires independent Level 3 review before merge.

Visible sync states, a sanitized user journal, tombstones, signed-out namespace
migration, server-side legacy-game deduplication, field-level conflicts, and
the overall R2 gate remain incomplete.

## R2-06 — Durable Legacy-Game Tombstones

**Status:** [!] Merged; superseded by R2-06A; manifest reconciled; synthetic verification required
**Risk level:** Level 3 — Critical deletion, synchronization, persistence, database, and authorization behavior
**Codex task:** `Implement R2-06 — Add Durable Tombstones and Prevent Stale-Device Resurrection`
**Task ID:** `019fb341-0d54-7b82-8a14-e5bb6f8d811e`
**Branch:** `feature/r2-06-durable-game-tombstones`
**Starting point:** R2-05 merge `44f0510d3bde18f459e78f570efd27b72dc2a989`
**Draft pull request:** #47
**Implementation commit:** `de4de33e46f23dac3f9f6c52b02946ac8236fa62`

### Implemented boundary

- [x] Dedicated private `legacy_game_tombstones` rows survive physical game deletion and permanently reserve the game ID.
- [x] `legacy_game_delete` uses one permanent deletion/operation ID across retry, refresh, reconnect, and repeated processing.
- [x] Deletion intent is stored before local removal; persistence failure does not pretend success.
- [x] Proven local-only games avoid server work; ambiguous cloud visibility creates durable deletion protection.
- [x] Older queued writes become retained `superseded` evidence, and older in-flight acknowledgments cannot clear a newer tombstone.
- [x] The guarded server write path and trigger deterministically reject a write for a tombstoned game ID.
- [x] Durable server deletion is account-bound, authorization-checked, transactional, idempotent for the same deletion ID, and conflicting for a different ID or newer game timestamp.
- [x] Hydration obtains explicit authorized tombstones before upload and rechecks them before merge with account/generation guards.
- [x] Missing or RLS-invisible rows are never interpreted as deletion evidence.
- [x] Tombstone, queue, receipt, revision, and error metadata remains private and outside disclosures and backups.
- [x] Trust Spine event operations and tombstones remain separate and unchanged.
- [x] Migration, rollback refusal after retained evidence, synthetic pgTAP, local behavioral validation, and CI wiring are included without applying any migration.

### Verification and current gate

- [x] Focused tombstone contracts passed `29/29`, including delete-receipt identity, two-device, and both response-order journeys.
- [x] Isolated migration/rollback behavior passed `11/11`.
- [x] Durable operations passed `29/29`; R2-05 classification passed `22/22`; sync characterization passed `30/30`.
- [x] Local-storage safety passed `28/28`; cancel/delete coverage passed `33/33`; delete permissions passed `17/17`.
- [x] Event Pipeline and Trust Spine focused contracts passed.
- [x] Final canonical-plus-additive regression passed `41/41` on the stabilized runtime and migration diff.
- [x] Final draft-PR Docker, portable regression, Supabase Preview, and Vercel checks passed.
- [x] Exact final PR head received independent Level 3 review before the
  repository moved to R2-06A remediation.
- [!] Production now records this migration applied, but authority/provenance
  and release evidence are not reconciled. Do not treat the observed ledger as
  release approval.

R2-06A supersedes the two P1 implementation defects. Field-level game
conflicts, server-side deduplication of non-delete writes, signed-out namespace
migration, cross-key transactionality, visible sync states, a sanitized
journal, production authority/provenance reconciliation, and the overall R2
gate remain incomplete.

## R2-06A — Tombstone Concurrency and Delete-Conflict Recovery

**Status:** [!] Merged; manifest reconciled; synthetic verification required
**Risk level:** Level 3 — Critical deletion, synchronization, concurrency, persistence, database, and recovery behavior
**Codex task:** `Implement R2-06A — Remediate Tombstone Concurrency and Delete-Conflict Recovery`
**Branch:** `feature/r2-06a-tombstone-concurrency-recovery`
**Starting point:** R2-06 merge `18f5157de159fa7a27b3cefb4c90f5148c3b230d`
**Draft pull request:** [#48](https://github.com/degrasse-mastermind/LaxHornet/pull/48)
**Locally verified implementation head:** `4ba897370cc5b60c3cba0903dc2283e336778775`

### Remediation record

- [x] At implementation time, preserve the production application-only rollback
  at `44f0510d3bde18f459e78f570efd27b72dc2a989`; do not treat repository
  remediation as production activation. The resumed preflight later observed
  that automatic Pages deployment had superseded this runtime.
- [x] Give guarded legacy-game writes and durable deletes one deterministic,
  transaction-scoped per-game advisory lock before tombstone/game reads or
  mutation.
- [x] Retain the tombstone trigger as defense in depth for direct or legacy
  writes after deletion.
- [x] Prove both same-game lock acquisition orders with isolated concurrent
  PostgreSQL transactions and prove unrelated game IDs remain independent.
- [x] Persist a private, versioned, account-scoped game/event recovery snapshot
  before hiding a pending deletion.
- [x] Keep pending/retryable deletion hidden and recoverable without creating
  whole-game event-delete markers.
- [x] Restore the game, retained events, and prior local relationships after
  classified rejection or conflict; retain the operation evidence without
  automatic conflict retry.
- [x] Preserve individually deleted events and Trust Spine event tombstones as
  separate behavior.
- [x] Finalize accepted cleanup only after the durable tombstone receipt is
  persisted.
- [x] Add the separate R2-06A remediation migration and reverse-order,
  pre-activation-only rollback; leave the merged R2-06 migration bytes
  unchanged.
- [x] Register R2-06 and R2-06A assets, exact ordering, rollback limits, and
  migration-before-runtime dependency in release controls.
- [x] Convert both blocked P1 findings into desired sync-characterization
  contracts while retaining the other unresolved R2 evidence.
- [x] Pass the complete local canonical-plus-additive regression (`42/42`) on
  the committed implementation head.
- [x] Confirm portable regression (`30558552058`), Docker
  (`30558553453`), Supabase Preview, Vercel Preview, and embedded
  release-containment checks pass on PR #48.
- [x] Obtain a fresh independent Level 3 review bound to exact final PR head
  `631f48ed73b326b2b4eed8ac29623d79136fce8f`.
- [x] Confirm squash merge `2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`
  has the identical reviewed tree.
- [ ] Keep R2-06 production activation incomplete until named read-only
  production verification, recovery readiness, authority/provenance
  reconciliation, and separately authorized smoke/cleanup.

Read-only resumed preflight found both R2-06 migrations recorded in production,
zero tombstone rows, and the expected guarded catalog/security boundary.
Pages run `30559099199` auto-deployed exact merge `2fcc446d...`, superseding the
documented rollback runtime. R2-06B now reconciles that runtime and both
migrations in the manifest without recording tracked authorization or
retroactive approval. The canonical production preflight accepts the
runtime/database state and continues to fail closed at synthetic-verification
closeout. These external changes were not performed or authorized by the
resumed preflight or R2-06B tasks. The overall R2 gate remains open; do not
infer activation approval from the observed state.

### R2-06/R2-06A production-state reconciliation

- [x] Classify the incident as
  `Unauthorized release-control deviation with apparently aligned reviewed state`.
- [x] Confirm Pages run `30559099199` was an automatic `push` run on `main`,
  triggered by `degrasse-mastermind`, with no environment reviewer or
  wait-timer approval rule.
- [x] Confirm the workflow behaved as configured and identify the
  merge-to-production control gap as a release-governance defect.
- [x] Prove the reviewed PR head, merge tree, workflow manifest, 47 served
  files, service worker, and runtime marker identify exact source
  `2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`.
- [x] Confirm all tracked non-allowlisted files and explicit internal probes
  are absent from the public artifact.
- [x] Confirm production migration history contains both expected R2-06
  entries and no unexpected entry.
- [x] Record migration application timestamp, actor, route, and
  together-versus-separate attribution as unresolved because the ledger has
  no such fields and no repository production-migration workflow exists.
- [x] Compare the live table, constraints, indexes, RLS, policy, trigger,
  function bodies, security/search-path settings, and grants with a disposable
  PostgreSQL 17 database built from the reviewed migrations.
- [x] Preserve the aligned current state without treating it as retroactively
  authorized and without executing either rollback.
- [x] Leave the behavior-affecting release manifest unchanged and require a
  separate reviewed manifest-control remediation.
- [x] Implement R2-06B manifest reconciliation in a separate Level 3 feature
  branch: record the verified runtime, both applied migrations, exact reviewed
  identities, catalog verification, and unresolved incident provenance.
- [x] Preserve distinct false states for tracked production authorization,
  synthetic authorization/completion, cleanup completion, and release
  closeout approval.
- [x] Characterize missing migration, old runtime, wrong order, hash drift,
  evidence-free completion, and a test-fixture closeout-ready state.
- [x] Pass focused manifest/preflight/containment/Pages/migration/concurrency
  controls and the final complete local regression (`43/43`).
- [ ] Confirm draft-PR CI passes on the exact final PR head.
- [ ] Obtain exact-PR-SHA independent Level 3 review of R2-06B before merge.
- [ ] Obtain explicit production-data/Auth authorization for the bounded
  one-owner, one-game synthetic plan.
- [ ] Execute guarded-write, stale-delete, recovery, durable-delete, replay,
  different-ID, stale-write, hydration, authorization, disclosure, cleanup,
  and retained-tombstone checks.
- [ ] Mark R2-06 production-verified only after all remaining release-control
  and synthetic verification gates are satisfied.

### R2-06C final preflight readiness

- [x] Confirm merged `origin/main` and local HEAD are
  `77f3cf4b0c86c7ce1cc44a42fafa9f3b111e9f3b`.
- [x] Re-run focused manifest, preflight, containment, Pages, tombstone,
  migration/rollback, and PostgreSQL concurrency checks.
- [x] Reconfirm Pages run `30559099199`, all 47 allowlisted production files,
  548 excluded tracked paths, and 10 explicit internal probes at runtime
  `2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`.
- [x] Reconfirm both R2-06 migrations exactly once and in order with no
  subsequent or pending migration.
- [x] Reconfirm the bounded table/constraint/index/RLS/policy/grant/function/
  trigger/shared-lock catalog and zero tombstones.
- [x] Confirm zero aggregate `r206-smoke-*` Auth/session/profile/game/event/
  tombstone/Live-Share-token residue without enumerating private rows.
- [x] Confirm the canonical production preflight accepts runtime/database/
  catalog state and fails only on missing synthetic authorization, behavior,
  and cleanup evidence.
- [x] Correct the authorization plan to exactly two disposable accounts, one
  game, zero events/tokens, one permanent tombstone, explicit credential and
  cleanup controls, and no invented injected-client browser flow.
- [x] Keep exact synthetic identifiers out of the public repository; require
  one authorization-named private retained-identifier record and sanitized,
  hash-bound repository evidence.
- [x] Pass the complete canonical-plus-additive local regression (`43/43`).
  A later documentation-only public-evidence privacy clarification did not
  affect shared behavior and did not require a complete-suite rerun.
- [ ] Obtain explicit production Auth/data authorization for the exact R2-06C
  matrix.
- [ ] Execute the separately authorized synthetic verification and cleanup.
- [ ] Obtain separate reviewed release-closeout approval.

Evidence:
`review-evidence/r2-06-durable-game-tombstones-release/PRODUCTION_STATE_RECONCILIATION.md`.

Fresh R2-06C evidence:
`review-evidence/r2-06-durable-game-tombstones-release/FINAL_PRODUCTION_PREFLIGHT_READINESS.md`.

Authorization-ready plan:
`review-evidence/r2-06-durable-game-tombstones-release/SYNTHETIC_VERIFICATION_AUTHORIZATION_PLAN.md`.

### R2-06E reviewed synthetic verification runner

- [x] Implement a dry-run that lists the exact 21-action matrix with zero
  credentials and zero network mutations.
- [x] Keep production disabled by default and require a clean exact SHA,
  explicit production flag, separate private authorization artifact, fresh
  named read-only preflight artifact, and runtime-only credentials.
- [x] Allow production mutation only through bounded Auth Admin operations and
  `laxhornet_sync_game` / `laxhornet_delete_game_durable`; expose no arbitrary
  SQL or generic table writer.
- [x] Enforce two-user, three-session, two-profile, one-game, one-update,
  zero-event, zero-token, one-delete, one-tombstone, and one-private-ledger
  limits.
- [x] Implement durable private checkpoints, cleanup-only failure handling,
  ledger-owned cleanup, authority revocation probes, two isolated browser
  profiles, and sanitized hash-bound public evidence.
- [x] Add adversarial unit coverage and a disposable PGlite execution of the
  reviewed R2-06/R2-06A behavior matrix.
- [x] Mark all disposable output explicitly as not production evidence.
- [x] Pass the final canonical-plus-additive local regression (`45/45`).
- [ ] Confirm draft-PR CI passes on the exact final R2-06E head.
- [ ] Obtain independent exact-PR-SHA Level 3 review before merge.
- [ ] Obtain separate explicit production Auth/data/browser authorization for
  the reviewed exact runner SHA.
- [ ] Execute the production synthetic verification and cleanup.
- [ ] Obtain separate reviewed release-closeout approval.

Implementation evidence:
`review-evidence/r2-06-durable-game-tombstones-release/SYNTHETIC_RUNNER_IMPLEMENTATION.md`.

### R2-06I browser-runtime remediation

- [x] Pin Playwright `1.61.1`, Chromium revision `1228`, and Chrome for Testing
  `149.0.7827.55` in runner-local reviewed package metadata.
- [x] Add a credential-free readiness command that resolves/imports the module,
  verifies the executable, launches and closes one isolated temporary profile,
  and removes its artifacts.
- [x] Run readiness before credential acceptance, `mutationStarted`, Auth user
  creation, or any production mutation; keep production disabled by default.
- [x] Preserve classified and safe native failures through adapter, core, and
  CLI with phase/operation, completed-action, mutation, cleanup, residue,
  checkpoint, tombstone/manual-cleanup, and authorization state.
- [x] Create a separate private authorization-consumption record before first
  mutation, never overwrite authorization, and refuse reuse after any recorded
  execution start.
- [x] Fix failure cleanup to use only ledger-owned deletion/device identities
  and cover the post-game, pre-durable-delete path without `ReferenceError`.
- [x] Add focused browser, envelope, redaction, consumption, cleanup, CLI, CI,
  Docker, and disposable coverage without executing production mode.
- [x] Pass the complete canonical-plus-additive local regression (`46/46`).
- [ ] Confirm draft-PR CI passes on the exact final R2-06I head.
- [ ] Obtain independent exact-PR-SHA Level 3 review before merge.
- [ ] Obtain a new explicit production authorization and fresh named read-only
  preflight for any future exact reviewed runner SHA.
- [ ] Execute production synthetic verification and cleanup.
- [ ] Obtain separate reviewed release-closeout approval.

Remediation evidence:
`review-evidence/r2-06-durable-game-tombstones-release/SYNTHETIC_RUNNER_BROWSER_REMEDIATION.md`.

### R2-06K run-scoped private-directory remediation

- [x] Treat the fixed approved private path as an authority root and reject it
  as an execution directory.
- [x] Accept exactly one immediate child named
  `r206-YYYYMMDDTHHMMSSZ-<12 lowercase hex>` without
  `--reviewed-private-path-override`.
- [x] Reject deeper nesting, siblings, arbitrary external paths, traversal,
  invalid/non-ASCII/overlong names, symlink or junction/reparse-point paths,
  the repository, and every Git worktree.
- [x] Require authorization and preflight to be direct regular files in the
  selected child and bind consumption, checkpoints, retained-ledger state, and
  cleanup to that exact child.
- [x] Add a credential-free, network-free `--prepare-run-directory` command
  with exclusive create-new semantics.
- [x] Add disposable adversarial coverage for child isolation, consumed-run
  reuse, retained-ledger collision, artifact containment, override separation,
  and Windows path behavior without executing production mode.
- [x] Pass the complete canonical-plus-additive local regression (`46/46`).
- [ ] Confirm draft-PR CI passes on the exact final R2-06K head.
- [ ] Obtain independent exact-PR-SHA Level 3 review before merge.
- [ ] Obtain a new explicit production authorization and fresh named read-only
  preflight for any future exact reviewed runner SHA.
- [ ] Execute production synthetic verification and cleanup.
- [ ] Obtain separate reviewed release-closeout approval.

Remediation evidence:
`review-evidence/r2-06-durable-game-tombstones-release/SYNTHETIC_RUNNER_PRIVATE_PATH_REMEDIATION.md`.

# 4. Planned Engineering Sequence

Do not combine these into one large Codex task. Each item requires one approved ticket, one primary implementation task, and a separate independent review when warranted.

## R2 — Conflict-Safe Offline Synchronization

- [x] Inspect current local/cloud merge behavior again after LH-DEV-006
  (`R2-01`; `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`).
- [x] Define permanent client operation IDs for durable legacy game and
  tracked-clock operations (`R2-04`).
- [x] Define queued-operation states (`pending`, `syncing`, `accepted`,
  `retryable`, `rejected`, and `conflicted`) for those operation classes
  (`R2-04`).
- [x] Establish durable client replay for legacy game and tracked-clock
  operations (`R2-04`). Server-side exactly-once guarantees remain incomplete
  where existing server contracts do not accept or deduplicate the local
  operation ID.
- [x] Prevent cloud fetches from silently replacing newer local evidence
  within the current game/event hydration boundary (`R2-03`; PR #43; merge
  `5f442b9f009eda644bbdb9892a6e05092e2cb608`). Same-ID merge preserves
  cloud-omitted local evidence and rejects superseded or prior-account
  responses; durable field versions and explicit conflicts remain later R2
  work.
- [x] Define tombstone-versus-stale-update behavior (`R2-06A`; exact-SHA
  independent Level 3 review and merge complete). Production closeout remains
  blocked on state/authority reconciliation and separately authorized smoke.
- [x] Separate authorization failures from retryable network failures for the
  R2-05 durable legacy-game/tracked-clock boundary. Trust Spine and
  participation behavior remain under their existing contracts.
- [ ] Add visible states: Saved on device, Waiting to sync, Syncing, Synced, Needs attention.
- [ ] Add sanitized sync journal.
- [x] Test offline creation, reconnect, duplicate replay, refresh, revocation,
  and conflict (`R2-02`; `tools/test_sync_characterization.mjs`).
- [x] Preserve existing saved games and offline capture through the R2-03
  hydration merge, including tracked-time, score-context, pending/recovery,
  local metadata, and active-game evidence.
- [x] Preserve game and tracked-clock retry intent across refresh and reconnect
  with account-scoped storage-safety recovery (`R2-04`). This is client
  durability only; legacy game writes still lack server-side deduplication.
- [x] Keep production mutation and release out of the R2-04 feature ticket.
- [x] Keep production mutation and release out of the R2-05 feature ticket.
- [x] Keep production mutation, migration application, and release out of the
  R2-06 feature ticket.

**Gate to advance:** No silent local overwrite; offline operations replay exactly once where server contracts support it; conflicts are detectable and unresolved evidence remains recoverable.

## R3 — Canonical Player, Roster, and Game Identity

- [ ] Inventory every player and roster identity representation.
- [ ] Define one canonical `PlayerContext`.
- [ ] Create one resolver used by game creation, review, season totals, and sync.
- [ ] Preserve historical player display snapshots.
- [ ] Define personal-player, linked-roster, roster-only, unresolved, and unavailable states.
- [ ] Reject cross-account and cross-team linkage.
- [ ] Normalize legacy records without destructive rewrites.
- [ ] Add fixtures for historical and unresolved identity cases.

**Gate to advance:** One identity resolver; historical games remain stable; no saved game becomes inaccessible.

## R4 — Canonical Evidence Layer

- [ ] Consolidate event definitions into one canonical registry.
- [ ] Preserve private labels and narrower public-safe labels.
- [ ] Define review eligibility and Live Share eligibility.
- [ ] Build one effective-evidence selector.
- [ ] Apply corrections and tombstones consistently.
- [ ] Include tracked-time operations.
- [ ] Add evidence version, provenance, completion status, and limitations.
- [ ] Invalidate calculated outputs after evidence changes.
- [ ] Classify fields as Recorded, Calculated, Interpreted, Suggested, or System Status.
- [ ] Keep first production slice private and factual.
- [ ] Do not add recommendation generation.

**Gate to advance:** Every factual review number comes from the same effective evidence set.

## R5 — Finish Transition

- [ ] Define the Perform-to-Understand transition.
- [ ] Close clock and active shift safely.
- [ ] Confirm final score and local save.
- [ ] Separate local safety from cloud synchronization.
- [ ] Show unresolved evidence state when needed.
- [ ] Add Quick Game Record.
- [ ] Add Explore the Game.
- [ ] Add Review Later as local-only unless separately approved.
- [ ] Do not show Game Impact, grades, archetypes, or AI judgment.
- [ ] Verify narrow mobile layouts and offline completion.

**Gate to advance:** The user knows the game is safe before review begins.

## R6 — Feature-Flagged Game Review v2

- [ ] Create a default-off, production-safe feature flag.
- [ ] Preserve existing review when the flag is off.
- [ ] Build Game Record.
- [ ] Build factual Recognition.
- [ ] Build Game Flow.
- [ ] Build Patterns in the Record.
- [ ] Build Reflection with evidence limitations.
- [ ] Design Carry Forward but keep recommendation generation disabled.
- [ ] Link every calculated pattern to supporting evidence.
- [ ] Qualify estimated or incomplete data.
- [ ] Demote Game Impact and verdict-like scores.
- [ ] Exclude archetypes, Why We Won/Lost, and practice plans.
- [ ] Verify no private review content enters Live Share.

**Gate to advance:** First viewport establishes trust and recognition; every pattern is explainable.

## R7 — Perform / Live-Tracking Redesign

- [ ] Preserve one-handed event logging.
- [ ] Keep period, clock, score, player state, and shift state persistent.
- [ ] Keep frequent events first.
- [ ] Keep invalid events visible but disabled.
- [ ] Preserve last-action confirmation and Undo.
- [ ] Add compact device/sync status.
- [ ] Replace high-risk browser-native prompts incrementally.
- [ ] Preserve four-state tracked-time gate.
- [ ] Preserve offline recovery and existing event meanings.
- [ ] Verify 360px mobile use and game-day speed.

**Gate to advance:** Visual clarity improves without slowing capture or introducing a second event path.

## R8 — Home and Games Library

- [ ] Prioritize Resume Active Game.
- [ ] Prioritize Track New Game.
- [ ] Surface Review Latest Game.
- [ ] Surface Continue Deferred Review.
- [ ] Show recent games without creating a dashboard wall.
- [ ] Distinguish active, completed, unsynced, and needs-attention games.
- [ ] Keep delete, export, private backup, and sharing separate.
- [ ] Preserve minimum-necessary disclosure.

**Gate to advance:** The user can immediately tell what to do next.

## R9 — Season Factual Review

- [ ] Use the canonical evidence selector.
- [ ] Show games played and tracked playing time.
- [ ] Show totals, averages, and time-normalized rates.
- [ ] Show contribution categories.
- [ ] Show factual recent trends.
- [ ] Show evidence completeness across games.
- [ ] Recalculate after corrected games.
- [ ] Avoid permanent labels and public rankings.
- [ ] Keep advanced interpretation deferred.

**Gate to advance:** Season output remains factual, explainable, and correction-aware.

## R10 — Pilot Instrumentation and Validation

- [ ] Define minimum-necessary analytics.
- [ ] Measure game started and completed.
- [ ] Measure active-game recovery.
- [ ] Measure sync-pending duration.
- [ ] Measure Quick Game Record and full-review opens.
- [ ] Measure Review Later return.
- [ ] Measure evidence correction and evidence-link use.
- [ ] Avoid unnecessary youth-identifying analytics.
- [ ] Test live tracking burden with adult users.
- [ ] Test Saved on Device versus Synced comprehension.
- [ ] Test review trust and recognition.
- [ ] Test possession-language comprehension.
- [ ] Test whether review encourages or worsens overcoaching.
- [ ] Record validated findings in the canonical decision register.

**Gate to advance:** Product decisions are supported by real use, not novelty or assumption.

# 5. Repeatable Checklist for Every Ticket

## Shape and authorize

- [ ] One user or engineering outcome defined.
- [ ] Current behavior inspected.
- [ ] In-scope behavior explicit.
- [ ] Out-of-scope behavior explicit.
- [ ] Offline behavior defined.
- [ ] Authorization and disclosure boundaries defined.
- [ ] Data/migration impact defined.
- [ ] Acceptance criteria observable.
- [ ] Risks and rollback documented.
- [ ] Ticket moved to `READY` when a formal ticket is required.
- [ ] Primary Codex task title and ID recorded when applicable.

## Implement

- [ ] Start from clean, current `main`.
- [ ] Create one dedicated feature branch.
- [ ] Use the same primary Codex task throughout implementation.
- [ ] Read repository instructions and current state.
- [ ] Inspect actual code before editing.
- [ ] Present a bounded plan.
- [ ] Keep changes within the ticket.
- [ ] Use synthetic data only.
- [ ] Do not invoke write-capable connectors unless explicitly authorized.
- [ ] Do not deploy or modify production from an ordinary feature ticket.

## Verify

- [ ] Run focused tests.
- [ ] Run broad regression when shared runtime is affected.
- [ ] Perform browser/mobile checks where relevant.
- [ ] Test offline behavior.
- [ ] Test authorization boundaries.
- [ ] Test public disclosure boundaries.
- [ ] Run secret scan where relevant.
- [ ] Run `git diff --check`.
- [ ] Review full status and diff.
- [ ] Record sanitized evidence only when required by the active workflow.

## Independent review

- [ ] Bind Level 3 review to the exact PR head SHA.
- [ ] Review correctness and data compatibility.
- [ ] Review privacy, authorization, offline, sync, and disclosure boundaries.
- [ ] Review rollback constraints.
- [ ] Resolve findings in the primary execution task.
- [ ] Rerun affected tests and obtain clean re-review where required.

## GitHub and closeout

- [ ] Commit only the approved scope.
- [ ] Push the approved branch.
- [ ] Open one focused PR.
- [ ] Confirm CI passes and no unrelated files changed.
- [ ] Merge only after approval.
- [ ] Update ticket and repository current state when durable behavior changed.
- [ ] Record PR, merge SHA, tests, and remaining work.
- [ ] Create a separate release ticket if production activation is required.

# 6. Release Checklist for Production-Impacting Changes

A feature PR is not automatically a production release.

- [ ] Feature PR merged to `main`.
- [ ] Exact release source SHA identified.
- [ ] Separate release ticket approved.
- [ ] Release preflight passes.
- [ ] Release manifest updated and validated where required.
- [ ] Migration plan displayed before execution.
- [ ] Only approved migrations applied.
- [ ] RLS, grants, RPCs, and authorization verified.
- [ ] Public disclosure verified.
- [ ] Exact approved Pages artifact built and validated.
- [ ] Production deploy uses the approved source SHA.
- [ ] Release marker and service-worker behavior verified.
- [ ] Synthetic production smoke passes.
- [ ] Offline and reconnect behavior passes.
- [ ] Public Live Share remains minimum-necessary.
- [ ] Synthetic accounts, grants, tokens, and mutable records cleaned.
- [ ] Retained append-only synthetic evidence documented and inert.
- [ ] Production evidence sanitized and recorded.
- [ ] Ticket and repository state closed out.
- [ ] Rollback path remains usable.

# 7. Program-Wide Definition of Done

- [x] Local data is versioned and recoverable within the approved `localStorage` safety boundary (`LH-DEV-006`).
- [x] Cloud hydration cannot silently erase richer local evidence within the current game/event hydration boundary (`R2-03`).
- [ ] Offline game and clock operations replay durably and exactly once where server contracts support it.
- [ ] Conflicts and authorization failures are visible and classified.
  R2-05 completes internal classification only for durable legacy-game and
  tracked-clock operations; visible states remain deferred.
- [ ] Player identity resolves through one canonical path.
- [ ] Review calculations use one effective evidence set.
- [ ] Corrections invalidate and regenerate dependent output.
- [ ] Finish creates confidence before review.
- [ ] Review begins with Game Record and Recognition.
- [ ] Game Flow and patterns link to evidence.
- [ ] Reflection preserves athlete and family agency.
- [ ] Carry Forward remains optional.
- [ ] Game Impact grades and archetypes are no longer central.
- [x] Live Share remains minimum-necessary under the current approved disclosure boundary.
- [x] Critical storage, sync-characterization, tracked-time, Trust Spine, cancel-game, regression, Docker, and browser-smoke flows have repeatable automated coverage.
- [x] The app remains fast, one-handed, mobile-first, and offline-capable through completed work to date.

# 8. Explicitly Out of Scope Until Separately Approved

- Recommendation engines.
- Athlete-facing intelligence.
- Parent-facing interpretive intelligence.
- Public or Live Share intelligence.
- AI coach voice.
- Player archetypes.
- Practice-plan generation.
- Why We Won / Why We Lost conclusions.
- Public rankings.
- Numeric evidence-sufficiency thresholds.
- Full framework rewrite.
