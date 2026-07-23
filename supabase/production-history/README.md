# Production migration history

This directory preserves immutable production migration provenance that is not
part of blank-database forward migration execution.

## LaxHornet v283 historical baseline

- Production project: `ulbmjcvnyznvmjgpstno`
- Remote migration: `20260723010607_remote_schema`
- Classification: historical production db-pull snapshot
- Statement count: `350`
- Ordered-statements MD5: `ea4aeff5aff66a88dae1211b93e3a1fa`
- Archive SHA-256:
  `c8bd4bc55cc13b6506ccb859cf658f6962beec65f91d713f0867c91b4b046c82`
- Archive Git blob:
  `0c7fd494be0a461a3fb2b3efa60496b8541229a3`
- Archive:
  `supabase/production-history/20260723010607_remote_schema.sql`
- Active no-op marker:
  `supabase/migrations/20260723010607_remote_schema.sql`

The archived SQL is the exact audited representation of the 350 ordered
statements already recorded in the production migration ledger. It represents
the legitimate pre-v283 production schema captured through the standard
Supabase `db pull` / `pg_dump` workflow.

The archive must remain immutable. Do not execute it manually against
production, move it into active migration execution, modify its statement
ordering, or use it to delete or repair the corresponding remote ledger row.

Blank-database builds use the canonical migrations. The active marker exists
only so timestamp-based Supabase migration comparison recognizes the historical
production ledger entry as already applied.
