# R2-07 Migration and Rollback Plan

Status: `REVIEW REMEDIATION — INDEPENDENT EXACT-HEAD REVIEW PENDING`

Risk level: `LEVEL 3 — SCHEMA, RLS, RPC, SYNCHRONIZATION, RECOVERY`

Remediation baseline: `0e90e3b4017d65ef35bdf95fc165b3379a4c6844`

This document describes future migration work. No migration file was created or
applied by the design task.

## 1. Migration workflow and boundaries

LaxHornet uses ordered imperative migrations under `supabase/migrations/`.
R2-07 implementation must create new timestamped additive migrations through
the repository's reviewed local workflow. It must not rewrite, rename, reorder,
or squash any existing migration, including R2-06/R2-06A.

Implementation validation uses a disposable local database/PGlite or approved
non-production target. Linked/production `db push`, migration application,
production SQL, connector mutation, and release activation are prohibited
without a separate release ticket and explicit authorization.

The forward work is intentionally split into a schema/contract migration and a
later activation migration. A database containing the schema migration but not
the activation migration continues to behave as v285 and does not accept v2
production writes.

## 2. Forward migration A — additive schema and dormant contracts

### 2.1 `games` columns

Add:

| Column | Definition / constraint |
|---|---|
| `game_revision` | `bigint not null default 1`, check `>= 1` |
| `metadata_version` | `bigint not null default 1`, check `>= 1` |
| `score_version` | `bigint not null default 1`, check `>= 1` |
| `status_version` | `bigint not null default 1`, check `>= 1` |
| `roster_context_version` | `bigint not null default 1`, check `>= 1` |
| `sharing_version` | `bigint not null default 1`, check `>= 1` |
| `lifecycle_state` | text, values `active`, `paused`, `completed`; backfill from legacy `status` |
| `score_for` / `score_against` | integer, nonnegative, default `0` |
| `score_known` | boolean, existing rows `false`; new v2-created rows `true` |
| `final_score_for` / `final_score_against` | nullable nonnegative integer pair; both null or both non-null |

Backfill mapping:

- legacy `status = complete` -> `lifecycle_state = completed`;
- every other current legacy status, including `in-progress`, -> `active`;
- existing versions -> `1`;
- existing scores -> unknown, because v285 does not round-trip score columns;
- no local/private score is inferred from production rows or overwritten.

Use constant defaults and explicit validation appropriate to the actual
PostgreSQL version. Implementation must measure lock duration on production-
sized disposable fixtures before release. If a table rewrite is observed,
split add/backfill/constraint validation into bounded steps.

Do not drop or change the current `status`, `saved_at`, ownership, sharing, RLS,
or tombstone columns in this phase.

### 2.2 Clock additions

- Widen `lh_game_clock_states.revision` from integer to bigint only after local
  compatibility tests prove functions/JSON/client parsing remain exact.
- Add `anchor_server_at timestamptz` and
  `anchor_clock_seconds_remaining integer` for command-based projection.
- Backfill stopped clocks from their current remaining value and
  `server_updated_at`. Running legacy clocks are preserved but classified for
  first-v2-hydration review; the migration must not invent elapsed time.
- Add constraints that anchor seconds are nonnegative and within the configured
  period duration.

### 2.3 `game_sync_operations`

Recommended columns:

- `operation_id uuid primary key default gen_random_uuid()`;
- `actor_user_id uuid not null` without account-lifecycle cascade;
- `client_operation_id text not null`;
- `game_id text not null` without FK to `games`, because durable tombstones
  outlive the game row;
- `operation_type text not null` from an explicit allowlist;
- `request_hash text not null`;
- `changed_fields text[] not null default '{}'`;
- `outcome_class text not null` (`accepted`, `merged`, `conflicted`,
  `deleted`, `rejected`);
- `outcome_code text not null`;
- `conflict_id uuid` nullable, added with a deferred FK after conflict table
  creation if needed;
- `result_versions jsonb not null default '{}'` under an exact version-key
  allowlist;
- `canonical_result jsonb not null` under a response allowlist and size limit;
- `client_created_at timestamptz` nullable;
- `server_received_at timestamptz not null default statement_timestamp()`.

Constraints/indexes:

- unique `(actor_user_id, client_operation_id)`;
- field/operation/code length bounds;
- GIN is not required for arbitrary payload because arbitrary payload is
  prohibited;
