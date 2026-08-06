# R2-07 Test Plan

Status: `REVIEW REMEDIATION — INDEPENDENT EXACT-HEAD REVIEW PENDING`

Risk level: `LEVEL 3`

Remediation baseline: `0e90e3b4017d65ef35bdf95fc165b3379a4c6844`

All fixtures must be synthetic, adult-safe, disposable, and isolated from
production. No test may require a real child/player/family identity, production
credential, production mutation, or current user's local browser storage.

## 1. Certification principles

1. Test observable contracts, not only source strings or green process exit.
2. Force adversarial request ordering and network ambiguity.
3. Inspect database rows, local durable queue state, and rendered status after
   every scenario.
4. Assert absence as well as presence: no duplicate operation, no duplicate
   conflict, no unauthorized row, no resurrection, no false Synced state.
5. Hash exact migrations and RPC definitions in evidence before any release.
6. Run focused suites during each phase. Run the complete canonical-plus-
   additive regression once after each Level 3 implementation diff stabilizes.
7. Production activation and verification remain separate and unauthorized by
   this plan.

## 2. Test layers

### 2.1 Pure/unit tests

Add focused JavaScript tests for:

- version-map parsing, persistence, future-version preservation, and required
  base validation;
- metadata/score/status/roster/sharing changed-field allowlists;
- group increment rules and aggregate `game_revision` behavior;
- same-field overlap detection and non-overlap proof;
- score delta commutativity and absolute-set conflict rules;
- lifecycle transition validation;
- operation ID/hash canonicalization and mismatch classification;
- immutable-after-first-attempt local operation payload;
- queue dependency derivation and per-field-group progress;
- clock batch construction without client-predicted server revisions;
- response classes: accepted, merged, conflict, deleted, replay, invalid;
- local conflict persistence, conflict-ID association, and no automatic retry;
- bounded conflict privacy projection and rejection of unknown/private fields;
- resolution action validation and stale-resolution handling;
- legacy upgrade-required classification and user copy mapping;
- tombstone precedence before any merge rule.
- replay disclosure only after the shared lock, authoritative tombstone check,
  current personal/team authority check, and post-lock operation recheck;
- deterministic simultaneous-first-seen idempotency with no exposed unique-
  constraint failure;

Minimum assertions:

| Contract | Required proof |
|---|---|
| Field-group increments | Only touched groups and aggregate game revision increment once. |
| Same-field conflict | Stale same-field absolute patch creates conflict and does not change game. |
| Non-overlap merge | Stale different-field patch merges only when journal proves disjoint history. |
| Idempotent replay | Identical operation returns same canonical result and conflict ID/version map. |
| Payload mismatch | Same ID/different normalized payload is rejected and makes no game/conflict mutation. |
| Tombstone wins | Every operation class, including accepted/conflict/resolution replay, checks authoritative deletion under the game lock before stored-result disclosure. Authorized actors receive `game_deleted`; actors without current authority receive non-enumerating denial. |
| Conflict immutability | No API path mutates conflict content; resolution appends separately. |
| Resolution checks | Apply actions require latest relevant versions and current authority. |
| Simultaneous first-seen idempotency | Two identical concurrent requests create one canonical mutation/result; the waiter returns replay before semantics and never exposes a uniqueness error. |
| Current conflict authority | Personal conflicts require current personal owner/account authority; team conflicts require current team/roster tracking authority, not historical/copied owner identity. |

### 2.2 Database/migration tests

Run against a disposable database reconstructed from all committed migrations.

Schema assertions:

- forward migration from a populated v285-shaped dataset;
- constant/default/backfill correctness and nonempty-table safety;
- legacy status to lifecycle mapping;
- `score_known=false` on existing rows and true only after explicit v2
  initialization/new create;
- version/final-score/check constraints;
- required indexes and query-plan usage;
- exact RPC signatures, owners, security mode, search path, ACLs;
- RLS enabled and forced on every new public table;
- `anon` has no conflict/operation/clock access;
- authenticated direct DML denial;
- authorized owner/team tracker/reviewer reads only allowed conflict rows;
- personal-game owner reads only while current canonical personal authority
  remains; team-game reads require current canonical team/roster tracking
  authority through `laxhornet_can_track_roster_player` where applicable;
- a historical team-game creator or copied owner/account identifier has zero
  conflict read/replay/resolution/retention access after roster authority is
  revoked;
- cross-account and unrelated-team reads return zero without content leakage;
- conflict JSON allowlist/4 KiB limit;
- append-only triggers for operations, changes, conflicts, resolutions, and
  accepted clock command history;
