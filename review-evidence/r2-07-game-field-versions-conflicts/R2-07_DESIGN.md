# R2-07 Game-Field Versions and Conflict Records

Status: `RE-REMEDIATED — NEW EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW PENDING`

Risk level: `LEVEL 3`

Remediation baseline: `0e90e3b4017d65ef35bdf95fc165b3379a4c6844`

Repository/runtime baseline: `v285`; production cache marker `laxhornet-v285`

Remediation branch: `design/r2-07-review-remediation`

This is an implementation design, not an implementation record. It creates no
application code, migration, RPC, release marker, production access, or
deployment authority.

PR #62 received an exact-head PASS at design head
`df458789bc3f45e4f01cf31cc0ed10716dd9e2a6` on 2026-08-06 at 03:11:56Z. The
replay-disclosure P1 was posted at 03:11:35Z and remained unresolved when PR #62
merged at 03:12:48Z. The team-authority P1 and post-lock concurrent-first-seen
P2 were posted after merge at 03:17:29Z against that same head. All three
findings remained unresolved when PR #63 began. The historical PASS is
preserved, but it does not establish a clean design gate. No clean
independent Level 3 PASS exists for the corrected design until a new reviewer
returns PASS against the exact remediation PR head. R2-07A and every later
implementation, migration, release, deployment, and production action remain
unauthorized.

Companion artifacts:

- [Conflict and merge matrix](R2-07_CONFLICT_MATRIX.md)
- [Migration and rollback plan](R2-07_MIGRATION_AND_ROLLBACK_PLAN.md)
- [Test plan](R2-07_TEST_PLAN.md)
- [Implementation sequence](R2-07_IMPLEMENTATION_SEQUENCE.md)

## 1. Baseline and preserved guarantees

The design is based on the current repository contracts, especially:

- `public.games` and `public.events` in
  `supabase/migrations/20260723000000_laxhornet_legacy_baseline.sql`;
- canonical event versions, operations, conflicts, and tombstones in
  `supabase/migrations/20260723010000_trust_spine_release_1.sql`;
- tracked-clock revision and participation-operation contracts in
  `supabase/migrations/20260727000000_tracked_playing_time_operations.sql`;
- durable game tombstones and the shared per-game advisory-lock contract in
  the R2-06 and R2-06A migrations;
- lossless hydration, request-generation checks, durable local operations,
  failure classification, tombstone-first hydration, and recovery logic in
  `app.js` and `event-operation-service.js`;
- the current-state inventory in
  `docs/architecture/R2_CURRENT_SYNC_INVENTORY.md` and the R2-03 through R2-06
  ticket/evidence records.

R2-07 must preserve all of the following as hard invariants:

1. Local game capture is immediate and remains usable offline.
2. A cloud write is never required before a local game action succeeds.
3. Current-account and request-generation guards remain mandatory during
   hydration and queue processing.
4. Durable deletion and an authorized tombstone outrank every stale write,
   event operation, clock operation, status transition, and resolution.
5. Same-deletion-ID replay remains accepted and deterministic; a different
   deletion ID remains an explicit conflict.
6. A deleted game ID is never reusable and cannot be resurrected.
7. Rejected or conflicted local work remains recoverable and is never reported
   as synchronized.
8. Account/team/roster authorization is checked from authenticated server
   context. A client-supplied account or owner identity is never authoritative.
9. Live Share cannot read conflict records, private queue state, clock state,
   or private proposed values.
10. v285 PWA install, cache, update, and offline behavior remain unchanged
    until a separately authorized release advances all coordinated markers.

## 2. Decision summary

### Recommended model: field-group optimistic concurrency plus immutable operations

Use a hybrid of field-group revisions and operation history:

- Server-assigned monotonic revisions protect game field groups.
- An aggregate `game_revision` changes on every accepted mutation to the
  `games` row and provides a compact hydration/debug token.
- Immutable accepted-change rows record the exact safe field names changed at
  each group revision. They allow a stale patch to merge only when no accepted
  change since its base touched the same field.
- Immutable operation rows provide payload-hash idempotency and stable replay.
- Immutable conflict rows retain rejected overlapping intent; append-only
  resolution rows record the outcome without rewriting the conflict.
- The existing clock row remains independently revisioned; its external token
  is `clockVersion`.
- Canonical events remain operation-based and independently versioned. Event
  appends do not increment a game-field revision.

This is Model B as the primary model, with a bounded operation journal borrowed
from Model C. The journal is not a full event-sourced replacement for `games`.

### Rejected primary alternatives

| Alternative | Decision | Reason |
|---|---|---|
| Model A — one game-wide revision | Rejected as the only concurrency token | Simple, but a location edit would conflict with an independent score or status change; offline queues would produce avoidable conflicts; clock and event appends would become bottlenecks. `game_revision` is retained only as an aggregate token. |
| Model B — field-group revisions only | Rejected without a change journal | Group revisions reduce false conflicts but cannot prove that two stale metadata patches touched different fields. The bounded accepted-change journal supplies that proof. |
| Model C — full operation/event sourcing for the entire game | Rejected for R2-07 | Strong replay/audit properties, but it would replace the current static-PWA game projection, broaden migration and recovery risk, and duplicate mature canonical event machinery. R2-07 uses operations only at the mutation boundary. |
| Client timestamps as versions | Rejected | Device clocks are not authoritative, are not safely monotonic across devices, and cannot support deterministic replay after timeout. |
| UUID tokens as versions | Rejected | They identify operations but do not express ordering. Permanent operation IDs remain UUID-like opaque text; versions remain integers. |

