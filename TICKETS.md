# LaxHornet Technical Tickets

This file is the active, reviewable queue for work that needs a ticket. Level 1
routine work does not require an entry. Level 2 work may use a concise ticket or
PR-ready task description. Level 3 work requires one approved ticket. Product
brainstorming and broad planning belong in ChatGPT.

## Status values

- `PROPOSED` — idea captured but not approved for implementation.
- `READY` — scope and acceptance criteria are approved.
- `IN PROGRESS` — currently being implemented on a named branch.
- `BLOCKED` — cannot proceed without a documented dependency or decision.
- `REVIEW` — implementation is complete and awaiting review.
- `DONE` — merged and verified.
- `SUPERSEDED` — replaced by another ticket or decision.

## Active setup tickets

### LH-DEV-001 — Codex repository guardrails

Status: `DONE`
Branch: `chore/codex-project-configuration`

Goal:

Create repository-level instructions, current-state context, safe Codex defaults, and a disciplined ticket workflow tailored to the actual LaxHornet codebase.

Acceptance criteria:

- Root `AGENTS.md` accurately describes the vanilla HTML/CSS/JavaScript offline PWA.
- `REPO_CURRENT_STATE.md` records the current architecture, release controls, Supabase boundaries, and verification entry points.
- `.codex/config.toml` lets ChatGPT-authenticated Codex choose the newest model supported for the signed-in account, applies high reasoning where supported, and uses safe local approvals.
- Host-managed Apps/Plugins exposed through `codex_apps` are treated as separate from repository configuration.
- Supabase app or connector tools are not used during ordinary LaxHornet implementation unless a ticket explicitly authorizes their exact project, scope, and allowed actions.
- This ticket file contains a reusable implementation template.
- No production code, release marker, migration, deployment, connector permission, or database state is changed.

Verification:

- Review all configuration and documentation files against the repository.
- Confirm Codex trusts the project and reports the loaded instruction/config sources.
- Confirm `/model` shows a model supported by the signed-in ChatGPT account without a startup error.
- Confirm Codex recognizes `codex_apps` connectors as host-managed capabilities rather than repository-scoped tools.
- Confirm Codex does not invoke Supabase, Vercel, Resend, or other write-capable app actions during ordinary repository work without explicit ticket authorization.

Completion record:

- Pull request: #16
- Merge commit: `d4431a9adeba6eeb5c3b4beb30ff3bea0721140f`
- Verification: Codex successfully loaded `AGENTS.md`, `README.md`, `REPO_CURRENT_STATE.md`, `TICKETS.md`, and `.codex/config.toml` and correctly summarized the repository constraints.
- Scope confirmation: No runtime code, database migration, deployment configuration, release marker, connector permission, or production data was changed.

### LH-DEV-002 — Establish local Supabase CLI workflow

Status: `DONE`
Branch: `chore/lh-dev-002-local-supabase`

Goal:

Verify that the committed `supabase/` directory can reproduce the intended schema locally without touching the linked production project.

Required safeguards:

- Use Docker-compatible local infrastructure.
- Use explicit local flags where supported.
- Do not run `supabase db reset --linked`.
- Do not run `supabase db push`.
- Do not repair remote migration history without a separately approved release ticket.

Acceptance criteria:

- Supabase CLI version is recorded.
- Local stack starts successfully.
- Existing migrations are inspected in their required order.
- Local reset/migration verification results are documented.
- Any drift or provenance issue is reported without changing production.

Completion record:

- Pull request: #18
- Merge commit: `8f0e45ec5f3fc6a3faf47e690665367487461b13`
- Verified environment: Docker Engine `29.6.2`, Docker Compose `v5.3.1`, and Supabase CLI `2.109.1` on Windows.
- Local startup: Reduced stack started successfully with `storage-api`, `imgproxy`, `logflare`, and `vector` excluded after the full stack produced an unhealthy Storage container.
- Migration verification: `supabase db reset --local` completed successfully and reapplied all six committed migrations in filename order.
- Documentation: `docs/LOCAL_SUPABASE_WORKFLOW.md` records the verified commands, expected notices, stopped services, cleanup procedure, and prohibited remote commands.
- Repository hygiene: `supabase/.branches/` is ignored as generated local metadata.
- Scope confirmation: No remote link, database push, linked reset, migration repair, connector mutation, migration SQL change, runtime change, deployment change, or production data change occurred.

### LH-DEV-003 — Create a non-production Supabase development target

Status: `PROPOSED`

Goal:

Create a safe Supabase development project or branch so authorized database changes can be tested without access to production data.

Candidate acceptance criteria:

- Development environment contains synthetic data only.
- Environment identifiers and purpose are documented without committing secrets.
- Production and development targets are unmistakably separated.
- Any write-capable connector or MCP is scoped only to the development target.
- Tool approvals remain enabled for mutations.
- Promotion to production still occurs only through reviewed migration files and release procedure.

### LH-DEV-004 — Add GitHub Actions regression checks

Status: `DONE`
Branch: `chore/lh-dev-004-ci-regression`

#### Goal

Add a pull-request and manual-dispatch GitHub Actions workflow that runs the repository's existing non-deployment regression checks and reports failures clearly, without contacting Supabase production, requiring repository secrets, or changing GitHub Pages deployment behavior.

#### In scope

- Add one workflow under `.github/workflows/` for pull requests and `workflow_dispatch`.
- Use the existing repository test scripts and Node/Python syntax or contract checks that can run in a clean GitHub-hosted runner.
- Install only the runtime dependencies required by the existing tests.
- Preserve test output as ordinary job logs; upload an artifact only when an existing test already produces a useful local evidence file and doing so does not expose secrets or sensitive data.
- Use least-privilege GitHub Actions permissions.

#### Out of scope

- No GitHub Pages deployment or deployment workflow changes.
- No Supabase CLI linking, local Docker stack startup, remote migration inspection, database push, migration repair, Edge Function deployment, or connector action.
- No production, staging, preview-branch, Vercel, Resend, or other external-service mutation.
- No modification to runtime code, migration SQL, release markers, service-worker cache names, or release manifests merely to satisfy CI.
- Do not force the full Windows-specific local Supabase Docker workflow into GitHub Actions as part of this ticket.

#### Current behavior

- Pull requests now run the read-only `LaxHornet Regression` workflow automatically.
- The same workflow can be launched manually through `workflow_dispatch` on `main`.
- Existing repository scripts cover JavaScript syntax, event-operation contracts, game-scope capabilities, release-manifest validation, containment and hygiene, minimum disclosure, secure disclosure, Product Alignment, Trust Spine contracts, selected embedded database checks, Python permission/cleanup checks, secret scanning, and `git diff --check`.

#### Requirements

- Workflow events: `pull_request` and `workflow_dispatch` only.
- Permissions default to read-only repository contents.
- The workflow does not use repository or environment secrets.
- The workflow does not deploy, push, publish, merge, create Supabase branches, or call remote production services.
- Official GitHub Actions use Node-24-compatible stable major versions.
- Dependency caching is disabled because the repository has no lockfile; the pinned PGlite dependency is installed temporarily without modifying the repository.
- Commands fail the job on test failure and each test group has a distinct step name.

#### Acceptance criteria

- `.github/workflows/laxhornet-regression.yml` exists and is valid YAML.
- The workflow runs on pull requests and manual dispatch.
- The workflow uses existing LaxHornet test scripts rather than a parallel test framework.
- No production deployment or remote Supabase mutation is possible from the workflow.
- No secrets are required.
- Job output identifies each failed command or test group.
- Pull-request and manual-dispatch runs completed successfully.
- `REPO_CURRENT_STATE.md` records CI as a durable repository capability.

#### Risks and rollback

- Risk: GitHub-hosted runner or official action versions may change over time and require maintenance.
- Risk: release-control checks depend on manifest-derived repository ancestry and must continue to fail closed.
- Rollback: remove or disable the single workflow file; no runtime, database, or production rollback is required.

#### Completion record

