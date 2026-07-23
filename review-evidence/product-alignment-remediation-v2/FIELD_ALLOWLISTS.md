# Output Modes and Field Allowlists

## A. Live Share

Purpose: read-only following of one explicitly shared game.

Game object, exact keys:

`game_id`, `team_name`, `player_name`, `jersey_number`, `position`, `opponent`,
`game_date`, `period_format`, `final_score_for`, `final_score_against`

Event object, exact keys:

`event_id`, `occurred_at`, `period`, `stat_type`, `stat_label`, `category`,
`point_value`, `field_zone`

Excluded: notes, all tags, process tags, users, accounts, contacts, grant IDs,
revision history, correction authors, internal review state, private focus,
generated recommendations, audit details, and unrelated roster/team data.

## B. Share Recap

Purpose: a user-previewed conversation aid.

Includes only the rendered contribution summary, cautious interpretation,
conversation prompt, and an optional focus the user deliberately adds. It does
not include event IDs, internal/account IDs, notes, custom tags, process tags,
correction history, or hidden metadata.

## C. CSV Data Export

Purpose: readable event data for one selected scope.

Default scope: selected player. The user may instead choose the current game.
The default is recorded facts only. Notes, public tags, and private process tags
are separate opt-in checkboxes. Unrelated players, teams, authority records, and
account configuration are excluded.

Confirmation copy identifies the export type, scope, selected annotation
options, and that the downloaded file may contain youth information controlled
by the user after download.

## D. Private Full Backup

Purpose: private account recovery.

The backup may include broader local account/player/team/game/event state and
annotations needed for recovery. It is labeled sensitive, requires a dedicated
confirmation checkbox, downloads locally, and never invokes native/public share
automatically. It is not presented as a recap or family export.

## Export Audit

Allowed types: `player_csv`, `full_backup`  
Allowed scopes: `game`, `player`, `account`  
Allowed outcomes: `accepted`, `failed`, `cancelled`

Stored metadata: authenticated actor, resolved active grant when applicable,
team/player/game scope where applicable, export type, scope type, scope ID,
outcome, and server timestamp. The export payload is never stored. Account-scope
backup audits accept only the authenticated user's own user ID.

