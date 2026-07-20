# Audit Review

Status: audit-only final review
Decision: READY WITH CONDITIONS

## 1. Can The Feature Be Implemented Without Destabilizing Existing LaxHornet Behavior?

Yes, if it is built as a thin default-off flagged path after the existing game-save flow and if the current Review flow remains untouched when the flag is off.

The safest integration seam is after `confirmEndGame` completes the existing save/upsert/persist/sync behavior.

## 2. Which Current Systems Should Be Reused?

- `confirmEndGame`, `saveActiveGame`, `upsertGame`, `persistAll`, and `syncGameToSupabase` for save completion.
- `normalizeGame` and `normalizeEvent` for factual evidence records.
- `currentReviewGame` and `state.reviewGameId` for game selection.
- `canShowGameForCurrentAccess`, `canEditGame`, `canTrackPlayer`, and player-claim filtering for access.
- `renderShell` and existing card/navigation styles for LaxHornet expression.
- Existing event edit/tag forms only if clearly labeled as limited correction tools.

## 3. Which Current Systems Conflict With Project One?

- Current Game Review starts with interpretation and analytics, not evidence.
- Current event correction is in-place editing with `correctedAt`, not immutable correction history.
- Current roles do not distinguish Coach from Team Admin.
- Current parent review can include sophisticated analytics that may encourage over-analysis.
- Notes/tags require careful privacy boundaries.

## 4. Can The Existing Event Model Preserve Original Evidence After Correction?

Not fully.

It can show that an event was corrected through `correctedAt`, but it cannot reliably preserve original value, corrected value, correction author, correction timestamp history, or multiple revisions. A production-grade evidence-correction system requires additive data modeling.

## 5. Can Parent And Coach Disclosure Be Securely Separated?

Partially.

Parent/player visibility is already protected by player claims, team access, and game filtering. Coach-specific disclosure is not securely modeled because there is no first-class coach role. A development-only adapter can use admin/team role as a proxy, but production policy should not treat admin as coach without review.

## 6. Is Authentication Sufficient To Support Role-Aware Entry?

Authentication is sufficient to know the signed-in user and current team/player access. It is not sufficient to determine coach authority without additional role policy.

## 7. Can Review Later Be Persisted Reliably?

Yes locally. Not cross-device without new storage.

Local storage can support a first development slice, but UX must not imply cloud persistence unless review state is added to cloud storage.

## 8. Is A Destructive Migration Required?

No.

The audit does not require any migration. A later production-grade correction-history feature should be additive, not destructive.

## 9. Three Largest Architectural Risks

1. Treating in-place event edits as full correction history.
2. Treating Team Admin as Coach without secure policy and data enforcement.
3. Adding review-state behavior that diverges between local and cloud devices.

## 10. Three Largest Privacy Or Trust Risks

1. Exposing coach context or private notes to parents before review.
2. Encouraging parents to evaluate or overcoach from raw evidence.
3. Presenting incomplete evidence as complete truth.

## 11. What Must Be Resolved Before Implementation?

- Confirm whether a development-only admin-as-coach proxy is acceptable.
- Decide whether Review Later is local-only for Slice 1.
- Decide whether correction tools are included or only documented as future work.
- Approve user-facing terms for `Complete` and `Context needed`.
- Reconcile actual Adult Pilot 01 results before merge or public presentation.

## 12. What Should Remain Out Of Scope?

- Athlete-facing review.
- AI interpretation.
- Next Edge.
- Recognition and archive.
- Public sharing.
- Production correction-history claims.
- MethodNorth branding inside LaxHornet.
- SQL migrations during this pass.

## 13. Is The Codebase Ready For Implementation?

Decision: READY WITH CONDITIONS

The codebase is ready for a small, default-off, development-only evidence-first transition that reuses existing saved-game and event data. It is not ready for production-grade coach correction history or full role-based Project One disclosure without additional data model and permission work.

## Recommended Next Action

Creative Director review of this audit package, followed by a tightly scoped implementation prompt only if the audit decision and conditions are accepted.