- Implementation pull request: #20
- Implementation merge commit: `3b3a1fc9c0f52a1e9497bfcc518d12f82afacbfd`
- Node 24 action cleanup pull request: #21
- Node 24 cleanup merge commit: `86a5d8348a8e3b747d3f486296c2db81f9422550`
- Pull-request verification: the portable regression workflow passed all selected JavaScript, Node, Python, release-control, disclosure, security, embedded-database, and diff-hygiene checks.
- Manual verification: `workflow_dispatch` completed successfully on `main`; the initial Node.js 20 action-runtime annotation was then removed by upgrading to `actions/checkout@v5`, `actions/setup-node@v6`, and `actions/setup-python@v6`.
- Permissions and safety: `contents: read` only, no repository secrets, no deployments, no Supabase CLI or remote service mutations.
- Files changed: `.github/workflows/laxhornet-regression.yml`, `TICKETS.md`, and `REPO_CURRENT_STATE.md`.
- Remaining work: maintain action majors and portable test coverage as the repository evolves; browser/device QA and the local Supabase Docker workflow remain separate verification layers.

### LH-21 — Tracked Playing Time private data foundation

Status: `DONE`
Branch: `feature/tracked-playing-time-foundation`
Related design document: `docs/TRACKED_PLAYING_TIME_FOUNDATION.md`

#### Goal

Add the private, local-first data foundation for authoritative game-clock state and append-only player participation operations without adding UI, changing existing event tracking, or expanding public disclosure.

#### Completed scope

- One additive migration creates private clock state, stable participation logical identities, append-only operations, and an effective resolver.
- Nine authenticated RPCs cover clock initialization/update/reconciliation/read and participation create/correct/tombstone/list/reconciliation.
- Personal games enforce account/player ownership; team-roster games reuse Trust Spine scope and grant authority.
- Forced RLS, revoked direct table/view grants, fixed-search-path wrappers, immutable history triggers, request hashes, and idempotent operation IDs fail closed.
- The companion JavaScript service provides deterministic clock projection, pause/resume/period transitions, recovery classification, game-end context, local persistence, retry, and reconciliation contracts.
- Public Live Share and recap remain unchanged; selected CSV stays event-only; the sensitive private full backup retains per-game local tracked state.
- Release containment and the manifest identify the three SQL artifacts as a review-only, unapplied package.

#### Out of scope

- No clock or substitution controls, game-review UI, or production runtime wiring.
- No production migration, deployment, version/cache marker change, merge, or release.
- No new public/family-facing field and no change to existing event-operation semantics.

#### Verification

- `supabase db reset --local`: blank-database migration sequence passed.
- Local rollback removed only the three foundation tables/view/RPC layer and preserved the Event Pipeline and public Live Share objects.
- Reapplying the migration to the existing local schema passed, followed by 37/37 pgTAP assertions.
- `node tools/test_tracked_playing_time_service.mjs`: 16/16 passed.
- `node tools/test_tracked_playing_time_foundation.mjs`: static migration/privacy/containment contracts added.
- `node tools/run_v283_local_regression.mjs`: 26/26 groups passed locally.
- GitHub Actions run `30258266639` passed every named regression step on draft PR #24.
- Production follow-up: migration `20260727000000` was already present exactly once and all 88 normalized production statements matched the reviewed migration. The stopped team-admin rollout fixture was classified as a fixture mismatch because mutation authority is limited to scoped parents and coaches. A corrected synthetic player-scoped parent fixture passed the production authorization gate; team-admin read/list authority remained allowed while initialize/update/create/correct/tombstone remained denied.

#### Risks and rollback

- Participation history may include child-associated game/player identifiers and is private by default.
- Clock recovery can be marked `estimated` or `needs_review`; uncertain elapsed time is not silently invented.
- The rollback refuses to destroy accepted participation history. Review/export and an explicit disposal decision are required before destructive rollback.
- UI integration must preserve immediate local persistence and must not expose tracked time through public Live Share, recap, or default CSV.

#### Completion record

Commit/PR: implementation commits `e2477d0` and `025aaf3`; pull request #24 merged as `2deb8c8df92a612d233f9dad58765e0a22bee618`.
Evidence: `review-evidence/tracked-playing-time-foundation/`
`REPO_CURRENT_STATE.md` updated: `YES`
Remaining work: public-disclosure verification, exact-main frontend deployment, production browser smoke testing, and final release-evidence closure under the separately authorized release procedure.

### LH-22 — Tracked Playing Time Phase 1 user experience

Status: `DONE`
Branch: `release/v284-tracked-playing-time`
Base: `main` at UI merge `fc9c079d69757cfc2667dea7e1dfcc56524dce56`
Related design document: `docs/TRACKED_PLAYING_TIME_FOUNDATION.md`

#### Goal

Provide a complete, private, local-first Phase 1 experience for tracking one selected player's on-field time during a game, recovering it safely, correcting it through append-only operations, and reviewing deterministic shift totals after the game.

#### Completed scope

- Added a conservative per-game opt-in with quarter/half format defaults, editable regulation duration, and optional overtime duration.
- Loaded and offline-cached the foundation companion service without changing the v283 release marker or cache name.
- Added persisted Start, Pause, Resume, End Period, Player In, and Player Out controls with a live active-shift timer.
- Added system period-end and game-end closures, next-period off-field behavior, bounded refresh recovery, offline persistence, and idempotent retry.
- Added pure deterministic shift derivation with duplicate, overlap, ordering, period, recovery, and synchronization review states.
- Added Total, Game share, Shifts, Average, Longest, completeness status, and compact shift history to Game Review.
- Added governed correction revisions, manual missed shifts, tombstone removal, unmatched-boundary resolution, and invalid-edit rejection.
- Gated every new live performance event, including notes and indirect calls, behind `clock_running && player_on_field` for tracked-time games.
- Kept event controls visible with accessible disabled states and exact contextual instructions for each blocked clock/participation combination.
- Preserved non-tracked and historical event behavior, Game Review corrections/tombstones, Game Impact, Possible Next Focus, public Live Share, public/family recaps, and selected CSV.

#### Out of scope

- No performance-rate, fatigue, shift-event, season-trend, position-by-shift, team substitution, coach comparison, or AI analysis.
- No production migration, deployment, merge, release marker, cache-name, script-query-version, or release-manifest change.
- No change to public disclosure allowlists or event behavior outside opted-in tracked-time live capture.

#### Verification

- `node tools/test_tracked_playing_time_ui.mjs`: 44/44 passed.
- `node tools/test_tracked_playing_time_service.mjs`: 16/16 passed.
- `node tools/test_tracked_playing_time_foundation.mjs`: 11/11 passed.
- `node tools/test_tracked_playing_time_manual_scenarios.mjs`: 7/7 passed.
- `node tools/test_tracked_playing_time_ui_browser.cjs`: 33/33 rendered checks passed with no console errors.
- `supabase db reset --local`: passed with the tracked-time migration applied.
- `supabase test db supabase/tests/tracked_playing_time_foundation.sql`: 37/37 passed.
- `node tools/run_v283_local_regression.mjs`: 29/29 groups passed.
- Secret/host scan and `git diff --check`: passed within the full regression.
- GitHub Actions portable regression is required on the final PR head; the post-push result is recorded on PR #25.
- v284 release repair: the secure-disclosure browser update-path fixture now derives a simulated next version instead of signaling the current release; timestamped diagnostics preserve the last completed test step and capture unexpected console/page/network failures.
- Focused v284 verification: secure-disclosure browser passed three consecutive runs at 62/62, static minimum disclosure passed 42/42, secure activation passed 21/21, and `git diff --check` passed.
- Reusable release controls: `tools/run_release_preflight.mjs`, `tools/run_release_verification.mjs`, and `docs/RELEASE_VERIFICATION_WORKFLOW.md` centralize release refs, exact disposable dependencies, local-stack health, fail-fast gates, cleanup, and external logs without contacting production.
- Canonical v284 local release verification: all 15 gates passed; production-ledger provenance passed; both database reset/upgrade paths and rollback cases passed; pgTAP passed 37/37 on each path; lint contained only the documented legacy finding; the complete regression passed 29/29; cleanup removed all disposable dependencies and local Supabase containers.

#### Risks and rollback

