# v284 Public-Disclosure Incident Remediation

Status: production remediation complete
Date: 2026-07-29
Production application SHA at incident confirmation: `1221f418c1e005606d54c545148944f9ec69f132`
Corrected production application SHA: `effca6952e647b7424f96675f390fc80d5c42368`
Production Supabase project: `ulbmjcvnyznvmjgpstno`

All inspection and reproduction data was synthetic or aggregate. No real player,
family, or youth content was read for this investigation.

## Incident

A signed-in synthetic reproduction began with two approved ordinary events in
Live Share. Reconciliation then promoted local legacy participation-like aliases
into the authoritative Event Pipeline. The public RPC returned every active
effective event, so the anonymous payload grew to four and included:

- `legacy_shift_alias`
- `Legacy Participation Alias`
- `Private Legacy Alias`

The behavior was semantic-type agnostic. Any unknown active event could follow
the same path, and caller-controlled labels/categories could reach the public
payload.

## Production aggregate inspection

The bounded production inspection found:

- zero active Live Share tokens;
- zero non-synthetic active-share games containing unknown/private semantics;
- no confirmed real-data or youth-data public exposure;
- one non-synthetic active ordinary `goal` and one tombstoned ordinary
  `groundball` in the Event Pipeline;
- the public RPC executable by `anon` and `authenticated` before containment.

## Immediate containment

Because a future token could still exercise the unsafe function, execute access
to `public.lh_public_live_share_game(text)` was revoked from `anon` and
`authenticated`. The app already maps that failure to its neutral unavailable
state. No data, token, table, RLS policy, or evidence record was changed.

Post-containment verification confirmed:

- zero active tokens;
- no execute privilege for `PUBLIC`, `anon`, or `authenticated`;
- private tracking and saved-game continuity remain available.

The exact recovery action is the reviewed corrective migration. Its final
statements restore only the intended `anon` and `authenticated` execute grants
after the safe function is installed. The fail-closed rollback revokes those
grants again and never restores the vulnerable definition.

## Root cause and data flow

```text
legacy/imported/offline local event
  -> loadCloudGames / signed-in synchronization
  -> reconcileGameEventOperations
  -> queueTrustSpineGameReconciliation
  -> trustSpineEvidenceForEvent (previously accepted arbitrary stat type/label)
  -> lh_create_event / lh_correct_event
  -> lh_event_effective_versions (active)
  -> lh_public_live_share_game (previously selected every active row)
  -> anonymous Live Share payload and DOM
```

The private aliases were treated as active because the Event Pipeline lifecycle
was valid but had no ordinary-event semantic boundary. The public RPC then used
active lifecycle state as a de facto publication decision. Neither layer had a
closed public vocabulary.

## Corrected boundary

The browser and database now share the same explicit ordinary-event vocabulary.
Eligibility is based on normalized stat type, never display label, presence,
count, lifecycle state, or private synchronization success. Unknown types
default private.

| Canonical stat type | Public label | Public category |
| --- | --- | --- |
| `goal` | Goal | Offense |
| `assist` | Assist | Offense |
| `shot` | Missed Shot | Offense |
| `shotOnGoal` | Shot on Goal | Offense |
| `goalieSave` | Save | Goalie |
| `goalAllowed` | Goal Allowed | Goalie |
| `faceoffWin` | Faceoff Win | Faceoff |
| `faceoffLoss` | Faceoff Loss | Faceoff |
| `groundBall` | Ground Ball | Effort / IQ |
| `turnover` | Turnover | Possession |
| `causedTurnover` | Caused Turnover | Defense |
| `defensiveStop` | Defensive Stop | Defense |
| `successfulClear` | Successful Clear | Clearing |
| `failedClear` | Failed Clear | Clearing |
| `hustlePlay` | Hustle Play | Effort / IQ |
| `backedUpShot` | Backed Up Shot | Effort / IQ |
| `smartPlay` | Smart Play | Effort / IQ |
| `penalty` | Penalty | Discipline |

