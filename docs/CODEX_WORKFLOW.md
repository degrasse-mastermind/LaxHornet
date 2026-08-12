# LaxHornet Codex Workflow

This is the risk-based operating procedure for using ChatGPT, Codex, Git,
GitHub, and Supabase on LaxHornet.

> Use the lightest process appropriate to the actual risk.

The repository, Git history, pull requests, and applicable tests remain the
durable implementation record. ChatGPT and Codex tasks are collaboration
surfaces, not additional approval systems.

## Start here

For every change:

1. Read `AGENTS.md`.
2. Read the relevant ticket or task description.
3. Inspect only the code, documentation, and current behavior needed for the
   change.
4. Classify the work as Level 1, Level 2, or Level 3.
5. Give a concise plan of no more than five bullets and proceed immediately
   unless a Level 3 approval requirement, repository conflict, stop condition,
   or required scope expansion appears.

Do not require a separate planning task. Do not require routine or standard
work to wait for plan approval.

## Risk classification

When a change could fit more than one level, use the highest level triggered by
its actual effects. Do not classify work as Level 3 merely because the
repository is production-connected or because the changed code is important.
Default to Level 1 or Level 2 when none of the Level 3 triggers applies.

### Level 1 — Routine

Typical Level 1 work includes:

- Copy.
- CSS and layout.
- Documentation.
- Isolated visual polish.
- Narrowly bounded bug fixes.
- Changes with no data, authorization, synchronization, disclosure, release,
  or production effect.

Rules:

- No formal ticket is required.
- No task ID is required in `TICKETS.md`.
- No separate planning task is required.
- Codex may inspect, implement, run focused checks, commit, push, and open a
  draft pull request in one task.
- Independent review is not required.
- No evidence package is required.
- Full local regression is not required unless shared runtime is affected.
- CI may provide the broader regression gate.

### Level 2 — Standard

Typical Level 2 work includes:

- Bounded feature behavior.
- Isolated calculations.
- Local-only workflow state.
- New factual UI components.
- Changes spanning a small number of related runtime areas without critical
  data or security effects.

Rules:

- Use a concise ticket or PR-ready task description.
- Use one primary Codex task through the draft pull request.
- Limit the plan to five bullets or fewer.
- Codex proceeds after its own plan unless it detects a Level 3 trigger,
  repository conflict, stop condition, or required scope expansion.
- Run focused tests locally.
- Use CI for broad regression by default.
- Independent review is optional.
- No evidence package is required.
- Use the concise closeout.

### Level 3 — Critical

Level 3 applies to changes involving:

- Storage formats or recovery.
- Offline synchronization or conflict semantics.
- Database schema or migrations.
- RLS, grants, roles, authentication, or authorization.
- Youth-data disclosure or public sharing.
- Service-worker update semantics.
- Release controls.
- Production state.
- Incident remediation.

Rules:

- Use one approved ticket.
- Use one concise implementation plan.
- Use one primary implementation task through the draft pull request.
- Run focused tests during implementation.
- Run the complete local regression once after the final diff stabilizes.
- Rerun the complete suite only if a subsequent change materially affects
  shared behavior.
- Require an independent review against the exact pull-request SHA before
  merge.
- Authorize release or production work separately.
- Require an evidence package only for migrations, production releases,
  security incidents, or disclosure incidents.

## Default Git authority

For Level 1 and Level 2 work, and for Level 3 implementation unless the task
explicitly restricts it, Codex may:

- Create a feature branch.
- Edit repository files within scope.
- Run local checks.
- Create focused commits.
- Push the feature branch.
- Open or update a draft pull request.

These actions are part of the ordinary request-to-draft-PR workflow and do not
need separate approval.

Codex may not by default:

- Merge.
- Deploy.
- Apply migrations.
- Mutate production.
- Change GitHub Pages settings.
- Invoke write-capable external connectors.
- Publish a release.

Those actions require explicit authorization that names the target and scope.
Using local Git and GitHub only to push the authorized feature branch and
create or update its draft pull request is not treated as a write-capable
external-connector exception.

### Supabase Preview classification

When an authorized pull request containing migrations triggers the configured
GitHub integration, automatic application to its temporary isolated Supabase
Preview branch is CI verification, not a manual or production migration. This
classification applies only when the preview is isolated from production,
contains no copied production data, uses separate credentials, changes no
production migration history, performs no production deployment, is tied to
the pull-request lifecycle, and exposes no secrets in evidence.

Record the applicable status as:

```text
AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION — ACCEPTED CI VERIFICATION
```

Do not use the absolute statement `No migration was applied` when Preview ran.
Instead report:

```text
No local, manual, CLI, linked-main, or production migration was applied.
The configured GitHub integration automatically applied the migration to an
isolated ephemeral Supabase Preview branch for PR validation.
```

Preview CI does not authorize local/manual migration application, Supabase CLI
application to a linked main or production project, manual Dashboard
application, production or persistent shared-environment application,
migration-history repair, deployment/activation, production data, or production
credentials.

