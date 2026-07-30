# R2-06E Synthetic Runner Implementation

Status: `READY FOR INDEPENDENT REVIEW`

This change builds and tests the reviewed R2-06 synthetic verification runner.
It did not connect to Supabase production, create an Auth user, read or mutate
production data, apply a migration, deploy, publish a release, or change the
release-closeout decision.

## Architecture and entry points

- `tools/run_r206_synthetic_verification.mjs` is the only operator entry point.
  It supports `--dry-run`, `--execution-mode disposable`, and the separately
  gated `--execution-mode production --allow-production`.
- `tools/r206_synthetic_runner_core.mjs` owns the 21-action plan, hard limits,
  strict state machine, cleanup ledger, classified-result checks, evidence
  redaction, and fail-closed orchestration.
- `tools/r206_synthetic_production_adapter.mjs` contains the fixed production
  HTTP/browser surface. It accepts only the reviewed Supabase and application
  origins, bounded Auth Admin lifecycle calls, exact-scope reads, the two
  mutation RPCs, and fixed denial probes.
- `tools/r206_synthetic_disposable_adapter.mjs` runs the merged baseline plus
  the actual R2-06 and R2-06A migration definitions in disposable PGlite. It
  simulates only the Auth/session lifecycle that PGlite does not provide.
- `tools/fixtures/r206-synthetic-evidence-schema.json` defines the public,
  sanitized evidence envelope.

## Production gates

Production execution defaults to disabled and stops before credentials or
network access unless all of these inputs agree:

1. explicit `--execution-mode production --allow-production`;
2. a clean worktree at the full reviewed runner SHA;
3. exact project, API, application, runtime, Pages, marker, cache, migration,
   and catalog identities;
4. an unexpired private authorization artifact naming the exact SHA, matrix,
   limits, private store, and browser permission;
5. a fresh private preflight artifact produced through
   `supabase_production_readonly-2`;
6. runtime-injected publishable and secret keys, removed from the runner
   environment after capture.

Existing private-ledger or public-result targets are a stop condition. Initial
writes use create-new semantics, so a rerun cannot silently replace retained
evidence.

The runner never turns `releaseCloseoutApproved` on. Successful production
behavior and cleanup evidence still require a separate reviewed closeout.

## Mutation and cleanup boundary

The maximum production footprint is two non-deliverable synthetic Auth users,
three sequential sessions, two automatic profiles, one personal game, one
update of that game, zero events, zero Live Share tokens, one accepted durable
delete, one retained tombstone, and one private identifier ledger.

The only mutation RPCs are `laxhornet_sync_game(jsonb)` and
`laxhornet_delete_game_durable(jsonb)`. There is no arbitrary SQL interface or
generic table writer. Direct Data API calls are fixed negative authorization
probes and must produce no mutation.

After the first mutation, every state transition checkpoints the exact owned
objects in the private store. A failure moves to cleanup-only mode. Game
cleanup, when still needed, uses the reviewed durable-delete RPC while an
owned owner session remains active; sessions are then revoked, application
authority is probed, users are removed through Auth Admin, profile cascades
are verified, isolated browser directories are deleted, and exact integer-zero
mutable residue is required. Cleanup cannot enumerate or delete objects that
are not in the ledger.

Historical direct SQL cleanup, Auth-table deletion, refresh-token deletion,
and broad `r206-smoke-*` mutation are explicitly not part of this runner.
Reusing an older smoke tool or adding a cleanup fallback requires a new review.

## Evidence and credential handling

Passwords, email addresses, access tokens, refresh tokens, key material,
session/user/game/deletion identifiers, and browser paths remain outside the
public evidence. The private ledger stores identifiers and state but no
credentials. The public authorization, behavior, and cleanup files contain
only aggregate/classified results, an opaque private-record reference, and the
SHA-256 hash of the frozen private ledger. To avoid an impossible circular
hash, the private ledger binds canonical hashes of each public evidence payload
with only the recursive private-ledger hash/reference fields omitted; the final
public files then bind the exact frozen private-ledger file hash and opaque
reference.

## Verification result

- Adversarial unit suite: 25 focused checks passed during implementation.
- Disposable integration: passed the reviewed create/update/stale-delete/
  durable-delete/replay/conflict/stale-write/hydration/disclosure/cleanup
  sequence using the actual R2-06 and R2-06A RPC definitions.
- Disposable cleanup ended with zero Auth users, profiles, active sessions,
  games, events, and Live Share tokens, plus exactly one retained tombstone.
- The final canonical-plus-additive local regression passed `45/45`.
- Disposable evidence is labeled
  `disposable_verification_complete_not_production_evidence` and cannot satisfy
  production verification or release closeout.

The exact final PR SHA still requires independent Level 3 review. Any future
production execution requires a new, explicit, time-bounded authorization
artifact and fresh named read-only preflight artifact for that reviewed SHA.