## 3. Exact version model

### Game row columns

| Column | Type | Existing-row initialization | New-row initialization | Increment rule |
|---|---|---:|---:|---|
| `game_revision` | `bigint` | `1` | `1` | Once for every accepted mutation that changes any versioned `games` field group. Not incremented for clock-only or event-only changes. |
| `metadata_version` | `bigint` | `1` | `1` | Once when any metadata field changes in an accepted/merged operation. |
| `score_version` | `bigint` | `1` | `1` | Once for an accepted score initialization, delta, correction, or completion final-score snapshot. |
| `status_version` | `bigint` | `1` | `1` | Once for an accepted lifecycle transition. |
| `roster_context_version` | `bigint` | `1` | `1` | Once for an authorized player/team/roster-context change. |
| `sharing_version` | `bigint` | `1` | `1` | Once for an authorized private sharing-state change. Sharing remains outside public conflict detail. |

All version columns are `NOT NULL`, have a check constraint `>= 1`, and are
assigned only inside server transactions. Existing rows are initialized to `1`
because their pre-R2-07 history is not reconstructable. A client creating a
new server row supplies base version `0` for each group it initializes; the
server inserts version `1`.

Clients must not predict, increment, or rewrite a server version. The client
may change local display state optimistically, but its durable operation keeps
the last acknowledged/hydrated server base. After success, it replaces local
base versions only with the complete version map returned by the server.

### Clock and event versions

- `lh_game_clock_states.revision` remains the canonical clock token and is
  returned as `clockVersion`. Its implementation migration should widen it to
  `bigint` while preserving existing values and initialization at `1`.
- Canonical `lh_event_effective_versions.server_event_version` remains the
  per-event token. It is not copied into `games`.
- Any personal/legacy event correction path that remains after implementation
  must receive an equivalent per-event server version before R2-07 activation;
  unrestricted last-write-wins event correction is not an acceptable fallback.
- Derived totals and summaries have no writable version. They are recomputed
  from effective event evidence and versioned game/score state.

### Change-journal proof

For each accepted operation, the server appends one row per changed field
group containing the operation ID, group, client base version, assigned result
version, and allowlisted changed field names. When a stale metadata patch based
on version `4` arrives while the server is at `6`, the server may merge it only
if no accepted change row with `result_version > 4` intersects the proposed
field names. Absence of a journal row is never interpreted as proof of safety.

## 4. Domain field inventory

`Delete wins` means an existing authorized `legacy_game_tombstones` row causes
the operation to return `game_deleted` before any other merge decision.

| Domain / fields | Current authority | Direct or derived | Concurrency rule | Version authority | Delete wins |
|---|---|---|---|---|---|
| Game ID `games.id` | Client creates once; server permanently reserves after tombstone | Immutable identity | Never editable or mergeable | None; creation base `0` | Yes |
| Canonical owner `games.user_id` | Authenticated server context on create | Immutable ownership | Client cannot patch; account mismatch is invalid | None | Yes |
| Player ID | `games.player_id` plus player snapshot | Direct roster context | Strict field overlap; authorization rechecked | `roster_context_version` | Yes |
| Team and roster player IDs | `games.team_id`, `roster_player_id` and canonical grants | Direct roster context | Strict; moving scope cannot be merged with any concurrent roster-context change | `roster_context_version` | Yes |
| Device/client identity | Local durable sync state; request `deviceId` | Operation metadata, not game content | Never treated as authority or a game field | Permanent operation ID + request hash | Yes |
| Creation identity/time | Auth context and `created_at` | Immutable after insert | Client cannot patch | Creation receipt | Yes |
| Opponent | `games.opponent` | Direct metadata | Different metadata fields may merge; same field conflicts | `metadata_version` + changed-field journal | Yes |
| Location | `games.location` | Direct metadata | Same as opponent | `metadata_version` + journal | Yes |
| Game date | `games.game_date` | Direct metadata | Same-field strict | `metadata_version` + journal | Yes |
| Game type/format | `game_type`, `period_format` | Direct metadata | Same-field strict; format cannot change after clock/event evidence exists without a dedicated validated conversion | `metadata_version` | Yes |
| Period structure | Format plus tracked-clock duration fields | Direct configuration | Strict; clock initialization freezes duration/format for R2-07 | Metadata and clock versions | Yes |
| Game-level notes | Not present in the v285 `games` schema | Unsupported in R2-07 | No new notes field is invented; a later ticket must classify and privacy-bound it | None | Yes |
| Lineup/roster context | No game-level lineup object; player/team/roster IDs only | Unsupported beyond current IDs | No arbitrary roster snapshot merge; R3 remains owner of canonical roster identity | `roster_context_version` for existing IDs | Yes |
| Player snapshot | `player_snapshot` local/server projection | Historical display snapshot | Strict; never copied into conflict records; changed only with an explicit roster-context operation | `roster_context_version` | Yes |
| Current period | Tracked clock when enabled; otherwise `current_quarter` | Direct live state | Clock transition owns it when tracked; otherwise strict status/live-state patch | `clockVersion`; legacy fallback under `status_version` | Yes |
| Live score | New server score fields; current v285 local score remains source during first initialization | Direct aggregate with operation semantics | Unique deltas preserve both; same-side absolute edits conflict; different-side absolute fields may merge | `score_version` + journal | Yes |
| Final score | Completion/correction transaction | Direct snapshot of canonical live score | Completion requires current score/status/clock bases; post-completion correction is explicit | `score_version` | Yes |
| Lifecycle | New `lifecycle_state`; legacy `status` remains a compatibility projection | Direct state machine | Only listed transitions; no arbitrary replacement | `status_version` | Yes |
| Clock running/stopped, anchor, pause, remaining time | `lh_game_clock_states` | Direct canonical clock state | Strict optimistic transition or ordered offline batch; no field-level merge | `clockVersion` | Yes |
| Timeout state | Not present in v285 | Unsupported in R2-07 | No field invented. If added later, it requires clock-operation semantics | None | Yes |
| Overtime state | Period `OT` and configured duration | Direct clock configuration/state | Validated clock transition only | `clockVersion` | Yes |
| Legacy `events` rows | Existing event row / local game event | Append for new IDs; mutable legacy correction today | New IDs append independently. Corrections/deletes require per-event versioned operation before activation | Per-event version | Yes |
| Canonical team event evidence | Trust Spine operations and effective version | Append/revision/tombstone | Existing unique append, same-field correction conflict, non-overlap merge, permanent tombstone | `server_event_version` | Yes |
| Event totals, goals, assists, shots, faceoffs, penalties | Effective event evidence | Derived | Never directly merged or written | Source event versions | Yes |
| Playing time | Effective participation operations plus clock context | Derived | Append unique participation operations; correction/tombstone follows logical-event head | Existing operation revision/identity | Yes |
| Game impact and summaries | Local reviewed calculation from effective evidence | Derived | Recompute; never conflict-record payload | Source versions and algorithm version outside R2-07 | Yes |
| Sharing flag | Purpose-specific authorization plus `games.is_shared` | Direct private control | Strict; no automatic merge; conflict record omits share code/token | `sharing_version` | Yes |
| Share code/token | Existing private creation/revocation flows | Credential-like identifier | Never accepted in general game patch or conflict record | Purpose-specific receipt | Yes |
| Draft | Local setup before first accepted create | Lifecycle state | First server create transitions to active unless a later product ticket persists drafts | `status_version` on creation | Yes |
| Active | `lifecycle_state = active` | Lifecycle state | Explicit transition only | `status_version` | Yes |
| Paused | Explicit game/clock pause | Lifecycle state plus clock stopped | Atomic with tracked-clock pause when clock exists | Status and clock versions | Yes |
| Completed | Explicit finish transaction | Lifecycle state | Freezes ordinary score/clock writes; bounded corrections remain explicit | Status, score, clock versions | Yes |
| Deleted/tombstoned | `legacy_game_tombstones`; no `games` row | Permanent lifecycle authority | No transition out; all writes return `game_deleted` | Tombstone identity, not a game version | Always |

