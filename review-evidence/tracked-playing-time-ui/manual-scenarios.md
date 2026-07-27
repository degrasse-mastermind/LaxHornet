# Manual Scenario Results

All scenarios passed on 2026-07-27 using synthetic local data. The live-capture scenarios were exercised through the rendered mobile browser harness in offline/device-only mode. Direct calls to the central event logger were used where a disabled HTML button could not be clicked, proving the guard does not depend on the DOM.

## Live Event Capture Gate

| Scenario | Result | Observed outcome |
| --- | --- | --- |
| A. Before start | PASS | With the clock stopped and player off field, Goal and Note attempts returned no event. Event count, score, event-operation count, and last-event confirmation were unchanged. The UI said `Start the clock and tap PLAYER IN to record events.` |
| B. Clock running, player out | PASS | Ground Ball was blocked with no local or operation side effect. The clock remained running and the UI said `Tap PLAYER IN to record events.` |
| C. Player in, clock paused | PASS | Assist was blocked with no side effect. The active shift remained on field and the UI said `Start or resume the game clock to record events.` |
| D. Valid state | PASS | With the clock running and player on field, Goal created one event, applied one automatic score increment, invoked the event-operation path, and updated last-event confirmation. |
| E. Mid-shift pause | PASS | Turnover was blocked immediately after Pause. The shift stayed active but its displayed duration froze, so paused wall time did not inflate tracked time. |
| F. Player out during running clock | PASS | Caused Turnover was blocked immediately after Player Out. The clock continued running and the Player In instruction remained visible. |
| G. Non-tracked game | PASS | A game without tracked-playing-time state exposed enabled stat buttons and recorded Goal normally without clock or participation prerequisites. |

The same rendered run also verified accessible disabled controls, usable score/Undo/Save/End/clock/Player In-Out controls, clock resume, period transition, refresh recovery, offline pending-operation persistence, device-only fallback, historical Game Review corrections, and no browser console errors.

## Tracked-Time Calculation Regression

The existing seven deterministic service scenarios remained unchanged and passed:

| Scenario | Result | Observed outcome |
| --- | --- | --- |
| Normal rotation | PASS | Two shifts; total `5:30`; average `2:45`; longest `3:00`; Complete. |
| Period boundary | PASS | Q1 shift closed at `0:00` for `1:30`; Q2 opened off field; system-close indicator; Complete. |
| Clock pause | PASS | `1:15` running plus `0:45` running produced `2:00`; paused wall-clock time added nothing. |
| Game-end closure | PASS | Q2 `4:00` to `1:20` produced `2:40`; system game-end indicator; Complete. |
| Correction | PASS | Original `4:00` shift became `3:20`; status changed to Estimated; correction indicator displayed; original operation plus appended revision remained in history. |
| Refresh recovery | PASS | Bounded running recovery produced one deduplicated continuous shift with no duplicate Player In. |
| No data | PASS | An older completed game displayed `Playing time was not tracked for this game.` and generated no clock or participation data. |

Rendered interaction checks: `33/33` passed.

UI/source contracts: `44/44` passed.

Full local regression: `29/29` groups passed.
