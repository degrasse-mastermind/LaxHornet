# R2-06O Auth-session / UI-readiness decoupling remediation

Status: `READY FOR INDEPENDENT REVIEW`

Risk level: `LEVEL 3`

Branch: `fix/r2-06o-auth-session-ui-readiness-decoupling`

Starting point: `401886e2f8a7023b985f6d9bae17d92705ea8f3f`

## Incident basis and evidence boundary

The latest separately authorized production attempt passed repository and
manifest identity, browser readiness, run-directory safety, one-run
authorization, fresh read-only preflight, credential gates, creation of the
two bounded synthetic Auth users and automatic profiles, Supabase browser
authentication, and browser Auth-session confirmation. It then failed because
the authenticated application UI marker did not become visible within ten
seconds. Cleanup completed and independent read-only verification reported
zero Auth-user, profile, active-session, game, event, Live Share token,
tombstone, and operation/recovery residue.

The consumed run directory and its authorization were not reused. This task
did not open the retained-identifier ledger or inspect private authorization,
preflight, consumption, credential, identifier, or row contents. It used only
the sanitized incident facts in the approved ticket.

## Exact old gate and why it was insufficient

The old fatal operation was `authenticated_app_verify` in
`tools/r206_browser_session.mjs`. It waited for this selector:

```text
[data-action="sign-out"]
```

The selector identifies a rendered Sign Out control. In the application,
`handleAuthSubmit()` first accepts `signInWithPassword()`, calls
`setAuthUser()`, switches to the authenticated account namespace, and
initializes/persists account-scoped local state. It then awaits profile and
cloud-game bootstrap before calling `render()`. The Sign Out control is
therefore a post-bootstrap render detail. It is not the Supabase session, the
persisted Auth record, or the application current-user assignment, and it can
legitimately be delayed while those required conditions are already true.

The production application does not guarantee that this particular control is
visible within the Auth-session verification window. It is unnecessary for
the remaining matrix. Treating it as the sole application-authentication gate
conflated authentication, bootstrap, protected capability, and incidental UI.

## Required authentication-success contract

A browser-driven session now succeeds only after all of these independent
checks pass:

1. `supabase.auth.getSession()` returns a non-null, non-expired session.
2. The session user matches the expected synthetic principal internally.
3. The actual Supabase browser-storage record is present, non-expired, and
   matches the same expected principal.
4. The application has initialized the expected account namespace. The stable
   signal is presence of the existing account-scoped player-settings and
   durable-sync-operation containers written by `setAuthUser()` through
   `applyStoredAccountState()` / `persistAll()`.
5. A harmless protected capability succeeds: the expected synthetic account's
   scoped local game-state container is readable as an array. The probe returns
   only a boolean, enumerates no rows, and creates no game, event, token, or
   tombstone.

No token, cookie, storage value, email, user ID, URL, response body, or page
text is placed in public evidence. Successful state-history evidence records
only the required booleans, optional marker result, reload result, safe marker
type, and optional elapsed time.

## Optional UI marker and one-reload rule

`authenticated_ui_marker_observe` still observes the reviewed
`sign_out_action` marker and records whether and when it appeared. A delayed or
absent marker does not reject a session after all required checks pass, and
public evidence fixes `uiMarkerAbsenceAffectedExecution` to `false`.

If the session and persistence checks pass but the account-scoped bootstrap
signal is absent, the runner permits exactly one normal reload in the same
isolated browser context. The reload does not re-enter credentials, resubmit
the Auth request, create a new session, or retry the full flow. It is recorded
as `application_auth_reload`. Bootstrap and the protected capability must then
pass. A second reload is impossible.

## Operation model and classifications

The post-response operations are now:

1. `auth_session_confirm`;
2. `auth_persistence_confirm`;
3. `application_auth_bootstrap_wait`;
4. optional `application_auth_reload` (maximum one);
5. `application_auth_bootstrap_verify`;
6. `authenticated_capability_verify`;
7. `authenticated_ui_marker_observe` (diagnostic only);
8. `browser_session_complete`.

Specific fail-closed classifications include:

