# Post-R2-06 QA Findings Backlog

Audit date: 2026-08-05  
Audited baseline: `f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37`

## Blocker

None.

## Important

None unresolved. QA-01 and QA-02 were fixed and are retained in the main audit
record rather than this unresolved-only backlog.

## Polish

### QA-03 — Replace machine sync codes with actionable language

- User impact: a typical user sees `game_scope_unavailable` but is not told
  what remains safe, what is waiting, or what action is useful.
- Reproduction: use a disposable backend without the optional game-scope
  capability, save or delete a game, then open More and inspect Sync.
- Affected screen or journey: More / account and sync status.
- Recommended action: implement the planned R2-08 per-game states and map
  internal classifications to plain language without exposing private content.
- Proposed ticket level: Level 2 unless retry authority changes.
- Blocks next rollout phase: No.

### QA-04 — Separate transient toast from fixed bottom navigation

- User impact: on a narrow phone, toast and navigation can temporarily cover
  nearby secondary content, increasing visual density after an action.
- Reproduction: at 390 x 844, switch the selected player or trigger a sync
  status, then inspect the lower viewport while the toast is visible.
- Affected screen or journey: Players and Teams; More; narrow mobile feedback.
- Recommended action: add bounded safe-area/stack spacing or move the toast
  above the navigation without redesigning the shell.
- Proposed ticket level: Level 1 or small Level 2 UI polish.
- Blocks next rollout phase: No.

## Future

### QA-05 — Add literal history and tab-lifecycle automation

- User impact: no current failure was observed, but a future regression in
  browser Back/Forward or tab close/reopen could escape the controlled-reload
  journey.
- Reproduction: start a disposable game, navigate browser history or close the
  tab, reopen the same isolated profile, and verify exact event recovery.
- Affected screen or journey: active-game interruption and recovery.
- Recommended action: extend the existing disposable browser audit when its
  harness is next revised; keep service-worker reload and account isolation in
  the same matrix.
- Proposed ticket level: Level 2 test coverage.
- Blocks next rollout phase: No.