- index `(game_id, server_received_at desc)` for bounded diagnostics;
- index `(outcome_class, server_received_at)` only if query-plan tests justify
  it; avoid indexing private values.

Append-only trigger blocks ordinary update/delete. No client table DML.

### 2.4 `game_sync_operation_attempts`

Store only an identity primary key, actor, client operation ID, canonical
operation ID, safe attempt code (`idempotent_replay` or
`duplicate_operation_id_payload_mismatch`), and received timestamp. No payload,
device ID, response body, field values, or headers.

Indexes: `(actor_user_id, client_operation_id, received_at desc)` and a bounded
retention index on `received_at`. Attempts are diagnostic and may have a shorter
retention than conflict evidence.

### 2.5 `game_field_changes`

Recommended columns:

- server UUID primary key;
- canonical operation ID FK with `on delete restrict` during normal retention;
- game ID;
- `field_group` allowlist: metadata, score, status, roster_context, sharing;
- `base_version bigint`, `result_version bigint`, each valid for its group;
- nonempty, sorted, duplicate-free `changed_fields text[]` under a field/group
  allowlist;
- recorded timestamp.

Unique `(operation_id, field_group)`. Critical lookup index:
`(game_id, field_group, result_version)`, including or cheaply retrieving
`changed_fields`. This is the proof used for non-overlap merge.

Append-only trigger; no direct client access.

### 2.6 `game_conflicts`

Recommended columns:

- `conflict_id uuid primary key`;
- `account_id uuid not null` copied from canonical personal owner/account for
  retention/audit scope without an `auth.users` cascade; the copy is not an
  authorization grant, especially for a team-scoped game;
- game ID, optional team ID and roster player ID snapshots;
- actor user ID and canonical operation ID;
- optional parent conflict ID with `on delete restrict`;
- conflict type and field-group allowlists;
- `client_base_version bigint`, `current_server_version bigint`;
- nonempty allowlisted `overlapping_fields text[]`;
- `current_values jsonb`, `proposed_values jsonb`, each allowlisted and <= 4
  KiB serialized;
- `audit_metadata jsonb` restricted to safe protocol/operation codes;
- `created_at timestamptz not null default statement_timestamp()`.

Do not FK `game_id` to `games`: the conflict must survive game deletion through
its retention window. Do not store a mutable status, resolved timestamp, share
code, player snapshot, event history, raw request, token, device ID, or names.

Indexes:

- unique `operation_id` where one operation creates at most one conflict;
- `(account_id, created_at desc)`;
- `(game_id, created_at desc)`;
- `(team_id, roster_player_id, created_at desc)` where team scope exists;
- parent conflict index.

Append-only trigger blocks update. Ordinary delete is blocked; only the
separately controlled retention procedure may delete an expired conflict and
its dependent records.

### 2.7 `game_conflict_resolutions`

Recommended columns:

- server UUID primary key;
- conflict ID FK;
- resolver user ID;
- permanent client resolution operation ID and server request hash;
- action allowlist: `keep_server`, `apply_proposed`, `apply_patch`, `dismiss`,
  `superseded_by_delete`;
- outcome code;
- result versions allowlisted JSON;
- safe accepted field names; no arbitrary patch body;
- `resolved_at timestamptz not null default statement_timestamp()`.

Unique `(resolver_user_id, client_resolution_operation_id)`. Index
`(conflict_id, resolved_at desc)`. Append-only; current status is derived from
the terminal result rather than written into the conflict.

### 2.8 Clock command operations

Either extend `game_sync_operations` with clock operation types and a private
clock-command detail table, or create a dedicated equivalent. The chosen
implementation must provide permanent operation ID, hash replay, base clock
version, command, bounded arguments, ordered offline-batch membership, assigned
result version, and no raw snapshot logging.

The command-detail table is append-only and has unique operation IDs plus
`(game_id, batch_id, sequence)` uniqueness. A batch applies completely or not
at all.

## 3. Functions and triggers in migration A

Create dormant/versioned contracts:

- `laxhornet_sync_game_v2(jsonb)`;
- `lh_apply_game_clock_operation_v2(jsonb)`;
- `lh_apply_game_clock_batch_v2(jsonb)`;
- `laxhornet_resolve_game_conflict_v1(jsonb)`;
- bounded read RPC(s) for authorized open conflict summaries when direct RLS
  reads cannot express the derived status safely;
