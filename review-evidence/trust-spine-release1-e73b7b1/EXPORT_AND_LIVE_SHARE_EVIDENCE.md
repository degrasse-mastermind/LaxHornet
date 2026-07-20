# Export and Live Share Evidence

## Public-safe Live Share allowlist

Game fields:

```text
game_id
team_name
player_name
jersey_number
position
opponent
game_date
period_format
final_score_for
final_score_against
```

Event fields:

```text
event_id
occurred_at
period
stat_type
stat_label
category
point_value
field_zone
```

The executable SQL suite verifies that private fields and tombstoned events do
not appear.

`live-share-public-safe-example.json` is a synthetic shape example derived from
the exact function. It is not a remote network capture because the RPC is not
deployed.

## Sensitive export allowlist

Game fields:

```text
game_id
team_id
roster_player_id
team_name
player_name
jersey_number
position
opponent
game_date
period_format
final_score_for
final_score_against
```

Event fields:

```text
event_id
occurred_at
period
stat_type
stat_label
category
point_value
tags
note
field_zone
```

The audit RPC accepts only:

```text
player_csv
player_json
team_csv
team_json
```

`sensitive-export-audit-example.json` is a synthetic accepted-response example.

## Backup and family/public modes

The Trust Spine migration does not implement export-payload RPCs. It records an
audit and returns manifests only.

The existing app still has its legacy local CSV/JSON backup and Family Recap
features, but they were not changed or connected to the Trust Spine field
manifests in this release.

Therefore:

- Backup output: existing runtime behavior, not Trust Spine governed.
- Family/public export mode: not implemented as a Trust Spine export mode.
- Public-safe output: implemented only for the new Live Share RPC.

No fake “captured output” is included for functionality that does not exist.
