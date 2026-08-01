# R2-06 Synthetic Production Reconciliation

Date: 2026-08-01

Risk level: Level 3 release evidence reconciliation

Status: `CLOSEOUT REVIEW REQUIRED`

Reviewed production runner SHA:
`dfe8535bdfb2a1e6470573940fb43b916b9407e0`

Evidence reviewed through merged SHA:
`cdcc357db2774cf66454f0f5c0c69d87fd14187d`

Production run date: 2026-08-01. The public sanitized record does not include
the exact run or independent cleanup timestamp, so this reconciliation does
not infer one.

## Status model

- `PRODUCTION VERIFIED`: the original production lifecycle directly proved
  the stated result.
- `PRODUCTION PARTIALLY VERIFIED`: production proved only the named subset.
- `INDEPENDENT CLEANUP ATTESTED`: the result comes from the committed
  independent aggregate cleanup observation, not the immutable runner flag.
- `DISPOSABLE/REMEDIATION VERIFIED`: reviewed non-production evidence proves
  the corrected behavior.
- `INVALID HISTORIC VERIFIER RESULT`: the old classifier could not prove the
  product condition it claimed.
- `NOT REACHED`: the original production lifecycle stopped before the full
  sequence.
- `CLOSEOUT REVIEW REQUIRED`: this package prepares, but does not approve,
  release closeout.

## Action-by-action disposition

| Action | Disposition | Reconciled result | Evidence boundary |
| ---: | --- | --- | --- |
| 1 | `PRODUCTION VERIFIED` | Browser readiness passed. | Original production lifecycle |
| 2 | `PRODUCTION VERIFIED` | Two synthetic Auth users were created. | Original production lifecycle |
| 3 | `PRODUCTION VERIFIED` | Two automatic profiles were created. | Original production lifecycle |
| 4 | `PRODUCTION VERIFIED` | Three sequential sessions were verified. | Original production lifecycle |
| 5 | `PRODUCTION VERIFIED` | One isolated personal game was created. | Original production lifecycle |
| 6 | `PRODUCTION VERIFIED` | Anonymous denial passed. | Original production lifecycle |
| 7 | `PRODUCTION VERIFIED` | Wrong-account denial passed. | Original production lifecycle |
| 8 | `PRODUCTION VERIFIED` | The guarded update passed. | Original production lifecycle |
| 9 | `PRODUCTION VERIFIED` | The stale delete returned `newer_game_revision`. | Original production lifecycle |
| 10 | `PRODUCTION VERIFIED` | The current durable delete returned `game_deleted`. | Original production lifecycle |
| 11 | `PRODUCTION VERIFIED` | Tombstones changed from 0 to 1. | Original production lifecycle |
| 12 | `PRODUCTION VERIFIED` | Same-ID replay returned `game_delete_replayed`. | Original production lifecycle |
| 13 | `PRODUCTION VERIFIED` | The different-ID attempt returned `game_already_deleted`. | Original production lifecycle |
| 14 | `PRODUCTION VERIFIED` | The stale write returned `game_deleted`. | Original production lifecycle |
| 15 | `INVALID HISTORIC VERIFIER RESULT` | The original `HYDRATION_REVEALED_GAME` result was inconclusive because the verifier treated retained tombstone metadata as a hydrated game. | Original classifier invalid; corrected behavior is separately verified |
| 16 | `PRODUCTION PARTIALLY VERIFIED` | Anonymous and wrong-account denial passed; no Live Share token was created; final token count was 0; no unauthorized game disclosure was observed before the action-15 stop. | Full post-hydration disclosure sequence was `NOT REACHED` |
| 17 | `INDEPENDENT CLEANUP ATTESTED` | All three sessions were revoked. | Independent aggregate cleanup evidence |
| 18 | `INDEPENDENT CLEANUP ATTESTED` | Both synthetic users were deleted. | Independent aggregate cleanup evidence |
| 19 | `INDEPENDENT CLEANUP ATTESTED` | Both profiles cascaded away. | Independent aggregate cleanup evidence |
| 20 | `INDEPENDENT CLEANUP ATTESTED` | Mutable, Auth, session-authority, and browser-owned synthetic residue returned to 0. | Independent aggregate cleanup evidence |
| 21 | `INDEPENDENT CLEANUP ATTESTED` | Exactly one retained tombstone and one unopened private ledger record remained. | Aggregate-only public evidence; private identifiers are not disclosed |

