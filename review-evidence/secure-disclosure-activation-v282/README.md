# Secure Disclosure Activation v282 Evidence

This package supports review of the stacked v282 activation candidate. It contains synthetic/local and authorized-preview evidence only. It is not evidence that production deployment has been approved or performed.

## Release relationship

- Base runtime candidate: `review/release-hygiene-v281` at `1f6be40f8e0362fed9460c354294093bf83c2793`
- Database candidate: `review/supabase-production-candidate` at `ad96e428d675fba8fac7752fd108ea06827fa0ad`
- Activation branch: `review/secure-disclosure-activation-v282`
- Production project: intentionally not contacted during rehearsal

## Activation design

`runtime-config.js` is a static, non-secret artifact loaded before `app.js`. It preserves previously supplied non-secret runtime configuration and explicitly enables:

- `publicLiveShareRpc`
- `liveShareTokenRpc`
- `exportAuditRpc`

The artifact contains no host, key, preview reference, credential, or dynamic remote code.

## Local executable proof

- `script-order-proof.json`: observed deferred execution order
- `service-worker-cache-proof.txt`: stale-cache and update-path results
- `local-browser-results.txt`: 390x844 browser assertions
- `local-network-request-inventory.json`: sanitized local request paths and hosted-request counts
- `public-payload-sample.json`: synthetic public-safe payload
- `token-lifecycle-evidence.json`: create/read/revoke outcomes without recording the token
- `export-audit-evidence.json`: authorized and rejected synthetic audit outcomes
- `failure-mode-evidence.json`: missing config, failed RPC, offline tracking, and reconnect outcomes
- `browser/`: screenshots of secure viewing, bounded missing-config behavior, and update availability

## Managed preview proof

The permitted managed preview rehearsal completed with temporary uncommitted values and synthetic accounts:

- `managed-preview-results.json`: 57 passing preview assertions and no failures;
- `managed-preview-network-inventory.json`: sanitized browser request inventory with three preview RPC requests and zero production-host requests;
- `managed-preview-public-payload.json`: exact public game/event allowlist sample;
- `managed-preview-token-lifecycle.json`: create, poll, neutral-failure, and revoke outcomes without the reusable token;
- `managed-preview-export-audit.json`: team-admin, team-coach, parent, cross-player, cross-team, and private-backup outcomes;
- `managed-preview-cleanup-proof.json`: post-test reset proof with zero synthetic Trust Spine rows and zero synthetic Auth users;
- `browser/04-managed-preview-live-share.png`: 390x844 rendering from the real preview RPC;
- `combined-regression-output.txt`: raw combined local integration output, 23 groups passed and zero failed.

The browser executed `runtime-config.js` before `app.js`, reported all three secure flags active, polled only `lh_public_live_share_game`, and made no ordinary `/games` or `/events` request. Token revocation disabled the public view on the next read. Unknown, expired, and previously revoked tokens returned the same neutral unavailable response.

No password, JWT, publishable key, service-role key, raw reusable token, production credential, note, tag, or real youth record belongs in this package.

## Safety conclusions

- Missing activation configuration produces a bounded temporary-unavailable state for secure disclosure actions.
- Failed public RPC calls do not fall through to anonymous table reads.
- Local tracking remains usable when secure disclosure is unavailable.
- Updated offline clients retain local tracking and recover secure features after reconnecting.
- Legacy fallback source remains present for a later, separately authorized cleanup, while v282 tests prove normal activated execution does not reach it.

## Production decision

See `docs/SECURE_DISCLOSURE_V282_CUTOVER.md`. The current candidate requires separate approvals for the database migration, v281 deployment, v282 activation, and any eventual legacy-fallback removal.
