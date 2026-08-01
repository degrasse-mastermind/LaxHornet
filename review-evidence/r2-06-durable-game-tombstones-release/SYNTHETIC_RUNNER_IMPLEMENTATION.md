# R2-06E / R2-06I / R2-06K / R2-06M / R2-06O Synthetic Runner Implementation

Status: `READY FOR INDEPENDENT REVIEW`

This change builds and tests the reviewed R2-06 synthetic verification runner.
It did not connect to Supabase production, create an Auth user, read or mutate
production data, apply a migration, deploy, publish a release, or change the
release-closeout decision.

## Architecture and entry points

- `tools/run_r206_synthetic_verification.mjs` is the only operator entry point.
  It supports credential-free `--check-browser-runtime`,
  `--diagnose-browser-session`, `--dry-run`, `--prepare-run-directory`,
  `--execution-mode disposable`, and the separately gated
  `--execution-mode production --allow-production`.
- `tools/r206_browser_runtime.mjs` owns the pre-credential, pre-mutation
  Playwright/Chromium identity, executable, isolated-launch, and cleanup gate.
  Its runner-local package and lockfile pin Playwright `1.61.1`, Chromium
  revision `1228`, and Chrome for Testing `149.0.7827.55`.
- `tools/r206_synthetic_runner_core.mjs` owns the 21-action plan, hard limits,
  strict state machine, cleanup ledger, classified-result checks, evidence
  redaction, and fail-closed orchestration.
- `tools/r206_browser_session.mjs` owns the shared bounded browser sign-in
  operations, stage classifications, safe timing/state diagnostics, and
  context/profile cleanup used by production and the loopback-only diagnostic.
- `tools/r206_synthetic_production_adapter.mjs` contains the fixed production
  HTTP/browser surface. It accepts only the reviewed Supabase and application
  origins, bounded Auth Admin lifecycle calls, exact-scope reads, the two
  mutation RPCs, and fixed denial probes.
- `tools/r206_synthetic_disposable_adapter.mjs` runs the merged baseline plus
  the actual R2-06 and R2-06A migration definitions in disposable PGlite. It
  simulates only the Auth/session lifecycle that PGlite does not provide.
- `tools/fixtures/r206-synthetic-evidence-schema.json` defines the public,
  sanitized evidence envelope.

## Production gates

Production execution defaults to disabled and stops before credentials or
network access unless all of these inputs agree:

1. explicit `--execution-mode production --allow-production`;
2. a clean worktree at the full reviewed runner SHA;
3. exact project, API, application, runtime, Pages, marker, cache, migration,
   and catalog identities;
4. an unexpired private authorization artifact naming the exact SHA, matrix,
   limits, private store, and browser permission;
5. a fresh private preflight artifact produced through
   `supabase_production_readonly-2`;
6. runtime-injected publishable and secret keys, removed from the runner
   environment after capture.

Existing private-ledger or public-result targets are a stop condition. Initial
writes use create-new semantics, so a rerun cannot silently replace retained
evidence.

R2-06K distinguishes the fixed approved private root from an execution
directory. Normal production execution accepts only one immediate child named
`r206-YYYYMMDDTHHMMSSZ-<12 lowercase hex>` and does not require
`--reviewed-private-path-override`. The root itself, deeper nesting, external
or sibling paths, traversal, links/reparse points, repository paths, and every
Git worktree remain stop conditions. Authorization and preflight must be
direct regular files in the selected child. Consumption and retained-ledger
state are derived from and written only inside that exact child.

The credential-free `--prepare-run-directory` command creates one empty child
under the fixed root with exclusive create-new semantics. It reads no
production credentials, performs no browser or network work, and creates no
authorization or preflight artifact.

R2-06I adds a separate private authorization-consumption record. It is created
after preflight passes and before mutation, never overwrites the authorization
artifact, records mutation and terminal/cleanup state, and blocks reuse even
if the original authorization still says `unused`.

The runner never turns `releaseCloseoutApproved` on. Successful production
behavior and cleanup evidence still require a separate reviewed closeout.

## Mutation and cleanup boundary

The maximum production footprint is two non-deliverable synthetic Auth users,
three sequential sessions, two automatic profiles, one personal game, one
update of that game, zero events, zero Live Share tokens, one accepted durable
delete, one retained tombstone, and one private identifier ledger.

The only mutation RPCs are `laxhornet_sync_game(jsonb)` and
`laxhornet_delete_game_durable(jsonb)`. There is no arbitrary SQL interface or
generic table writer. Direct Data API calls are fixed negative authorization
probes and must produce no mutation.

After the first mutation, every state transition checkpoints the exact owned
objects in the private store. A failure moves to cleanup-only mode. Game
cleanup, when still needed, uses the reviewed durable-delete RPC while an
owned owner session remains active; sessions are then revoked, application
authority is probed, users are removed through Auth Admin, profile cascades
are verified, isolated browser directories are deleted, and exact integer-zero
mutable residue is required. Cleanup cannot enumerate or delete objects that
are not in the ledger.

