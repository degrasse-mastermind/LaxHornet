# Current Architecture Inventory

Status: read-only LH-00 discovery package. No production migration, RLS, app runtime, service worker, or version changes were made.

## Repository identity

- Repository path: `C:/Users/user/Documents/LaxHornet`
- Current branch during inspection: `feature/project-one-foundation`
- Current git state before this package: clean except untracked `desktop.ini`
- Existing proposal SQL found: `docs/methodnorth/foundation-upgrade/migrations/001_project_one_foundation_proposal.sql`

## Application shape

LaxHornet is a static, mobile-first PWA built from plain HTML, CSS, and JavaScript.

Primary runtime files:

- `index.html`: public homepage and marketing/navigation surface.
- `landing.css`: public homepage styling.
- `app.html`: authenticated app shell and JavaScript fallback surface.
- `app.js`: main application runtime, auth, local state, team/player flows, tracker, review, season, sync, Live Share, export/import, and update handling.
- `styles.css`: app styling.
- `service-worker.js`: offline cache and update lifecycle.
- `manifest.json`: install metadata and icon.
- `assets/supabase.min.js`: browser Supabase client bundle.

There is no backend application server in the repo. Browser code calls Supabase directly with the publishable key in `app.js:22-25`.

## Public homepage and deployment

`index.html` is the public homepage. It links to the app, marketing pages, terms/privacy pages, and static assets. The PWA is designed for static hosting on GitHub Pages or the custom domain already in use.

Service worker caching is static-file based:

- Cache name: `laxhornet-v275` in `service-worker.js:1`.
- App shell and key pages are precached in `service-worker.js:2-29`.
- Navigation requests fall back to `app.html` or `index.html` in `service-worker.js:50-63`.
- `version.json` is fetched with `no-store` handling in `service-worker.js:37-44` and `app.js:12212-12220`.

## Supabase and auth

Supabase is initialized in the browser:

- Config: `app.js:22-25`.
- Client creation: `app.js:554-561`.
- Auth session load and auth state listener: `app.js:12353-12373`.

Auth and app roles are backed by `user_profiles`, `team_members`, `team_access_requests`, and `player_claims` in `supabase-schema.sql`.

Current role vocabulary in production schema/runtime:

- App/profile role values include `tracker` and `admin`.
- Team membership role values include `admin`, `tracker`, and legacy/member-like values.
- `laxhornet_is_platform_reviewer()` hard-codes `degrassed@gmail.com` as reviewer/admin in `supabase-schema.sql:264-282`.

LH-00 conflict: the Trust Spine Release 1 target roles are `parent`, `coach`, and `team_admin`. Current runtime does not yet express `coach`, and current `admin`/reviewer behavior is not the same as a scoped `team_admin`.

## Local storage and offline state

Local storage keys are defined in `app.js:1-20`. They include:

- Player/team/account data: `players`, `activePlayerId`, `teams`, `rosterPlayers`, `activeTeamId`, `teamAccessRequests`, `playerClaims`, `removedPlayerAccess`.
- Game data: `games`, `activeGame`, `reviewGameId`.
- Local delete markers: `deletedGames`, `deletedEvents`.
- Workflow/UI state: `adminViewMode`, `onboardingIntent`, `nextGameFocus`, `familyRecapFocus`.

Storage is scoped by authenticated user when available:

- `scopedStorageKey()` adds `.user.${activeStorageUserId}` in `app.js:662-664`.
- `readStoredAccountState()` loads per-account stores in `app.js:666-690`.

Offline model:

- Local game/event state is written immediately via `persistAll()` and related helpers.
- When offline, sync functions set plain-English statuses such as `Saved on this phone` in `app.js:5231-5238`.
- There is no durable queued-operation table, no operation ID model, and no server-returned conflict receipt model in the current app.

## Current database inventory

Core tables from `supabase-schema.sql`:

- `games` at `supabase-schema.sql:4-21`
  - Includes `id`, `player_id`, `user_id`, `share_code`, `is_shared`, `opponent`, `game_date`, `period_format`, `player_snapshot`, `current_quarter`, `status`, timestamps.
  - Later adds `team_id` and `roster_player_id` at `supabase-schema.sql:129-130`.
- `events` at `supabase-schema.sql:23-39`
  - Includes `id`, `game_id`, `user_id`, `timestamp`, `quarter`, `stat_type`, `stat_label`, `category`, `point_value`, `tags`, `note`, `field_zone`, `corrected_at`, `tags_updated_at`, `created_at`.
  - Later adds `team_id` and `roster_player_id` at `supabase-schema.sql:132-133`.
- `teams` at `supabase-schema.sql:41-48`.
- `team_members` at `supabase-schema.sql:50-57`.
- `roster_players` at `supabase-schema.sql:59-67`.
- `user_profiles` at `supabase-schema.sql:69-84`.
- `team_access_requests` at `supabase-schema.sql:86-101`.
- `player_claims` at `supabase-schema.sql:103-111`.
- `notification_queue` at `supabase-schema.sql:113-123`.

No separate immutable event revision table, durable event tombstone table, access-grant table, invitation table, or security audit table exists in the active schema.

## Current grants and RLS inventory

Broad table grants exist:

