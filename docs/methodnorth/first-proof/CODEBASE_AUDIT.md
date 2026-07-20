# Codebase Audit

Status: audit only
Repository: `C:/Users/user/Documents/LaxHornet`
Branch: `feature/project-one-evidence-review`

## Summary

LaxHornet is a static, mobile-first PWA using `app.html`, `app.js`, `styles.css`, `manifest.json`, and `service-worker.js`. There is no package-based build system in the repository. Runtime state is managed in a single JavaScript file and persisted locally with scoped `localStorage`; cloud features use Supabase Auth, table operations, and RPC functions defined in SQL files.

The app already has strong reusable systems for game capture, event storage, saved-game review, event editing, tags, player/team access, role-like admin/tracker behavior, and live sharing. The current model does not yet support a production-grade evidence ledger with non-destructive correction history, coach-authored factual context, or a distinct coach role. Those are the largest gaps for Project One.

## Framework And Build System

Classification: REUSE

- Static HTML/CSS/JavaScript.
- No `package.json` was found.
- `app.js` is the primary application runtime.
- `styles.css` contains the app design system and responsive behavior.
- `landing.css` supports the public homepage.
- Deployment is static hosting via GitHub Pages/custom domain.

Implementation implication: Project One Slice 1 can be implemented without adding a framework, but any automated browser testing may require an external tool already available in the local environment rather than a repo-native test script.

## Entry Files

Classification: REUSE

- `index.html`: public homepage / landing page.
- `landing.css`: public homepage styling.
- `app.html`: app shell, JavaScript fallback, Supabase script include, static app mount.
- `app.js`: application state, routing, auth, tracking, review, sync, admin, demo, and page rendering.
- `styles.css`: app styling, responsive layout, nav, cards, tracker, review, season, focus tools.
- `service-worker.js`: PWA cache.
- `version.json`: update/version check.

Do not touch during audit: runtime files were inspected only.

## Routing

Classification: EXTEND

Routing is internal state-driven rendering rather than URL routes. `render()` maps `state.screen` to render functions. `navigate(screen)` changes the current screen. Important screens include:

- `home`: `renderHome`
- `start`: `renderStartGame`
- `live`: `renderLiveTracker`
- `review`: `renderReview`
- `past`: `renderPastGames`
- `dashboard`: `renderDashboard`
- `team`: `renderTeamPage`
- `player`: `renderPlayerPage`
- `playersTeams`: `renderPlayersTeamsPage`
- `adminPortal`: `renderAdminPortal`
- `shared`: `renderSharedGame`

Project One can add a flagged review-entry state without changing browser routing semantics, but the fallback must leave the existing `review` flow unchanged when the flag is off.

## State Management

Classification: REUSE / EXTEND

State is held in a global `state` object initialized from `loadInitialStoredState()`. Durable local state is persisted through `persistAll()` and scoped storage keys.

Relevant `STORAGE_KEYS` include:

- `games`
- `activeGame`
- `reviewGameId`
- `player`
- `players`
- `teams`
- `rosterPlayers`
- `playerClaims`
- `adminViewMode`
- `deletedGames`
- `deletedEvents`
- `nextGameFocus`

Project One can initially persist review-deferred state locally, but production-grade review state should be designed carefully if it must sync across devices.

## Authentication

Classification: REUSE

Supabase Auth is used when available. Relevant functions include:

- `handleAuthSubmit`
- `submitSignupAccessRequest`
- `saveParentProfile`
- `loadUserProfile`
- `setAuthUser`
- `currentUserId`
- `signOut`

The app currently supports account creation, sign-in, profile setup, team access requests, and approval-driven player access. Authentication is sufficient to distinguish signed-in users from unauthenticated users, but not sufficient by itself to distinguish coach, parent, athlete, and administrator for Project One.

## User-Role Model

Classification: EXTEND

Current app roles:

- `tracker`
- `admin`

Related functions:

- `normalizeAppRole`
- `appRoleLabel`
- `isReviewerAccount`
- `isPlatformReviewer`
- `setAdminViewMode`
- `teamRole`
- `canEditTeam`
- `canTrackRosterPlayer`
- `canTrackPlayer`

