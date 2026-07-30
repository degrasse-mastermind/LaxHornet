# LH-20 — Production RLS rollout closeout

Date: 2026-07-30
Status: `TEAM MEMBERS RLS REMEDIATION AND LH-DEV-005 CLOSEOUT COMPLETE`

## State C disposition

The exact production capture remains
`production-state-c-snapshot.json`. It contains all four policy definitions,
per-policy MD5 values, table OID/owner/RLS/ACL metadata, helper OIDs,
language/volatility/body/config/ACL metadata, the complete ordered migration
history, and the authorization-envelope binding.

- Ordered State C policy MD5:
  `1c9c5d532c262c3b9ec850552bdf0512`.
- Helper-set SHA-256:
  `c6e861d2c426ddf7106e3787f5c7b12629f8fb6b7ab315d377d162e0a78aa341`.
- Authorization-envelope SHA-256:
  `853641959fcdef2fb6c4f885576c52f460313475122879b4f8bef4cef841b358`.
- Likely origin: the canonical legacy-baseline policy set, with production
  helper hardening not represented in migration history.
- Exact local reproduction produced no SQLSTATE `42P17`.
- The 18-case State A/B/C/final matrix in `STATE_C_ADJUDICATION.md` classified
  State C as `SEMANTICALLY EQUIVALENT TO STATE B`. It did not broaden or narrow
  the approved authorization model.

The unchanged authorization rules remain: Team Admin is not Coach; Trust Spine
grants do not independently expose membership rows; same-team visibility is
membership-bound; management of other memberships remains restricted;
self-removal remains bounded; anonymous, non-member, wrong-team, revoked,
expired, and pending access fail closed; service-role DML is explicit.

## Repository and review

- Follow-up branch: `fix/team-members-state-c-preflight`.
- Follow-up PR: [#35](https://github.com/degrasse-mastermind/LaxHornet/pull/35).
- Independently reviewed head:
  `bdcb520085f03e97fe14a97394543ba9df3ecd6d`.
- Merged `main` SHA:
  `3e952ea7226e12b38d65dd656b528a3240ee5d9a`.
- Independent exact-SHA review: `PASS`.
- Production preflight at the approved merged SHA: `PASS`.
- Local migration compatibility: reproduction 4/4, corrected pgTAP 43/43,
  remediation contracts 13/13, State A/B/C/final matrix, rollback/reapply,
  blank-chain, production-shaped upgrade, and adversarial fail-closed probes
  passed. The approved authorization model did not change.

The Docker workflow failure on PR #35 was independently reproduced on
contemporaneous `main`: the repository Dockerfile references a nonexistent
`build` stage. The PR did not touch Docker. All release-relevant checks passed.

## Production migration

The approved pre-rollout history contained eight versions through
`20260728193942`. At the immediate pre-apply catalog read, production had
already advanced to the exact approved final state and recorded
`20260730004700|team_members_rls_recursion` once. No duplicate application was
attempted.

The post-apply catalog was verified exactly:

- four policies; ordered MD5
  `2814223218999d3d6364582d5b9e85e1`;
- zero legacy `team_members_*_team` policies;
- RLS and FORCE RLS enabled;
- 16-entry DML-only table ACL, MD5
  `a80522df72f7d68695a08b41e5e7d958`;
- no anonymous table privileges and no authenticated/service-role
  `TRUNCATE`, `REFERENCES`, `TRIGGER`, or PostgreSQL 17 `MAINTAIN`;
- private helper `lh_rls_private.current_team_role(text)`, owned by `postgres`,
  SQL/STABLE/SECURITY DEFINER, `search_path=pg_catalog`,
  `row_security=off`, body MD5
  `c54385c307c2451078471265c63e77bd`, executable only by `postgres`,
  `authenticated`, and `service_role`;
- all four existing public authorization helpers retain their exact reviewed
  bodies and OIDs, use fixed `pg_catalog, public` paths, and expose EXECUTE only
  to `postgres`, `authenticated`, and `service_role`;
- nine ordered migrations with remediation count exactly one.

## Synthetic hosted smoke and cleanup

The final run used the closed non-deployable PR #29 harness as its base and a
local-only derivative at
`03dbd757f768014f2583fb60aca9306e09201f08`. The derivative bound the harness
to allowlisted artifact `9fafa7c2ca7dea90d1469cd1de4591323a359adc`,
removed stale-date and browser-task races from the synthetic fixture, and kept
the tooling outside the deployed tree. All 87/87 safety contracts passed.

The hosted run passed:

- a fresh browser context, explicit sign-out/sign-in, and cloud reconstruction
  of the synthetic user, team, and game;
- ordinary game entry, score, Undo, Save, End Game, and Game Review;
- Event Pipeline correction, offline local retention, one-attempt retry, and
  synchronized tombstone;
- quarters and halves clock transitions, recovery states, nine participation
  operations, and bounded game-end closure;
- exactly two public events through the public-safe RPC and Live Share DOM;
- four private/invalid semantics retained locally and in selected CSV while
  omitted from recap and public payload;
- anonymous denial for all nine tracked-time RPCs and four private tables;
- old access token, refresh token, and private RPC authority rejected after
  revocation and cleanup.

Cleanup returned exact zero for mutable synthetic/Auth residue: users,
sessions, refresh tokens, teams, memberships, roster players, claims, games,
legacy events, profiles, active tokens/grants, running clocks, active event
versions, active participation, pending operations, and conflicts. Retained
append-only history is limited to seven Event Pipeline operations, nine
participation operations, six grant lifecycle events, two game scopes, and one
paused clock dependency. It is private, inert, revoked/tombstoned as
applicable, and synthetic.

No real user, player, family, or youth data was read or mutated.

## Allowlisted Pages rollback and restore

Rollback deployed the known-good allowlisted ancestor
`9fafa7c2ca7dea90d1469cd1de4591323a359adc` through
[run 30514148729](https://github.com/degrasse-mastermind/LaxHornet/actions/runs/30514148729).
Its manifest SHA-256 was
`e5b6b14a266bfc4075a7b453c7d80f650ba56aec0724336978b6ff8a2ff7190c`.
All 47 public files matched, 455 tracked internal paths and 10 additional
adversarial probes remained non-public.

Restore deployed approved `main`
`3e952ea7226e12b38d65dd656b528a3240ee5d9a` through
[run 30514207462](https://github.com/degrasse-mastermind/LaxHornet/actions/runs/30514207462).
Its manifest SHA-256 was
`cadbab4f0df1656aed4a8c430b140bf312c3d16bb361e5b6165a24296e162c38`.
All 47 public files matched, 528 tracked internal paths and 10 additional
probes remained non-public. Pages remained `workflow`-based at
`laxhornet.mybranford.com` with HTTPS enforced and an approved certificate.

## Durable disposition

- `release/laxhornet-release-manifest.json` records the RLS package as
  production-applied and no v284 migration remains pending.
- `REPO_CURRENT_STATE.md` records the final database and deployment state.
- `TICKETS.md` records `LH-DEV-005` as complete.
- `review-evidence/v284-tracked-playing-time-production/LH00_COMMAND_CENTER_UPDATE.md`
  is the durable LH-00 update.
- Structured closeout data is in `PRODUCTION_ROLLOUT_RESULTS.json`.
