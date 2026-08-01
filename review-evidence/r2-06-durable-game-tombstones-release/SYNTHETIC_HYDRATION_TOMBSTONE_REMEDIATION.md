# R2-06P Synthetic Hydration Tombstone Remediation

Date: 2026-08-01

Risk level: Level 3 incident remediation

Status: implementation complete; exact-head CI and independent exact-PR-SHA
review remain required before merge. Production synthetic verification remains
incomplete.

## Sanitized incident basis

The final reviewed synthetic production attempt ran against
`dfe8535bdfb2a1e6470573940fb43b916b9407e0`. The matrix passed through action
14, including two isolated synthetic users, three sequential sessions, guarded
create/update, authorization denials, stale-delete rejection, accepted durable
delete, one retained tombstone, replay classification, different-deletion-ID
conflict, and stale-write rejection.

Action 15 stopped with `HYDRATION_REVEALED_GAME`. Independent cleanup
verification established zero synthetic users, profiles, active sessions,
games, events, Live Share tokens, and operation/recovery residue, with exactly
one retained durable tombstone. The live server game row was absent.

This remediation did not open the retained-identifier ledger, inspect private
production identifiers, reuse or modify the consumed run directory, use
production credentials, contact production, or mutate production.

## Exact root cause

The action-15 production verifier read every `localStorage` value and classified
the hydration as failed when any value contained the synthetic game ID. The
account-scoped durable synchronization state legitimately retained the game ID
inside its authoritative tombstone. That tombstone metadata therefore set the
old `localEvidence` boolean even when canonical saved-game storage,
application state, and rendered UI contained no game.

The exact action-15 reintroduction source was therefore not a server game row
or a proven client game representation. It was the verifier's untyped substring
scan over tombstone metadata. The old result did not distinguish a retained
tombstone from a saved game and did not independently establish raw canonical
storage, application state, or rendered UI visibility.

The broader audit found two real client hardening gaps even though neither was
needed to explain the production stop:

1. Final tombstone suppression after the second tombstone read depended on
   `isDeletedGame()` side effects during merge, and the second authoritative
   tombstone application occurred after the merge expression.
2. Rewriting a filtered saved-game array could place the prior stale array in
   the local-storage safety backup. A later safety recovery would still be
   filtered by the cached tombstone, but raw recovery storage retained a stale
   game representation and did not satisfy the stronger R2-06P invariant.

## Hydration sources traced

| Source | Before R2-06P | R2-06P authority behavior |
| --- | --- | --- |
| Account-scoped local storage | Parsed during account namespace initialization | Cached account tombstones suppress games, active state, recovery, review, and safety artifacts before persistence |
| Legacy signed-out keys | Kept in the signed-out namespace; not automatically adopted | Any explicit import is rechecked with account-scoped durable tombstones before commit |
| Pre-auth state | Loaded into the signed-out namespace | Authentication switches namespaces and immediately invalidates older hydration generations |
| In-memory state | Could contain local games before the remote tombstone read | First tombstone read removes candidates and derived references before upload |
| Service worker | Caches static same-origin assets, not Supabase responses | Cached tombstone state suppresses on reload; online hydration revalidates before merge |
| Supabase game rows | Read after the first tombstone pass | Remote candidates are explicitly filtered by the normalized tombstone set before merge |
| Cloud snapshots | Represented by the same games/events hydration rows | Subject to the same pre-merge tombstone filter |
| Recovery and operations | Delete recovery, active tracking, durable game/clock queues, and Trust Spine records | Accepted tombstones finalize delete recovery, clear active/review/derived state, remove matching Trust Spine state, and supersede game/clock writes |
| Roster/player-derived state | Players can be derived from canonical games | Player and dashboard derivation runs only after tombstoned games are excluded |
| Compatibility transforms | Normalization ran on local and remote candidates | Suppression identity is normalized before candidate normalization or freshness comparison can matter |
| Another account's storage | Separate account namespace | Account change invalidates prior generations; tombstones remain account-scoped |
| Local/remote merge | Tombstone influence was implicit through `isDeletedGame()` | Local and remote arrays are explicitly filtered before merge and defensively filtered again before commit |

The service worker never caches Supabase API responses. An old static client can
only read account-scoped local state and make fresh Supabase requests; it cannot
obtain a cached deleted game response from the service worker.

## Reconciliation ordering

Before R2-06P:

1. initialize an account namespace and parse local games/recovery/operations;
2. remove games covered by already-cached local tombstones;
3. load cloud team/account context;
4. fetch authorized tombstones and merge them into durable local state;
5. remove matching current state and persist;
6. process deletion and queued synchronization work;
7. upload remaining local games;
8. read own/team game rows;
9. refetch tombstones;
10. merge local and remote games while relying on `isDeletedGame()` to make the
    tombstone effective;
11. apply the final tombstone rows after the merge expression and persist.

After R2-06P:

1. an authentication transition invalidates every older hydration generation;
2. initialize the authenticated account namespace and apply cached tombstones;
3. load team/account context and reject an obsolete generation;
4. fetch authorized tombstones for the captured account;
5. build a trimmed, case-normalized tombstoned-game-ID set;
6. merge the tombstones into durable state, supersede queued game/clock writes,
   finalize accepted recovery, and purge matching canonical and safety storage;
