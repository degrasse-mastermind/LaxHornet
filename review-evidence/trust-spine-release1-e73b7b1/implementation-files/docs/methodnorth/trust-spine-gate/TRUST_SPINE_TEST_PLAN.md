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
- Staging rollback:
  `docs/methodnorth/trust-spine-gate/TRUST_SPINE_STAGING_ROLLBACK.sql`

## SQL acceptance coverage

The transactional SQL suite uses synthetic identities, teams, players, games,
grants, events, and share tokens. It covers 24 acceptance groups:

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
24. RLS/privilege posture on every new table.

## Repository contract coverage

The Node suite asserts:

- The migration is additive and does not alter legacy runtime tables.
- Trust Spine foreign keys never target deletable legacy tables.
- Internal foreign keys use preservation-safe `ON DELETE RESTRICT`.
- Deferred roles and systems are absent.
- All 21 tables are included in the deny-all RLS loop.
- Browser roles receive no table grants.
- Only the six approved public RPCs exist.
- Public wrappers are invokers; privilege-bearing functions are private.
- Lifecycle, provenance, operation, conflict, and allowlist contracts exist.
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

The SQL suite proves database semantics. Before pilot, also exercise the six
RPCs through real Supabase Auth/PostgREST sessions and verify unauthenticated
Live Share behavior. This environment did not have a connected LaxHornet
staging project, so those network-edge checks remain a hard release gate.