## 5. Proposed server schema

The migration artifact contains implementation-ready structural details; this section fixes the
logical contract.

### `games` additions

Add the six revision columns above, `lifecycle_state`, and server score fields:

- `score_for integer not null default 0`;
- `score_against integer not null default 0`;
- `score_known boolean not null default false`;
- `final_score_for integer`;
- `final_score_against integer`.

Scores must be nonnegative. Final-score columns are either both null or both
non-null. Existing games backfill `score_known = false`; a versioned client may
initialize an unknown score exactly once using base score version `1`. This
prevents a synthetic server zero from overwriting richer v285 local score
evidence.

`lifecycle_state` uses `active`, `paused`, or `completed`. Draft exists only
before first server creation in the initial release. Deleted state remains a
tombstone, not a `games` row. Legacy `status` remains a compatibility projection
(`in-progress` or `complete`) until its separately reviewed sunset.

### Immutable operation tables

`game_sync_operations` stores one canonical result per authenticated actor and
client operation ID:

- server `operation_id uuid` primary key;
- `actor_user_id uuid` and `client_operation_id text` with a unique pair;
- canonical `game_id`, operation type, request hash, safe changed field names;
- outcome class/code, response class, conflict ID if any;
- client-created and server-received timestamps;
- result version map and a bounded canonical response needed for replay.

The table stores no raw request, token, header, device secret, arbitrary app
state, event history, player name, note, or rendered summary.

`game_sync_operation_attempts` stores replay/mismatch counters and safe codes
only. `game_field_changes` stores accepted group/version/field-name history.
All three are append-only. Clients receive no direct DML grants.

### Immutable conflicts and resolutions

`game_conflicts` stores:

- server UUID primary key;
- copied personal-owner/account, game, team, and roster identifiers for bounded
  retention and audit scope only; copied or historical identifiers never grant
  current access;
- actor and canonical operation IDs;
- conflict type and field group;
- client base version and current server version;
- overlapping safe field names;
- bounded current and proposed values under the privacy allowlist below;
- optional parent conflict ID for a stale resolution;
- created timestamp and safe audit metadata.

The conflict row has no mutable `status`. `game_conflict_resolutions` is an
append-only table containing the resolution operation ID, action, result code,
result versions, resolver identity, and `resolved_at`. API responses derive:

- `resolutionStatus = open` when no terminal resolution exists;
- `resolutionStatus = resolved` plus `resolvedAt`/resolver when one exists;
- `resolutionStatus = superseded_by_delete` when deletion appended that
  terminal resolution.

This avoids claiming that a record is immutable while updating it in place.

### Conflict privacy allowlist

Conflict records may contain only:

- game/account/team/roster opaque IDs;
- field group, version numbers, operation IDs, safe field names, timestamps,
  and resolution state derived from resolution rows;
- integer/boolean/enum score, status, clock, and sharing values;
- bounded metadata values needed for resolution: date, game type, period
  format, opponent, and location (maximum 160 characters each);
- roster/player opaque IDs, never `player_snapshot` content.

