# Rollback Proof

## Exact rollback

Use `staging-rollback.sql`, which drops only:

- Six public `lh_*` RPC wrappers.
- The private `lh_trust_private` schema and helpers.
- The 21 additive `public.lh_*` tables.

It does not target legacy `games`, `events`, `teams`, or `roster_players`.

## Rehearsal result

The rollback was rehearsed in an isolated PGlite database after:

1. Creating four synthetic legacy sentinel tables and rows.
2. Applying the Trust Spine migration.
3. Running all 24 SQL acceptance groups inside their rollback transaction.
4. Applying the staging rollback.

Final raw result:

```text
MIGRATION: PASS
TRUST_SPINE_TABLES: 21
SQL_ACCEPTANCE: {"suite":"LaxHornet Trust Spine Release 1","fixtures":"synthetic","transaction":"rolled_back","sqlTestsPassed":24}
ROLLBACK: PASS
TRUST_SPINE_TABLES_AFTER_ROLLBACK: 0
LEGACY_SENTINELS_AFTER_ROLLBACK: {"games":1,"events":1,"teams":1,"roster_players":1}
```

See `test-results/pglite-final-pass.log`.

## Harness qualification

PGlite does not bundle Supabase's `pgcrypto` extension. The compatibility runner
therefore:

- Removes only the `CREATE EXTENSION pgcrypto` statement from its in-memory
  copy.
- Supplies a deterministic `extensions.digest(bytea, text)` shim.
- Supplies an `auth.uid()` shim and expected role/schema visibility.

The checked-in migration is not rewritten. This rehearsal validates migration
execution, authorization/operation behavior, tests, and object cleanup. It does
not validate real `pgcrypto`, Auth, PostgREST, Realtime, or network-edge
behavior.

The first two harness failures are preserved in `test-results/`:

- Missing `pgcrypto`.
- Missing `auth` schema visibility for the synthetic roles.

## App version

The implementation commit contained app version `v275`, but did not change
`version.json`, `service-worker.js`, or any runtime file. There was no runtime
cutover, so a database rollback does not require an app-version rollback.

## Offline operations and accepted revisions

No production runtime was wired to Trust Spine Release 1. Therefore no real
client can have queued Trust Spine operations or accepted Trust Spine revisions.

On a future staging cutover, rollback must first stop writes and decide whether
staging evidence must be archived. The provided rollback permanently removes
Trust Spine grants, operations, revisions, tombstones, conflicts, and audits.

## Remote rehearsal

Not performed. No isolated Supabase staging branch exists.
