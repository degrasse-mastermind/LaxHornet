# Project One First Proof - Audit Package

Status: audit and specification only
Branch: `feature/project-one-evidence-review`
Runtime behavior changed: none
Merge status: not approved
Deployment status: not approved
Pilot reconciliation status: pending

## What This Is

This folder documents the first conditional LaxHornet implementation path for Project One - First Proof Release Slice 1: Evidence Before Interpretation.

The slice is intentionally narrow. It asks whether LaxHornet can move from fast athletic game capture into a calmer review entry that starts with the recorded evidence before any interpretation, grade, recommendation, or identity language.

This pass does not implement the feature. It audits the current application and specifies the smallest coherent path for a later flagged implementation.

## Source Authority

Read-only source material came from `C:/Users/user/Documents/methodnorth-observatory`, especially:

- `projects/project-one/README.md`
- `projects/project-one/FIRST_PROOF.md`
- `projects/project-one/EXPERIENCE_PRINCIPLES.md`
- `constitution/03-method/THE_METHODNORTH_METHOD.md`
- `research/product-expression/BRAND_GENOME_V0_1.md`
- `constitution/09-product-bible/DATA_AND_EVIDENCE_STANDARD.md`
- `constitution/09-product-bible/USER_ROLE_MODEL.md`
- `constitution/09-product-bible/YOUTH_PRIVACY_PRODUCT_REQUIREMENTS.md`

The MethodNorth repository was not modified.

## Documents

- `CODEBASE_AUDIT.md`: current LaxHornet architecture and implementation seams.
- `PILOT_ASSUMPTIONS.md`: provisional assumptions, each marked pending real pilot confirmation.
- `IMPLEMENTATION_SPEC.md`: smallest viable flagged feature slice.
- `ROLE_VISIBILITY_MATRIX.md`: working visibility policy by role and information type.
- `DATA_MODEL_NOTES.md`: feasibility notes for evidence, correction, and review state data.
- `FEATURE_FLAG.md`: default-off flag recommendation.
- `TEST_PLAN.md`: pre-implementation and implementation test plan.
- `OPEN_QUESTIONS.md`: prioritized unresolved product, data, privacy, safety, and technical questions.
- `AUDIT_REVIEW.md`: final audit decision and implementation readiness.

`IMPLEMENTATION_REVIEW.md` is intentionally not included. It belongs after implementation.

## What Remains Hypothetical

The audit assumes, for planning only, that Adult Pilot 01 returned an advance decision. That has not been reconciled with actual pilot findings. No assumption in this folder may be treated as validated evidence.

## Before Implementation

Before code is written, the Creative Director should review:

1. Whether the proposed slice still expresses Project One rather than a generic app feature.
2. Whether the missing correction-history model is a blocker or acceptable for a development-only adapter.
3. Whether parent and coach disclosure can be safely separated with the current roles.
4. Whether `PROJECT_ONE_EVIDENCE_REVIEW` can be enabled only in an approved development/test environment.

## Before Merge

This branch should not be merged until:

- The real Adult Pilot 01 synthesis is reconciled.
- Role authority and disclosure policy are reviewed.
- Any production-grade correction history requirement is resolved.
- Automated and manual tests prove existing LaxHornet behavior is unchanged when the flag is off.

## Before Deployment

This feature must not be publicly deployed or presented as validated until:

- The flag strategy prevents accidental production activation.
- Parent/coach/athlete visibility boundaries receive professional review.
- The feature is reviewed for youth privacy, dignity, and trust risks.
- The implementation review confirms evidence remains separate from interpretation.
