# LaxHornet Repository Current State

Last reviewed: 2026-07-30
Baseline branch: `main`
Baseline commit: `3e952ea7226e12b38d65dd656b528a3240ee5d9a`
Current repository release marker: `v284`
Current production marker: `v284` with remediated public Live Share and `team_members` RLS active

This file is the concise orientation document for ChatGPT, Codex, and human reviewers. Update it after an approved feature changes architecture, behavior, data contracts, deployment, or verification requirements. Do not use it as a substitute for inspecting the code.

## Product and repository boundary

- LaxHornet is a distinct MethodNorth product and separate deployed codebase.
- This repository owns the lacrosse-specific application, data model, UX, tests, deployment configuration, and product operations.
- MethodNorth owns the broader philosophy, doctrine, standards, design governance, research provenance, and portfolio system.

## Application shape

- Mobile-first offline PWA built with plain HTML, CSS, and JavaScript.
- No framework build step and no required package installation for the browser app.
- Public landing page: `index.html`.
- Application shell: `app.html`.
- Main runtime: `app.js`, supported by focused JavaScript modules.
- Styling: `styles.css` and landing-page styles.
- Offline/install layer: `service-worker.js`, `manifest.json`, and version/update controls.
- Supabase browser client bundle: `assets/supabase.min.js`.

## Primary behavior

- Tracks youth lacrosse game events through large mobile controls.
- Supports player and team configuration, active games, saved games, game review, season review, exports/imports, cloud synchronization, and Live Share.
- Stores player settings, active games, saved games, and workflow state locally first.
- Provides bounded LaxHornet-created summaries such as Game Impact and possession analytics with evidence limitations.
- Uses purpose-specific disclosure paths for public Live Share, user-previewed recaps, selected CSV exports, and sensitive private backups.

## Local-first storage and synchronization

- `localStorage` remains the immediate source for offline game tracking and user-facing continuity.
- Local storage domains use schema-version `1` safety sidecars for metadata,
  staging, one validated backup, and one bounded quarantine value while
  preserving existing primary keys and payload shapes. Future-schema domains
  are preserved and write-blocked rather than downgraded.
- Supabase synchronization is optional and must not block core game-day tracking.
- Runtime includes local delete markers and event-operation capabilities.
- R2-04 adds the account-scoped `laxhornet.syncOperations.v1` local domain for
  legacy game writes and tracked-clock writes. Operations are persisted before
  cloud work with permanent IDs, game/account/device scope, payload revision,
  retry timing, explicit `pending`/`syncing`/`accepted`/`retryable`/
  `rejected`/`conflicted` lifecycle state, bounded acknowledgments, and storage
  safety sidecars. Startup, sign-in, reconnect, and manual cloud sync recover
  current-account work; stale `syncing` records become replayable.
- Outstanding legacy game writes coalesce per game while retaining their
  operation ID and incrementing a payload revision. Clock transitions remain
  distinct by their exact command payload and preserve stale-revision
  conflicts. Accepted payloads are compacted only after an acknowledgment is
  persisted; rejected and conflicted work remains local and is not reported as
  synced.
- R2-05 gives those durable legacy-game and tracked-clock operations one
  deterministic failure taxonomy. Offline/fetch/timeout/connection,
  HTTP 408/429/5xx, and temporary service failures are `retryable`;
  authentication, authorization/RLS, validation, missing capability/schema,
  conflict, and unknown permanent failures become precise retained
  `rejected` or `conflicted` states. Unknown failures fail closed instead of
  defaulting to retry.
- Persisted R2-05 error evidence contains only bounded `category`, normalized
  `code` and canonical `message`, `httpStatus`, `classifiedAt`, `source`, and
  safe `sourceCode`. It does not persist original server messages, response
  bodies, request payloads, headers, tokens, stack traces, or private names.
  Rejected/conflicted records receive no ordinary retry time.
- Known offline state creates no request or attempt increment. Losing the
  active session rejects eligible work in the loaded account namespace before
  switching namespaces. Explicit sign-in or manual sync can recover only that
  same account's authentication-required rejections; signed-out state and a
  different account cannot process them.
- R2-03 makes ordinary same-ID `games`/`events` hydration lossless at the
  current storage boundary. Explicitly projected cloud-owned values can
  update, newer supported cloud values can update conflict-sensitive fields,
  and same-ID events merge by stable ID. Cloud-omitted and local-authoritative
  evidence remains intact, including scores, event score context, embedded
  tracked-time state, pending/recovery state, and unknown local metadata.
  `loadCloudGames` also rejects responses from superseded request generations
  or a prior account. This does not add durable game-field versions,
  tombstones, or conflict UI, so the R2 gate remains open.