- The foundation and corrective disclosure migrations are present exactly once in production. The corrected synthetic team authorization gate and final production browser smoke passed at deployed SHA `effca6952e647b7424f96675f390fc80d5c42368`.
- A review browser that reaches a backend without the tracked-time RPCs fails soft to device-only tracking for that session; the local event gate remains authoritative and is unaffected by hosted capability availability.
- Running-clock recovery gaps longer than 30 seconds freeze and require review rather than inventing time.
- Runtime rollback uses the approved v284 release procedure. Accepted database history remains governed by the foundation's fail-closed rollback.

#### Completion record

Commit/PR: implementation commits through `76274fe`; pull request #25 merged as `fc9c079d69757cfc2667dea7e1dfcc56524dce56`.
Files changed: `app.html`, `app.js`, `styles.css`, `service-worker.js`, `tracked-playing-time-service.js`, `.github/workflows/laxhornet-regression.yml`, focused tests, review evidence, `TICKETS.md`, and `REPO_CURRENT_STATE.md`.
Evidence: `review-evidence/tracked-playing-time-ui/`
`REPO_CURRENT_STATE.md` updated: `YES`
Remaining work: post-release monitoring and the separate allowlisted GitHub Pages artifact ticket.

### LH-23 — v284 public-event semantic boundary incident remediation

Status: `DONE`
Branch: `fix/v284-public-event-semantic-boundary`
Evidence: `review-evidence/v284-tracked-playing-time-production/`

#### Goal

Contain and permanently correct the confirmed v284 defect that allowed private
legacy participation-like events to enter the ordinary Event Pipeline and
appear through public Live Share.

#### Completed scope

- Aggregate production inspection found no active tokens, no non-synthetic
  affected share, and no confirmed real/youth-data exposure.
- Public Live Share RPC execute access was reversibly revoked from browser
  roles while the permanent fix is reviewed.
- Added a closed 19-type ordinary-event classification: 18 public lacrosse
  events plus the private ordinary `note` type. Unknown, tracked-time, clock,
  shift, participation, and legacy-alias semantics default private.
- Applied the boundary to browser create/correct/reconcile/retry paths and to
  database create/correct wrappers.
- Added additive public egress filtering and canonical public labels/categories
  without rewriting or deleting historical evidence.
- Hardened all public fields, game-period/date bounds, uniform pre-lookup
  authorization responses, raw pre-migration replay, and zero-public-event
  recap handling after independent adversarial review.
- Hardened create, correction, and tombstone scope checks uniformly before
  replay or event-state lookup. Attempted pre-upgrade create/correction payloads
  now make one exact raw retry after scope establishment so the server can
  resolve lost responses; never-accepted private payloads are cleared only
  after authoritative rejection.
- Added a fail-closed rollback, pgTAP, browser reproduction, stale/offline/import
  coverage, family recap boundary, selected private CSV boundary, and release
  manifest/preflight support.

#### Verification

- Blank database reset with the corrective migration: passed.
- Production-shaped seven-migration baseline plus one corrective migration:
  passed.
- `supabase/tests/v284_public_event_semantic_boundary.sql`: 45/45 passed on
  both database shapes, including poisoned fields, create/correct/tombstone
  authorization oracles, and pre-migration retries.
- `tools/test_public_event_semantic_boundary.mjs`: passed.
- Signed-in browser disclosure reproduction: 73/73 passed with lost-response
  create/correction replay, never-accepted rejection, the public payload
  remaining exactly two ordinary events, and no hosted requests.
- Tracked-time browser suite: 33/33 passed with focused service-worker
  lifecycle isolation.
- Complete application and release regression: 33/33 groups passed.
- Canonical v284 local release verification: all 17 gates passed, including
  both database shapes, two 45-test disclosure pgTAP runs, rollback behavior,
  lint, 33/33 regression groups, the 73/73 signed-in browser journey, and
  cleanup at exact candidate commit `d4a30baa64134e05b01d644ccf33d8e3ba88913d`.
- Initial independent review found four actionable gaps; the first re-review
  confirmed those fixes and found two additional tombstone/retry gaps. All six
  were fixed on the same branch.
- Final remediation PR #30 passed CI and independent exact-SHA review at head
  `19f3f89d1120fce167f59237e355bb7cc04394c0`, then merged as
  `effca6952e647b7424f96675f390fc80d5c42368`.
- Corrective migration `20260728193942` is present exactly once in production;
  the safe public RPC definition and least-privilege grants are active.
- Exact hosted runtime assets match merge SHA `effca6952e647b7424f96675f390fc80d5c42368`.
- Final synthetic production smoke passed with exactly two approved public
  events; aliases, tracked time, unknown semantics, private notes, and internal
  metadata remained absent from public payload and DOM.
- Ordinary game entry, score, Undo, Save, End Game, Game Review, offline
  recovery, corrections, tombstones, quarters/halves clocks, participation,
  manual/recovery states, selected CSV, recap, token lifecycle, and anonymous
  denial gates passed.
- Cleanup proved zero synthetic users, sessions, refresh tokens, active tokens,
  active grants, mutable legacy rows, active event versions, running clocks,
  active participation, and pending/conflicted operations. No real data was
  touched.

#### Risks and rollback

- Existing private/unknown Event Pipeline evidence remains append-only and is
  excluded non-destructively.
- A formerly public ordinary event corrected into private semantics is
  tombstoned from the public pipeline.
- Recovery rollback revokes public RPC execution and intentionally does not
  restore the vulnerable function.
- Retained synthetic append-only history is private, inert, revoked, and
  documented in the production evidence package.

#### Completion record

Commit/PR/merge/deployment: PR #30, final head
`19f3f89d1120fce167f59237e355bb7cc04394c0`, merge/deployment
`effca6952e647b7424f96675f390fc80d5c42368`.
Migration: `20260728193942_v284_public_event_semantic_boundary`, applied once.
Production smoke tooling: independently reviewed exact SHA
`0ce0f6734318b07bbf7156e91c79d05d40bd7222`; PR #29 remains non-deployable,
closed, unmerged, and must not be merged.
Evidence: `review-evidence/v284-tracked-playing-time-production/`.
`REPO_CURRENT_STATE.md` updated: `YES`

### LH-DEV-005 — Publish an allowlisted GitHub Pages artifact

Status: `COMPLETE`
Branches: `codex/infra-allowlisted-pages-deployment`,
`fix/team-members-state-c-preflight`

#### Goal

Replace repository-root GitHub Pages publishing with an explicitly allowlisted
deployment artifact so source, tests, migrations, rollback material, and review
evidence are not copied to the public static site.

#### Acceptance criteria

- The artifact contains only approved runtime HTML, CSS, JavaScript, manifest,
  icons, and required static assets.
- Release marker, service-worker paths, custom domain, offline install/update,
  and rollback behavior remain verified.
- CI proves that migrations, rollback SQL, tests, tooling, documentation,
  evidence, local configuration, and secrets are absent from the artifact.
- The deployment workflow retains least-privilege permissions and does not
  change Supabase production state.

#### Implemented scope

- Added an all-files-explicit 47-file production allowlist. Directory-wide
  copying is prohibited and unknown files default to excluded.
- Added deterministic artifact build/validation tooling with exact membership,
  SHA-256, runtime-reference, service-worker, CNAME, secret, traversal, and
  symlink checks. The public launch-kit ZIP is entry-allowlisted, traversal and
  symlink checked, secret scanned, and SHA-256 pinned per approved member.
