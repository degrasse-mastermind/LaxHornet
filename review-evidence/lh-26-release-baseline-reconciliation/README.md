# LH-26 release-control reconciliation evidence

Status: implementation evidence for exact-PR-SHA review. No release,
deployment, runtime activation, database action, or production mutation was
performed.

## Independently reproduced baseline

Clean `main` at `3b866d35d48fc2d54837952241de237d785523cf`
failed before this branch changed any file:

- `tools/test_update_release.mjs`: 16 root public-page asset query markers
  still referenced v285 although `version.json` and the service worker were
  already v288.
- `tools/test_post_r206_stabilization_release.mjs`: three assertions treated
  historical v285 evidence as the current runtime.
- `tools/test_r207_forward_migration_b_activation.mjs`: the immutable reviewed
  R2-07 runtime set was compared to current v288 `app.html`, whose authorized
  auth/cache releases changed after activation review.

## Reconciliation

- Root public pages now reference the already-current v288 manifest and shared
  landing stylesheet. No release or cache marker was advanced.
- v285 evidence is read with `git show` from its recorded deployed SHA.
- The R2-07 activation runtime hash set is read with `git show` from exact
  reviewed runtime SHA `844db75ef6d0d42af474290dd0f160679bf07af8`.
- Current v288 runtime and auth/activation invariants are still checked from the
  working tree.
- Historical evidence and the release manifest are unchanged.

## Focused result

```text
Update release checks passed for v288.
17/17 post-R2-06 stabilization release tests passed.
R2-07 Forward Migration B disposable activation certification: PASS (54 checks)
PASS: disposable activation certification left zero container residue
Release manifest valid for v288 (combined ref HEAD).
10/10 release-manifest reconciliation tests passed.
16/16 R2-06R release closeout tests passed.
23/23 Pages deployment contracts passed.
7/7 Pages settings verifier tests passed.
```

## Independent review requirements

At the exact PR SHA, confirm:

1. the v285 and R2-07 historical files hash to the recorded values when read
   from their exact historical SHAs;
2. changing either historical ref or expected hash fails the tests;
3. current v288 application/auth/activation assertions still read the working
   tree and fail on current drift;
4. all root HTML query markers governed by `test_update_release.mjs` match
   `version.json`;
5. `version.json`, `service-worker.js`, the release manifest, migrations,
   runtime configuration, and deployment workflows are unchanged.

## 2026-08-12 bounded remediation

Independent review of head `60deefaa53ad7571e6b8f7643d6e9f52a8c0e0bf`
failed because the documented canonical regression and release-control tools
still invoked container-backed tests and a local database stack, while green
Preview migration application did not independently establish authenticated
server concurrency and exactly-once behavior.

The bounded remediation:

- removes all container-backed test invocations from the canonical regression;
- retains their historical bytes and evidence without invoking them;
- makes Forward Migration B use its no-container exact-binding mode;
- makes release preflight and release verification portable-only;
- adds an active-path invocation-graph guard to CI and the canonical runner;
- records the automatic isolated Preview plus independent authenticated
  multi-session matrix as a non-substitutable migration-PR gate.

This implementation record is not an independent review. The new exact head
requires a fresh Level 3 reviewer disposition before merge.

Focused remediation results before publication:

```text
PASS: 8 active control files contain no container/local-stack command.
PASS: 57 canonical regression tool invocations are container-free.
PASS: authenticated isolated-Preview adversarial evidence remains a non-substitutable Level 3 gate.
22/22 phase-aware preflight tests passed.
R2-07 Forward Migration B no-container binding verification: PASS (5 checks)
R2-07B controlled preview tests: 37/37 passed
V288 portable release verification: PASS
Complete canonical-plus-additive portable regression: 65/65 passed
```