- R2-04 does not add server operation IDs or server deduplication to legacy
  PostgREST game upserts. Their accepted receipt proves a successful request,
  not server-side exactly-once execution after an ambiguous lost response.
  Clock receipts retain the RPC code and returned server revision when the
  returned clock state matches the queued payload.
- Canonical team-event RPCs have durable client operation IDs, server event
  versions, replay protection, conflicts, and permanent tombstones. Those
  guarantees do not currently extend to legacy game fields, tracked clock
  writes, account-scope transitions, or cross-device legacy deletion.
- `main` contains the reviewed Tracked Playing Time foundation from merged PR #24 and the opt-in Phase 1 UI from merged PR #25.
- The v284 frontend is deployed through the allowlisted Pages workflow. The
  completed rollback/restore proof restored approved source SHA
  `3e952ea7226e12b38d65dd656b528a3240ee5d9a`; the 47 runtime files passed exact
  byte verification and internal repository paths remained non-public.
- Production migration `20260727000000_tracked_playing_time_operations` is present exactly once and its 88 normalized statements match the reviewed migration. The v284 team authorization gate passed with an active player-scoped parent grant plus its matching claim. Team-admin-only authority remains intentionally read/list-only for tracked time.
- A synthetic signed-in reproduction found that legacy participation-like aliases could enter the ordinary Event Pipeline and then appear in public Live Share. Aggregate inspection found no active tokens, no non-synthetic affected share, and no confirmed real-data exposure. Public RPC access was reversibly contained until the reviewed correction was installed.
- Merged PR #30 establishes a closed ordinary-event vocabulary at browser ingress and public database egress. Unknown or poisoned semantics default private; existing contaminated evidence is retained and either omitted or fully canonicalized at egress. Scope authorization is uniform before event lookup/classification, and pre-migration retries use their original immutable request hash.
- Production migration `20260728193942_v284_public_event_semantic_boundary` is present exactly once. Its safe public RPC is active with least-privilege grants, while anonymous access to private tracked-time tables and RPCs remains denied.
- Production migration `20260730004700_team_members_rls_recursion` is present
  exactly once. The final four-policy set has MD5
  `2814223218999d3d6364582d5b9e85e1`, RLS and FORCE RLS are enabled, anonymous
  table access is absent, authenticated/service access is DML-only, and the
  bounded role lookup is in the non-exposed `lh_rls_private` schema.
- Any synchronization change must preserve offline operation, reconnection behavior, deduplication, authorization boundaries, and existing saved data.

## Supabase backend

Project reference: `ulbmjcvnyznvmjgpstno`

Current backend capabilities include:

- Supabase Auth with email sign-in.
- PostgreSQL tables, RLS policies, grants, and RPCs.
- Team, roster, access-request, claim, game, event, profile, and notification data.
- Realtime and Live Share support.
- Edge Functions and transactional-email integration points.
- Timestamped migrations under `supabase/migrations/` and rollback material under `supabase/rollback/`.

The browser must never receive privileged Supabase credentials. The existing project is production-connected and must not be mutated through AI tooling without a separately reviewed and authorized database release procedure.

## Database migration state

The release manifest records:

- A historical production schema snapshot and provenance marker.
- Canonical forward migrations for the legacy baseline, Trust Spine Release 1, minimum-necessary disclosure, and disclosure/evidence fixes.
- An additive event-pipeline capability migration.
- A separately contained Tracked Playing Time package with one forward migration, one rollback reference, and one pgTAP contract file. Its reviewed Windows/CRLF identities remain recorded in the v284 manifest. Live production history now independently verifies the migration is present exactly once and matches all 88 reviewed statements after line-ending normalization.
- A production-applied v284 incident-remediation package with additive migration `20260728193942_v284_public_event_semantic_boundary`, fail-closed rollback, pgTAP coverage, and manifest checksums.
- A production-applied `team_members` recursion-remediation package with exact
  State C evidence, fail-closed production identity binding, rollback/reapply
  coverage, and final authorization/ACL contracts.
- Required ordering, rollback references, approved file identities, and
  production-applied expectations. No v284 migration remains pending.

Do not rewrite, reorder, squash, rename, or silently regenerate these migration files. Any new migration must be additive, timestamped, reviewed, tested locally, and reflected in release-control documentation.

