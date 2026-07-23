# Disposable Staging Rollback And Reapply Evidence

Project reference: `jafhrhgseiwrohqrhcof`

Environment: Supabase project `lh-trust-spine-staging` (`Preview`)

Data: synthetic only (`Demo Player #12`, `Branford Demo Hornets`,
`Madison Demo`)

## Rollback

- `98_MINIMUM_DISCLOSURE_STAGING_ROLLBACK.sql`: success, no rows returned.
- Initial `99_TRUST_SPINE_BASE_STAGING_ROLLBACK.sql`: rejected before the
  transaction with PostgreSQL `42601` because the Supabase SQL editor does not
  support the psql-only `\\set ON_ERROR_STOP on` directive.
- The directive was removed from the checked-in rollback script.
- Corrected exact `99` rollback: success, no rows returned.
- Post-rollback catalog check: `remaining_lh_tables = 0`.

## Reapply

- `00_TRUST_SPINE_BASE_STAGING_MIGRATION.sql`: success, no rows returned.
- `01_MINIMUM_DISCLOSURE_STAGING_MIGRATION.sql`: success, no rows returned.
- Synthetic disclosure fixture: success, no rows returned.
- A separate accepted grant was created for the fresh synthetic remote-test
  account. No real account or youth data was used.

## Post-Apply Controls

| Check | Result |
| --- | ---: |
| Public `lh_*` tables | 20 |
| Public `lh_*` tables without RLS | 0 |
| Anonymous `SELECT` on `public.games` | false |
| Anonymous `SELECT` on `public.events` | false |
| Anonymous execute on `lh_public_live_share_game(text)` | true |

## Remote API Proof

The checked-in test `tests/test_minimum_disclosure_remote.mjs` ran against the
disposable staging REST/RPC endpoint with a confirmed synthetic account.

Result: **16/16 passed**.

See:

- `remote-staging-checked-in-test.txt`
- `remote-staging-results.json`

## Production Boundary

- Production was not opened or changed.
- No production migration ran.
- No SQL was moved into `supabase/`.
- No runtime cutover or static-app deployment occurred.
- No credentials or raw tokens are stored in this evidence package.
