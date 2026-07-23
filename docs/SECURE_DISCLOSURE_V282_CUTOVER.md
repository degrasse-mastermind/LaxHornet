# LaxHornet v282 Secure Disclosure Cutover Runbook

Status: release candidate only. Production deployment is not approved by this document.

## Immutable release inputs

| Layer | Pull request / branch | Candidate SHA | Approval state |
| --- | --- | --- | --- |
| Database | PR #9 / `review/supabase-production-candidate` | `ad96e428d675fba8fac7752fd108ea06827fa0ad` | Draft; separate approval required |
| v281 runtime | PR #10 / `review/release-hygiene-v281` | `1f6be40f8e0362fed9460c354294093bf83c2793` | Draft; separate approval required |
| v282 activation | `review/secure-disclosure-activation-v282` | Record the approved PR head at the go/no-go gate | Not yet approved |

Stop if any approved head differs from this ledger. The release manager must record the final v282 head before the window; this document must not imply approval before that decision exists.

## 1. Pre-window preparation

1. Confirm production point-in-time recovery is enabled and note the latest recoverable timestamp.
2. Create and verify a pre-window database backup according to the Supabase production backup procedure.
3. Export no youth data into the release evidence package.
4. Confirm PR #9, PR #10, and the v282 activation PR are reviewed independently and remain unmerged until their respective approvals.
5. Confirm the v281 and v282 static builds, service-worker caches, and `version.json` values are internally coordinated.
6. Confirm the v282 evidence package reports zero requests to the production project during rehearsal.

Abort before the window if backup/PITR status cannot be verified, any candidate SHA has moved, or any required test is red.

## 2. Deploy and verify v281

1. With explicit static-release approval, merge and deploy the exact approved PR #10 SHA.
2. Verify the public app and installed-app update path both report v281.
3. Verify local tracking, saved games, Review, and Season remain available.
4. Verify secure disclosure flags remain off in v281 and production behavior has not been cut over early.

## 3. Begin maintenance window

1. Announce the maintenance window and freeze unrelated production changes.
2. Record UTC start time, release operator, database operator, and approved SHAs.
3. Reconfirm the production project reference before any database action.
4. Reconfirm a rollback operator is present and the v281 artifact is available.

## 4. Apply PR #9 database candidate

With separate production-database approval, apply only the four canonical forward migrations from the exact approved PR #9 SHA, in filename order. Do not apply staging repair files, fixture SQL, rollback SQL, or evidence-only files.

Record each migration result and stop on the first error. Do not deploy v282 if the database candidate is incomplete.

## 5. Verify database enforcement

Run read-only verification queries that prove:

- all expected Trust Spine and disclosure tables exist;
- RLS is enabled on every new table;
- anonymous direct reads of `games` and `events` are denied;
- `lh_public_live_share_game` is executable by its intended public caller;
- create, revoke, and export-audit RPCs exist with the approved signatures;
- public evidence and response fields match the strict allowlists;
- no direct anonymous or authenticated table grants were introduced.

Save only schema/object counts and pass/fail results. Do not save production rows, tokens, account identifiers, notes, tags, or youth data.

## 6. Immediately deploy v282

With separate static-release approval, merge and deploy the exact approved activation PR head. Verify:

- `version.json` reports v282;
- the app reports v282;
- the active service-worker cache is `laxhornet-v282`;
- `runtime-config.js` loads before `app.js`;
- `publicLiveShareRpc`, `liveShareTokenRpc`, and `exportAuditRpc` are true;
- an installed v281 client receives the update path and cannot retain flags-off runtime configuration.

Do not leave the database candidate active with v281 longer than the planned atomic window.

## 7. Token, read, and revoke smoke test

Using a dedicated synthetic production smoke-test fixture approved for the window:

1. Sign in as the authorized synthetic operator.
2. Create one game-scoped Live Share token through the approved RPC.
3. Open the public link in an anonymous session.
4. Confirm the viewer uses only `lh_public_live_share_game` polling.
5. Confirm no anonymous `/games` or `/events` request occurs.
6. Confirm public output excludes notes, tags, internal identifiers, and non-allowlisted fields.
7. Revoke the token.
8. Confirm the anonymous view becomes unavailable on the next poll.
9. Remove the synthetic fixture.

Never paste the token into release notes or evidence.

## 8. Export-audit smoke test

Using synthetic records only:

1. Confirm an authorized team administrator can record the approved player export audit.
2. Confirm an authorized team-scoped coach can record the approved player export audit.
3. Confirm cross-player and cross-team attempts are rejected.
4. Confirm private backup audit succeeds only for the signed-in account scope.
5. Remove all synthetic fixtures and retain only pass/fail outcomes.

## 9. Anonymous table-denial verification

From an anonymous browser/network session:

- confirm public reads are RPC-only;
- confirm `/rest/v1/games` is absent;
- confirm `/rest/v1/events` is absent;
- confirm direct table attempts are denied;
- record a sanitized request inventory with production tokens and payloads omitted.

## 10. Abort criteria

Abort or roll back immediately if any of the following occurs:

- migrations fail or only partially apply;
- RLS or grants differ from the approved candidate;
- v282 cannot load the secure runtime configuration before `app.js`;
- anonymous game/event table traffic appears;
- public responses contain a non-allowlisted field;
- token revocation does not promptly disable public viewing;
- export audit accepts a cross-team or cross-player request;
- local tracking, saved-game access, or offline persistence regresses;
- installed clients cannot advance from v281 to v282;
- unexplained production errors rise above the pre-window baseline.

## 11. Coupled rollback

Runtime and database state must be treated as one release:

1. Stop new disclosure smoke activity and announce rollback.
2. Redeploy the exact verified v281 artifact.
3. Confirm clients receive the v281 rollback version according to the release rollback procedure.
4. Execute only the approved PR #9 rollback sequence, in its documented order, if the database rollback decision is made.
5. Preserve accepted production revisions and audit evidence according to the rollback documentation; do not erase operational history ad hoc.
6. Re-run v281 local tracking, Review, Season, and update-path smoke checks.
7. Confirm disclosure flags are no longer active.
8. Record rollback start/end time and results without including production youth data.

If database rollback could lose accepted production operations, stop and use PITR/incident procedures rather than improvising.

## 12. Incident communication

Use plain language:

- what user-facing feature is affected;
- whether local tracking and saved games remain available;
- whether Live Share or audited export is temporarily unavailable;
- what users should do now;
- when the next update will be posted.

Do not expose internal errors, tokens, account identifiers, or security-control details in public messaging.

## 13. Post-release monitoring

For the first hour, then daily for seven days, monitor:

- public Live Share RPC error rate and latency;
- token creation and revocation outcomes;
- rejected anonymous direct-table attempts;
- export-audit accepted/rejected/conflicted outcomes;
- update adoption and stale v281 cache reports;
- local tracking/sync errors;
- support reports involving public disclosure or missing saved data.

## 14. Seven-day legacy fallback removal gate

The legacy source fallback may be removed only after seven complete days of stable v282 operation and a separate review confirms:

- no normal v282 execution reached the fallback;
- installed clients updated successfully;
- public reads stayed RPC-only;
- revocation and export-audit controls remained effective;
- no rollback remains likely;
- a separately scoped removal PR has its own tests and approval.

Do not remove the fallback during the maintenance window unless a separately authorized emergency change requires it.