Current admin behavior is closer to Team Admin Tools than a coach role. Parent Tracker access is mediated by team access approval and player claims. There is no athlete-facing account path and no distinct coach role.

Project One role-aware entry should map conservatively:

- Parent: existing Parent Tracker / tracker behavior.
- Coach: only if a safe existing admin/team-manager surrogate is accepted for development testing.
- Athlete: disabled placeholder only.
- Administrator: operational access, not automatically coach authority.

## Player And Team Ownership Model

Classification: REUSE / EXTEND

Tables and local structures support:

- `teams`
- `team_members`
- `roster_players`
- `team_access_requests`
- `player_claims`

Key RPC/functions in SQL:

- `laxhornet_create_team`
- `laxhornet_delete_team`
- `laxhornet_create_roster_player`
- `laxhornet_update_roster_player`
- `laxhornet_remove_roster_player`
- `laxhornet_request_team_player_access`
- `laxhornet_review_team_access_request`
- `laxhornet_claim_roster_player`
- `laxhornet_delete_player_claim`
- `laxhornet_visible_roster_players`
- `laxhornet_my_player_claims`
- `laxhornet_my_teams`

Project One can reuse this for disclosure gating, but coach-specific evidence access is not modeled as distinct from admin/team access.

## Game Creation Flow

Classification: REUSE

Relevant functions:

- `renderStartGame`
- `makeGame`
- `handleSubmit` branch for `data-form="start-game"`
- `markFocusUsedForGame`
- `syncGameToSupabase`

Game creation captures opponent, date, game type, period format, Live Share state, active player snapshot, team/player linkage, and initial score state. The form then navigates to `live`.

## Live Game Flow

Classification: REUSE

Relevant functions:

- `renderLiveTracker`
- `renderLiveStatusChips`
- `renderLivePlayerCard`
- `renderLiveStatGroups`
- `renderLiveScoreControl`
- `logEvent`
- `undoLastEvent`
- `addNoteToLastEvent`
- `syncLoggedEvent`

The live tracker is optimized for sideline capture. It should not be burdened with Project One review concepts beyond preserving source data for later review.

## Game-Ending And Game-Save Flow

Classification: EXTEND

Relevant functions:

- `endGame`
- `confirmEndGame`
- `saveActiveGame`
- `upsertGame`
- `persistAll`
- `syncGameToSupabase`

Current behavior completes the game, records `endedAt` and `savedAt`, sets `reviewGameId`, clears `activeGame`, and renders review. This is the likely integration seam for a flagged `GAME_SAVED -> REVIEW_NOT_STARTED` transition.

The existing flow should remain default when `PROJECT_ONE_EVIDENCE_REVIEW` is off.

## Event Data Model

Classification: REUSE / EXTEND

Local normalized event fields from `normalizeEvent`:

- `id`
- `gameId`
- `userId`
- `teamId`
- `rosterPlayerId`
- `timestamp`
- `quarter`
- `statType`
- `statLabel`
- `category`
- `pointValue`
- `tags`
- `note`
- `fieldZone`
- `correctedAt`
- `tagsUpdatedAt`
- `scoreForAtEvent`
- `scoreAgainstAtEvent`
- `scoreMarginAtEvent`
- `scoreStateAtEvent`
- `gameSegmentAtEvent`
- `scoreAutoIncrement`
- `scoreForBeforeEvent`
- `scoreAgainstBeforeEvent`

Supabase `events` table includes core event fields, tags, note, field zone, and `corrected_at`, but does not include a correction history table or original/corrected value pair.

## Event Storage

Classification: REUSE / EXTEND

Local events live inside the saved game object in `state.games` and `state.activeGame`. Cloud events live in `public.events` and are linked to `public.games` by `game_id`.

Relevant functions:

- `eventToSupabaseRow`
- `eventFromSupabaseRow`
- `syncLoggedEvent`
- `deleteSupabaseEvent`
- `deleteEvent`

Event edits currently update the event in place and set `correctedAt`. That is useful as a minimum correction signal but not a full evidence-preserving ledger.

## Game Storage

Classification: REUSE

Local saved games are stored under scoped `localStorage` and cloud-synced to `public.games`.

Relevant functions:

