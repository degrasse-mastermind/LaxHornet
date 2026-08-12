# LaxHornet v284 — Tracked Playing Time

Status: release candidate

v284 coordinates the private Tracked Playing Time foundation and Phase 1 user experience already reviewed and merged in pull requests #24 and #25.

## Included

- Optional game clock with Start, Pause, Resume, period-end, and game-end handling.
- Player In and Player Out boundaries with deterministic private shift history.
- Game Review totals, game share, shift statistics, corrections, missed shifts, and completeness status.
- Immediate local persistence, offline operation, refresh recovery, hosted reconciliation, and device-only fallback.
- Central live-event gating for tracked games: events are accepted only when `clock_running && player_on_field`.

## Privacy and disclosure

Tracked clock state, participation operations, shift history, corrections, recovery state, and playing-time totals remain private. Public Live Share, public/family recap, and selected CSV output do not include tracked-time data.

## Release verification

The historical local release candidate passed the then-canonical fail-fast
workflow, including both database paths, 37/37 pgTAP assertions, rollback
refusal/preservation, disclosure checks, browser checks with no unexpected
console/page errors, containment 32/32, and the complete 29/29 regression. That
local-stack workflow is retained only as exact-SHA historical evidence. Current
release sessions use the portable commands in
`docs/RELEASE_VERIFICATION_WORKFLOW.md` plus the isolated Preview gate.

## Release order

1. Merge the verified v284 release-only changes.
2. Apply only migration `20260727000000_tracked_playing_time_operations.sql`.
3. Verify production RPC availability, forced RLS, authorization, grants, and public disclosure.
4. Deploy the approved v284 frontend from the release merge on `main`.
5. Complete synthetic production smoke tests and cleanup.

The frontend must not be treated as released until the production database verification gate passes.
