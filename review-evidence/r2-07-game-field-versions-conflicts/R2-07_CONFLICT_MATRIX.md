# R2-07 Conflict and Merge Matrix

Status: `RE-REMEDIATED — NEW EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW PENDING`

Remediation baseline: `0e90e3b4017d65ef35bdf95fc165b3379a4c6844`

This matrix is normative for later implementation. “Merge” always means a
server transaction proved disjoint accepted field names or applied a
specifically commutative operation. Timestamp order alone never authorizes a
merge. An authoritative game tombstone is checked before any stored-result
disclosure and takes response precedence over every operation/conflict row.

## 1. General decision procedure

1. Validate request shape/protocol, derive the authenticated actor, requested
   game scope, and canonical request hash.
2. Acquire a global operation-identity transaction lock or atomic blocking
   reservation keyed by `(actor_user_id, client_operation_id)`, independent of
   game ID. Retain it through transaction end. A reservation must not commit
   separately from the semantic result.
3. Look up or recheck the operation record under that identity boundary. Do not
   return or disclose any stored game ID, result, payload, conflict existence,
   or other private content.
4. Resolve the requested authoritative game and acquire its shared per-game
   transaction advisory lock while retaining the operation-identity lock.
5. Recheck the operation record with both locks held.
6. Check the authoritative tombstone under the game lock. Return `game_deleted` only
   to an actor with current tombstone-read authority; otherwise return a
   non-enumerating authorization denial. Disclose no replay/conflict/current or
   proposed values in either response.
7. Lock the canonical game/clock rows and recheck current
   authority. Personal games require current canonical personal-game
   owner/account authority. Team games require current canonical team/roster
   tracking authority, including `laxhornet_can_track_roster_player` where
   applicable. Copied/historical creator or owner/account identity is not
   authority. The bounded allowlisted reviewer path remains separate.
8. Classify a stored operation only after the requested-game tombstone and
   current-authority checks. Matching canonical game ID and hash returns its
   replay without semantic processing. A different stored game ID returns safe
   `duplicate_operation_id_scope_mismatch`; a same-game different hash returns
   `duplicate_operation_id_payload_mismatch`. Neither response discloses the
   stored game ID, payload/result, or conflict existence. Unauthorized requests
   receive only non-enumerating denial, and authorized tombstones receive only
   `game_deleted`.
9. For a first-seen identity, validate lifecycle and required versions.
10. If base equals current, apply the allowlisted operation.
11. If base is stale, inspect accepted change rows with result version greater
   than the base.
12. Merge only if the proposed field set is disjoint and the row below permits
   it, or if the operation is explicitly commutative.
13. Otherwise create one immutable conflict and apply nothing from that
   operation.
14. Commit the semantic mutation, operation identity, canonical result, and
    append-only evidence atomically, or commit none of them.

An operation with a base greater than current is invalid, not a conflict.
Missing bases are invalid, not current-by-default.
No rejected, unauthorized, tombstoned, scope-mismatched, or payload-mismatched
request creates a new game conflict. Simultaneous identical first-seen requests
serialize at the operation identity: one canonical mutation/result is stored
and the waiter returns its replay without a uniqueness-constraint error. Same-
actor/same-ID requests for different games cannot both reach semantic mutation.

The universal R2-07 lock order is operation identity, then at most one game
lock, then tombstone/game/clock rows and append-only evidence. No R2-07 path may
take a game lock and later take the operation lock. Existing per-game-only
R2-06 delete paths never take the operation lock, preventing an opposing cycle;
unrelated operation IDs remain independent. Any deadlock or reverse-order path
is a release-blocking failure.

## 2. Game-field matrix

| Server accepted after client base | Incoming client operation | Outcome | Version effect | Why safe / why blocked |
|---|---|---|---|---|
| Metadata field A | Different metadata field B | `merged` | Increment metadata and game once | Change journal proves no overlap; values are independent and lifecycle permits both. |
| Metadata field A | Same metadata field A with same value | `conflict` initially | None | A stale absolute intent is not reclassified as success merely because values currently compare equal; user intent/version evidence remains explicit. A later optimization may return no-op only after exact reviewed semantics. |
| Metadata field A | Same field A with different value | `conflict` | None | Silent last writer would lose an accepted edit. |
| Opponent/date/location/game type | Status completed | `merged` when completion bases are current | Status, score/clock as required; metadata unchanged by completion | Completion does not depend on these descriptive fields. |
| Period format | Any clock/event evidence exists | `conflict` or `invalid` | None | Changing period structure could invalidate clock/event meaning; it requires a dedicated conversion outside initial R2-07. |
| Roster/player context | Metadata patch | `merged` only if metadata field is permitted in resulting scope and authority is still current | Both affected groups increment | Different groups, but authorization is rechecked after the locked roster state. |
| Roster/player context | Another roster/player-context patch | `conflict` | None | Scope and historical player identity must not be synthesized across devices. |
| Sharing state | Any general metadata/score patch | Independent only through purpose-specific sharing contract | Each affected group independently | Share token/code authority must not be carried in a general patch or conflict record. |
| Sharing state | Sharing state | `conflict` | None | Public/private exposure cannot be auto-merged. |
| Active lifecycle | Allowed metadata patch | `accepted`/`merged` | Metadata and game | Metadata does not alter lifecycle. |
| Completed lifecycle | Opponent/date/location/game-type patch naming `expectedLifecycle=completed` | `accepted`/`merged` | Metadata and game | Bounded factual correction remains allowed after completion. |
| Completed lifecycle | Period-format or roster-context patch | `conflict`/`invalid` | None | Would change evidence interpretation or identity after finalization. |
| Any live state | Delete | `deleted` | Tombstone created; game removed | Existing R2-06 authority: deletion wins. |
| Tombstone | Any game/status/score/clock/event/resolution write | `deleted` | None | No resurrection or reuse. |