- retention deletion possible only through the reviewed maintenance path and
  impossible through app roles;
- dormant v2 functions return `r207_not_activated` before activation;
- activation changes v1 to `client_upgrade_required` and leaves no dual-write
  window;
- pre-activation rollback succeeds only with zero v2 evidence;
- rollback refuses after any accepted v2 evidence;
- post-activation fail-closed disable preserves reads/history/tombstones.

Transaction/concurrency assertions:

- advisory lock acquired before tombstone/game/clock reads in every mutation;
- same-game writes serialize; different games remain independent;
- game row and clock row lock ordering is identical across status, clock,
  delete, and resolution RPCs;
- concurrent replay creates one canonical operation;
- simultaneous identical first-seen requests create one canonical mutation,
  operation, change/conflict/resolution result as applicable, and one replay;
  the waiter does not enter semantic processing or expose a unique-constraint
  error;
- simultaneous same operation ID with different canonical hashes produces one
  safe `duplicate_operation_id_payload_mismatch`, no original request/result
  disclosure, and no duplicate mutation or game conflict;
- concurrent same-field writes create one accepted change and one conflict;
- concurrent non-overlap writes produce two accepted changes and monotonic
  versions;
- conflict row and canonical operation commit atomically;
- accepted mutation and field-change journal commit atomically;
- delete racing game/clock/event/resolution always leaves tombstone authority;
- no deadlock under repeated inverse arrival timing;
- network/transaction failure before commit leaves no partial result;
- timeout after commit is recoverable through replay.

Use real concurrent database sessions/processes, not a sequential simulation,
for lock tests. Advisory-lock tests must independently inspect function bodies
and exercise observed blocking/order.

### 2.3 RLS/authorization matrix

Actors:

- anonymous;
- personal-game owner;
- unrelated authenticated account;
- current authorized team tracker for the exact roster player;
- team member without player-tracking authority;
- actor whose authority was revoked after conflict creation;
- bounded platform reviewer;
- public Live Share caller.

For each actor test game update, clock, conflict read, resolution, event append,
event correction, delete, and tombstoned ID. Confirm the server derives scope
from auth/canonical rows and ignores/rejects forged account/team/roster IDs.

## 3. Required two-device scenarios

Each device uses an isolated browser context, localStorage namespace, durable
device ID, and controllable network. The database begins from a known
synthetic fixture and is inspected after every step.

### Scenario 1 — different metadata fields

1. Both hydrate metadata version N.
2. A changes opponent; B changes location.
3. Deliver A then B and repeat with inverse delivery.
4. Expect both values, monotonic version N+2, B/A `merged` as applicable, two
   operation rows, zero conflicts, no local loss.

### Scenario 2 — same metadata field

1. Both hydrate N and change opponent differently.
2. First accepted; second conflict.
3. Expect one immutable conflict, second local proposal retained, no retry loop,
   unaffected operations continue.

### Scenario 3 — score versus score

Cover:

- two unique same-side +1 deltas: both accepted exactly once;
- replay of either delta: no extra point;
- different-side absolute edits: merge with changed-field proof;
- same-side absolute edits: conflict;
- delta racing stale absolute set: conflict, never loss of delta.

### Scenario 4 — score versus completed status

Run both transaction orders:

- score first -> stale completion conflicts until current score is reviewed;
- completion first -> stale ordinary score conflicts on lifecycle;
- explicit post-completion correction with current bases succeeds and updates
  live/final score together.

### Scenario 5 — clock start versus clock start

Both hydrate the same clock version. First start accepted; second returns one
clock conflict with its local command retained. Confirm one authoritative
server anchor and no silent owner/lease switch.

### Scenario 6 — clock stop versus delayed start

Force A pause and deliver B's older start/resume later. Expect conflict, no
clock reversal, no silent elapsed-time loss, and bounded conflict values only.

### Scenario 7 — offline events after remote score update

B appends unique events offline while A updates score. On reconnect all event
IDs remain, score remains the server aggregate unless a separate linked score
delta is present, derived totals recompute, and no game-wide false conflict
occurs.

### Scenario 8 — Device A deletes while Device B writes

Exercise metadata, score, status, clock, event append, event correction, and
resolution requests from B across before/after/in-flight delete timings.
Final state must have one durable tombstone, no game resurrection, no
post-delete event/clock mutation, and deterministic `game_deleted` results.

### Scenario 9 — same operation replay

