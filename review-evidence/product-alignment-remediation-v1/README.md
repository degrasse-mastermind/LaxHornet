# LaxHornet Product Alignment Remediation v1

Base commit: `340b904a814e4da904cbe712e219634bb8175390`

Release: `v280`

## Result

This sprint removes Game Impact letter grades and player archetypes from active app behavior, exports, demos, public copy, and linked marketing evidence. Numeric Game Impact remains as a bounded proprietary LaxHornet summary with explicit evidence limitations. Game Review and Share Recap now separate recorded evidence, cautious interpretation, and an optional possible focus.

No SQL file, database schema, migration, RLS policy, Supabase authorization path, event value, possession formula, Game Impact formula, sync behavior, or Live Share transport behavior was changed.

## Root Causes Addressed

1. A single numeric Game Impact value was converted into a letter grade by `impactLetterGrade` and reused across Review, Season, history, demo, share, and marketing surfaces. The grade made a proprietary summary read like an evaluation.
2. Aggregate statistics were converted into named player archetypes and rendered as game and season identity cards. That presentation defined a young athlete from a limited event sample.
3. Recorded facts, interpretation, and suggested development focus were blended into prose. The source and confidence of each statement were difficult to distinguish.
4. The low-data path still produced development language even when fewer than three events were recorded.
5. Optional process and decision tags could influence automatic game patterns or season conclusions even though they are subjective, human-entered context.
6. CSV/JSON and public copy did not consistently identify Game Impact as proprietary or explain that missing and incorrect events change the result.
7. A linked marketing screenshot still showed a `D / 66` Game Impact grade after the UI code changed.

## Exact Files Changed

### Runtime and design

- `app.js`
- `styles.css`
- `app.html`
- `service-worker.js`
- `version.json`
- `assets/club-family-recap.png`

### Public, legal, product, and launch copy

- `index.html`
- `privacy.html`
- `terms.html`
- `player-development.html`
- `program-value.html`
- `tracking-framework.html`
- `README.md`
- `access-and-trust.html`
- `coach-alignment.html`
- `parent-experience.html`
- `rollout-guide.html`
- `launch-kit/invite-message.txt`
- `launch-kit/social-captions.txt`
- `launch-kit/parent-handout.html`

### Tests and evidence

- `tools/test_product_alignment_remediation.mjs`
- `tools/test_product_alignment_browser.cjs`
- `review-evidence/product-alignment-remediation-v1/*`

## Functions Removed

- `impactLetterGrade`
- `renderImpactGrade`
- `calculateRawDimensionScores`
- `normalizeDimensionScores`
- `generateNextLevelFocus`
- `assignArchetype`
- `generateReasons`
- `calculateArchetypeResult`
- `generateShareCard`
- `seasonNextFocusWithProcess`
- `nextLevelFocusForSeason`
- `seasonProfileDescription`
- `detectProcessDecisionPattern`

The `ARCHETYPE_SCORE_CAPS`, `ARCHETYPE_DEFS`, and `ARCHETYPE_DIMENSION_LABELS` constants and their presentation CSS were also removed.

## Functions Added or Modified

- Added `renderImpactScore` for numeric-only presentation.
- Modified `renderEventRow` and `renderTagChips` to label private context and suppress it from public views.
- Modified `publicEventTags` use throughout public event rendering.
- Modified `buildPostGameIntelligence` to return no development takeaway below three events and to avoid automated process-tag conclusions.
- Modified `renderDevelopmentTakeaway` to use visible `Recorded`, `What this may suggest`, and `Possible next focus` layers.
- Modified `buildFamilyRecap` and `renderFamilyRecapSection` to use a previewable evidence-first recap.
- Modified `renderReviewSummarySection`, `renderReviewStatsSection`, `renderReview`, and `renderImpactBreakdown` for numeric-only Impact and evidence limits.
- Modified `renderDashboard` and `buildSeasonIntelligence` to remove archetypes and process-tag season conclusions.
- Modified `renderSharedGame` to remove Game Impact from public Live Share.
- Modified `exportCSV` and `exportJSON` to identify the proprietary numeric field and its limitations.
- Modified demo, promo, tutorial, and help renderers to remove grade and archetype presentation.

