# Isolated Supabase Preview Level 3 Review Gate

This gate applies to every pull request that adds or changes a migration,
database function, authorization policy, grant, synchronization contract, or
server-side conflict/identity behavior.

## Required environment

- Use only the automatic ephemeral Supabase Preview branch attached to the
  exact pull-request head.
- The Preview must be isolated, data-less before its reviewed seed, separately
  credentialed, tied to the pull-request lifecycle, and incapable of mutating
  production migration history or data.
- Use synthetic adult-safe fixtures only. Retain no credentials, access tokens,
  private identifiers, operation identifiers, request hashes, or row payloads
  in public evidence.
- No local/manual CLI application, linked-main application, Dashboard
  application, production connection, or substitute database is allowed.

## Non-substitutable evidence

The authenticated multi-session adversarial matrix must not be replaced by
embedded, PGlite, browser-mock, or migration-application status. A green
automatic Preview check proves migration application only.

At minimum, the exact-head matrix must cover the changed contract's applicable
cases:

- two independent authenticated sessions hydrating the same base and writing
  concurrently;
- stable same-operation replay after a lost or aborted response;
- altered replay and cross-scope operation identity refusal;
- create, correction, undo/tombstone, replayed undo, and concurrent undo;
- intervening manual correction with fail-closed conflict behavior;
- stale event, score, lifecycle, and other relevant version dimensions;
- completed and deleted lifecycle boundaries, including tombstone dominance;
- unauthorized and post-hydration revoked actors with no private replay
  disclosure;
- offline persistence, reload/re-authentication, reconnect, and exactly-once
  canonical reconciliation; and
- injected transactional failure with no partial event, score, version,
  journal, evidence, or receipt mutation.

## Evidence and disposition

Record the exact PR head, Preview check URL, isolated project/branch identity in
a non-secret form, synthetic-only confirmation, per-case PASS/FAIL, cleanup or
ephemeral-destruction status, and independent reviewer disposition.

If the reviewer cannot obtain the isolated Preview credentials needed to run
the matrix, the result is `BLOCKED`, not `PASS`. If any case fails, stop the
stack and require bounded remediation plus a fresh exact-head Level 3 review.
