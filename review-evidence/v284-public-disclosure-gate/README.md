# v284 public-disclosure gate evidence

Date: 2026-07-27

Production project: `ulbmjcvnyznvmjgpstno`

Approved `main` SHA: `1221f418c1e005606d54c545148944f9ec69f132`

Release: `v284`

Current disposition: `BLOCKED — DISCLOSURE FIXTURE HARNESS FAILURE`

## Repository identity

- Workspace: isolated rollout worktree
- Branch during preflight and gate: `main`
- `HEAD`: `1221f418c1e005606d54c545148944f9ec69f132`
- `origin/main`: `1221f418c1e005606d54c545148944f9ec69f132`
- PR #28: merged at the approved SHA
- Tracked tree before evidence creation: clean
- Runtime, migration, release-marker, manifest, and production configuration changes: none

## Ephemeral dependency preparation

Command:

```powershell
node tools/run_release_preflight.mjs --prepare --release v284 --phase production --approved-rollout-sha 1221f418c1e005606d54c545148944f9ec69f132
```

Result: exit 0.

- Disposable root: `C:\Users\user\AppData\Local\Temp\laxhornet-release-preflight\31098ee9b724`
- Repository `node_modules`: temporary junction to the disposable dependency directory
- PGlite: `@electric-sql/pglite@0.5.4`
- Playwright: `playwright@1.61.1`
- Browser support: approved local Chrome executable found
- Global installation: none
- Repository package manifest or lockfile changes: none
- Tracked-file changes: none
- Credentials persisted: none

Cleanup command:

```powershell
node tools/run_release_preflight.mjs --cleanup
```

Cleanup result: exit 0. The dependency junction and disposable dependency root were removed. No local Supabase stack was running, so local-stack cleanup was not required.

## Production preflight

Command:

```powershell
node tools/run_release_preflight.mjs --check --release v284 --phase production --approved-rollout-sha 1221f418c1e005606d54c545148944f9ec69f132
```

Result: exit 0 — `V284 PRODUCTION PREFLIGHT PASSED`.

Passed gates included:

- exact repository root, `main`, approved `HEAD`, and clean tracked tree;
- release, pre-release base, and approved merge ancestry;
- release incorporation and manifest identity;
- migration and rollback identity;
- pgTAP and historical-migration identity;
- app marker, service-worker cache, and asset query versions;
- public Live Share SQL identity, containment, and disclosure checks;
- PGlite-dependent checks;
- Playwright-dependent checks;
- secret and production-host scans;
- Git diff hygiene;
- approved runtime/tool versions.

## Read-only production reconfirmation

Production contact began only after the complete preflight passed.

- Project identity: `ulbmjcvnyznvmjgpstno`
- Migration `20260727000000`: present exactly once
- Tracked-time tables, invoker-rights view, functions, immutable triggers, and indexes: present
- Forced RLS: enabled on all three tracked-time tables
- Anonymous and authenticated direct tracked-table privileges: absent
- All nine tracked-time RPCs: resolved
- Anonymous tracked-time RPC calls: denied with `42501`
- Anonymous direct tracked-table/view calls: denied with `42501`
- `PGRST202`: not observed

## Public-disclosure gate stop

The gate stopped while creating the isolated synthetic fixture. PostgREST rejected a lifecycle-event batch before any synthetic sign-in, tracked-time operation, Live Share token, public payload read, or browser navigation:

```text
PGRST102: All object keys must match
```

Cause: the temporary harness submitted objects with different key sets in one PostgREST insert batch.

This is a harness-input failure. It is not evidence of a production disclosure defect, and it does not authorize a pass. The stop-at-first-failed-gate rule prevented repair and resumption.

The in-app browser controller also failed to initialize before navigation because its local kernel asset path was unavailable. No production browser request was made through that controller.

## Synthetic scope and compensating cleanup

Partially created before the stop:

- two synthetic adult Auth users;
- one synthetic team;
- one synthetic roster player;
- one synthetic completed game;
- two synthetic legacy events;
- one admin membership and one tracker membership;
- one synthetic player claim;
- Trust Spine team, player, and game scopes;
- one team-admin grant, one coach grant, and one accepted invitation.

Never created:

- tracked game-clock state;
- participation logical events or operations;
- ordinary Trust Spine performance events;
- Live Share tokens;
- export-audit events;
- pending or conflicted operations.

Compensating cleanup:

- revoked both grants through append-only lifecycle records;
- removed all mutable synthetic legacy rows;
- deleted both synthetic Auth users;
- confirmed zero synthetic Auth sessions;
- confirmed zero active grants;
- confirmed zero active Live Share tokens;
- confirmed zero tracked clock rows and participation operations;
- confirmed zero pending or conflicted event operations.

Read-only cleanup proof:

| Check | Count |
|---|---:|
| Auth users | 0 |
| Auth sessions | 0 |
| Legacy teams | 0 |
| Legacy players | 0 |
| Legacy games | 0 |
| Legacy events | 0 |
| Team members | 0 |
| Player claims | 0 |
| Active Live Share tokens | 0 |
| Active grants | 0 |
| Pending/conflicted event operations | 0 |
| Participation operations | 0 |
| Game-clock states | 0 |

Append-only history retained by design:

| Retained evidence | Count |
|---|---:|
| Team scopes | 1 |
| Player scopes | 1 |
| Game scopes | 1 |
| Grants | 2 |
| Grant lifecycle events | 6 |

These retained records contain synthetic labels only and have no active user, session, grant, token, mutable game, or public route.

## Disclosure surface inventory

The following required surfaces were not executed after the fixture-creation stop and therefore are not classified as passed:

| Surface | Result |
|---|---|
| Public Live Share RPC | Not verified |
| Token-based public view | Not verified |
| Public game payload | Not verified |
| Public event payload | Not verified |
| Public recap | Not verified; actual production behavior was not reached |
| Selected/public-facing CSV | Not verified |
| Anonymous application network inventory | Not captured |
| Legacy public fallback | Not verified |
| Unknown/expired/revoked/invalid token equivalence | Not verified |
| Stale cached payload after revocation | Not verified |

Read-only permission probes completed before the fixture stop, but they do not substitute for the missing synthetic end-to-end disclosure checks.

## Forbidden-field contract

The unexecuted public checks were prepared to reject any disclosure of:

- game-clock state, revisions, running/paused/elapsed/remaining time;
- Player In/Out and participation/logical/operation identifiers;
- active shifts, boundaries, durations, counts, averages, longest shift, totals, and game-share percentage;
- corrections, reasons, tombstones, deleted evidence, manual/system-close metadata;
- recovery/completeness/Estimated/Needs review state;
- synchronization, retry, conflict, authority, or private RPC metadata.

Because the synthetic end-to-end checks did not run, this contract is not marked passed for production.

## Release and data disposition

- Production contacted: yes, after preflight
- Production modified: yes, synthetic fixture setup only; all mutable rows and users were removed
- Frontend deployed: no
- Migration applied: no
- Runtime code changed: no
- Real youth, family, player, team, or user data read or modified: no
- Raw reusable tokens created or retained: no
- Keys, JWTs, passwords, authorization headers, or real identifiers in this evidence: no

## Known limitations

- The public-disclosure gate is incomplete because fixture preparation stopped on `PGRST102`.
- No actual production Live Share DOM, download, recap, network, or post-revocation cache behavior was observed.
- The successful preflight and read-only authorization probes remain valid but are not a substitute for the required synthetic disclosure evidence.

## Exact next gate

Repair the synthetic fixture harness batch shape, start again from Phase 7 with a new isolated synthetic fixture, and complete the production public-disclosure gate.

`Deploy exact approved v284 frontend and verify release activation` is not authorized until the public-disclosure gate passes.

