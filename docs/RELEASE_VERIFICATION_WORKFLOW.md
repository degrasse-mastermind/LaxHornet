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
node tools/run_release_preflight.mjs --check --release v284
```

Restore exact disposable dependencies and start the local stack:

```powershell
node tools/run_release_preflight.mjs --prepare --release v284 --start-supabase
```

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
