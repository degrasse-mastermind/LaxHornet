# Role Visibility Matrix

WORKING POLICY - PROFESSIONAL REVIEW REQUIRED

This matrix is a product and data planning artifact. It is not legal advice and has not received professional youth-safety, privacy, or legal approval.

## Classification Key

- VISIBLE: can be shown to this role in the proposed slice.
- HIDDEN: should not be shown.
- REVIEW REQUIRED: may be shown only after policy/professional review.
- FUTURE ONLY: not part of Slice 1.
- UNRESOLVED: not enough information to decide.

## Matrix

| Information Type | Coach | Parent | Athlete | Administrator | Unauthenticated / Unauthorized |
| --- | --- | --- | --- | --- | --- |
| Raw event | VISIBLE | VISIBLE for approved player only | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Event source | VISIBLE | VISIBLE in simplified form | FUTURE ONLY | VISIBLE if operationally needed | HIDDEN |
| Factual description | VISIBLE | VISIBLE for approved player only | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Completion status | VISIBLE | VISIBLE in plain language | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Context-needed status | VISIBLE | VISIBLE if parent-safe | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Coach-added context | VISIBLE | REVIEW REQUIRED | FUTURE ONLY | REVIEW REQUIRED | HIDDEN |
| Original event after correction | VISIBLE | REVIEW REQUIRED | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Corrected value | VISIBLE | REVIEW REQUIRED | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Correction author | VISIBLE | REVIEW REQUIRED | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Correction timestamp | VISIBLE | REVIEW REQUIRED | FUTURE ONLY | VISIBLE if role-authorized | HIDDEN |
| Coach notes | VISIBLE | HIDDEN unless explicitly parent-approved | FUTURE ONLY | REVIEW REQUIRED | HIDDEN |
| Incomplete interpretation | HIDDEN by default | HIDDEN | HIDDEN | HIDDEN by default | HIDDEN |
| Future athlete-facing guidance | FUTURE ONLY | FUTURE ONLY | FUTURE ONLY | FUTURE ONLY | HIDDEN |
| Future parent-facing summary | REVIEW REQUIRED | REVIEW REQUIRED | FUTURE ONLY | REVIEW REQUIRED | HIDDEN |
| Existing Game Impact / analytics | VISIBLE after evidence | VISIBLE after evidence if already authorized | FUTURE ONLY | REVIEW REQUIRED | HIDDEN |
| Live Share view | REVIEW REQUIRED | VISIBLE only through existing read-only share behavior | HIDDEN | REVIEW REQUIRED | VISIBLE only with share link |

## Role Notes

### Coach

The current app does not have a first-class coach role. Team admin may approximate coach in development testing, but that is not a production policy decision.

### Parent

Parents should receive perspective before evaluation. They should not receive correction tools, coach-only notes, unsupported interpretation, ranking, grade, or athlete identity language.

### Athlete

Athlete-facing review remains disabled in Slice 1.

### Administrator

Administrators may need operational access but should not automatically receive developmental insight access unless also coach-authorized.

### Unauthenticated / Unauthorized

Unauthenticated users should not access private evidence. Existing Live Share remains read-only and should not expose private notes/tags or coach context.

## Disclosure Risks

- Current app roles may over-grant if admin is treated as coach.
- Parent access is currently player-specific, but team games can be visible through team context; any Project One evidence view must continue filtering by approved player/team context.
- Coach notes and correction history need separate data and policy before parent disclosure.