- `normalizeGame`
- `gameToSupabaseRow`
- `gameFromSupabaseRow`
- `upsertGame`
- `saveReviewedGame`
- `loadCloudGames`
- `syncLocalGamesToCloud`
- `deleteSupabaseGame`

Cloud games include `player_snapshot`, `team_id`, `roster_player_id`, period format, sharing state, status, saved/ended timestamps, and final score columns when present.

## Notes And Tags

Classification: REUSE / DO NOT TOUCH for public exposure

Relevant functions:

- `renderTagEditor`
- `publicEventTags`
- `isPrivateReviewTag`
- `PROCESS_DECISION_TAGS`
- `PROCESS_TAG_SUGGESTIONS_BY_EVENT`

Tags are available and can express process/decision context. The app already distinguishes private process tags from public event tags. Project One should preserve privacy boundaries and avoid exposing private notes/tags in Live Share or parent summaries without review.

## Current Post-Game Review

Classification: EXTEND

Relevant functions:

- `renderReview`
- `renderReviewSummarySection`
- `renderGameStorySection`
- `renderDevelopmentTakeaway`
- `renderFamilyRecapSection`
- `renderConversationStarters`
- `renderReviewStatsSection`
- `renderWhyThesePlaysMatter`
- `buildPostGameIntelligence`
- `calculateTotals`
- `calculateGameImpact`
- `calculatePossessionImpact`

The current review is already interpretation-heavy and development-oriented. Project One Slice 1 should not replace it; it should introduce a flagged evidence-first entry before interpretation.

## Correction And Editing Capabilities

Classification: EXTEND

Existing edit paths:

- Add missed event: `data-form="event-add"`
- Edit event: `data-form="event-edit"`
- Edit game details: `data-form="game-edit"`
- Edit tags: `renderTagEditor`
- Delete event: `deleteEvent`
- Delete game: `deleteGame` / `confirmDeleteGame`

Current edits update the event in place, set `correctedAt`, and sync the edited event. There is no complete immutable correction history with original value, corrected value, author, timestamp, and reason. Project One must not fake this in production.

## Backend Dependencies

Classification: REUSE / EXTEND

The checked-in Supabase schema defines:

- `public.games`
- `public.events`
- `public.teams`
- `public.team_members`
- `public.roster_players`
- `public.user_profiles`
- `public.team_access_requests`
- `public.player_claims`
- `public.notification_queue`

RLS policies protect users, team access, roster access, shared game read behavior, and admin/team operations. There are RPCs for team creation, roster management, access approval, claim repair, deletion, and user profiles.

Project One should not alter SQL during the audit/spec pass. Later production-grade correction history may require schema additions.

## Local-Storage Usage

Classification: REUSE / EXTEND

Local storage is central to offline-first behavior. It supports:

- saved games
- active game
- players and active player
- teams and team claims
- access requests
- deleted game/event tombstones
- review game id
- next-game focus
- admin view mode

Local storage is acceptable for development-only review-deferred state. It is not enough for cross-device coach review state or audit history.

## API Usage

Classification: REUSE

The app uses Supabase client methods:

- `auth.signInWithPassword`
- `auth.signUp`
- `auth.getSession`
- `auth.onAuthStateChange`
- `.from(...).select/insert/upsert/update/delete`
- `.rpc(...)`

There are no application server routes. Any production-grade role separation must be enforced through Supabase RLS/RPC, not only UI.

## Feature-Flag Capabilities

Classification: UNKNOWN / EXTEND

No general-purpose feature-flag framework was identified. The app does include constants and runtime state patterns that could support a small flag object in `app.js`.

Recommended path: add a static default-off flag in `app.js`, enabled only by explicit development override such as query parameter or local developer storage key, with a hard guard that prevents accidental production activation.

## Testing Setup

Classification: EXTEND

No `package.json` or repo-native test script was found. Existing `tools/test_email_sql.py` validates a SQL/email-queue path. App testing currently appears manual or ad hoc through browser/dev-server checks.

For Project One implementation, add smoke tests appropriate to the static app where feasible, likely via Playwright or existing browser tooling outside the repo-native package system.

## Deployment Structure

Classification: DO NOT TOUCH for this pass

Static deployment files:

- `CNAME`
- `.nojekyll`
- `service-worker.js`
- `version.json`
- `manifest.json`

