# R2-06M synthetic runner session-establishment remediation

Status: `IMPLEMENTED - HISTORIC OPERATION ATTRIBUTION BLOCKED`

Risk level: `LEVEL 3`

Branch: `fix/r2-06m-session-establishment-diagnostics`

Starting point:
`3596287fbd2f44ed58e5295ccace7d594460bf71`

## Production incident facts and boundary

The separately authorized production attempt passed repository and manifest
identity, browser-runtime readiness, run-directory safety, one-run
authorization, read-only production preflight, credential gates, and creation
of exactly two synthetic Auth users and two automatic profiles. It then failed
in `establish_sessions` with public code `BROWSER_SESSION_FAILURE` and safe
native class `TimeoutError`.

Cleanup completed. The reported final production state was zero Auth users,
profiles, active sessions, games, events, Live Share tokens, tombstones, and
operation/recovery residue. No production configuration, schema, migration,
RLS, grant, RPC, trigger, Storage, Auth configuration, deployment, or rollback
change occurred.

The consumed run directory was not reused or changed. A filename-only check
found no separately sanitized browser trace. The retained-identifier ledger
was not opened. No authorization, preflight, consumption, identifier,
credential, or private row content was inspected.

## Root cause and historic attribution limit

The exact historic browser operation cannot be recovered from the authorized
sanitized evidence. The old adapter placed all of these operations in one
generic catch:

1. `page.goto(..., { waitUntil: "networkidle" })`;
2. implicit readiness waits in the email fill;
3. implicit readiness waits in the password fill;
4. the sign-in click;
5. the explicit 30-second sign-out-control wait.

Each could throw Playwright `TimeoutError`, and the catch replaced every one
with `BROWSER_SESSION_FAILURE`. The core then reported only
`establish_sessions`. The retained public facts contain no stack, operation,
last-completed step, per-step timing, or timeout limit. Claiming one of those
five as the exact historic operation would invent evidence.

The proven root cause of the diagnostic failure is therefore the combination
of a broad `networkidle` navigation wait, hidden implicit locator waits, and
lossy stage flattening. R2-06M removes that ambiguity for every future
disposable or separately authorized execution. The ticket cannot truthfully
claim its historic-operation acceptance criterion until independent evidence
identifies the old call site or the owner accepts the attribution limitation.

## Why browser readiness did not detect the failure

Browser readiness verifies the pinned Playwright/Chromium identity, executable,
isolated persistent-context launch, context close, and temporary-profile
removal. It intentionally opens no application page and performs no network or
Auth work. It therefore could not detect application navigation, document or
Supabase-client readiness, Auth UI readiness, credential submission, Auth
response, storage persistence, session lookup, authenticated UI, or session
context cleanup failures.

## New operation model

`tools/r206_browser_session.mjs` now owns the shared production and disposable
diagnostic orchestration:

1. `browser_context_create`;
2. `browser_page_create`;
3. `browser_navigate`;
4. `application_ready`;
5. `supabase_client_ready`;
6. `auth_ui_ready`;
7. `auth_submit`;
8. `auth_response_wait`;
9. `auth_redirect_observe` or `auth_redirect_wait` when a redirect is required;
10. `auth_storage_verify`;
11. `auth_session_verify`;
12. `authenticated_app_verify`;
13. `browser_session_complete`;
14. `browser_context_close`;
15. `browser_profile_remove`.

Navigation waits for `domcontentloaded`, then checks explicit application and
Supabase-client markers. Authentication observes the specific password-token
request and response. Storage and Supabase session availability use one bounded
check loop after a single submission. The current app does not redirect after
password sign-in, so redirect is observed but not required. No automatic
full-session retry was added. Remaining hydration `networkidle` waits were also
replaced with authenticated-UI and request-order signals.

## Timeout policy

| Operation | Default |
| --- | ---: |
| Browser context create | 15,000 ms |
| Browser page create | 5,000 ms |
| Navigation to `domcontentloaded` | 15,000 ms |
| Application marker | 5,000 ms |
| Supabase-client marker | 5,000 ms |
| Auth UI readiness | 10,000 ms |
| Auth submission | 5,000 ms |
| Auth response | 15,000 ms |
| Required redirect | 5,000 ms |
| No-redirect observation | 1,000 ms |
| Auth storage | 10,000 ms |
| Supabase session | 10,000 ms |
| Authenticated application UI | 10,000 ms |
| Context close | 10,000 ms |
| Profile removal | 5,000 ms |

Tests may override individual values. Production uses the reviewed bounded
defaults. There is no global timeout multiplier.

## Classifications and failure envelope

Specific safe classifications now include:

- `BROWSER_CONTEXT_CREATE_FAILED`;
- `BROWSER_PAGE_CREATE_FAILED`;
- `BROWSER_NAVIGATION_TIMEOUT` and `BROWSER_NAVIGATION_FAILED`;
- `APPLICATION_NOT_READY`;
- `SUPABASE_CLIENT_NOT_READY`;
- `AUTH_UI_NOT_READY`;
- `AUTH_SUBMISSION_FAILED`;
- `AUTH_REQUEST_TIMEOUT`, `AUTH_REQUEST_FAILED`, and
  `AUTH_REQUEST_REJECTED`;
- `AUTH_REDIRECT_TIMEOUT`;
- `AUTH_STORAGE_NOT_ESTABLISHED`;
- `AUTH_SESSION_NOT_ESTABLISHED` and
  `AUTH_SESSION_VERIFICATION_TIMEOUT`;
- `AUTHENTICATED_APP_STATE_NOT_ESTABLISHED`;
- `BROWSER_CONTEXT_CLEANUP_FAILED`;
- `BROWSER_PROFILE_CLEANUP_FAILED`.