- Added focused deployment contracts and pull-request regression coverage.
- Added a least-privilege custom Pages workflow using
  `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, and
  `actions/deploy-pages@v4`.
- Preserved the v284 marker while adding service-worker activation cleanup for
  stale, non-allowlisted cache entries.
- Documented the legacy exposure, custom-domain requirements, and allowlisted
  rollback procedure.

#### Verification status

- Focused deployment safety contracts: `21/21` passed locally.
- Deterministic artifact build: `47` files, `v284`, exact allowlist membership.
- Artifact browser: service-worker registration/control, stale-cache purge,
  same-version legacy-v284 worker upgrade, mobile app, Game Review,
  tracked-time runtime, Live Share entry, and offline shell passed locally.
- Broader regression, rendered artifact QA, independent PR review, production
  deployment, internal-path exclusion, and closeout passed.
- Production rollback to allowlisted SHA `9fafa7c2ca7dea90d1469cd1de4591323a359adc`
  passed in Actions run `30514148729`: 47/47 public files matched, 455 tracked
  internal paths and 10 adversarial probes remained non-public.
- Restore to approved `main`
  `3e952ea7226e12b38d65dd656b528a3240ee5d9a` passed in run `30514207462`:
  47/47 public files matched, 528 tracked internal paths and 10 adversarial
  probes remained non-public. Pages remained Actions-based with the custom
  domain, HTTPS enforcement, and approved certificate intact.

#### Production RLS incident remediation

- The first hosted v284 smoke against the allowlisted artifact reproduced
  SQLSTATE `42P17`: four legacy `team_members_*_team` policies queried
  `public.team_members` from policies on that same table.
- Production State C contained the canonical four scalar-subselect policies
  without a corrective migration record. Exact capture, local reproduction,
  and the 18-case matrix classified it `SEMANTICALLY EQUIVALENT TO STATE B`;
  it produced no `42P17` and did not broaden or narrow authorization.
- Follow-up PR #35 recognized only the exact State C authorization envelope and
  passed independent exact-SHA review. It did not change the approved
  authorization model.
- Additive migration `20260730004700_team_members_rls_recursion` is present
  exactly once in production. It moves the bounded current-user role lookup
  into `lh_rls_private`, enables FORCE RLS, removes anonymous ACLs, and limits
  authenticated/service-role table access to required DML, including no
  PostgreSQL 17 `MAINTAIN`.
- Local evidence passes: defect reproduction 4/4, corrected
  authorization/preflight metadata 43/43, isolated rollback exact `42P17`, reapply from both
  approved states plus State C, blank migration chain, production-shaped upgrade,
  and adversarial preflight rejection of private-schema, helper-body, table
  ACL, missing migration-history, and injected lower-version history drift.
- The final production policy MD5 is
  `2814223218999d3d6364582d5b9e85e1`; RLS/FORCE RLS, DML-only ACLs, helper
  owner/config/ACLs, and migration count one were verified.
- The complete synthetic hosted smoke passed with explicit logout/login and
  clean-session reconstruction, tracked-time synchronization, Live Share
  private-semantic exclusion, membership/grant revocation, old-token rejection,
  and exact-zero mutable/Auth residue. Retained append-only history is private,
  inert, and synthetic.
- Closeout evidence:
  `review-evidence/team-members-rls-remediation/PRODUCTION_ROLLOUT_CLOSEOUT.md`.

### LH-DEV-006 — Versioned local-storage safety foundation

Implementation status: `IMPLEMENTATION COMPLETE — DRAFT PR READY`

Files changed:

- `app.js`
- `tools/test_local_storage_safety.mjs`
- `tools/test_local_storage_safety_browser.cjs`
- `tools/fixtures/lh-dev-006-storage-safety.json`
- `tools/run_v283_local_regression.mjs`
- `tools/test_product_alignment_remediation.mjs`
- `TICKETS.md`
- `REPO_CURRENT_STATE.md`

Tests and results:

- Focused storage-safety suite: `27/27` passed.
- Complete canonical local regression: `36 passed, 0 failed`.
- Browser smoke: valid-data startup, saved-game backup recovery, active-game
  recovery, and immediate offline event persistence passed with no unexpected
  console/page errors or hosted Supabase requests.

Known limitations:

- `localStorage` cannot provide a true transaction across keys; failed writes
  restore the prior primary when possible and retain bounded staging/recovery
  data for diagnosis.
- A future-schema domain is preserved and write-blocked for the current
  session; the user must open it with a compatible newer client.

Next step: independent review of the draft pull request. Do not merge or deploy
until separately authorized.

### R2-01 — Inventory current local/cloud sync and conflict behavior

Status: `REVIEW`

Risk level: `LEVEL 3`

Branch: `codex/r2-01-sync-inventory`

Related document: `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`

Goal:

Create an evidence-based current-state inventory of local persistence, cloud
reads/writes, retries, identities, ordering, deletion, authorization failures,
conflicts, sync UI, and actual test coverage without changing behavior.

In scope:

- Current runtime, relevant committed SQL/RPCs, and relevant tests.
- One architecture inventory and narrow rollout/current-state records.

Out of scope:

- Runtime, SQL, migration, test, workflow, release, Supabase, deployment, or
  production changes.

Acceptance criteria:

- Every material risk names its classification and current file/function
  evidence.
- Desired behavior and follow-up tickets are separate from current behavior.
- Unknown live-system facts remain unknown rather than inferred.
- The R2 gate remains open pending small, ordered implementation tickets.

Completion record:

- Baseline: `origin/main` at
  `fff8c3fe4f9cf285c3c092a713bef3d3f24c03e1`.
- Prerequisites confirmed: LH-DEV-006, Lean Development Workflow v2, corrected
  Docker CI, and reconciled rollout checklist.
- Independently reviewed inventory PR head:
  `554fb2923f4fd9285c34ca1b32ad6a9498fea834`.
- Independent review disposition: `CORRECTION REQUIRED` — review was
  performed against that exact PR head. Review is not complete; after this
  completion-record correction is pushed, the resulting new exact PR head
  must receive a fresh independent review.
- Draft pull request: #41.
- Files changed: `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`,
  `TICKETS.md`, `docs/LAXHORNET_ROLLOUT_CHECKLIST.md`, and
  `REPO_CURRENT_STATE.md`.
- Checks: complete canonical local regression `36 passed, 0 failed`;
  phase-aware containment `32/32`; Trust Spine SQL acceptance/rollback `33`
  SQL tests with all 20 Trust Spine tables removed and legacy sentinels
  preserved after rollback; `git diff --check`; authorized-path audit.
- Production or external state changed: `NO`.
- `REPO_CURRENT_STATE.md` updated: `YES` — current limitations only.
- Remaining work: fresh independent review of the exact post-correction PR
  head, then the proposed R2 implementation sequence.

### R2-02 — Lock the current sync boundary with adversarial regression tests

Status: `REVIEW`

Risk level: `LEVEL 2`

Branch: `feature/r2-02-sync-characterization-tests`

Related document: `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`

#### Goal

Freeze the current synchronization boundary with deterministic, passing
characterization tests before R2 runtime behavior changes.

#### In scope

- Synthetic VM and in-memory Supabase/storage harnesses for every confirmed
  R2-01 overwrite, ordering, retry, deletion, authorization, identity,
  namespace, recovery, and user-state risk.
- Existing Trust Spine replay, version, conflict, and tombstone guarantees.
- Focused local and read-only CI regression wiring.

#### Out of scope

- Runtime fixes or refactors.
- SQL, migration, Supabase, deployment, release, or production changes.
- Desired-behavior assertions for R2-03 and later tickets.

#### Acceptance criteria

- Every confirmed R2-01 risk has deterministic coverage.
- Unsafe current behavior is captured by passing `CHARACTERIZATION` tests.
- Equivalent Trust Spine coverage is referenced rather than weakened or
  duplicated.
- Fixtures are synthetic and no remote service is contacted.
- The R2 gate remains open.

#### Completion record

- Baseline: `origin/main` at
  `f8351afa63e4b017bbf133eb2e10fb8d3b5ccf9f`, including merged R2-01.
- New focused suite: `tools/test_sync_characterization.mjs`, `17/17` passing.
- Characterized scenarios: same-ID richer-local overwrite; inbound/outbound
  lossy mapping; out-of-order loads; stale-device game/event resurrection;
  RLS-invisible delete-marker clearing; failed tracked-clock write; network,
  auth, RLS, validation, capability, and membership error handling; Trust
  Spine rejection removal; unclassified participation rejection; partial
  game/event success; refresh during pending legacy, clock, and Trust Spine
  work; signed-out/account namespace transition; authorization filtering;
  nontransactional multi-key persistence; unstable repeated-capture IDs.
- Confirmed risks: all `17` R2-01 risks remain confirmed by executable
  characterization.
- Reclassified risks: `NONE`.
- Existing guarantees: permanent Trust Spine operation IDs, replay/tamper
  detection, server event versions, conflict creation, and permanent
  tombstones remain covered by the existing event-operation and Trust Spine
  suites; embedded Postgres migration/acceptance/rollback passed all `33` SQL
  tests with all `20` Trust Spine tables removed and legacy sentinels
  preserved after rollback.
- Focused checks: local-storage safety `28/28`; event-operation service
  contracts passed; tracked-time service `16/16`; tracked-time foundation
  `11/11`; tracked-time UI `44/44`; Trust Spine source contracts `18/18`;
  cancel-game `33/33`; changed JavaScript syntax; `git diff --check`.
- CI: implementation commit `7db9a469877378f3124608147a19737059ab328d`
  passed both the portable GitHub Actions regression, including the new
  `17/17` suite, and the Docker test suite.
- Implementation commit:
  `7db9a469877378f3124608147a19737059ab328d`; draft PR #42.
- Production or external state changed: `NO`.
- `REPO_CURRENT_STATE.md` updated: `NOT REQUIRED` — no current-state fact was
  disproved and no runtime behavior changed.
- Remaining work: confirm read-only CI, review the draft PR, and use these
  assertions as the explicit change boundary for R2-03. The R2 gate remains
  open.

### R2-03 — Make cloud game hydration lossless

Status: `REVIEW`

Risk level: `LEVEL 3`

Branch: `feature/r2-03-lossless-cloud-hydration`

Execution task: `Implement R2-03 — Make Cloud Game Hydration Lossless`
(`019fb1f9-d65b-70c2-a53c-671411c6c909`)

Related document: `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`

#### Goal

Prevent same-ID account hydration from discarding richer or newer local game
and event evidence while preserving the current offline-first and cloud
storage boundaries.

#### In scope

- Explicit game/event hydration ownership and conflict-sensitive field policy.
- Same-ID merge by stable game and event IDs with preserve-if-omitted behavior.
- Preservation of scores, event score context, tracked-time, pending/recovery
  state, active-game evidence, and unknown local metadata.
- A request-generation and account guard scoped to `loadCloudGames`.
- Adversarial R2-03 regression assertions and narrow current-state records.

#### Out of scope

- SQL, migrations, RLS, RPC, queue, durable tombstone, namespace-migration,
  sync-status UI, conflict UI, release-marker, deployment, or production work.
- New cloud storage for tracked-time or local-only fields.
- A general sync coordinator or the remaining R2 conflict model.

#### Acceptance criteria

- Richer or newer local same-ID evidence survives poorer or older hydration.
- Explicitly projected cloud-owned and supported newer cloud fields update.
- Partial payload omission is not interpreted as deletion.
- Same-ID events merge without duplicates or loss of local score context.
- Active-game evidence is not replaced by a poorer saved/cloud representation.
- A superseded or prior-account response cannot regress accepted local state,
  while a later legitimate request can apply.
- Focused and complete local regression pass, CI is green, and the exact final
  PR head receives an independent Level 3 review before merge.
- The R2 gate remains open.

#### Completion record

- Baseline: `origin/main` at
  `62ca4d46cbadf859546465144938d419f792bec9`, including merged R2-01 and R2-02.
- Runtime behavior: same-ID hydration now uses an explicit field policy,
  preserve-if-omitted mapping metadata, ID-based event merge, active-game-safe
  local precedence, and a monotonic request/account acceptance guard.
- Corrected R2-02 assertions: the former richer-local overwrite,
  poorer-partial-success hydration, and out-of-order response characterizations
  are now passing R2-03 behavior contracts. Unresolved R2 characterizations
  remain intact.
- Focused checks: R2 sync characterization `28/28`; local-storage safety
  `28/28`; event-operation service passed; tracked-time service `16/16`;
  tracked-time foundation `11/11`; tracked-time UI `44/44`; tracked-time
  manual scenarios `7/7`; cancel-game `33/33`; changed JavaScript syntax.
- Complete local regression: canonical-plus-additive `37 passed, 0 failed`.
- CI: portable regression and Docker test suite passed on the pushed
  implementation-and-record branch before independent-review handoff.
- Implementation commit:
  `aec4e30ef12e3dcc1c633d1e0a1d118f549857b9`.
- Production or external state changed: `NO`.
- `REPO_CURRENT_STATE.md` updated: `YES`.
- `docs/LaxHornet_Rollout_Checklist.md` updated: `YES`; only the bounded R2-03
  hydration items are complete and the R2 gate remains open.
- Review status: `NOT COMPLETE`. Independent Level 3 review must inspect the
  exact final draft-PR head after all corrections are pushed. Do not merge or
  deploy from this task.

### R2-04 — Add durable game and clock operation states

Status: `REVIEW`

Risk level: `LEVEL 3`

Branch: `feature/r2-04-durable-game-clock-operations`

Execution task: `Implement R2-04 — Add Durable Game and Clock Operation States`
(`019fb1f9-d65b-70c2-a53c-671411c6c909`)

Related document: `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`

#### Goal

Persist every cloud-bound legacy game write and tracked-clock write as a
recoverable current-account operation before its network attempt, without
changing server contracts, authorization, tombstones, or release state.

#### Operation contract

- Storage key: `laxhornet.syncOperations.v1`, scoped by the established
  `.user.<account-id>` account suffix and protected by the
  `game_clock_operation_state` storage-safety domain.
- Schema version: `1`.
- Operation fields: `operationId`, `operationType`, `accountId`, `gameId`,
  `deviceId`, `coalescingKey`, `createdAt`, `updatedAt`, `attemptCount`,
  `lastAttemptAt`, `nextAttemptAt`, `state`, `payload`, `payloadHash`,
  `payloadRevision`, `baseRevision`, `lastError`, and `receipt`.
- Lifecycle: `pending`, `syncing`, `accepted`, `retryable`, `rejected`, and
  `conflicted`. A stale stored `syncing` operation normalizes to immediately
  replayable `retryable` work.
- The domain supports structural validation, legacy-array normalization,
  staged writes, validated backup, bounded quarantine, future-version
  preservation/write blocking, and bounded accepted acknowledgments.

#### Behavior

- Legacy game writes coalesce to one outstanding `legacy_game_write` per game.
  A later payload retains the permanent operation ID, increments
  `payloadRevision`, and returns to `pending`; an older in-flight acceptance
  acknowledges only its exact hash/revision and cannot clear the newer payload.
- Tracked-clock writes use `tracked_clock_write` records. Exact duplicate
  command payloads coalesce, while initialize/start/pause/resume/period/end or
  other payload changes retain distinct logical operation IDs. Clock updates
  retain their base revision and stale-revision responses remain
  `conflicted`.
- Game acceptance requires successful completion of the queued PostgREST
  upsert and records a bounded request-success receipt. Clock acceptance
  requires an accepted RPC result, a matching returned clock state, and a
  valid returned server revision. The receipt is persisted before accepted
  operation compaction.
- Network, timeout, service, and rate-limit failures remain `retryable` with
  attempt count, last-attempt time, next-attempt time, and exponential backoff
  bounded from two seconds to five minutes. Authorization/validation-style
  failures remain `rejected`; conflicts remain `conflicted`. Offline state
  creates no attempt, and one processor serializes current-account work.
- Startup, sign-in, reconnect, and manual sync process the current account
  only. Signed-out state is not migrated into an account namespace.
- Queue payloads, receipts, errors, and retry metadata stay outside Live Share,
  recap, CSV, analytics, and private game export shapes. The existing Trust
  Spine event-operation namespace and its server semantics are unchanged.

#### Scope boundaries and known limitations

- No SQL, migrations, RLS, grants, RPC signatures, authorization policy,
  server deduplication, tombstones, game-field versions, conflict UI, release
  markers, deployment, or production state changes.
- Legacy game PostgREST upserts do not return or deduplicate the local
  operation ID. A successful response proves request completion, but an
  accepted response lost in transit can be replayed; R2-04 therefore does not
  claim server-side exactly-once execution.
- Clock RPC revisions detect stale writes, but the current RPCs likewise do
  not accept the new local operation ID. R2-05 and later tickets still own the
  full authorization taxonomy, field-level conflict resolution, namespace
  migration, durable tombstones, and truthful user-facing sync/conflict UI.

#### Acceptance and completion record

- Baseline: `origin/main` at
  `5f442b9f009eda644bbdb9892a6e05092e2cb608`, including merged R2-01 through
  R2-03.
- Focused durable-operation assertions: `24/24`, including both integrated
  failure-refresh-replay-acknowledgment-cleanup journeys.
- R2 sync characterization: `28/28`; the former failed-clock-without-retry and
  refresh-loss assertions now bind to the separate durable operation domain.
- Local-storage safety: `28/28`; tracked-time service: `16/16`; existing event
  operation service contracts passed; changed JavaScript syntax passed.
- Complete local regression: canonical-plus-additive `38 passed, 0 failed`,
  including tracked-time browser `33/33`, secure-disclosure browser `73/73`,
  Product Alignment browser `64/64`, Trust Spine SQL acceptance/rollback,
  cancel-game `33/33`, delete-permission, player-removal, disclosure, and
  release-containment gates.
- CI: portable regression, Docker test suite, and Vercel preview passed on the
  pushed branch before independent-review handoff. Supabase Preview skipped
  because R2-04 contains no database change.
- Implementation commit:
  `b0ebbbfb628377dff530805e4db9ea0daccadbeb`; draft PR #45.
- Production or external state changed: `NO`.
- `REPO_CURRENT_STATE.md` updated: `YES`.
- `docs/LAXHORNET_ROLLOUT_CHECKLIST.md` updated: `YES`; permanent local IDs,
  lifecycle states, and refresh/reconnect recovery are complete only for the
  R2-04 game/clock boundary. The overall R2 gate remains open.
- Review status: `NOT COMPLETE`. Independent Level 3 review must inspect the
  exact final draft-PR head after all corrections are pushed. Do not merge or
  deploy from this task.

### R2-05 — Separate authorization failures from retryable network failures

Status: `REVIEW`

Risk level: `LEVEL 3`

Branch: `feature/r2-05-sync-error-classification`

Execution task: `Implement R2-05 — Separate Authorization Failures from Retryable Network Failures`
(`019fb2fc-fa08-7a53-b927-2a3e6967f319`)

Related document: `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`

#### Goal

Give R2-04 durable legacy-game and tracked-clock operations one deterministic,
sanitized failure taxonomy so retryable transport faults remain replayable
while authentication, authorization, validation, capability, conflict, and
unknown permanent failures remain durable without ordinary automatic retry.

#### Implemented taxonomy and transitions

- `retryable_transport` maps offline, browser fetch/timeout/connection
  failures, HTTP 408/429/5xx, and temporary service failures to `retryable`.
  A real request increments attempt metadata and receives bounded backoff;
  known offline state becomes retryable without creating a request, increment,
  or retry timer.
- `authentication_required` maps missing/expired/revoked sessions, HTTP 401,
  invalid JWT outcomes, and equivalent Supabase Auth failures to `rejected`.
- `authorization_denied` maps HTTP 403, SQLSTATE `42501`, RLS denial,
  `unauthorized`, `unauthorized_*`, wrong-scope, membership, and role failures
  to `rejected`.
- `validation_rejected` maps malformed or unsupported requests, invalid game
  or clock state, and non-capability HTTP 400/422 outcomes to `rejected`.
- `capability_unavailable` maps missing/stale RPC signatures, `PGRST202`,
  schema-cache mismatch, missing backend functions, and undeployed capability
  outcomes to `rejected`.
- `conflict` maps HTTP 409, stale revision, explicit conflict, and clock
  acknowledgment mismatch to `conflicted`; `stale_clock_revision` remains the
  precise retained code where supplied.
- `unclassified_rejection` is the fail-closed result for an unknown permanent
  failure. Unknown failures do not default to retryable.
- Rejected and conflicted operations retain their operation ID, account/game
  scope, payload, payload revision, base revision, prior applicable receipt,
  and sanitized evidence. They receive no ordinary next-attempt time.

#### Classification and evidence contract

The shared classifier returns:

`outcome`, `category`, `code`, `message`, `httpStatus`, `retryable`,
`attentionRequired`, `source`, and safe `sourceCode`.

Persisted `lastError` is bounded to:

`category`, `code`, canonical `message`, `httpStatus`, `classifiedAt`,
`source`, and safe `sourceCode`.

Original server messages, details, hints, response bodies, request payloads,
tokens, headers, stack traces, and private/player/family text are not persisted
inside the error record.

#### Authentication recovery and boundaries

- Losing the active session rejects the loaded account's pending/syncing/
  retryable durable work without incrementing attempts, then switches storage
  namespaces.
- Signed-out state processes no account operation.
- A successful explicit sign-in or manual cloud-sync action can reclassify
  only that signed-in account's `authentication_required` rejections to
  `pending`; another account cannot recover or execute them.
- Authorization, payload scope, RLS, roles, RPC signatures, and Trust Spine
  event-operation semantics are unchanged.
- Queue classifications and metadata remain excluded from Live Share, public
  recap, CSV, analytics, normal exports, and private game backup.

#### Characterization updates

- The former broad legacy authorization/network ambiguity assertion is now a
  passing R2-05 deterministic taxonomy contract.
- Transient global sync copy, Trust Spine rejection removal, participation
  batch classification, tombstones/stale resurrection, RLS-invisible deletion,
  server game deduplication, field-level conflicts, signed-out namespace
  migration, cross-key transactionality, repeated-capture identity, and
  visible sync/conflict UI remain explicitly unresolved.

#### Acceptance and completion record

- Baseline: `origin/main` at
  `229face02c14dec3ee134c860d4516ebcfaa1ce3`, including merged R2-01 through
  R2-04.
- Implementation commit:
  `0a12565b1e4723986c26c36964540b049b51390e`.
- Draft pull request: #46.
- Focused classifier assertions: `22/22`; durable game/clock assertions:
  `29/29`; sync characterization: `29/29`; local-storage safety: `28/28`;
  tracked-time service: `16/16`; event-operation and game-scope contracts
  passed.
- Secure-disclosure activation: `20/20`; signed-in secure-disclosure browser:
  `73/73`, with no hosted Supabase request and no browser/page error.
- Complete local regression: canonical-plus-additive `39 passed, 0 failed`.
- Changed JavaScript syntax and `git diff --check`: passed.
- CI: portable regression, Docker test suite, and normal preview checks are
  required on the final draft-PR head.
- Known limitations: legacy game and clock RPCs still lack server receipt
  deduplication for the local operation ID; no durable tombstones, field-level
  conflict resolution, signed-out namespace migration, sanitized journal, or
  user-facing sync/conflict UI is added. Trust Spine and participation
  operation behavior remains governed by its existing contracts.
- Production or external state changed: `NO`.
- `REPO_CURRENT_STATE.md` updated: `YES`.
- `docs/LAXHORNET_ROLLOUT_CHECKLIST.md` updated: `YES`; classification is
  complete only for the R2-05 durable legacy-game/tracked-clock boundary. The
  overall R2 gate remains open.
- Review status: `NOT COMPLETE`. Independent Level 3 review must inspect the
  exact final draft-PR head after all corrections are pushed. Do not merge or
  deploy from this task.

### R2-06 — Add durable tombstones and prevent stale-device resurrection

Status: `REVIEW`

Risk level: `LEVEL 3`

Branch: `feature/r2-06-durable-game-tombstones`

Execution task: `Implement R2-06 — Add Durable Tombstones and Prevent Stale-Device Resurrection`
(`019fb341-0d54-7b82-8a14-e5bb6f8d811e`)

Related document: `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md`

#### Selected model and recreation policy

- A dedicated private `legacy_game_tombstones` table retains one durable row
  per deleted legacy game after the corresponding `games` row is physically
  removed. This is safer than adding soft-delete fields to the wide legacy
  game row: authorization evidence survives removal without retaining or
  exposing a partially deleted game payload, and existing game/public
  projections do not need new deleted-row filtering.
- Policy A applies: a tombstoned game ID is permanent and cannot be reused.
  Product recreation creates a new game ID. There is no restoration RPC, UI,
  or implicit restore through an ordinary upsert.
- Auth-user identifiers are retained as UUID scope evidence without
  `auth.users` foreign keys so the tombstone cannot block account lifecycle.
  Team and roster references may become null under their existing deletion
  behavior, while the permanent game-ID guard remains.

#### Local operation and ordering contract

- `laxhornet.syncOperations.v1` now contains private account-scoped tombstones
  plus a `legacy_game_delete` operation. The deletion ID is also the permanent
  operation ID. Its stored fields are the account, game, device, deletion
  timestamp, known game `saved_at`, creation/update timestamps, payload hash
  and revision, attempt metadata, lifecycle state, bounded error, and receipt.
- Local deletion intent and its operation are written in one storage-domain
  update before the game is hidden. A persistence failure leaves the game
  visible. Delete work is asynchronous; retry, refresh, reconnect, and
  repeated processing retain the same deletion ID.
- A proven local-only game uses a retained accepted local tombstone and no
  server request. Proof requires no cloud row identity/evidence and no accepted
  or unresolved cloud-write record. Ambiguous visibility creates durable
  server delete protection.
- Creating a delete marks older same-game writes `superseded`; they are
  retained as non-processing evidence. Delete work is selected before writes.
  An older in-flight write response remains superseded and cannot acknowledge
  away, compact, or clear the tombstone.
- The server rejects an older delete if the current game `saved_at` is newer
  than the deleting client's known timestamp. Once accepted, the tombstone
  permanently wins for that game ID. Same deletion-ID replay is accepted and
  identified as replay; a different deletion ID conflicts.

#### Server, authorization, and hydration contract

- Migration `20260730134439_durable_game_tombstones.sql` adds the tombstone
  table, constraints, indexes, RLS/FORCE RLS, minimum grants, a non-exposed
  write-guard trigger, guarded `laxhornet_sync_game(jsonb)`, and transactional
  `laxhornet_delete_game_durable(jsonb)`. The legacy delete RPC is retained but
  now creates durable evidence. Direct authenticated table deletion is
  revoked.
- The durable delete RPC serializes competing deletes for one game ID, checks
  the signed-in account and the existing owner/reviewer/player-tracking scope,
  inserts the tombstone and removes the game in one transaction, and returns a
  deterministic accepted/replayed/conflicted/rejected result. It does not add
  a role or broaden Team Admin authority.
- Authenticated clients can select only tombstones already within their
  existing owner, platform-reviewer, or player-tracking scope. Anonymous and
  public access is absent; direct client insert, update, and delete are absent.
- Cloud loading retrieves and merges authorized tombstones before any queued
  game upload, applies account and request-generation guards, hydrates games,
  then rechecks tombstones before the final merge. Either response order ends
  deleted. A tombstone-read failure aborts upload/merge rather than guessing.
  A missing or RLS-invisible game row alone is never deletion evidence.
- Tombstones, deletion IDs, queue state, errors, revisions, and receipts stay
  out of Live Share, public payloads, family recap, CSV, analytics, ordinary
  exports, URLs, logs, and private game backups.

#### Migration, rollback, and verification

- Rollback guidance is
  `supabase/rollback/20260730134439_durable_game_tombstones_rollback.sql`.
  Before activation it reverses the empty additive schema. After any tombstone
  exists it refuses destructive reversal: application rollback must retain the
  table, trigger, guarded writes, and legacy delete wrapper so old or rolled
  back clients cannot resurrect a deleted game.
- Synthetic pgTAP coverage is
  `supabase/tests/durable_game_tombstones.sql`; isolated PGlite behavioral
  validation covers authorization, replay, conflict, RLS invisibility,
  write-guard behavior, and rollback refusal/success. The migration has not
  been applied to a Supabase project.
- Focused tombstone assertions pass `29/29`; isolated migration/rollback
  assertions pass `11/11`; durable operations pass `29/29`; sync
  characterization passes `30/30`; R2-05 classification passes `22/22`;
  local-storage safety passes `28/28`; cancel/delete static coverage passes
  `33/33`; delete-RPC permissions pass `17/17`; Event Pipeline and Trust Spine
  focused contracts pass.
- Characterization now treats stale-device resurrection prevention and
  explicit tombstone hydration as desired behavior. Missing-row inference,
  field-level game conflicts, server-side non-delete write deduplication,
  signed-out namespace migration, cross-key transactionality, visible states,
  sanitized journal, production migration drift, and production RLS
  verification remain unresolved.

#### Acceptance and completion record

- Baseline: `origin/main` at
  `44f0510d3bde18f459e78f570efd27b72dc2a989`, including merged R2-01 through
  R2-05.
- Implementation commit:
  `de4de33e46f23dac3f9f6c52b02946ac8236fa62`.
- Draft pull request: #47.
- Complete local regression: canonical-plus-additive `41 passed, 0 failed`.
- Changed JavaScript syntax and `git diff --check`: passed.
- Final-head Docker, portable regression, Supabase Preview, and Vercel checks
  passed. Independent exact-PR-SHA Level 3 review remains required before
  merge.
- Production verification still requires a separately authorized
  nonproduction/production rollout task after migration review. Historical
  games hard-deleted before this migration have no trustworthy server-side
  ownership row from which this feature can synthesize a tombstone; the client
  correctly treats that absence as unknown rather than deletion.
- Production or external state changed: `NO`.
- `REPO_CURRENT_STATE.md` updated: `YES`.
- `docs/LAXHORNET_ROLLOUT_CHECKLIST.md` updated: `YES`; the R2 tombstone gate
  remains incomplete until exact-SHA independent review, and production
  application remains separately incomplete.
- Review status: `NOT COMPLETE`. Do not merge, deploy, or apply the migration
  from this task.

### R2-06-REL — Activate durable legacy-game tombstones in production

Status: `BLOCKED`

Risk level: `LEVEL 3`

Branch: `release/r2-06-durable-game-tombstones`

Execution task: `Execute the R2-06 Durable Game Tombstones production activation and release`
(`019fb379-0c66-76c1-bed2-cd037ab70e8c`)

Owner approval: David explicitly authorized an immediate application-only
rollback to
`44f0510d3bde18f459e78f570efd27b72dc2a989` on 2026-07-30. That authorization
did not authorize a production migration, database rollback, Supabase change,
synthetic-data creation or cleanup, P1 remediation, or any other production
mutation.

#### Exact release inputs and targets

- Reviewed feature head:
  `c1ab1bd2c6877abfd6d4683204dc19a753b1ec58`.
- Squash merge and proposed runtime source:
  `18f5157de159fa7a27b3cefb4c90f5148c3b230d`.
- `origin/main` was exactly the squash merge at preflight; no later commit was
  included.
- Migration:
  `supabase/migrations/20260730134439_durable_game_tombstones.sql`;
  SHA-256
  `138e8edfdaa4b48747ceb63a66a0eae76f91c832b19dffa52914bdea45188900`.
- Pre-activation rollback:
  `supabase/rollback/20260730134439_durable_game_tombstones_rollback.sql`;
  SHA-256
  `405d0b10370cbcc90aa474f469d9841a5bc56a96453094561cb8a2386dd1545b`.
- pgTAP:
  `supabase/tests/durable_game_tombstones.sql`; SHA-256
  `23f4abe853acf82817690b296c5dcf29947f500ded5721e88f5e04f83dea778f`.
- Intended database target: production project
  `ulbmjcvnyznvmjgpstno`.
- Runtime target:
  `https://laxhornet.mybranford.com/` through the allowlisted Pages workflow.
