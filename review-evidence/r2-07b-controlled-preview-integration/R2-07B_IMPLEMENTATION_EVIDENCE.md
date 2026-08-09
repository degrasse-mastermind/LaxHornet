# R2-07B Controlled Preview Integration — Implementation Evidence

Status: `CLOSED VIA CORRECTIVE PR #66`

Risk level: `LEVEL 3`

Starting main: `3e990ddcec06dbe660703db5fdbf8c12df0ad485`

Branch: `feature/r2-07b-controlled-preview-integration`

## Approved phase definition

R2-07B hydrates server versions; represents field operations durably; submits
v2 patches only when the server capability is enabled in a disposable
environment; and persists accepted, merged, conflicted, deleted, and replay
results truthfully. Its approved scope is the local schema/version map,
immutable-after-attempt operations, group scheduling, safe metadata/score/
status/roster/sharing builders, R2-05 response classification, lossless
hydration, bounded local conflict state, stale-client fixtures, and focused
unit/browser/offline/out-of-order tests. Production activation, v1 rejection,
clock/event cutover, rich resolution UI, deployment, and R2-07C+ are excluded.

## Files changed

- Runtime/UI: `app.js`, `event-operation-service.js`, `runtime-config.js`,
  `styles.css`.
- Preview database: `supabase/migrations/20260809155442_r207b_controlled_preview_integration.sql`,
  `supabase/rollback/20260809155442_r207b_controlled_preview_integration_rollback.sql`,
  `supabase/seed.sql`,
  `supabase/migrations/20260809164435_r207b_qualify_preview_game_update.sql`,
  `supabase/rollback/20260809164435_r207b_qualify_preview_game_update_rollback.sql`.
- Preview/CI: `vercel.json`, `tools/build_r207b_vercel_preview.mjs`,
  `.github/workflows/docker-tests.yml`,
  `.github/workflows/laxhornet-regression.yml`.
- Focused/preservation tests: `tools/test_r207b_controlled_preview.mjs`,
  `tools/test_r207b_preview_migration.mjs`,
  `tools/test_r207b_two_session_browser.cjs`, `tools/release_containment.mjs`,
  `tools/run_v283_local_regression.mjs`,
  `tools/test_post_r206_stabilization_release.mjs`,
  `tools/test_release_hygiene.mjs`, `tools/test_trust_spine_release1.mjs`,
  `tools/validate_release_manifest.mjs`.
- Governance/evidence: `TICKETS.md`, `REPO_CURRENT_STATE.md`,
  `docs/LAXHORNET_ROLLOUT_CHECKLIST.md`, and this evidence file.

## Implementation

- `event-operation-service.js` owns the R2-07B durable field-operation domain,
  canonical request hashing, builders, version normalization, receipt-before-
  compaction, group-conflict blocking, and transport/permanent outcome state.
- `app.js` hydrates version columns onto the existing canonical game object,
  stores future numeric version fields, connects Game Review metadata edits,
  blocks the legacy whole-game write after a field conflict, and renders the
  bounded refresh surface.
- `runtime-config.js` sets `r207bControlledPreview: false`.
- `20260809155442_r207b_controlled_preview_integration.sql` adds a forced-RLS,
  no-app-table-access control row that defaults disabled, a bounded capability
  response, and an authenticated wrapper around the already reviewed R2-07A
  engine. It does not activate clock/event/conflict-resolution functions.
- `supabase/seed.sql` contains no fixture or credential data. It only enables
  the control row when the GitHub Preview branch executes Preview seeding.
- `build_r207b_vercel_preview.mjs` refuses non-Preview Vercel builds, requires
  the separate Preview Supabase URL/publishable credential at build time, and
  modifies only the generated preview artifact. Committed production runtime
  remains off and retains its existing configuration.

## Behavior changed

- Versioned Preview games can submit bounded metadata field operations with a
  permanent ID and exact hydrated base.
- A stale same-field edit becomes a durable conflict, cannot silently replace
  the server value, does not retry, and blocks the legacy game overwrite path.
- The UI states: `This game changed on another device. Refresh before saving
  again.` It retains proposed changes locally but displays no private value,
  user identity, operation ID, conflict ID, or raw code.
