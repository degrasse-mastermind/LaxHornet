# LaxHornet Codex Workflow

This is the operating procedure for using ChatGPT, Codex, Git, GitHub, and Supabase without allowing any one tool to become the undocumented source of truth.

## Responsibility map

### ChatGPT: product architect and decision partner

Use the LaxHornet project in ChatGPT for:

- Product requirements and feature definition.
- Lacrosse-domain reasoning and analytics design.
- User flows, wireframes, disclosure decisions, and acceptance criteria.
- Converting approved decisions into one implementation ticket.
- Reviewing Codex reports, diffs, screenshots, and unresolved tradeoffs.

ChatGPT project conversations do not replace committed repository documentation. Durable implementation instructions must end up in `AGENTS.md`, `REPO_CURRENT_STATE.md`, `TICKETS.md`, or a focused design document.

### Codex: local implementation and verification

Use Codex with the local repository folder for:

- Inspecting the real code and Git history.
- Planning and implementing one approved ticket.
- Running local servers and tests.
- Reviewing diffs and debugging failures.
- Updating the repository documentation required by the ticket.

Codex may edit the working tree, but it must not deploy, merge, or mutate the production database without explicit authorization.

### Git and GitHub: durable change control

Use Git and GitHub for:

- Branches, commits, diffs, pull requests, and review history.
- Preserving the exact code and migrations associated with a change.
- Keeping `main` releasable.

There is no automatic synchronization that makes every local Codex edit a GitHub change. A local edit reaches GitHub only after it is intentionally committed and pushed.

### Supabase: managed backend

Use Supabase for:

- PostgreSQL data and RLS.
- Authentication.
- Narrow RPCs and Realtime behavior.
- Edge Functions for server-side operations that cannot safely run in the browser.

Do not create a custom MCP server merely to let Codex inspect Supabase. Use Supabase's hosted MCP server, project-scoped and read-only for the current production-connected project.

## First-time local activation

From PowerShell:

```powershell
cd C:\Users\user\Documents\LaxHornet
git fetch origin
git switch chore/codex-project-configuration
git pull --ff-only
```

Open the ChatGPT desktop app, select **Codex**, and open:

```text
C:\Users\user\Documents\LaxHornet
```

Trust the project when prompted. Project-scoped `.codex/config.toml` and its MCP settings are ignored until the project is trusted.

The repository already contains the tailored `AGENTS.md`; do not run `/init`, because `/init` would only generate a generic `AGENTS.md` scaffold.

## Authenticate the Supabase MCP connection

Preferred desktop route:

1. In Codex, open **Settings > MCP servers**.
2. Locate `supabase` from the project configuration.
3. Select **Authenticate** and complete the Supabase OAuth flow.
4. Restart Codex if prompted.
5. Type `/mcp` and confirm that `supabase` is connected.

CLI route from the repository directory:

```powershell
codex mcp login supabase
codex mcp list
```

The committed MCP configuration:

- Is scoped to project `ulbmjcvnyznvmjgpstno`.
- Uses `read_only=true`.
- Enables only documentation, database inspection, and debugging groups.
- Exposes only an explicit inspection-tool allowlist.
- Denies `apply_migration`.
- Prompts before each MCP tool call.

Do not broaden these permissions for the live project. A future write-capable MCP connection should point only to a separate development project or database branch containing synthetic data.

## Confirm the active Codex configuration

Inside Codex:

```text
/status
/model
/reasoning
/mcp
```

The project defaults are:

- Model: the newest model currently supported for the signed-in ChatGPT account and installed Codex client.
- Reasoning: `high`, when supported by the selected model.
- Plan-mode reasoning: `high`, when supported by the selected model.
- Local sandbox: `workspace-write`.
- Approval policy: `on-request`.

The repository intentionally does not set a fixed `model` value. ChatGPT-authenticated Codex model availability can differ by plan, staged rollout, client version, and workspace controls. A hard-pinned model can prevent Codex from starting even when another capable model is available.