- Required order remains recovery readiness, migration application,
  schema/RLS/grant/RPC/trigger verification, exact runtime deployment,
  synthetic production smoke, stale-device/mixed-client verification,
  cleanup, and closeout.

#### Authorization, rollback, smoke, and cleanup boundaries

- Tombstone reads must remain authenticated and limited to existing
  owner/platform-reviewer/player-tracking authority. Anonymous access, direct
  authenticated tombstone writes, direct authenticated game deletes, private
  trigger-function execution, and any Team Admin authority expansion remain
  prohibited.
- Before any accepted tombstone, the reviewed rollback may reverse only the
  empty additive schema. After any tombstone exists, application rollback must
  retain the tombstone table and rows, write guard, guarded write RPC, and
  durable legacy delete wrapper. Never bypass the rollback refusal.
- Production smoke must use synthetic accounts and games only and cover
  same-ID replay, different-ID conflict, newer-server-revision conflict,
  stale-client rejection, both hydration response orders, refresh/retry,
  account isolation, old/new clients, offline capture, and minimum-necessary
  disclosure.
- Remove mutable synthetic records and temporary authority after smoke.
  Retain only inert, non-identifying tombstone evidence that cannot safely be
  removed, with its synthetic identifier and retention reason documented.

#### Preflight blockers

