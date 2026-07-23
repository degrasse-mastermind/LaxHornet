# Disposable Staging Advisor Results

Project reference: `jafhrhgseiwrohqrhcof`

Checked after the authorized rollback, exact migration reapply, and remote test
suite on 2026-07-22.

## Security Advisor

Manual linter rerun result:

- Errors: 0
- Warnings: 82
- Informational suggestions: 20

The inspected warnings concern pre-existing `public.laxhornet_*` SECURITY
DEFINER functions that the advisor reports as callable without signing in. No
`lh_*` Trust Spine warning appeared in the inspected warning results. These
legacy warnings should be triaged separately and were not changed during this
narrow staging exercise.

## Performance Advisor

Manual linter rerun result:

- Errors: 0
- Warnings: 0
- Informational suggestions: 67

The inspected Trust Spine informational findings are unindexed foreign-key
notices on:

- `public.lh_access_grants`
- `public.lh_access_invitations`
- `public.lh_conflict_adjudications`
- `public.lh_event_annotations`
- `public.lh_event_conflicts`
- `public.lh_event_correction_operations`

The dashboard may contain additional informational rows beyond the visible
virtualized result window. These findings are not disclosure or RLS failures,
but covering-index review is recommended before pilot-scale data.

## Scope Confirmation

The advisors were run only on disposable staging. No advisor action or suggested
fix was applied automatically to production.
