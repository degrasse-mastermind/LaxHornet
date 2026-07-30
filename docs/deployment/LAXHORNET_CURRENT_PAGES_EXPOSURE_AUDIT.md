# LaxHornet Current GitHub Pages Exposure Audit

Audit date: 2026-07-29
Production URL: `https://laxhornet.mybranford.com`
Audited production SHA: `86e3ff79d569c3ec84e382b1b93d2d85df1cd550`
Pages source at audit time: legacy branch publishing from `main` `/`

## Finding

Repository-root Pages publishing made tracked repository files publicly
retrievable by exact path even when directory-index requests returned `404`.
The audit used read-only HTTP requests and recorded only path, status, and
content type. It did not reproduce internal file contents.

| Path or category | Currently public | Needed by app | Sensitive or internal | Required disposition |
| --- | ---: | ---: | ---: | --- |
| `/`, `/app.html`, runtime JavaScript/CSS | Yes | Yes | No | Include each required file explicitly |
| Approved images under `/assets/` | Yes | Yes | No | Include only individually approved images and browser bundle |
| Approved `/launch-kit/` downloads | Yes | Yes | Public product material | Include each linked file explicitly; `launch-kit-readme.md` is the sole approved public Markdown file |
| `/tools/test_event_operation_service.mjs` | Yes (`200`) | No | Yes | Exclude `tools/` |
| `/tools/run_release_verification.mjs` | Yes (`200`) | No | Yes | Exclude release tooling |
| `/docs/RELEASE_VERIFICATION_WORKFLOW.md` | Yes (`200`) | No | Yes | Exclude `docs/` |
| `/review-evidence/v284-tracked-playing-time-production/production-smoke-results.json` | Yes (`200`) | No | Yes | Exclude `review-evidence/` |
| `/supabase/migrations/20260728193942_v284_public_event_semantic_boundary.sql` | Yes (`200`) | No | Yes | Exclude migrations and all SQL |
| `/supabase/rollback/20260728193942_v284_public_event_semantic_boundary_rollback.sql` | Yes (`200`) | No | Yes | Exclude rollback material |
| `/supabase/tests/v284_public_event_semantic_boundary.sql` | Yes (`200`) | No | Yes | Exclude pgTAP/tests |
| `/supabase-schema.sql` | Yes (`200`) | No | Yes | Exclude root SQL |
| `/release/laxhornet-release-manifest.json` | Yes (`200`) | No | Internal release control | Exclude `release/` |
| `/REPO_CURRENT_STATE.md`, `/TICKETS.md`, `/AGENTS.md` | Yes (`200`) | No | Internal operating context | Exclude internal Markdown |
| Prototype pages and unused logo concepts | Yes by exact tracked path | No | Internal/prototype | Exclude and remove from service-worker precache |
| `.github`, `.codex`, local fixtures, source maps, credentials | Potentially publishable when tracked | No | Internal/sensitive | Explicitly forbid |

## Important directory-index limitation

Requests to `/tools/`, `/docs/`, `/review-evidence/`, and `/supabase/` returned
`404`, but known files beneath those paths returned `200`. Directory-index
behavior therefore did not provide an access-control boundary.

## Required boundary

`release/pages-deployment-allowlist.json` is the affirmative production
boundary. Unknown files default to excluded. The build must copy only named
files into a clean artifact, reject symlinks/path traversal/secrets, validate
runtime and service-worker references, and deploy only that generated
directory through GitHub Actions.

The legacy root `.nojekyll` file is not copied. The official Pages artifact
action excludes dotfiles, and Actions deployment publishes the prebuilt static
artifact without a Jekyll build stage.

The audit proves public retrievability, not that any internal URL was accessed
by another person. It makes no claim about historical third-party access.
