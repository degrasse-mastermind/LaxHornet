# Local Release Verification Workflow

Use this workflow for release preparation only. It is local, fail-fast, and never links to, migrates, queries, or deploys production.

## Canonical command

From the isolated release worktree:

```powershell
node tools/run_release_verification.mjs v284
```

The command:

1. validates the repository, release branch, main SHA, reviewed checksum, manifest, migration identity, and diff hygiene;
2. verifies Node, Python, Docker Linux, Compose, Supabase CLI, PGlite, Playwright, and a local browser;
3. restores pinned PGlite `0.5.4` and Playwright `1.61.1` into a disposable directory outside the repository when needed;
4. starts the documented reduced local Supabase stack once;
5. runs production-ledger provenance, blank and production-shaped database paths, pgTAP, both rollback cases, and lint;
6. runs the complete application/release regression once with fail-fast behavior;
7. stops local services and removes the dependency junction and disposable dependency directory;
8. preserves a timestamped external log and reports the first failed gate.

The release command does not merge, contact production Supabase, migrate production, or deploy the frontend.

## Preflight-only commands

Check the environment without changing it:

```powershell
node tools/run_release_preflight.mjs --check --release v284 --phase preparation
```

Restore exact disposable dependencies and start the local stack:

```powershell
node tools/run_release_preflight.mjs --prepare --release v284 --phase preparation --start-supabase
```

Preparation preflight validates a `release/v284-*` branch against the manifest's
pre-release base and requires release changes to descend from that base.

After the release PR merges, production rollout uses:

```powershell
node tools/run_release_preflight.mjs --check --release v284 --phase production
```

Production preflight requires clean `main` at the manifest's exact approved
merge SHA, verifies that the pre-release base is an ancestor, and proves the
release head was incorporated by ancestry or an exact Git-tree match for a
squash merge. It also rechecks the release marker, cache, asset queries,
reviewed hashes, and public Live Share SQL identity. If a separately authorized post-merge
release-control correction is required, supply its exact merged SHA:

```powershell
node tools/run_release_preflight.mjs --check --release v284 --phase production --approved-rollout-sha <approved-sha>
```

The pre-release base, release head, approved release merge, and any explicitly
approved rollout SHA are distinct identities. Never compare post-merge `main`
directly to the pre-release base or accept an unspecified later commit.

Clean the disposable environment:

```powershell
node tools/run_release_preflight.mjs --cleanup
```

Preflight results use `PASS`, `FAIL`, `NOT REQUIRED`, or `RESTORED EPHEMERALLY`. Repository package metadata must remain absent.

## Resume rules

- Preserve verified work in an isolated release worktree.
- Record the last passed gate and resume there after an environmental interruption.
- Restore exact ephemeral dependencies automatically; do not add a package system to the app.
- Check Docker and Supabase health before database testing.
- Run a focused failed test before the full regression.
- Run the complete regression once after focused fixes pass.
- Keep product implementation, release preparation, production migration, and frontend deployment separate.
- Production rollout always requires a separate explicit authorization task.
- Production rollout prompts must use `--phase production` and an exact
  `--approved-rollout-sha` when an authorized post-merge correction exists.
