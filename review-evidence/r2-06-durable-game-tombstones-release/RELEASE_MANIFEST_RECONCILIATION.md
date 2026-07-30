# R2-06B release-manifest reconciliation

Date: 2026-07-30

Risk: Level 3 — production release controls, migration-state representation,
deployment gating, and incident remediation

Status: manifest reconciliation implemented; synthetic production verification
and release closeout remain blocked

## Authority and non-mutation boundary

R2-06B records the production facts already established in
`PRODUCTION_STATE_RECONCILIATION.md`. It does not independently re-observe,
authorize, deploy, apply, roll back, or mutate that state.

This task did not deploy or roll back an application, apply or roll back a
migration, change Supabase configuration or database objects, create or alter
an Auth user, run synthetic production verification, or create, inspect,
modify, or delete production data.

## Reconciled machine state

The release manifest now records:

- production application source
  `2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`;
- Pages run `30559099199`;
- both R2-06 migrations present in the required order;
- both bounded packages as `production_present_reconciled`;
- exact, unchanged forward, rollback, and pgTAP SHA-256 identities;
- no expected pending production migration;
- the runtime/database dependency as satisfied;
- bounded catalog verification complete; and
- the incident classification and unresolved migration actor/time/route
  attribution.

`production_present_reconciled` records observed presence. It does not assert
that tracked production authorization existed or grant retroactive approval.
Each package therefore keeps
`productionAuthorizationRecorded: false`.

## Independent state gates

`r206ReleaseControl` keeps the following questions distinct:

1. implementation reviewed;
2. runtime deployed;
3. migrations applied;
4. bounded production catalog verified;
5. synthetic verification authorized;
6. synthetic verification completed with reviewed evidence;
7. cleanup completed with reviewed evidence; and
8. release closeout approved.

The first four states are true from the reviewed reconciliation. The final
four remain false. The production preflight accepts the reconciled
runtime/database dependency but still fails the R2-06 closeout-readiness row
because authorization, synthetic behavior evidence, and cleanup evidence are
absent.

The gate rejects:

- either migration missing;
- an old or mismatched runtime;
- reversed migration order;
- any altered reviewed forward, rollback, or pgTAP identity;
- a synthetic-complete marker without reviewed evidence;
- cleanup-complete without reviewed evidence; and
- release-closeout approval before all prerequisites are complete.

Test-only fixtures prove that a future state with reviewed authorization,
synthetic behavior, and cleanup evidence may become closeout-ready. They are
not production evidence and do not change the committed production state.

## Files and controls

Release-control implementation:

- `release/laxhornet-release-manifest.json`
- `tools/release_manifest_state.mjs`
- `tools/validate_release_manifest.mjs`
- `tools/run_release_preflight.mjs`

Characterization and aggregate/CI wiring:

- `tools/test_release_manifest_reconciliation.mjs`
- `tools/test_release_preflight_phase_aware.mjs`
- `tools/run_v283_local_regression.mjs`
- `.github/workflows/laxhornet-regression.yml`
- `.github/workflows/docker-tests.yml`

Durable governance records:

- `TICKETS.md`
- `REPO_CURRENT_STATE.md`
- `docs/LAXHORNET_ROLLOUT_CHECKLIST.md`
- `PRODUCTION_STATE_RECONCILIATION.md`
- this file

No migration, rollback, or pgTAP file changed.

## Remaining gates and limitations

- Synthetic production verification is not authorized and has not run.
- No synthetic cleanup evidence exists.
- R2-06 is not production-verified or release-complete.
- Migration application timestamps, actor, route, and whether the migrations
  were applied together remain unresolved.
- The manifest reconciliation preserves observed state; it does not approve
  the unauthorized advancement retroactively.
- Exact-PR-SHA independent Level 3 review remains required before merge.

## Local verification

Focused results:

- release-manifest reconciliation characterization: `8/8`;
- phase-aware preflight: `22/22`;
- phase-aware containment: `33/33`;
- Pages deployment contracts: `21/21`;
- team-members release-manifest ordering: `13/13`;
- durable tombstone migration and reverse-order rollback: `13/13`;
- durable tombstone PostgreSQL concurrency: `8/8`;
- release-manifest validator: pass, with runtime/catalog reconciled and
  closeout blocked; and
- changed JavaScript syntax and `git diff --check`: pass.

The complete canonical-plus-additive local regression passed `43/43` after the
final shared release-control diff stabilized. Draft-PR CI and exact-PR-SHA
independent Level 3 review remain outstanding.