- A late automated exact-head review, posted after the independent PASS and
  squash merge, identified two unresolved P1 defects on
  `c1ab1bd2c6877abfd6d4683204dc19a753b1ec58`:
  1. `laxhornet_sync_game(jsonb)` does not acquire the durable delete RPC's
     per-game advisory lock. A concurrent write can pass both tombstone checks,
     wait for the deleting transaction, and recreate the game after the
     tombstone commits.
  2. `confirmDeleteGame` persists per-event delete markers before the durable
     game outcome is known, while `flushDeletedCloudRecords` processes events
     first. A `newer_game_revision` game-delete conflict can therefore retain
     the newer game but delete its events on the next hydration.
- Existing focused tests passed `29/29` client contracts and `11/11` isolated
  migration checks, but neither suite exercises these two adversarial paths.
- The v284 manifest validator passes its existing contract, but
  `release/laxhornet-release-manifest.json` does not register R2-06, does not
  include its three reviewed hashes in a release package, stops the reviewed
  migration sequence at `20260730004700`, and declares no pending production
  migration.
- The canonical production preflight failed because it requires clean `main`
  and the existing tooling is bound to the earlier v284 release identity. The
  release worktree itself was clean.
- The specifically required `supabase_production_readonly-2` connection was
  not callable in this task. No generic Supabase connector was substituted, so
  production migration and catalog state remain unverified.
