# LaxHornet v283 production-ledger provenance

This evidence package records the reviewed Outcome A reconciliation for
production Supabase project `ulbmjcvnyznvmjgpstno`.

## Audit conclusion

`20260723010607_remote_schema` is legitimate historical production provenance
from the standard Supabase `db pull` / `pg_dump` workflow. It represents the
pre-v283 production schema and is not an erroneous ledger row.

The repository therefore preserves the exact snapshot outside the executable
migration path and provides a comment-only migration marker with the matching
version. The remote ledger row was not deleted, repaired, or otherwise changed.
The five canonical v283 migrations remain pending for the later authorized
production deployment.

## Governed artifacts

- Archive:
  `supabase/production-history/20260723010607_remote_schema.sql`
- Marker:
  `supabase/migrations/20260723010607_remote_schema.sql`
- Statement count: `350`
- Ordered-statements MD5: `ea4aeff5aff66a88dae1211b93e3a1fa`
- Archive SHA-256:
  `c8bd4bc55cc13b6506ccb859cf658f6962beec65f91d713f0867c91b4b046c82`
- Archive Git blob:
  `0c7fd494be0a461a3fb2b3efa60496b8541229a3`
- Classification: historical production db-pull snapshot

`.gitattributes` marks the archive as `-text` so Git preserves its audited
mixed line endings and byte identity across platforms.

## Results

- Exact archive statement identities and aggregate digest: PASS
- Marker comment-only/no executable SQL: PASS
- Blank database plus six timestamp-ordered files: PASS
- Production-shaped replay, marker, and five canonical migrations: PASS
- Synthetic production-shaped rows survived: PASS
- Access-request function upgraded to notification queue behavior: PASS
- Final blank and upgraded catalogs equivalent: PASS
- Schema capability: `1`
- Phase-aware containment, including mutation failures: PASS
- Linked migration-list simulation: PASS
- Full v283 regression: see `full-regression-output.txt`

## Production safety

Production was read only during this reconciliation. The only linked Supabase
operation was `migration list`. No SQL, `migration repair`, `db push`, deploy,
data mutation, or ledger mutation was executed.

The eventual separately authorized production command must use
`db push --include-all` because canonical migration versions `00000` and
`10000` precede the already-applied remote version `10607`.
