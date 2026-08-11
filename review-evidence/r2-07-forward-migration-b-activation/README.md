# R2-07 Forward Migration B Activation Artifact

Status: `IMPLEMENTED — EXACT-HEAD LEVEL 3 REVIEW REQUIRED`

Risk: `LEVEL 3 — MIGRATION, RLS/GRANTS, SYNCHRONIZATION, RECOVERY, RELEASE CONTROL`

Starting main: `b7269194a4ce8b9068b0d46c44d840efc4048c69`

R2-07E evidence: `c2726b0c1cd979a7af2b04bc9a0a25865f4636ea`

## Why PR #73 stopped

Historical production preflight PR #73 proved the certified 17-migration
schema was present, the capability was dormant, all R2-07 evidence counts were
zero, v1 remained active, and direct legacy mutation remained available. It
correctly stopped before the first production mutation because no reviewed
Forward Migration B or production-capable client configuration existed. PR #73
remains unchanged historical failed-preflight evidence and supplies no
execution authority for this artifact.

## Approved activation model

The inert cutover-gate migration first binds every canonical game, event, and
clock mutation to a shared transaction advisory gate while preserving legacy
mode. The additive activation migration then binds to the exact certified migration inventory,
relation shape, public RPC definitions, RLS/FORCE RLS state, grants, dormant
capability, legacy v1 definition, and zero pre-activation R2-07 evidence. Any
drift raises a stable `R207_ACTIVATION_PREFLIGHT_FAILED:*` error before cutover.
The relation binding includes durable game tombstones, and a separate exact
policy-definition digest prevents permissive-policy substitution.

Within one PostgreSQL transaction it acquires the exclusive side of that gate, gates
the canonical game/event/clock tables, performs the final legacy
status-to-lifecycle reconciliation, installs the bounded v1 rejection stub,
revokes unversioned game/event/clock authority, retains reviewed v2 and durable
tombstone contracts, marks reviewed v2 RPC transactions, changes cutover mode
from `legacy` to `v2`, and finally enables the server capability. PostgreSQL DDL,
ACL, function replacement, data update, and capability update commit or roll
back together.

Legacy writers already in flight hold the shared gate and drain before
activation. Legacy RPCs or direct DML arriving after activation owns the
exclusive gate wait, then deterministically reject when they observe `v2`
mode. This closes both concurrency orderings around the cutover boundary.

## No dual authority and stale v1

The committed postflight requires all of the following at once:

- canonical capability enabled with `productionActivation: true`;
- v1 `laxhornet_sync_game(jsonb)` executable only as a rejection stub;
- v1 response `rejected / client_upgrade_required / update_required`;
- no game/event direct DML for app roles;
- no legacy event delete, game-delete wrapper, or absolute-snapshot clock RPC;
- reviewed v2 game, event, clock, conflict read, and resolution RPCs retained.

The v1 response contains no game identifier, stored row, raw exception, or
private database detail. The durable client classifier keeps the operation and
shows actionable update copy. The production-capable runtime profile treats
the server capability response as authoritative, uses legacy mutation only
after an explicit dormant response, and refuses v1 fallback after confirmed
production activation. After authoritative activation, fresh-load, reconnect,
new-game creation, field changes, events, and clock startup all route through
reviewed v2 contracts; pending legacy game writes are superseded locally.
The production profile also durably queues v2 game creation, events, and clock
commands while offline without requiring a live capability request; reconnect
processes the retained intent only through the authoritative v2 gate.
The checked-in default remains dormant until a separate
R2-07F deployment authorization installs the reviewed profile.

## Recovery

The companion recovery SQL is intentionally not a reverse migration. It
changes the gate to `fail_closed`, disables the capability, revokes v2 mutation execution, retains normal reads
and Live Share, retains the v1 upgrade-required stub, and reasserts every
legacy mutation revocation. It works after evidence exists and never restores
v285 last-write-wins authority. Repair/reactivation requires a new reviewed
forward artifact.
Recovery first takes an exclusive lock on the capability relation. Because
every v2 writer reads that relation in its transaction, recovery drains
in-flight writers and cannot complete ahead of a later v2 commit.

## Disposable certification

`node tools/test_r207_forward_migration_b_activation.mjs` reconstructs the
complete certified 18-migration pre-activation chain in fresh PostgreSQL 17 containers using
synthetic adult-only fixtures. It proves:

- exact preconditions accept and drift refuses;
- function-definition bindings canonicalize CRLF/LF newlines before hashing;
- v1 active/v2 dormant before cutover;
- atomic v2 enable plus v1/direct disable;
- bounded stale-v285 rejection with no mutation;
- idempotent game creation, metadata, event, clock command, clock batch,
  conflict, and resolution paths;
- RLS/FORCE RLS, non-enumeration, tombstone precedence, and Live Share bytes;
- exact policy/RLS drift refusal and canonical Git-blob runtime hashes;
- deterministic activation replay refusal;
- injected post-capability failure rolls the entire transaction back;
- activation drains an in-flight legacy writer before v2 authority commits;
- stale legacy RPC and direct DML arrivals during activation cannot commit
  after v2 authority;
- reconnect processes retained game creation before dependent clock intent;
- interrupted `syncing` operations recover as retryable durable work;
- game-create idempotency uses a server-derived canonical request hash;
- release-manifest hashes match the exact activation, recovery, runtime, relation,
  and policy bindings;
- post-evidence recovery fail-closes without restoring legacy authority;
- zero disposable container residue.

Focused result: `40/40 PASS`. Complete local Level 3 regression result:
`70 passed, 0 failed`. Exact-head CI and independent review remain separately
required on the final pushed SHA.

## Production boundary

No production connector was used for mutation. No migration was applied, no
capability or grant changed, no runtime was deployed, no release/cache marker
changed, no production data was used, and no production smoke began. This
artifact requires a fresh reviewed R2-07F authorization and preflight before
any production action.
