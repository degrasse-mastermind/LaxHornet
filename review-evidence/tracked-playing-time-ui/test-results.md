# Test Results

Date: 2026-07-27

| Check | Result |
| --- | --- |
| Tracked Playing Time UI contracts | 36/36 PASS |
| Companion service contracts | 16/16 PASS |
| Foundation static contracts | 11/11 PASS |
| Required manual scenarios A-G | 7/7 PASS |
| Rendered mobile/desktop browser checks | 14/14 PASS; no console errors |
| Local Supabase clean migration reset | PASS |
| Local tracked-time pgTAP contract | 37/37 PASS |
| Event-operation service | PASS |
| Minimum disclosure and secure disclosure | PASS |
| Service-worker/update contracts | PASS |
| Secret and production-host scan | PASS |
| `git diff --check` | PASS |
| Full v283 local regression | 29/29 groups PASS |

The full runner needed `@electric-sql/pglite@0.5.4` as a test-only dependency. It was supplied from a disposable temp directory, matching CI behavior; no package metadata or application dependency was added to the repository.

Database verification used only:

```text
supabase start --exclude storage-api,imgproxy,logflare,vector
supabase db reset --local
supabase test db supabase/tests/tracked_playing_time_foundation.sql
supabase stop --no-backup
```

No linked, remote, production, repair, push, or hosted mutation command was used.