## 3. Score matrix

`For` and `Against` mean the two canonical score sides, independent of home/away
labeling in future presentation.

| Server accepted after base | Incoming score operation | Outcome | Reason |
|---|---|---|---|
| Unique `delta +1 For` | Different unique `delta +1 For` | `merged` | Deltas commute and operation IDs deduplicate retries; both user actions are preserved. |
| Unique delta on For | Unique delta on Against | `merged` | Independent commutative operations. |
| Delta on For | Absolute `set For` from stale base | `conflict` | Absolute replacement could erase an accepted delta. |
| Absolute `set For` | Absolute `set Against` from stale base | `merged` with journal proof | Different explicitly changed sides; client must not send an unchanged whole-score pair. |
| Absolute `set For` | Absolute `set For` | `conflict` | Same field, competing absolute intent. |
| Score initialization while `score_known=false` | Same values from another device | First `accepted`; second `conflict` or replay only if same operation ID | Only one operation establishes the unknown legacy score; independent identical values do not prove identical intent. |
| Score initialization | Different initialization | First `accepted`; second `conflict` | Prevent silent loss of a richer local legacy score. |
| Score change | Status completion request based on old score version | Completion `conflict` | Completion must snapshot the accepted current score. |
| Completion | Ordinary active-game score delta/set | `conflict` with lifecycle code | Completed games accept only explicit correction. |
| Completion | Explicit score correction with current status+score bases | `accepted` | Updates live/final score together and retains correction evidence. |
| Delete | Any score operation | `deleted` | Tombstone authority. |

Negative deltas are permitted only through a correction command, must not make
a side negative, and follow same-side conflict rules. Arbitrary absolute score
replacement is never auto-retried after conflict.

## 4. Lifecycle/status matrix

| Current server state | Requested transition | Required current bases | Outcome and side effects |
|---|---|---|---|
| No row, no tombstone | Draft/create -> active | Create bases `0` | Insert active game; initialize group versions to `1`; optional clock initialization is separate but ordered. |
| Active | Active -> paused | Status + clock (when enabled) | Strict accepted transition; clock stops atomically; status and clock revisions increment. |
| Paused | Paused -> active | Status + clock | Strict accepted transition; clock resumes through command semantics; revisions increment. |
| Active | Active -> completed | Status + score + clock | Strict; stop clock, close existing participation boundary, snapshot final score, increment affected versions. |
| Paused | Paused -> completed | Status + score + clock | Strict; keep clock stopped, close participation boundary, snapshot final score. |
| Completed | Completed -> reopened | Not applicable in initial R2-07 | `transition_not_supported`; no conflict row unless a valid future versioned contract exists. |
| Active/paused/completed | -> deleted | Existing durable deletion identity and ordering checks | Tombstone wins; open conflicts receive append-only terminal delete resolution. |
| Deleted | Any transition | None | `game_deleted`; no mutation. |

Two status transitions from the same base never merge. First transaction wins;
second receives `lifecycle_conflict`. A metadata edit racing completion may
merge only for the post-completion-allowed metadata fields.

## 5. Clock matrix

