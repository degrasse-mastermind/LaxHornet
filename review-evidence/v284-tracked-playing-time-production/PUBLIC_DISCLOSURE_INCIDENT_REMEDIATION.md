# v284 Public-Disclosure Incident Remediation

Status: remediation review
Date: 2026-07-28
Production application SHA at incident confirmation: `1221f418c1e005606d54c545148944f9ec69f132`
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
  lint, both disclosure pgTAP runs, full regression, and disposable-environment
  cleanup. This complete verifier must be rerun after the latest hardening.

Independent PR review, merge identity, production migration, deployment, final
smoke, cleanup, and retained-history disposition are recorded in this directory
after their gates complete.
