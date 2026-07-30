# R2-06/R2-06A production-state reconciliation

Date: 2026-07-30

Risk: Level 3 — production release control, migration provenance, durable
deletion, authorization, synchronization, and rollback

Classification:
`Unauthorized release-control deviation with apparently aligned reviewed state`

Status: production state preserved; synthetic verification remains separately
gated

## Scope and non-mutation boundary

This reconciliation used GitHub metadata, public artifact reads, exact Git
objects, a disposable local PostgreSQL 17 database, and read-only queries
through `supabase_production_readonly-2`.

It did not deploy or roll back an application, apply or roll back a migration,
repair migration history, change Supabase configuration or database objects,
create or delete an Auth user, or create, inspect, modify, or delete a
production game, event, tombstone, team, player, or other production row.

## Deployment provenance

| Field | Confirmed result |
| --- | --- |
| Workflow | `Allowlisted GitHub Pages` |
| Workflow path | `.github/workflows/pages-deployment.yml` |
| Run | `30559099199` |
| Event | `push` |
| Actor / triggering actor | `degrasse-mastermind` |
| Ref | `main` |
| Commit | `2fcc446d5f3d06ca6d24c69bc4466a13794e02b3` |
| Created | `2026-07-30T15:56:03Z` |
| Completed | `2026-07-30T15:56:52Z` |
| GitHub deployment | `5678005974` |
| Deployment result | `success` at `2026-07-30T15:56:40Z` |

The workflow is configured to run on every push to `main`. The `github-pages`
environment had one branch-policy rule allowing `main`; it had no required
reviewer or wait-timer rule. The build began at `15:56:05Z`, the deployment
entered `waiting` at `15:56:21Z`, was queued at `15:56:22Z`, and began at
`15:56:30Z` without a human approval record.

The workflow therefore behaved exactly as configured. This was not a workflow
execution malfunction. It was a release-governance/control defect: merging
reviewed code to `main` automatically advanced the production runtime even
though the tracked Level 3 release process had not authorized production
activation and the production-phase manifest state was contradictory.

## Runtime identity

PR #48 reviewed head
`631f48ed73b326b2b4eed8ac29623d79136fce8f` and squash merge
`2fcc446d5f3d06ca6d24c69bc4466a13794e02b3` both have Git tree
`a5374b7e4c00fe91cae8de34fbcf417943305df3`.

Pages artifact evidence:

- workflow artifact ID: `8766067059`;
- artifact name:
  `pages-deployment-manifest-2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`;
- manifest SHA-256:
  `5443857503e33f368056abc8d35c40380fdb07a28c10499d6ad3150774372489`;
- manifest source:
  `2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`;
- build time: `2026-07-30T11:55:58-04:00`;
- allowlist version: `2026-07-29`;
- release marker: `v284`;
- custom domain: `laxhornet.mybranford.com`;
- 47 files and 6,255,246 bytes.

The allowlisted files were:

- `CNAME`
- `LaxHornet-launch-kit.zip`
- `access-and-trust.html`
- `app.html`
- `app.js`
- `assets/LHbanner.png`
- `assets/LHicon.png`
- `assets/club-family-recap.png`
- `assets/club-review-insight.png`
- `assets/club-review-start.png`
- `assets/honeycombblack.png`
- `assets/supabase.min.js`
- `coach-alignment.html`
- `event-operation-service.js`
- `index.html`
- `landing.css`
- `launch-kit/LaxHornet-admin-launch-checklist.pdf`
- `launch-kit/LaxHornet-overview.pdf`
- `launch-kit/LaxHornet-parent-handout.pdf`
- `launch-kit/LaxHornet-promo-demo-thumbnail.png`
- `launch-kit/LaxHornet-promo-demo.mp4`
- `launch-kit/admin-launch-checklist.html`
- `launch-kit/invite-message.txt`
- `launch-kit/launch-kit-readme.md`
- `launch-kit/laxhornet-overview.html`
- `launch-kit/laxhornet-qr.png`
- `launch-kit/parent-email.eml`
- `launch-kit/parent-email.html`
- `launch-kit/parent-handout.html`
- `launch-kit/short-text-message.txt`
- `launch-kit/social-captions.txt`
- `launch-kit/team-chat-posts.txt`
- `manifest.json`
- `next-focus-recommendation.js`
- `parent-experience.html`
- `player-development.html`
- `privacy.html`
- `program-value.html`
- `public-event-semantics.js`
- `rollout-guide.html`
- `runtime-config.js`
- `service-worker.js`
- `styles.css`
- `terms.html`
- `tracked-playing-time-service.js`
- `tracking-framework.html`
- `version.json`

