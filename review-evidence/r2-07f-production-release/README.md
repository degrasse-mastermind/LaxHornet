# R2-07F Production Release Record

Status: `R2-07F STOPPED PRE-ACTIVATION — PRODUCTION REMAINS SAFE`

Observed: `2026-08-11T06:26:15.045731Z`

## Certified source

- Product source SHA: `b7269194a4ce8b9068b0d46c44d840efc4048c69`
- Product tree: `f2f0a34f448481ec8856e346d415e1a1e7bde354`
- Evidence SHA: `c2726b0c1cd979a7af2b04bc9a0a25865f4636ea`
- Evidence PR: `#72`
- Independent exact-head review: `PASS`
- Release branch: `release/r2-07f-production`

PR #72 changes evidence, governance, certification tests, and an
evidence-only Vercel builder. The allowlisted production product files are
byte-identical between the product source and evidence SHA. The exact deployable
product source therefore remains `b7269194...`, not the evidence commit.

## Production targets

- Supabase: project `ulbmjcvnyznvmjgpstno`, name `LaxHornet`, region
  `us-east-2`, PostgreSQL `17.6`, status `ACTIVE_HEALTHY`.
- Canonical frontend: GitHub Pages workflow deployment from repository `main`.
- Production domain: `https://laxhornet.mybranford.com`.
- Pages custom domain/HTTPS: configured, certificate approved, HTTPS enforced.
- Current Pages deployment: deployment `5771873791`, source
  `9e434e33534a1b348b19e2081b91d7e0724299fc`, prior run `31061426334`.
- Vercel integration: team `team_gZXn5iVxzFdS97thE2Af4hYP`, project
  `prj_M6fl5dGasEk2dYAl8eH7nsblEpPk` (`lax-hornet`). It is used for previews;
  it is not the canonical production domain. The automatic production-target
  build for `b7269194...` is `ERROR`, while PR #72 preview is `READY`.

## Read-only production preflight

Result: `R2-07F PRODUCTION PREFLIGHT FAIL`

Checks that passed:

- Remote `main`, local `main`, and release product source are exact
  `b7269194...`.
- Production migration history contains the complete certified 17-migration
  sequence exactly once; there is no pending certified schema migration.
- All required R2-07 relations and six public v2/conflict RPCs exist.
- Every inspected R2-07 relation has RLS and FORCE RLS enabled.
- Required v2/conflict RPCs are executable by `authenticated` and not `anon`.
- `r207_preview_control.preview_enabled` is `false`.
- Retention execution is `false` and no retention duration is configured.
- All aggregate R2-07 operation, attempt, field-change, conflict, resolution,
  event-version, event-tombstone, clock-command, and clock-batch counts are `0`.
- No current GitHub workflow is in progress. One unrelated historical dynamic
  Pages run from 2026-07-23 remains queued and was not touched.
- Production remains v285 / `laxhornet-v285`; the current public
  `runtime-config.js` contains no R2-07 client activation flags.

Mandatory failure:

1. The repository design requires a separately authorized Forward Migration B
   to enable server v2 writes, replace `laxhornet_sync_game(jsonb)` with a stable
   `client_upgrade_required` stub, and revoke legacy/direct mutation authority.
   No such migration exists in the certified 17-migration inventory.
2. The certified `runtime-config.js` hard-codes
   `r207bControlledPreview`, `r207cVersionedEventCorrections`,
   `r207dConflictResolution`, and `r207ClockCommandBatch` to `false`.
3. Production read-only inspection confirms the current v1 function is not an
   upgrade-required stub and legacy/direct game and event mutation privileges
   remain available in the expected pre-activation state.
4. Creating activation SQL or changing the client flags is a source/runtime
   change. The owner authorization says that requires a new exact-head review
   before production execution. No reviewed activated artifact was supplied.

This mismatch exists before the dormant-runtime deployment. Deploying the
certified dormant client could not make the later atomic cutover executable,
so the release stopped before the first production mutation.

## Backup and recovery checkpoint

Status: `NOT REACHED`.

The current production deployment identifier, runtime marker, cache marker,
and migration baseline were recorded read-only. Database backup/PITR capability
was not claimed because the release stopped at preflight. No post-activation
rollback claim is made. The approved design remains fail-closed or
R2-07-compatible forward recovery; legacy unversioned write authority must not
be restored after a future activation.

## Commands that could mutate production

None were executed.

The repository-supported dormant Pages deployment would have been:

```powershell
gh workflow run pages-deployment.yml --repo degrasse-mastermind/LaxHornet --ref main -f deployment_ref=b7269194a4ce8b9068b0d46c44d840efc4048c69 -f deployment_sha=b7269194a4ce8b9068b0d46c44d840efc4048c69 -f release_marker=v285 -f cache_marker=laxhornet-v285 -f deployment_authorized=true
```

It was not run. No production migration command is required because all 17
certified migrations are already recorded. There is deliberately no activation
command in this record: inventing one would bypass the failed gate.

## Stage disposition

1. Exact release SHA/tree: `b7269194...` / `f2f0a34f...`.
2. Production targets: positively identified.
3. Read-only preflight: `FAIL` on missing reviewed activation artifact.
4. Backup/recovery checkpoint: not reached.
5. Migrations applied: none; all 17 were already present.
6. Dormant runtime deployment: not executed.
7. Compatibility/atomic-cutover gate: failed before deployment.
8. Atomic activation: not executed.
9. v1 shutdown/upgrade-required: not executed; current v1 remains active.
10. v2 metadata: not production-smoked; server capability remains off.
11. Event: not production-smoked; server capability remains off.
12. Clock: not production-smoked; server capability remains off.
13. Conflict resolution: not production-smoked; server capability remains off.
14. Tombstone/security: catalog-only checks passed; no mutation test executed.
15. Stale client: not executed.
16. Mobile/service worker/cache: current v285 markers recorded; no R2-07 deploy.
17. Production smoke: not executed.
18. Synthetic cleanup: not applicable; no fixture was created.
19. Observability: no post-release window exists; no production change occurred.
20. Final production URL/version: `https://laxhornet.mybranford.com`, v285,
    source `9e434e33534a1b348b19e2081b91d7e0724299fc`.
21. Evidence path: `review-evidence/r2-07f-production-release/`.
22. Final status: `R2-07F STOPPED PRE-ACTIVATION — PRODUCTION REMAINS SAFE`.

## Local verification

- Certified inventory cross-check against the R2-07E V2 manifest: `PASS`.
- JSON parse, credential-shaped secret scan, and `git diff --check`: `PASS`.
- Complete canonical-plus-additive local regression: `69 passed, 0 failed`.
- The final regression used the existing temporary dependency cache through a
  local checkout junction; no package was installed and the junction was
  removed afterward.

## Required next gate

Create a bounded activation artifact and activated client configuration on a
new exact head, prove the no-dual-authority transaction and stale-client
behavior in disposable infrastructure, obtain independent Level 3 PASS, then
issue fresh production authorization and rerun the read-only preflight. Do not
reuse this preflight as execution authority.
