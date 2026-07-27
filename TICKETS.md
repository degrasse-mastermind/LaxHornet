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

Status: `REVIEW`  
Branch: `chore/codex-project-configuration`

Goal:

Create repository-level instructions, current-state context, project-scoped Codex configuration, and a disciplined ticket workflow tailored to the actual LaxHornet codebase.

Acceptance criteria:

- Root `AGENTS.md` accurately describes the vanilla HTML/CSS/JavaScript offline PWA.
- `REPO_CURRENT_STATE.md` records the current architecture, release controls, Supabase boundaries, and verification entry points.
- `.codex/config.toml` selects a current capable model, uses safe local approvals, and scopes Supabase MCP to the LaxHornet project in read-only mode.
- Supabase MCP migration writes are disabled.
- This ticket file contains a reusable implementation template.
- No production code, release marker, migration, deployment, or database state is changed.

Verification:

- Review all four configuration files against the repository.
- Confirm Codex trusts the project and reports the loaded instruction/config sources.
- Confirm `/mcp` shows the project-scoped Supabase server after OAuth authentication.
- Confirm the Supabase MCP cannot apply migrations.

### LH-DEV-002 — Establish local Supabase CLI workflow

Status: `PROPOSED`

Goal:

Verify that the committed `supabase/` directory can reproduce the intended schema locally without touching the linked production project.

Required safeguards:

- Use Docker-compatible local infrastructure.
- Use explicit local flags where supported.
- Do not run `supabase db reset --linked`.
- Do not run `supabase db push`.
- Do not repair remote migration history without a separately approved release ticket.

Candidate acceptance criteria:

- Supabase CLI version is recorded.
- Local stack starts successfully.
- Existing migrations are inspected in their required order.
- Local reset/migration verification results are documented.
- Any drift or provenance issue is reported without changing production.

### LH-DEV-003 — Create a non-production Supabase development target

Status: `PROPOSED`

Goal:

Create a safe Supabase development project or branch so Codex can eventually test authorized database writes without access to production data.

Candidate acceptance criteria:

- Development environment contains synthetic data only.
- Environment identifiers and purpose are documented without committing secrets.
- Production and development targets are unmistakably separated.
- Write-capable MCP is scoped only to the development target.
- Tool approvals remain enabled for mutations.
- Promotion to production still occurs only through reviewed migration files and release procedure.

### LH-DEV-004 — Add GitHub Actions regression checks

Status: `PROPOSED`

Goal:

Run appropriate existing LaxHornet regression checks automatically on pull requests without changing GitHub Pages deployment behavior.

Candidate acceptance criteria:

- Workflow runs on pull requests and manual dispatch.
- Workflow uses existing repository test scripts rather than inventing a second test system.
- No production deployment occurs from the workflow.
- Secrets are not required for ordinary static/runtime checks.
- Results clearly identify failed checks.

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

Stay strictly within the ticket's scope and acceptance criteria. Preserve the vanilla static PWA, offline-first behavior, authorization boundaries, disclosure rules, Supabase migration provenance, and release controls. Do not deploy, apply remote migrations, change production configuration, or merge to main.

After implementation, run the smallest relevant tests, then broader regression if warranted. Update REPO_CURRENT_STATE.md and the ticket completion record with durable facts. Finish with the diff summary, tests and results, risks, and unresolved items.
```