## LH-00 Command Center update

PR #28 merged at `1221f418…`, preserving the approved v284 authority contract. The authorization gate passed, approved ephemeral PGlite `0.5.4` and Playwright `1.61.1` were restored, and the exact production preflight passed. The production public-disclosure gate is incomplete because the synthetic fixture harness received PostgREST `PGRST102` before tokens, tracked operations, public reads, or browser navigation. Compensating cleanup removed all mutable synthetic rows, Auth users, and sessions; two revoked grants, six lifecycle events, and three inert Trust Spine scope snapshots remain as append-only synthetic history. The frontend remains undeployed. Next gate: repair the harness and rerun the production public-disclosure gate from Phase 7.

---

## 2026-07-28 fixture-shape repair attempt

Disposition: `BLOCKED — DISCLOSURE FIXTURE HARNESS FAILURE`

### Approved state

- Branch: `main`
- `HEAD`: `1221f418c1e005606d54c545148944f9ec69f132`
- `origin/main`: `1221f418c1e005606d54c545148944f9ec69f132`
- Tracked working tree before the attempt: clean
- Existing untracked evidence: preserved
- Prior production preflight: fully passed
- Production contacted during this repair attempt: no

### Exact original mismatch

Endpoint:

```text
POST /rest/v1/lh_grant_lifecycle_events
```

The stopped harness submitted two coach lifecycle records in one JSON array.

| Record type | Original keys present | Keys missing | Intended database defaults | Corrected shape |
|---|---|---|---|---|
| Coach `issued` | `id`, `grant_id`, `sequence`, `event_type`, `actor_user_id`, `actor_grant_id`, `occurred_at` | `related_grant_id`, `reason` | `related_grant_id = null`; `reason = ''` | All nine canonical keys present; sent individually |
| Coach `accepted` | `id`, `grant_id`, `sequence`, `event_type`, `actor_user_id`, `occurred_at` | `actor_grant_id`, `related_grant_id`, `reason` | `actor_grant_id = null`; `related_grant_id = null`; `reason = ''` | All nine canonical keys present with explicit null/default values; sent individually |

The only key-set difference inside the malformed batch was `actor_grant_id`. PostgREST rejected the array with `PGRST102` before applying it.

### Corrected strategy

The temporary harness used ordered individual inserts for lifecycle events. Every record was normalized to this canonical key set before a request:

```text
actor_grant_id
actor_user_id
event_type
grant_id
id
occurred_at
reason
related_grant_id
sequence
```

Individual insertion was selected so lifecycle sequence `1` is confirmed before sequence `2`, while explicit nullable/defaultable fields keep every payload reviewable.

### Local validator

The external temporary harness added `assertHomogeneousBatchShape`.

Passed checks:

- historical malformed two-record payload rejected;
- sorted key lists compared exactly;
- empty batches rejected;
- `undefined` rejected recursively;
- unexpected/non-synthetic fixture identifiers rejected;
- secret- or reusable-token-shaped content rejected;
- expected table required explicitly;
- each corrected individual record matched the canonical nine-key set;
- no raw secret or token was emitted.

Validation result: passed.

### Local PostgREST reproduction

Environment:

- Docker Engine `29.6.2`
- Supabase CLI `2.109.1`
- documented reduced local stack
- all committed migrations, including `20260727000000`, applied locally
- production was not contacted

The local validator rejected the old payload before any request. Two synthetic adult Auth users were then created as prerequisites for the corrected PostgREST lifecycle test.

The first legacy prerequisite seed failed before the corrected lifecycle records were submitted:

```text
HTTP 403
code: 42501
message: permission denied for table teams
hint: Grant the required privileges to the current role with:
      GRANT INSERT ON public.teams TO service_role;
```

This local schema intentionally has no direct `service_role` Data API insert privilege on `public.teams`. The attempt did not change the local or production schema to bypass that boundary.