## Action 15 reclassification and corrected verification

The precise historic classification is:

`INVALID VERIFIER RESULT — TOMBSTONE METADATA MISCLASSIFIED AS HYDRATED GAME`

The old verifier scanned every `localStorage` value for the game ID. The
authoritative retained durable tombstone legitimately contained that ID. The
committed sanitized evidence establishes that no server game row remained,
but the old scan did not prove a canonical client game representation and did
not prove rendered game visibility. The original action 15 therefore did not
pass and did not establish a product failure.

PR #57 replaced the invalid substring scan with independent raw canonical
storage, live application-state, rendered `data-game-id`, and zero
resurrection-write checks. It also hardened tombstone-first hydration,
generation isolation, queued-write suppression, and recovery/derived-state
cleanup. The reviewed disposable browser journey passed those checks before
and after a service-worker-controlled reload.

Corrected action-15 status: `DISPOSABLE/REMEDIATION VERIFIED`.

No second production lifecycle was required or performed. The original
production evidence remains inconclusive at action 15; history is not rewritten
to claim that the original action passed.

## Action 16 disclosure disposition

The exact combined status is:

`PARTIALLY VERIFIED IN PRODUCTION — COMPLETED BY REVIEWED DISPOSABLE DISCLOSURE AND THREE-LAYER HYDRATION EVIDENCE`

Production directly supports the anonymous denial, wrong-account denial, zero
Live Share token creation, final zero token count, and absence of an observed
unauthorized game disclosure before the stop. The full post-hydration
disclosure sequence was not reached in production. The reviewed disposable
integration completed disclosure coverage, while the reviewed disposable
browser evidence independently completed raw-storage, application-state,
rendered-UI, and zero-resurrection-write hydration coverage. This distinction
must remain visible in closeout review.

## Cleanup reconciliation

The immutable runner record reports `cleanupCompleted: false`; it was not
changed after independent cleanup verification. The committed aggregate
observation and `SYNTHETIC_CLEANUP_ATTESTATION.md` are the authoritative
supplemental public cleanup records. They establish zero mutable/Auth residue,
no manual cleanup requirement, and exactly one retained durable tombstone. The
one private retained-identifier ledger remains access-controlled and unopened.

## Evidence chain

| Evidence area | Source | Status | Limitation |
| --- | --- | --- | --- |
| Durable delete | Production run | `PRODUCTION VERIFIED` | None material |
| Replay/conflict | Production run | `PRODUCTION VERIFIED` | None material |
| Stale write rejection | Production run | `PRODUCTION VERIFIED` | None material |
| Hydration suppression | Original production verifier | `INVALID HISTORIC VERIFIER RESULT` | Tombstone metadata false positive |
| Hydration suppression | Reviewed disposable/browser verification | `DISPOSABLE/REMEDIATION VERIFIED` | Not a second production lifecycle |
| Cleanup | Independent read-only attestation | `INDEPENDENT CLEANUP ATTESTED` | Immutable consumption record remained false |
| Retained tombstone | Production and cleanup evidence | `PRODUCTION VERIFIED` / `INDEPENDENT CLEANUP ATTESTED` | Private identifier not disclosed |
| Release closeout | Independent review | `CLOSEOUT REVIEW REQUIRED` | Not approved in this task |

## Scope, limitations, and preserved controls

- Production mutations in the completed lifecycle were bounded to the stated
  synthetic users, sessions, profiles, and game. No real-data mutation is
  recorded.
- No production configuration, schema, RLS, policy, grant, RPC, trigger,
  Storage, or Auth-configuration change occurred in the lifecycle or this
  reconciliation.
- This reconciliation did not access production, use credentials, query
  Supabase, execute the runner, create authorization, reuse a run directory, or
  open private evidence.
- The retained tombstone was not modified.
- The public record does not contain exact private identifiers or the exact
  run/cleanup timestamps.
- Migration-application attribution remains unresolved from the earlier
  production-state reconciliation and is not retroactively approved here.
- Production execution remains disabled by default; the consumed
  authorization and run directory are not reusable.
- Synthetic verification remains a mixed-evidence record rather than a simple
  binary pass.
- `releaseCloseoutApproved: false`.

Final status:
`R2-06Q EVIDENCE RECONCILIATION READY FOR INDEPENDENT CLOSEOUT REVIEW`.
