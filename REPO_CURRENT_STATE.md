# LaxHornet Repository Current State

Last reviewed: 2026-07-27  
Baseline branch: `main`  
Baseline commit: `2a0435817d7302b1041542d0ef0f54c9697e8bc0`
Current release marker: `v283`

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
- Supabase synchronization is optional and must not block core game-day tracking.
- Runtime includes local delete markers and event-operation capabilities.
- The review-only Tracked Playing Time foundation adds a companion local-first clock and participation-operation service. It is not loaded by the current UI and does not change existing game tracking.
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
- A separately contained, review-only Tracked Playing Time package with one forward migration, one rollback reference, and one pgTAP contract file. It is not listed as production-applied or pending for the v283 cutover.
- Required ordering, rollback references, approved file identities, and pending-production expectations.

Do not rewrite, reorder, squash, rename, or silently regenerate these migration files. Any new migration must be additive, timestamped, reviewed, tested locally, and reflected in release-control documentation.

The verified Windows local migration workflow is documented in `docs/LOCAL_SUPABASE_WORKFLOW.md`. It uses Docker Desktop, the Supabase CLI, explicit local-only commands, and a reduced stack where Storage-related services are excluded. It must not be replaced with linked or production-mutating commands.

## Deployment and release control

- Static deployment uses GitHub Pages from the `main` branch repository root.
- Custom domain: `laxhornet.mybranford.com`.
- Release coordination includes `version.json`, service-worker/cache markers, script query versions, and `release/laxhornet-release-manifest.json`.
- Current release marker is `v283`.
- There is no general-purpose Node.js or Python application server.
- Do not introduce a separate backend server when Supabase Auth, Postgres/RLS, RPCs, Realtime, or Edge Functions meet the requirement.

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
supabase test db --local supabase/tests/tracked_playing_time_foundation.sql
```

The current broad local regression entry point is:

```powershell
node tools/run_v283_local_regression.mjs
```

That runner covers JavaScript syntax, event-operation contracts, tracked-playing-time service and static foundation contracts, game-scope capabilities, update/release checks, release-manifest validation, containment and hygiene, minimum disclosure, secure disclosure, Product Alignment, Trust Spine contracts, SQL acceptance/rollback tests, deletion permissions, cleanup, secret scanning, and `git diff --check`.

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

## Current engineering constraints

- Preserve the vanilla static PWA unless an approved architecture decision changes it.
- Preserve local-first and offline-first behavior.
- Keep public sharing on explicit minimum-necessary allowlists.
- Keep private notes, private tags, account data, correction metadata, and generated recommendations out of public-safe outputs unless explicitly authorized by product requirements.
- Preserve youth-data privacy and use synthetic data in tests.
- Keep MethodNorth and LaxHornet connected but not combined.
- Do not alter production defaults, activate staged backend capabilities, deploy migrations, or release from an ordinary feature ticket.
- Tracked Playing Time remains a private data foundation only: its database objects are reachable through authenticated, scope-checked RPCs; the companion service is not yet wired into `app.html`; and public Live Share, recap, and scoped CSV contracts exclude clock and participation history.

## Known areas requiring continued care

- Production cutover and activation of staged Trust Spine/minimum-disclosure capabilities.
- Migration provenance and release-manifest integrity.
- Live Share and export disclosure boundaries.
- Authorization and player/team scope enforcement.
- Offline operation reconciliation and conflict handling.
- UI integration, in-game controls, and game-review presentation for Tracked Playing Time remain future work after this foundation is reviewed.
- Coordinated version and service-worker release hygiene.
- Maintenance of GitHub Action majors and portability of the CI-selected regression checks.

## Update protocol

After an approved feature is completed:

1. Update the affected sections above with durable facts only.
2. Update `TICKETS.md` with status, commit/PR reference, tests, and remaining work.
3. Do not record speculative ideas here; keep them in an open ticket or design document.
4. Confirm the document still describes the actual code on the branch being reviewed.
