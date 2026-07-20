# Implementation Spec

Status: pre-implementation specification
Feature flag: `PROJECT_ONE_EVIDENCE_REVIEW` default off

## Principle

Capture can be athletic. Review must be humane.

This slice should not redesign LaxHornet Review. It should add a narrow evidence-first transition before interpretation when the feature flag is explicitly enabled.

## Smallest Viable Feature Slice

### 1. Game-Saved Transition

Purpose: pause after game completion and orient the user toward evidence before interpretation.

Existing reusable system:

- `confirmEndGame`
- `saveActiveGame`
- `upsertGame`
- `persistAll`
- `syncGameToSupabase`
- `state.reviewGameId`

Required extension:

- When flag is enabled, after a game is saved, route to a flagged transition screen instead of directly showing the current Review page.

Required new behavior:

- Show opponent, final result if available, player, role/position, event count, and context status.
- Offer `Begin Review` and `Review Later`.

Unresolved dependency:

- Whether Review Later must sync across devices or can remain local during the first development slice.

### 2. Role-Aware Review Entry

Purpose: use existing authenticated context without asking production users to manually choose role.

Existing reusable system:

- `currentUserId`
- `state.authUser`
- `currentAppRole`
- `teamRole`
- `isPlatformReviewer`
- `state.adminViewMode`

Required extension:

- A role resolver for the flagged feature that maps current user context to `parent`, `coachCandidate`, `admin`, `unauthorized`, or `athleteDisabled`.

Required new behavior:

- Parent headline: `Start with what happened.`
- Coach/development headline: `Start with the evidence.`
- Athlete-facing entry remains disabled.

Unresolved dependency:

- Current LaxHornet has admin/tracker, not coach. Treating admin as coach is a development-only approximation unless policy approves otherwise.

### 3. Begin Review

Existing reusable system:

- `renderReview`
- `currentReviewGame`
- event normalization

Required extension:

- `Begin Review` opens a flagged Evidence Record first.

Required new behavior:

- Evidence Record before interpretation.
- Role-specific disclosure.
- Clear source and status labels.

Unresolved dependency:

- Whether the Evidence Record is a separate screen or a mode within `review`.

### 4. Review Later

Existing reusable system:

- `localStorage`
- `persistAll`
- `reviewGameId`

Required extension:

- Store deferred review state keyed by user and game.

Required new behavior:

- Confirmation: `The game is saved. Your events and notes will be here when you return.`
- Avoid guilt, urgency, streaks, countdowns, or engagement-driven reminders.

Unresolved dependency:

- Cross-device persistence likely requires schema or profile storage; do not imply it exists if local-only.

### 5. Evidence Record

Existing reusable system:

- `normalizeGame`
- `normalizeEvent`
- `renderEventRow`
- `calculateTotals` only for factual counts, not interpretation

Required extension:

- A factual ledger renderer that does not include Game Impact, archetype, family recap, or recommendation language.

Required new behavior:

- Show event type, period/game segment, order/timestamp, factual description, source, completion status, context-needed status, and visible notes/context where allowed.

Unresolved dependency:

- `source` is currently mostly derivable as system/user-recorded event. A richer source model does not exist.

### 6. Coach Evidence Depth

Existing reusable system:

- Admin/team roster tools
- Event edit form
- `correctedAt`

Required extension:

- Development-only fuller evidence view for authorized coach/admin context.

Required new behavior:

- Chronological event record.
- Inspectable source.
- Complete / Context needed status.
- Coach-added factual context if safely stored.
- Minimum correction action with original and corrected values visible.

Unresolved dependency:

- Current data model cannot preserve complete correction history. Do not fake production-grade audit history.

### 7. Parent Evidence Depth

Existing reusable system:

- Player-claim and game visibility filtering.
- Current Review page can remain after evidence entry.

Required extension:

- Parent-specific factual summary and selected moments.

Required new behavior:

- Concise factual game summary.
- Selected recorded moments.
- Explanation of incomplete context.
- Optional full factual ledger.
- No correction tools.
- No unreviewed sensitive coach notes.
- No coaching directive or player ranking.

Unresolved dependency:

- Need policy for which coach context is parent-visible.

### 8. Review-State Model

Minimal states:

- `GAME_SAVED`
- `REVIEW_NOT_STARTED`
- `EVIDENCE_INCOMPLETE`
- `EVIDENCE_READY`
- `REVIEW_DEFERRED`

Out of scope states:

- interpretation
- recognition
- Next Edge
- conversation
- thread
- archive

### 9. Feature-Flag Behavior

Default behavior:

- Existing LaxHornet flow remains unchanged.

Flag-on development behavior:

- Game completion routes into Project One transition.
- Evidence Record appears before interpretation.
- Role disclosure controls are applied.

Fallback:

- Disabling the flag must restore current review behavior without data cleanup.

### 10. Out Of Scope

Do not implement in Slice 1:

- AI interpretation
- automated game story changes
- athlete labels
- Next Edge
- parent conversation prompts beyond existing app behavior
- public sharing
- youth-facing review
- new MethodNorth branding
- production deployment
- SQL migrations during this audit/spec pass

## Stop Conditions For Implementation

Stop implementation if:

- parent and coach disclosure cannot be securely separated
- correction history would be silently overwritten
- feature requires destructive migration
- athlete-facing access becomes reachable
- feature cannot remain default off
- existing save/review behavior regresses with the flag off
