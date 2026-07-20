# Test Plan

Status: pre-implementation

## Automated Where Possible

### Flag Off Regression

- Start a game.
- Log several events.
- Save game.
- End game.
- Confirm current Review opens as before.
- Confirm no Project One transition appears.
- Confirm saved games and season totals still update.

### Flag On Entry

- Enable `PROJECT_ONE_EVIDENCE_REVIEW` in approved development context.
- Start and end a game.
- Confirm game-saved transition appears.
- Confirm opponent, final result, player, position, event count, and status render.
- Confirm `Begin Review` opens Evidence Record.
- Confirm `Review Later` stores deferred state.

### Evidence Record

- Verify chronological event order.
- Verify event type, period, timestamp/order, source, status, and context-needed label.
- Verify `Context needed` is not styled or announced as an error.
- Verify no Game Impact, grade, player profile, or recommendation appears before the evidence record.

### Role Disclosure

- Parent Tracker can see only approved player/team evidence.
- Parent cannot see correction controls.
- Parent cannot see unreviewed coach context.
- Coach/admin development view can see deeper record only when role resolver allows it.
- Unauthorized user cannot access private evidence.
- Athlete-facing review is not reachable through normal navigation.

### Correction Integrity

- Edit an event.
- Confirm the original record remains visible if the feature claims correction history.
- Confirm corrected value, timestamp, and responsible user are visible if the model supports them.
- If the data model cannot support this, confirm UI does not claim production-grade correction history.

### Persistence

- Review Later survives refresh on the same device.
- Review Later is not implied to sync across devices unless implemented.
- Existing cloud sync still works for games/events.

### Accessibility

- 360px width has no horizontal overflow.
- Buttons are touch-friendly.
- Keyboard can reach Begin Review and Review Later.
- Focus state is visible.
- Statuses use text, not color alone.
- Reduced-motion preferences are respected.
- No console errors occur.

## Manual Verification

- Review with a parent account.
- Review with admin/team-management account.
- Check Live Share remains read-only and does not expose Project One private context.
- Check emotional pacing: evidence first, fewer simultaneous choices, no urgency language.
- Confirm feature feels like LaxHornet, not MethodNorth corporate branding.

## Existing Tests

The repo has no `package.json` test script. Existing SQL/email static coverage exists in `tools/test_email_sql.py`, but this pass does not touch email SQL.

## Regression Risks To Watch

- Current game-save flow changes when flag is off.
- Review page analytics order changes unexpectedly.
- Parent Trackers gain roster or coach-level visibility.
- Admin operational mode is confused with coach authority.
- Review Later creates engagement-pressure language.
- In-place event edits are accidentally presented as immutable evidence history.