A green Supabase Preview status proves automatic migration application only.
For Level 3 work involving server-side authorization, operation identity,
atomicity, concurrency, or conflict behavior, the exact PR head must also pass
the independent authenticated multi-session matrix in
`docs/ISOLATED_PREVIEW_REVIEW_GATE.md`. Portable, PGlite, embedded, and
browser-mock results are complementary and cannot substitute for that gate.

## Implementation workflow

### 1. Inspect and classify

Inspect the current branch, `git status`, the task description, and relevant
files. Verify existing behavior before proposing a change. Preserve unrelated
work; use an isolated worktree when the active checkout contains work that
must not be mixed with the request.

State the risk level and give a plan of no more than five bullets. For Level 1
and Level 2, proceed immediately. For Level 3, confirm that the ticket and
implementation authority cover the critical surface before editing.

### 2. Make the smallest coherent change

Stay within the task's scope and acceptance criteria. Preserve the vanilla
static PWA, local-first behavior, authorization boundaries, disclosure rules,
migration provenance, and release controls wherever they are relevant.

Do not introduce a production dependency without explaining why the existing
stack cannot meet the requirement.

### 3. Test the affected surface

Run focused tests during implementation and always run:

```powershell
git diff --check
```

For Level 1 and Level 2, use CI for broader regression by default. Run broader
local checks only when the change affects shared runtime behavior or the task
specifically requires them.

For Level 3, run the complete local regression once after the final diff is
stable:

```powershell
node tools/run_v283_local_regression.mjs
```

This is the canonical-plus-additive portable regression. It must not start or
require a container or local Supabase stack. Real PostgreSQL and authenticated
multi-session behavior are verified only through the isolated Preview gate.

Rerun the complete suite only when a later edit materially changes shared
behavior. Do not run unrelated database, release, disclosure, service-worker,
or deployment tests for isolated UI or documentation work.

Report exactly which checks ran, their results, and any relevant checks that
were unavailable.

### 4. Review and publish

Inspect the complete diff and confirm that only intended files changed:

```powershell
git status --short
git diff --stat
git diff
git diff --check
```

Commit only reviewed files, push the feature branch, and open or update a draft
pull request when within the authority above. Merge remains separately
authorized.

### 5. Record only durable changes

- Update `TICKETS.md` only when the work has a ticket.
- Update `REPO_CURRENT_STATE.md` only when durable architecture, production
  behavior, release controls, or major verification capabilities change.
- Do not create review-evidence directories for ordinary feature work.
- Use the pull-request description, CI results, relevant screenshots, and a
  concise ticket record as ordinary evidence.
- Update roadmap or decision-register documents only when the approved roadmap
  or product decision changes.
- Review or update `docs/LAXHORNET_ROLLOUT_CHECKLIST.md` only when an approved
  roadmap or engineering ticket changes a rollout work package, milestone,
  gate, blocker, release, production state, or existing checklist item, or adds
  a newly approved roadmap item.

Routine work with no roadmap effect does not inspect or update the rollout
checklist.

## Review

- Level 1: no independent review required.
- Level 2: independent review optional.
- Level 3: independent review against the exact pull-request SHA required
  before merge.

A separate review task may be used for Level 3. It is not an implementation
gate for ordinary work.

An independent Level 3 review must be read-only, name the exact SHA and
contracts under review, and prohibit edits, commits, pushes, pull-request
changes, merges, deployments, and external mutations.

## Closeout

Use the concise closeout in
`docs/templates/CODEX_TASK_CLOSEOUT.md`:

```text
Ticket/task:
Risk level:
Branch:
Commit:
Draft PR:
What changed:
Files changed:
Focused checks:
Broad checks or CI:
Known limitations:
Production or external state changed: NO
Next step:
```

Add security, migration, disclosure, cleanup, or evidence fields only for
Level 3 work when relevant.

Task renaming, pin management, and archival are optional workspace-hygiene
actions. They are not part of the engineering definition of done.

## Stop conditions

Stop and report the blocker before expanding authority when:

- The request conflicts with inspected repository state or unrelated work
  cannot be safely isolated.
- The change triggers Level 3 but lacks an approved ticket or sufficient
  implementation authority.
- Completion requires a merge, deployment, migration application, production
  mutation, release publication, GitHub Pages setting change, or write-capable
  external connector action that was not explicitly authorized.
- Required scope or product behavior is ambiguous enough that a reasonable
  assumption would materially change the outcome.
- A secret, real child-sensitive data, or unapproved production access would
  be required.

Do not mark work complete merely because expected-path tests are green. Apply
the acceptance criteria and gates required by its risk level.

## Database, release, and production work

Database schema and migration work is Level 3. It must use reviewed,
timestamped SQL under `supabase/migrations/` and preserve historical migration
identity. Local validation must not contact or mutate production.

Applying a migration outside the allowed automatic isolated Supabase Preview
classification, changing production data or configuration, deploying an Edge
Function, changing GitHub Pages settings, merging, deploying, or publishing a
release requires separate explicit authorization and the
repository's applicable release or operations procedure.

The project-scoped Supabase configuration is read-only. A connector session is
never the source of truth for a database change.
