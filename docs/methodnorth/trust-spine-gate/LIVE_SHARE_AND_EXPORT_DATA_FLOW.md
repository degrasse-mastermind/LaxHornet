# Live Share and Export Data Flow

Status: current-state inventory plus Trust Spine public-data requirements.

## Current Live Share creation flow

```text
parent taps Live Share
  -> copyLiveShareLinkNow(gameId)
    -> game.isShared = true
    -> persistAll()
    -> syncGameToSupabase(game, includeEvents: true)
    -> copy share URL
```

Key lines:

- `copyLiveShareLinkNow()` in `app.js:5480-5509`.
- Game/event sync in `app.js:5224-5292`.

## Current Live Share read flow

```text
viewer opens app.html?share=CODE
  -> loadSharedGame(shareCode)
    -> public Supabase client
    -> from games select "*, events(*)"
    -> eq share_code
    -> renderSharedGame()
    -> subscribeToSharedGame(gameId)
      -> postgres_changes on public.games
      -> postgres_changes on public.events
```

Key lines:

- `loadSharedGame()` uses wildcard game and nested event selection in `app.js:5438-5467`.
- Realtime subscription uses ordinary tables in `app.js:5425-5435`.
- Shared render uses `renderEventRow(event, { publicOnlyTags: true })` in `app.js:10523-10528`.
- RLS allows anon/shared access to games and events in `supabase-schema.sql:2101-2108` and `supabase-schema.sql:2138-2153`.
- Realtime publication includes `games` and `events` in `supabase-schema.sql:2241-2259`.

## Current public fields at risk

Because Live Share uses `select("*, events(*)")`, any future columns added to `games` or `events` can become part of the raw client payload unless blocked by RLS/policies or removed later in rendering.

Current event columns include:

- `tags`
- `note`
- `field_zone`
- `corrected_at`
- `tags_updated_at`

Current rendering hides some tag detail through `publicOnlyTags`, but data is still fetched from ordinary tables first.

LH-00 requirement: Live Share must use a separate public-safe projection/RPC with an explicit field allowlist. It must not expose revisions, correction author, coach context, private notes, private process tags, workflow internals, incomplete interpretations, recommendations, or athlete guidance.

## Current export flow

CSV:

```text
exportCSV()
  -> buildCSV()
  -> downloadFile(...)
```

Entry point: `app.js:3684-3687`.

JSON:

```text
exportJSON()
  -> payload includes:
     app/version
     impact model rules
     possession model rules
     exportedAt
     player
     players
     teams
     rosterPlayers
     activePlayerId
     activeTeamId
     games.map(normalizeGame)
  -> downloadFile(...)
```

Entry point and payload: `app.js:3689-3719`.

## Current import flow

```text
importJSONFile(file)
  -> parse JSON
  -> import players
  -> import games
  -> merge with local state
  -> persist locally
```

Entry point: `app.js:3722-3745` and subsequent import logic.

## Current sensitive-export concern

Current exports are user-initiated but broad. They can include notes, tags, player/team data, and full normalized games. That is acceptable for a backup/export feature only if the product treats it as a sensitive export and gives the user clear expectations.

Trust Spine Release 1 should add:

- A sensitive export audit event.
- An explicit export allowlist for each export type.
- Separate public/family/backup export modes.
- Regression tests proving private fields do not appear in Live Share or public/family exports.

## Release 1 public-safe projection target

Required public-safe Live Share fields:

Game:

- `game_id`
- `share_code` verification result, not all share-code metadata
- `opponent`
- `game_date`
- `period_format`
- `current_period`
- `status`
- `score_for`, `score_against` if available
- public-safe player display snapshot only

Event:

- `event_id`
- `game_id`
- `timestamp`
- `period`
- `stat_label`
- `category`
- `point_value`
- public-safe score context if needed

Excluded by default:

- notes
- private/custom tags
- process/decision tags
- field-zone details if treated as private later
- revision history
- author/grant IDs
- review state
- context state
- AI/generated recommendations
