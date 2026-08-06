# Post-R2-06 User-Centered QA Audit

Audit date: 2026-08-05  
Audited baseline: `f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37`  
Branch: `qa/post-r2-06-user-centered-audit`  
Risk level: Level 2

## Scope and environments

This checkpoint treated R2-06 as closed historical release evidence. No
production endpoint, production credential, Supabase production connector,
deployment, migration, or production configuration was used or changed.

The audit used the repository-root static PWA on loopback, an isolated
Playwright 1.61.1 Chromium context, a disposable in-browser Supabase adapter,
service-worker-controlled offline mode, the repository's isolated PGlite
fixtures, and existing deterministic contract suites. The in-app browser could
not start because its kernel assets path was unavailable, so the user-approved
repository-pinned Playwright runtime was used instead.

Viewports inspected:

- narrow phone: 360 x 780;
- standard phone: 390 x 844;
- mobile landscape: 844 x 390;
- desktop: 1280 x 800.

## Journeys completed

- Opened the app, initialized an isolated synthetic account, team, roster, and
  two approved players.
- Started a game, entered opponent and period format, recorded common events,
  changed the selected player without reassigning the live game, used Undo,
  and confirmed score and event feedback.
- Left the tracker, recovered the active game, continued offline, reloaded
  under service-worker control, restored connectivity, saved, ended, and
  reviewed the game.
- Verified game-derived totals and the season snapshot, switched account
  namespaces, returned to the original account, deleted the disposable game
  offline, reloaded, and confirmed the game stayed absent while the local
  tombstone remained.
- Confirmed unrelated actions created no Live Share token, then signed out and
  reopened the app in the signed-out state.
- Exercised delayed authentication UI, one-reload bootstrap recovery, expected
  bootstrap failures, repeated hydration generations, out-of-order hydration,
  stale tombstone suppression, account switches during hydration, and
  disposable cleanup through existing focused suites.

## Result summary

The stabilized disposable journey passes `41/41` checks. No Blocker finding,
data loss, cross-account disclosure, authorization bypass, durable-delete
regression, or accidental Live Share disclosure was found. Two reproducible
Important continuity regressions were corrected on the QA branch. Two Polish
findings and one Future test-coverage improvement remain backlogged and do not
block the next rollout phase.

## Findings

| ID | Severity | Reproducibility | User impact | Evidence | Disposition | Status |
| --- | --- | --- | --- | --- | --- | --- |
| QA-01 | Important | Every tested active-game exit | Home offered `Start New Game` while a game was already active, making recovery depend on finding the Live navigation tab. | Failing pre-fix browser assertion; corrected `02-home-narrow.png` and `07-offline-recovered-mobile.png`; final journey `41/41`. | Home now presents the active game's player, opponent, period, and `Resume Live Game`. | Fixed |
| QA-02 | Important | Every tested mid-game player-selection change followed by End Game | The saved-game CTA named the original player but opened an empty review and zero-game season for the newly selected player. | Pre-fix `08-review-standard-mobile.png` and `09-season-desktop.png`; corrected screenshots show Jordan's three events and one-game season. | Opening the saved review now selects the player actually attached to the game before navigation. | Fixed |
| QA-03 | Polish | Reproducible when a disposable backend capability is absent | More shows a machine-oriented last-sync code (`game_scope_unavailable`) beneath a generic attention state, which is not actionable for a typical user. | `11-more-standard-mobile.png`. | Convert durable operation facts to plain-language per-game status under planned R2-08. | Backlogged |
| QA-04 | Polish | Reproducible after short actions on a narrow viewport | A transient toast can visually stack immediately above the fixed bottom navigation and temporarily cover nearby secondary content. Core controls remain reachable by scrolling. | `05-player-switch-narrow.png` and `11-more-standard-mobile.png`. | Review toast/bottom-nav stacking and safe-area spacing in a bounded UI polish ticket. | Backlogged |
| QA-05 | Future | Current automated audit covers controlled reload/reopen but not a literal tab close and browser-history traversal in the same scenario | A manual browser-history or tab-lifecycle regression could be missed even though account-scoped persistence and reload recovery are covered. | Repeatable audit source plus existing hydration/session suites. | Extend the disposable journey with explicit history and tab-lifecycle cases when the browser harness is next revised. | Backlogged |

## Screen and quality assessment

- Home: primary action is now coherent with active-game state; saved-game
  access remains visible.
- Track: setup is concise; player, score, period, common actions, Undo, Save,
  and End Game remain clear and usable at narrow and landscape sizes.
- Review and Season: saved evidence and derived totals remain player-scoped and
  update after save and deletion.
- Players and Teams: selected state is obvious; changing the selected player
  does not reassign the live game.
- More: actions have accessible names, visible focus, and 44-pixel minimum
  touch targets in the inspected state. The technical sync detail is backlogged.
- Live Share: unavailable state is explained and no token is created through
  unrelated actions.
- Data integrity: Undo removes only the latest event; save/reload do not
  duplicate events or games; account switching isolates state; local durable
  deletion survives reopen and removes the game from season totals.

## Verification

- Post-R2-06 disposable browser journey: `41/41` passed.
- Browser readiness: `BROWSER_RUNTIME_READY`; isolated profile created and removed; zero network mutations.
- Browser-session diagnostic: all 9 scenarios passed or failed as expected; no production endpoint contact.
- Browser runtime contracts: `11/11` passed.
- Browser session contracts: `30/30` passed.
- Hydration tombstone suppression: `32/32` passed.
- Disposable browser hydration: passed raw storage, application state, rendered UI, and controlled reload.
- Durable game tombstones: `33/33` passed.
- Tombstone concurrency: `8/8` passed.
- Sync characterization: `32/32` passed.
- Local-storage safety: `28/28` passed.
- Tracked-playing-time browser: `33/33` passed.
- Pages deployment contracts: `21/21` passed.
- Pages artifact validation and service-worker browser check: passed for the audited baseline artifact.
- Release-manifest validation after the product fix: expected fail because the closed R2-06 synthetic-runner inventory pins the baseline `app.js` hash. The manifest was not altered because this Level 2 checkpoint is not a release ticket.
- Pages, preflight, containment, secret/host, changed-JavaScript syntax, and
  `git diff --check` gates passed. The complete canonical-plus-additive run
  finished `49 passed, 2 failed`; both failures are the known closed-R2-06
  integration boundary: the pinned baseline `app.js` hash and the closeout
  contract that requires every non-R2-06 checklist byte to remain unchanged.
  Full output is retained in `full-regression-output.txt`.
- Exact-head CI: pending commit, push, and draft PR; it is expected to report
  the same two release-control failures until the separate integration decision.

## Remaining risks and recommendation

The product journey has no unresolved Blocker or Important user finding. The
branch must not merge or deploy until a separately authorized release-scoped
decision reconciles the closed R2-06 `app.js` hash inventory and coordinated
PWA cache/release markers. That release-control constraint is not evidence of a
user-journey failure and was deliberately not expanded inside this checkpoint.

Recommended next rollout ticket after this stabilization is safely integrated:
R2-07, Add game-field versions and conflict records. It should remain a
separate Level 3 ticket with its own migration, review, and production authority.

QA recommendation: `QA CONDITIONAL PASS — CONTINUE AFTER LISTED IMPORTANT FIXES`.
The Important product fixes are implemented on this branch; continuation is
conditional only on their coordinated release integration and green exact-head
gates.
