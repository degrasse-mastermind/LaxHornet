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
