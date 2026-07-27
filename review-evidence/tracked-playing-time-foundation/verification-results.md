# Verification Results

All database checks used the local Supabase stack only. No project link, production query, migration push, Edge Function deployment, or remote mutation was performed.

## Completed checks

| Check | Result |
|---|---|
| Blank database migration sequence: `supabase db reset --local` | PASS; all seven migrations applied in timestamp order |
| Focused client service: `node tools/test_tracked_playing_time_service.mjs` | PASS; 16/16 |
| Local pgTAP: `supabase test db --local supabase/tests/tracked_playing_time_foundation.sql` | PASS; 37/37 |
| Rollback on empty foundation history | PASS; foundation functions/view/tables removed |
| Rollback preservation check | PASS; `lh_event_operations` and `lh_public_live_share_game(text)` remained present |
| Production-shaped local reapply over the existing six-migration schema | PASS |
| pgTAP after reapply | PASS; 37/37 |
| New unindexed foreign-key advisor findings | PASS; none after adding covering indexes |

## Lint and advisors

`supabase db lint --local --schema public,lh_trust_private --level warning --fail-on error` reports one pre-existing error in legacy `public.laxhornet_request_team_player_access`: ambiguous `id` in `on conflict (id)`. The new migration introduced no lint warning or error after cleanup.

Security advisors report informational `rls_enabled_no_policy` entries for the new tables. This is the intended forced-RLS, no-direct-grants, RPC-only model. Performance advisors report unused new indexes on a fresh database, which is expected before production-shaped workload exists.

## Portable checks

The branch adds the focused service and static foundation tests to both `tools/run_v283_local_regression.mjs` and the pull-request workflow. Final broad regression and CI results are recorded in the pull request rather than inferred here.
