# Backward Compatibility

## Compatibility Promise

Current LaxHornet must continue to work while the Project One foundation is off.

## Preserved Behavior

- Existing games remain readable.
- Existing events remain readable.
- Existing Game Review remains available.
- Existing Past Games remain available.
- Existing Season Dashboard remains available.
- Existing parent/admin access remains unchanged until explicit migration.
- Existing Live Share behavior remains unchanged.
- Existing offline tracking remains unchanged.
- Existing CSV/JSON export/import remains unchanged.
- No athlete-facing accounts are introduced.

## Legacy Event Normalization

When a legacy event has no evidence status:

- Treat it as `recorded` for display.
- Do not auto-mark `context_needed`.
- Do not infer decision quality or intent.

When a legacy event has `correctedAt`:

- Treat the current event row as the current state.
- Do not claim complete revision history exists.
- Optionally display "edited before revision history" in admin/reviewer contexts.

## Legacy User Normalization

Existing Parent Tracker:

- Continues to behave under current `player_claims`.
- May be mapped to `parent` in a reviewed migration.

Existing Admin:

- Continues to behave under current admin logic.
- May be mapped to `team_admin` or `platform_admin` only through explicit review.
- Must not become `coach` automatically.

## Feature Flags Off

With Project One flags off:

- New foundation tables are not required for normal app rendering.
- No new review workflow blocks a user.
- No current user is forced into Project One.
- No UI route should expose foundation internals.

## Export Compatibility

Current export/import should not include private foundation records unless a future explicit export format and visibility policy is approved.

## Live Share Compatibility

Live Share remains read-only and should use the existing public-safe event timeline. Foundation records remain out of scope.