- Full canonical-plus-additive regression, production schema verification,
  synthetic database verification, production smoke, compatibility testing,
  disclosure testing, and cleanup were not run after these fail-fast blockers.

#### Existing production runtime state

- The `main` push auto-triggered allowlisted Pages run
  `30552229360`, which completed successfully from
  `18f5157de159fa7a27b3cefb4c90f5148c3b230d` before this release preflight.
- Public HTTP byte verification confirmed that production `app.js`,
  `event-operation-service.js`, `app.html`, and `service-worker.js` exactly
  match their Git blobs at that blocked source.
- The previous successful pre-R2-06 allowlisted Pages artifact is source
  `44f0510d3bde18f459e78f570efd27b72dc2a989`, run `30547712272`.
- The application-only rollback superseded that runtime as recorded below.

#### Authorized application-only rollback

- Authorization: immediate application/runtime rollback only; no Supabase,
  migration, database rollback, production-data, or P1-remediation action.
- Pre-rollback deployed source:
  `18f5157de159fa7a27b3cefb4c90f5148c3b230d`, Pages run `30552229360`.
- Rollback source:
  `44f0510d3bde18f459e78f570efd27b72dc2a989`, the merged R2-05 commit and
  direct parent of R2-06.
- Rollback workflow:
  `30554377617`; result `success`; completed
  `2026-07-30T14:59:18Z`.