They must not contain access tokens, refresh tokens, API keys, share codes,
device secrets, raw device IDs, request bodies, arbitrary JSON, full game or
event snapshots, event notes/history, player/family names, contact data,
rendered summaries, analytics narratives, or stack traces.

Proposed/current JSON objects are constrained by a server allowlist and a
serialized maximum of 4 KiB each. Unknown keys reject the request; they are
never silently retained.

Retention recommendation: open conflicts remain while the game exists;
resolved conflicts become purge-eligible after 180 days; deletion appends a
terminal resolution and makes all game conflicts purge-eligible after 180
days. Clients cannot delete conflicts. A separately reviewed maintenance role
may hard-delete an entire expired conflict and its resolution rows without
editing their contents. The exact 180-day policy requires David's approval and
privacy/legal review before implementation.

Retention eligibility never broadens conflict visibility. Until purge, a
personal-game conflict is readable only under current canonical personal-game
owner/account authority; a team-game conflict is readable only under current
canonical team/roster tracking authority, including
`laxhornet_can_track_roster_player` where applicable; or under the separately
allowlisted, non-public, audited platform-review predicate. Historical creator,
copied owner/account, and retained conflict identifiers alone grant no access.

## 6. Client write contract

The primary RPC is `laxhornet_sync_game_v2(p_operation jsonb)`. General game
writes use it; clock transitions use the dedicated v2 clock contract below.
Authenticated identity and game authority are derived by the server.

Conceptual request:

```json
{
  "protocolVersion": 2,
  "operationId": "opaque-permanent-client-operation-id",
  "deviceId": "opaque-nonsecret-client-install-id",
  "gameId": "opaque-game-id",
  "clientCreatedAt": "2026-08-05T20:00:00.000Z",
  "expectedLifecycle": "active",
  "knownTombstone": null,
  "baseVersions": {
    "game": 8,
    "metadata": 4,
    "score": 12,
    "status": 3,
    "rosterContext": 2,
    "sharing": 1,
    "clock": 19
  },
  "change": {
    "type": "metadata_patch",
    "set": {
      "location": "Field 2"
    }
  }
}
```

Contract rules:

1. `operationId` is permanent. Once an attempt starts, its normalized payload
   never changes. The same ID with a different payload hash is rejected.
2. `deviceId` is required for diagnostics but grants no authority and is not
   written to conflicts.
3. The client supplies only the base versions required by the operation.
   Missing required versions are rejected, never treated as current.
4. Create uses group base `0`. Update uses the last server-acknowledged or
   hydrated base. A base greater than the current server version is invalid.
5. `expectedLifecycle` is mandatory for score, status, roster, and clock
   changes; metadata patches after completion name `completed` explicitly.
6. `knownTombstone` is advisory and may only carry an already-known deletion
   ID/timestamp. Server tombstone lookup remains authoritative.
7. A normal operation changes one mutation class. Completion is the bounded
   exception: it atomically validates status, score, and clock bases, stops the
   clock, and snapshots final score.
8. Metadata patches contain only changed keys. Sending an entire game object
   is invalid.
9. Live score uses `score_delta` (`for`/`against`, signed bounded amount) where
   possible. `score_set` is an explicit correction containing only changed
   sides and a reason after completion.
10. Ownership, share codes, timestamps assigned by the server, derived totals,
    summaries, and event arrays are not accepted as game patches.

## 7. Server transaction algorithm

Each R2-07 mutation separates two serialization domains:

- **Operation identity:** `(actor_user_id, client_operation_id)` serializes
  first-seen and replay decisions globally, independent of any game ID.
- **Game mutation:** the authoritative game ID serializes tombstone, lifecycle,
  state, and semantic mutation decisions for that game.

Every R2-07 path follows this universal order:

1. Validate request shape, allowlisted keys, sizes, operation ID, and protocol;
   derive `auth.uid()`, the requested game scope, and the canonical request hash
   server-side.
2. Acquire a transaction-scoped operation-identity lock or atomic blocking
   reservation keyed only by `(actor_user_id, client_operation_id)`. The
   implementation may use a collision-safe advisory-lock derivation or a
   reservation row, but it must serialize contenders before any game-domain
   mutation and must not commit a reservation separately from its semantic
   result.
3. Look up or recheck the operation record while retaining that identity lock.
   This may identify a potential replay or mismatch, but it must not return or
   disclose the stored canonical game ID, result, original payload, conflict
   existence, current values, proposed values, or other private game content.
4. Resolve the requested authoritative game scope, then acquire the existing
   namespaced per-game transaction advisory lock:
   `hashtextextended('laxhornet:legacy-game:' || game_id, 0)`, while retaining
   the operation-identity lock.
5. Recheck the operation record with both serialization domains held.
6. Read the authoritative tombstone under the game lock. If present, recheck
   current tombstone-read authority. An authorized actor receives
   `game_deleted` with no prior replay/conflict/current values; an actor without
   current authority receives a non-enumerating authorization failure with no
   game, proposal, conflict, or current-state content. Tombstone authority
   outranks every accepted, merged, conflicted, or resolution replay history.
7. Lock the game row `FOR UPDATE`, then the clock row `FOR UPDATE` when the
   operation requires clock/status coupling.
8. Recheck current authority from canonical rows and grants. Personal games
   require current canonical personal-game owner/account authority. Team games
   require current canonical team/roster tracking authority, including
   `laxhornet_can_track_roster_player` where applicable. Historical creator or
   copied owner/account identity is never enough. The only additional path is
   the already justified, explicitly allowlisted, non-public, audited platform
   reviewer predicate. Denial is non-enumerating and discloses no stored
   operation or conflict content.
