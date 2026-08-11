# R2-07 Clock Command and Atomic Batch Integration — Implementation Evidence

Status: `P1 REMEDIATED — NEW EXACT-HEAD LEVEL 3 REVIEW REQUIRED`

Risk level: `LEVEL 3`

Starting main: `08e7abf01d22cb60fc88422c961104a952b9b7e9`

Branch: `feature/r2-07-clock-command-batch-integration`

P1 remediation implementation commit:
`81c77c7470c3f9e72440691c9e0f0ba8dcb8912c`

Historical certification evidence: PR #70 remains the truthful failed R2-07E
record and was not used as an implementation branch.

## Confirmed root cause

At the merged baseline, both approved public wrappers
`lh_apply_game_clock_operation_v2(jsonb)` and
`lh_apply_game_clock_batch_v2(jsonb)` returned only `r207_not_activated`.
No later migration replaced them, and the client submitted only the older
tracked-clock snapshot RPCs. The certification gap was therefore real: the
approved server command/batch architecture existed in design and dormant
schema, but no functional Preview/test wrapper or client route connected it.

## Failed exact-head review and bounded remediation

Independent Level 3 review failed exact head
`895612d17ec52bd101f126cf77696023b908f3b9` at
`https://github.com/degrasse-mastermind/LaxHornet/pull/71#issuecomment-5248367312`.
The failed review remains preserved. Its three P1 findings were remediated
without starting R2-07E or changing the production-default-off boundary:

- **Exact prefix plus new suffix:** the batch function previously treated the
  permanent batch ID as one immutable whole-request hash. It now records
  append-only batch request versions, proves the complete stored command-ID,
  canonical-hash, sequence, base, and result-revision prefix, reuses the exact
  stored receipts without mutation, and applies only a fully validated new
  suffix. Changed, reordered, missing, non-prefix, interleaved, or wrong-base
  mixtures still fail closed.
- **Offline elapsed chronology:** `client_occurred_at` was parsed but every
  command used one transaction timestamp. The batch now validates ordered
  occurrence evidence within the existing 30-second certainty bound, maps the
  relative intervals onto server anchors, applies elapsed time only while the
  clock is running, and rejects reversed, excessive, ambiguous-running, or
  completion-boundary chronology as `clock_chronology_needs_review` with zero
  partial mutation.
- **JavaScript-safe revision ceiling:** the server previously incremented an
  unbounded PostgreSQL `bigint`. Single commands now reject before mutation at
  the ceiling, and batches preflight the complete count of genuinely new
  suffix commands before applying the first one. Exact replay consumes no
  revision. `clock_revision_exhausted` is non-retryable and sanitized by the
  client while the existing client safe-integer check remains defense in depth.

## Additive implementation

- Migration `20260811010813_r207_clock_command_batch_integration.sql` replaces
  only the dormant wrappers under the existing disabled-by-default Preview
  control. It adds private immutable batch receipts and bounded helpers for
  initialize, start, pause, resume, persist position, period advance, set or
  correct remaining time, and completion.
- Each command derives the actor from `auth.uid()` and authority from the
  current canonical game/team/roster state. It serializes permanent operation
  identity before one game advisory lock, applies tombstone precedence, checks
  lifecycle/status/clock bases, updates from a server anchor, increments one
  bigint clock revision, and appends immutable command/operation evidence.
- A batch locks all identities in stable order before the game lock, validates
  the complete ordered sequence, and either commits every command with one
  revision/receipt each or rolls back clock state, identities, receipts, and
  evidence. Base mismatch records one bounded conflict and applies no prefix.
- Rollback `20260811010813_r207_clock_command_batch_integration_rollback.sql`
  requires the Preview control off, refuses after new immutable evidence, and
  restores the prior dormant wrappers and pre-integration schema only when
  zero evidence exists.

## Client integration

- `tracked-playing-time-service.js` retains the existing local clock and adds
  acknowledged server clock version plus server-anchor projection. Local
  actions clear a stale anchor and never invent a server revision.
- `event-operation-service.js` retains the existing account-scoped durable
  queue. Permanent command IDs and attempted payloads are immutable; ordered
  offline commands share a permanent batch ID; receipts persist before
  compaction; a whole batch conflict remains durable and non-retryable.
- `app.js` selects the new contract only when both the controlled R2-07 Preview
  and clock-command flags are true. Production continues down the legacy
  path. Online actions call the single-command RPC; queued reconnect work calls
  the batch RPC. Accepted canonical state is applied only after durable receipt
  handling, while later local commands remain visually intact.
