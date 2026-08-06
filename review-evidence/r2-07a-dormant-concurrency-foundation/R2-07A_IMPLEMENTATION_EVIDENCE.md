# R2-07A Dormant Concurrency Foundation — Implementation Evidence

Status: `IMPLEMENTED — EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW REQUIRED`

Risk level: `LEVEL 3`

Approved design merge: `75acbd1d7ee1204d450b3715e41b53ebc6081b37`

Branch: `feature/r2-07a-dormant-concurrency-foundation`

## Scope and authority

This implementation contains only repository migration, rollback, private
certification, disposable PostgreSQL test, ticket, rollout, and current-state
artifacts. It does not add a client caller, change a v1 function, apply a
migration, contact Supabase, alter production, deploy, change a release/cache
marker, change Live Share/public disclosure, enable retention deletion, merge,
or begin R2-07B or any later phase.

The implemented founder decisions are direct aggregate score authority;
idempotent score deltas/corrections; automatic merge only for proven
non-overlap or explicit commutativity; bounded completed-game corrections to
opponent, date, location, and game type; no completed-game reopen; optimistic
clock revision with immutable command history and no device lease; unchanged
v1 behavior; dormant v2 signatures; and no approved retention period or purge.

## Ordered repository migrations

1. `supabase/migrations/20260806143128_r207a_dormant_concurrency_foundation.sql`
2. Future activation migration: not created and not authorized.

Pre-activation rollback:

- `supabase/rollback/20260806143128_r207a_dormant_concurrency_foundation_rollback.sql`

The rollback succeeds only with zero R2-07 operation, attempt, field-change,
conflict, resolution, and clock-command evidence and unchanged versioned game
state. Otherwise it raises a stable refusal and requires forward repair.

Independent SHA-256 over committed `git show HEAD:<path>` bytes:

- forward migration:
  `8fc88d295afd3058a6865a2235854dd63c9de365ce87b6d40276cae6209094d0`
- rollback:
  `28b8589f2bbb7f2126521ab4ba185450981151baacfbff07d58dd35d5ef5b5e4`

## Objects

Game additions: `game_revision`, `metadata_version`, `score_version`,
`status_version`, `roster_context_version`, `sharing_version`,
`lifecycle_state`, `score_for`, `score_against`, `score_known`,
`final_score_for`, and `final_score_against`.

Clock additions: bigint `revision`, `anchor_server_at`, and
`anchor_clock_seconds_remaining`. Existing clock rows are backfilled; legacy
v1 inserts may leave both anchors null so current behavior remains compatible.

Private RPC-only tables in `public`, all with enabled and forced RLS and no
`anon` or `authenticated` table privilege:

- `game_sync_operations`
- `game_sync_operation_attempts`
- `game_field_changes`
- `game_conflicts`
- `game_conflict_resolutions`
- `game_clock_commands`
- `r207_retention_control`

Public dormant signatures, executable by `authenticated` but returning only
`authentication_required` or `r207_not_activated`:

- `laxhornet_sync_game_v2(jsonb)`
- `lh_apply_game_clock_operation_v2(jsonb)`
- `lh_apply_game_clock_batch_v2(jsonb)`
- `laxhornet_resolve_game_conflict_v1(jsonb)`
- `laxhornet_read_game_conflicts_v1(jsonb)`

The executable semantic functions are in `lh_sync_private`, are owned by the
migration owner, have empty search paths and fully qualified object references,
and are explicitly ungranted to `PUBLIC`, `anon`, and `authenticated`. They are
present solely to certify the dormant server foundation in disposable
PostgreSQL before a future activation migration replaces the inert wrappers.

## Serialization and disclosure contract

The certification engine derives the authenticated actor and normalized client
operation ID, takes a transaction advisory lock over
`laxhornet:r207-operation:<actor>:<client-operation-id>`, performs only a
non-disclosing existence probe, and then takes at most one existing R2-06A
`laxhornet:legacy-game:<game-id>` transaction lock. It checks the authoritative
tombstone and current personal or team/roster authority before re-reading the
stored operation and classifying replay, scope mismatch, or payload mismatch.

Identity, semantic mutation or conflict, canonical result, and append-only
history commit in one transaction. Cross-game mismatch returns only
`duplicate_operation_id_scope_mismatch`; payload mismatch returns only
`duplicate_operation_id_payload_mismatch`. Neither response contains stored
scope, payload, result, or conflict identity. Tombstone and current-authority
denials outrank replay.

## Retention boundary

`r207_retention_control` contains exactly one disabled row. Its constraints
require `execution_enabled = false`, a null retention duration, and null
privacy/legal authorization. No purge function, delete grant, trigger, cron,
scheduled job, or automatic retention path exists. The 180-day recommendation
remains explicitly unauthorized.

## Verification

Primary executable matrix:

```powershell
node tools/test_r207a_dormant_concurrency.mjs
```

Result: `49 checks passed`, including all twelve mandatory operation-identity
cases, populated-data backfill, dormant/anonymous behavior, conflict-value
privacy rejection, field non-overlap and overlap, completed-game correction and
no-reopen, optimistic clock bases, wrong-account and revoked-team authority,
copied-owner rejection, forced RLS, direct grant denial, append-only history,
atomic rollback, rollback refusal/success, and zero Docker container residue.

Focused preservation results:

- durable game/clock operations: `29 passed, 0 failed`;
- tracked-playing-time foundation: `11/11 passed`;
- R2-06 tombstone contracts: `33 passed, 0 failed`;
- R2-06A real-session tombstone concurrency: `8/8 passed`;
- R2-06/R2-06A migration and rollback: `13/13 passed`;
- phase-aware protected-path containment: `33/33 passed`;
- release hygiene after R2-07A path registration: `44/44 passed`;
- Trust Spine preservation after R2-07A path registration: `18/18 passed`;
- secret and hosted-project scan: passed;
- `git diff --check`: passed.

Complete canonical-plus-additive local regression, using the bundled Python
runtime and a temporary evidence output outside the repository:

```powershell
$env:LAXHORNET_PYTHON='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$env:LAXHORNET_REGRESSION_EVIDENCE_FILE = Join-Path $env:TEMP 'laxhornet-r207a-full-regression-final.txt'
node tools/run_v283_local_regression.mjs
```

Final result: `TOTAL: 56 passed, 0 failed`.

## Known limitations and future dependencies

- Public v2 functions are intentionally inert; no app can use the semantic
  engine in R2-07A.
- No rich conflict UI, client version hydration, clock batch client routing,
  event concurrency cutover, activation, or production certification is part
  of this phase.
- Direct app-role conflict reads are absent; a future activated bounded RPC must
  continue enforcing current authority and tombstone precedence.
- Retention duration and execution require a new privacy/legal decision and a
  separate reviewed implementation.
- R2-07B through R2-07F remain unauthorized.

## Production statement

No migration was applied. No Supabase connector or project was accessed or
mutated. No deployment, release, cache, Live Share, public disclosure, or
production state changed. v1 behavior and the v285 runtime boundary remain
unchanged.