- private helpers for authorization, hash/replay, field allowlists, current
  versions, non-overlap proof, conflict insertion, and canonical response.

All functions default to `r207_not_activated` until the activation gate is
enabled. The dormant state must be a committed server-side control, not merely
a client flag.

Use the existing R2-06 namespaced per-game transaction lock. Every game, clock,
status, event-boundary, resolution, and delete function acquires it before
tombstone/game/clock reads. The universal row order is tombstone, game,
clock, then operation/conflict append. No function takes two game locks.

Each write/read/resolution contract may perform a preliminary operation-ID/hash
lookup for routing, but it must not return a stored canonical result before the
shared game lock, authoritative tombstone check, and current canonical
authority check. After acquiring the lock, it rechecks the operation record.
The first simultaneous valid request stores one mutation and canonical result;
an identical waiter returns that replay without entering semantic mutation or
surfacing the unique `(actor_user_id, client_operation_id)` constraint. A
different hash returns `duplicate_operation_id_payload_mismatch` without the
stored request/result and without a game conflict.

Keep the R2-06 tombstone trigger. Add no trigger that mutates versions behind a
v2 function's accounting. Defense-in-depth direct-write triggers may reject
unversioned writes but must not manufacture missing base versions.

## 4. RLS, grants, and function security

For every new public table:

1. Enable and force RLS.
2. Revoke all table privileges from `PUBLIC`, `anon`, and `authenticated`.
3. Grant no client DML on operation/change/attempt tables.
4. If direct conflict reading is retained, grant `SELECT` to `authenticated`
   only and add a policy permitting:
   - for a personal game, current canonical personal-game owner/account
     authority;
   - for a team-scoped game, current canonical team/roster tracking authority,
     including `laxhornet_can_track_roster_player` where applicable; copied or
     historical creator/owner/account identity alone is insufficient;
   - the already justified, explicitly allowlisted, non-public, audited bounded
     platform reviewer predicate;
   - no app-role direct conflict row when an authoritative game tombstone
     exists; the row remains retained but its private values are not disclosed.
5. Grant no conflict access to `anon`; public/Live Share functions select none
   of the new tables.
6. Conflict insert/resolution occurs only through reviewed RPCs.

The same personal-versus-team rule applies in conflict read, replay,
resolution, and retention-list RPCs. Loss/revocation of current authority
returns a non-enumerating denial and discloses no conflict existence, stored
canonical result, raw request, current value, or proposed value. Live Share and
anonymous access remain excluded. Retention eligibility is a maintenance fact,
not an access grant. Conflict read/replay/resolution RPCs acquire the shared
game lock and check the tombstone before returning private content; an
authorized deleted-game request returns only `game_deleted`.

Privileged helpers belong in an existing or new non-exposed private schema.
Every privileged function sets an empty search path, fully qualifies objects,
derives `auth.uid()`, checks canonical authorization, and receives explicit
execute grants. Revoke default `PUBLIC` execute on every created/replaced
function. Do not use user-editable metadata for authorization.

At activation, revoke authenticated direct INSERT/UPDATE/DELETE on `games` and
direct correction/delete paths on legacy `events` that would bypass versions.
Keep only required SELECT access and approved RPC execute grants. Verify both
Postgres grants and RLS; either layer alone is insufficient.

The May 2026 Supabase Data API exposure change means a new table may not be
automatically reachable. The migration must explicitly test the project's
Data API exposure and grants instead of assuming schema placement is enough.

## 5. Data validation before activation

The schema/contract PR must prove on a disposable production-shaped dataset:

- every games row has versions `1` and a valid lifecycle mapping;
- no score is marked known solely because backfill defaulted it to zero;
- final score pair constraints hold;
- version and changed-field constraints reject malformed rows;
- all new tables have RLS enabled and forced;
- `anon` has no table/function path to private records;
- authenticated direct DML is absent where required;
- public wrappers expose only intended functions;
- conflict JSON allowlists and 4 KiB limits fail closed;
- operation ID/hash replay and mismatch behave deterministically;
- preliminary replay lookup never bypasses the locked tombstone and current-
  authority checks, and the canonical operation is rechecked after the lock;
- simultaneous identical first-seen requests produce one mutation/result and
  one replay with no uniqueness error; simultaneous same-ID/different-hash
  requests return one safe mismatch and create no duplicate conflict/attempt
  evidence beyond the approved bounded security-attempt row;
