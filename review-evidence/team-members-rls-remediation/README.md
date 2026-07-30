# LH-20 `team_members` RLS remediation evidence

This directory contains sanitized, synthetic-only evidence for the production
recursion incident and corrective migration. It contains no access tokens,
credentials, private JWTs, real team/member/player rows, or youth/family data.

## Pre-PR gate record

- Original recursive reproduction: 4/4 passed.
- Corrected authorization and preflight-metadata matrix: 43/43 passed.
- Emergency rollback: exactly eight policies; SQLSTATE `42P17` reproduced.
- Reapply from captured State A: accepted hash
  `75e5d59fce7de054e5f53d7d5d73f99e`; 43/43 passed.
- Reapply from canonical-only State B: accepted hash
  `c4a69b0c9f9660563eb7aa8ca6e1b3b6`; 43/43 passed.
- Blank database: all migrations through `20260730004700` applied.
- Production-shaped upgrade: migration recorded exactly once, four policies,
  RLS/FORCE enabled, anonymous grants removed, authenticated/service-role ACLs
  limited to SELECT/INSERT/UPDATE/DELETE, reproduction 4/4, and authorization
  43/43.
- Adversarial preflight probes: preexisting private schema, changed
  authorization-helper body, and changed production table ACL each failed
  closed before any migration mutation.
- Exact ordered migration-history probes reject a missing earlier migration and
  an injected unexpected lower-version migration.
- The final ACL also removes PostgreSQL 17 `MAINTAIN` from authenticated and
  service roles.
- Complete portable local regression: 34/34 passed after the hardened
  preflight and ACL changes.

`production-policy-snapshot.json` records the sanitized metadata used by the
fail-closed production preflight. Production application and post-deployment
smoke evidence are added only after PR merge and exact-state verification.
