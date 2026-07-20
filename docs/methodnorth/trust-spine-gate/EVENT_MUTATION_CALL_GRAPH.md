# Event Mutation Call Graph

Status: current-state inventory plus Trust Spine correction target.

## Current live capture path

```text
tap event button
  -> create normalized event
  -> append to activeGame.events
  -> persistAll()
  -> syncLoggedEvent(game, event)
    -> syncGameToSupabase(game)
      -> upsert games row
    -> upsert events row
```

Key code:

- Event definitions and point values: `app.js:43-63`.
- Event normalization: `app.js:2107-2155`.
- Game normalization: `app.js:2158-2235`.
- `syncLoggedEvent()` upserts an event row in `app.js:5295-5334`.
- `syncGameToSupabase()` upserts game and event rows in `app.js:5224-5292`.

Current property:

- New events get stable client IDs and timestamps.
- Local capture can continue offline.

Trust Spine gap:

- The sync path writes directly to `events`; there is no server operation ID, base version, revision sequence, or accepted/conflicted outcome.

## Current post-game edit path

```text
Game Review
  -> Edit / Add Event / Add/Edit Tags / Edit Game Details
  -> mutate local game/events
  -> saveReviewedGame()
    -> normalizeGame()
    -> upsertGame()
    -> persistAll()
    -> syncGameToSupabase(includeEvents: true)
```

Key code:

- Review render and edit surfaces: `app.js:10402-10484`.
- Timeline event row rendering: `app.js:8013` onward.
- Event add/edit/tag forms are rendered by review helpers in `app.js`.
- `saveReviewedGame()` starts at `app.js:2371`.

Current evidence fields that may change:

- `statType`, `statLabel`, `category`, `pointValue`.
- `quarter`.
- `timestamp` for event edits if supported by edit UI.
- `tags`, `note`, `fieldZone`.
- Score context fields.
- `correctedAt`, `tagsUpdatedAt`.

Trust Spine gap:

- `correctedAt` is a metadata marker, not an immutable revision. Original evidence is not preserved in an append-only audit record.

## Current delete and undo path

Undo and delete are local-first:

- Deleted game IDs are stored in `state.deletedGameIds`.
- Deleted event IDs are stored in `state.deletedEventIds`.
- Helpers live in `app.js:2075-2105`.

Game deletion:

```text
delete game confirmation
  -> rememberDeletedGame(gameId)
  -> rememberDeletedEvent(each event)
  -> remove local game
  -> persistAll()
  -> deleteSupabaseGame(gameId)
    -> rpc laxhornet_delete_game
    -> fallback direct .from("games").delete()
```

Key lines: `app.js:3460-3506`, `app.js:5369-5400`, `supabase-schema.sql:1599-1644`.

Event deletion:

```text
delete event
  -> rememberDeletedEvent(eventId)
  -> saveReviewedGame(updatedGame)
  -> deleteSupabaseEvent(eventId)
    -> rpc laxhornet_delete_event
    -> fallback direct .from("events").delete()
```

Key lines: `app.js:3508-3535`, `app.js:5336-5367`, `supabase-schema.sql:1646-1709`.

Trust Spine gap:

- Current server delete is a hard delete.
- There is no durable tombstone table preventing later offline replay from resurrecting deleted evidence.
- Local delete markers help one device but are not authoritative across devices.

## Current import path

```text
JSON import
  -> parse payload
  -> merge players
  -> merge games
  -> persistAll()
  -> later sync may replay imported data
```

Key lines: `app.js:3722-3745` and subsequent import logic.

Trust Spine gap:

- Imported event evidence can enter local state without server correction provenance. Release 1 should treat imports as draft/local recovery unless accepted through a trusted sync/correction path.

## Current sync replay path

```text
loadCloudGames()
  -> loadCloudTeams()
  -> flushDeletedCloudRecords()
  -> syncLocalGamesToCloud()
    -> syncGameToSupabase(includeEvents: true)
  -> fetch cloud own/team games with events(*)
  -> mergeGames(local, cloud)
```

Key lines:

- `loadCloudGames()` in `app.js:4402-4457`.
- `syncLocalGamesToCloud()` in `app.js:4459-4480`.
- `flushDeletedCloudRecords()` in `app.js:4483-4500`.
- `mergeGames()` in `app.js:4099-4111`.

Trust Spine gap:

- Merge is not field-level conflict aware.
- Server does not return `accepted`, `merged`, `conflicted`, `rejected_authority_changed`, `rejected_tombstoned`, or `invalid_base`.
- The client can re-upsert an older effective row if local state wins the merge path.

## Current admin correction path

There is no distinct admin/team-admin event correction path. A user who can edit a player/game uses the same review edit/delete path as the parent tracker.

LH-00 implication:

- Team admin operations must be separated from coach review and parent tracking.
- Team admins should not silently become coaches.
- Event correction authority must be scoped and attributable to the acting grant.

## Release 1 target correction path

```text
client creates correction draft
  -> includes immutable client_operation_id
  -> sends to trusted correction RPC
trusted RPC
  -> auth.uid()
  -> resolve active grant and scope
  -> validate event/game/player/team relationship
  -> lock or version-check target event
  -> dedupe by client_operation_id
  -> compare last_known_server_event_version
  -> insert immutable revision
  -> update effective event row only if accepted/merged
  -> increment server event version
  -> insert audit event
  -> return explicit outcome
client
  -> records receipt/outcome
  -> does not overwrite evidence on conflict
```

Direct ordinary client `update/delete` on evidence-bearing `events` must be denied after cutover.
