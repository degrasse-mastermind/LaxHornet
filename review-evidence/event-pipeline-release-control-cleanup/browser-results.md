# Browser Results

## Local synthetic journey

- Viewport: 390x844.
- Assertions: 61 passed, 0 failed.
- UI event creation, local persistence, authoritative synchronization, token creation, anonymous rendering, correction, tombstone, revocation, offline retry, capability mismatch, personal-game privacy, and update behavior passed.
- Hosted Supabase requests: 0.

## Managed preview synthetic journey

- Assertions: 76 passed, 0 failed.
- Two events were entered through the live tracking UI and synchronized through the canonical event-operation service.
- Live Share rendered the same authoritative event history.
- A later event appeared during polling.
- Correction and tombstone changes propagated.
- An offline event remained local, queued, and reconciled after reconnect.
- Missing capability blocked secure sharing while local tracking stayed available.
- Personal games remained private and ineligible for Live Share.
- Anonymous viewing used only `lh_public_live_share_game`; no ordinary `games` or `events` table request occurred.
- Screenshots are under `browser/`.
