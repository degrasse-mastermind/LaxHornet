# LaxHornet Trust Spine Release 1 Hardening Evidence

Implementation commit: `7cf83f3`

Base evidence commit: `2e959868e8a963b75bad1d8524f3e68d79435b88`

Recommendation: **revise before browser integration**

## Why the recommendation is not ready

The complete local migration, SQL acceptance, contract, and rollback gates pass.
The required real Supabase staging proof could not be run because the connected
project has only its production `main` branch and no disposable staging branch.
The brief explicitly requires stopping instead of testing on production.

No production migration or runtime cutover occurred.

## Package contents

- `implementation.diff`
  - Full implementation diff from the prior evidence commit to `7cf83f3`.
- `FILES_CHANGED.txt`
  - Exact implementation commit file list.
- `sql/TRUST_SPINE_SCHEMA_PROPOSAL.sql`
  - Exact additive staging migration.
- `sql/TRUST_SPINE_STAGING_ROLLBACK.sql`
  - Exact disposable-staging rollback.
- `sql/TRUST_SPINE_RPC_DEFINITIONS.sql`
  - Exact private and public function definitions extracted from the migration.
- `tests/TRUST_SPINE_STAGING_TESTS.sql`
  - Transactional 33-group SQL acceptance suite.
- `tests/test_trust_spine_release1.mjs`
  - Repository contract tests.
- `tests/test_trust_spine_remote.mjs`
  - Real Auth/PostgREST and separate-request concurrency harness for disposable
    staging.
- `tests/run_trust_spine_pglite.mjs`
  - Local migration/acceptance/rollback runner.
- `docs/TRUST_SPINE_RPC_GRANT_MATRIX.md`
  - Public RPC owner/security/grant audit.
- `docs/TRUST_SPINE_SCOPE_REGISTRATION.md`
  - Existing-schema bootstrap and snapshot boundary.
- `docs/TRUST_SPINE_HARDENING_REPORT.md`
  - Final report, limitations, production-safety statement, and next gate.
- `logs/local-contract-tests.txt`
  - Raw 18/18 contract output.
- `logs/pglite-migration-acceptance-rollback.txt`
  - Raw migration, 33-group SQL acceptance, rollback, and legacy-preservation
    output.
- `logs/remote-test-not-run.txt`
  - Exact remote harness skip reason.
- `STAGING_ENVIRONMENT_EVIDENCE.json`
  - Sanitized connected branch inventory.
- `REMOTE_EVIDENCE_GAPS.md`
  - Required evidence that remains blocked by the absent disposable branch.

## Verified locally

```text
MIGRATION: PASS
TRUST_SPINE_TABLES: 20
SQL_ACCEPTANCE: {"suite":"LaxHornet Trust Spine Release 1","fixtures":"synthetic","transaction":"rolled_back","sqlTestsPassed":33}
ROLLBACK: PASS
TRUST_SPINE_TABLES_AFTER_ROLLBACK: 0
LEGACY_SENTINELS_AFTER_ROLLBACK: {"games":1,"events":1,"teams":1,"roster_players":1}
```

Repository contracts:

```text
18/18 local contract tests passed.
```

## Rollback

On a proven disposable staging target:

```powershell
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 `
  -f "docs/methodnorth/trust-spine-gate/TRUST_SPINE_STAGING_ROLLBACK.sql"
```

The local rehearsal removed all 20 Trust Spine tables and preserved every
legacy sentinel record.

