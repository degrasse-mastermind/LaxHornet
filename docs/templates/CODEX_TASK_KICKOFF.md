# LaxHornet Codex Task Kickoff

Use this template when a ticket reaches `READY`. Replace every bracketed field before starting work.

## Task record

- Ticket: `[TICKET ID]`
- Task type: `[IMPLEMENTATION / REVIEW / RELEASE / OPERATIONS]`
- Task title: `[TITLE USING docs/CODEX_WORKFLOW.md]`
- Task ID: `[RECORD AFTER CREATION]`
- Discussion workbench: `[LH-00 / LH-DEV / LH-20 / OTHER]`
- Repository: `C:\Users\user\Documents\LaxHornet`
- Starting branch/ref: `[BRANCH, COMMIT, PR HEAD, OR INSPECT FIRST]`
- Worktree: `[SAVED CHECKOUT / ISOLATED WORKTREE / READ-ONLY REVIEW WORKTREE]`

Copy the task title and task ID into the ticket before implementation.

## Authority

Allowed:

- `[EXACT FILE, CODE, GIT, CONNECTOR, DATABASE, DEPLOYMENT, OR REVIEW ACTIONS]`

Prohibited:

- `[EXPLICIT EXCLUSIONS]`
- Any production, database, deployment, release, connector, merge, or external-write action not expressly allowed above.

## Kickoff prompt

```text
Work only on [TICKET ID] from TICKETS.md in C:\Users\user\Documents\LaxHornet.

Read AGENTS.md, README.md, REPO_CURRENT_STATE.md, TICKETS.md, and docs/CODEX_WORKFLOW.md completely. Inspect the current branch, HEAD, git status, relevant files, existing behavior, and any named evidence before acting.

This task is the primary [IMPLEMENTATION / REVIEW / RELEASE / OPERATIONS] task for the ticket. Keep all continuation, debugging, reruns, and status work in this task unless an explicit independent-review or handoff boundary requires another task.

Allowed authority:
- [ALLOWED ACTIONS]

Prohibited:
- [PROHIBITED ACTIONS]

Before editing or mutating external state, report:
1. Intended scope
2. Expected affected files or systems
3. Data, authorization, offline, release, and external-state risks
4. Verification plan
5. Any conflict between the request and inspected repository state

Make the smallest coherent change that satisfies the ticket. Preserve unrelated work and do not invent architecture or authority.

If interrupted, resume from the verified checkout and first incomplete gate. Do not restart completed work or create a replacement task merely because context compacted, a command stalled, or a test failed.

At completion, use docs/templates/CODEX_TASK_CLOSEOUT.md. Record the exact Git state, files changed, tests and results, risks, durable evidence, remaining work, and whether REPO_CURRENT_STATE.md and TICKETS.md were updated. Do not rename or archive this task until that closeout is durable.
```

## Independent review variant

For an independent review:

- Use a separate read-only task and isolated checkout.
- Replace the ticket's implementation authority with the exact review boundary.
- Name the repository, PR, exact SHA, paths, contracts, and required leading disposition.
- Prohibit edits, commits, pushes, PR changes, merges, deployments, and external mutations.
- Record the review task ID in the ticket without replacing the primary execution task ID.
