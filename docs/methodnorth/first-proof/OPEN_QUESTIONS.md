# Open Questions

Status: unresolved questions for Creative Director, product, technical, and professional review

## Product

| Priority | Question |
| --- | --- |
| BLOCKER | Is Team Admin allowed to act as Coach for a development-only evidence view, or must coach be a distinct role before implementation? |
| HIGH | Should Evidence Record be a separate screen or an entry mode inside Game Review? |
| HIGH | What is the minimum acceptable parent Evidence Record depth before it turns parents into analysts? |
| MEDIUM | Should Review Later appear on Home, Past Games, or only immediately after saving? |

## Data

| Priority | Question |
| --- | --- |
| BLOCKER | Is production-grade correction history required for Slice 1, or can correction features remain explicitly limited? |
| HIGH | Where should review state live if it needs cross-device persistence? |
| HIGH | Should coach-added context be stored on events, in a separate context table, or in a future review table? |
| MEDIUM | How should incomplete context be represented without implying error or failure? |

## Security

| Priority | Question |
| --- | --- |
| BLOCKER | Can parent and coach disclosure be enforced through current RLS/RPC, or would UI-only gating be insufficient? |
| HIGH | How should Live Share explicitly exclude Project One private context? |
| MEDIUM | Should evidence-record access be logged? |

## Privacy

| Priority | Question |
| --- | --- |
| BLOCKER | Which coach notes or context, if any, may be visible to parents? |
| HIGH | What retention rule applies to correction history and coach context? |
| HIGH | Should parent-entered notes be visible to coach/admin by default? |
| MEDIUM | Should exports include evidence status or correction history? |

## Child Safety

| Priority | Question |
| --- | --- |
| BLOCKER | What professional review is required before any athlete-facing review exists? |
| HIGH | What language boundaries prevent evidence review from becoming identity labeling? |
| HIGH | How should sensitive or medical notes be handled if present in existing event notes? |

## Role Permissions

| Priority | Question |
| --- | --- |
| BLOCKER | What differentiates Coach from Team Admin in LaxHornet? |
| HIGH | Can a Parent Tracker ever be both parent and coach for the same player/team? |
| MEDIUM | Should organization-level administrators see individual evidence records? |

## UX

| Priority | Question |
| --- | --- |
| HIGH | How much event detail should be shown before the user can continue into interpretation? |
| HIGH | What is the right copy for `Context needed` so it feels neutral? |
| MEDIUM | Should selected moments be grouped by chronology, possession, or period? |

## Terminology

| Priority | Question |
| --- | --- |
| HIGH | Should the user-facing term be `Evidence Record`, `Game Record`, or `Recorded Plays`? |
| MEDIUM | Should `Complete` mean enough factual data or enough coach-reviewed context? |
| MEDIUM | Should `coach-added context` be called `coach context`, `coach note`, or `review context`? |

## Technical Architecture

| Priority | Question |
| --- | --- |
| BLOCKER | Can this remain a static app if production correction history and role-specific disclosure are required? |
| HIGH | Should feature flags be local-only, environment-based, or server-mediated later? |
| MEDIUM | Is a Playwright harness needed in-repo to protect this workflow? |

## Pilot Reconciliation

| Priority | Question |
| --- | --- |
| BLOCKER | Did Adult Pilot 01 actually support advancing this slice? |
| HIGH | Which pilot findings contradict the assumptions in this package? |
| HIGH | What must be removed or changed before implementation if the pilot findings are mixed? |

## Production Deployment

| Priority | Question |
| --- | --- |
| BLOCKER | Who approves enabling the flag outside local development? |
| HIGH | What tests must pass before merge? |
| HIGH | What professional review must occur before deployment? |
