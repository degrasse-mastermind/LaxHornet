# R2-07E V2 Disposable Integrated Certification Report

Status: `CERTIFICATION MATRICES PASS — EXACT-HEAD REVIEW PENDING`

Risk level: `LEVEL 3`

Starting merged-main baseline: `b7269194a4ce8b9068b0d46c44d840efc4048c69`

Branch: `feature/r2-07e-integrated-certification-v2`

The historical PR #70 certification at
`6cbcad274961aff8e8f701c63d26bec58193d93c` remains a truthful FAIL: its
baseline lacked functional public clock command/batch wrappers and client
integration. PR #71 remediated that blocker, passed independent exact-head
review at `785654132ead3fe20e0c54820f13747ee4a190a4`, and squash-merged as the
starting baseline above. Historical failure evidence was not rewritten.

## Exact-SHA and environment boundary

`R2-07E_V2_BASELINE_MANIFEST.md` binds the complete 17-migration and
14-rollback inventories, exact Git-blob SHA-256 values, runtime hashes,
default-false capability values, and unchanged `v285` / `laxhornet-v285`
markers before mutation testing.

All database tests used disposable PostgreSQL 17 or PGlite with synthetic
adult identities and synthetic games, events, clocks, conflicts, and roster
authority. Browser tests used isolated local synthetic contexts. No production
connector, URL, credential, data, deployment, or youth/player record was used.

## Gate results

| Gate | Result | Direct evidence |
| --- | --- | --- |
| Former clock blocker | PASS | Server `55/55`, P1 `19/19`, client `15/15`, browser `18/18` |
| Migration chain and rollback | PASS | Ordered inventory; A/B/C/D/clock disposable migrations; pre-evidence rollback succeeds and post-evidence rollback refuses; fresh PR Supabase Preview is the complete-chain CI gate |
| Global operation identity | PASS | A `71/71`: replay/mismatch, cross-game identity, different actors, injected rollback, lock order, deadlock and independence |
| Metadata, score, lifecycle | PASS | B client `32/32`, migration `13/13`, browser `12/12`; A completed-game/concurrency probes |
| Event concurrency | PASS | C client `30/30`, safety `37/37`, migration `25/25`, browser `7/7` |
| Clock | PASS | Server `55/55`, client `15/15`, browser `18/18` |
| Prefix replay plus suffix | PASS | Exact prefix replay, no duplicate mutation/receipt, atomic new suffix |
| Offline chronology | PASS | Elapsed intervals preserved; reversed, over-bound, boundary-crossing and changed-base timelines apply zero commands |
| Revision ceiling | PASS | Reach/replay `9007199254740991`; command/batch/suffix overflow rejects before mutation/evidence |
| Conflict resolution | PASS | D client `32/32`, migration `23/23`, browser `10/10` |
| Event dismiss | PASS | Focused `13/13`: acknowledgment-only, no event/RPC/version mutation, distinct from `keep_server` |
| Offline/reconnect | PASS | Durable sync `29/29`; local-first persistence, permanent IDs, immutable attempts, timeout replay and dependent-only blocking |
| Account switching | PASS | Late old-account responses discarded; namespaces/queues/conflicts/storage isolated; browser `41/41` |
| Authority revocation | PASS | Personal/team post-acceptance replay/read/resolve denial is bounded and non-enumerating |
| Future schema | PASS | C safety `37/37`, storage `28/28`, clock client `15/15`; no mutation, retry, downgrade or compaction |
| Error sanitization | PASS | Classifier `22/22`; malformed/nested/unknown/RLS/validation/transport cases retain no raw server text |
| RLS and privacy | PASS | A/B/C/D/clock SQL, team RLS `13/13`, State C and v284 authorization; FORCE RLS/direct-write denial |
| Live Share/public disclosure | PASS | Private evidence and queue exclusion; secure browser `73/73`; post-R2-06 browser `41/41` |
| Browser/mobile/accessibility | PASS | B `12/12`, C `7/7`, D `10/10`, clock `18/18`, tracked `33/33`; mobile, keyboard, focus, live regions, touch, overflow and console checks |
| Performance/query behavior | PASS WITH DISPOSABLE LIMIT | PostgreSQL plans `8/8` use intended indexes; transaction locks and unrelated independence pass; no production-scale claim |
| Preservation | PASS | A `71/71`; B/C/D above; tombstones `8/8`; tracked `16/16`, `11/11`, `44/44`, `7/7`, `33/33`; Trust Spine SQL `33/33` |
| Full canonical-plus-additive regression | PENDING | Runs once after the evidence commit at the exact final certification head |
| Cleanup and production boundary | PASS SO FAR | Zero focused-test container residue; final process/worktree audit remains part of exact-head closeout |

Focused certification execution gates completed before exact-head regression
and independent review: `21/21 PASS`.

## Query-plan limitation

`tools/test_r207e_query_plans.mjs` uses PostgreSQL 17 with `enable_seqscan=off`
to prove reviewed indexes are executable for representative identity, journal,
conflict, event-version, clock-receipt and batch-replay lookups. Small
disposable fixtures cannot establish production cardinality, cache, latency,
throughput, or hosting behavior. No production performance claim is made.

## Remaining certification gate

Commit and push this evidence, open a draft PR, run the complete
canonical-plus-additive regression and exact-head CI, confirm zero residue,
then obtain an independent read-only Level 3 integrated-certification review.
R2-07F remains blocked until that review passes and separate production-release
authorization is granted.
