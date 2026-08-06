# LaxHornet Codex Task Closeout

Use this concise closeout for completed Level 1, Level 2, and Level 3
implementation work.

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
Supabase Preview: NOT APPLICABLE / AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION — ACCEPTED CI VERIFICATION
Next step:
```

Use `NOT APPLICABLE` where a field does not apply. If production or external
state did change under separate explicit authorization, replace `NO` with the
exact authorized action and its durable evidence.

The normal feature-branch push and draft pull request are recorded in their
own fields and do not change the production-or-external-state field. When the
configured GitHub integration automatically applies migrations to an isolated,
data-less, separately credentialed, PR-lifecycle Supabase Preview branch,
record that in the Preview field as accepted CI verification. Do not report
`No migration was applied`; state that no local, manual, CLI, linked-main, or
production migration was applied and that the isolated Preview application was
automatic. Preview CI does not authorize manual, persistent shared-environment,
production, migration-history repair, deployment, or activation actions.

## Level 3 additions when relevant

Add only the fields required by the critical surface:

```text
Security or authorization:
Migration and rollback:
Disclosure:
Synthetic-data cleanup:
Evidence package:
Exact PR SHA reviewed:
Independent review result:
Release or production authorization:
```

Task renaming, pin management, and archival are optional workspace-hygiene
actions. They are not implementation gates or part of the engineering
definition of done.
