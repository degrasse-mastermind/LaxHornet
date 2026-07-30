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

**Status:** [~] In progress  
**Risk level:** Level 3 — Critical synchronization and persistence behavior  
**Codex task:** `Implement R2-04 — Add Durable Game and Clock Operation States`  
**Branch:** `feature/r2-04-durable-game-clock-operations`  
**Starting point:** current `main`, including R2-03 merge `5f442b9f009eda644bbdb9892a6e05092e2cb608`

### Approved scope

- [~] Add durable local operation state for legacy game writes.
- [~] Add durable local operation state for tracked-clock writes.
- [~] Assign permanent client operation IDs before cloud attempts.
- [~] Persist explicit lifecycle states: pending, syncing, accepted, retryable, rejected, and conflicted.
- [~] Recover pending and stale-syncing work after refresh or reconnect.
- [~] Add receipt-backed acceptance and prevent older responses from falsely acknowledging newer local changes.
- [~] Add bounded retry metadata and prevent retry storms.
- [~] Preserve account isolation and keep signed-out namespace migration out of scope.
- [~] Keep queue metadata private and excluded from Live Share, recap, CSV, and public payloads.
- [~] Preserve existing Trust Spine replay, conflict, and tombstone behavior unchanged.

### Explicitly unchanged

- [x] No SQL or migration work authorized.
- [x] No RLS, grant, RPC-signature, or authorization-policy changes authorized.
- [x] No durable tombstone or game-field version implementation authorized.
- [x] No sync-status or conflict UI authorized.
- [x] No signed-out-to-account namespace migration authorized.
- [x] No deployment, release marker, Supabase, or production change authorized.

### Current gate

R2-04 remains in progress until implementation, focused tests, complete regression, CI, and exact-PR-SHA independent review are complete. Local-first game-day capture must remain fast and must not wait on cloud processing.

# 4. Planned Engineering Sequence

Do not combine these into one large Codex task. Each item requires one approved ticket, one primary implementation task, and a separate independent review when warranted.

## R2 — Conflict-Safe Offline Synchronization

- [x] Inspect current local/cloud merge behavior after LH-DEV-006 (`R2-01`).
- [~] Define permanent client operation IDs (`R2-04` in progress).
- [~] Define queued-operation states (`R2-04` in progress).
- [~] Establish durable replay for legacy game and tracked-clock operations (`R2-04` in progress). Server-side exactly-once guarantees remain limited until later server work.
- [x] Prevent cloud fetches from silently replacing newer local evidence within the current hydration boundary (`R2-03`; PR #43; merge `5f442b9f009eda644bbdb9892a6e05092e2cb608`).
- [ ] Define tombstone-versus-stale-update behavior.
- [ ] Separate authorization failures from retryable network failures.
- [ ] Add visible states: Saved on device, Waiting to sync, Syncing, Synced, Needs attention.
- [ ] Add sanitized sync journal.
- [x] Test offline creation, reconnect, duplicate replay, refresh, revocation, and conflict (`R2-02`).
- [x] Preserve existing saved games and offline capture through R2-03, including tracked-time, score context, pending/recovery state, local metadata, and active-game evidence.
- [x] Keep production mutation and release outside completed R2-01 through R2-03 feature work.
- [~] Keep production mutation and release outside R2-04 while implementation is in progress.

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