7. process only remaining deletion/synchronization work and upload only
   non-tombstoned games;
8. read own/team remote candidates and reject an obsolete generation;
9. refetch and apply tombstones before the final merge;
10. filter local and remote candidates before merge, merge the survivors, and
    defensively filter again;
11. clear matching active/recovery/review/import/Trust Spine/derived state,
    persist the canonical filtered state, and sanitize saved-game safety
    backups;
12. verify canonical storage and application state contain no suppressed game,
    publish count-only diagnostics, and only then render or report sync success.

## Tombstone-authority invariant

For an authenticated account, every accepted durable tombstone wins over local
timestamps, client revisions, remote rows, missing remote rows, active-game
recovery, queued whole-game writes, queued tracked-clock writes, Trust Spine
state, imports, derived routes, and repeated or out-of-order hydration.

Game identity comparison trims and case-normalizes values for suppression
without rewriting the stored server identity. Account identity remains an
independent exact scope; the same game text under another account is not
suppressed.

## Local and queued-state cleanup

Suppression removes only matching game representations from:

- account-scoped saved games and their staging/backup/quarantine artifacts when
  those artifacts contain structurally parseable game arrays;
- active game, tracking session, review route, pending delete, saved-summary,
  Live Share prompt, shared-game, pending import, and family-recap focus state;
- Trust Spine game scopes and event records for the deleted game;
- pending/retryable whole-game and tracked-clock writes, which become retained
  `superseded` history.

The durable tombstone remains in account-scoped synchronization state. Accepted
delete recovery is finalized only after the authoritative tombstone is present.
Unrelated games and account data remain intact.

## Concurrency and account isolation

Every awaited hydration boundary checks the captured account and monotonic
hydration generation. Account transitions increment the generation immediately,
even before another cloud load starts. A stale local/remote/tombstone/team
completion cannot commit into the current namespace and produces only sanitized
`STALE_HYDRATION_COMMIT_REJECTED` diagnostics.

Tombstone queries remain authenticated and RLS-scoped. Client suppression records
the captured current account, not an identifier inferred from an untrusted game
candidate. Account-scoped storage is rebound during sign-in/switch/sign-out, and
legacy imports are checked again at commit.

## Safe diagnostics

The client publishes only booleans and integer counts:

- `tombstonesLoaded` and `tombstoneCount`;
- local/remote candidate counts;
- suppressed local/remote/recovery counts;
- final hydrated count and generation;
- stale-generation and suppression-complete booleans;
- one allowlisted invariant failure code.

No game, deletion, account, user, email, player, opponent, record timestamp, or
game-content value is included.

## Browser and disposable verification

The production adapter no longer scans every local-storage value. It inspects
only the authenticated account's canonical saved-game, active-game,
tracking-session, review, family-recap, and safety-support storage shapes. The
durable synchronization tombstone container is deliberately not a game source.

The verification independently requires:

1. raw canonical persistence contains no deleted game;
2. the live application-state inspector contains no deleted game in saved,
   active, recovery, derived, import, shared, queued-mutation, Trust Spine, or
   canonical stored state;
3. rendered elements contain no matching `data-game-id`.

It also requires tombstones loaded before the game request/merge boundary,
suppression complete, zero resurrection writes, zero retry storm, and zero
application console errors. The same checks run after a normal reload.

The credential-free disposable browser journey seeds a stale local game, stale
safety backup, active and recovery references, queued stale write, and stale
remote candidate. It retains the tombstone, preserves an unrelated game,
proves zero deleted-game writes, and repeats the three-layer proof after a
service-worker-controlled reload.

## Verification status

- Hydration/tombstone, durable-queue, and synchronization characterization:
  `126/126` passed.
- Disposable browser hydration at raw storage, application state, rendered UI,
  and controlled reload: passed.
- Reviewed runner contracts: 44 passed with one Windows directory-symlink
  permission skip.
- Browser-session contracts: `30/30` passed.
- Browser-runtime contracts: `11/11` passed.
- Disposable create/update/delete/replay/conflict/hydration/disclosure/cleanup
  integration: passed and remains explicitly non-production evidence.
- Complete canonical-plus-additive regression: `49/49` passed on the stabilized
  diff. An initial invocation reached `45/49`; its four failures were local
  harness availability failures because PATH-level Python was absent. The same
  unchanged diff passed all 49 gates after using the bundled workspace Python
  runtime.
- Exact-head CI: pending draft PR.

## Cleanup-record discrepancy

The immutable consumed production record reports `cleanupCompleted: false`.
Independent named read-only aggregate verification established cleanup completion
with zero mutable residue and exactly one retained tombstone. The immutable record
was not changed. The separate sanitized
`SYNTHETIC_HYDRATION_CLEANUP_ATTESTATION.json` records that observation without
changing cleanup approval, synthetic completion, or release closeout controls.

## Remaining authorization and review gates

No production retry is authorized by this remediation. Any future production
attempt requires the exact final PR SHA to pass CI and independent Level 3
review, followed by a new named read-only preflight, a new explicit one-run
authorization, fresh credentials, and a fresh run directory.

The release manifest continues to require:

- production execution disabled by default;
- synthetic authorization false;
- synthetic completion false;
- cleanup completion approval false;
- `releaseCloseoutApproved: false`.