This audit pass must not modify deployment/runtime files.

## Responsive Patterns

Classification: REUSE

`styles.css` and `landing.css` include mobile-first CSS, bottom-nav safe-area padding, `@media` queries, and reduced-motion handling. Review screens already account for bottom navigation spacing.

Project One should preserve 360px width support and touch-friendly controls.

## Accessibility Patterns

Classification: REUSE / EXTEND

Existing patterns include:

- skip link on landing page
- semantic headings
- focus-visible styles
- button labels and `aria-label` usage in several controls
- reduced-motion media query
- high contrast design tokens

Project One should add status text using words, not color alone, and should ensure any review state changes are announced or visibly persistent.

## Implementation Classifications

| Area | Classification | Reason |
| --- | --- | --- |
| Static app shell | REUSE | Stable mount and fallback. |
| Internal screen routing | EXTEND | Add flagged entry without changing default flow. |
| Live tracker | DO NOT TOUCH | Capture should remain athletic and fast. |
| End-game save seam | EXTEND | Best insertion point for game-saved transition. |
| Saved game review | EXTEND | Existing review can remain default and be entered after evidence gate. |
| Event ledger display | EXTEND | Current events can be rendered factually. |
| Event edit/correction UI | EXTEND | Existing edits are useful but not audit-safe. |
| Correction history | UNKNOWN / REPLACE later | Current model only has `correctedAt`; no history. |
| Parent/team access | REUSE | Existing player claims and RLS can gate parent access. |
| Coach access | UNKNOWN | No explicit coach role. |
| Athlete access | DO NOT TOUCH | Athlete-facing access remains disabled. |
| Supabase schema | DO NOT TOUCH in audit | Later additions may be needed for production correction history. |
| Local storage | EXTEND | Acceptable for development-only review state. |
| Service worker/version | DO NOT TOUCH | Audit-only pass. |
| Current analytics formulas | DO NOT TOUCH | Slice is evidence-first, not interpretation. |

## Conflicts With Project One

1. Current Review leads quickly into interpretation, Game Impact, development takeaway, recap, and full breakdown.
2. Edits currently mutate event values rather than preserving a first-class correction ledger.
3. `correctedAt` does not identify original value, corrected value, correction author, or correction reason.
4. Current roles do not distinguish coach from admin.
5. Parent view currently includes sophisticated interpretation if they can see the game review.
6. Live Share can expose event notes/tags if not carefully constrained; current shared rendering uses public-only tags, but notes remain a sensitive area to verify before any Project One extension.

## Required Data Changes

For a development-only Slice 1 adapter, none are strictly required if correction tools are limited and clearly marked as not production-grade evidence history.

For production-grade Project One correction integrity, likely required additions include:

- review state storage
- event correction history or immutable event revision records
- coach-added factual context
- correction author
- correction timestamp
- original value and corrected value
- role-specific disclosure state

## Required UI Changes

Later implementation should add, behind the flag:

- game-saved transition
- Begin Review
- Review Later
- Evidence Record
- parent evidence view
- coach evidence view
- Context needed / Complete status language
- correction-history display only if the model can support it honestly

## Risks

- False confidence if in-place edits are presented as full correction history.
- Role leakage if admin is treated as coach without policy.
- Parent over-analysis if evidence ledger becomes too dense.
- Regressing the fast live tracker if review state enters capture mode.
- Cloud/local divergence if Review Later only persists locally but is implied to be cross-device.

## Assumptions

- The current branch is the intended audit branch.
- Runtime behavior must remain unchanged.
- MethodNorth Observatory files are source authority but remain read-only.
- Real Adult Pilot 01 findings are not yet reconciled.

## Recommended Architecture

Use a default-off flag and a thin development-only integration:

1. Let existing game save complete as it does today.
2. If `PROJECT_ONE_EVIDENCE_REVIEW` is enabled in an approved development context, route to a flagged game-saved transition.
3. Store a minimal local review state keyed by user/game.
4. Render an Evidence Record from existing normalized events.
5. For parent view, show concise summary plus selected evidence and incomplete-context notes.
6. For coach/development view, show fuller factual event ledger and a clearly limited correction adapter.
7. Do not claim production-grade correction history until the data model supports it.
