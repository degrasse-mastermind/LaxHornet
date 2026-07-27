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

Codex may edit the working tree, but it must not deploy, merge, invoke write-capable connector actions, or mutate a remote database without explicit ticket authorization.

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

Repository work must use committed SQL, local tests, and explicit release procedures as the source of truth. Do not rely on a connector session as the record of a database change.

## Host-managed Apps and Plugins

Codex may expose connectors through a host-managed runtime such as `codex_apps`. These apps can include GitHub, Google Drive, Notion, Supabase, Vercel, Figma, Canva, Resend, and other services.

These connectors are not configured or permissioned by this repository. Their availability and action permissions come from the signed-in ChatGPT account, workspace settings, installed plugins/apps, OAuth grants, and the current Codex surface.

For LaxHornet:

- Treat every host-managed connector as out of scope unless the active ticket explicitly authorizes it.
- Do not infer that a connector is read-only merely because the repository says remote writes are prohibited.
- Do not use Supabase, Vercel, Resend, GitHub write actions, or other mutation-capable connectors during ordinary feature work.
- A ticket that authorizes a connector must name the service, target project or repository, allowed actions, prohibited actions, verification, and rollback.
- Connector availability is optional. Ordinary LaxHornet coding must remain possible using the local repository and Git alone.

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

Trust the project when prompted. The repository already contains the tailored `AGENTS.md`; do not run `/init`, because `/init` would only generate a generic scaffold.

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

The repository intentionally does not set a fixed `model` value. ChatGPT-authenticated Codex model availability can differ by plan, staged rollout, client version, and workspace controls. Use `/model` to inspect and select from the options actually offered to the signed-in account. Use `/reasoning` to verify or adjust reasoning level.

The `/mcp` view may report host-managed apps through `codex_apps`. That is informational; it does not make those connectors part of an approved LaxHornet ticket.

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

Stay strictly within the ticket's scope and acceptance criteria. Preserve the vanilla static PWA, offline-first behavior, authorization boundaries, disclosure rules, Supabase migration provenance, and release controls. Do not invoke host-managed connector actions, deploy, apply remote migrations, change production configuration, or merge to main unless the ticket explicitly authorizes that exact action.
```

Review the plan before implementation when it proposes data changes, authorization changes, a new dependency, a broad refactor, connector use, or release-marker changes.

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

Reject unrelated cleanup, invented architecture, unexplained dependencies, untested behavior changes, production secrets, broad database access, or undeclared connector usage.

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

A database ticket must produce a reviewed timestamped migration in `supabase/migrations/`. It must not edit historical migration identity or apply changes through an ordinary connector session.

Until the separate local/development Supabase workflow is established:

- Codex may inspect committed SQL.
- Codex may draft a new migration file on a feature branch.
- Codex may run repository-contained local SQL tests that do not contact production.
- Codex may not use a Supabase app/connector to push, repair remote history, deploy an Edge Function, apply a migration, create a branch, or change remote data.

Production database activation requires its own release ticket, reviewed migration sequence, verification evidence, rollback/recovery plan, and explicit authorization.

## Recommended next setup tickets

1. `LH-DEV-002`: verify the existing migration sequence against a local Supabase stack without touching the linked project.
2. `LH-DEV-003`: establish a separate non-production Supabase target with synthetic data for authorized backend testing.
3. `LH-DEV-004`: add pull-request regression checks in GitHub Actions without changing deployment behavior.
