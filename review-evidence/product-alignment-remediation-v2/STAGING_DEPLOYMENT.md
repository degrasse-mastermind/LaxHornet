# Disposable Staging Deployment

## Environment

- Supabase project name observed in the dashboard: `lh-trust-spine-staging`
- Project reference: `jafhrhgseiwrohqrhcof`
- Data: synthetic `Demo Player #12`, `Branford Demo Hornets`, and `Madison Demo`
- Production project: not opened, migrated, or reconfigured for this sprint

No service-role key, JWT, publishable key, test password, or raw Live Share token
is stored in this package.

## Applied SQL

1. `sql/00_TRUST_SPINE_BASE_STAGING_MIGRATION.sql`
2. `sql/01_MINIMUM_DISCLOSURE_STAGING_MIGRATION.sql`

The base migration applied successfully. The first disclosure-migration attempt
was accidentally appended to the already populated SQL editor and failed with
`42P07 relation "lh_team_scopes" already exists`. The transaction rolled back;
no partial disclosure migration remained. The editor was cleared and the exact
`01` migration was then applied successfully.

## Remote Proof

The checked-in remote test made real anonymous and authenticated PostgREST/RPC
calls against disposable staging. Result: **16/16 passed**.

Evidence:

- `logs/remote-staging-checked-in-test.txt`
- `logs/remote-staging-results.json`

The synthetic anonymous response in the JSON log is the exact public projection.
Ordinary table calls returned `401 / 42501`; unknown, expired, and revoked tokens
returned `200` with `null`.

## Rollback

Run in this order on the disposable staging project:

1. `sql/98_MINIMUM_DISCLOSURE_STAGING_ROLLBACK.sql`
2. `sql/99_TRUST_SPINE_BASE_STAGING_ROLLBACK.sql`

The rollback rehearsal ran in PGlite and removed all staging objects while
preserving legacy game/event sentinel rows and restoring the legacy anonymous
table privileges represented by the fixture. Result: pass.

Queued production operations are unaffected because there was no production
runtime cutover and no production migration.

