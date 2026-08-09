# R2-07A Dormant Concurrency Foundation — Implementation Evidence

Status: `MATERIAL REVIEW FINDINGS REMEDIATED — NEW EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW REQUIRED`

Risk level: `LEVEL 3`

Approved design merge: `75acbd1d7ee1204d450b3715e41b53ebc6081b37`

Branch: `feature/r2-07a-dormant-concurrency-foundation`

## Scope and authority

This implementation contains only repository migration, rollback, private
certification, disposable PostgreSQL test, ticket, rollout, and current-state
artifacts. It does not add a client caller, change a v1 function, apply a
migration locally/manually/by CLI/to linked main or production, alter
production, deploy, change a release/cache marker, change Live Share/public
disclosure, enable retention deletion, merge, or begin R2-07B or any later
phase. The configured GitHub integration's automatic migration application to
the isolated PR #64 Supabase Preview branch is accepted CI verification.

## Failed exact-head review and remediation

Exact head `b071dc6ffc09e2f28f965bcdabe6a4b4d632d89b` failed independent
Level 3 implementation review at
`https://github.com/degrasse-mastermind/LaxHornet/pull/64#issuecomment-5207402351`.
The private certification engine accepted ordinary `score_delta` against a
completed game and treated copied `owner_user_id` as sufficient authority for
a team-scoped tombstone.

The remediation requires exact lifecycle and status bases for score, status,
and clock operations; rejects ordinary completed-game score and clock writes
before any semantic or evidence mutation; requires an exact current score base
and one non-sensitive allowlisted reason code for the private completed-game
`score_correction` path; and preserves replay-safe atomic evidence. Team
tombstones now authorize only current roster-tracking authority or the existing
bounded reviewer path. Copied owner identity is accepted only for a personal
tombstone. The failed review remains historical evidence and no PASS applies to
the remediation head until a fresh independent exact-head review succeeds.

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
  `be91fd3be313d20b8a4d51857c616e052dbf49e9348dbf3018efadae6340d800`
- rollback:
  `28b8589f2bbb7f2126521ab4ba185450981151baacfbff07d58dd35d5ef5b5e4`

## Objects

Game additions: `game_revision`, `metadata_version`, `score_version`,
`status_version`, `roster_context_version`, `sharing_version`,
`lifecycle_state`, `score_for`, `score_against`, `score_known`,
`final_score_for`, and `final_score_against`.

Operation evidence adds nullable `correction_reason`, constrained to the
minimum non-sensitive codes `scoreboard_correction`,
`official_result_correction`, or `data_entry_correction`. The private engine
sets it only for an accepted completed-game score correction.

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
Personal tombstones require their personal owner. Team tombstones ignore copied
owner identity and require current `laxhornet_can_track_roster_player`
authority or the bounded reviewer path before disclosing `game_deleted`.

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

Result: `71 checks passed`: all original `49` checks plus `22` remediation
assertions. New completed-game probes cover ordinary delta/absolute rejection,
zero mutation/evidence, missing and stale lifecycle/status bases, an explicit
allowlisted correction reason, stale score base, exactly-once correction and
replay, unauthorized correction, concurrent zero-mutation score deltas, frozen
clock, factual metadata preservation, and no reopen. New team-tombstone probes
cover copied owner, untracked and former members, current tracker disclosure,
personal isolation, revoked replay, cross-game operation-ID reuse, and bounded
responses that disclose no game, operation, replay, or conflict identity.

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

Final stabilized-diff run: `TOTAL: 55 passed, 1 failed`. The sole failure was
the unrelated existing R2-06P Playwright reload step with
`net::ERR_ABORTED; maybe frame was detached`. Immediate isolated rerun of
`node tools/test_hydration_tombstone_browser.cjs` passed its raw-storage,
application-state, rendered-UI, and controlled-reload journey. No R2-07A,
migration, rollback, authorization, concurrency, containment, release, or
secret check failed. Fresh exact-head PR CI remains the broad regression gate.

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
- Supabase Preview records only newly added migration files on later commits.
  This remediation edits the already-recorded migration, so no manual Preview
  history repair, reset, close/reopen cycle, or branch mutation was performed.
  Disposable PostgreSQL reconstruction and source-bound CI remain the truthful
  remediation proof unless the integration independently creates a fresh
  ephemeral Preview branch.

## Production statement

`AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION — ACCEPTED CI VERIFICATION`

No local, manual, CLI, linked-main, or production migration was applied. The
configured GitHub integration automatically applied the migration to an
isolated ephemeral Supabase Preview branch for PR validation. The Preview
branch is separate from production, contains no copied production data, uses
separate credentials, changes no production migration history, performs no
production deployment, is tied to the PR lifecycle, and retained no secrets in
evidence.

No manual Dashboard application, persistent shared-environment application,
migration-history repair, activation, production data/credentials, deployment,
release, cache, Live Share, public disclosure, or production state change
occurred. v1 behavior and the v285 runtime boundary remain unchanged.
