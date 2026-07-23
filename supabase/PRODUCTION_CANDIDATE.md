# LaxHornet Supabase Production Candidate

## Status

Draft production candidate only.

These migrations have been exercised against isolated Supabase staging project
`jafhrhgseiwrohqrhcof`.

They have not been approved or applied to production project
`ulbmjcvnyznvmjgpstno`.

Merging this pull request is not production-cutover authorization.

## Canonical forward migrations

1. `migrations/20260723000000_laxhornet_legacy_baseline.sql`
2. `migrations/20260723010000_trust_spine_release_1.sql`
3. `migrations/20260723020000_minimum_necessary_disclosure.sql`

The legacy baseline reconstructs the checked-in LaxHornet schema required by
Trust Spine on a blank Supabase preview. It contains schema definitions, RLS
policies, grants, functions, the auth trigger, indexes, constraints, and
Realtime publication membership. It contains no production data or synthetic
rows.

The Trust Spine and minimum-disclosure files are copied without substantive SQL
changes from the staging-tested evidence package.

## Prior preview failure

Preview project `yqclnivnizasaavpjyuy` created successfully, but migration
deployment failed on July 23, 2026 with:

`ERROR: relation "public.team_members" does not exist (SQLSTATE 42P01)`

The failure exposed missing canonical legacy migration history: manually
prepared staging already had the legacy LaxHornet schema, while a fresh
Supabase preview did not. The canonical legacy baseline closes that
reproducibility gap without copying production rows.

## Rollback references

Rollback scripts are stored under `supabase/rollback/` and are not forward
migration files.

They must never be executed automatically by the Supabase migration runner.

## Proven staging results

* Remote rollback left 0 `lh_*` tables.
* Reapplication created 20 `lh_*` tables.
* RLS was enabled on all 20 tables.
* Anonymous reads of `games` and `events` were denied.
* Remote authenticated and anonymous test suite passed 16/16.
* Local minimum-disclosure guards passed 36/36.
* PGlite migration, RPC, and rollback suite passed 17/17.
* Append-only history blocked an in-place identity rewrite and rolled back the transaction.

## Advisor status

Security Advisor:

* 0 errors
* 82 warnings tied to pre-existing `laxhornet_*` security-definer functions
* No inspected warning tied to new `lh_*` objects

Performance Advisor:

* 0 errors
* 0 warnings
* 67 informational suggestions
* Several new `lh_*` foreign keys may need covering indexes before pilot-scale use

## Production approval gates

Production deployment remains blocked until all of the following are complete:

* [ ] Fresh Supabase preview branch created from these canonical migrations
* [ ] Preview branch contains exactly 20 `lh_*` tables
* [ ] RLS enabled on all `lh_*` tables
* [ ] Anonymous ordinary-table reads denied
* [ ] Remote disclosure suite passes on the fresh preview branch
* [ ] Security Advisor reviewed on the fresh preview branch
* [ ] Performance Advisor reviewed on the fresh preview branch
* [ ] Covering-index requirements assessed before pilot
* [ ] Legacy `laxhornet_*` security warnings separately triaged
* [ ] Active Trust Spine contract suite fully green
* [ ] Runtime and service-worker version coordination completed
* [ ] Public copy accurately distinguishes staging from production
* [ ] Production runtime disclosure flags remain disabled until cutover
* [ ] Production backup, rollback, migration window, abort criteria, and post-deployment checks approved

## Deployment boundary

Do not apply these migrations manually to production as part of this pull request.

Do not use the production project as a test target.

Do not add Supabase credentials, service-role keys, passwords, JWTs, raw Live
Share tokens, or synthetic-user credentials to this repository.
