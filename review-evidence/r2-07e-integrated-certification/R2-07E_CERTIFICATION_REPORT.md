# R2-07E Disposable Integrated Certification Report

Status: `FAIL - MATERIAL CLOCK IMPLEMENTATION GAP`

Risk level: `LEVEL 3`

Certification baseline: `08e7abf01d22cb60fc88422c961104a952b9b7e9`

Branch: `feature/r2-07e-integrated-certification`

## Preconditions and governance

- PR #69 was squash-merged as
  `08e7abf01d22cb60fc88422c961104a952b9b7e9`.
- Its tree `708c6a7dad9b65248f90ae566616f6be50101439` exactly matches
  remediated PR head `72e9d745e469cf1bb0ea713c8bbdbe19870483bb`.
- A retrospective independent exact-tree R2-07D technical review returned
  `PASS` with no material finding.
- The PASS occurred after merge. The user explicitly ratified a governance
  exception on 2026-08-10 so disposable R2-07E certification could begin.
  The historical pre-merge review chronology remains recorded as violated.
- Local and remote `main` matched and the worktree was clean before branching.

## Exact-SHA binding

The complete ordered migration/rollback list, exact Git-blob SHA-256 values,
runtime hashes, release/cache markers, and default-disabled capability values
are recorded in `BASELINE_MANIFEST.md`.

## Disposable environment and production boundary

The executed probe used one disposable `postgres:17-alpine` container, a
Supabase-compatible `auth.uid()`/JWT role harness, the complete repository
migration chain through R2-07D, one synthetic adult account, and no network
connection to any Supabase project. The password was a fixed synthetic-only
fixture value. No production credentials, data, user identity, youth/player
record, Vercel deployment, or production host was used.

## Material finding

R2-07E requires certification of online server-anchored clock commands and an
atomic ordered offline clock batch. Those capabilities are not integrated at
the certification baseline:

1. `lh_apply_game_clock_operation_v2(jsonb)` is defined only by the dormant
   R2-07A migration and always returns `r207_not_activated` for authenticated
   callers.
2. `lh_apply_game_clock_batch_v2(jsonb)` is also defined only by R2-07A and
   always returns `r207_not_activated`.
3. Enabling `public.r207_preview_control.preview_enabled` does not change either
   clock wrapper; no R2-07B/C/D migration replaces them.
4. `app.js` calls neither clock wrapper and has no R2-07 online-command or
   ordered offline-batch integration path.

The private R2-07A certification helper exercises only individual
`start`, `pause`, and `set_remaining` operations. It is deliberately ungranted
to app roles and cannot substitute for the missing public command/batch and
durable client integration.

## Focused reproduction

Command:

`node tools/reproduce_r207e_clock_activation_gap.mjs`

Result: `4/4 CONFIRMED`; process exit `0` means the material gap was reproduced,
not that R2-07E passed.

- Preview-enabled exact migration chain leaves online clock wrapper dormant.
- Preview-enabled exact migration chain leaves offline clock-batch wrapper
  dormant.
- No post-R2-07A migration replaces the dormant wrappers.
- Client runtime has no clock-command/batch path.

The disposable container was removed and exact-name residue was zero.

## Certification disposition

Mandatory clock scenarios cannot be executed through the intended public and
client contracts. This blocks:

- initialize/start/pause/resume/persist/advance/correct/complete integration;
- concurrent start/start and delayed pause/start;
- unchanged-base atomic offline batch;
- changed-base all-or-nothing conflict;
- batch replay/prefix behavior;
- completion freeze and tombstone rejection through the integrated path;
- two-context browser offline/reconnect clock replay;
- clock latency, lock, throughput, and query-plan certification.

Per the authorized stop rule, the remaining migration, operation-identity,
game/event/conflict, queue, account-switch, revocation, future-schema,
error-sanitization, RLS/privacy, Live Share, browser/mobile, performance,
storage-bound, and complete-regression certification matrices were not run
after this material defect became reproducible. Prior A-D evidence is preserved
but is not promoted to an R2-07E PASS.

Certification gates executed: `1`; passed: `0`; failed: `1`.
Focused reproduction assertions: `4/4 CONFIRMED`.

## Smallest remediation required

Create a separate Level 3 clock-integration remediation ticket and branch from
current `main` that does only the following:

- replace both dormant public clock wrappers behind the existing default-off
  Preview/capability boundary;
- implement server-anchored individual commands and atomic ordered batches
  with permanent operation IDs, exact clock/status/lifecycle bases, stable
  replay, universal operation-then-game lock order, tombstone precedence, and
  no device lease;
- connect the existing local-first durable tracked-clock queue to the new
  wrappers without changing production defaults or legacy production writes;
- cover start/pause/resume semantics, position correction, period/completion
  interactions, unchanged/changed-base batches, invalid-middle-command atomic
  rollback, replay/prefix behavior, account switch, revocation, deletion, raw
  error sanitization, and two-context offline/browser flows;
- obtain independent exact-head Level 3 PASS and merge before rerunning R2-07E
  from a new exact merged-main SHA.

No production activation, migration application, deployment, release/cache
change, R2-07F execution, or unrelated redesign is part of that remediation.

## Cleanup and production confirmation

- Disposable PostgreSQL container residue: `ZERO`.
- Synthetic external resources: `NONE CREATED`.
- Production Supabase contacted or mutated: `NO`.
- Production Vercel/GitHub Pages deployed or mutated: `NO`.
- Release/cache/runtime markers changed: `NO`.
- R2-07 capabilities activated in production: `NO`.
- R2-07F started: `NO`.

Final disposition:

`R2-07E INTEGRATED CERTIFICATION FAILED - PRODUCTION RELEASE BLOCKED`