Independent public verification fetched all 47 manifest entries. Every file,
including the 25-byte `CNAME`, returned HTTP 200 with exact manifest size and
SHA-256. All 548 tracked files outside the allowlist and 10 explicit internal
probes were non-public. The probes included `.git`,
`.github`, `.codex`, `.env`, `docs`, `review-evidence`, `supabase`, and `tools`
paths.

`service-worker.js` matched manifest SHA-256
`a9c6336a4b1ae14c3a6bcd9809873d81be4e259a9c88a5360833f8e1e8b7386e`
and declares cache `laxhornet-v284`. `version.json` matched manifest SHA-256
`af6375d110d3bfdc5d74c73acf9ecbece3e20c45f5d07483a689a2931eb2724e`
and contains `v284`.

Result: no public production file differed from the exact merged/reviewed
tree, and excluded repository material was absent.

## Migration provenance

Production migration history contains the expected repository sequence in
order and ends with:

| Version | Name | Ledger statements |
| --- | --- | ---: |
| `20260730134439` | `durable_game_tombstones` | 31 |
| `20260730151714` | `durable_game_tombstone_concurrency` | 13 |

No unexpected migration entry was found.

Confirmed limitations:

- `supabase_migrations.schema_migrations` stores `version`, `statements`, and
  `name`; it does not store an application timestamp or actor.
- The digits in each migration version are repository ordering identifiers,
  not evidence of the actual production application time.
- GitHub Actions history from `2026-07-30T13:00:00Z` through
  `2026-07-30T17:00:00Z` contains Pages, Docker build, regression, and Docker
  test runs, but no production migration workflow.
- Repository workflows run migrations only against disposable/local or
  Supabase Preview databases. They contain no production `db push`,
  `migration up`, or equivalent step.
- The PR's Supabase Preview check cannot account for production project
  `ulbmjcvnyznvmjgpstno`.

Unresolved attribution:

- the exact application timestamps;
- whether the two migrations were applied together or separately;
- the actor, CLI session, dashboard action, connector, or other process that
  applied them; and
- whether another non-migration action occurred in the same external session.

The available evidence does not distinguish CLI, dashboard, MCP, or another
route. No actor or route is inferred.

## Migration and live-definition identity

Repository SHA-256:

| Migration | SHA-256 |
| --- | --- |
| `20260730134439_durable_game_tombstones.sql` | `138e8edfdaa4b48747ceb63a66a0eae76f91c832b19dffa52914bdea45188900` |
| `20260730151714_durable_game_tombstone_concurrency.sql` | `619dbe275e50b8eef9e8b63a2dce1f850e4163e1259c05521604ffdcd3778aad` |

Migration history does not store the original migration-file bytes. Exact
SQL-byte identity therefore cannot be proven from the ledger alone.

To establish post-migration equivalence, the reviewed baseline plus both
reviewed migrations were applied to a disposable PostgreSQL 17 database.
Read-only production catalog snapshots were compared with that expected
database:

- all 11 tombstone-table columns, types, nullability rules, and defaults match;
- all 8 constraints match, including primary/unique keys, both foreign keys,
  three non-empty checks, and ordered timestamps;
- all 4 indexes match, including the partial team/player/deleted index;
- RLS is enabled and forced in both;
- the authenticated `SELECT` policy, role, command, and predicate match;
- the game-write trigger definition, function target, and enabled state match;
- all four function security modes and fixed empty search paths match;
- whitespace-normalized function bodies match exactly:

| Function | Normalized body MD5 |
| --- | --- |
| `lh_sync_private.reject_tombstoned_game_write()` | `c9009dd4c114e231a3b723b950d5b368` |
| `public.laxhornet_delete_game(text)` | `640f0bb104058cec2173e32eb3e3f43f` |
| `public.laxhornet_delete_game_durable(jsonb)` | `bea46ca8f028740270edcee42993ea0f` |
| `public.laxhornet_sync_game(jsonb)` | `c246aad4b18166dd1c7b261b229088dd` |

The trigger, guarded write RPC, and durable delete RPC each use the same
namespaced `hashtextextended('laxhornet:legacy-game:' || game_id, 0)`
transaction lock before reading the tombstone table.

