# vNext production UX integration map

Status: implementation map for `LH-24`

Starting production SHA: `3b866d35d48fc2d54837952241de237d785523cf`

Reference only: `origin/preview/vnext-commercial:pilot-sport.html` and its
`pilot.html` frame. Prototype storage, timers, direct array mutation, and Undo
behavior are not production contracts.

## Boundary decision

The vNext UI will re-render and rewire the existing production capabilities.
It will not introduce a second game, clock, event, participation, sync,
authorization, or conflict model.

Goal/Assist score coupling is the one stopped subsection. `logEvent()` applies
the event and score increment in one synchronous local mutation and
`createEventOperationService()` persists that local state before cloud work.
The activated R2-07 cloud path then sends score fields through
`laxhornet_sync_game_v2` and the event through `lh_create_event`. Those are
separate server transactions with separate operation identities and receipts.
The corresponding Undo path similarly sends a versioned event tombstone and a
game score-field correction separately. This cannot guarantee the required
all-or-nothing outcome under retry, replay, conflict, or a response-loss window.

The minimum safe follow-up is an additive authenticated RPC/command that takes
one permanent client operation identity and atomically applies or reverses both
the versioned event head and its governed score delta, returning one durable
receipt. It must enforce game lifecycle, authority, expected event version,
expected score version, idempotent replay, and tombstone dominance. No client
workaround or migration is included in `LH-24`.

## Requirement map