- The workflow checked out the exact approved source, verified main ancestry,
  validated the v284 release identity and custom domain, ran all 21 Pages
  deployment safety contracts, built and validated the affirmative allowlist,
  deployed the artifact, and passed the production-boundary verification job.
- The authoritative workflow manifest records 47 files, 6,221,926 bytes,
  allowlist version `2026-07-29`, release `v284`, and exact source
  `44f0510d3bde18f459e78f570efd27b72dc2a989`.
- Independent public verification matched all 46 served files byte-for-byte
  to that workflow manifest. `CNAME` is the forty-seventh allowlisted artifact
  entry and is the non-served custom-domain configuration file.
- `TICKETS.md`, the R2-06 migration path, this review-evidence path, and
  `.git/config` each returned HTTP 404 from production.
- Read-only production smoke loaded the landing page and app without console
  warnings or errors, restored the existing authenticated session, navigated
  normally to Past Games, and confirmed 45 saved-game rows without reading
  game contents. No buttons that create, edit, share, sync, or delete data
  were used.
- Exact-source inspection and live byte identity establish that the rollback
  runtime contains no reference to `public.legacy_game_tombstones`,
  `public.laxhornet_sync_game(jsonb)`, or
  `public.laxhornet_delete_game_durable(jsonb)`.
- Public-event semantic and v284 team-authorization boundary contracts passed.
  The general minimum-disclosure suite was not recorded as a full pass:
  39/40 checks passed and its release-hygiene assertion expected a coordinated
  service-worker/version delta that R2-05 does not contain.
- No Supabase schema, function, trigger, RLS, grant, configuration, Auth, or
  data change occurred. No production record was created, modified, or
  deleted. The R2-06 migration was not applied by this task, and the database
  rollback was not run.
- R2-06 remains `BLOCKED`; this rollback is not production activation.

#### Required remediation and approval gates

1. Keep R2-06 activation stopped. Do not apply the current migration.
2. Preserve the completed application-only rollback at
   `44f0510d3bde18f459e78f570efd27b72dc2a989`. Do not remove or roll back
   database tombstones if production inspection later proves any exist.
3. Serialize guarded game writes with durable deletes and add a real concurrent
   write/delete regression.
4. Prevent event-delete markers from deleting events after a durable
   game-delete conflict and add an end-to-end conflict regression.
5. Update the release manifest/tooling for the reviewed R2-06 package and
   exact migration sequence.
6. Obtain a new exact-SHA independent Level 3 review and green CI.
7. Restore the named production read-only connection, verify migration/catalog
   state and recovery readiness, and obtain David's explicit production
   authorization before resuming the migration-first release sequence.

Evidence:
`review-evidence/r2-06-durable-game-tombstones-release/PREFLIGHT_BLOCKED.md`.

## Ticket template

Use this section when a ticket is required or useful. Keep Level 2 tickets
concise. Include the critical-surface fields for Level 3.

### LH-XXX — Descriptive title

Status: `PROPOSED`

Risk level: `LEVEL 2 / LEVEL 3`

Branch: `feature/...`

Owner:

Related decision/design document:

#### Goal

State the user-visible or engineering outcome in one paragraph.

#### In scope

- Exact behaviors, screens, modules, tables, or flows included.

#### Out of scope

- Related work that must not be changed by this ticket.

#### Current behavior

Describe what the inspected repository does today. Cite file names and functions where useful.

#### Requirements

- Functional requirements.
- Add offline/local-first, authorization, disclosure, data/migration, release,
  or feature-flag requirements only when they apply.

#### Acceptance criteria

- Observable, testable completion conditions.

#### Expected files

- List likely files, but require Codex to verify before editing.

#### Verification plan

```powershell
# Focused commands first

# Level 1 and Level 2 use CI for broader regression by default.
# Run once after the final diff stabilizes for Level 3:
node tools/run_v283_local_regression.mjs
```

#### Level 3 critical surface and rollback

Omit this section for Level 2.

- Critical surface triggered.
- Data, authorization/privacy, offline/sync, or release/cache risk.
- Rollback or recovery strategy.
- Exact-PR-SHA independent review requirement.
- Separate release or production authority, if any.
- Evidence-package requirement when this is a migration, production release,
  security incident, or disclosure incident.

#### Completion record

Commit/PR:

Files changed:

Focused checks:

Broad checks or CI:

Known limitations:

Production or external state changed:

`REPO_CURRENT_STATE.md` updated: `YES/NO/NOT REQUIRED`

Remaining work:

Add rollout-checklist fields only when the approved ticket changes a rollout
work package, milestone, gate, blocker, release, production state, or existing
checklist item, or adds a newly approved roadmap item.

## Standard Codex execution prompt

Use this default prompt for Level 1, Level 2, or Level 3 implementation:

```text
Implement the requested LaxHornet change.

Read AGENTS.md, the relevant ticket or task description, and only the files needed for this change. Classify the work as Level 1, Level 2, or Level 3 under docs/CODEX_WORKFLOW.md.

Give a plan of no more than five bullets, then proceed immediately unless the task triggers Level 3 approval requirements, conflicts with the repository, or requires scope expansion.

Make the smallest coherent change. Run focused checks during implementation. Use CI for broader regression on Level 1 and Level 2 work. Run the full local regression once after the final diff stabilizes for Level 3 work.

You may create a branch, commit, push, and open a draft PR. Do not merge, deploy, apply migrations, modify production, change release settings, or invoke write-capable external connectors without explicit authorization.

Finish with the concise closeout required for the risk level.
```
