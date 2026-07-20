# Trust Spine Release 1 Scope Registration

Status: staging bridge for the existing LaxHornet schema; not a new authority
model.

## Purpose

Trust Spine evidence references immutable team, roster-player, and game scope
snapshots. Existing LaxHornet records must be registered before Trust Spine
event operations can use them.

Registration:

- Copies canonical identity from existing `teams`, `roster_players`, and
  `games` records.
- Is idempotent.
- Refreshes descriptive snapshot fields and `snapshot_refreshed_at`.
- Never changes immutable team/player/game identity.
- Never creates an access grant, team membership, or player claim.
- Accepts existing text game IDs, including IDs created locally and later
  synchronized into the legacy `games` table.

## Authorization

The private registration helpers derive the caller from `auth.uid()` and allow
registration only when the caller already has one of these legacy
relationships:

- Team admin membership for the relevant team.
- An exact player claim for the relevant roster player.

Registration does not treat client-submitted role labels as authority.

## Validation

### Team

- The legacy team must exist.
- The caller must already be authorized for that team.

### Roster player

- The legacy player must exist and be active.
- Its `team_id` must match the requested team.
- The caller must be authorized for that team/player.

### Game

- The legacy game must exist.
- Its roster player must exist and be active.
- The roster player's team must match the game's team.
- Any existing Trust Spine scope row with the same ID must preserve that
  identity.

Cross-team and cross-player registration attempts are rejected.

## Snapshot refresh boundary

Re-registration may refresh descriptive snapshot values such as team name,
player name, jersey, position, opponent, game date, and format. It may not
rewrite historical event identity or retarget a scope ID to another team or
player.

## Public wrappers

- `public.lh_register_team_scope(text)`
- `public.lh_register_player_scope(text,text)`
- `public.lh_register_game_scope(text)`

Each wrapper is authenticated-only, fixed-path `SECURITY DEFINER`, and delegates
to a private helper that performs the authorization and consistency checks.