Required fail-fast disposition:

```text
BLOCKED — DISCLOSURE FIXTURE HARNESS FAILURE
```

### Cleanup after local failure

- Synthetic local Auth users created: 2
- Synthetic local Auth users deleted: 2
- Synthetic local Auth users remaining: 0
- Mutable fixture rows created: 0
- Lifecycle rows created: 0
- Local Supabase stack: stopped with `--no-backup`
- Temporary dependency or configuration changes: none
- Production data or configuration changes: none

### Gates not rerun

Because the focused local PostgREST gate failed, the following were not started:

- dependency preparation and exact production preflight rerun;
- production synthetic fixture creation;
- Live Share and token lifecycle checks;
- public game/event payload checks;
- public recap classification;
- selected CSV download;
- anonymous production browser network inventory;
- stale payload, legacy fallback, and adversarial production checks.

The earlier successful production preflight and read-only authorization probes remain historical evidence but do not convert this repair attempt into a disclosure pass.

### Current next gate

Establish an approved disposable local PostgREST fixture-seeding path that can create the prerequisite synthetic authorization rows without changing production grants or product migrations. Then rerun Phase 5 from a clean local stack.

`Deploy exact approved v284 frontend and verify release activation` remains unauthorized.

## 2026-07-28 local-only seeding resolution

This section supersedes the historical stopped-harness disposition below.

Chosen mechanism: guarded direct `psql` prerequisite seeding into a distinct,
temporary Supabase project named `laxhornet-v284-disclosure-local`. The harness
copies `supabase/` into the system temporary directory, rewrites only the copied
project ID, refuses non-loopback endpoints or a production-like project/host,
creates only `v284-disclosure-local-` fixtures, and tears down the stack with
`--no-backup`.

Results:

- environment and synthetic-data guard contracts: 16/16 passed;
- phase-aware containment: 33/33 passed, including rejection of a deliberately
  added `tools/v284_local_disclosure_fixture.sql` release artifact;
- two synthetic adult Auth users, one team, one player, one game, two ordinary
  events, nine tracked-time operations, scopes, grants, and canonical lifecycle
  records seeded successfully;
- public payload contained only the ten allowlisted game keys and eight
  allowlisted event keys, with two ordinary events and zero forbidden matches;
- nine anonymous private tracked-time RPCs and four private tables/views
  returned `401 / 42501`;
- legacy `games` and `events` fallback probes were denied;
- mobile browser Live Share showed `Watching live`, then
  `Shared game unavailable` after revocation;
- selected CSV and the private recap preview contained no tracked-time fields;
- cleanup left zero local Auth users, legacy teams/games/events, active tokens,
  active grants, or pending/conflicted operations;
- append-only local history was retained only until disposable stack teardown:
  three scopes, two revoked grants, six lifecycle records, and eight accepted
  tracked-time operations;
- the disposable stack and temporary project were removed;
- full local regression: 32/32 groups passed.

Production contact during this local repair: no. Production permissions,
migrations, RLS, grants, authorization functions, release manifest, public Live
Share SQL, and runtime code changed: no.

Sanitized machine-readable proof is in `local-disclosure-result.json`; complete
regression output is in `full-local-regression.txt`.

### Historical LH-00 Command Center entry

Approved SHA `1221f418…` remains unchanged and the prior full production preflight remains passed. The original fixture defect was isolated to a heterogeneous `lh_grant_lifecycle_events` batch and corrected with canonical validation plus ordered individual inserts. Local validation passed, but the disposable PostgREST reproduction stopped on a prerequisite `teams` insert denied by the local schema's absent `service_role` grant (`42501`). No production contact or mutation occurred in this repair attempt. Both partial local Auth users were deleted and the local stack was removed. Prior inert append-only production history remains unchanged. The frontend remains undeployed. Next gate: establish an approved local-only fixture seed path and rerun the focused local PostgREST gate.
