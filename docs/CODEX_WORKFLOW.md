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
- `docs/CODEX_WORKFLOW.md`
- `.codex/config.toml`

## Thread and task lifecycle

The thread system is a navigation layer around the repository workflow. It does not replace ticket, Git, review, or evidence records.

### Stable workbenches

Keep a small set of durable ChatGPT workbenches:

| Workbench | Purpose | Must not become |
| --- | --- | --- |
| `LH-00 | LaxHornet Product Command Center` | Product direction, priorities, and explicit decisions | An implementation log |
| `LH-90 | Project Chat Index` | Source classification, canonical indexing, and historical navigation | A second product backlog |
| `LH-DEV | Active Engineering Workbench` | Ticket shaping, engineering status, blockers, and handoffs | A substitute for the active Codex task |
| `LH-20 | Active Workbench` | Current LH-20 program discussion while that program remains active | A permanent catch-all |

Pins are a convenience. Add or remove a workbench from the pinned set as priorities change without treating the pin state as project authority.

### One ticket, one execution task

- Create a primary Codex execution task only after the ticket is `READY`.
- Keep implementation, debugging, reruns, and continuation in that task until the ticket reaches a terminal disposition.
- Do not create a replacement task because work paused, context compacted, a command stalled, or a status update is needed. Resume from the verified checkout and first incomplete gate.
- Do not reuse a completed execution task for a different ticket.
- Create a separate task only when the work is intentionally independent, such as an exact-SHA adversarial review, a separately authorized release, or a distinct operations ticket.
- Record the task title and task ID in `TICKETS.md` so the external conversation can be traced to the durable ticket.

### Naming convention

Use outcome-oriented titles:

| Task type | Pattern | Example |
| --- | --- | --- |
| Implementation | `LH-DEV-NNN | Verb object` | `LH-DEV-005 | Remediate RLS Recursion` |
| Product program | `LH-NN | Active Workbench` | `LH-20 | Active Workbench` |
| Independent review | `LH-REVIEW | PR #NN — Review objective` | `LH-REVIEW | PR #30 — Public Event Boundary` |
| Release | `LH-RELEASE | vNNN — Release objective` | `LH-RELEASE | v284 — Production Verification` |
| Operations | `LH-OPS | Operations objective` | `LH-OPS | Project Thread Cleanup` |
| Historical reference | `LH-ARCHIVE | Historical label` | `LH-ARCHIVE | Original Sideline Scout Build` |

At closeout, append a concise disposition only when useful: `PASS`, `FAIL`, `BLOCKED`, `COMPLETED`, or `HISTORICAL`. A disposition in a title must match the durable ticket or review record.

### Lifecycle

1. **Shape:** discuss one outcome in the appropriate workbench.
2. **Register:** add or update one ticket in `TICKETS.md`; move it to `READY` only when scope, exclusions, acceptance criteria, risks, and authority are explicit.
3. **Kick off:** create or select the primary Codex task, use `docs/templates/CODEX_TASK_KICKOFF.md`, and record its title and ID in the ticket.
4. **Execute:** let that task own the checkout or worktree, implementation, tests, and progress. Continue there after interruptions.
5. **Review:** use a separate task when independence is required. Bind review conclusions to an exact commit or pull-request SHA.
6. **Close out:** use `docs/templates/CODEX_TASK_CLOSEOUT.md`; update the ticket, current state when durable behavior changed, evidence, and GitHub references.
7. **Archive:** rename with an accurate disposition and archive only after the durable closeout is complete. Keep tasks with active work, unique uncommitted changes, or unresolved ownership visible.

### Stop rules

- Do not archive a task that owns a running process, dirty worktree, unique uncommitted edits, or an unresolved production/data cleanup obligation.
- Do not copy unfinished implementation into a new task without an explicit handoff that names the branch, worktree, HEAD, dirty state, last completed gate, first incomplete gate, and current blocker.
- Do not treat a ChatGPT summary, Codex title, or thread preview as proof of implementation or review status.
- Do not mark a task `PASS`, `DONE`, or `COMPLETED` merely because expected-path tests are green; use the ticket's full acceptance and review gates.
- Do not archive a failed or blocked task until the exact failure, safety state, durable evidence, and next authorized action are recorded.

### Routine hygiene

Review the project task list periodically:

1. Confirm every pinned task has a current navigation purpose.
2. Confirm every `IN PROGRESS`, `BLOCKED`, or `REVIEW` ticket names its primary Codex task.
3. Find duplicate execution tasks and designate one owner before further edits.
4. Rename completed review/release/operations tasks with an accurate disposition.
5. Archive only tasks that satisfy the closeout gate.
6. Leave historical findings searchable through ticket, PR, commit, and evidence references.

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

First read AGENTS.md, REPO_CURRENT_STATE.md, TICKETS.md, docs/CODEX_WORKFLOW.md, and inspect the actual relevant code. Then provide a brief implementation plan naming the expected files, risks, and tests.

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
- Complete `docs/templates/CODEX_TASK_CLOSEOUT.md` and archive the task only after its durable result is recorded.

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