Historical direct SQL cleanup, Auth-table deletion, refresh-token deletion,
and broad `r206-smoke-*` mutation are explicitly not part of this runner.
Reusing an older smoke tool or adding a cleanup fallback requires a new review.
Failure cleanup uses only `ledger.deletions.deletion_a` and the existing
ledger-owned device identity; the prior undefined cleanup `deletionId`
reference is removed.

## Browser setup and failure reporting

Install the reviewed runner dependency and browser separately on Windows:

```powershell
npm ci --ignore-scripts --prefix tools\r206-browser-runtime
node tools\r206-browser-runtime\node_modules\playwright\cli.js install chromium
node tools\run_r206_synthetic_verification.mjs --check-browser-runtime
```

Production execution performs no package or browser download. Readiness runs
before credentials are accepted and before any mutation. The final CLI failure
object preserves classified errors, safe native class/code, phase, operation,
completed-action count, mutation and cleanup state, integer residue counts,
opaque checkpoint reference, retained-tombstone/manual-cleanup state, and
authorization consumption without exposing identifiers, credentials, private
rows, browser paths, or stacks.

Detailed remediation evidence:
`SYNTHETIC_RUNNER_BROWSER_REMEDIATION.md`.

R2-06M session-establishment remediation evidence:
`SYNTHETIC_RUNNER_SESSION_ESTABLISHMENT_REMEDIATION.md`.

R2-06O Auth-session / UI-readiness decoupling evidence:
`SYNTHETIC_RUNNER_AUTH_UI_DECOUPLING_REMEDIATION.md`.

## Evidence and credential handling

Passwords, email addresses, access tokens, refresh tokens, key material,
session/user/game/deletion identifiers, and browser paths remain outside the
public evidence. The private ledger stores identifiers and state but no
credentials. The public authorization, behavior, and cleanup files contain
only aggregate/classified results, an opaque private-record reference, and the
SHA-256 hash of the frozen private ledger. To avoid an impossible circular
hash, the private ledger binds canonical hashes of each public evidence payload
with only the recursive private-ledger hash/reference fields omitted; the final
public files then bind the exact frozen private-ledger file hash and opaque
reference.

## Verification result

- Adversarial unit suite: 25 focused checks passed during implementation.
- Disposable integration: passed the reviewed create/update/stale-delete/
  durable-delete/replay/conflict/stale-write/hydration/disclosure/cleanup
  sequence using the actual R2-06 and R2-06A RPC definitions.
- Disposable cleanup ended with zero Auth users, profiles, active sessions,
  games, events, and Live Share tokens, plus exactly one retained tombstone.
- The final canonical-plus-additive local regression passed `45/45`.
- Disposable evidence is labeled
  `disposable_verification_complete_not_production_evidence` and cannot satisfy
  production verification or release closeout.

The exact final PR SHA still requires independent Level 3 review. Any future
production execution requires a new, explicit, time-bounded authorization
artifact and fresh named read-only preflight artifact for that reviewed SHA.

R2-06I added `11/11` browser/failure-envelope checks and expanded the runner
suite to `29/29`; the disposable integration and Linux Docker surfaces passed.
The final canonical-plus-additive local regression passed `46/46`. Exact-head
draft-PR CI and independent Level 3 review remain required.

R2-06K adds run-child, traversal, reparse-point, Git-worktree, artifact
containment, consumption-isolation, and helper-CLI coverage. Detailed
remediation evidence is in
`SYNTHETIC_RUNNER_PRIVATE_PATH_REMEDIATION.md`. Production execution and
private historical evidence remained untouched. Local runner coverage passed
44 checks with one Windows directory-symlink permission skip; the Windows
junction check passed. Browser contracts passed `11/11`, pinned Chromium
readiness passed, disposable integration passed as non-production evidence,
and the complete canonical-plus-additive regression passed `46/46`.

R2-06M adds operation-specific browser session establishment, a credential-free
loopback diagnostic, partial-session cleanup coverage, and safe per-operation
failure timing/state. Final local coverage passed 74 focused checks with one
Windows directory-symlink permission skip, pinned readiness, the diagnostic,
disposable integration, release/Pages/tombstone/concurrency gates, and the
complete canonical-plus-additive regression `47/47`. The old attempt's exact
timeout call site remains unrecoverable from its sanitized public evidence;
this limitation is not treated as resolved or as production authorization.

R2-06O replaces the fatal Sign Out-control wait with independent required
checks for a non-expired Supabase browser session, expected synthetic identity,
actual browser persistence, existing account-scoped application bootstrap, and
a harmless scoped local game-state capability. The Sign Out action remains a
safe optional observation. Bootstrap may use at most one normal reload in the
same isolated context, with no credential resubmission or full-session retry.
The loopback diagnostic now exercises nine success/failure scenarios, and
success/failure evidence contains only safe contract booleans and timing/state
categories. Production remains disabled and no production or private retained
evidence was accessed during implementation.
Final local verification passed the nine-scenario pinned-browser diagnostic,
`30/30` browser Auth contracts, 44 runner/path/cleanup checks with one Windows
symlink-permission skip, disposable integration, all focused release/Pages/
tombstone/concurrency gates, and the complete canonical-plus-additive
regression `47/47`.
