# Product Alignment Remediation v2 Evidence

Base commit: `d98ab0542a0c2fce23f5731ff034af348f364835`  
Release reviewed: `v280`  
Environment: disposable Supabase staging project `jafhrhgseiwrohqrhcof`  
Production cutover: **not performed**

This package records the minimum-necessary disclosure sprint for Live Share,
recap sharing, scoped CSV export, private full backup, import boundaries, and
export auditing. It contains no credentials, tokens, private environment files,
or real player data.

## Contents

- `FINAL_REPORT.md` - outcome, test results, limitations, and recommendation.
- `DATA_FLOWS.md` - disclosure flows before and after the sprint.
- `FIELD_ALLOWLISTS.md` - exact output-mode boundaries.
- `STAGING_DEPLOYMENT.md` - disposable-staging deployment and rollback record.
- `sql/` - exact staging migrations and reverse-order rollback SQL.
- `tests/` - executable local, PGlite, and remote PostgREST tests.
- `logs/` - raw test output and synthetic remote response evidence.

## Reproduce

Local source checks:

```powershell
node --check app.js
node tools/test_minimum_disclosure.mjs
```

PGlite migration rehearsal (requires `@electric-sql/pglite` outside the app's
runtime dependencies):

```powershell
node review-evidence/product-alignment-remediation-v2/tests/run_minimum_disclosure_pglite.mjs
```

Remote checks require disposable-staging credentials supplied through process
environment variables. They are never embedded in the repository:

```powershell
$env:LH_STAGING_URL='https://<staging-ref>.supabase.co'
$env:LH_STAGING_ANON_KEY='<staging publishable key>'
$env:LH_STAGING_EMAIL='<synthetic test user>'
$env:LH_STAGING_PASSWORD='<synthetic password>'
node review-evidence/product-alignment-remediation-v2/tests/test_minimum_disclosure_remote.mjs
```

