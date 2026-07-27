# Test Results

Date: 2026-07-27

| Check | Result |
| --- | --- |
| Tracked Playing Time UI contracts | 44/44 PASS |
| Companion service contracts | 16/16 PASS |
| Foundation static contracts | 11/11 PASS |
| Required live event-gating scenarios A-G | 7/7 PASS through rendered interaction coverage |
| Existing tracked-time calculation scenarios | 7/7 PASS |
| Rendered mobile/desktop browser checks | 33/33 PASS; no console errors |
| Local Supabase clean migration reset | PASS |
| Local tracked-time pgTAP contract | 37/37 PASS |
| Event-operation service | PASS |
| Minimum disclosure and secure disclosure | PASS |
| Service-worker/update contracts | PASS |
| Secret and production-host scan | PASS |
| `git diff --check` | PASS |
| Full v283 local regression | 29/29 groups PASS |
| GitHub Actions portable regression | Pre-change baseline PASS (`30261706471`); final post-push run is recorded on PR #25 |

The full runner used an already-cached PGlite package and bundled Playwright through temporary local directory junctions. The junctions were removed immediately after the run; no package metadata or application dependency was added to the repository.

Blocked-state browser assertions compared the complete event-integrity snapshot before and after direct Goal, Note, Assist, Turnover, Ground Ball, and Caused Turnover attempts. Local event count, score, event-operation count, canonical-operation count when applicable, and last-event confirmation remained unchanged.

Database verification used only:

```text
supabase start --exclude storage-api,imgproxy,logflare,vector
supabase db reset --local
supabase test db supabase/tests/tracked_playing_time_foundation.sql
supabase stop --no-backup
```

No linked, remote, production, repair, push, or hosted mutation command was used.
