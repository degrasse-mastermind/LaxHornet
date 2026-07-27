# Known Limitations

- Phase 1 tracks one selected player per game. It does not model team-wide substitutions or compare athletes.
- The private database foundation remains a draft, unapplied review package. Local tracking is fully usable, but hosted synchronization cannot be accepted until the foundation is separately approved and deployed.
- A running-clock reopen gap longer than 30 seconds is deliberately frozen and marked Needs review instead of inventing elapsed time.
- Overtime is optional. It is included in the configured game-share denominator only after an overtime period is actually used and has a configured duration.
- Corrections preserve game-clock boundaries and append revision history. They do not reconstruct an unknown original wall-clock timestamp.
- Playing-time totals are intentionally not connected to Game Impact, Possible Next Focus, stat timestamps, fatigue, performance rates, or season trends.
- The in-app browser runtime could not initialize in this Codex session. The rendered checks used the repository’s established local Playwright pattern with synthetic data and Chrome; all 14 checks passed with no console errors.
- No production version marker, cache name, script query version, or release manifest entry was changed. Release version coordination remains deferred until both foundation and UI are approved.