- shared advisory-lock key and lock-before-read ordering match R2-06A;
- existing tombstone/write/delete behavior remains byte/semantics compatible;
- accepted/conflict replay after deletion returns only authorized
  `game_deleted`, while revoked personal or team authority returns only
  non-enumerating denial;
- direct conflict SELECT after deletion returns no row to app roles, and the
  bounded read RPC returns only authorized `game_deleted` with no old values;
- personal and team conflict RLS/RPC tests prove that historical creator or
  copied owner/account identity cannot preserve team-game access after current
  roster authority is revoked;
- no migration assumes an empty table.

## 6. Client/data cutover prerequisites

Activation cannot occur until an R2-07-capable runtime is reviewed and
deployed with dormant capability handling. That client must:

- hydrate all version columns without dropping local-only fields;
- preserve `score_known=false` and initialize from local evidence explicitly;
- never send a v2 request without required bases;
- persist receipts/conflicts before compacting operations;
- retain a stale-service-worker upgrade-required path;
- handle lifecycle projection from legacy `status` during the transition;
- contain no direct version-bypassing event/game mutation;
- pass two-device, offline, out-of-order, account-switch, and timeout tests.

## 7. Forward migration B — activation

This is a separate release artifact and separate authorization.

Activation transaction/order:

1. Verify exact reviewed application SHA, schema migration identity, current
   R2-06/R2-06A identity, zero schema drift, and green certification evidence.
2. Reconcile the latest legacy `status` values into `lifecycle_state` one final
   time while writes are gated.
3. Enable the server R2-07 capability.
4. Make v2 RPCs accept writes.
5. Replace `laxhornet_sync_game(jsonb)` with a stable response containing
   `client_upgrade_required`; do not silently call v2.
6. Revoke direct authenticated game mutations and any legacy event mutation
   bypasses.
7. Preserve read compatibility, tombstone reads, and the actionable v1 stub.
8. Run only separately authorized bounded verification and record release
   evidence.

There must be no observable window in which both unversioned v1 writes and
version-aware v2 writes are accepted.

## 8. Rollback design

### Pre-activation rollback

Permitted only when the server capability remains disabled and validation
proves:

- no accepted v2 operations;
- no game field-change rows;
- no conflicts or resolutions;
- no clock command rows;
- no client depends on hydrated new fields.

Then a reviewed reverse migration may drop dormant functions/tables/columns in
dependency order. It must not change R2-06/R2-06A tombstones, triggers,
functions, or migration history.

If any v2 row exists, destructive schema rollback is refused even before
production activation; use a forward repair.

### Post-activation rollback

Destructive database rollback is not supported. Version/conflict/operation
history is authoritative evidence. Never restore v285's unversioned write
behavior over versioned rows.

Allowed emergency actions under separate authority:

1. Disable new v2 writes fail-closed while keeping reads and local capture.
2. Roll the application back only to the latest R2-07-compatible runtime that
   understands versions and conflicts.
3. Keep the v1 upgrade-required stub, version columns, operation history,
   conflict records, and tombstones.
4. Repair forward with a new reviewed additive migration/RPC.

An application-only rollback to v285 may be used only as a local/offline
continuity shell with cloud writes disabled. It must not regain unversioned
server mutation authority.

### Data recovery

- Accepted operation rows and field changes reconstruct which fields changed
  at each group revision, but they are not a full game event store.
- A recovery procedure must snapshot affected rows, verify operation/version
  chains, and produce a forward correction; it must not decrement versions.
- Open conflicts remain unresolved evidence during recovery.
- Tombstones remain permanent and always outrank recovery writes.
- Retention purge is suspended during an incident/evidence hold.

## 9. Legacy sunset

- Keep the v1 `client_upgrade_required` stub for at least 90 days and one full
  coordinated release after activation.
- Count calls without logging content or device identifiers.
- Removal requires zero calls across the approved observation window, explicit
  David approval, exact-head review, and a separate migration/release decision.
- Stale service-worker clients must continue receiving an actionable response,
  so indefinite retention of the small stub is acceptable if cheaper and safer.

## 10. Production authorization boundary

This design does not authorize either forward migration, the activation
migration, a Supabase command, a linked local reset, production preflight,
production verification, runtime deployment, or release marker change.

Final migration design disposition:
`R2-07 DESIGN REMEDIATED — EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW PENDING`.
