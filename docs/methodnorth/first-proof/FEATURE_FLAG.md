# Feature Flag Plan

Flag name: `PROJECT_ONE_EVIDENCE_REVIEW`
Default: off
Implementation status: not implemented in this pass

## Existing Flag Support

No general feature-flag system was identified in the static app. The app does have:

- top-level constants in `app.js`
- query-string handling patterns
- local-storage scoped state
- development/demo rendering patterns

## Recommended Smallest Safe Approach

Add a small flag helper in `app.js` during implementation:

```js
const FEATURE_FLAGS = {
  PROJECT_ONE_EVIDENCE_REVIEW: false,
};
```

Then expose development-only enablement through an explicit, non-production path, such as:

- local developer storage key
- localhost-only query parameter
- dedicated test harness

Recommended hard guard:

- If hostname is not `localhost`, `127.0.0.1`, or another explicitly approved test host, the flag remains off.

## Requirements

- Default off.
- Existing review remains default.
- Disabling the flag restores existing behavior.
- No production deployment configuration enables it automatically.
- Flag should be easy to remove if the experiment is rejected.

## Suggested Flagged Flow

When off:

1. `confirmEndGame` behaves as it does today.
2. User goes to current Game Review.
3. No Project One states are visible.

When on in development:

1. `confirmEndGame` saves the game as today.
2. User sees flagged game-saved transition.
3. `Begin Review` opens Evidence Record.
4. `Review Later` persists local deferred state.
5. Existing Review is still reachable after Evidence Record.

## Testing

Verify:

- off state preserves current behavior
- on state is available only in approved development context
- query/local override cannot accidentally activate production
- refresh preserves development flag only where intended
- switching flag off hides all Project One surfaces without corrupting saved games

## Non-Goals

- No remote feature flag service.
- No production rollout targeting.
- No user-facing settings toggle.
- No automatic enablement for admin accounts.