| Server/remote command | Incoming command from same base/timeline | Outcome | Reason |
|---|---|---|---|
| Start | Concurrent start | First accepted; second `clock_conflict` | Two authorities must not silently select an anchor. |
| Start | Delayed pause based on pre-start base | `clock_conflict` | Pause cannot be applied to a clock state it did not observe. |
| Pause | Delayed start from older base | `clock_conflict` | Prevents resurrecting running time after an accepted pause. |
| Pause | Resume from current paused version | `accepted` | Valid explicit transition. |
| Advance period | Old-period start/pause | `clock_conflict` | Old-period command would corrupt period context. |
| Set/correct remaining time | Any stale absolute clock command | `clock_conflict` | Absolute clock values never field-merge. |
| Ordered offline batch, server base unchanged | Batch commands | `accepted` atomically | Server validates local order and assigns every revision; no partial batch. |
| Ordered offline batch, server base changed | Batch commands | `clock_conflict`, no commands applied | Full local timeline remains for resolution; prevents silent time loss. |
| Clock command | Completion commits first | `lifecycle_conflict` | Completed boundary freezes ordinary clock changes. |
| Completion | Clock command commits first | Completion must use returned/current clock base or conflict | Completion cannot silently discard accepted clock evidence. |
| Delete | Any clock command/batch | `game_deleted` | Delete wins. |

The initial resolution surface may keep server clock state or apply a reviewed
manual clock correction at the latest version. It does not splice two running
timelines automatically.

## 6. Event and derived-state matrix

| Server event activity | Incoming event activity | Outcome | Reason |
|---|---|---|---|
| Append event A | Append unique event B | Preserve both | Unique append identities are independent; game revision does not bottleneck them. |
| Append operation A | Exact replay of A | Replay prior result | Request-hash idempotency. |
| Append event ID A | Different payload reusing ID/operation | Reject mismatch | Prevent semantic overwrite/tampering. |
| Correction field A | Correction field B on same event from stale base | Merge only with existing per-event changed-field proof | Existing canonical Trust Spine behavior. |
| Correction field A | Correction field A on same event | Event conflict | Same evidence cannot be silently replaced. |
| Correction event A | Correction event B | Independent | Separate effective event heads. |
| Edit event | Delete/tombstone same event from same base | First transaction wins; second conflicts or returns tombstoned | Event lifecycle is versioned. |
| Tombstone event | Stale correction | `event_tombstoned` | Permanent event deletion authority. |
| Remote score change | Offline event append | Preserve event; score aggregate unchanged except an explicit linked score delta operation | Event evidence and score aggregate are separate authorities. |
| Event ingestion | Derived totals/impact/summary | Recompute | Derived values are not directly merged or versioned fields. |
| Game delete | Event append/correction/delete | `game_deleted` | Shared game lock and tombstone check prevent post-delete evidence writes. |

## 7. Resolution matrix

| Conflict state / later server activity | Resolution action | Outcome |
|---|---|---|
| Open, versions unchanged | Keep server | Append terminal resolution; no game change. |
| Open, versions unchanged | Apply proposed | Apply as a new current-version write; append terminal resolution and result versions. |
| Open, versions unchanged | Apply custom patch | Validate allowlist, apply new current-version write, append terminal resolution. |
| Open, no action needed | Dismiss | Append terminal dismissal; no game change. |
| Open, relevant versions changed | Apply proposed/custom | No mutation; append failed resolution attempt and create linked `resolution_stale` conflict. |
| Already resolved, same resolution operation ID/hash | Retry | Replay prior result. |
| Already resolved, different resolution operation | Any | `conflict_already_resolved`; no mutation. |
| Open, game deleted | Any | `game_deleted`; delete transaction has already appended/supersedes with terminal delete resolution. |
| Personal-game actor lost current canonical owner/account authority | Read, replay, retention list, or resolution | Non-enumerating `authorization_denied`; no conflict existence, current/proposed value, request, or stored result disclosed. |
| Team-game actor lost current team/roster tracking authority | Read, replay, retention list, or resolution | Non-enumerating `authorization_denied`; copied creator/owner/account identity does not preserve access; direct RLS and RPC denial agree. |
| Bounded platform reviewer | Authorized read/resolution only when the existing allowlisted, non-public, audited predicate passes | No public/Live Share path and no broader role inference. |

## 8. Queue blocking matrix

| Conflicted operation | Must block | May continue |
|---|---|---|
| Metadata field A | Later operations that depend on field A or an entire metadata snapshot | Other metadata fields with independent bases, score deltas, event appends, other games |
| Score absolute correction | Completion and later absolute score correction | Metadata, event append, unrelated games |
| Status transition | Score/clock commands whose lifecycle precondition depends on it | Post-completion-agnostic metadata only after fresh lifecycle hydration; unrelated games |
| Clock timeline | Later clock commands and completion | Metadata, event append, score only if lifecycle rule permits |
| Roster context | All same-game writes until canonical authority/scope is rehydrated | Other games |
| Sharing | Sharing operations | Private metadata/score/event work |
| Delete conflict | All same-game mutations until recovery restores or deletion is resolved | Other games |

No conflicted item receives an automatic retry timestamp. User resolution or a
fresh, explicitly created current-version operation is required.

Final matrix disposition:
`R2-07 DESIGN RE-REMEDIATED — NEW EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW PENDING`.
