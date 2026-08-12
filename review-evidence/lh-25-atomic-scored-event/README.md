# LH-25 review evidence

Status: implementation evidence for independent exact-PR-SHA review. This is
not production migration, deployment, activation, or release evidence.

## Scope and environment

- Branch: `codex/lh-25-atomic-scored-event`
- Starting `origin/main`: `3b866d35d48fc2d54837952241de237d785523cf`
- Production release marker at the starting SHA: `v288`
- Supabase CLI used to create the timestamped migration: `2.109.1`
- PostgreSQL verification used a disposable local Docker container and
  synthetic UUIDs/game data only.
- The test removes its container in a `finally` path and asserts zero residue.
- No linked Supabase project, production credential, production data, remote
  migration, deployment, or external write was used.

The disposable schema fixture intentionally uses the repository's established
data-less R2-07 Preview baseline before applying LH-25. Earlier historical
production preflight migrations require populated production-era team data and
are therefore not valid blank-database fixtures. This choice does not bypass an
LH-25 precondition or weaken an LH-25 assertion.

## Contract under review

- `docs/LH25_ATOMIC_SCORED_EVENT_CONTRACT.md`
- `supabase/migrations/20260812005627_atomic_scored_event_command.sql`
- `supabase/rollback/20260812005627_atomic_scored_event_command_rollback.sql`
- `tools/test_atomic_scored_event_command.mjs`
- `tools/test_atomic_scored_event_client.mjs`

The parent RPC is additive and default-off in the production runtime. The
isolated Preview artifact is the only repository artifact that enables the
client capability. There is no fallback from a prepared composite operation to
separate event and score RPCs.

## Focused evidence

Run from the repository root:

```powershell
node --check app.js
node --check event-operation-service.js
node tools/test_atomic_scored_event_client.mjs
node tools/test_atomic_scored_event_command.mjs
node tools/test_event_operation_service.mjs
node tools/test_r207c_versioned_events.mjs
git diff --check
```

Observed before final commit:

- Atomic client contract: `13/13 passed`.
- Atomic PostgreSQL matrix: `27/27 passed`.
- Existing event operation service contracts: passed.
- Existing R2-07C versioned event client: `30/30 passed`.
- JavaScript syntax and diff hygiene: passed.

The PostgreSQL matrix proves:

- Goal create increments the canonical score and event exactly once.
- Same-identity replay returns the durable receipt without a second write.
- Payload/scope tampering is rejected and journaled append-only.
- Unauthorized requests are non-enumerating and leave no parent evidence.
- Stale score bases conflict before event mutation.
- Injected failures after event or score leave no child mutation or child
  journal residue.
- Scoring-type correction applies one server-derived net delta.
- tombstone/Undo reverses the original effect exactly once.
- completed-game append is rejected atomically.
- concurrent same-base requests serialize to one acceptance and one explicit
  conflict with consistent canonical cardinality.
- Parent history is FORCE RLS, browser-inaccessible, and append-only.
- Rollback refuses after accepted evidence and succeeds on an evidence-free
  disposable schema.

## Required independent review

Before merge, the reviewer must use the exact PR head SHA and independently:

1. hash `git show <sha>:<path>` for the migration, rollback, client service,
   and both focused tests;
2. run the PostgreSQL and client matrices from that exact SHA;
3. inspect that the SECURITY DEFINER entrypoint uses an empty search path,
   repeats authentication/authority checks before replay disclosure, and is
   granted only to `authenticated`;
4. confirm the composite function mutates canonical heads only through the
   governed R2-07 child RPCs inside the rollback subtransaction;
5. probe forged identity, changed-payload replay, cross-game scope, stale
   versions, concurrent requests, injected child failure, and persisted
   provenance;
6. confirm the production flag remains off and no release marker, service
   worker cache, release manifest, Pages workflow, or production configuration
   changed.

## Promotion boundary

An automatic migration on an isolated, data-less Supabase Preview branch tied
to the pull request is accepted CI verification. Local/manual application,
linked-main application, production application, merge, activation, deployment,
and release remain unauthorized and must not be inferred from a green matrix.
