# R2-07C Versioned Event Corrections — Implementation Evidence

Status: `MATERIAL CLIENT-SAFETY FINDINGS REMEDIATED — NEW EXACT-HEAD LEVEL 3 REVIEW REQUIRED`

Risk level: `LEVEL 3`

Starting main: `df9347ba9bfa9c188513378070bfea70f695ad17`

Branch: `feature/r2-07c-versioned-event-corrections`

## Implementation

- `20260809173500_r207c_versioned_event_corrections.sql` adds a default-off
  Preview-only `laxhornet_sync_event_v2` contract, server event versions,
  immutable operation/attempt/changed-field history, permanent event
  tombstones, bounded validation, canonical server request hashing, current
  authority, expected lifecycle, and the shared legacy-game advisory lock.
- `event-operation-service.js` owns durable R2-07C records, desired/accepted
  event evidence, permanent operation IDs, exact bases, receipt-before-
  compaction, conflict retention, delete supersession, and reconnect replay.
- `app.js` stores that state in its own account-scoped safety domain, hydrates
  server event versions, routes Preview create/correct/delete before legacy
  writes, and renders only: `This event changed on another device. Refresh
  before saving again.`
- `runtime-config.js` defaults `r207cVersionedEventCorrections` to false. The
  Vercel builder enables it only in a verified Preview artifact; the existing
  Supabase Preview control remains disabled by migration default and is enabled
  only by the data-less isolated Preview seed.

## Failed review and remediation

Independent review of exact head
`867e847c82fe99008e3886898287015e7465c830` failed because an older client
could mutate and persist a future-schema R2-07C state and because thrown RPC
errors were all labeled retryable network failures while raw server messages
entered durable state. The failed disposition remains preserved.

The remediation adds one state-model mutation guard used by hydration, create,
correction, delete, queue processing, retry state, conflicts, receipts, and
compaction. A state newer than `CURRENT_SUPPORTED_SCHEMA_VERSION` remains
unchanged and read-only, performs no RPC or persistence work, and returns only
`This data was saved by a newer version of LaxHornet. Update the app before
making changes.` The app-wide persistence path also skips that future domain.

One centralized `classifyRpcFailure` now permits automatic retry only for
bounded `network_unavailable` and `service_unavailable` results. Authorization,
validation, client-upgrade, and unknown permanent failures become blocked with
only a safe code. Conflict and tombstone outcomes retain their existing paths.
Raw messages, nested causes, error bodies, SQLSTATE text, and arbitrary objects
do not enter R2-07C, Trust Spine, or tracked-time durable error state.

## Concurrency and safety results

- Same event/same field: first accepted; stale second conflicts without write.
- Same event/different fields: stale correction merges only when immutable
  post-base changed-field history proves non-overlap.
- Different events: independent logical versions and effective heads.
- Delete: unattempted local correction is superseded; exact-base server delete
  creates a permanent tombstone; stale delete conflicts; later correction
  returns `event_tombstoned`.
- Game deletion: the RPC takes the shared game lock and checks
  `legacy_game_tombstones` before event state, returning `game_deleted`.
- Authority and lifecycle: derived current personal/team tracking authority and
  explicit lifecycle are checked after locking; completed games reject ordinary
  event append; denials do not disclose event existence or values.
- Offline/reconnect: local mutation and operation persistence happen before
  cloud work; attempted payloads remain immutable; conflicts do not retry; a
  receipt is persisted before compaction.

## Focused verification

- R2-07C client/adversarial matrix: `30/30 PASS`.
- R2-07C client-safety remediation matrix: `37/37 PASS`.
- Disposable PostgreSQL migration/concurrency/rollback matrix: `25/25 PASS`.
- Two authenticated browser-session desktop/mobile matrix: `7/7 PASS`.
- R2-07B client and browser preservation: `32/32` and `12/12 PASS`;
  Preview migration preservation: `13/13 PASS`.
- R2-07A Docker preservation: `71/71 PASS`; durable game tombstone
  concurrency: `8/8 PASS`.
- Node syntax and `git diff --check`: `PASS`.
- Migration SHA-256:
  `300c94b440ea9e03e0b6916e11d64459f9b065e98f6960b7e06bc64470411f21`.
- Rollback SHA-256:
  `f7c34ba2598e4fd1a1c849a868488ffa244c3bef873cb1dc98efad5d0f599249`.
- Complete canonical-plus-additive regression: `62/62 PASS` from committed
  implementation head; the subsequent evidence-only closeout edit does not
  change runtime, SQL, tests, workflows, or release controls.
- New remediation-head GitHub Docker/regression: pending push and automatic
  draft-PR rerun.

## Boundaries

No local, manual, CLI, linked-main, Dashboard, persistent shared-environment,
or production migration was applied. No production migration history, data,
credentials, deployment, release/cache marker, public disclosure, RPC/RLS
production activation, clock behavior, or production state changed.

The configured GitHub integration may automatically apply repository
migrations to its isolated, data-less, separately credentialed ephemeral
Supabase Preview branch tied to the draft PR. When it does, that status is:

`AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION — ACCEPTED CI VERIFICATION`

R2-07D and production activation remain unauthorized.

No R2-07C SQL, rollback SQL, RLS, grants, RPC, migration, release marker, or
production configuration changed in the client-safety remediation.
