# Trust Spine Release 1 Executable Test Plan

Status: implemented. The SQL suite is ready for an isolated LaxHornet Supabase
staging target; local contract and Postgres-compatible execution have passed.

## Executable assets

- Migration:
  `docs/methodnorth/trust-spine-gate/TRUST_SPINE_SCHEMA_PROPOSAL.sql`
- SQL acceptance suite:
  `docs/methodnorth/trust-spine-gate/TRUST_SPINE_STAGING_TESTS.sql`
- Repository contract suite:
  `tools/test_trust_spine_release1.mjs`
- Postgres-compatible migration/rollback runner:
  `tools/run_trust_spine_pglite.mjs`
- Real Auth/PostgREST and separate-request concurrency suite:
  `tools/test_trust_spine_remote.mjs`
- Staging rollback:
  `docs/methodnorth/trust-spine-gate/TRUST_SPINE_STAGING_ROLLBACK.sql`

## SQL acceptance coverage

The transactional SQL suite uses synthetic identities, teams, players, games,
grants, events, and share tokens. It covers 33 acceptance groups:

1. Parent grant boundary.
2. Coach grant boundary.
3. Team-admin evidence boundary.
4. Pending, expired, and revoked grants.
5. Renewal lifecycle behavior.
6. Parent event creation.
7. Cross-player and cross-team denial.
8. Team-scoped coach creation.
9. Player-scoped coach denial.
10. Grant escalation and direct event update/delete denial.
11. Role spoofing and unallowlisted operation fields.
12. Accepted correction.
13. Concurrent different-field merge.
14. Concurrent same-field conflict.
15. Correction idempotency.
16. Duplicate operation ID payload tampering.
17. Accepted tombstone.
18. Tombstone resurrection prevention.
19. Pre-revocation operation fixture.
20. Replay and new correction behavior after revocation.
21. Public-safe Live Share allowlisting.
22. Exact sensitive-export manifest and audit recording.
23. Append-only conflict adjudication.
24. Core evidence and annotation separation.
25. Scope-registration idempotency.
26. Cross-team and cross-player registration denial.
27. Scope registration creates no grant.
28. Private helper invocation denial.
29. Accepted-only revision history.
30. Tombstone permanence and absence of restore objects.
31. Expired/revoked anonymous share-token denial.
32. Public RPC owner, fixed-path, and grant matrix.
33. RLS/privilege posture on every new table.

## Repository contract coverage

The Node suite asserts:

- The migration is additive and does not alter legacy runtime tables.
- Trust Spine foreign keys never target deletable legacy tables.
- Internal foreign keys use preservation-safe `ON DELETE RESTRICT`.
- Deferred roles and systems are absent.
- All 20 tables are included in the deny-all RLS loop.
- Browser roles receive no table grants.
- Only the nine approved public RPCs exist.
- Public wrappers are fixed-path security definers; implementation functions
  are private and client-inaccessible.
- Lifecycle, provenance, operation, conflict, accepted-only revision,
  annotation, scope-registration, sequencing, and allowlist contracts exist.
- SQL markers cover every required acceptance scenario.
- Existing account-scoped local storage isolates accounts.
- Next-game focus storage isolates account, team, and roster player.
- Runtime, cache, and production schema files remain untouched.

## Commands

Local contract checks:

```powershell
node tools/test_trust_spine_release1.mjs
git diff --check
node --check app.js
```

Staging SQL checks:

```powershell
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f "docs/methodnorth/trust-spine-gate/TRUST_SPINE_SCHEMA_PROPOSAL.sql"
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f "docs/methodnorth/trust-spine-gate/TRUST_SPINE_STAGING_TESTS.sql"
```

## Remaining staging-only verification

The SQL suite proves database semantics. Before pilot, also exercise the nine
RPCs through real Supabase Auth/PostgREST sessions and verify unauthenticated
Live Share behavior. Run concurrent same-event corrections from separate
authenticated sessions. This environment had only the production LaxHornet
project and no disposable branch, so those network-edge checks remain a hard
release gate.
