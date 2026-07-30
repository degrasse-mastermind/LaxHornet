# LaxHornet Codex Task Closeout

Complete this gate before renaming or archiving an implementation, review, release, or operations task.

## Durable result

- Ticket: `[TICKET ID OR OPERATIONS RECORD]`
- Task title: `[CURRENT TITLE]`
- Task ID: `[TASK ID]`
- Disposition: `[COMPLETED / PASS / FAIL / BLOCKED / HISTORICAL]`
- Branch/worktree: `[BRANCH AND ABSOLUTE WORKTREE]`
- Exact HEAD or reviewed SHA: `[FULL SHA]`
- Pull request/merge/deployment: `[REFERENCES OR NOT APPLICABLE]`
- Durable evidence: `[REPOSITORY PATHS, PR COMMENTS, OR COMMITTED REPORTS]`

## Change and verification record

- What changed or was reviewed:
  - `[BOUNDED SUMMARY]`
- Files changed:
  - `[PATHS OR NONE FOR READ-ONLY WORK]`
- Tests and checks run:
  - `[COMMAND — RESULT]`
- Checks not run:
  - `[COMMAND OR GATE — REASON]`
- Data and authorization risk:
  - `[RESULT AND RESIDUAL RISK]`
- Offline and synchronization risk:
  - `[RESULT AND RESIDUAL RISK]`
- Release, deployment, and external-state risk:
  - `[RESULT AND RESIDUAL RISK]`
- Cleanup:
  - `[SYNTHETIC DATA, TEMPORARY PROCESSES, WORKTREES, OR NOT APPLICABLE]`

## Repository state

- `git status --short`: `[CLEAN OR EXACT REMAINING PATHS]`
- Unique uncommitted work remains: `[YES/NO]`
- `TICKETS.md` updated: `[YES/NO/NOT APPLICABLE]`
- `REPO_CURRENT_STATE.md` updated: `[YES/NO/NOT REQUIRED]`
- Remaining work or next authorized action:
  - `[EXACT NEXT STEP OR NONE]`

## Archive gate

Archive only when every applicable statement is true:

- The ticket or durable operations/review record contains the disposition.
- Commit, PR, reviewed SHA, tests, failures, and evidence locations are recorded.
- Failed or blocked work names the first unresolved gate and next authorized action.
- No running process, dirty worktree, unique uncommitted edit, or synthetic cleanup obligation depends on the task.
- A successor task, when required, has an explicit handoff and does not rely on thread history alone.

If the gate passes:

1. Rename the task with an accurate disposition when useful.
2. Remove its pin unless it remains an intentional navigation entry.
3. Archive it.

If the gate does not pass, keep the task visible and record the unmet condition.
