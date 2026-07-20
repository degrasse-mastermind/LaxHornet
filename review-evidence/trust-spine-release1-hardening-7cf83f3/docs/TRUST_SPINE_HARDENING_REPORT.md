# Trust Spine Release 1 Hardening Report

Date: 2026-07-20

## Recommendation

**Revise before browser integration.**

The migration, rollback, local SQL acceptance suite, and repository contract
suite pass. The implementation is ready for a disposable Supabase staging
branch, but the required real Auth/PostgREST/Realtime/concurrency/rollback proof
cannot be completed because only the production project is currently
available. Production was not changed.

This is a stop condition from the hardening brief, not permission to substitute
production testing.

## Hardening completed

1. Private helper isolation
   - Removed client schema usage and helper execution.
   - Kept nine explicit public wrappers as the only client entrypoints.
   - Fixed privileged wrapper `search_path` values and ownership.

2. Permanent tombstones
   - Removed restore operation types, tables, helpers, indexes, tests, and
     rollback entries.
   - Restoration remains deferred.

3. Accepted-only revision history
   - Rejected requests remain operation/attempt records.
   - Conflicts remain operation/conflict records.
   - Only accepted corrections or accepted adjudications create revision rows.

4. Evidence/annotation boundary
   - Core evidence fields are explicitly allowlisted and revisioned.
   - `note` and `tags` live in a separate private annotation row.
   - Annotation mutation is intentionally deferred.
   - Live Share excludes annotations.

5. Legacy scope registration
   - Added authorized, idempotent team/player/game registration wrappers.
   - Added identity and cross-scope validation.
   - Registration does not grant access.

6. Concurrency-safe sequencing
   - Corrections lock the effective event row before accepted revision sequence
     allocation.
   - Accepted sequence state is maintained on that locked row.
   - Conflicts and rejections do not consume accepted revision numbers.

7. Grant audit
   - Added the exact public RPC ownership/grant matrix and SQL audit queries.

## Local proof

- Repository contract tests: 18 passed.
- Migration in fresh PGlite database: passed.
- Transactional SQL acceptance groups: 33 passed.
- Rollback: passed.
- Trust Spine objects remaining after rollback: 0.
- Legacy synthetic sentinels surviving rollback: games 1, events 1, teams 1,
  roster players 1.

## Staging proof not completed

The connected Supabase project exposes only its default `main` branch, which is
the production project. A disposable branch could not be created without an
available billing confirmation flow. Therefore these remain unverified:

- Real Supabase Auth role sessions.
- Real PostgREST grants and private-helper denial.
- Separate-session concurrent corrections over the network.
- Anonymous Live Share response headers/body at the API edge.
- Realtime publication behavior.
- Supabase advisor/lint output.
- Remote rollback rehearsal.

## Production safety

- No production migration was applied.
- No production SQL was executed.
- No browser runtime cutover was made.
- No application, service-worker, cache, or version file was changed.
- No real child/player data was used.

## Next gate

Create a disposable Supabase branch or separate staging project, apply the exact
migration without edits, run the SQL suite and remote-session tests, inspect
API exposed schemas and Realtime publication, run advisors, then rehearse the
rollback. Browser integration remains blocked until that evidence passes.

