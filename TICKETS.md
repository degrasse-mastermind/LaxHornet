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

Status: `READY`
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

- Pull requests rely on manually reported local verification.
- Existing repository scripts already cover JavaScript syntax, event-operation contracts, game-scope capabilities, release-manifest validation, containment and hygiene, minimum disclosure, secure disclosure, Product Alignment, Trust Spine contracts, selected embedded database checks, Python permission/cleanup checks, secret scanning, and `git diff --check`.
- `tools/run_v283_local_regression.mjs` is the current broad local entry point, but Codex must inspect it and determine which checks are portable to GitHub-hosted runners before selecting the CI command set.

#### Requirements

- Workflow events: `pull_request` and `workflow_dispatch` only.
- Permissions must default to read-only repository contents unless a documented check requires something narrower and still non-mutating.
- The workflow must not use repository or environment secrets.
- The workflow must not deploy, push, publish, merge, create Supabase branches, or call remote production services.
- Pin official GitHub Actions to stable major versions and document runtime versions.
- Use dependency caching only when the repository actually has a lockfile or deterministic dependency source.
- Commands must fail the job on test failure and make the failing test identifiable.
- A documentation-only PR should still run the lightweight checks unless path filtering is explicitly justified and tested.

#### Acceptance criteria

- A workflow file exists under `.github/workflows/` and is valid YAML.
- The workflow runs on pull requests and manual dispatch.
- The workflow uses existing LaxHornet test scripts rather than creating a parallel test framework.
- No production deployment or remote Supabase mutation is possible from the workflow.
- No secrets are required.
- The job output clearly identifies each failed command or test group.
- The workflow passes on its own pull request, or any runner incompatibility is documented and resolved without weakening existing safety controls.
- `TICKETS.md` and `REPO_CURRENT_STATE.md` are updated with durable completion facts before merge.

#### Expected files

- `.github/workflows/laxhornet-regression.yml` or a similarly clear workflow name.
- `TICKETS.md`.
- `REPO_CURRENT_STATE.md` only if CI becomes a durable repository capability.
- Existing test scripts only when a narrowly scoped portability fix is necessary and behavior remains unchanged.

#### Verification plan

```powershell
# Local review
Get-Content .github\workflows\laxhornet-regression.yml
git diff --check

# Existing focused or broad checks selected after repository inspection
node tools/run_v283_local_regression.mjs
```

Also verify the GitHub Actions run on the pull request and a manual `workflow_dispatch` run before marking the ticket `DONE`.

#### Risks and rollback

- Risk: CI may rely on tools or services available locally but absent on GitHub-hosted runners.
- Risk: the broad regression runner may contain release-state assumptions that require a portable subset or explicit environment setup.
- Risk: overly broad workflow permissions or secret usage would create unnecessary supply-chain exposure.
- Rollback: remove or disable the single workflow file; no runtime, database, or production rollback should be required.

#### Completion record

Commit/PR:  
Files changed:  
Tests and results:  
`REPO_CURRENT_STATE.md` updated: `YES/NO`  
Remaining work:

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