9. After tombstone and current-authority validation, classify any stored
   operation. If its canonical game ID and request hash both match, return its
   canonical replay without semantic mutation. If its canonical game ID differs,
   return `duplicate_operation_id_scope_mismatch` only to a requester currently
   authorized for the requested live game; otherwise return the applicable
   non-enumerating authorization denial, or `game_deleted` for an authorized
   requested tombstone. Never disclose the stored canonical game ID, payload,
   result, or conflict existence. If the game ID matches but the hash differs,
   return `duplicate_operation_id_payload_mismatch` with the same containment.
10. For a first-seen identity, validate base versions and lifecycle
    preconditions.
11. For a stale group base, query accepted change rows after the base. Merge
   only if the proposed fields are disjoint and the matrix explicitly permits
   it. Otherwise insert one immutable conflict.
12. Apply all accepted mutations atomically, increment only affected group
    versions plus `game_revision`, and append the operation identity, canonical
    result, and applicable change/conflict/resolution history in the same
    transaction. Commit all of them or none of them.

No R2-07 path may acquire a game lock and then acquire an operation-identity
lock. The order is always operation identity, then at most one game lock, then
tombstone/game/clock rows and append-only evidence. Existing R2-06 delete paths
that are not enrolled in R2-07 remain per-game-only and must never later acquire
an operation-identity lock; this prevents an opposing lock cycle. Unrelated
operation IDs remain independent, including when they target different games.
R2-07A must prove this order remains deadlock-free under opposing concurrent
requests; a deadlock or reverse-order path is a release-blocking failure.

No exception path may commit a partial game update without its operation
identity and canonical result. Conflict creation and its canonical operation
result are one transaction. Authorization, validation, scope-mismatch, and
payload-mismatch failures do not create a game conflict. Two simultaneous
identical first-seen requests serialize at the global operation-identity
boundary: the first valid request performs one semantic mutation and stores one
canonical result; the waiter rechecks under the same identity order and returns
the replay. It does not reach semantic mutation processing and does not expose
a unique-constraint error.

## 8. Server response contract

Every response includes `protocolVersion`, `operationId`, the request's `gameId`,
a stable `responseClass`, and a machine-readable `code`. A scope-mismatch
response echoes only that requested ID; it never substitutes or discloses the
stored operation's canonical game ID.

| Response class | Required content | Stable primary codes |
|---|---|---|
| `accepted` | Complete current version map and normalized changed state | `game_write_accepted`, `score_delta_accepted`, `status_transition_accepted`, `score_initialized` |
| `merged` | Version map, normalized changed state, safe merged field names, and the stale base that was merged | `game_write_merged_non_overlapping`, `score_delta_merged` |
| `conflict` | Conflict ID, group, overlapping safe fields, current versions, and only authorized bounded current values | `game_field_conflict`, `lifecycle_conflict`, `clock_conflict`, `resolution_stale` |
| `deleted` | Existing deletion code/receipt fields and no private conflict values | `game_deleted` |
| `replay` | After operation-identity serialization plus requested-game tombstone and current-authority checks pass, `operation_replayed` plus the exact stored canonical result under `result`; no duplicate mutation/conflict | `operation_replayed` |
| `invalid` | Safe rejection code; no conflict row | `invalid_game_operation`, `missing_base_versions`, `invalid_base_version`, `unsupported_protocol`, `authorization_denied`, `client_upgrade_required`, `duplicate_operation_id_scope_mismatch`, `duplicate_operation_id_payload_mismatch` |

Clients persist the response before compacting the local operation. Accepted
and merged responses replace local base versions. Conflict responses retain
the local operation and conflict ID. Deleted responses invoke the existing
tombstone suppression/recovery behavior. Invalid permanent responses retain
sanitized evidence under the existing R2-05 taxonomy.

## 9. Score authority and concurrency

The game score is a directly stored aggregate with operation authority, not a
total derived solely from player events.

Reason: v285 permits manual score edits, tracks opponent score without
requiring an event, and stores score context on events. Canonical player-event
evidence cannot reconstruct every team/opponent scoring change. Treating
events as complete scoreboard authority would discard valid current behavior.

Rules:

- Unique `score_delta` operations are idempotent by operation ID and preserve
  concurrent increments, including two increments to the same side.
- A duplicate delta operation replays; it never increments twice.
- `score_set` contains only sides actually edited. Different sides may merge
  if no post-base operation touched the same side. Same-side absolute edits
  conflict.
- Completion requires current score/status/clock bases. It snapshots the
  canonical live score into final score in the same transaction.
- If a score change commits first, a stale completion conflicts and must retry
  with the new score. If completion commits first, a stale ordinary live-score
  operation conflicts because the game is completed.
- Post-completion score changes require `score_correction`, current score and
  status bases, a bounded reason, and owner/authorized tracker authority. They
  update live and final score together.
- Event score-at-event values remain historical context. They are not silently
  rewritten by later score correction.

## 10. Event concurrency

Events remain outside game-field revisions.

- New event IDs append independently. Two different unique event IDs are both
  preserved even when created offline at the same apparent time.
- Canonical team events keep the existing client-operation ID, request hash,
  effective server event version, non-overlap correction merge, same-field
  conflict, and permanent tombstone semantics.
- Ordering is presentation order `(period order, occurred_at/timestamp,
  event_id)`; insertion order is not evidence authority.
- Duplicate operation ID with identical payload replays. Different payload is
  rejected as a mismatch. Reusing an event ID for a different event is
  rejected.
