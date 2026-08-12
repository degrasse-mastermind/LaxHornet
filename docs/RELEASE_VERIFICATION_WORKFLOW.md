# Portable Release Verification Workflow

Use this workflow for release preparation only. It is portable, fail-fast, and
does not start a local database stack, contact production, apply a migration,
or deploy anything.

## Canonical command

From an isolated release worktree:

```powershell
node tools/run_release_verification.mjs
```

The command:

1. validates repository, branch, main SHA, reviewed checksums, manifest,
   migration identity, release surfaces, and diff hygiene;
2. verifies Node and Python and restores exact PGlite and Playwright tooling
   ephemerally when needed;
3. runs production-ledger provenance using the portable PGlite harness;
4. proves every active workflow, canonical runner, and release-control command
   is container-free;
5. runs the complete canonical-plus-additive portable regression once with
   fail-fast behavior;
6. removes only the ephemeral dependency junction and temporary dependency
   directory; and
7. preserves a timestamped external log and reports the first failed gate.

This command does not establish real PostgreSQL concurrency, authenticated
multi-session behavior, or migration application. Those facts require the
automatic isolated Supabase Preview plus the independent gate in
`docs/ISOLATED_PREVIEW_REVIEW_GATE.md`.

The canonical hosted command is:

```powershell
node tools/run_supabase_preview_server_matrix.mjs
```

It runs only with an exact isolated branch identity and branch-scoped URL,
publishable credential, and direct database URL. It refuses production before
contact or mutation. See `docs/HOSTED_POSTGRES_VERIFICATION.md` and
`release/hosted-postgres-verification-map.json`.

## Preflight-only commands

Read-only current-repository environment check:

```powershell
node tools/run_release_preflight.mjs --check
```

Historical release-identity checks remain available for an exact historical
release worktree. For example:

```powershell
node tools/run_release_preflight.mjs --check --release v284 --phase preparation
```

Restore exact ephemeral PGlite and Playwright dependencies without starting a
database service:

```powershell
node tools/run_release_preflight.mjs --prepare --release v284 --phase preparation
```

Production-phase identity checks remain separately authorized and use:

```powershell
node tools/run_release_preflight.mjs --check --release v284 --phase production
```

An authorized post-merge release-control correction supplies its exact merged
SHA:

```powershell
node tools/run_release_preflight.mjs --check --release v284 --phase production --approved-rollout-sha <approved-sha>
```

Cleanup removes only ephemeral dependency material:

```powershell
node tools/run_release_preflight.mjs --cleanup
```

## Non-substitution and stop rules

- Portable/PGlite and browser-mock success never substitutes for isolated
  Preview migration application or authenticated multi-session adversarial
  evidence.
- A migration PR cannot be recommended for merge merely because its Supabase
  Preview status is green. The exact head must pass the matrix and evidence
  requirements in `docs/ISOLATED_PREVIEW_REVIEW_GATE.md`.
- A credential-free Vercel Preview is device-only and cannot satisfy a
  connected Preview gate.
- Production rollout, schema application, capability activation, deployment,
  and release publication remain separately authorized.
- Missing GitHub `Preview` environment credentials or an unavailable automatic
  Supabase branch is `BLOCKED`, never `SKIPPED` or portable-equivalent.

## Tracked-time authorization fixture

For a team-scoped Tracked Playing Time production gate, use an accepted,
unexpired player-scoped `parent` grant with the matching player claim, or an
accepted `coach` grant with the matching team/player scope and reviewed legacy
scope-registration relationship. Do not use a team-admin-only fixture as the
authorized tracked-time actor. Team admins have reviewed read/list authority,
but `lh_mutation_grant_for_game` deliberately limits initialize, update,
create, correct, and tombstone authority to scoped parents and coaches.

There is no standalone Trust Spine `tracker` capability. Record the exact
grant role, scope, latest lifecycle event, expiry, claim or team relationship,
game scope, and player scope before calling the authorization gate.

## Historical v284 evidence

The former local-stack workflow is immutable historical evidence at the
reviewed v284 SHAs. Current commands do not reproduce or invoke that workflow.
Use exact-SHA `git show` checks when historical byte identity is required.