`BROWSER_SESSION_FAILURE` remains only as an unknown-operation fallback.
Specific adapter errors are not flattened by the core or CLI.

The sanitized failure envelope now includes phase, exact operation, runner
operation, last-completed operation, per-operation elapsed and timeout values,
completed action count, page lifecycle, context existence, Auth request start,
session confirmation, cookie/local-storage booleans, authenticated-app state,
browser cleanup state, production mutation state, cleanup entry/outcome,
integer residue counts, authorization consumption, safe native class/code,
opaque checkpoint reference, and immutable
`releaseCloseoutApproved: false`.

## Redaction

The public result contains no emails, passwords, access or refresh tokens,
cookies, authorization headers, identifier-bearing URLs, user/profile/session
IDs, generated UUIDs, response bodies, browser paths, or stacks. Realistic
Playwright/Supabase-style failures are reduced to classified code, safe native
name/code, booleans, and bounded integer timing. Test coverage rejects
credential, token, ID, URL, and native-message disclosure.

## Session ownership and isolation

The reviewed three-session limit is unchanged:

- `owner_initial`: owner identity, direct bounded HTTP password Auth;
- `challenger_initial`: challenger identity, browser-driven Auth in its own
  isolated persistent context/profile;
- `owner_hydration`: owner identity, browser-driven Auth in a second isolated
  persistent context/profile.

The browser sessions do not reuse contexts, local storage, cookies, or profile
directories. Each session requires storage presence, Supabase `getSession()`
availability, and authenticated application state. Server-side authority and
revocation probes remain separate from browser storage confirmation.

## Cleanup

Fault injection covers failure before context creation, after context creation,
after page creation, during navigation, before Auth submission, during the Auth
request, before storage confirmation, after session confirmation, during
context close, and during profile removal. Pre-return browser failure closes
and removes its provisional context/profile. Core cleanup remains cleanup-only,
deletes the two ledger-owned users, verifies profile cascade and session zero,
and creates no game, event, token, or tombstone.

The disposable adapter now models Auth-user deletion revoking any provisional
session that was created before the core could record it. Residue envelopes
include the invariant `operations: 0` for this pre-game failure class.

## Credential-free diagnostic

```powershell
node tools/run_r206_synthetic_verification.mjs --diagnose-browser-session
```

The command first uses pinned browser readiness, then starts an ephemeral
loopback-only mock application/Auth surface and executes the same browser
session orchestrator. It accepts no production keys or identity input, cannot
select production mode, reports sanitized per-step timing, and verifies context
close/profile removal. Its result states
`productionEndpointContacted: false`, `networkMutationCount: 0`, and
`releaseCloseoutApproved: false`.

## Verification

Local results on the final implementation diff:

- credential-free pinned Chromium readiness: passed;
- credential-free loopback session diagnostic: passed with all operations
  timed, session confirmed, context closed, and profile removed;
- browser-session, browser-runtime/failure-envelope, and runner/path/cleanup/
  authorization suites: `74` passed with one Windows directory-symlink
  permission skip;
- disposable R2-06/R2-06A integration: passed, explicitly not production
  evidence;
- secret/host scan: passed;
- manifest validation: passed;
- manifest reconciliation: `8/8`;
- phase-aware preflight: `22/22`;
- phase-aware containment: `33/33`;
- Pages deployment contracts: `21/21`;
- tombstone client contracts: `33/33`;
- migration/rollback: `13/13`;
- PostgreSQL concurrency: `8/8`;
- changed-JavaScript syntax and `git diff --check`: passed;
- complete canonical-plus-additive regression: `47/47`.

The first complete-suite attempt used the disabled Windows Store `python`
alias and recorded `43` passes plus four server/Python-launch failures. No code
changed. The unchanged diff then passed `47/47` with the bundled Python runtime
selected through `LAXHORNET_PYTHON`. Exact-head draft-PR CI remains pending.

No production mode, production credential, production endpoint, Auth Admin
operation, production mutation, migration, deployment, cleanup, or release
action was used for R2-06M. Synthetic authorization, synthetic completion,
cleanup completion, and release closeout remain false. Any future production
attempt still requires a new authorization and fresh named read-only preflight
bound to an independently reviewed exact SHA.

## Subsequent R2-06O Auth / UI decoupling

A later sanitized production attempt attributed the new failure exactly: the
Supabase browser session was confirmed, but `authenticated_app_verify` timed
out while waiting ten seconds for visible selector
`[data-action="sign-out"]`. Cleanup again completed with independently
verified zero residue. That later evidence resolves the new incident's gate;
it does not change this document's limitation on attributing the older
pre-R2-06M generic timeout.

Repository inspection showed that the Sign Out control is rendered only after
`handleAuthSubmit()` has accepted the session, called `setAuthUser()`, switched
the account namespace, and awaited profile/cloud bootstrap. R2-06O therefore
replaces historical post-response operations 10-12 with:

1. `auth_session_confirm`;
2. `auth_persistence_confirm`;
3. `application_auth_bootstrap_wait`;
4. optional one-time `application_auth_reload`;
5. `application_auth_bootstrap_verify`;
6. `authenticated_capability_verify`;
7. diagnostic-only `authenticated_ui_marker_observe`.

The stable bootstrap signal uses the application's existing account-scoped
player-settings and durable-sync-operation containers. The protected
capability reads only whether the synthetic account's scoped local game-state
container has the required array shape. No values or identifiers enter public
evidence. A missing UI marker is no longer fatal after the required conditions
pass; genuine session, identity, persistence, bootstrap, reload, or capability
failure remains specifically classified and fail closed.

Detailed evidence:
`SYNTHETIC_RUNNER_AUTH_UI_DECOUPLING_REMEDIATION.md`.
