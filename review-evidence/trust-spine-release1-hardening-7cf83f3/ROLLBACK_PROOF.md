# Rollback Proof

## Rehearsed path

The exact migration was applied to a fresh temporary Postgres-compatible
database, the 33-group transactional SQL acceptance suite ran, one sentinel row
was inserted into each legacy fixture table, and the exact rollback SQL ran.

Raw result:

```text
MIGRATION: PASS
TRUST_SPINE_TABLES: 20
SQL_ACCEPTANCE: {"suite":"LaxHornet Trust Spine Release 1","fixtures":"synthetic","transaction":"rolled_back","sqlTestsPassed":33}
ROLLBACK: PASS
TRUST_SPINE_TABLES_AFTER_ROLLBACK: 0
LEGACY_SENTINELS_AFTER_ROLLBACK: {"games":1,"events":1,"teams":1,"roster_players":1}
```

## Runtime treatment

Release 1 has no browser runtime cutover. No service worker, app version,
offline queue, or production client uses Trust Spine operations yet.
Consequently, rollback does not require an app downgrade or queue translation.

Accepted Trust Spine revisions and tombstones are intentionally destroyed by
the disposable-staging rollback. The rollback must not be run on production or
on staging evidence that needs to be retained.

## Remote status

Remote rollback rehearsal remains blocked because no disposable Supabase
staging branch was available. Production was not used as a substitute.

