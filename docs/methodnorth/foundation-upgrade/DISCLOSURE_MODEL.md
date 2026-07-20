# Disclosure Model

## Principle

Visibility is a product-safety boundary. It must be enforced by RLS, scoped RPCs, trusted views, or another backend control, not by hiding buttons in the UI.

## Visibility States

| State | Meaning |
| --- | --- |
| `coach_only` | Visible only to assigned coach roles and authorized admins. |
| `reviewer_only` | Visible to platform/team reviewers before parent release. |
| `parent_visible` | Visible to approved parent for the scoped player/team. |
| `family_visible` | Safe for explicitly shared family surfaces. |
| `athlete_visible_future` | Reserved future state; inactive until athlete accounts exist. |
| `withheld` | Deliberately not shown because it may be incomplete, sensitive, or inappropriate. |
| `review_required` | Must be reviewed before broader visibility. |

## Disclosure Matrix

| Record Type | Parent | Coach | Team Admin | Club Admin | Platform Admin | Live Share |
| --- | --- | --- | --- | --- | --- | --- |
| Original event | Scoped player | Scoped team/player | Managed team | Managed club | Support | Public stat only |
| Current event | Scoped player | Scoped team/player | Managed team | Managed club | Support | Public stat only |
| Revision history | Limited summary | Scoped | Scoped | Scoped | Support | No |
| Correction author | Hidden by default | Scoped | Scoped | Scoped | Support | No |
| Coach context | No unless released | Yes | Only if authorized | Only if authorized | Support | No |
| Private note | Author/scoped owner | No unless shared | No unless shared | No unless shared | Support-only | No |
| Public tag | Scoped player | Scoped | Scoped | Scoped | Support | Only if already public-safe |
| Private process tag | Scoped owner only | Scoped reviewer | No default | No default | Support-only | No |
| Evidence status | Parent-safe label | Full scoped | Full scoped | Full scoped | Full | No |
| Incomplete interpretation | No | Reviewer only | Reviewer only | Reviewer only | Support | No |
| Future recommendation | Parent-visible only after review | Scoped | If released | If released | Support | No |
| Parent summary | Scoped parent | If shared | If shared | If shared | Support | No unless copied |
| Athlete guidance | Future only | Future only | Future only | Future only | Future only | No |

## Unresolved Policies

These require founder/product/legal review before implementation:

- Whether coaches may view parent notes.
- Whether team admins may view coach context if they are not coaches.
- Whether revision authorship should ever be parent-visible.
- How long withheld or reviewer-only youth records should be retained.
- Whether future athlete visibility requires age-specific assent controls.

## Live Share Rule

Live Share remains read-only and timeline-focused. It must not expose:

- coach context
- revision history
- private notes
- private process tags
- incomplete interpretation
- future recommendations
- next focus records
- evidence-status internals

## User-Facing Language

Normal parent-facing copy should avoid backend terms. Use:

- "Private to your account"
- "Shared with approved team staff"
- "Ready for review"
- "Not shown in Live Share"

Do not claim legal approval or child-safety compliance. Describe product behavior only.
