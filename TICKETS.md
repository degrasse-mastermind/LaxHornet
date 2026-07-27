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

Status: `REVIEW`
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
- GitHub Actions is required to be green before merge.

#### Risks and rollback

- Participation history may include child-associated game/player identifiers and is private by default.
- Clock recovery can be marked `estimated` or `needs_review`; uncertain elapsed time is not silently invented.
- The rollback refuses to destroy accepted participation history. Review/export and an explicit disposal decision are required before destructive rollback.
- Future UI integration must preserve immediate local persistence and must not expose tracked time through public Live Share, recap, or default CSV.

#### Completion record

Commit/PR: draft pull request to be recorded after publication.
Evidence: `review-evidence/tracked-playing-time-foundation/`
`REPO_CURRENT_STATE.md` updated: `YES`
Remaining work: reviewer approval, green CI, signed-in browser/device validation during the later UI ticket, and separately authorized production migration/deployment.

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