- `AUTH_SESSION_NOT_ESTABLISHED`;
- `AUTH_SESSION_IDENTITY_MISMATCH`;
- `AUTH_PERSISTENCE_NOT_ESTABLISHED`;
- `APPLICATION_AUTH_BOOTSTRAP_TIMEOUT`;
- `APPLICATION_AUTH_BOOTSTRAP_FAILED`;
- `APPLICATION_AUTH_RELOAD_FAILED`;
- `AUTHENTICATED_CAPABILITY_UNAVAILABLE`.

The generic browser-session classification remains only for unknown failures.
Optional-marker absence has no fatal classification.

## Failure envelope, isolation, and cleanup

The sanitized failure envelope now carries Auth-response acceptance, session
and identity confirmation, persistence confirmation, application-bootstrap
confirmation, protected-capability confirmation, optional-marker result and
safe type, one-reload state, operation timing/limit, page/context lifecycle,
mutation and cleanup state, aggregate residue, authorization consumption,
safe native class/code, opaque checkpoint reference, and immutable
`releaseCloseoutApproved: false`.

The owner direct-HTTP session, challenger isolated browser session, and owner
hydration isolated browser session remain sequential and identity-bound. The
two browser sessions use separate persistent contexts and profiles with no
cookie, storage-state, or context reuse. Hydration no longer reintroduces the
Sign Out selector as a fatal gate after the shared session contract passes.

Any post-user-creation session failure still enters cleanup-only mode. Focused
coverage proves bootstrap, capability, identity, context-close, and
profile-removal failures preserve bounded cleanup; no game is created before
session establishment completes; zero game/event/token/tombstone/operation
residue remains for partial session failure; and authorization consumption
state is retained correctly.

## Diagnostic and tests

```powershell
node tools\run_r206_synthetic_verification.mjs --diagnose-browser-session
```

The credential-free loopback diagnostic exercises normal success, delayed and
absent optional UI, one-reload bootstrap recovery, bootstrap timeout,
protected-capability failure, missing session, wrong identity, and cleanup
after partial establishment. It accepts no production keys, contacts no
production endpoint, and removes every browser context/profile.

Focused tests cover immediate/delayed/absent marker behavior, marker without a
session, persistence, expected/wrong identity, bootstrap with and without the
one reload, no second reload, reload failure, specific bootstrap/capability
classifications, safe success/failure evidence, isolation, redaction, partial
cleanup, no pre-session game creation, zero tombstones after session failure,
disabled-by-default production, and false release closeout.

Final local verification on the stabilized implementation diff:

- pinned Chromium readiness: passed;
- nine-scenario credential-free loopback diagnostic: passed;
- browser Auth/bootstrap/UI-decoupling contracts: `30/30`;
- runner/path/cleanup/authorization contracts: 44 passed with one Windows
  directory-symlink permission skip; the Windows junction probe passed;
- disposable R2-06/R2-06A integration and public success-evidence assertions:
  passed, explicitly not production evidence;
- secret/host scan and release-manifest validation: passed;
- release-manifest reconciliation: `8/8`;
- phase-aware preflight: `22/22`;
- phase-aware containment: `33/33`;
- Pages deployment contracts: `21/21`;
- client tombstone contracts: `33/33`;
- migration/rollback contracts: `13/13`;
- disposable PostgreSQL concurrency: `8/8`;
- changed-JavaScript syntax and `git diff --check`: passed;
- complete canonical-plus-additive regression: `47/47`.

The first regression command channel reached its two-minute capture ceiling
before returning an exit status. Its detached wrapper was allowed to exit, but
its unobservable result was not counted. The unchanged diff then completed the
captured regression above in 140 seconds with `47` passes and zero failures.

## Remaining release gate

This remediation did not execute production mode, use production credentials,
contact Supabase production, mutate production, apply a migration, deploy, or
approve closeout. Synthetic authorization, synthetic completion, cleanup
completion, and release closeout remain false. Any future production attempt
requires new explicit authorization and a fresh named read-only preflight
bound to an independently reviewed exact runner SHA.