- `games` and `events` are selectable by `anon` and `authenticated` in `supabase-schema.sql:224-225`.
- `games` and `events` allow `insert`, `update`, and `delete` to `authenticated` in `supabase-schema.sql:226-227`.
- Team, roster, access request, claim, and notification tables are granted to `authenticated` in `supabase-schema.sql:228-238`.

RLS is enabled for core tables in `supabase-schema.sql:240-248`.

Key RLS policies:

- Games read: own, shared, or claim-scoped team games in `supabase-schema.sql:2101-2108`.
- Games insert/update/delete: owner or player-claim-scoped team access in `supabase-schema.sql:2110-2136`.
- Events read: owner, player-claim-scoped, or shared game in `supabase-schema.sql:2138-2153`.
- Events insert/update/delete: owner or player-claim-scoped access in `supabase-schema.sql:2155-2239`.
- Roster players read: platform reviewer, team admin, or player claim in `supabase-schema.sql:2070-2083`.

LH-00 conflict: ordinary authenticated clients can directly attempt to update/delete evidence-bearing `games` and `events`. RLS narrows rows, but the current model still permits direct event-row mutation instead of forcing all accepted corrections through one trusted append-only correction transaction.

## RPC inventory

Public `security definer` functions are extensively used and then granted to `authenticated` in `supabase-schema.sql:1880-1912`.

Important current RPCs:

- Profile/admin: `laxhornet_my_profile`, `laxhornet_request_user_role`, `laxhornet_pending_admin_requests`, `laxhornet_review_admin_request`.
- Team/access: `laxhornet_create_team`, `laxhornet_delete_team`, `laxhornet_my_teams`, `laxhornet_team_access_codes`.
- Roster: `laxhornet_create_roster_player`, `laxhornet_update_roster_player`, `laxhornet_remove_roster_player`, `laxhornet_visible_roster_players`.
- Requests/claims: `laxhornet_request_team_player_access`, `laxhornet_pending_team_access_requests`, `laxhornet_review_team_access_request`, `laxhornet_claim_roster_player`, `laxhornet_delete_player_claim`, `laxhornet_my_player_claims`, `laxhornet_my_roster_players`.
- Deletes: `laxhornet_delete_game`, `laxhornet_delete_event`.

Supabase best-practice conflict to review: `SECURITY DEFINER` functions in exposed `public` schema require extra caution. The repo revokes default execute privileges and explicitly grants selected functions, but the Trust Spine should move privileged internal helpers into a non-exposed/private schema where possible and keep public RPCs narrow.

## Current sync architecture

Current sync functions:

- `loadCloudGames()` loads cloud rows via `.from("games").select("*, events(*)")` in `app.js:4402-4435`.
- `syncLocalGamesToCloud()` loops local games and calls `syncGameToSupabase()` in `app.js:4459-4480`.
- `syncGameToSupabase()` upserts `games` and optional `events` rows in `app.js:5224-5292`.
- `syncLoggedEvent()` upserts a just-created event after ensuring its game exists in `app.js:5295-5334`.
- `flushDeletedCloudRecords()` attempts pending delete markers in `app.js:4483-4500`.
- `deleteSupabaseGame()` and `deleteSupabaseEvent()` call delete RPCs first, then direct table deletes as a fallback in `app.js:5336-5400`.

LH-00 conflict: current sync is local-state replay and direct upsert/delete, not an operation-log protocol with permanent operation IDs, server outcomes, base-version checks, tombstone rejection, and explicit conflict states.

## Current Live Share inventory

Live Share currently:

- Sets `game.isShared = true` and syncs the game in `app.js:5480-5509`.
- Loads a shared game by share code with `.from("games").select("*, events(*)")` in `app.js:5438-5467`.
- Subscribes to ordinary `games` and `events` table realtime changes in `app.js:5425-5435`.
- Renders shared timeline with `renderEventRow(event, { publicOnlyTags: true })` in `app.js:10523-10528`.
- Realtime publication includes `games`, `events`, and `roster_players` in `supabase-schema.sql:2241-2269`.

LH-00 conflict: Live Share reads ordinary game/event rows with wildcard selection. If private foundation fields are later added to `games` or `events`, they could become public unless Live Share moves to a separate public-safe RPC/view with an explicit allowlist.

## Current export/import inventory

Exports:

- CSV export starts at `app.js:3684`.
- JSON export starts at `app.js:3689`.
- JSON payload includes app metadata, impact model, possession model, current player, all local players, teams, roster players, active IDs, and normalized games in `app.js:3689-3713`.

Import:

- JSON import reads and merges players/games in `app.js:3722-3745` and subsequent import logic.

LH-00 risk: current exports are user-initiated but broad. Future private fields must use explicit export allowlists rather than rely on ad hoc filtering.

## Existing foundation runtime code

No new Trust Spine runtime system is active. The prior `docs/methodnorth/foundation-upgrade` package contains a review-only proposal and docs. However, the active app already contains features relevant to the gate:

- Local delete markers (`deletedGames`, `deletedEvents`) but not durable server tombstones.
- Direct Supabase delete RPCs for games/events.
- Direct game/event upserts.
- Player-claim-scoped parent visibility.
- Live Share using ordinary tables.
- Review intelligence language in `buildPostGameIntelligence()` but not persisted as authoritative AI interpretation.
