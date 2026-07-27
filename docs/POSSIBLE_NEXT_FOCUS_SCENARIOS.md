# Possible Next Focus Manual Scenarios

These local-only fixtures exercise the deterministic recommendation rules. They use recorded event types only; notes and tags are intentionally excluded from performance signals and public-facing explanations.

| Scenario | Realistic recorded profile | Expected recommendation | Why this appears |
| --- | --- | --- | --- |
| Scoring-heavy | 4 goals, 2 shots on goal, 1 ground ball | Add the next support play | Finishing drove the recorded impact, with fewer support events around the scoring moments. |
| Possession-loss-heavy | 5 turnovers, 1 ground ball, 1 successful clear | Protect possession under pressure | Several possessions ended under pressure relative to the positive possession plays. |
| Ground-ball and hustle-heavy | 5 ground balls, 2 turnovers, 1 hustle play | Secure the next pass after the ground ball | Ground-ball involvement was strong, while follow-up possession signals were limited. |
| Defensive | 3 caused turnovers, 2 defensive stops, 2 successful clears, 1 ground ball | Turn defensive stops into clean transitions | Defensive contribution shaped the game, making the organized pickup and outlet the next layer. |
| Goalie | 6 saves, 2 goals allowed, 1 successful clear, 1 failed clear | Outlet and reset after the save | Goalie activity shaped the profile, so the reset and safest outlet are the relevant next step. |
| Low-event | 1 turnover, 1 ground ball, plus private notes | Build a fuller game picture | Fewer than four meaningful recorded events do not support a strong pattern. |
| Mixed balanced | 1 goal, 1 assist, 2 ground balls, 1 caused turnover, 1 hustle play, 1 smart play | Repeat the balanced involvement | Several contribution areas appeared without one concern overwhelming the game profile. |

Run the fixtures with:

```powershell
node tools/test_next_focus_recommendation.mjs
```

The script also checks corrections, tombstones, duplicate operation IDs, repetition control, isolated negative events, and private note/tag exclusion.
