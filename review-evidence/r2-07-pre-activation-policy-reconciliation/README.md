# R2-07 pre-activation policy reconciliation evidence

## Disposition

Path A — real semantic policy drift. Production contains the exact certified 11
policies plus 12 permissive team-wide policies that are absent from the
repository migration chain. The minimum remediation drops only those 12 exact
policies after binding every relevant starting-state component.

## Forensic reproduction

- Fresh PostgreSQL 17 + exact 18 migrations reproduced 11 policies and aggregate
  `0c9fc6789e1401e149592e2d8c7f0334`.
- A fresh SELECT-only call through `supabase_production_readonly-2` reproduced 23
  policies and aggregate `e7bc2b4dab7dda61af7967dad18b50ca`.
- Every one of the 11 certified policies matched production by canonical
  per-policy digest.
- The only differences are the 12 extra policies listed in `POLICY_DIFF.json`.
- No policy was missing, renamed, role-changed, command-changed, or represented
  with a canonicalization-only difference.

The exact hashing input is generated from `pg_policy`, `pg_class`,
`pg_namespace`, `pg_get_userbyid`, and `pg_get_expr` using the activation gate's
algorithm. The inventory files record all fields and exact per-policy bindings;
the permanent test recomputes rather than trusting prose summaries.

## Semantic significance

The extra game/event policies authorize any authenticated `team_members` row for
the team. The certified policies instead require personal ownership/sharing or
`laxhornet_can_track_roster_player(team_id, roster_player_id)`, whose exact
function digest is `310efc6c975c2b9014ab1f6729a955e0` and which requires platform-review,
team-admin, or a current claim for that exact roster player.

The production-drift fixture proved this difference behaviorally: a plain team
member without a player claim saw the private game and event before reconciliation
(`1,1`) and saw neither afterward (`0,0`). Owner and current-claim authority
remained, while unclaimed, revoked, unrelated, anonymous, direct-write, and clock
table probes remained denied. The four clock policies are also unversioned drift;
direct browser table privileges are absent, so removing them narrows future
catalog authority without altering a currently reachable browser grant.

## Root-cause chronology

Repository history and all 18 recorded production migration versions contain no
creation of the 12 policy names. Production's migration catalog contains no
additional policy migration. Earlier repository evidence in
`review-evidence/team-members-rls-remediation/production-policy-snapshot.json`
also records production policy changes without a corresponding migration.
Therefore the supported conclusion is an unversioned production policy action
outside repository migration history. The available catalog cannot prove the
actor or interface, so none is asserted. No current Supabase platform changelog
entry demonstrates an automatic RLS rewrite matching these 12 policies.

## Remediation contract

`20260811211414_r207_pre_activation_policy_reconciliation.sql` is transactional
and policy-only. It refuses unless all of these match:

- exact 18-version migration array ending at the inert cutover gate;
- one dormant capability row with `cutover_mode = legacy`;
- relation shape `41a0bbcbf5f3f486c14bd074635fd976`;
- full observed digest `e7bc2b4dab7dda61af7967dad18b50ca`;
- the unchanged certified subset digest `0c9fc6789e1401e149592e2d8c7f0334`;
- all 12 extra policy names and individual canonical digests;
- exact authorization helper digest;
- expected games/events/clock RLS and FORCE RLS flags.

On the exact certified digest it cleanly verifies and no-ops so an isolated
Supabase Preview branch can record the prerequisite without fabricating
production drift. On the exact production digest it drops exactly those
policies, requires the final aggregate
`0c9fc6789e1401e149592e2d8c7f0334`, and re-requires dormant capability before
commit. Already-reconciled clean no-op, unknown-third-digest, extra/missing, expression,
role, command, helper, and transactional-failure states all refuse or roll back.

No rollback artifact is provided: restoring the semantically broader,
unversioned access would be unsafe and is not a valid recovery direction.

## Activation package ordering

The new prerequisite must sort after the production-applied cutover gate and
before activation. Because no timestamp exists between the original one-second
adjacent activation/verifier versions, the still-unapplied activation package was
re-versioned without changing recovery or verifier bytes:

1. `20260811211414` policy reconciliation
2. `20260811211415` activation
3. `20260811211416` inert verifier

The activation's precondition now binds the resulting exact 19-version state.

## Permanent proof

`node tools/test_r207_forward_migration_b_activation.mjs` reproduces actual
production drift, performs the reconciliation, exercises the authorization and
adversarial matrices, applies the exact activation and inert verifier, validates
v1 rejection/v2 paths/no-dual-authority/recovery/concurrency, and verifies zero
Docker residue.

The canonical-plus-additive regression includes policy, R2-07A/B/C/D, clock,
tombstone, Trust Spine, tracked-time, Live Share, and activation coverage.

## Safety boundary

- Production mutation: none
- Reconciliation applied to production: no
- Forward Migration B applied to production: no
- Production runtime deployed: no
- Release/cache markers changed: no
- R2-07F production preflight rerun: no
- Test data: synthetic adults only
- Container residue: zero after focused certification
