# R2-06 durable game tombstones release preflight

Date: 2026-07-30

Status: `BLOCKED — APPLICATION ROLLBACK COMPLETE; DO NOT APPLY THE CURRENT MIGRATION`

Risk: Level 3 — production migration, authorization, synchronization,
deletion, release, and rollback behavior

## Exact source

- Feature PR: #47
- Reviewed feature head:
  `c1ab1bd2c6877abfd6d4683204dc19a753b1ec58`
- Squash merge and proposed runtime source:
  `18f5157de159fa7a27b3cefb4c90f5148c3b230d`
- `origin/main` at preflight:
  `18f5157de159fa7a27b3cefb4c90f5148c3b230d`
- Release branch:
  `release/r2-06-durable-game-tombstones`

The R2-06 squash merge was the exact tip of `origin/main`; no later runtime or
migration commit was included.

## Reviewed database files

| File | SHA-256 | Git blob |
| --- | --- | --- |
| `supabase/migrations/20260730134439_durable_game_tombstones.sql` | `138e8edfdaa4b48747ceb63a66a0eae76f91c832b19dffa52914bdea45188900` | `44114477b0f3885310d6bfb401d816b7d74a6196` |
| `supabase/rollback/20260730134439_durable_game_tombstones_rollback.sql` | `405d0b10370cbcc90aa474f469d9841a5bc56a96453094561cb8a2386dd1545b` | `720dacae5b20cad79366efd9d2c0aba240225b6c` |
| `supabase/tests/durable_game_tombstones.sql` | `23f4abe853acf82817690b296c5dcf29947f500ded5721e88f5e04f83dea778f` | `5f0308679af04f8aabd22bd54447546f6f204483` |

## Required targets and order

- Intended production database:
  `ulbmjcvnyznvmjgpstno`
- Production runtime:
  `https://laxhornet.mybranford.com/`
- Required sequence:
  recovery readiness, apply only the reviewed migration, verify
  schema/RLS/grants/RPCs/trigger, deploy the compatible exact runtime,
  synthetic production smoke, stale-device and mixed-client verification,
  cleanup, and closeout.

No task action advanced this sequence because the preflight failed before a
production write.

## Blocking findings

### P1 — concurrent write can recreate a tombstoned game

`public.laxhornet_delete_game_durable(jsonb)` acquires
`pg_advisory_xact_lock(hashtextextended(game_id, 0))`, but
`public.laxhornet_sync_game(jsonb)` does not acquire the same lock.

A concurrent guarded write can:

1. see no committed tombstone in the RPC check;
2. see no committed tombstone in the `BEFORE INSERT OR UPDATE` trigger;
3. block behind the delete's row lock;
4. continue after the delete commits; and
5. insert the game without rechecking the newly committed tombstone.

That violates the permanent game-ID guard and the core stale-device acceptance
criterion.

### P1 — newer-game delete conflict can still delete its events

`confirmDeleteGame` persists one legacy event-delete marker per game event
before the durable game delete result is known. `flushDeletedCloudRecords`
processes those event markers before processing the game delete. When the
durable RPC returns `newer_game_revision`, the game delete correctly becomes a
conflict, but the event markers remain eligible and can delete events from the
newer retained server game during the next hydration.

That violates the newer-revision ordering and no-data-loss acceptance
criteria.

These findings were posted by the late automated exact-head review after the
independent PASS and after the squash merge. They remain unresolved on the
deployed source.

## Release-control and access blockers

- The release manifest has no R2-06 review package or three-file checksum set.
- Its reviewed and required migration sequences stop at
  `20260730004700_team_members_rls_recursion.sql`.
- It declares no pending production migration.
- The existing production preflight remains bound to the earlier v284 release
  identities and requires clean `main`; it failed on the dedicated R2-06
  release branch.
- The specifically required `supabase_production_readonly-2` connection was
  unavailable. No generic connector was substituted. Production migration,
  schema, RLS, grant, trigger, RPC, backup, and tombstone-row state are
  therefore unverified.
- David's explicit authorization for production writes was not present.

## Existing production runtime state

The merge itself auto-triggered the allowlisted Pages workflow before this
preflight:

- Deployment run:
  `30552229360`
- Deployed source:
  `18f5157de159fa7a27b3cefb4c90f5148c3b230d`
- Result:
  `success`

Public HTTP byte verification matched the exact Git blobs for:

| File | Git blob | Exact production match |
| --- | --- | --- |
| `app.js` | `b4884631a6b28fc6f2570a32634292d6c8d7635a` | yes |
| `event-operation-service.js` | `257773703c2d842cd968d32c432352ac8b4dc4b9` | yes |
| `app.html` | `3bce8857f1a8992634d64127f0fe8707c2157586` | yes |
| `service-worker.js` | `2e06b32b9f9ffa39d4cd78176a0f4143e4fd0f1f` | yes |

The previous successful pre-R2-06 allowlisted deployment is:

- Source:
  `44f0510d3bde18f459e78f570efd27b72dc2a989`
- Run:
  `30547712272`

An application-only rollback was later explicitly authorized and completed as
recorded below.

## Authorized application-only rollback

