# Offline Sync Current State

Status: current-state inventory against LH-00 offline-sync contract.

## Storage primitives

The app uses browser `localStorage` for app data and the service worker Cache API for static assets.

Local data keys:

- `laxhornet.playerSettings`
- `laxhornet.players`
- `laxhornet.activePlayerId`
- `laxhornet.games`
- `laxhornet.deletedGames`
- `laxhornet.deletedEvents`
- `laxhornet.activeGame`
- `laxhornet.reviewGameId`
- `laxhornet.teams`
- `laxhornet.rosterPlayers`
- `laxhornet.activeTeamId`
- `laxhornet.teamAccessRequests`
- `laxhornet.playerClaims`
- `laxhornet.removedPlayerAccess`
- `laxhornet.adminViewMode`
- `laxhornet.onboardingIntent`
- `laxhornet.nextGameFocus`
- `laxhornet.familyRecapFocus`

Source: `app.js:1-20`.

Account namespacing:

- `scopedStorageKey(key)` adds `.user.${activeStorageUserId}` when a user ID is known in `app.js:662-664`.
- `readStoredAccountState(userId)` reloads state from that user scope in `app.js:666-690`.

No IndexedDB usage was found.

## Service worker cache

The service worker caches app shell assets under `laxhornet-v275` and handles navigation fallback.

Important current behavior:

- Static assets are precached.
- `version.json` is fetched network-first with `no-store`.
- Navigations try network with `cache: "reload"` then fall back.
- The app has explicit update handling in `app.js:12152-12351`.

## Offline-capable current actions

Current offline-capable actions include:

- Start game locally.
- Add live game events locally.
- Edit/delete local games and events.
- Save next game focus locally.
- Review locally stored games.
- Export local JSON/CSV.

Current status copy:

- `syncGameToSupabase()` sets `Saved on this phone` when offline or signed out in `app.js:5231-5238`.
- Online event triggers `loadCloudGames()` and then `Synced` in `app.js:12399-12408`.

## Current queued operation format

There is no durable queue object or operation log.

Instead:

- Full game/event state is stored locally.
- Deleted IDs are stored in simple arrays.
- On sync, local games are upserted.
- On sync, deleted IDs are retried via RPC/direct delete.

Current delete marker helpers:

- `rememberDeletedGame()` and `rememberDeletedEvent()` in `app.js:2075-2081`.
- `isDeletedGame()` and `isDeletedEvent()` in `app.js:2099-2105`.

LH-00 gap: Release 1 requires permanent operation IDs and explicit replay outcomes. The current local state is not sufficient to prove idempotency, conflict handling, revocation handling, or tombstone safety.

## Retry behavior

Current retry paths:

- `loadCloudGames()` calls `flushDeletedCloudRecords()` before merging cloud games in `app.js:4402-4406`.
- `syncLocalGamesToCloud()` loops current local games and calls `syncGameToSupabase()` in `app.js:4459-4480`.
- `flushDeletedCloudRecords()` loops deleted event IDs then deleted game IDs in `app.js:4483-4500`.

## Conflict behavior

Current conflict behavior is merge-by-ID and direct upsert:

- `mergeGames()` starts from local games, then cloud rows overwrite matching IDs in `app.js:4099-4111`.
- `upsertWithOptionalColumns()` sends full rows to Supabase in `app.js:4079-4097`.

Known current gaps:

- No last-known server event version.
- No field-level merge policy.
- No same-field conflict preservation.
- No separate correction drafts.
- No server-assigned revision sequence.
- No explicit rejected-after-revocation outcome.
- No tombstone resurrection protection beyond local hide/delete arrays.

## Logout and device reset behavior

Current related behavior:

- `signOut()` exists in `app.js:4555` and clears auth state.
- `resetThisDeviceState()` exists in `app.js:4564`.
- `clearLaxHornetBrowserStorage()` removes `laxhornet.*` and Supabase auth-like keys in `app.js:12275-12294`.

LH-00 gap:

- Sensitive cached data removal after revocation is not a server-driven protocol.
- Role/access changes are refreshed through normal sync/profile load, not a dedicated revocation receipt or cache purge instruction.

## Release 1 target offline boundary

Allowed offline for Release 1:

- New game capture.
- New event capture.
- Correction drafts.
- Queued-operation status.

Online-only for Release 1:

- Role invitations and grants.
- Grant revocation.
- Disclosure release.
- Authoritative event review/adjudication.
- Coach-context release.
- Conflict adjudication.
- Support elevation.
- Club administration.
