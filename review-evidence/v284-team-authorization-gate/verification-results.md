# Verification Results

## Release and repository

```powershell
node tools/run_release_preflight.mjs --prepare --release v284 --phase production --approved-rollout-sha 27ef1712ac30c09456eac78e1665b0d8a13f7819
```

Result: passed at clean approved `main`. Release identity, migration checksum,
manifest, v284 marker/cache/query surfaces, public Live Share SQL identity,
historical migration drift, and environment checks passed.

## Production read-only verification

- Migration history contains all seven expected versions and
  `20260727000000` exactly once.
- Tracked tables have enabled and forced RLS.
- Effective view has `security_invoker=true`.
- No direct `anon` or `authenticated` table/view privileges exist.
- Seven normalized function-definition MD5 values matched between production
  and the reviewed local reset.
- The retained stopped-rollout grant was team-scoped `team_admin`, accepted at
  call time, unexpired, and revoked only during cleanup.

## Local database

```powershell
supabase start -x storage-api,imgproxy,logflare,vector --yes
supabase db reset --local --no-seed
```

Result: reviewed seven-migration reset passed.

The external transactional authorization matrix executed 126 real RPC calls
across 18 cases with zero missing result codes.

## Corrected production authorization gate

Synthetic prefix:
`v284-authgate-ms3gikuu-1b2c35c7`

Result: passed.

- parent/player initialize, read, update, create, correct, tombstone, and list:
  passed;
- team-admin initialize/update: denied;
- team-admin read/list: allowed;
- wrong account/player/game and cross-team: denied;
- duplicate replay: `operation_replayed`;
- stale revision: `stale_clock_revision`.

## Focused repository test

```powershell
node --check tools/test_v284_team_authorization_policy.mjs
node tools/test_v284_team_authorization_policy.mjs
node tools/test_tracked_playing_time_foundation.mjs
node tools/test_tracked_playing_time_service.mjs
node tools/test_game_scope_capabilities.mjs
supabase test db --local supabase/tests/tracked_playing_time_foundation.sql
```

Results:

- authorization-policy contract: passed;
- tracked-time foundation: `11/11`;
- tracked-time service: `16/16`;
- game-scope capability contracts: passed;
- tracked-time pgTAP: `37/37`.

## Complete local regression

```powershell
$env:LAXHORNET_PYTHON='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
node tools/run_v283_local_regression.mjs
git diff --check
```

Result: `31 passed, 0 failed`.

This included syntax checks, tracked-time browser and manual scenarios,
phase-aware release preflight and containment, release hygiene, minimum
disclosure, secure-disclosure source/browser checks, Product Alignment
source/browser checks, Trust Spine source/PGlite checks, Python RPC permission
checks, secret and host scan, and diff hygiene. Test-generated historical
evidence artifacts were restored after the run; only this gate's evidence and
the focused policy guard remain in the branch.