For accepted, merged, conflict, deletion, clock batch, and resolution results,
repeat the exact request. Expect stored result replay, identical IDs/versions,
and no duplicate rows/mutations, but only after the locked tombstone and current
authority checks pass.

### Scenario 10 — same operation ID, different payload

Change type, game ID, one field value, or base version while reusing the ID.
Expect `duplicate_operation_id_payload_mismatch`, safe attempt evidence only,
and no new conflict.

### Scenario 11 — resolution after another server update

Open same-field conflict, load it on A, let B change that field again, then A
applies proposed/custom. Expect no mutation, append-only failed resolution
attempt, linked `resolution_stale` conflict, and both proposals retained under
privacy bounds.

### Scenario 12 — account switch during conflict handling

Begin read/resolve under account A, switch context to B before response, and
deliver late response. Expect request-generation rejection locally, no B
visibility, no B queue processing, and server authorization bound to A's token.

### Scenario 13 — stale service-worker/v285 client reconnect

After activation, a v285 bundle attempts v1 write. Expect
`client_upgrade_required`, local game/operation retained, nontechnical update
notice, zero server mutation/conflict, and successful retry only after updated
client hydrates real versions and creates a new v2 operation.

### Scenario 14 — out-of-order responses

Delay response N, allow response N+1 or another hydration generation to finish,
then release N. Expect stale response discarded by operation identity/version
and hydration generation; no base-version regression or false compaction.

### Scenario 15 — network timeout after server commit

Commit server operation, suppress response, leave local operation unresolved,
then retry. Expect stored replay, receipt persisted before compaction, exactly
one mutation/conflict, and truthful UI throughout.

### Scenario 16 — replay after deletion

Create one accepted operation and one conflict operation, then delete the game.
Retry each original request and any stored resolution operation, and attempt a
direct-table/read-RPC conflict fetch. App-role direct SELECT returns no retained
conflict row. An actor with current tombstone-read authority receives
`game_deleted` with no stored
accepted/conflict/current/proposed values. An actor without current authority
receives only non-enumerating authorization denial. Confirm no new conflict,
mutation, or resolution and no regression to R2-06 tombstone precedence.

### Scenario 17 — replay and conflict access after authority loss

For a personal game where authority can be removed under the implemented
contract, and for a team game whose player claim/roster tracking authority is
revoked after conflict creation, test operation replay, direct conflict read,
conflict-list/retention eligibility, and resolution. Every path returns
non-enumerating denial with no conflict existence, raw request, current value,
proposed value, or stored result. Historical creator/copied account identity
does not preserve team access. Direct-table policy and RPC behavior agree.

### Scenario 18 — simultaneous identical first-seen requests

Use real concurrent sessions to send two identical previously unseen requests.
Hold the first after its preliminary lookup so the second also misses, then let
both contend on the game lock. Expect the first valid request to commit one
canonical mutation/result and the second to return its replay after the
post-lock operation recheck. Confirm no duplicate mutation, operation, change,
conflict, resolution, or uniqueness-constraint error.

### Scenario 19 — simultaneous same ID with different hashes

Use real concurrent sessions with the same actor/operation ID and different
canonical payload hashes. Exercise both arrival orders. Exactly one valid
canonical request may commit; the other returns
`duplicate_operation_id_payload_mismatch` after locked tombstone/current-
authority checks. Confirm no original payload/result disclosure, no game
conflict for the mismatch, and no duplicate mutation/evidence beyond any
already approved bounded security-attempt row.

### Scenario 20 — account switch during replay or conflict read

Begin an authorized replay and a conflict read under account A, switch the
local account/request generation to B while each response is in flight, then
release the responses. The server remains bound to A's authenticated request;
the client rejects both late responses by account/generation binding. Account B
receives no private value, conflict existence, local compaction, or queue work.

## 4. Additional adversarial scenarios

- Existing legacy game with different local scores on two devices initializes
  `score_known=false`: first initialization accepted, second conflicts.
- Missing, filtered, unauthorized, or partial tombstone result is not inferred
  as deletion; explicit authorized tombstone remains required.
- Same deletion ID replay and different deletion ID conflict remain byte/
  semantics compatible with R2-06.
- Open metadata conflict followed by delete receives terminal
  `superseded_by_delete`; resolution cannot restore.
- Completion versus metadata edit: allowed descriptive field survives both
  delivery orders; period-format edit does not.
- Revoked team authority after operation queue: rejected without private
  conflict detail; local evidence retained under R2-05 taxonomy.
- Revoked team authority after conflict creation: direct RLS read, read RPC,
  replay, resolution, and retention-list paths all deny identically; copied
  owner/account identity never substitutes for current roster authority.
