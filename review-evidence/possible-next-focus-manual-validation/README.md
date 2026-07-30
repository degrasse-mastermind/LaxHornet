# Possible Next Focus Manual Validation

Validation date: 2026-07-27  
Repository: `degrasse-mastermind/LaxHornet`  
Current `main` SHA: `2a0435817d7302b1041542d0ef0f54c9697e8bc0`  
Production URL: `https://laxhornet.mybranford.com/app.html`  
Browser/device: Codex in-app browser on a Windows desktop, using its default viewport  
App version shown: `v283`

This was a validation-only run. No application code, migration, release marker,
production configuration, or existing real player/game record was edited. The
evidence folder is intentionally uncommitted.

## Test identity and controls

- Game player: existing synthetic fixture `Jimi Hendrix #63` on synthetic team
  `Rockstars Elite 2033`.
- Every controlled opponent was prefixed `QA TEST ONLY`.
- Live Share remained `Off` for all four games.
- No recap was copied and no Live Share link, code, or token was requested.
- No private note was entered.
- One benign process tag was temporarily added to the scoring game's ground-ball
  event after the baseline capture. The focus and explanation remained unchanged.
  The tagged event was then removed when the QA game was deleted.

An attempt to create a more explicitly labeled synthetic roster player
(`QA TEST NEXT FOCUS 20260727 #99`) succeeded in the admin roster, but the
parent-access request failed with the in-app error:

`column reference "id" is ambiguous It could refer to either a PL/pgSQL variable or a table column. 42702`

The unverified synthetic player was not used for any game and was removed from
the roster during cleanup. The existing synthetic fixture was used instead.

## Game 1 - Scoring-heavy

Opponent: `QA TEST ONLY - SCORING`

Exact events:

- 4 Goals
- 2 Shots on Goal
- 1 Ground Ball

Recorded event count: `7`

Possible next focus:

> Build on the scoring by adding one feed, ride, backup, or ground-ball support play.

Why this appeared:

> Finishing drove the recorded impact, while fewer support events appeared around those scoring moments.

Screenshot: [game-1-scoring-heavy.png](game-1-scoring-heavy.png)

## Game 2 - Possession-loss-heavy

Opponent: `QA TEST ONLY - POSSESSION LOSS`

Exact events:

- 5 Turnovers
- 1 Ground Ball
- 1 Successful Clear

Recorded event count: `7`

Possible next focus:

> Secure the ball first, scan for the simple outlet, and move it before pressure closes.

Why this appeared:

> Several recorded possessions ended under pressure relative to the positive possession plays.

Screenshot: [game-2-possession-loss-heavy.png](game-2-possession-loss-heavy.png)

## Game 3 - Low evidence

Opponent: `QA TEST ONLY - LOW EVIDENCE`

Exact events:

- 1 Turnover
- 1 Ground Ball

Recorded event count: `2`

Possible next focus:

> Track one simple pattern next game, such as ground balls, clears, or smart decisions.

Low-evidence behavior:

> There may not be enough recorded evidence for a reliable game takeaway yet.

`Why this appeared` was not shown. The app withheld a strong pattern explanation
and displayed the low-evidence statement instead.

Screenshot: [game-3-low-evidence.png](game-3-low-evidence.png)

## Game 4 - Defensive

Opponent: `QA TEST ONLY - DEFENSIVE`

Exact events:

- 3 Caused Turnovers
- 2 Defensive Stops
- 2 Successful Clears
- 1 Ground Ball

Recorded event count: `8`

Possible next focus:

> After the stop, communicate the pickup and outlet so the defense can become a controlled clear.

Why this appeared:

> Defensive contribution was a clear part of the game; the next layer is organizing the possession after the stop.

Screenshot: [game-4-defensive.png](game-4-defensive.png)

## Refresh and duplicate verification

After all four games were completed, the production page was refreshed. The
synthetic fixture showed six games: its two pre-existing games plus the four QA
games. Each QA game was reopened after refresh.

Persisted timelines:

- Scoring: `Ground Ball, Shot on Goal, Shot on Goal, Goal, Goal, Goal, Goal`
- Possession loss: `Successful Clear, Ground Ball, Turnover, Turnover, Turnover, Turnover, Turnover`
- Low evidence: `Ground Ball, Turnover`
- Defensive: `Ground Ball, Successful Clear, Successful Clear, Defensive Stop, Defensive Stop, Caused Turnover, Caused Turnover, Caused Turnover`

The counts, event types, focus text, and explanation text were unchanged after
refresh. No duplicate events appeared.

The PNGs are full-page stitched captures from the in-app browser. The capture
stitching repeats some visual sections in the long images; the app's saved
timelines were separately reopened and counted as listed above.

## Runtime and console evidence

- Production app loaded normally.
- `next-focus-recommendation.js?v=283` returned HTTP `200` as
  `application/javascript`.
- The recommendation module response was served through the production service
  worker.
- No application-origin console errors were observed.
- No network loading failures, runtime exceptions, or tab crashes were observed.
- No service-worker error was observed.
- The synthetic parent-access attempt produced the in-app `42702` sync error
  described above. It was not a console or service-worker exception.

## Evaluation

1. Scoring-heavy and possession-loss-heavy produced meaningfully different recommendations: `PASS`.
2. Low evidence avoided overconfident analysis: `PASS`.
3. Defensive produced defense/transition-relevant advice: `PASS`.
4. Explanations were grounded in the recorded events: `PASS`.
5. A synthetic process tag did not influence focus or explanation: `PASS`.
6. No obviously unrelated advice appeared: `PASS`.
7. No unsupported recommendation was reused across scenarios: `PASS`.
8. Game Review loaded normally for all four games: `PASS`.
9. No duplicate events appeared: `PASS`.
10. Refresh preserved all four games and their review output: `PASS`.

The low-evidence user-facing focus is a concrete tracking prompt rather than the
short internal title `Build a fuller game picture`, but it communicates the
intended low-evidence direction and is paired with an explicit evidence-limit
statement.

## Cleanup

- Deleted all four `QA TEST ONLY` games.
- Removed `QA TEST NEXT FOCUS 20260727 #99` from the synthetic roster.
- Confirmed the synthetic fixture returned from six games to its original two.
- Confirmed the admin roster count returned from five players to its original four.
- Confirmed pending operations `0`, conflicts `0`, cloud status
  `Synced to your account`, and Live Share `Off`.
- Restored the account's original active player selection.
- No Live Share action was used and no share code or reusable token was created.
- Existing real players, teams, and games were not edited or deleted.

The admin health screen's pre-existing failed-operation counter increased during
the run (`236` to `260`). No record-level contents were inspected. The visible
counter is retained here as an operational limitation even though pending
operations returned to `0` and the four games and temporary player were removed.

## Screenshot integrity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `game-1-scoring-heavy.png` | 236850 | `a43807644950dc1f03428bc0bc18a30b184a4bc40ef2a844a3cfbff74a155e69` |
| `game-2-possession-loss-heavy.png` | 241975 | `61286cdbc4749938b2c05296ca76bf74dfcd67fd45007238197b4eeaf5b36b67` |
| `game-3-low-evidence.png` | 165953 | `ef0174383a7affb3af5080a98d99928e5cae66563245909cbf04bfd804e1551b` |
| `game-4-defensive.png` | 258183 | `4e71b9bbd80127f544863bedd197ad5d298bab7cd7374a5b6d77efeeefa0765b` |

Final recommendation: `NEXT FOCUS VALIDATION PASSED`