- Editing and deleting the same event are serialized by the event's version.
  Tombstone accepted first makes the edit return `event_tombstoned`; edit
  accepted first makes a stale delete conflict.
- Event corrections to different fields may merge only under the existing
  per-event changed-field proof. Corrections to different events are
  independent.
- Derived totals are recomputed from the effective event heads after ingestion
  and are never updated through the game-field RPC.
- Every event mutation must acquire the shared game advisory lock long enough
  to check `legacy_game_tombstones`; a deleted game returns `game_deleted`.

The R2-07C implementation ticket must close the remaining personal/legacy
event correction gap by either routing it through the canonical operation
model or adding an equivalent per-event versioned RPC. Production activation
is blocked until no new-client correction/delete path falls back to direct
last-write-wins `events` upsert/delete.

## 11. Clock concurrency

Recommend optimistic clock versioning plus an immutable command timeline. Do
not add a device lease.

Why not a lease: the app is offline-first, abrupt connectivity loss is normal,
and lease expiry would either block valid game-day capture or permit two
writers after uncertainty. Why not accept arbitrary absolute snapshots: a
delayed pause or start could silently erase elapsed time.

The online RPC is `lh_apply_game_clock_operation_v2`. It accepts:

- permanent operation ID and device ID;
- game ID and last acknowledged `baseClockVersion`;
- command: initialize, start, pause, resume, persist position, advance period,
  set/correct remaining time, or complete;
- client occurrence timestamp and expected lifecycle;
- command-specific bounded arguments.

The server stores the canonical remaining seconds at a server anchor timestamp
and returns both. Clients project locally from the acknowledged anchor. The
server validates state transitions and never accepts a stale absolute
snapshot.

For offline clock work, the durable client retains an ordered per-game command
batch based on the last acknowledged server clock version. Clients do not
predict intermediate server versions. On reconnect:

- if the server base is unchanged, the server validates and applies the batch
  in local order, assigns one revision per command, and returns the final state
  plus per-operation receipts;
- if the server base changed, the batch is not partially applied; one clock
  conflict is recorded and the full local timeline remains available;
- uncertain client time or an unbounded gap produces `needs_review`, never a
  silently invented clock position.

Concurrent starts at one base: first commit wins, second conflicts. Delayed
pause/start: stale base conflicts. Completion stops the clock atomically.
Tombstone rejects every clock command. Clock operations acquire the same
per-game advisory lock before tombstone/game/clock rows.

## 12. Lifecycle state transitions

Allowed actor means the game owner, an actor with current canonical
player-tracking authority, or the bounded platform reviewer role already used
by the repository. Anonymous and Live Share actors can never transition.

| Transition | Required bases | Merge behavior | Score/clock interaction | Metadata after result |
|---|---|---|---|---|
| Local draft -> active/create | create base `0`; tombstone absent | No merge with an existing row; existing ID requires update bases | Initializes score-known state and optional clock | Allowed |
| Active -> paused | Current status and clock versions | Strict; no stale merge | Atomically stops tracked clock; no final score | Allowed |
| Paused -> active | Current status and clock versions | Strict | Atomically resumes through clock command | Allowed |
| Active -> completed | Current status, score, and clock versions | Strict | Stops clock, closes open participation as existing contract requires, snapshots final score | Opponent/date/location/game type remain correctable; format/roster changes blocked |
| Paused -> completed | Current status, score, and clock versions | Strict | Clock already stopped; snapshots final score | Same as above |
| Completed -> reopened | Not supported in initial R2-07 | Returns `transition_not_supported` | No mutation | Not applicable |
| Any live state -> deleted | Existing R2-06 deletion contract plus shared lock | Delete always wins | Game/clock/event writes rejected afterward; open conflicts get terminal delete resolution | No writes |
| Deleted -> any | None | Prohibited permanently | `game_deleted` | None |

Metadata after completion is allowed only for opponent, date, location, and
game type. Period format, player/team/roster context, and sharing changes use
their stricter purpose-specific rules. Reopening remains unsupported until a
separate approved product decision defines effects on final score, clock,
events, and public sharing.

## 13. Offline/reconnect queue behavior

1. Hydration stores the game and complete server version map locally.
2. Every local action persists the game and durable operation before network
   work. The UI remains responsive offline.
3. Once an operation has been attempted, its ID/hash/payload are immutable.
   Metadata patches may coalesce only while the existing queued item has never
   been attempted. Later work receives a new operation ID.
4. Delete operations remain first priority and supersede game/clock work as in
   R2-06.
5. On reconnect, submit per game in local semantic order. Independent games
   continue in parallel only within bounded client concurrency.
6. A conflict blocks only later operations whose field group or lifecycle
   dependency overlaps. Unaffected field groups and other games continue.
7. Status/delete conflicts block score and clock operations that depend on the
   disputed lifecycle. A metadata conflict does not block event append or
   score delta.
8. Successful responses update local base versions before dependent work is
   eligible. Clock offline batches are submitted atomically from the last
   acknowledged base.
9. Conflicted operations move to durable `conflicted`, keep their safe local
   proposal and conflict ID, receive no automatic retry time, and never loop.
10. Account switch stops processing. Another account cannot view, submit, or
    resolve the prior account's work. Existing request-generation checks still
    discard late responses.

One conflict therefore does not freeze the whole queue. The dependency graph,
not arrival order alone, controls progress.

## 14. Conflict resolution foundation