| # | vNext requirement | Existing production owner | Change required | Risk | Verification |
|---:|---|---|---|---|---|
| 1 | App navigation | `navigate()`, `render()`, `renderBottomNav()` in `app.js` | Relabel the third primary destination as Games and retain Home, Track, Season, and More routing. | Low | vNext source contract and mobile browser journey |
| 2 | Home | `renderHome()`, `renderHomeReadyCard()`, `latestVisibleGame()` | Make active-game resume dominant, then Track, latest game, compact season context, and secondary actions. | Medium | active/no-active browser states and rendered copy assertions |
| 3 | Pregame/new game | `renderStartGame()`, `handleSubmit()`, `makeGame()` | Present player/team/opponent/date, quarters/halves, suggested plus custom duration, and a live structure summary. New vNext games always initialize the existing private tracked clock. | High | quarters/halves/custom-duration persistence and reload tests |
| 4 | Active-game state | `state.activeGame`, `state.trackingSession`, `persistAll()`, `applyStoredAccountState()` | Reuse without a parallel model; only change presentation and setup defaults. | Critical | recovery, reload, cancel, completion, tombstone regression |
| 5 | Score updates | `applyScoreIncrement()`, `updateActiveGameScore()`, `editActiveGameScore()`, `syncGameWithR207Operations()` | Keep manual controls secondary and routed through the governed field path. Do not claim atomic event coupling. | Critical | score-field version/conflict/completed-game tests |
| 6 | Regulation format | `PERIOD_FORMATS`, `periodFormatForGame()`, `periodsForGame()`, `makeGame()` | Preserve canonical `quarters`/`halves`; improve setup explanation and labels. | Medium | format initialization and period transition tests |
| 7 | Period duration | `makeGame()`, `tracked-playing-time-service.js:createClockState()` | Expose suggested values through a datalist while retaining validated custom minutes. | High | supported/custom value, persistence, reload |
| 8 | Authoritative clock | `changeTrackedClock()`, `updateTrackedClock()`, `syncTrackedClockPayload()`, `performR207TrackedClockOperation()`, `performR207TrackedClockBatch()` | Recompose controls inside the scoreboard; do not add a timer authority. | Critical | clock command/batch, offline, reconnect, reload, conflict tests |
| 9 | Player In | `togglePlayerParticipation()`, `createParticipationOperation()`, `appendTrackedParticipation()` | Present as PUT IN with explicit OFF FIELD state. | High | repeated transition and stale-control probes |
| 10 | Player Out | Same participation functions | Present as SUB OUT with explicit ON FIELD state. | High | repeated transition and system-closure probes |
| 11 | Tracked playing time | `trackedTimeState()`, `trackedTimeSummary()`, `renderTrackedPlayingTimeLive()`, `tracked-playing-time-service.js` | Surface total and live shift time more prominently; preserve append-only evidence and review status. | Critical | service/UI/manual scenarios and browser tests |
| 12 | Canonical event vocabulary | `STAT_DEFS`, `STAT_BY_KEY`, `public-event-semantics.js` | Reorganize controls only; retain keys and labels. | High | all-key source contract and public-semantic boundary tests |
| 13 | Event recording | `logEvent()`, `createGameEventOperation()` | Keep immediate local acknowledgement; strengthen visible OFF FIELD lock and last-action feedback. | Critical | rapid tap, offline, stale DOM, delegated click, keyboard probes |
| 14 | Durable local operations | `createEventOperationService():applyLocalOperation()`, `persistAll()`, `event-operation-service.js` durable queues | Reuse unchanged. | Critical | event-operation, local-storage safety, interrupted-sync tests |
| 15 | Cloud event operations | `queueR207VersionedEvent()`, `r207EventService()`, `lh_create_event` / `lh_correct_event` / `lh_tombstone_event` | Reuse unchanged for ordinary events and corrections. | Critical | R2-07C client, migration-contract, retry/replay tests |
| 16 | Goal handling | `logEvent()`, `applyScoreIncrementForStat()` | Preserve existing local behavior; stop cloud-atomic coupling pending the additive composite command described above. | Blocked subsection | local atomicity characterization plus explicit server-contract gap |
| 17 | Assist handling | Same as Goal | Same stopped subsection and dependency. | Blocked subsection | same matrix as Goal |
| 18 | Undo/correction | `undoLastEvent()`, `tombstoneGameEventOperation()`, `correctGameEventOperation()` | Keep production versioned correction/tombstone UX. Do not replace with prototype deletion. Atomic score reversal remains part of the stopped composite contract. | Critical | duplicate Undo, replay, version conflict, completed lifecycle |
| 19 | Score correction | `updateActiveGameScore()`, `editActiveGameScore()`, R2-07 field operations | Restyle as a secondary disclosure panel; retain field versions and conflict routing. | Critical | manual correction and Needs Attention tests |
| 20 | Next Period | `endTrackedPeriod()`, `nextTrackedPeriod()`, `transitionPeriod()` | Label by quarter/half and keep system Player Out closure plus clock batch ordering. | Critical | Q/H transition, period reset, offline batch |
| 21 | End Game | `endGame()`, `confirmEndGame()`, `closeTrackedShiftForGameEnd()` | Use intentional confirmation and a Game captured result with Review now/later choices and honest sync state. | Critical | lifecycle, shift closure, completion restrictions |
| 22 | Active-game recovery | `persistAll()`, `readStoredAccountState()`, `applyStoredAccountState()` | Reuse exactly; Home and Track route to the recovered game. | Critical | refresh while ON/OFF and active recovery |
| 23 | Saved Games | `visibleGames()`, `renderPastGames()`, `renderGameListRow()` | Replace dense rows with scannable factual cards and material sync/attention state. | High | identity, hydration, tombstone, delete, review selection |
| 24 | Game Review | `renderReview()` and review section renderers | Reorganize as Snapshot, Story, Evidence; keep corrections and conflicts visible. | High | tab journey, facts, edit authority, conflict visibility |
| 25 | Story/recap evidence | `buildPostGameIntelligence()`, event/score/period evidence helpers, recap functions | The Story tab uses a new deterministic evidence ledger and does not surface unsupported inference as fact. Existing private recap/export boundaries remain unchanged. | High | traceability IDs, banned-claim assertions, disclosure suites |
| 26 | Season | `renderDashboard()`, `calculateSeasonTotals()` | Restyle only; prioritize games, tracked time, G/A, GB, and CT without formula changes. | Medium | totals parity and source contract |
| 27 | More/settings | `renderMore()`, player/team/account renderers | Keep secondary, account, sync, export/import, Live Share, support/legal, and authority-gated admin entries here. | Medium | ordinary/admin authority browser states |
| 28 | Needs Attention | `renderR207ConflictNotice()`, `renderR207EventConflictNotice()`, `r207ConflictService()` | Integrate badges/panels into Games and Review without flattening or auto-adjudicating. | Critical | R2-07D client and browser conflict tests |
| 29 | Authentication startup | `initApp()` and synchronous `onAuthStateChange()` callback | No awaited work in the callback; retain immediate render before deferred hydration. | Critical | `test_auth_ui_responsiveness.mjs` and signed-in browser startup |
| 30 | Cloud hydration | `loadCloudGames()`, hydration policy/diagnostics, deferred `initApp()` work | Reuse unchanged. | Critical | lossless hydration, stale-generation, tombstone suppression |
| 31 | Service worker/PWA | `registerServiceWorker()`, `service-worker.js`, `manifest.json` | Verify only; no release/cache marker bump for this preview. | Critical | manifest, offline shell, clean install/upgrade, Pages artifact |
| 32 | Live Share | secure eligibility, token/RPC, copy/share, watcher renderers | Preserve allowlists and move entry points under the intended live/More surfaces. | Critical | secure disclosure and Live Share browser suites |
| 33 | Public disclosure | `public-event-semantics.js`, Trust Spine sync, recap/export audit and minimum-disclosure helpers | No disclosure expansion; new tracked time and private evidence stay private. | Critical | public semantic, minimum disclosure, audit, secret scan |
| 34 | Release/cache handling | `APP_VERSION`, `version.json`, `app.html` query markers, `service-worker.js`, release manifest and Pages workflow | Keep all v288/release/cache markers unchanged on the development branch. | Critical | release containment, manifest reconciliation, Pages artifact |

## Affected files

- `app.js`: presentation composition and minimal transient review-tab state.
- `styles.css`: vNext visual system and responsive/sideline states.
- `tools/test_vnext_ux_overhaul.mjs`: focused source and behavior contracts.
- `tools/test_tracked_playing_time_ui.mjs`: exact vNext gate-copy contracts.
- `tools/test_tracked_playing_time_ui_browser.cjs`: authenticated synthetic
  lifecycle and responsive visual checks for the new setup and controls.
- `tools/test_secure_disclosure_activation_browser.cjs`: case-insensitive,
  player-identified review assertion for the intentionally uppercase heading.
- `docs/VNEXT_PRODUCTION_UX_INTEGRATION_MAP.md`: this implementation map.
- `TICKETS.md`: durable Level 3 task record.

No schema, migration, RLS, grant, release marker, service-worker cache name,
runtime activation flag, deployment workflow, or production state change is
authorized or planned.
