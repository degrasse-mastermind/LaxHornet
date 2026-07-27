# Tracked Playing Time UI Review Evidence

Status: synthetic local review evidence only.

Foundation base:

- Branch: `feature/tracked-playing-time-foundation`
- SHA: `ab5c546665e05edcea82683b9a786aa433fa5c61`

Implementation branch:

- `feature/tracked-playing-time-ui`

Evidence in this directory:

- `screenshots/01-mobile-clock-setup.png` — conservative unchecked opt-in
- `screenshots/01b-mobile-clock-duration-setup.png` — enabled regulation and optional overtime fields
- `screenshots/02-mobile-player-in-state.png` — off-field / Player In state
- `screenshots/03-mobile-running-player-out-state.png` — running clock and on-field / Player Out state
- `screenshots/04-mobile-paused-clock.png` — paused game clock
- `screenshots/05-mobile-game-review-summary.png` — mobile summary and shift history
- `screenshots/06-mobile-correction-flow.png` — governed shift correction form
- `screenshots/07-desktop-game-review-summary.png` — desktop Game Review
- `screenshots/08-mobile-no-data-review.png` — older-game no-data behavior
- `browser-results.json` — rendered interaction checks and console result
- `manual-scenarios.md` — required A-G scenario outcomes
- `privacy-verification.md` — bounded disclosure checks
- `test-results.md` — focused, database, browser, and full-regression summary
- `known-limitations.md` — Phase 1 boundaries and review caveats
- `regression-output.txt` — complete local v283 regression output

All screenshots and scenario data use synthetic player, opponent, and game information. No production Supabase request or mutation was made.