The bounded RPC is `laxhornet_resolve_game_conflict_v1(p_resolution jsonb)`.
Only a currently authorized actor may resolve: current canonical personal-game
owner/account authority for a personal game; current canonical team/roster
tracking authority for a team game; or the bounded allowlisted reviewer path.
Copied/historical creator or owner/account identity is never sufficient.

Actions:

- `keep_server`: append a terminal resolution; no game mutation.
- `apply_proposed`: reapply the stored allowlisted proposal as a new write
  against supplied current versions.
- `apply_patch`: apply a new allowlisted field patch against supplied current
  versions.
- `dismiss`: terminal acknowledgment when no mutation is needed; semantically
  distinct from proving the server value was chosen.

Every resolution has a new permanent resolution operation ID and request hash.
Identical replay returns the prior result only after the shared game lock,
tombstone check, and current-authority recheck pass. The conflict row is never
updated.
If the game/version changed after the user opened the conflict, the resolution
does not apply; an append-only failed-resolution record and linked
`resolution_stale` conflict are created. Resolution can therefore conflict,
but it cannot silently overwrite newer evidence.

When game deletion commits, deletion remains authoritative and appends a
terminal `superseded_by_delete` resolution for every open conflict. A deleted
game cannot be restored through conflict resolution.

Initial user surface:

- persist the conflict locally;
- show nontechnical copy such as “This game changed on another device. Your
  version is saved and needs review”;
- mark only affected fields as not synchronized;
- keep unaffected tracking usable;
- offer a minimal Needs Attention list and the bounded actions above;
- never lead with raw codes.

This minimum safety surface belongs to R2-07D. R2-08 may later provide richer
per-game sync status/journal presentation but cannot be a prerequisite for
retaining or resolving user evidence.

## 15. Legacy-client strategy

Use versioned RPCs and a staged capability gate.

1. Additive schema/RPC migration creates v2 contracts with activation disabled.
   Existing `laxhornet_sync_game` behavior remains temporarily unchanged while
   no v2 production write is accepted.
2. Deploy an R2-07-capable client that understands the capability, hydrates
   versions, and keeps using the legacy path while activation is false.
3. After disposable certification and separate production authorization,
   atomically enable v2 writes, revoke direct authenticated game mutation, and
   replace the v1 write function with a stable
   `client_upgrade_required` response.
4. Stale v285/service-worker clients retain work locally and show actionable
   update-required copy after the rejection. Missing versions are never
   defaulted to current.
5. Keep the v1 rejection stub for at least 90 days and one full release cycle;
   removal requires telemetry showing no legacy calls and separate approval.

There is deliberately no period when version-aware writes and unversioned
legacy writes are both accepted against the same production rows. Supporting a
temporary legacy game-wide revision was rejected because v285 has no truthful
base token and `saved_at` is not a concurrency revision.

## 16. RLS and authorization

- Enable and force RLS on every new public table.
- `anon` receives no grants on operations, change journal, conflicts,
  resolutions, attempts, clock-private data, or retention controls.
- `authenticated` may receive `SELECT` on conflicts/resolutions only; row
  policy distinguishes personal games from team games. Personal conflicts
  require current canonical personal-game owner/account authority. Team
  conflicts require current canonical team/roster tracking authority, including
  `laxhornet_can_track_roster_player` where applicable. Copied account/owner or
  historical creator identity alone is insufficient. The only additional path
  is the explicitly allowlisted, non-public, audited reviewer predicate. App-
  role direct SELECT also excludes conflicts whose game has an authoritative
  tombstone, so old private values cannot bypass tombstone precedence. It
  receives no direct INSERT, UPDATE, or DELETE.
- Conflict creation and resolution occur only through approved RPC logic.
- Conflict read, replay disclosure, resolution, and retention-list RPCs enforce
  the same personal-versus-team current-authority rule as direct-table RLS and
  return non-enumerating denial without private values or conflict existence.
  Read/replay/resolution RPCs acquire the shared game lock and check the
  tombstone before private conflict disclosure; an authorized deleted-game
  request returns only `game_deleted`.
- The RPC derives actor/account from `auth.uid()` and canonical rows. It never
  trusts owner/account/team scope from the request.
- Live Share wrappers and public game reads select no conflict/operation data.
- General direct authenticated mutation of `games` is revoked at activation;
  all writes pass through versioned functions and the R2-06 tombstone trigger
  remains defense in depth.
- Privileged helpers live in a non-exposed private schema, set
  `search_path = ''`, schema-qualify every object, check `auth.uid()` and
  canonical authority explicitly, revoke default `PUBLIC` execution, and
  grant only named public wrappers to `authenticated`.
- Ownership predicates use canonical database data, not user-editable JWT
  metadata. Resolution ownership is rechecked at resolution time.

These choices reflect the current Supabase/Postgres boundary: grants decide
whether a role can reach an object and RLS decides which rows it can reach.
Both are required.

## 17. Idempotency

