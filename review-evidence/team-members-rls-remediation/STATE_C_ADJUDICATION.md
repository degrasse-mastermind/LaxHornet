# Production State C adjudication

Captured: 2026-07-29

Production project: `ulbmjcvnyznvmjgpstno`

Classification: `SEMANTICALLY EQUIVALENT TO STATE B`

This evidence is catalog-only and synthetic-only. No production membership,
team, player, youth/family, or Auth row was inspected or changed.

## Exact binding

- Ordered State C policy MD5:
  `1c9c5d532c262c3b9ec850552bdf0512`.
- Exact authorization-envelope SHA-256:
  `853641959fcdef2fb6c4f885576c52f460313475122879b4f8bef4cef841b358`.
- Exact capture:
  `production-state-c-snapshot.json`.
- Policy entry MD5 values, in policy-name order:
  `5b663d466b2e4f10e3b9f32d24b968fb`,
  `41afbec61cde932584295d287b61e3e7`,
  `884b66c34975337d3e49d25c2bcf5bda`, and
  `49400540bdacd1b5ad883cb9e8d91c0d`.
- Helper-set SHA-256:
  `c6e861d2c426ddf7106e3787f5c7b12629f8fb6b7ab315d377d162e0a78aa341`.
- Table ACL MD5: `76611f7aba7b5501a407d96446952895`.
- Ordered migration-history MD5:
  `257d70e2d82670b2b727575d7173a537`.

The envelope includes the policy definitions, table OID/schema/owner, RLS and
FORCE RLS flags, direct ACL, four helper OIDs/bodies/owners/languages/
`SECURITY DEFINER` flags/configurations/ACLs, absence of `lh_rls_private`, and
the complete pre-remediation migration ledger.

## Origin and semantics

The State C predicates are the canonical scalar-subquery definitions in
`supabase/migrations/20260723000000_laxhornet_legacy_baseline.sql`. Their only
function dependencies are `auth.uid()` and the three already-captured public
authorization helpers. Production hardens the two membership helpers with
`row_security=off`, so those bounded helper reads do not re-enter
`team_members` RLS.

The scalar `SELECT` wrappers change planner evaluation shape but not the
authorization result. Exact local reproduction retained the production helper
configuration and produced the same policy MD5. State C produced no `42P17`
for SELECT, INSERT, UPDATE, or DELETE. Its complete 18-case matrix matched
State B case for case.

## Authorization matrix

`ok:N` means success with `N` returned or affected rows. `deny:CODE` means the
statement failed with that SQLSTATE. All mutations ran in isolated,
rolled-back transactions.

| Case | State A `75e5…` | State B `c4a69…` | State C `1c9c…` | Final `281422…` |
| --- | --- | --- | --- | --- |
| Anonymous | `ok:0` | `ok:0` | `ok:0` | `deny:42501` |
| Own membership | `deny:42P17` | `ok:3` | `ok:3` | `ok:3` |
| Same-team member | `deny:42P17` | `ok:3` | `ok:3` | `ok:3` |
| Wrong team | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Non-member | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Parent grant only | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Coach grant only | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Team-admin grant only | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Tracker membership | `deny:42P17` | `ok:3` | `ok:3` | `ok:3` |
| Revoked grant | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Expired grant | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Pending grant | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Self-removal | `deny:42P17` | `ok:1` | `ok:1` | `ok:1` |
| Insert another member | `deny:42P17` | `deny:42501` | `deny:42501` | `deny:42501` |
| Update another member | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Delete another member | `deny:42P17` | `ok:0` | `ok:0` | `ok:0` |
| Platform-reviewer management | `deny:42P17` | `ok:1` | `ok:1` | `ok:1` |
| Service-role maintenance | `ok:1` | `ok:1` | `ok:1` | `ok:1` |

The final state intentionally narrows anonymous behavior from an RLS-filtered
zero-row result to a direct table-permission denial. Authenticated and
service-role behavior otherwise matches State B and State C.

## Migration compatibility

The exact production-shaped State C fixture converged through only
`20260730004700_team_members_rls_recursion.sql` to final policy MD5
`2814223218999d3d6364582d5b9e85e1`. The migration appeared exactly once in
local history. No authorization expectation changed. The preflight recognizes
State C only as part of the production metadata profile; all existing
helper-body/config/ACL, table owner/ACL/RLS/FORCE, private-schema, production
system-identifier, and exact-history checks remain mandatory.

The State C compatibility defect required a minimal change to the approved
migration preflight, so production use requires renewed exact-SHA independent
review.