- Forged `accountId`, team ID, roster player ID, owner ID, or versions cannot
  cross scope.
- Base version greater than server is invalid; no conflict created.
- Missing base version is invalid; no compatibility default.
- Conflict proposal includes raw request, note, player snapshot, share code,
  token, or >4 KiB object: fail closed and store none of it.
- Clock offline batch with one invalid middle command applies nothing.
- Clock batch replay with exact prefix/new suffix follows the documented batch
  rule and cannot duplicate prefix commands.
- Concurrent writes to different game IDs do not block behind the same
  advisory key.
- Version values near JavaScript safe-integer limit fail closed before loss of
  precision; implementation must define a safe ceiling even though it is
  operationally remote.

## 5. Browser/user tests

Inspect desktop and narrow mobile layouts with real rendered screenshots or
equivalent retained evidence. At minimum:

- nontechnical “changed on another device” notice;
- affected local operation remains visible/retained after refresh and offline
  reload;
- unaffected fields continue syncing;
- no false global/per-game Synced state;
- conflict detail contains safe field labels, not raw codes or JSON;
- keep server, apply proposed, custom patch, and dismiss minimum actions;
- stale resolution updates the notice without losing the earlier proposal;
- account A conflicts are absent after switching to account B;
- offline tracking remains one-handed/usable while conflict exists;
- update-required copy for stale v285 client and successful recovery after
  service-worker update;
- deleted game never reappears in Home, Live, Review, Season, storage, or queue
  recovery;
- Live Share contains no conflict/operation/clock/private proposed data;
- keyboard/focus/accessible-name behavior for the minimum resolution surface;
- 360 px layout has no hidden action or horizontal overflow.

Browser success requires inspected state, not only a green automation exit.

## 6. Performance and storage tests

Use production-shaped synthetic row counts and report p50/p95/p99:

- same-game accepted write latency and lock wait;
- different-game concurrent throughput;
- stale non-overlap journal lookup;
- conflict insertion and authorized open-conflict query;
- hydration with versions at representative season size;
- unresolved/resolved conflict-table growth;
- local queue size with 100 metadata/score/event/clock operations;
- compaction after acknowledgments;
- Live Share and season/dashboard query plans before/after migration.

Acceptance targets:

- added database-side p95 for ordinary game mutation under 50 ms in disposable
  tests excluding network latency;
- version hydration metadata under 256 serialized bytes per game;
- conflict current/proposed JSON <= 4 KiB each and <= 16 fields;
- no new join from Live Share/season/dashboard to conflict or operation tables;
- no unbounded full-table scan for replay, journal overlap, authorized conflict
  list, or retention eligibility;
- unrelated game IDs make progress during a held same-game lock.

Any missed target requires query-plan evidence and a reviewed design adjustment
before activation; it is not silently waived.

## 7. Existing regression preservation

At minimum retain and run affected current suites, including:

- `node tools/test_sync_characterization.mjs`;
- `node tools/test_durable_sync_operations.mjs`;
- `node tools/test_sync_error_classification.mjs`;
- `node tools/test_game_tombstones.mjs`;
- `node tools/test_game_tombstone_concurrency.mjs`;
- `node tools/test_game_tombstone_migration.mjs`;
- `node tools/test_hydration_tombstone_suppression.mjs`;
- `node tools/test_event_operation_service.mjs`;
- tracked-playing-time service/database/browser suites;
- game-scope capability and Live Share/privacy suites;
- release-manifest and v285 stabilization preservation checks;
- `node tools/run_v283_local_regression.mjs` once after the final Level 3 diff
  stabilizes;
- `git diff --check`, secret/host scan, and migration identity checks.

The exact command set must be discovered from the implementation head and
current regression runner; do not rely on this list as permission to run
production-oriented tools.

## 8. Evidence package for implementation phases

Each phase retains:

- exact commit SHA and changed-file list;
- migration/RPC hashes where applicable;
- focused command/results;
- disposable fixture manifest and zero-residue cleanup result;
- concurrency timing/order trace using opaque IDs;
- RLS/grant matrix results;
- browser screenshots/traces for UI phases;
- explicit non-production/non-deployment statement;
- exact-PR-SHA independent Level 3 review disposition.

R2-07E certification must combine all prior phases at one exact integration SHA
and independently verify hashes from committed content. Green focused suites
alone do not authorize production release.

Final test design disposition:
`R2-07 DESIGN REMEDIATED — EXACT-HEAD INDEPENDENT LEVEL 3 REVIEW PENDING`.
