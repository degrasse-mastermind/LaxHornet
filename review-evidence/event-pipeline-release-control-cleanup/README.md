# Event Pipeline and Release Control Cleanup

Status: draft review evidence for LaxHornet v283.

Starting heads:

- Database candidate: `ad96e428d675fba8fac7752fd108ea06827fa0ad`
- Pre-cutover runtime: `f4ead54b44fcb5710fe4ed3eed39ab5f1694def4`
- Secure activation: `7cf58df9a43ce235fc6068bd4c50549e05906de4`

## Results

- Local application/browser contract: 61/61 passed.
- Full local regression runner: 22 command groups, 0 failures.
- Managed-preview contract: 76/76 passed.
- Managed-preview hosted requests: 59 to the authorized preview, 0 to foreign hosted projects, 0 to production.
- Synthetic cleanup: 0 Trust Spine fixture rows and 0 synthetic Auth users remain.
- Capability response: schema v1; Trust Spine events, secure Live Share, and export audit ready; personal-game sharing disabled.
- Database lint: the new capability migration is clean. The advisor still reports one pre-existing ambiguous `id` reference in `public.laxhornet_request_team_player_access`; this cleanup does not modify that legacy request RPC.

## Package index

- `architecture-boundary.md`
- `event-operation-contract.md`
- `game-scope-decision.md`
- `capability-handshake-contract.md`
- `release-manifest-example.json`
- `regression-output.txt`
- `browser-results.md`
- `sanitized-network-inventory.md`
- `administrative-health-sample.json`
- `personal-game-proof.json`
- `offline-retry-proof.json`
- `cleanup-proof.md`
- `remaining-legacy-dependencies.md`
- `production-host-request-count.txt`
- `advisor-output.txt`
- `managed-preview-*.json`
- `browser/*.png`

This package contains synthetic and sanitized evidence only. It contains no credentials, raw tokens, private notes, tags, or real youth records. Production project `ulbmjcvnyznvmjgpstno` is outside the test boundary.
