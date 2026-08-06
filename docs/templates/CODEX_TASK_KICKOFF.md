# LaxHornet Codex Task Kickoff

Use this lightweight kickoff when a written task record is useful. It is
optional for Level 1, concise for Level 2, and required as part of the approved
ticket for Level 3.

## Task record

- Ticket/task: `[TICKET ID OR SHORT DESCRIPTION]`
- Risk level: `[LEVEL 1 / LEVEL 2 / LEVEL 3]`
- Repository: `C:\Users\user\Documents\LaxHornet`
- Starting branch/ref: `[BRANCH, COMMIT, PR HEAD, OR INSPECT FIRST]`
- Scope: `[BOUNDED OUTCOME]`
- Explicit exclusions: `[OUT-OF-SCOPE SURFACES]`
- Additional authority or restrictions: `[NONE OR EXACT ACTIONS]`

A task ID is not required for Level 1. Record one in `TICKETS.md` only when the
ticket or team workflow needs that navigation metadata.

## Kickoff prompt

```text
Implement the requested LaxHornet change.

Read AGENTS.md, the relevant ticket or task description, and only the files needed for this change. Classify the work as Level 1, Level 2, or Level 3 under docs/CODEX_WORKFLOW.md.

Give a plan of no more than five bullets, then proceed immediately unless the task triggers Level 3 approval requirements, conflicts with the repository, or requires scope expansion.

Make the smallest coherent change. Run focused checks during implementation. Use CI for broader regression on Level 1 and Level 2 work. Run the full local regression once after the final diff stabilizes for Level 3 work.

You may create a branch, commit, push, and open a draft PR. Do not merge, deploy, apply migrations, modify production, change release settings, or invoke write-capable external connectors without explicit authorization.

If the configured GitHub integration automatically applies repository migrations to a temporary isolated Supabase Preview branch for this PR, classify it as accepted CI verification only when it is production-isolated, data-less, separately credentialed, non-production, PR-lifecycle-bound, and secret-free. This does not authorize any local, manual, CLI, linked-main, Dashboard, production, persistent shared-environment, migration-history repair, deployment, or activation action.

Finish with the concise closeout required for the risk level.
```

## Level 3 additions

For Level 3, the approved ticket must also name:

- The critical data, authorization, synchronization, disclosure, service
  worker, release, production, or incident surface.
- Required focused checks and the complete local regression entry point.
- Rollback or recovery boundaries.
- Any separately authorized release or production action.
- The exact-SHA independent review gate before merge.
- Evidence-package requirements when the work is a migration, production
  release, security incident, or disclosure incident.
- Whether automatic isolated Supabase Preview migration CI is expected, and
  the separate prohibition on manual, linked-main, persistent, or production
  migration application.
