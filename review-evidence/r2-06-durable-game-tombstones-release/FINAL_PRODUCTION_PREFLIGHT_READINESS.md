# R2-06C final production preflight and synthetic-verification readiness

Date: 2026-07-30

Captured at: `2026-07-30T17:47:02Z`

Risk: Level 3 — production release verification, authorization, cleanup,
disclosure, and release-closeout readiness

Status:
`R2-06 FINAL PREFLIGHT PASSED — SYNTHETIC VERIFICATION AUTHORIZATION REQUIRED`

## Authority and non-mutation boundary

This task used repository reads, local/disposable tests, GitHub deployment
metadata, the public production Pages endpoint, and the named
`supabase_production_readonly-2` connection only.

It did not deploy, apply or roll back a migration, change Supabase, create or
change an Auth user, create/read/update/delete a production game or event,
create a tombstone or Live Share token, run synthetic verification, perform
cleanup, or change release-closeout fields.

Only aggregate production counts and catalog/function definitions were read.
No real youth, player, family, roster, game, event, email, or Auth-user row was
returned or enumerated.

## Repository baseline

- `origin/main`: `77f3cf4b0c86c7ce1cc44a42fafa9f3b111e9f3b`.
- Local HEAD after a clean fast-forward:
  `77f3cf4b0c86c7ce1cc44a42fafa9f3b111e9f3b`.
- Required R2-06B merge present: yes.
- Unmerged R2-06B remote branch state used: no; the remote feature branch was
  deleted and the work ran from merged `main`.
- Release manifest: no explicit `schemaVersion` property; its current schema is
  enforced by `tools/validate_release_manifest.mjs`.
- Pages allowlist schema: `schemaVersion: 1`.
- R2-06 release control: runtime deployed, migrations applied, and catalog
  verified are true. Synthetic authorized/completed, cleanup completed, and
  release closeout approved remain false.

## Focused local verification

- Release manifest validator: pass — runtime/catalog reconciled, closeout
  blocked.
- Release-manifest reconciliation: `8/8`.
- Phase-aware preflight characterization: `22/22`.
- Phase-aware containment: `33/33`.
- Pages deployment contracts: `21/21`.
- Durable tombstone contracts: pass.
- Tombstone migration and reverse-order rollback: `13/13`.
- Disposable PostgreSQL concurrency: `8/8`.
- Production-phase canonical preflight: every row passed except the intentional
  R2-06 closeout-readiness gate.
- Complete canonical-plus-additive regression: `43/43`. A subsequent
  documentation-only clarification kept exact identifiers out of the public
  repository; it did not affect shared behavior, so the complete suite was not
  rerun.
- `git diff --check`: pass before and after documentation changes.

## Production runtime and Pages boundary

GitHub Pages run `30559099199` completed all three jobs successfully:

- Build allowlisted Pages artifact;
- Deploy allowlisted artifact;
- Verify Pages production boundary.

Both retained workflow artifacts identify `main` source
`2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`.

Fresh public-endpoint verification passed:

- release marker: `v284`;
- service-worker cache: `laxhornet-v284`;
- allowlist: 47 deployed files;
- all 47 deployed files matched size and SHA-256;
- 548 tracked non-allowlisted paths were unavailable;
- 10 explicit internal-path probes were unavailable;
- no unexpected public file was observed.

## Migration and catalog state

The production ledger contains the complete expected 11-entry sequence. Its
last two entries are present exactly once and in order:

1. `20260730134439_durable_game_tombstones`;
2. `20260730151714_durable_game_tombstone_concurrency`.

No migration appeared after the concurrency migration. The release manifest
records no pending production migration, and all six R2-06/R2-06A
forward/rollback/pgTAP identities match their reviewed SHA-256 values.

Fresh read-only catalog inspection confirmed:

