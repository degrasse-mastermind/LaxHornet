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

## Authorized Rollback And Reapply

On 2026-07-22, the disposable staging project was deliberately rolled back and
reapplied directly through the Supabase SQL editor because the GitHub integration
correctly ignored this evidence-only package outside the configured `supabase/`
directory.

1. `sql/98_MINIMUM_DISCLOSURE_STAGING_ROLLBACK.sql` completed successfully.
2. The first `99` attempt stopped before a transaction because the SQL editor
   does not accept the psql-only `\\set ON_ERROR_STOP on` directive.
3. The directive was removed from the checked-in rollback. The exact corrected
   `sql/99_TRUST_SPINE_BASE_STAGING_ROLLBACK.sql` then completed successfully.
4. A catalog check reported `0` remaining public `lh_*` tables.
5. The exact `00` and `01` migrations reapplied successfully.
6. A post-apply control query reported 20 `lh_*` tables, 0 without RLS,
   no anonymous `SELECT` privilege on `games` or `events`, and anonymous execute
   permission present on the public-safe Live Share RPC.
7. A synthetic accepted staging grant was added for the remote test account.
   An attempted in-place identity rewrite was blocked by the append-only history
   trigger and rolled back atomically, as designed.

The production project was not opened, migrated, or used as a workaround. No SQL
was moved into the configured production migration directory.

## Remote Proof

The checked-in remote test made real anonymous and authenticated PostgREST/RPC
calls against disposable staging. Result: **16/16 passed**.

Evidence:

- `logs/remote-staging-checked-in-test.txt`
- `logs/remote-staging-results.json`

The synthetic anonymous response in the JSON log is the exact public projection.
Ordinary table calls returned `401 / 42501`; unknown, expired, and revoked tokens
returned `200` with `null`.

## Advisor Checks

The Supabase Security and Performance advisors were manually rerun after the
reapply and remote test:

- Security: 0 errors; 82 warnings. The visible warnings concern pre-existing
  `public.laxhornet_*` SECURITY DEFINER functions callable without signing in.
  No `lh_*` Trust Spine warning appeared in the inspected results.
- Performance: 0 errors; 0 warnings; 67 informational suggestions. The inspected
  Trust Spine suggestions are unindexed foreign-key notices on tables including
  `lh_access_grants`, `lh_access_invitations`, `lh_conflict_adjudications`,
  `lh_event_annotations`, `lh_event_conflicts`, and
  `lh_event_correction_operations`.

These informational index suggestions are non-blocking for this disposable
staging proof, but should be reviewed before any pilot dataset or runtime cutover.
See `logs/staging-advisors.md` and
`logs/staging-rollback-reapply-2026-07-22.md`.

## Rollback

Run in this order on the disposable staging project:

1. `sql/98_MINIMUM_DISCLOSURE_STAGING_ROLLBACK.sql`
2. `sql/99_TRUST_SPINE_BASE_STAGING_ROLLBACK.sql`

The rollback rehearsal ran both in PGlite and on disposable remote staging. Both
paths removed all Trust Spine objects. The PGlite path additionally proved that
legacy game/event sentinel rows and modeled legacy anonymous privileges were
preserved. Result: pass.

Queued production operations are unaffected because there was no production
runtime cutover and no production migration.

