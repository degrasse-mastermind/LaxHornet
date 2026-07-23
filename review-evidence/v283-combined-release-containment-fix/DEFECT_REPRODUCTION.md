# Defect Reproduction

## Before

The v283 regression runner was designed for the stacked PR #12 phase. On a
final integration tree that also contained PR #9, it reported:

- 17 passed
- 5 failed

The failures came from the containment model:

- stacked mode treated the four canonical migrations as unknown cleanup files;
- additive mode treated the canonical PR #9 SQL as unapproved;
- integration mode required the entire Supabase tree to equal PR #9 and
  therefore rejected the separately approved capability migration.

The release manifest itself passed when explicitly invoked with
`--require-combined`, but the required containment tests could not represent
the actual approved final tree.

## After

The new `canonical_plus_additive` mode requires:

1. the exact PR #9 Supabase tree;
2. the exact PR #12 capability migration;
3. the exact PR #12 capability rollback;
4. no additional path under `supabase/`;

File identity is enforced with Git blob identities in containment and SHA-256
identities in the release manifest. Existing standalone, additive, and
canonical-only integration modes are unchanged.
