# Game Scope Decision

The release uses an explicit application field:

- `team_roster`: canonical team and roster-player identifiers are present. Governed Trust Spine synchronization and secure Live Share may be eligible.
- `personal`: private tracking, save, review, export, and backup remain available. Team-scope RPCs and secure Live Share are unavailable.

Existing records are normalized deterministically into one of these values. No fake team, player, or authority record is created. A database column is not required in this release because authoritative team scope is registered and validated server-side before event commands or token creation.