Known separator/case variants normalize to these canonical identities in local
reconciliation and historical egress. New database writes must carry the exact
canonical type, label, category, point value, period, UTC timestamp, and field
zone; they are never re-hashed after server rewriting.
The ordinary `note` event remains compatible with the canonical Event Pipeline
but is classified non-public along with its private annotation. Player In/Out,
shifts, clock/participation operations, legacy aliases, and unknown future types
are not in the ordinary vocabulary.

## Application remediation

- `public-event-semantics.js` is the single closed browser vocabulary.
- New, imported, offline, corrected, reconciled, and retrying private/unknown
  events cannot create or correct ordinary Event Pipeline records.
- Attempted pre-upgrade private/noncanonical create and correction payloads make
  one exact raw retry after scope establishment so immutable server receipts
  can resolve a lost response. Never-accepted payloads are suppressed only
  after the server rejects them; accepted receipts and local evidence remain.
- If an already-published ordinary event is corrected out of the public
  vocabulary, its public record is tombstoned instead of converted to a private
  semantic.
- Synchronization readiness is computed from eligible ordinary events only.
- The optional family recap excludes private/unknown/poisoned events and uses
  the filtered public-event count even when it is zero.
- Selected private CSV remains scope-checked, retains local evidence, and keeps
  private notes excluded unless explicitly selected.
- The new module carries one closed 19-type ordinary classification: 18 public
  lacrosse event types plus the private ordinary `note` type. It loads before
  `app.js` and is cached for offline use.

## Database remediation

Additive migration:
`supabase/migrations/20260728193942_v284_public_event_semantic_boundary.sql`

Recovery rollback:
`supabase/rollback/20260728193942_v284_public_event_semantic_boundary_rollback.sql`

pgTAP:
`supabase/tests/v284_public_event_semantic_boundary.sql`

The migration:

- adds private semantic and full-evidence canonicalizers with fixed empty
  search paths;
- revokes direct helper execution from browser roles;
- returns one uniform authorization result before replay, event lookup, or
  semantic classification across create, correction, and tombstone, avoiding
  cross-scope existence/lifecycle oracles;
- replays the original immutable request hash before new semantic validation;
- requires exact canonical create/correction evidence across every public
  field and bounds period/timestamp values to the registered game;
- rejects private/unknown creates and conversions;
- filters invalid historical effective rows non-destructively;
- canonicalizes every public output field for eligible historical rows;
- preserves fixed-search-path security-definer wrappers and explicit grants;
- restores public RPC access only after the safe definition is installed.

No historical migration, evidence row, RLS policy, or authorization model is
rewritten.

## Verification before PR review

- blank-database migration reset: passed;
- production-shaped seven-migration reset, corrective `migration up`, and exact
  one-pending/one-applied transition: passed;
- pgTAP semantic boundary: 45/45 passed on both database shapes, including
  poisoned-field, differential create/correct/tombstone authorization-oracle,
  and pre-migration replay probes;
- focused JavaScript semantic contracts: passed;
- signed-in browser failure reproduction and disclosure suite: 73/73 passed,
  including lost-response create/correction replay and never-accepted private
  retry rejection;
- former failure remained exactly two public ordinary events after private
  alias reconciliation attempts;
- public browser DOM excluded the aliases and stale cached private payload;
- selected private CSV/default-note boundary and family recap boundary passed;
- unknown/expired/revoked token behavior passed;
- browser suite contacted no hosted Supabase project and reported no console or
  page errors;
- first independent review found four adversarial gaps in field validation,
  authorization ordering, recap zero-count handling, and retry hashing; the
  first re-review confirmed those fixes and found tombstone ordering and
  end-to-end legacy retry gaps. All six are corrected on the branch and await a
  clean exact-SHA independent re-review;
- tracked-time browser suite: 33/33 passed after isolating service-worker
  lifecycle behavior from the focused UI harness;