The verified Windows local migration workflow is documented in `docs/LOCAL_SUPABASE_WORKFLOW.md`. It uses Docker Desktop, the Supabase CLI, explicit local-only commands, and a reduced stack where Storage-related services are excluded. It must not be replaced with linked or production-mutating commands.

## Deployment and release control

- Static production deployment uses the custom `Allowlisted GitHub Pages`
  workflow. It constructs `.pages-artifact` from the all-files-explicit
  `release/pages-deployment-allowlist.json`, validates hashes, references,
  secrets, symlinks, path traversal, custom-domain identity, and exact output
  membership, then uploads only that generated directory.
- The workflow fails closed unless Pages uses Actions and the custom domain,
  HTTPS enforcement, approved certificate, and v284 production marker remain
  intact before and after deployment.
- Repository-root and `/docs` branch publishing are prohibited. Internal
  tools, documentation, SQL, tests, release controls, and review evidence are
  not production assets.
- Custom domain: `laxhornet.mybranford.com`.
- Release coordination includes `version.json`, service-worker/cache markers, script query versions, and `release/laxhornet-release-manifest.json`.
- Current repository and production release marker is `v284`. Public Live Share
  is active through the corrected public-safe RPC. GitHub Pages deploys only
  the explicit 47-file allowlisted artifact.
- There is no general-purpose Node.js or Python application server.
- Do not introduce a separate backend server when Supabase Auth, Postgres/RLS, RPCs, Realtime, or Edge Functions meet the requirement.
- The v284 cache marker remains unchanged. The updated service worker purges
  previously cached non-allowlisted same-origin paths during activation and
  no longer caches unknown paths. A same-release replacement worker activates
  immediately when the existing v284 cache proves an older v284 worker is
  already installed.

## Local development

Serve the repository root:

```powershell
cd C:\Users\user\Documents\LaxHornet
python -m http.server 5173
```

Open:

```text
http://localhost:5173/app.html
```

## Verification

Focused checks include:

```powershell
node tools/test_event_operation_service.mjs
node tools/test_game_scope_capabilities.mjs
node tools/test_tracked_playing_time_service.mjs
node tools/test_tracked_playing_time_foundation.mjs
node tools/test_public_event_semantic_boundary.mjs
node tools/test_pages_deployment.mjs
node tools/build_pages_artifact.mjs
node tools/validate_pages_artifact.mjs
node tools/test_pages_artifact_browser.cjs
supabase test db --local supabase/tests/tracked_playing_time_foundation.sql
supabase test db --local supabase/tests/v284_public_event_semantic_boundary.sql
```

The current broad local regression entry point is:

```powershell
node tools/run_v283_local_regression.mjs
```

That runner covers JavaScript syntax, event-operation contracts, tracked-playing-time service and static foundation contracts, game-scope capabilities, update/release checks, release-manifest validation, containment and hygiene, minimum disclosure, secure disclosure, Product Alignment, Trust Spine contracts, SQL acceptance/rollback tests, deletion permissions, cleanup, secret scanning, and `git diff --check`.

Release preparation starts with the reusable preflight and uses one fail-fast local command:

```powershell
node tools/run_release_preflight.mjs --check --release v284
node tools/run_release_verification.mjs v284
```

`docs/RELEASE_VERIFICATION_WORKFLOW.md` records the exact modes, pinned disposable dependencies, cleanup behavior, resume rules, and production prohibition. The release command starts and stops only the documented local Supabase stack, preserves external failure logs, and does not contact production.

### GitHub Actions regression

`.github/workflows/laxhornet-regression.yml` provides the durable read-only CI layer.

- Runs automatically for pull requests and manually through `workflow_dispatch`.
- Uses `ubuntu-latest`, Node.js 22, and Python 3.12.
- Uses Node-24-compatible official actions: `actions/checkout@v5`, `actions/setup-node@v6`, and `actions/setup-python@v6`.
- Uses `contents: read` permissions and no repository or environment secrets.
- Resolves release-control refs from the committed release manifest and repository ancestry.
- Runs existing JavaScript, release, disclosure, Trust Spine, Python permission/cleanup, secret-scan, and diff-hygiene checks as individually named steps.
- Installs pinned `@electric-sql/pglite@0.5.4` temporarily only for embedded-database tests, without committing package metadata or enabling dependency caching.
- Does not deploy, publish, merge, start Docker, invoke the Supabase CLI, create Supabase branches, contact production services, or mutate remote state.

A green GitHub Actions result complements but does not replace browser, mobile-device, visual, game-day, or local Supabase migration testing.

