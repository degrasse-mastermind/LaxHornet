# Final Declaration

Status: LH-00 read-only gate package.

## Already existed in the repo

- Static PWA architecture using `index.html`, `app.html`, `app.js`, `styles.css`, `landing.css`, `service-worker.js`, and `manifest.json`.
- Browser Supabase client configuration in `app.js`.
- Supabase tables for games, events, teams, team members, roster players, user profiles, team access requests, player claims, and notification queue.
- RLS policies and public RPCs for current app behavior.
- Local storage for players, games, teams, player claims, access requests, deleted game/event IDs, and next-game focus.
- Local-first tracking and sync replay.
- Live Share using ordinary `games`/`events` tables.
- CSV and JSON export/import.
- Review and season analytics generated in the client.

## Previously added by Codex

- `docs/methodnorth/foundation-upgrade/*`
- `docs/methodnorth/foundation-upgrade/migrations/001_project_one_foundation_proposal.sql`

Those files were review-only and not applied to production. The LH-00 gate now narrows and quarantines parts of that earlier proposal.

## Proposed now

This package proposes, but does not apply:

- A current architecture inventory.
- Authorization call graph.
- Event mutation call graph.
- Offline sync current-state map.
- Live Share and export data-flow map.
- Overbuild/safety audit.
- Narrowed Trust Spine Release 1 staging schema proposal.
- RLS matrix.
- Sync state machine.
- Migration runbook.
- Rollback runbook.
- Deferred scope.
- Precise test plan.

## Removed

Nothing was removed from production code, production SQL, runtime config, or existing docs.

## Quarantined for Release 1

- `club_admin`.
- ordinary broad `platform_admin`.
- athlete roles and athlete-visible access.
- generalized polymorphic disclosure engine.
- Project One UI.
- persisted AI interpretations or recommendations.
- broad support/operator access.
- feature flags as security controls.
- full foundation one-release merge.

## Unknown

- Whether the live Supabase production schema exactly matches `supabase-schema.sql`.
- Whether any Supabase dashboard-only functions, policies, triggers, Edge Functions, or email sender code exist outside the repo.
- Whether GitHub Pages/custom-domain caches are serving the latest local version at any given moment.
- Whether all current RLS policies pass real authenticated cross-role tests.
- Whether realtime payloads are currently exposing fields beyond the rendered UI on all clients.

## Gate result

The current app can continue as the current product, but it does not yet meet the Trust Spine Release 1 standard for immutable evidence, durable tombstones, explicit operation receipts, active grant authority, public-safe Live Share projections, or correction conflict handling.

Production migration and Project One UI remain blocked until the LH-00 review accepts a narrowed staging implementation plan and test suite.

## Release 1 hardening addendum

The additive Trust Spine staging implementation now includes private-helper
isolation, permanent tombstones, accepted-only revisions, explicit annotation
separation, authorized legacy scope registration, effective-row revision
sequencing, nine audited public RPC wrappers, 33 SQL acceptance groups, and a
rollback-preservation test.

This does not change the production gate result. A disposable Supabase staging
environment was unavailable, so real Auth/PostgREST/Realtime/concurrency and
remote rollback proof remain required before browser integration.
