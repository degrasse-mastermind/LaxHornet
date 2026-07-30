# Allowlisted GitHub Pages Deployment Evidence

Ticket: `LH-DEV-005`
Infrastructure branch: `codex/infra-allowlisted-pages-deployment`

This directory contains sanitized evidence for retiring repository-root Pages
publishing. No real player, family, team, or youth data is used.

## Pre-rollout evidence

- `current-exposure-http-results.json`: read-only HTTP status/content-type
  inventory proving that known internal files were retrievable under the
  legacy `main` `/` source.
- `docs/deployment/LAXHORNET_CURRENT_PAGES_EXPOSURE_AUDIT.md`: categorized
  exposure audit and required dispositions.
- `release/pages-deployment-allowlist.json`: machine-readable affirmative
  production boundary.
- `.pages-artifact-metadata/pages-deployment-manifest.json`: generated,
  deterministic local/CI manifest; excluded from Git and uploaded as workflow
  evidence for the exact deployment SHA.

## Production closeout

The post-merge closeout will add the exact infrastructure PR/merge/run
identities, deployed-file verification, internal-path results, PWA upgrade
evidence, rollback proof, v284 smoke result, and known limitations.
