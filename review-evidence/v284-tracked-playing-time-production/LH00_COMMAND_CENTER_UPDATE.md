# LH-00 Command Center — v284 production completion

Date: 2026-07-30
Status: complete

- Public-disclosure incident: PR #30 and migration
  `20260728193942_v284_public_event_semantic_boundary` remain production-active.
  Public Live Share returns only canonical ordinary event evidence; private
  aliases, tracked time, notes/tags, and internal metadata remain excluded.
- Pages boundary: repository-root publishing was replaced by the explicit
  47-file `Allowlisted GitHub Pages` artifact. Tools, SQL, tests, documentation,
  release controls, local configuration, and review evidence are not deployed.
- RLS incident: the first allowlisted-artifact smoke exposed SQLSTATE `42P17`
  from recursive `team_members` policies. Production later presented exact
  State C, policy MD5 `1c9c5d532c262c3b9ec850552bdf0512`.
- State C adjudication: exact capture and local reproduction found no `42P17`.
  The 18-case matrix classified State C
  `SEMANTICALLY EQUIVALENT TO STATE B`; it neither broadened nor narrowed the
  approved model. Its origin is the canonical legacy-baseline policy set with
  helper hardening not represented in migration history.
- Repository correction: PR #35, reviewed head
  `bdcb520085f03e97fe14a97394543ba9df3ecd6d`, passed independent exact-SHA
  review and merged as
  `3e952ea7226e12b38d65dd656b528a3240ee5d9a`. It added fail-closed State C
  recognition and fixtures without changing authorization.
- RLS migration: `20260730004700_team_members_rls_recursion` is recorded exactly
  once in production. At the immediate pre-apply re-read, production had
  already reached the exact approved final state, so no duplicate application
  was attempted.
- Final catalog: four policies, MD5
  `2814223218999d3d6364582d5b9e85e1`; zero recursive legacy policies; RLS and
  FORCE RLS enabled; no anonymous table privilege; authenticated/service access
  limited to SELECT/INSERT/UPDATE/DELETE; bounded private helper owned by
  `postgres` with fixed search path, `row_security=off`, SECURITY DEFINER, and
  exact EXECUTE ACL.
- Hosted smoke: a synthetic adult fixture passed clean browser reconstruction,
  explicit logout/login, ordinary game entry, correction, offline retry,
  tombstone, quarters/halves clocks, participation closure, Game Review, CSV,
  recap, neutral-token handling, and anonymous private-access denial.
- Disclosure: exactly two canonical public events appeared in API and DOM.
  Four private/invalid semantics remained local and selected-export eligible
  while staying out of Live Share and recap.
- Revocation and cleanup: old access/refresh tokens and old private RPC
  authority were rejected. Synthetic users, sessions, tokens, teams,
  memberships, claims, roster rows, games, legacy events, active grants,
  running clocks, active versions/participation, pending operations, and
  conflicts all returned zero.
- Retained history: seven Event Pipeline operations, nine participation
  operations, six grant lifecycle events, two game scopes, and one paused clock
  dependency remain private, inert, revoked/tombstoned as applicable, and
  synthetic.
- Pages rollback: run
  [30514148729](https://github.com/degrasse-mastermind/LaxHornet/actions/runs/30514148729)
  deployed known-good allowlisted SHA
  `9fafa7c2ca7dea90d1469cd1de4591323a359adc`; all 47 public files matched and
  internal probes remained unavailable.
- Pages restore: run
  [30514207462](https://github.com/degrasse-mastermind/LaxHornet/actions/runs/30514207462)
  restored approved `main`
  `3e952ea7226e12b38d65dd656b528a3240ee5d9a`; all 47 files matched. Pages
  remained Actions-based at `laxhornet.mybranford.com` with HTTPS enforced and
  an approved certificate.
- Release state: marker/cache remains `v284`; no v284 migration is pending;
  `LH-DEV-005` is complete.
- Data boundary: no real user, player, family, or youth data was read or
  mutated.
- Durable evidence:
  `review-evidence/team-members-rls-remediation/PRODUCTION_ROLLOUT_CLOSEOUT.md`
  and `PRODUCTION_ROLLOUT_RESULTS.json`.
