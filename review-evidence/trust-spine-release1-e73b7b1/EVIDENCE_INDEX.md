# LaxHornet Trust Spine Release 1 Evidence

Evidence date: 2026-07-20

Implementation commit:
`e73b7b1b2546b1420f3f13b9cfffd4ecb4488616`

Pre-sprint base:
`ebfdff80818a2739a07a19ca45073af03588151b`

GitHub:

- [Implementation commit](https://github.com/degrasse-mastermind/LaxHornet/commit/e73b7b1b2546b1420f3f13b9cfffd4ecb4488616)
- [Full comparison against the pre-sprint base](https://github.com/degrasse-mastermind/LaxHornet/compare/ebfdff80818a2739a07a19ca45073af03588151b...e73b7b1b2546b1420f3f13b9cfffd4ecb4488616)

## Review order

1. `CODEX_FINAL_REPORT.md`
2. `trust-spine-release1.diff`
3. `final-staging-migration.sql`
4. `rpc-definitions.sql`
5. `executable-staging-tests.sql`
6. `test-results/contract-tests.log`
7. `test-results/pglite-final-pass.log`
8. `STAGING_DEPLOYMENT_EVIDENCE.md`
9. `RUNTIME_EVIDENCE.md`
10. `ROLLBACK_PROOF.md`
11. `EXPORT_AND_LIVE_SHARE_EVIDENCE.md`
12. `staging-rollback.sql`

## Packaged files

- `trust-spine-changed-files.zip`: the nine files changed by the implementation
  commit, extracted directly from Git.
- `implementation-files/`: readable copy of those nine exact commit files.
- `runtime-flow/`: authorization, mutation, offline-sync, Live Share/export, and
  sync-state documents from the same implementation commit.
- `test-results/`: raw pass/failure logs plus the compatibility runner used for
  the isolated PGlite rehearsal.
- `LaxHornet-Trust-Spine-Release1-Evidence-e73b7b1.zip`: complete review bundle.
- `manifest.sha256`: integrity hashes for the evidence files.

## Evidence boundary

This bundle proves the checked-in implementation and an isolated local database
rehearsal. It does **not** prove a remote Supabase staging deployment:

- The connected Supabase project has only its default `main` branch.
- It has no `lh_*` Trust Spine tables or functions.
- Its migration history is empty.
- No production migration was applied.
- No runtime cutover occurred.

The implementation should therefore be revised and then tested on a disposable
Supabase staging branch before any pilot.
