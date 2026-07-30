# `team_members` RLS recursion remediation

## Scope

LH-20 removes four legacy policies on `public.team_members` that selected from
`public.team_members` while PostgreSQL was evaluating RLS for that same table.
That predicate cycle raised SQLSTATE `42P17` for SELECT, INSERT, UPDATE, and
DELETE paths used by the hosted v284 smoke.

The change is additive migration
`20260730004700_team_members_rls_recursion.sql`. It does not mutate membership
rows, Trust Spine grants, teams, players, games, events, or youth/family data.

## Approved authorization model

| Persona or operation | Result |
| --- | --- |
| Anonymous | No table privilege; denied before RLS |
| Non-member | No rows |
| Same-team tracker/member | May read the membership set for that team |
| Wrong-team member | No rows and no cross-team mutation |
| Parent Trust Spine grant only | No `team_members` rows |
| Coach Trust Spine grant only | No `team_members` rows |
| Team-admin Trust Spine grant only | No `team_members` rows |
| Revoked, expired, pending, or malformed grant | No authority |
| Member removing their own membership | Allowed |
| Tracker/member managing another membership | Denied |
| Platform reviewer with an admin membership | May manage membership for that team |
| Service role | Explicit SELECT/INSERT/UPDATE/DELETE only; no TRUNCATE, REFERENCES, or TRIGGER |

`team_members` has no player-scoped rows. A player-scoped grant, including a
grant for a different player, therefore cannot independently expose this table.
Team Admin is not Coach and no Trust Spine role is translated into a direct
membership row.

## Helper boundary

`lh_rls_private.current_team_role(text)` is the only new policy helper.

- It lives outside the exposed `public` schema.
- It is owned by `postgres`, is `SECURITY DEFINER`, has
  `search_path=pg_catalog`, and explicitly disables RLS only for its bounded
  lookup.
- It requires `auth.uid()`, filters by the caller's user ID and one supplied
  team ID, returns at most one normalized role, and cannot browse memberships.
- Only `authenticated` and `service_role` may execute it; `anon` and `public`
  are revoked.
- Platform-reviewer status remains necessary for an `admin` result.

The existing public membership helpers retain their established interfaces,
but the migration makes their fixed search path and intentional RLS bypass
explicit before enabling FORCE RLS.

## Fail-closed production preflight

The migration hashes normalized `pg_policies` metadata and accepts only:

- State A, captured recursive defect: 8 policies, MD5
  `75e5d59fce7de054e5f53d7d5d73f99e`.
- State B, canonical-only drift: 4 policies, MD5
  `c4a69b0c9f9660563eb7aa8ca6e1b3b6`.

Both states require the canonical four policies, `postgres` ownership,
SECURITY DEFINER authorization helpers, and enabled RLS. Any other policy name,
definition, command, role, or ownership shape aborts the transaction. The
separate production preflight must also compare helper definitions, function
ACLs, table ACLs, FORCE RLS, and migration history with the sanitized snapshot
under `review-evidence/team-members-rls-remediation/`.

The migration also recognizes repository-only blank-chain hash
`1c9c5d532c262c3b9ec850552bdf0512`, but only when anonymous DML/read privileges
are absent and the two established helpers have not yet received their
production `row_security=off` setting. This permits a clean local migration
chain. It is not an approved production starting state and the production
preflight must reject it.

## Final state

- Exactly four canonical policies.
- No policy directly or indirectly selects `team_members` through an RLS-bound
  invoker path.
- RLS and FORCE RLS enabled.
- No anonymous table privileges.
- Authenticated and service roles limited to the required DML verbs.
- Migration history records `20260730004700` once.

## Rollback

The rollback is an emergency diagnostic artifact. In isolation it restores the
captured eight-policy state and therefore deliberately restores SQLSTATE
`42P17`. It does not mutate table data or restore broad table grants. It must
not be run in production as a routine rollback; application containment is the
safe recovery if the forward migration cannot be retained.

## Required verification

1. Reproduction pgTAP: 4/4 expected `42P17` assertions.
2. Corrected authorization pgTAP: 37/37 assertions.
3. Rollback: eight policies and exact `42P17`.
4. Reapply: canonical four policies and both pgTAP suites green.
5. Blank migration chain and production-shaped upgrade.
6. Static remediation, release-manifest, containment, secret-scan, and diff
   gates.
7. Post-deployment synthetic production authorization and full v284 smoke with
   zero mutable/auth residue.
