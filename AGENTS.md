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

1. Read `README.md`, `REPO_CURRENT_STATE.md`, and `TICKETS.md`.
2. Inspect `git status`, the current branch, and the actual files involved in the requested ticket.
3. Verify existing behavior before proposing changes. Do not invent routes, tables, fields, components, scripts, or architecture.
4. State the intended scope, affected files, risks, and verification plan before editing.

## Ticket discipline

- Work on one approved ticket at a time.
- Make the smallest coherent change that satisfies the acceptance criteria.
- Do not modify unrelated features, redesign established flows, or perform opportunistic cleanup outside the ticket.
- Preserve existing behavior unless the ticket explicitly authorizes a change.
- Prefer feature flags or staged activation when a change affects production data, sharing, authorization, synchronization, or release behavior.
- Update `REPO_CURRENT_STATE.md` and the relevant entry in `TICKETS.md` after completing a feature.

## Supabase and data safety

- Treat the existing Supabase project as production-connected.
- The project-scoped Supabase MCP configuration is read-only. Never use MCP to apply migrations, deploy functions, alter production data, or change configuration.
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
- Do not deploy, push database changes, merge to `main`, or publish a release without explicit authorization.

## Quality gates

Run the smallest relevant checks during development, then broader regression checks when the change can affect shared runtime behavior.

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
- Do not add a production dependency without explaining why the existing stack cannot meet the requirement.
- Report failed or unavailable checks plainly; never claim a test passed without running it.

## Review output

At the end of a ticket, report:

1. What changed.
2. Files changed.
3. Tests run and results.
4. Data, authorization, offline, and release risks.
5. Remaining work or unresolved questions.
6. Whether `REPO_CURRENT_STATE.md` and `TICKETS.md` were updated.