The numeric Game Impact and possession calculations were not changed.

## Final Game Impact Language

> Game Impact is a LaxHornet-created summary of selected recorded events. It is not a coach grade, player rating, ranking, or complete measure of performance or development.

> Missing or incorrectly recorded events can change the result.

The detailed breakdown now identifies the recorded contribution categories and explains position weighting as lacrosse context rather than a player identity.

## Final Share Recap Structure

1. Recorded contributions
2. What this may suggest
3. Conversation starter
4. Possible next focus, only when the user explicitly adds one

Runtime-generated example from the browser test:

```text
Demo vs Madison Demo
Recorded contributions
1 goal, 1 assist, 1 ground ball, 1 successful clear

What this may suggest
Based on the recorded events, scoring may have been an important part of this game.

Conversation starter
After winning the ball, what could help make the next pass or carry cleaner?
```

Private notes and private process tags are not included in this recap. No focus appears unless the user adds one.

## Archetype Disablement Inventory

- Active generation: removed.
- Active UI cards and labels: removed.
- Share/recap output: removed.
- CSV/JSON user-facing output: no archetype field emitted.
- Demo and marketing references: removed.
- CSS presentation: removed.
- Database schema fields: none were added or changed in this sprint.
- Legacy imported object properties: `normalizeGame` retains unknown properties through object spread for backward compatibility, but current code contains no archetype read, generation, or display path. No destructive migration was performed.
- Position weighting: retained only for numeric Game Impact context; it does not assign a player type or identity.

## Before And After Evidence

### Before

- [`before-demo-review-season-v279.png`](before-demo-review-season-v279.png) shows the frozen-base demo with a letter-grade Game Impact and archetype presentation.

### After

- [`after-demo-top-v280.png`](after-demo-top-v280.png) shows the demo tracker with possession value, points, and events instead of a grade.
- [`after-demo-review-v280.png`](after-demo-review-v280.png) shows numeric-only LaxHornet Impact, recorded inputs, and the required limitations.
- [`after-demo-season-v280.png`](after-demo-season-v280.png) shows the Season surface with numeric-only Impact and the same limitations.
- [`after-demo-review-season-v280.png`](after-demo-review-season-v280.png) is the full mobile evidence capture.

The stale linked marketing image was replaced with the reviewed `v280` evidence image.

## Test Summary

See [`test-results.txt`](test-results.txt) for raw output.

- Product alignment source regression: 33/33 passed.
- Browser/runtime product alignment checks at 390 x 844: 14/14 passed.
- Cancel Game and tracking-control regression: 33/33 passed.
- JavaScript parse check: passed.
- Release coordination check: passed for `v280`.
- `git diff --check`: passed; only expected LF-to-CRLF working-tree warnings were emitted.

No package manifest exists, so the repository has no configured lint, typecheck, or build script. This is a static PWA.

## Known Limitations

- The browser suite uses synthetic demo data. It does not sign in to Supabase or use real youth/player data.
- Clipboard and native share APIs are protected by wired-action checks and runtime recap generation, but native iPhone share-sheet behavior still requires device acceptance testing.
- Offline/local persistence and legacy saved-game readability are protected by existing code-path regression checks, not a full signed-in multi-device browser scenario in this sprint.
- The numeric Game Impact model remains proprietary and unvalidated as a complete performance or development measure. This sprint constrains its presentation; it does not validate or redesign the formula.
- User-entered notes and process tags remain available in private reviews and account exports. Users should still avoid sensitive or medical information.

## Deferred Findings

- Any Trust Spine migration, RPC cutover, RLS change, generalized disclosure engine, coach role, athlete account, safeguarding workflow, medical workflow, AI interpretation, pricing, or commercialization work remains out of scope.
- A later sprint can evaluate whether numeric Game Impact should be retained, further decomposed, or removed after product and coaching review.
- A signed-in iPhone acceptance pass should verify offline reload, update behavior, clipboard/share behavior, and old cloud-synced games end to end.

## Recommendation

**Ready for the next remediation sprint.**

The targeted conflicts are resolved in the UI and code paths, automated checks pass, and the remaining risks are clearly bounded acceptance and product-validation work rather than blockers to this remediation.

