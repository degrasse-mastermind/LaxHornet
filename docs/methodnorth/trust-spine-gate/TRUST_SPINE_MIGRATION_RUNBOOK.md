# Trust Spine Release 1 Staging Runbook

Status: executable staging gate. Never run against production.

## Preconditions

- Use an isolated, data-less LaxHornet Supabase branch or separate staging project.
- Confirm the target project reference is not the production project reference.
- Set `LAXHORNET_STAGING_DATABASE_URL` to the staging direct database connection.
- Require `psql` with `ON_ERROR_STOP`.
- Do not run from a browser client or the production SQL editor.

## 1. Prove the target

```powershell
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -c "select current_database(), current_user, inet_server_addr();"
```

Record the output in the release evidence. Stop if the database cannot be
independently identified as staging.

## 2. Apply the additive deny-all migration

```powershell
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f "docs/methodnorth/trust-spine-gate/TRUST_SPINE_SCHEMA_PROPOSAL.sql"
```

The migration:

- Creates only `lh_*` tables plus the private `lh_trust_private` schema.
- Enables and forces RLS on every new table.
- Revokes all direct table privileges from `PUBLIC`, `anon`, and
  `authenticated`.
- Exposes only six narrow public RPC wrappers.
- Does not alter legacy LaxHornet tables, runtime code, caches, or UI.

## 3. Run the SQL acceptance suite

```powershell
psql $env:LAXHORNET_STAGING_DATABASE_URL -v ON_ERROR_STOP=1 -f "docs/methodnorth/trust-spine-gate/TRUST_SPINE_STAGING_TESTS.sql"
```

Expected final result:

```json
{"suite":"LaxHornet Trust Spine Release 1","fixtures":"synthetic","transaction":"rolled_back","sqlTestsPassed":24}
```

The SQL suite is transactional and rolls back its synthetic fixtures. The
schema remains installed for inspection.

## 4. Run repository contract checks

```powershell
node tools/test_trust_spine_release1.mjs
git diff --check
node --check app.js
```

## 5. Inspect deny-all posture

Confirm all 21 new tables have both RLS flags and no browser-role table grants:

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'lh\_%' escape '\'
order by c.relname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'lh\_%' escape '\'
  and grantee in ('PUBLIC', 'anon', 'authenticated');
```

The second query must return zero rows.

## 6. Release decision

Do not begin a pilot until:

- The migration and all 24 SQL tests pass on an isolated LaxHornet Supabase
  staging target.
- The public RPCs are exercised through real Supabase Auth/PostgREST sessions.
- Live Share is verified unauthenticated and exposes only the allowlisted
  projection.
- The rollback script has been rehearsed on disposable staging.

## Stop conditions

Stop and roll back staging if:

- The target cannot be proven non-production.
- Any direct table privilege exists for `anon` or `authenticated`.
- Any cross-team or cross-player test succeeds.
- Any tombstoned event can be recreated or corrected.
- Any unallowlisted field appears in Live Share or export manifests.
- A duplicate operation ID can change its original payload.