- A safe refresh loads the accepted server game while retaining the local
  conflict evidence for later authorized resolution work.

## Behavior unchanged

- Local game mutation/persistence precedes cloud work and remains available
  offline.
- The default production runtime uses v1. Missing bases never opt into v2.
- R2-07A authorization, tombstone precedence, completed-game correction/no-
  reopen rules, forced RLS, append-only evidence, and disabled retention remain
  unchanged.
- Live Share/public payloads, clock/event routing, release/cache markers,
  production configuration, deployment, and data remain unchanged.

## Synthetic verification

- Client/operation matrix: `32/32 PASS`.
- Real headless-browser two-context matrix: `12/12 PASS`, including 390x844
  mobile viewport, same-base first success, stale overlap, safe refresh,
  non-overlap merge, denial, tombstone, flag off, and zero console errors.
- Disposable PostgreSQL migration/rollback matrix: `13/13 PASS`, zero named
  container residue.
- R2-07A matrix: `71/71 PASS`.
- Durable tombstone concurrency: `8/8 PASS`.
- R2-06/R2-06A migration and rollback: `13/13 PASS`.
- Durable operation preservation: `29/29 PASS`.
- R2-03/R2-05 sync characterization: `32/32 PASS`.
- Complete regression: `58/59` on the consolidated run. The only failure was
  a transient Playwright `page.reload` navigation abort in the pre-existing
  R2-06P hydration browser suite; that exact suite passed immediately on a
  focused rerun. No reproducible product failure exists.
- Secret/host scan and `git diff --check`: `PASS`.

## Preview and production boundary

Draft PR: `https://github.com/degrasse-mastermind/LaxHornet/pull/65`

Vercel Preview:
`https://lax-hornet-git-feature-r2-07-21d994-davidltdanes-4133s-projects.vercel.app`

The managed Supabase integration created isolated project
`nirewjjnzoxtqroacldj`; database, services, APIs, configuration, migrations,
and seeding passed. The Vercel deployment target is `preview`, uses the
separate integration-provided Preview configuration, and passed. A tester
creates only synthetic adult/non-youth accounts and games, opens the same game
in two authenticated contexts, edits the opponent in A, then edits the same
field from B's stale base and uses `Refresh game`.

David completed that bounded managed-Preview demonstration and reported
`Works great.` This records manual owner/demo acceptance of the two-session
behavior only; it is not production authorization.

A later successful-write attempt exposed PostgreSQL `42702` in the original
public wrapper because its post-operation `games.id` predicate was
unqualified. Exact head `2f7b86dd31f2a8345596ad37bcdec319c8e98a18`
therefore received `Independent Level 3 implementation review: FAIL`. That
defective head was merged externally before remediation. Corrective PR #66 at
`82596df836a2a719fc8fa88bc80974962aabd155` then carried the additive migration,
passed exact-head review and CI, and merged as
`df9347ba9bfa9c188513378070bfea70f695ad17`. The additive migration
`20260809164435_r207b_qualify_preview_game_update.sql` replaces only that
wrapper with an explicitly aliased `game_row.id` predicate. Its safe rollback
disables the bridge rather than restoring the ambiguous implementation.
SHA-256 identities are
`40c502d3cd95e11717935d12d3655cb0822558cde556a51d7bc38ef4367c7a34`
for the migration and
`ed862144fff4ae3e8937168d255bbd51eeb4dd3f8d35d8a11301d63b3883943f`
for the rollback.

No local, manual, CLI, linked-main, Dashboard, persistent shared-environment,
or production migration was applied. No migration-history repair, production
activation, deployment, release, data access, or credential use occurred.

`AUTOMATIC ISOLATED SUPABASE PREVIEW MIGRATION — ACCEPTED CI VERIFICATION`

## Known limitations

- This phase connects the metadata edit demonstration; the approved builders
  exist for the remaining field groups, but broad score/status/roster/sharing
  UI routing is intentionally deferred within the R2-07 sequence.
- Conflict resolution remains a later phase. Refresh preserves the proposal
  and accepted server state but does not adjudicate or discard the conflict.
- Clock/event concurrency is R2-07C and is unchanged.
- The additive `42702` remediation passed exact-head GitHub Docker/regression
  and independent Level 3 review through PR #66.
