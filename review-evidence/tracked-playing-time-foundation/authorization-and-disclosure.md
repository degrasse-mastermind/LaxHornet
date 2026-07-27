# Authorization, RLS, and Disclosure

## Scope enforcement

Personal games derive the allowed account and player from the canonical `games` row. Team-roster games derive the scope from `lh_game_scopes` and reuse the existing Trust Spine mutation/read grant helpers. Client-supplied account, team, or player authority is never trusted.

The pgTAP suite covers cross-account initialization, cross-player operations, unauthorized reads, stale revisions, personal ownership, and team-roster grant behavior with synthetic identities only.

## RLS and grants

All three foundation tables enable and force RLS. Direct table and view privileges are revoked from `public`, `anon`, and `authenticated`. No permissive browser policy is created: authenticated access is intentionally RPC-only. Private helper execution is revoked from browser roles.

This deny-all direct-table pattern explains the expected `rls_enabled_no_policy` informational advisor entries. It is deliberate, matches the existing Trust Spine pattern, and is paired with tested RPC grants.

## Disclosure decision

- Public Live Share: excluded; its RPC and client parser are unchanged.
- Share Recap: excluded; no recap field was added.
- Selected CSV: excluded; the established exporter maps stat events only.
- Private Full Backup: included when future UI wiring persists `trackedPlayingTime` under a game, because normalization preserves private game fields and the full backup serializes normalized games.
- Future authorized structured export: deferred to a separate ticket with explicit field allowlists and audit requirements.

Tracked time is treated as private child-associated operational history even when its individual fields appear innocuous.