- complete application and release regression: 33/33 groups passed;
- canonical v284 local release verification: all 17 gates passed, including
  blank and production-shaped database paths, rollback behavior, database
  lint, both 45-test disclosure pgTAP runs, the 73/73 signed-in browser journey,
  full regression, and disposable-environment cleanup at exact candidate commit
  `d4a30baa64134e05b01d644ccf33d8e3ba88913d`.

Latest complete verifier evidence:
`C:\Users\user\AppData\Local\Temp\laxhornet-release-verification\ac1635a85a56\v284-2026-07-29T17-17-02-443Z`

## Review, merge, and deployment

- Remediation branch: `fix/v284-public-event-semantic-boundary`.
- Pull request: #30.
- Independently reviewed final head:
  `19f3f89d1120fce167f59237e355bb7cc04394c0`.
- Merge and deployed application SHA:
  `effca6952e647b7424f96675f390fc80d5c42368`.
- Corrective migration `20260728193942` was applied once and is present exactly
  once in production.
- The safe public RPC definition, fixed search paths, RLS, and least-privilege
  grants were verified after migration.
- GitHub Pages served exact `app.html`, `app.js`,
  `public-event-semantics.js`, `service-worker.js`, and `version.json` bytes
  from the approved merge. The marker and service-worker cache remain `v284`.
- Production URL: `https://laxhornet.mybranford.com`.

## Final production smoke

The non-deployable smoke tooling remained isolated on draft PR #29 and was
independently approved at exact SHA
`0ce0f6734318b07bbf7156e91c79d05d40bd7222`. It must not be merged to `main`.

The final synthetic adult-only run passed:

- prewrite state: one corrective migration, zero active share tokens, exact
  hosted asset identity, and no tooling in the deployed tree;
- public payload and anonymous viewer DOM: exactly two approved ordinary
  events with only the documented public game/event keys;
- former incident aliases, unknown types, poisoned ordinary evidence, tracked
  time, private notes/tags, and internal metadata: absent from public output;
- fresh private/invalid local events: retained locally but never given an
  ordinary Event Pipeline sync record;
- direct adversarial RPCs: unsupported aliases/types rejected as
  `unsupported_event_semantics`, and supported `goal` with poisoned evidence
  rejected as `invalid_public_event_evidence`;
- anonymous viewer traffic: exact production Supabase project, public-safe RPC
  allowlist only, and zero legacy `games`/`events` requests;
- ordinary journey: entry, scoring, Undo, Save, End Game, and Game Review;
- correction, offline recovery, canonical tombstone, selected CSV, family
  recap, and neutral unknown/invalid/expired/revoked tokens;
- quarters and halves clocks, Start/Pause/Resume, recovery states, nine
  participation operations, and deterministic shift closure;
- anonymous access to all private tracked-time tables and RPCs: denied with
  `42501`;
- old access token, refresh token, and private RPC authority after teardown:
  rejected.

Machine-readable sanitized evidence:
`production-smoke-results.json`.

## Cleanup and retained history

The successful run proved zero:

- synthetic Auth users, sessions, and refresh tokens;
- active Live Share tokens and active grants;
- mutable legacy games/events, team/profile/roster/claim rows;
- active effective events and active participation;
- running clocks;
- pending or conflicted Event Pipeline operations.

Across the completed run and the safely cleaned harness-development retries,
the final bounded aggregate contains 24 synthetic game scopes, 88 Event
Pipeline operations, 107 participation operations, 72 grant lifecycle events,
and 12 paused clock-state dependencies. These rows are append-only, private,
synthetic, inert, revoked, and have zero active event versions, running clocks,
active grants, active tokens, pending operations, or conflicts. No real
player, family, team, or youth data was read, changed, or deleted.

## Known limitations and follow-up

- The named read-only production connector required OAuth renewal during
  closeout; bounded aggregate verification used the authenticated linked
  Supabase CLI instead. No generic production connector was substituted.
- Repository-root GitHub Pages publishing remains broader than the desired
  deployment boundary. `LH-DEV-005` tracks replacement with an explicitly
  allowlisted deployment artifact.
- The retained synthetic append-only evidence is intentionally not rewritten
  or deleted because of foreign-key and audit provenance requirements.