Effective production privileges are least-privilege:

- `anon` has no tombstone-table access and no execution on the three public
  RPCs or private trigger helper;
- `authenticated` has tombstone `SELECT`, no insert/update/delete, execution
  on the guarded write, durable delete, and legacy wrapper, and no execution
  on the private helper;
- neither `anon` nor `authenticated` has usage or create on
  `lh_sync_private`;
- `service_role` retains its platform administration privileges on the public
  table and public RPCs, but has no usage/create or helper execution on the
  private schema/function.

Production tombstone count was `0`.

Result: the live catalog is definition-for-definition equivalent to the
reviewed expected post-R2-06A state for the bounded objects and privileges.
This supports correct intended state but does not retroactively authorize the
release.

## Preserve-versus-rollback decision

| Option | Compatibility and risk | Disposition |
| --- | --- | --- |
| Preserve and reconcile | Runtime and database are exact reviewed R2-06A counterparts. Both former P1 defects are remediated in this source. Zero tombstones means no currently observed durable-deletion population. Old clients remain protected by the server trigger. Public artifact and disclosure boundary are unchanged and exact. The remaining risk is unexecuted synthetic production verification and unresolved release-control attribution. | Preferred pending separately authorized bounded smoke. |
| Application rollback only | R2-05 calls the retained legacy delete wrapper and remains structurally compatible with the additive database. The trigger still blocks recreation of a tombstoned ID. However, rollback removes R2-06A client recovery, hydration suppression, durable receipt handling, and classified conflict behavior while leaving backend tombstones active. That can increase user-facing inconsistency for any deletion performed after rollback. | Not justified by current aligned evidence; requires separate authorization if selected. |
| Database rollback | The existing rollback refusal must not be bypassed. Zero tombstones is necessary but not sufficient to prove safety; migration provenance, concurrent use, and all rollback preconditions are not established. Reverse order and runtime coordination would be mandatory. | Unavailable in this task and not conclusively safe. |

Preserving the current aligned state avoids introducing a known mixed-version
behavior regression. It does not mark R2-06 production-verified.

## Incident assessment

Classification:
`Unauthorized release-control deviation with apparently aligned reviewed state`.

- Release governance: yes. The runtime advanced automatically without the
  tracked production-release authorization, the database advanced through an
  unattributed route, and the committed manifest still describes the rollback
  runtime and both migrations as pending.
- Security incident: not established. The reviewed runtime tree, public
  artifact allowlist, RLS, grants, function security modes, and live database
  definitions match expected state. Migration actor attribution remains open,
  so the release-control investigation is not treated as closed.
- Privacy incident: no evidence found. No private production row was inspected,
  the tombstone count is zero, the public artifact contains only allowlisted
  files, and no disclosure boundary difference was found.
- Data-loss or data-integrity incident: no evidence found. The tombstone count
  is zero and no production mutation was performed by this reconciliation.
  Synthetic production behavior is still unverified, so absence of evidence is
  not a production-verification pass.

## Manifest treatment

`release/laxhornet-release-manifest.json` was intentionally not changed.

The current manifest is a fail-closed production release-control contract, not
merely a historical observation log. Changing the application SHA, migration
application flags, required/pending sequences, or runtime dependency gate
would change production-preflight and deployment behavior. That is not a
documentation-only reconciliation.

A separate reviewed release-control remediation must define how the manifest
represents discovered-but-unauthorized production state without converting
that state into approval. Until then, the manifest contradiction remains an
intentional blocker.

### Subsequent R2-06B control remediation

R2-06B subsequently implements that separate remediation in a review-bound
feature branch. It records the observed runtime, both applied migrations, and
the verified catalog while retaining explicit false states for tracked
production authorization, synthetic verification, cleanup, and release
closeout. This does not alter the historical fact that the reconciliation task
itself left the manifest unchanged.

Implementation evidence:
`RELEASE_MANIFEST_RECONCILIATION.md`.

## Remaining gates

- authorize and execute the bounded synthetic plan in
  `SYNTHETIC_VERIFICATION_AUTHORIZATION_PLAN.md`;
- record all created, cleaned, and unavoidably retained synthetic records;
- rerun the production preflight only after a separately reviewed manifest
  remediation preserves the authorization distinction;
- obtain explicit authority for any further deployment, application rollback,
  database rollback, migration action, cleanup, or release closeout; and
- do not mark R2-06 production-activated or production-verified from this
  reconciliation.