Use `/model` to inspect and select from the models actually offered to the signed-in account. Use `/reasoning` to verify or adjust the reasoning level. Do not type an invented combined identifier such as `/model GPT5.high`.

GPT-5.6 requires a sufficiently current Codex client and may still be unavailable during staged rollout. When it is offered in `/model`, it can be selected there without changing repository files.

To verify that repository instructions loaded, ask Codex:

```text
List the instruction and project-state files you loaded for this repository. Summarize the five most important constraints without editing anything.
```

Expected sources include:

- `AGENTS.md`
- `REPO_CURRENT_STATE.md`
- `TICKETS.md`
- `.codex/config.toml`

## Feature workflow

### 1. Define the feature in ChatGPT

Develop one user outcome at a time. Resolve the product purpose, current behavior, scope, exclusions, data implications, offline behavior, authorization/disclosure boundaries, and acceptance criteria.

### 2. Add one ticket

Add the approved work to `TICKETS.md` using the ticket template. A ticket is ready only when its acceptance criteria are observable and its exclusions are explicit.

### 3. Start a dedicated branch

```powershell
git switch main
git pull --ff-only
git switch -c feature/lh-xxx-short-name
```

Do not implement ordinary feature work directly on `main`.

### 4. Use Plan mode

In Codex, toggle `/plan`, then use:

```text
Implement only [TICKET ID] from TICKETS.md.

First read AGENTS.md, REPO_CURRENT_STATE.md, TICKETS.md, and inspect the actual relevant code. Then provide a brief implementation plan naming the expected files, risks, and tests.

Stay strictly within the ticket's scope and acceptance criteria. Preserve the vanilla static PWA, offline-first behavior, authorization boundaries, disclosure rules, Supabase migration provenance, and release controls. Do not deploy, apply remote migrations, change production configuration, or merge to main.
```

Review the plan before implementation when it proposes data changes, authorization changes, a new dependency, a broad refactor, or release-marker changes.

### 5. Implement and test locally

For ordinary browser work:

```powershell
python -m http.server 5173
```

Open:

```text
http://localhost:5173/app.html
```

Use focused tests first. Run the broader regression suite when the change affects shared runtime, synchronization, authorization, disclosure, release behavior, or multiple modules:

```powershell
node tools/run_v283_local_regression.mjs
```

Codex must report exactly which checks ran and which did not.

### 6. Review the diff

Use `/review` or Git directly:

```powershell
git status
git diff --stat
git diff
git diff --check
```

Reject unrelated cleanup, invented architecture, unexplained dependencies, untested behavior changes, production secrets, or broad database access.

### 7. Commit and push intentionally

```powershell
git add <reviewed-files>
git commit -m "Implement LH-XXX short description"
git push -u origin feature/lh-xxx-short-name
```

Open a pull request. Merge only after acceptance criteria and relevant tests are satisfied.

### 8. Update durable state

Before the ticket is considered complete:

- Update the ticket completion record in `TICKETS.md`.
- Update `REPO_CURRENT_STATE.md` only with durable facts that changed.
- Keep brainstorming and abandoned options out of the current-state file.

## Database-change workflow

A database ticket must produce a reviewed timestamped migration in `supabase/migrations/`. It must not edit historical migration identity or apply changes through the live-project MCP connection.

Until the separate local/development Supabase workflow is established:

- Codex may inspect committed SQL and read-only metadata.
- Codex may draft a new migration file on a feature branch.
- Codex may run repository-contained local SQL tests that do not contact production.
- Codex may not run `supabase db push`, repair remote migration history, deploy an Edge Function, or apply a migration remotely.

Production database activation requires its own release ticket, reviewed migration sequence, verification evidence, rollback/recovery plan, and explicit authorization.

## Recommended next setup tickets

1. `LH-DEV-002`: verify the existing migration sequence against a local Supabase stack without touching the linked project.
2. `LH-DEV-003`: establish a separate non-production Supabase target with synthetic data for write-capable development tooling.
3. `LH-DEV-004`: add pull-request regression checks in GitHub Actions without changing deployment behavior.