- all 11 expected tombstone columns;
- all 8 expected constraints;
- all 4 expected indexes, including the partial team/player/deleted index;
- RLS enabled and forced;
- the single authenticated SELECT policy;
- anonymous table/RPC denial;
- authenticated tombstone SELECT only, with no insert/update/delete;
- authenticated execution only on the three intended public RPCs;
- no anon/authenticated/service-role use of the private helper;
- all four functions retain fixed empty search paths and expected security
  modes;
- all four whitespace-normalized function body MD5 values match the
  reconciliation evidence;
- the guarded write, durable delete, and direct-write trigger helper each use
  the same namespaced advisory lock before reading tombstones;
- the trigger exists and is enabled.

## Bounded aggregate state

- Tombstones: `0`.
- `r206-smoke-*` tombstones: `0`.
- `r206-smoke-*` games: `0`.
- `r206-smoke-*` events: `0`.
- `r206-smoke-*` Auth users: `0`.
- `r206-smoke-*` profiles: `0`.
- `r206-smoke-*` active sessions: `0`.
- `r206-smoke-*` Live Share tokens: `0`.

These were count-only checks. No matching or nonmatching row content was
returned.

## Canonical release-control result

Runtime/database/catalog readiness: pass.

Exact failing gate:

`R2-06 release closeout readiness`

Exact messages:

1. `synthetic verification authorization evidence is absent`;
2. `synthetic production behavior evidence is absent`;
3. `synthetic cleanup evidence is absent`.

The release-control evaluator reports `runtimeDatabaseReady=true`,
`closeoutReady=false`, and `releaseComplete=false`.
`releaseCloseoutApproved=false` remains a separate final approval state; it is
not yet eligible to be changed and is not emitted as a closeout-readiness
message until the three evidence prerequisites are complete.

Broad result:
`RUNTIME/DATABASE/CATALOG READY — SYNTHETIC VERIFICATION AUTHORIZATION REQUIRED`.

## Synthetic-plan assessment

The prior plan was directionally safe but not authorization-ready because it
left Auth creation at `0 or 1`, did not define credential handling or exact game
fields, made authenticated wrong-account coverage optional, and did not
explicitly enumerate recap/public-file/direct-table checks.

`SYNTHETIC_VERIFICATION_AUTHORIZATION_PLAN.md` now fixes those gaps. The exact
future scope is:

- two new temporary Auth users and two automatic profiles;
- three sequential sign-in sessions, all revoked before account deletion;
- one personal game inserted once, updated once, then durably deleted;
- zero event rows;
- zero Live Share tokens, team/player/roster/claim/access-request/notification
  or Storage rows;
- one permanent tombstone, updated once by same-ID replay;
- three permanent sanitized public-repository evidence files and one permanent
  access-controlled private retained-identifier record;
- zero mutable/Auth residue after cleanup.

The repository is public. The three committed evidence files must therefore be
sanitized and hash-bound, while exactly one record in an authorization-named
access-controlled private store retains the exact synthetic email/UUID/game/
deletion/device identifiers. Execution must stop if that private store is not
named and available.

RPC-level conflict behavior and normal clean-session hydration are included.
Injected client conflict recovery is not included because the repository has
no reviewed production harness for that journey; existing local tests remain
the evidence until a separate reviewed harness and authorization exist.

The exact action matrix, retained fields, cleanup sequence, rollback limits,
and stop conditions are in
`SYNTHETIC_VERIFICATION_AUTHORIZATION_PLAN.md`.

## Remaining authority

No production execution may begin until an authorization explicitly approves:

- the two Auth users/profiles and three sequential sessions;
- the one game create/update/delete sequence;
- the one permanent tombstone and same-ID replay update;
- the exact denial/disclosure/read-only probes;
- session revocation, account/profile cleanup, and local-state cleanup;
- permanent retention of exactly one synthetic tombstone;
- use of a reviewed exact-SHA synthetic-only runner and secure Auth Admin
  route;
- one named access-controlled private evidence store for exact retained
  identifiers, with only hashes and an opaque evidence reference committed to
  the public repository.

Release-manifest evidence bindings and release closeout remain separate,
subsequent Level 3 review/approval actions.