Authorization was explicit and limited to rolling back the production
application runtime at `laxhornet.mybranford.com` to exact source
`44f0510d3bde18f459e78f570efd27b72dc2a989`. It did not authorize the R2-06
migration, database rollback, Supabase changes, production-data changes,
synthetic records, unrelated release settings, or remediation of either P1.

### Pre-rollback verification

- `44f0510d3bde18f459e78f570efd27b72dc2a989` is the merged
  `R2-05: Separate authorization from retryable sync failures (#46)` commit.
- R2-06 source `18f5157de159fa7a27b3cefb4c90f5148c3b230d`
  has `44f0510d3bde18f459e78f570efd27b72dc2a989` as its sole parent.
- Runtime/source at the rollback SHA contains no reference to
  `public.legacy_game_tombstones`, `public.laxhornet_sync_game(jsonb)`, or
  `public.laxhornet_delete_game_durable(jsonb)`, and the R2-06 migration is
  absent from that source tree.
- A clean detached worktree at the exact SHA passed
  `tools/validate_release_manifest.mjs`,
  `tools/test_pages_deployment.mjs` (`21/21`),
  `tools/build_pages_artifact.mjs`, and
  `tools/validate_pages_artifact.mjs`.
- Pre-rollback production was source
  `18f5157de159fa7a27b3cefb4c90f5148c3b230d`, Pages run
  `30552229360`, result `success`.

### Deployment record

- Exact rollback source:
  `44f0510d3bde18f459e78f570efd27b72dc2a989`
- Workflow/deployment ID:
  `30554377617`
- Workflow URL:
  `https://github.com/degrasse-mastermind/LaxHornet/actions/runs/30554377617`
- Result:
  `success`
- Created:
  `2026-07-30T14:58:35Z`
- Completed:
  `2026-07-30T14:59:18Z`
- Deploy job completed:
  `2026-07-30T14:59:06Z`
- Workflow manifest:
  47 files, 6,221,926 bytes, allowlist version `2026-07-29`, release `v284`,
  custom domain `laxhornet.mybranford.com`

The public artifact contained:

- `CNAME`
- `LaxHornet-launch-kit.zip`
- `access-and-trust.html`
- `app.html`
- `app.js`
- `assets/LHbanner.png`
- `assets/LHicon.png`
- `assets/club-family-recap.png`
- `assets/club-review-insight.png`
- `assets/club-review-start.png`
- `assets/honeycombblack.png`
- `assets/supabase.min.js`
- `coach-alignment.html`
- `event-operation-service.js`
- `index.html`
- `landing.css`
- `launch-kit/LaxHornet-admin-launch-checklist.pdf`
- `launch-kit/LaxHornet-overview.pdf`
- `launch-kit/LaxHornet-parent-handout.pdf`
- `launch-kit/LaxHornet-promo-demo-thumbnail.png`
- `launch-kit/LaxHornet-promo-demo.mp4`
- `launch-kit/admin-launch-checklist.html`
- `launch-kit/invite-message.txt`
- `launch-kit/launch-kit-readme.md`
- `launch-kit/laxhornet-overview.html`
- `launch-kit/laxhornet-qr.png`
- `launch-kit/parent-email.eml`
- `launch-kit/parent-email.html`
- `launch-kit/parent-handout.html`
- `launch-kit/short-text-message.txt`
- `launch-kit/social-captions.txt`
- `launch-kit/team-chat-posts.txt`
- `manifest.json`
- `next-focus-recommendation.js`
- `parent-experience.html`
- `player-development.html`
- `privacy.html`
- `program-value.html`
- `public-event-semantics.js`
- `rollout-guide.html`
- `runtime-config.js`
- `service-worker.js`
- `styles.css`
- `terms.html`
- `tracked-playing-time-service.js`
- `tracking-framework.html`
- `version.json`

### Post-rollback verification

- All 46 publicly served artifact files returned HTTP 200 and matched the
  authoritative workflow-manifest SHA-256 values exactly. `CNAME` is the
  non-served custom-domain configuration entry.
- `TICKETS.md`, the R2-06 migration path, this evidence path, and
  `.git/config` each returned HTTP 404.
- The landing page loaded with the expected title and navigation and no
  console warnings or errors.
- The app loaded with the expected title and no console warnings or errors.
- The existing authenticated session restored. Past Games opened through
  normal app navigation and exposed 45 saved-game rows. Only row count was
  observed; no game, player, event, family, or team contents were read.
- No form was submitted and no start, edit, sync, share, export, reset,
  deletion, or other mutation action was used.
- Exact-source inspection plus complete live artifact byte identity confirms
  the deployed runtime contains no calls to the R2-06 tombstone table or RPCs.
- `tools/test_public_event_semantic_boundary.mjs` passed.
- `tools/test_v284_team_authorization_policy.mjs` passed.
- `tools/test_minimum_disclosure.mjs` was not recorded as a full pass:
  39/40 checks passed; its only failure was the release-hygiene assertion that
  expects a service-worker/version release delta not present in R2-05.

The authentication form was not submitted or forced by signing out because
that would alter the existing session. Its rollback-source markup remains
present, and the live runtime is byte-identical to that exact source.

