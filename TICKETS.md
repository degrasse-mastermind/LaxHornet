# LaxHornet Technical Tickets

This file is the active, reviewable work queue for Codex. Work on one approved ticket at a time. Product brainstorming and broad planning belong in ChatGPT; only sufficiently defined implementation work belongs here.

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

Status: `REVIEW`
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
- v284 local disclosure-fixture repair: a distinct disposable local project now uses fail-closed direct-Postgres prerequisite seeding without changing production grants, RLS, migrations, or runtime code. Guard tests passed 16/16, phase-aware containment passed 33/33 including deliberate fixture-SQL rejection, the complete local disclosure lifecycle passed, and the expanded regression passed 32/32 groups.
- PR #29 packages the local-only disclosure harness as a draft, test-only change. Its portable GitHub regression passed, and the production preflight passed again on clean `main` at exact approved SHA `1221f418c1e005606d54c545148944f9ec69f132`. The PR remains unmerged, so the production synthetic disclosure lifecycle has not resumed.

#### Risks and rollback

- The foundation migration is present in production and the corrected synthetic team authorization gate passed. The local disclosure lifecycle is green and fully cleaned up, and the exact production preflight is green. PR #29 is still draft/unmerged. The v284 frontend is not yet deployed, and production public-disclosure plus browser-smoke gates remain pending; local tracking remains usable.
- A review browser that reaches a backend without the tracked-time RPCs fails soft to device-only tracking for that session; the local event gate remains authoritative and is unaffected by hosted capability availability.
- Running-clock recovery gaps longer than 30 seconds freeze and require review rather than inventing time.
- Feature rollback is the removal of the additive UI/service wiring before release. Accepted database history remains governed by the foundation's fail-closed rollback.

#### Completion record

Commit/PR: implementation commits through `76274fe`; pull request #25 merged as `fc9c079d69757cfc2667dea7e1dfcc56524dce56`.
Files changed: `app.html`, `app.js`, `styles.css`, `service-worker.js`, `tracked-playing-time-service.js`, `.github/workflows/laxhornet-regression.yml`, focused tests, review evidence, `TICKETS.md`, and `REPO_CURRENT_STATE.md`.
Evidence: `review-evidence/tracked-playing-time-ui/`
`REPO_CURRENT_STATE.md` updated: `YES`
Remaining work: complete public-disclosure verification, deploy the exact approved `main` frontend, run production browser smoke tests, and close final release evidence.

## Ticket template

Copy this section for each implementation ticket.

### LH-XXX — Descriptive title

Status: `PROPOSED`  
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
- Offline/local-first requirements.
- Authorization and disclosure requirements.
- Data/migration requirements.
- Release or feature-flag requirements.

#### Acceptance criteria

- Observable, testable completion conditions.

#### Expected files

- List likely files, but require Codex to verify before editing.

#### Verification plan

```powershell
# Focused commands first

# Broader regression when warranted
node tools/run_v283_local_regression.mjs
```

#### Risks and rollback

- Data risk.
- Authorization/privacy risk.
- Offline/sync risk.
- Release/cache risk.
- Rollback or disable strategy.

#### Completion record

Commit/PR:  
Files changed:  
Tests and results:  
`REPO_CURRENT_STATE.md` updated: `YES/NO`  
Remaining work:

## Standard Codex execution prompt

Use this pattern after a ticket reaches `READY`:

```text
Implement only [TICKET ID] from TICKETS.md.

First read AGENTS.md, REPO_CURRENT_STATE.md, TICKETS.md, and inspect the actual relevant code. Then provide a brief implementation plan naming the expected files, risks, and tests. Do not edit until the plan is internally consistent with the repository.

Stay strictly within the ticket's scope and acceptance criteria. Preserve the vanilla static PWA, offline-first behavior, authorization boundaries, disclosure rules, Supabase migration provenance, and release controls. Do not use host-managed connector actions, deploy, apply remote migrations, change production configuration, or merge to main unless the ticket explicitly authorizes that exact action.

After implementation, run the smallest relevant tests, then broader regression if warranted. Update REPO_CURRENT_STATE.md and the ticket completion record with durable facts. Finish with the diff summary, tests and results, risks, and unresolved items.
```
