# R2-06 Synthetic Closeout Readiness

Date: 2026-08-01

Risk level: Level 3 release evidence reconciliation

Status: `CLOSEOUT REVIEW REQUIRED`

This document assembles the public, sanitized implementation, production,
remediation, and cleanup evidence for independent R2-06 closeout review. It
does not approve closeout.

## Reviewed implementation and evidence chain

| PR | Merge SHA | R2-06 contribution |
| ---: | --- | --- |
| #47 | `18f5157de159fa7a27b3cefb4c90f5148c3b230d` | Durable game tombstones, guarded write/delete, client suppression, and recovery |
| #48 | `2fcc446d5f3d06ca6d24c69bc4466a13794e02b3` | Same-game concurrency serialization and delete-conflict recovery |
| #49 | `a2f99f82952ac51a68a4868888e9319612bd715c` | Production-state reconciliation incident record |
| #50 | `77f3cf4b0c86c7ce1cc44a42fafa9f3b111e9f3b` | Manifest reconciliation with verified runtime, migrations, and catalog state |
| #51 | `c0ad2057c5d55bfe2d4aff9b8cec5bec4124916d` | Final production preflight and bounded synthetic plan |
| #52 | `bf72d740960bb2947aecb8724de8c27aa7d2181b` | Disabled-by-default, authorization-bound 21-action runner |
| #53 | `e782f4beeaf7cb6a6954e23e83328e92a5bb14d1` | Browser readiness and partial-failure diagnostics |
| #54 | `3596287fbd2f44ed58e5295ccace7d594460bf71` | Reviewed run-scoped private-path controls |
| #55 | `401886e2f8a7023b985f6d9bae17d92705ea8f3f` | Session establishment orchestration and classified cleanup evidence |
| #56 | `dfe8535bdfb2a1e6470573940fb43b916b9407e0` | Supabase-session proof decoupled from optional UI marker; production runner SHA |
| #57 | `cdcc357db2774cf66454f0f5c0c69d87fd14187d` | Action-15 classifier correction, hydration hardening, and three-layer verification |

## Guarantees assembled for review

### Durable-delete server guarantees

- Guarded writes reject a retained tombstone with `game_deleted`.
- A stale delete retains the newer game and returns `newer_game_revision`.
- A current durable delete atomically removes the game and creates one durable
  tombstone with `game_deleted`.
- Same-deletion-ID replay is deterministic and returns
  `game_delete_replayed`; a different deletion ID returns
  `game_already_deleted`.
- The retained tombstone permanently wins over later stale writes.

### Concurrency guarantees

- Read, write, delete, and trigger paths share the canonical same-game
  transaction-scoped advisory lock.
- Lock acquisition precedes tombstone/game reads and mutation, serializing
  same-game operations without a global lock.
- Delete-conflict recovery preserves the newer game and its event evidence.

### Runner, session, and private-path controls

- Production execution is disabled by default and bounded to exact reviewed
  source, one-run authorization, fresh preflight, credentials, and run path.
- Owner, challenger, and clean-owner sessions are sequential and isolated.
- Auth confirmation is distinct from application bootstrap, protected
  capability, and optional Sign Out rendering.
- Private-path checks accept only the reviewed run-scoped location; consumed
  authorization and run directories cannot be reused.
- Partial failure enters cleanup-only behavior and preserves sanitized,
  classified evidence.

### Hydration/UI remediation

- Account-scoped durable tombstones are normalized and applied before upload,
  merge, final commit, derived state, and rendering.
- Local and remote candidates are filtered before merge and defensively before
  persistence.
- Account transitions invalidate older hydration generations at every awaited
  boundary.
- Matching active, recovery, review, import, Trust Spine, derived, safety, and
  queued game/clock state is purged or superseded while unrelated data and the
  durable tombstone are preserved.

### Invalid action-15 classifier diagnosis

The original production action 15 is `INVALID HISTORIC VERIFIER RESULT`. Its
all-storage substring scan found the game ID in legitimate durable tombstone
metadata and mislabeled that metadata as a hydrated game. No server game row,
canonical client game representation, or rendered game visibility was proven.
The original action is not rewritten as a pass.

### Corrected three-layer verification

PR #57 independently checks raw canonical persistence, live application state,
rendered `data-game-id` elements, and zero resurrection writes. The reviewed
disposable browser journey passed before and after a service-worker-controlled
reload. This is `DISPOSABLE/REMEDIATION VERIFIED`, not a second production
lifecycle.

### Cleanup evidence

Independent aggregate cleanup evidence attests that all three sessions were
revoked, both users were deleted, both profiles cascaded away, and synthetic
users/profiles/sessions/games/events/Live Share tokens/operations/recoveries
all returned to 0. Exactly one inert tombstone and one unopened private ledger
record remain. No manual cleanup was required.

The immutable consumption record remains `cleanupCompleted: false` because it
was not updated after the independent observation. The supplemental cleanup
attestation is authoritative for final aggregate residue; it does not change
the release-control completion or approval flags.

## Reviewed verification already committed

- R2-06P hydration/tombstone, durable-queue, and synchronization
  characterization: `126/126` passed.
- Disposable browser three-layer hydration and controlled reload: passed.
- Reviewed runner contracts: 44 passed with one Windows directory-symlink
  permission skip.
- Browser-session contracts: `30/30` passed.
- Browser-runtime contracts: `11/11` passed.
- Disposable create/update/delete/replay/conflict/hydration/disclosure/cleanup
  integration: passed and remains non-production evidence.
- R2-06P complete canonical-plus-additive regression: `49/49` passed on the
  stabilized diff.
- PR #57 exact-head portable regression and Docker-based CI: passed before
  merge.

## Remaining unresolved items

- Independent exact-PR-SHA Level 3 review of this R2-06Q reconciliation is
  required.
- Original production action 15 remains inconclusive because the historic
  classifier was invalid.
- Production action 16 remains partial because the full post-hydration
  disclosure sequence was not reached; reviewed disposable evidence supplies
  the remaining bounded behavior evidence.
- The earlier migration-application actor, route, and exact time remain
  unresolved; this package does not retroactively authorize that incident.
- The public evidence intentionally omits private identifiers, ledger contents,
  and exact private run/cleanup timestamps.
- Release closeout approval remains false and must be a separate independent
  decision.

## Recommendation

The mixed evidence is sufficient to submit R2-06 for independent closeout
review without another production attempt. The reviewer should preserve the
source distinctions in `SYNTHETIC_PRODUCTION_RECONCILIATION.md`, verify the
manifest-bound evidence hashes, and decide closeout separately.

This document does not approve release closeout.

`releaseCloseoutApproved: false`

Final recommendation:
`R2-06Q EVIDENCE RECONCILIATION READY FOR INDEPENDENT CLOSEOUT REVIEW`.
