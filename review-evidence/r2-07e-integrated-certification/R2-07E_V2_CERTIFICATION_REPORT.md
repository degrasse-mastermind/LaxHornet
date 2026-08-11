# R2-07E V2 Disposable Integrated Certification Report

Status: `PRODUCT CERTIFICATION PASS — EVIDENCE/CI CERTIFICATION PASS; INDEPENDENT EXACT-HEAD REVIEW REQUIRED`

Risk level: `LEVEL 3`

Starting merged-main baseline: `b7269194a4ce8b9068b0d46c44d840efc4048c69`

Branch: `feature/r2-07e-integrated-certification-v2`

The historical PR #70 certification at
`6cbcad274961aff8e8f701c63d26bec58193d93c` remains a truthful FAIL: its
baseline lacked functional public clock command/batch wrappers and client
integration. PR #71 remediated that blocker, passed independent exact-head
review at `785654132ead3fe20e0c54820f13747ee4a190a4`, and squash-merged as the
starting baseline above. Historical failure evidence was not rewritten.

The first V2 evidence head `c8483eec018550043a0d395f97e6fc8f149413db`
also retains its truthful independent-review FAIL at
https://github.com/degrasse-mastermind/LaxHornet/pull/72#issuecomment-5248949066.
That review found the unsupported Supabase Preview claim, Vercel failure,
missing fresh complete-chain proof, EOF whitespace, and provisional final
fields. This report records the remediation without erasing that chronology.

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
| Migration chain and rollback | PASS | Fresh `node tools/test_r207e_complete_chain.mjs`: exact 17/17 Git-blob-bound migrations apply in order on PostgreSQL 17; final A/B/B-fix/C/D/clock schema, RLS, grants and default-off control pass; 14/14 applicable zero-evidence rollbacks execute in reverse; focused suites preserve post-evidence refusal proofs |
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
| Full canonical-plus-additive regression | PASS | Exact hosted source/tooling head `924d71fd8799198446f71d14cfc46ac418183078` reports `69 passed, 0 failed`; local bundled-Python run was `68/69` only because the preceding generated `.vercel-preview/app.js` correctly tripped the host scanner, which passed immediately after artifact quarantine |
| Cleanup and production boundary | PASS | Zero `laxhornet-r207*` containers, zero matching browser/test processes, clean worktree, generated regression/Vercel artifacts moved to the recoverable Recycle Bin, and production untouched |

Focused certification execution gates: `21/21 PASS`.

## Fresh complete-chain gate

- Command: `node tools/test_r207e_complete_chain.mjs`.
- Environment: fresh `postgres:17-alpine` container
  `laxhornet-r207e-chain-23220`, starting from an empty database plus the
  repository-approved nonproduction Supabase compatibility/ACL envelope.
- Identity: all 17 migration and 14 rollback raw Git-blob SHA-256 values match
  `R2-07E_V2_BASELINE_MANIFEST.md`; runtime, migration, rollback, release and
  cache artifacts remain unchanged from
  `b7269194a4ce8b9068b0d46c44d840efc4048c69`.
- Terminal result: `PASS` — migrations `17/17`, final integrated schema and
  security/default-off assertions PASS, applicable zero-evidence rollbacks
  `14/14` in reverse order, and zero matching container residue.

## Supabase Preview and Vercel

Supabase Preview is `NOT APPLICABLE` for this evidence/tooling-only PR. The
configured "Supabase changes only" integration reported `SKIPPED`, and the
read-only branch inventory contained only `main`; no ephemeral branch existed,
no Preview migration ran, and no Preview credential was issued. Therefore this
report does **not** use `AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION —
ACCEPTED CI VERIFICATION`. The fresh disposable complete-chain gate above is
the authoritative database proof. This classification uses the repository
closeout template's existing `NOT APPLICABLE` option; it is not a new waiver.

Vercel previously failed because the Preview builder correctly required an
isolated Supabase URL/credential even though this evidence-only PR could not
receive one. The branch-bound evidence-only build now asserts that both values
are absent and emits the unchanged default-off artifact. All other Vercel
Preview branches retain the original strict isolated-credential requirement.
Vercel deployment `dpl_9NAnQDKHm1Yx5a6rbC6f7rJpChrq` completed `Ready` at
source/tooling head `924d71fd8799198446f71d14cfc46ac418183078`.

## Exact-head binding

The evidence-fix source/tooling head is
`924d71fd8799198446f71d14cfc46ac418183078`. The final report commit cannot
embed its own SHA without changing that SHA; GitHub PR #72's head SHA and the
independent review comment are the authoritative final-head binding. The PR
body records that concrete SHA after the report commit and its checks finish.

## Query-plan limitation

`tools/test_r207e_query_plans.mjs` uses PostgreSQL 17 with `enable_seqscan=off`
to prove reviewed indexes are executable for representative identity, journal,
conflict, event-version, clock-receipt and batch-replay lookups. Small
disposable fixtures cannot establish production cardinality, cache, latency,
throughput, or hosting behavior. No production performance claim is made.

## Certification boundary

Product certification: `PASS`.

Evidence/CI certification: `PASS`, subject to the final report-only head
receiving the same terminal checks before independent review.

Independent review is intentionally external to this self-authored report and
must bind the exact PR head. R2-07F remains blocked until that review passes;
production release always requires separate authorization.