| Case | Contract |
|---|---|
| Accepted/merged write retry | Same actor + operation ID + request hash returns the stored canonical result and versions; no mutation/change row repeats. |
| Conflict retry | Returns the same conflict ID; no duplicate conflict row. |
| Network timeout after commit | Retry returns the committed stored result. Client persists receipt before compaction. |
| Same actor, same operation ID, same game, identical concurrent requests | The global operation-identity boundary serializes both before game mutation. The first valid request mutates and atomically stores one canonical result; the waiter returns that replay, performs no semantic mutation, creates no duplicate operation/change/conflict/resolution row, and exposes no uniqueness error. |
| Same actor, same operation ID, different games | The first valid request owns the identity. The other request performs no semantic mutation and, only after requested-game tombstone/current-authority checks, receives safe `duplicate_operation_id_scope_mismatch`; unauthorized and tombstoned outcomes retain their higher-precedence denial. No canonical stored game ID, payload, result, or conflict existence is disclosed. |
| Same actor, same operation ID, same game, different payload/type/hash | After requested-game tombstone/current-authority checks, return `duplicate_operation_id_payload_mismatch`; perform no second mutation or conflict and disclose no original payload/result. A safe tamper attempt may be counted. |
| Different actors, same client operation ID | Separate operation identities; each proceeds independently under its own authorization and game lock. |
| First-seen atomicity failure | Semantic mutation, operation identity, canonical result, and append-only history all roll back together; an identity-only committed reservation is forbidden. |
| Resolution retry | Same resolution operation ID/hash returns prior result; no duplicate resolution. |
| Out-of-order stale write | Merge only by explicit matrix and change-journal proof; otherwise conflict. |
| Score delta replay | Same delta ID applies once. Different delta IDs both apply when lifecycle permits. |
| Clock batch replay | Each command ID has a stored receipt; identical batch replay returns the same final map. Partial duplicate/new mixtures are rejected unless the batch prefix exactly matches stored receipts. |
| Same deletion ID | Existing R2-06 deterministic replay remains unchanged. |
| Different deletion ID | Existing explicit delete conflict remains unchanged. |

## 18. Observability and performance limits

Safe counters only:

- accepted, merged, replayed, rejected, and conflicted writes;
- conflicts by field group/code, clock conflicts, stale-delete rejections;
- resolution count/action and unresolved conflict age buckets;
- version-mismatch frequency and merge rate;
- client-reported offline queue depth buckets and oldest-operation age;
- operation-ID payload mismatch count;
- legacy upgrade-required call count during sunset.

Do not log field values, game/opponent/location text, scores tied to names,
event content, request bodies, tokens, share codes, device IDs, or private
conflict JSON.

Implementation budgets:

- six `bigint` game versions plus lifecycle/score columns: target under 128
  additional bytes per `games` row excluding ordinary tuple overhead;
- hydration version metadata: target under 256 serialized bytes per game;
- conflict current/proposed JSON: 4 KiB each maximum, 16 changed fields
  maximum;
- one game operation should take one advisory lock, one game row lock, and at
  most one clock row lock; target database-side p95 added latency under 50 ms
  in disposable concurrency tests;
- indexed lookup for `(actor, client_operation_id)`, `(game_id, group,
  result_version)`, open conflicts by authorized account/game, and retention;
- Live Share queries and season/dashboard calculations must not join conflict
  or operation tables;
- client queue remains bounded by compaction of acknowledged operations and a
  visible warning before local storage approaches current safety limits.

## 19. Open questions answered and approvals required

| Required question | Design answer | Approval state |
|---|---|---|
| Is score authoritative from events or direct fields? | Direct server score aggregate with idempotent operations; events retain context and derived statistics. | David approval required. |
| Can different score subfields merge? | Yes for different-side explicit patches with journal proof; unique deltas merge; same-side absolute edits conflict. | David approval required. |
| Can metadata change after completion? | Opponent/date/location/game type yes; period format and roster context no without a separate protected workflow. | David approval required. |
| Can completed games be reopened? | Not in initial R2-07. | David approval required before any later support. |
| Does one conflict block later operations? | Only overlapping/dependent groups; unrelated work continues. | Design recommendation. |
| Who owns clock authority? | Server clock row/revision; no device lease. Offline client timeline is proposed evidence, not authority. | David approval required. |
| How are legacy clients handled? | Versioned RPCs, then fail-closed actionable upgrade-required rejection at separately authorized activation. | David approval required. |
| How much proposed data is stored? | Allowlisted overlapping fields only, 4 KiB per current/proposed object, no full snapshots. | Privacy review required. |
| How long are conflicts retained? | Open while game exists; resolved/deleted conflicts purge-eligible after 180 days. | David plus privacy/legal review required. |
| Is first resolution UX R2-07 or R2-08? | Minimum safe notice/list/actions are R2-07D; richer journal/status remains R2-08. | David approval required. |
| Are conflict records deletable after resolution? | Not by clients and never edited; only whole-record retention purge after eligibility. | Privacy/legal review required. |
| Can event corrections merge independently? | Different events yes; different fields on one event only with per-event journal proof; same field conflicts. | Existing canonical contract retained. |
| What happens when a game is deleted with open conflicts? | Delete wins and appends terminal `superseded_by_delete` resolutions; no conflict can restore the game. | Existing R2-06 authority retained. |
| What RPC path protects v285? | Add `laxhornet_sync_game_v2`; keep v1 only until atomic activation, then convert v1 to an upgrade-required stub. | David approval required. |

Implementation validation must still prove PostgreSQL query plans and locking,
the exact legacy status/lifecycle projection, score initialization from richer
local games, personal-event version routing, client storage growth, and the
wording/accessibility of the minimum conflict surface. These are validation
obligations, not permission to change the design silently.

## 20. Release boundary

This planning task authorizes no implementation, migration, production access,
Supabase mutation, deployment, production verification, or rollout activation.

Every implementation phase requires its own approved ticket, branch, focused
tests, final-diff regression appropriate to Level 3, exact-PR-SHA independent
review, and merge decision. Production activation requires a fresh release
ticket and explicit authorization after all prior phases pass. R2-06 remains
closed, v285 remains current, and R2-07 implementation remains unauthorized.

Final design disposition:
`R2-07 DESIGN RE-REMEDIATED — NEW EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW PENDING`.
