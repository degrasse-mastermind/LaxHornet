# LaxHornet Agent Instructions

## Repository identity

- LaxHornet is the lacrosse-specific product and deployed codebase within the broader MethodNorth system.
- Keep LaxHornet and MethodNorth connected but distinct. This repository owns lacrosse implementation, data models, UX, testing, deployment configuration, and product operations.
- Do not present MethodNorth as legally cleared, publicly launched, or ready for external commercial use.

## Actual technology stack

- Static, mobile-first, offline-first PWA.
- Plain HTML, CSS, and JavaScript. Do not migrate the app to React, Next.js, TypeScript, Vite, or another framework unless a separately approved architecture ticket requires it.
- Primary runtime files include `index.html`, `app.html`, `app.js`, `styles.css`, `service-worker.js`, `manifest.json`, `runtime-config.js`, and focused JavaScript modules.
- Local game state is written immediately to `localStorage`; Supabase provides optional Auth, Postgres/RLS, RPC, Realtime, cloud synchronization, and Edge Functions.
- Static deployment is from the `main` branch repository root through GitHub Pages and the custom domain.

## Required orientation before work

1. Read `AGENTS.md`, the relevant ticket or task description, and only the code and documentation needed for the change.
2. Inspect `git status`, the current branch, and the actual files involved.
3. Classify the work as Level 1, Level 2, or Level 3 under `docs/CODEX_WORKFLOW.md`.
4. Verify existing behavior, give a concise plan of no more than five bullets, and proceed immediately unless a Level 3 approval requirement, repository conflict, stop condition, or required scope expansion appears.

## Ticket discipline

- Use the lightest process appropriate to the actual risk.
- Level 1 work does not require a formal ticket or a task ID in `TICKETS.md`.
- Level 2 work requires a concise ticket or PR-ready task description.
- Level 3 work requires one approved ticket and independent exact-PR-SHA review before merge.
- Make the smallest coherent change that satisfies the acceptance criteria.
- Do not modify unrelated features, redesign established flows, or perform opportunistic cleanup outside the ticket.
- Preserve existing behavior unless the ticket explicitly authorizes a change.
- Prefer feature flags or staged activation when a change affects production data, sharing, authorization, synchronization, or release behavior.
- Update `TICKETS.md` only for work that has a ticket.
- Update `REPO_CURRENT_STATE.md` only when durable architecture, production behavior, release controls, or major verification capabilities change.

## Thread and task lifecycle

- Use ChatGPT workbenches for product discussion, ticket shaping, project indexing, and status synthesis. They are not implementation records.
- Level 1 work may move from request through draft pull request in one Codex task without a formal ticket.
- Use one primary Codex task through the draft pull request for Level 2 and Level 3 implementation.
- A separate review task is optional for Level 2 and may be used for the required independent Level 3 review.
- Keep the actual branch, worktree, commit, pull request, tests, and durable evidence in the repository and GitHub. A thread title, pin, or summary is navigation metadata only.
- Task naming, pin management, and archival are optional workspace hygiene, not engineering completion gates.
- Follow the risk-based planning, testing, review, authority, and closeout rules in `docs/CODEX_WORKFLOW.md`.

## Supabase and data safety

- Treat the existing Supabase project as production-connected.
- The project-scoped Supabase MCP configuration is read-only. Never use MCP to apply migrations, deploy functions, alter production data, or change configuration.
- An authorized pull request may trigger the configured GitHub integration to
  apply repository migrations automatically to a temporary Supabase Preview
  branch. Treat that as allowed CI verification only when the branch is
  isolated from production, contains no copied production data, uses separate
  credentials, changes no production migration history, performs no production
  deployment, follows the pull-request lifecycle, and retains no secrets in
  evidence. Report it as
  `AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION — ACCEPTED CI VERIFICATION`.
  This does not authorize local/manual application, Supabase CLI application to
  a linked main or production project, Dashboard application, persistent shared
  environments, migration-history repair, deployment/activation, production
  data, or production credentials.
- Database changes must be represented by reviewed, timestamped SQL files under `supabase/migrations/`, with rollback or recovery documentation when appropriate.
- Preserve migration provenance and the release manifest. Never rewrite or reorder historical migrations.
- Never place service-role keys, database passwords, access tokens, refresh tokens, private JWTs, or other secrets in browser code, committed files, prompts, logs, fixtures, screenshots, or evidence packages.
- Browser code may use only the intended public/publishable Supabase configuration and must rely on RLS and narrowly scoped RPCs.
- Maintain least-privilege RLS and explicit public-sharing allowlists.
- Do not use real child-sensitive information in test data, fixtures, examples, or screenshots.

## Offline-first and release constraints

- A successful change must preserve local game tracking when connectivity is absent or unreliable.
- Do not replace immediate local persistence with a network-dependent flow.
- Preserve service-worker registration, offline caching, install behavior, update handling, and the static-hosting path structure.
- Release markers are coordinated. Do not change `version.json`, service-worker cache names, script query versions, or `release/laxhornet-release-manifest.json` unless the ticket is explicitly a release ticket.
- For Level 1 and Level 2 work, and Level 3 implementation unless explicitly restricted, Codex may create a feature branch, edit within scope, run checks, commit, push, and open or update a draft pull request.
- Do not merge, deploy, apply migrations, mutate production, change GitHub Pages settings, invoke write-capable external connectors, or publish a release without explicit authorization.

## Quality gates

Run affected-surface checks rather than universal broad testing.

Common commands:

```powershell
python -m http.server 5173
node tools/test_event_operation_service.mjs
node tools/test_game_scope_capabilities.mjs
node tools/run_v283_local_regression.mjs
```

Also:

- Run `node --check` on changed JavaScript files.
- Run `git diff --check` before presenting the final diff.
- Add or update focused tests when behavior changes.
- Use CI for broader regression by default on Level 1 and Level 2 work.
- Run the complete local regression once after the final diff stabilizes for Level 3 work. Rerun it only when a subsequent change materially affects shared behavior.
- Do not run unrelated database, release, disclosure, service-worker, or deployment tests for isolated UI or documentation work.
- Do not add a production dependency without explaining why the existing stack cannot meet the requirement.
- Report failed or unavailable checks plainly; never claim a test passed without running it.

## Review output

Use the concise closeout in `docs/templates/CODEX_TASK_CLOSEOUT.md`. Add security, migration, disclosure, cleanup, and evidence fields only for Level 3 work when relevant.
