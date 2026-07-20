# Trust Spine Release 1 Staging Rollback

Status: executable destructive rollback for disposable staging only.

## Scope

The rollback removes only the additive Release 1 objects:

- Nine public `lh_*` RPC wrappers.
- The private `lh_trust_private` schema and helper functions.
- The 20 new `public.lh_*` staging tables.

It does not alter legacy LaxHornet tables, runtime files, service-worker
caches, Project One UI, or production data.

## Warning

The rollback permanently deletes Trust Spine staging grants, event evidence,
operation receipts, revisions, tombstones, conflicts, and audit records. Do
not run it on production or on staging evidence that must be retained.

## Run

First prove the target is staging:

```powershell
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -c "select current_database(), current_user, inet_server_addr();"
```

Then execute:

```powershell
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f "docs/methodnorth/trust-spine-gate/TRUST_SPINE_STAGING_ROLLBACK.sql"
```

## Verify

Both checks must return zero rows:

```sql
select tablename
from pg_catalog.pg_tables
where schemaname = 'public'
  and tablename like 'lh\_%' escape '\';

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name like 'lh\_%' escape '\';
```

The private schema must also be absent:

```sql
select schema_name
from information_schema.schemata
where schema_name = 'lh_trust_private';
```

## Recovery

Because this release has no runtime cutover, rollback requires no app version,
cache, or client migration. To restore the staging gate, reapply the migration
and rerun all 33 SQL tests.