## Project work control

- `docs/CODEX_WORKFLOW.md` defines a three-level, risk-based workflow whose
  governing principle is to use the lightest process appropriate to the actual
  risk.
- Level 1 routine work needs no formal ticket or independent review. Level 2
  uses a concise ticket or PR-ready task description. Level 3 requires an
  approved ticket and independent exact-PR-SHA review before merge.
- One primary Codex task may carry implementation from request through a draft
  pull request. Creating a feature branch, committing, pushing, and opening a
  draft pull request are authorized by default; merge, deployment, database,
  release, production, GitHub Pages setting, and write-capable external
  connector actions remain separately controlled.
- Testing follows the affected surface. CI provides broad regression by
  default for Level 1 and Level 2; Level 3 runs the complete local regression
  once after the final diff stabilizes.
- `TICKETS.md` is updated only for ticketed work.
  `REPO_CURRENT_STATE.md` is updated only for durable architecture, production
  behavior, release-control, or major verification-capability changes.
- `docs/templates/CODEX_TASK_KICKOFF.md` and
  `docs/templates/CODEX_TASK_CLOSEOUT.md` provide concise reusable records.
  Task titles, pins, and archives are optional navigation hygiene, not
  engineering completion gates.

## Current engineering constraints

- Preserve the vanilla static PWA unless an approved architecture decision changes it.
- Preserve local-first and offline-first behavior.
- Keep public sharing on explicit minimum-necessary allowlists.
- Keep private notes, private tags, account data, correction metadata, and generated recommendations out of public-safe outputs unless explicitly authorized by product requirements.
- Preserve youth-data privacy and use synthetic data in tests.
- Keep MethodNorth and LaxHornet connected but not combined.
- Do not alter production defaults, activate staged backend capabilities, deploy migrations, or release from an ordinary feature ticket.
- In the v284 release candidate, Tracked Playing Time is an explicit per-game opt-in with persisted clock controls, Player In/Out boundaries, deterministic shift derivation, safe recovery, governed corrections, and a private Game Review summary. New live performance events in opted-in games are accepted only while the tracked clock is running and the selected player is on field; the central event logger enforces the rule before prompts, score changes, event operations, synchronization, or confirmation changes. Non-tracked and historical-game behavior remains unchanged. Its database objects remain reachable only through authenticated, scope-checked RPCs; public Live Share, recap, and scoped CSV contracts exclude clock and participation history. If a browser reaches a backend without those RPCs, the client treats the tracked-time `PGRST202` response as a backend-availability limitation, keeps device-local tracking active, and does not mislabel otherwise valid shift evidence as needing review.

## Known areas requiring continued care

- Continued regression protection for the active Trust Spine and minimum-disclosure capabilities.
- Migration provenance and release-manifest integrity.
- Live Share and export disclosure boundaries.
- Authorization and player/team scope enforcement.
- Offline operation reconciliation and conflict handling.
- The v284 public-disclosure remediation passed its complete 33/33 regression and all 17 local release-verification gates, including 45/45 disclosure pgTAP checks on both database shapes and 73/73 signed-in browser checks. PR #30 was independently reviewed and merged. Production smoke at application SHA `effca6952e647b7424f96675f390fc80d5c42368` returned exactly two approved public events, excluded all private/unknown semantics, passed ordinary and tracked-time journeys, and proved zero active synthetic authority or mutable residue after cleanup.
- The allowlisted Pages smoke exposed a production `team_members` recursion
  defect. Exact production State C was later captured, reproduced, and
  classified `SEMANTICALLY EQUIVALENT TO STATE B`; it produced no `42P17` and
  did not broaden or narrow authorization. PR #35 added fail-closed State C
  recognition without changing the authorization model. Migration
  `20260730004700_team_members_rls_recursion` is now recorded exactly once in
  production and the final catalog contract passes. The post-remediation
  synthetic hosted smoke, explicit logout/login reconstruction, authority
  revocation, zero-residue cleanup, and allowlisted Pages rollback/restore
  proof all passed. `LH-DEV-005` is complete.
- Coordinated version and service-worker release hygiene.
- Maintenance of GitHub Action majors and portability of the CI-selected regression checks.

## Update protocol

Update this file only when durable architecture, production behavior, release
controls, or major verification capabilities change:

1. Update the affected sections above with durable facts only.
2. Update `TICKETS.md` only when the work has a ticket.
3. Do not record speculative ideas here; keep them in an open ticket or design
   document.
4. Confirm the document still describes the actual code on the branch being
   reviewed.
