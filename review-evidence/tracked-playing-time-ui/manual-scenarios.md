# Manual Scenario Results

All scenarios passed on 2026-07-27 using synthetic local data. Exact clock math was verified through the pure tracked-time service; the ordinary setup, live controls, period closure, game closure, correction form, and no-data states were also exercised through a rendered mobile browser flow.

| Scenario | Result | Observed outcome |
| --- | --- | --- |
| A. Normal rotation | PASS | Two shifts; total `5:30`; average `2:45`; longest `3:00`; Complete. |
| B. Period boundary | PASS | Q1 shift closed at `0:00` for `1:30`; Q2 opened off field; system-close indicator; Complete. |
| C. Clock pause | PASS | `1:15` running plus `0:45` running produced `2:00`; paused wall-clock time added nothing. |
| D. Game-end closure | PASS | Q2 `4:00` to `1:20` produced `2:40`; system game-end indicator; Complete. |
| E. Correction | PASS | Original `4:00` shift became `3:20`; status changed to Estimated; correction indicator displayed; original operation plus appended revision remained in history. |
| F. Refresh recovery | PASS | Bounded running recovery produced one deduplicated continuous shift with no duplicate Player In. |
| G. No data | PASS | Older completed game displayed `Playing time was not tracked for this game.` and generated no clock or participation data. |

Rendered interaction checks: `14/14` passed with no browser console errors, including running refresh and offline pending-operation persistence.

Pure UI and derivation checks: `36/36` passed.