- Future-schema state blocks append, retry, batch, receipt, conflict, and
  compaction mutation. Central classification retries transport failures only,
  blocks authorization/validation/conflict/permanent failures, and stores no
  raw PostgreSQL, PostgREST, Supabase, host, or nested error text.
- The minimal conflict surface says only: `The game clock changed on another
  device. Your clock actions are saved and need review.` It exposes no RPC,
  operation ID, database code, raw timestamp, or other-device identity.

## Verification

- Focused disposable PostgreSQL clock matrix: `55/55 PASS`, including a
  dedicated real-RPC P1 adversarial group at `19/19 PASS`. It covers default-
  off behavior, all command semantics, missing and
  stale bases, start/start concurrency, delayed stale mutation, timeout-style
  replay, payload mismatch, completion/no-reopen, tombstone, personal/team/
  revoked/copied-owner authority, batch success/conflict/replay/invalid/
  injected rollback/partial-mix refusal, lock order, unrelated games, RLS,
  grants, rollback, exact prefix extension/rejection cases, bounded offline
  chronology, and safe revision exhaustion. Zero named container residue.
- Focused durable client matrix: `15/15 PASS`, including single and batch
  persistence, immutable attempted payload, permanent IDs, offline ordering,
  receipt/compaction order, whole-timeline conflict retention, no auto-retry,
  network retry, authorization/raw-error sanitization, account switch,
  future-schema non-mutation, server-anchor projection, no predicted versions,
  timeout prefix extension, chronology conflict retention, and sanitized
  non-retryable exhaustion.
- Real two-context browser matrix: `18/18 PASS`, desktop and `390x844` mobile.
  Concurrent start produced one authority and one safe durable conflict;
  unchanged-base offline work applied in order; changed-base reconnect retained
  the full batch and applied no prefix; completion stopped the clock and stale
  mutation could not reopen it; controls remained at least 44px, no horizontal
  overflow occurred, and no page errors were observed. Additional browser
  probes preserve two elapsed intervals, replay a committed timeout prefix
  before a new suffix, and expose no raw revision/debug detail at exhaustion.
- R2-07A: `71/71 PASS`. R2-07B: client `32/32`, browser `12/12`, migration
  `13/13 PASS`. R2-07C: client `30/30`, client safety `37/37`, browser `7/7`,
  migration `25/25 PASS`. R2-07D: client `32/32`, event dismiss `13/13`, dismiss
  browser `10/10`, migration `23/23 PASS`. Tombstone concurrency: `8/8 PASS`.
- New remediation-head complete canonical-plus-additive regression: `69/69 PASS`.
  The prior reviewed head also passed `69/69`. An earlier
  consolidated attempt exposed one pre-existing transient hydration-browser
  `page.reload ERR_ABORTED`, which passed immediately on focused rerun, plus
  review-package expected-list omissions fixed before the clean final run.
  Secret/host scan and `git diff --check` passed. Zero `laxhornet-r207*`
  containers and zero headless Playwright processes remained.
- Historical draft PR #71 integration head
  `11475fc2a3c401370e8dc327e9345aa8b497ac8c` passed Docker, portable
  regression, automatic isolated Supabase Preview, Vercel, and Preview
  Comments checks. The managed application Preview was
  `https://lax-hornet-git-feature-r2-07-9b0304-davidltdanes-4133s-projects.vercel.app`;
  the isolated Supabase Preview project was `mojsdmyfzhdqukwwbhyk`.
- New remediation-head Docker, portable regression, automatic isolated
  Supabase Preview, Vercel, and Preview Comments checks remain pending until
  the evidence commit is pushed.

## File identity

- Migration SHA-256:
  `c09cbb8988418d24c42c3882f21a465fd4365561c14cada64a3bd4dc20998409`
- Rollback SHA-256:
  `8548bbe4e91f506a2222bfe7feab826d4e5725dcfe98ac98098075b3484e1c93`

## Production and disclosure boundary

No local/manual/CLI/Dashboard/linked-main/persistent-shared/production
migration was applied. No production capability, data, credential, deployment,
release/cache marker, v1 write path, retention, Live Share, public recap,
dashboard, or anonymous read changed. The repository runtime flag and migration
control row remain false. A pull request may trigger only the configured
automatic data-less isolated Supabase Preview migration.

`AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION — ACCEPTED CI VERIFICATION`

R2-07E must not be rerun until this draft PR passes independent exact-head
Level 3 review and is merged.