### Production and database non-mutation confirmation

- No Supabase MCP, SQL, CLI migration, function deployment, configuration
  action, or database rollback command was used.
- No Supabase schema, function, trigger, RLS, grant, Auth, configuration, or
  data change occurred.
- No production synthetic or real record was created, modified, or deleted.
- The R2-06 migration was not applied by this rollback task.
- The R2-06 database rollback was not executed.
- R2-06 was not marked production-activated.
- Both P1 findings remain unresolved and require the remediation and fresh
  exact-SHA review sequence below.

## Safe local verification

- `node tools/test_game_tombstones.mjs`: `29/29` passed.
- `node tools/test_game_tombstone_migration.mjs`: `11/11` passed with pinned
  disposable `@electric-sql/pglite@0.5.4`.
- `node tools/test_release_containment_phase_aware.mjs`: `32/32` passed with
  the same disposable dependency.
- `node tools/validate_release_manifest.mjs --require-combined
  --combined-ref=HEAD`: passed the existing v284 contract, which does not
  register R2-06.
- Canonical production preflight:
  failed because the dedicated branch is not `main` and the disposable PGlite
  and Playwright preparation gate was not active for that command.
- Docker client/server, Linux engine, Compose, Supabase CLI, Node, Python, and
  browser executable checks passed in the canonical preflight.

The disposable dependency junction and cache were removed. The release
worktree was clean before these documentation-only records.

The passing suites do not exercise the two blocking adversarial paths. The
complete canonical-plus-additive regression was not rerun after the fail-fast
P1 findings because it cannot establish release safety without those missing
contracts.

## Original browser boundary

A read-only startup attempt was excluded from smoke evidence when the selected
browser was found to contain an existing authenticated production context. No
buttons, forms, game actions, deletion actions, or other test interactions
were performed, no private details were retained in this evidence, and the tab
was closed. Public HTTP byte verification was used for the runtime-source
check instead.

## Production and external mutations before rollback authorization

None before the separately authorized application-only rollback documented
above.

Before the later rollback authorization, this task had not:

- apply or repair a migration;
- change Supabase data, schema, RLS, grants, functions, triggers, Auth, or
  configuration;
- deploy or roll back Pages;
- create or delete production synthetic records;
- change GitHub Pages settings;
- push the release branch; or
- create a pull request.

External activity before authorization was limited to fetching Git/GitHub
state, PR reviews and checks, workflow/deployment metadata, public production
assets, current Supabase documentation, and the excluded startup attempt
described above.

## Required next actions

1. Do not apply the current R2-06 migration.
2. Preserve the completed application-only rollback at
   `44f0510d3bde18f459e78f570efd27b72dc2a989`.
3. Add the shared per-game serialization lock to guarded writes and a real
   concurrent write/delete regression.
4. Make a durable game-delete conflict preserve the newer game's events and
   add an end-to-end regression.
5. Register the corrected R2-06 package and exact migration sequence in the
   release manifest/tooling.
6. Require green focused/full suites, CI, and a fresh independent Level 3
   exact-SHA review.
7. Restore `supabase_production_readonly-2`, verify production migration and
   catalog state plus recovery readiness, and only then resume a separately
   authorized migration-first rollout.

## R2-06A remediation follow-up

The two P1 findings above are remediated in the repository candidate on:

- Branch:
  `feature/r2-06a-tombstone-concurrency-recovery`
- Draft PR:
  [#48](https://github.com/degrasse-mastermind/LaxHornet/pull/48)
- Locally verified implementation head:
  `4ba897370cc5b60c3cba0903dc2283e336778775`

The candidate gives guarded game writes, durable deletes, and the retained
defense-in-depth trigger one transaction-scoped per-game advisory-lock
derivation. It also persists private reversible game/event recovery evidence
before hiding a pending delete, avoids whole-game event-delete markers, restores
classified rejection/conflict state, and finalizes accepted cleanup only after
the durable tombstone receipt is stored.

Local remediation verification passed:

- `33/33` tombstone and recovery contracts;
- `13/13` isolated migration and reverse-order rollback checks;
- `8/8` real PostgreSQL concurrency checks;
- `32/32` sync-characterization checks;
- `33/33` release-containment checks;
- `20/20` release-preflight checks; and
- `42/42` complete canonical-plus-additive regression groups.

PR #48 CI passed on candidate head
`69182e48578af59ba6df1c0623cb5646f9e7f3df`: portable regression run
`30558552058`, Docker run `30558553453`, Supabase Preview, and Vercel Preview
all completed successfully. The portable and Docker workflows each included
their release-containment checks.

This follow-up does not mark the blocked release ready. PR #48 still requires
a fresh independent Level 3 review bound to its exact final SHA. Production
application runtime remains on rollback source
`44f0510d3bde18f459e78f570efd27b72dc2a989`. R2-06 and R2-06A remain unapplied
and production activation still requires the named read-only verification,
recovery readiness, and separate explicit migration-first authorization.

No Supabase connection, migration application, deployment, release activation,
production-data change, or other production mutation was used for this
repository remediation.
