# V285 Production Deployment Reconciliation

## Disposition

`DEPLOYMENT SUCCEEDED — POST-DEPLOY VERIFICATION FAILED ON STALE EXPECTATION`

Final reconciliation disposition: `V285 PRODUCTION DEPLOYMENT RECONCILED — EVIDENCE REVIEW REQUIRED`.

## Authority and boundary

- Approval authority: David.
- Risk level: Level 3 — production deployment reconciliation, post-deploy verification, release evidence, and production-state recording.
- Approved and deployed SHA: `9e434e33534a1b348b19e2081b91d7e0724299fc`.
- Provider: GitHub Pages.
- Production target: `https://laxhornet.mybranford.com`.
- Workflow run: `31061426334`.
- Another deployment performed during reconciliation: no.
- Migration, backend, Supabase configuration, or production-data mutation authorized or performed: no.

## Automatic deployment and original workflow result

The merge to `main` automatically started the allowlisted Pages workflow at
`2026-08-06T00:59:47Z`. Its build job validated the exact source, release
identity, deployment contracts, allowlisted artifact, and artifact hashes. The
deployment job ran from `2026-08-06T01:00:15Z` through
`2026-08-06T01:00:23Z` and succeeded.

The overall workflow later concluded `failure` because
`tools/verify_pages_settings.mjs` used a single global expected marker of
`v284`. Its post-deploy check correctly observed live `v285` and rejected it
against that stale historical expectation. This was a post-deploy verifier
failure, not a deployment failure.

## Verifier correction

The Pages settings verifier now has distinct modes:

- settings-only pre-deployment validation does not assert a historical live
  marker;
- release-sensitive validation requires explicit runtime marker, cache marker,
  source SHA, and deployment-manifest evidence;
- live runtime and service-worker cache failures are classified separately;
- the deployment-manifest source SHA must match the explicit approved SHA.

The workflow now supplies explicit post-deploy expectations and runs the full
allowlisted production reconciler. A `main` push whose production marker
already matches performs verification without deployment. A production change
requires a separately authorized manual dispatch whose reviewed SHA, runtime,
cache, and authorization confirmation all match. This prevents the
reconciliation change from causing a second deployment.

## Production bundle reconciliation

Captured at `2026-08-06T02:13:34.138Z` using the immutable deployment-manifest
artifact uploaded by run `31061426334`:

- expected deployable files: 47;
- successful exact SHA-256 matches: 47;
- HTTP failures: 0;
- unexpected redirects: 0;
- defined content-type mismatches: 0;
- stale `v=284` query markers on v285 runtime files: 0;
- tracked-but-excluded paths verified unavailable: 601;
- additional sensitive/internal probes verified unavailable: 10;
- source SHA: `9e434e33534a1b348b19e2081b91d7e0724299fc`;
- result: pass.

Production runtime marker is `v285`. Production service-worker cache marker is
`laxhornet-v285`.

## PWA verification

Isolated browser verification captured at `2026-08-06T02:13:34.778Z`.

### Clean install

- Production loaded and reported `v285`.
- The v285 worker installed, activated, and controlled the client.
- Cache `laxhornet-v285` existed.
- Offline reload succeeded.
- No blank screen, reload loop, or fatal console/page error occurred.

### Existing v284 client

The harness served the reviewed v284 bundle and worker from baseline
`f5c8ca214ba3fcf5b30d5bf506517ad7a414fa37` on the production origin inside a
fresh isolated context, then released routing to the live production origin.

- The v284 worker controlled the initial client and v284 JavaScript was active.
- The live v285 worker installed and activated.
- Control transferred to v285.
- `laxhornet-v284` was removed and `laxhornet-v285` was populated.
- Reload used v285 application JavaScript with no stale `v=284` marker.
- Offline reload succeeded afterward.
- No persistent blank screen or reload loop occurred.

## Non-destructive production-local smoke

The production HTML and runtime were loaded in a fresh browser context with the
Supabase browser asset replaced by an inert local stub. No real account was
used. The context was destroyed after the checks.

- General screens: Home, Track, Review, Season, More, and Players & Teams passed.
- Live Share safe/unavailable state rendered.
- Active-game recovery: player, Q1 period, opponent, `Resume Live Game`, and
  navigation to the live tracker passed after reload.
- Saved-review alignment: the game owner became selected, Review showed the
  saved game, Season used that player, and ownership remained unchanged.
- Fatal console/page errors: 0.
- Hosted Supabase requests: 0.
- Production mutation requests: 0.

## Safety and rollback

- Production credentials used: no.
- Real account sign-in: no.
- Production Auth, game, player, team, event, token, or tombstone creation: no.
- Migration or backend/Supabase configuration change: no.
- R2-06 historical evidence opened or modified: no.
- Retained R2-06 tombstone modified: no.
- R2-07 started or authorized: no.
- Rollback decision: `Rollback not required`.

No bundle mismatch, critical asset failure, persistent blank screen, unsafe
service-worker transition, fatal navigation regression, mutation request, or
user-data risk was established.

## Final local regression

The final stabilized diff passed the complete canonical-plus-additive local
regression once: `55 passed, 0 failed`. The run included the explicit Pages
state verifier, deployment workflow contracts, v285 production reconciliation,
release hygiene, secret/host scan, and `git diff --check`.

## Limitations

- Verification covered Chromium in isolated desktop/mobile-sized contexts; it
  did not add cross-browser Safari or Firefox certification.
- The production-local fixtures deliberately replaced the Supabase client and
  therefore verify local UI behavior and request absence, not authenticated
  cloud synchronization.
- Exact-head CI and independent Level 3 review remain required before merge.
