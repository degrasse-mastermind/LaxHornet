# R2-06 Synthetic Cleanup Attestation

Date recorded: 2026-08-01

Risk level: Level 3 release evidence reconciliation

Status: `INDEPENDENT CLEANUP ATTESTED`

## Scope and source

This is the public, sanitized supplemental cleanup record for the completed
R2-06 synthetic production lifecycle. It is derived only from the committed
aggregate cleanup observation in
`SYNTHETIC_HYDRATION_CLEANUP_ATTESTATION.json` and the committed R2-06P
incident/remediation record. It does not reproduce or open the private
retained-identifier ledger, consumed authorization, private preflight,
checkpoint, credentials, or historical run-directory contents.

The sanitized repository evidence does not contain the exact independent
read-only observation timestamp. This record therefore preserves the public
record date and does not invent a more precise time.

## Independently observed aggregate state

| Aggregate | Final count |
| --- | ---: |
| Synthetic Auth users | 0 |
| Synthetic profiles | 0 |
| Active synthetic sessions | 0 |
| Synthetic games | 0 |
| Synthetic events | 0 |
| Synthetic Live Share tokens | 0 |
| Synthetic operations and recoveries | 0 |
| Retained durable tombstones | 1 |
| Retained private identifier ledgers | 1 |

All mutable, Auth, session-authority, and browser-owned synthetic residue was
attested at zero. Both synthetic users were deleted, their profiles cascaded
away, and all three synthetic sessions were revoked. No manual cleanup was
required. Exactly one inert durable tombstone and its one access-controlled
private ledger record remain by design. No private identifier or ledger
content is disclosed here.

## Immutable consumption-record discrepancy

The immutable production consumption record remains unchanged and reports
`cleanupCompleted: false`. It was not updated after the independent named
read-only aggregate verification completed. That false value describes the
immutable runner record, not the independently observed final residue.

This create-new attestation is the authoritative supplemental public cleanup
record. It does not rewrite the runner record, retroactively approve the run,
or change the release-control completion flag. The reconciled facts are:

- independent cleanup verification completed;
- no manual cleanup was required;
- final mutable and Auth residue was zero;
- exactly one retained tombstone remained; and
- exactly one private ledger record remained unopened.

## Controls preserved

- Production execution remains disabled by default.
- The consumed authorization and run directory are not reusable.
- No new production authorization was created.
- No second production lifecycle was run.
- No retained tombstone was changed.
- Synthetic verification remains represented by mixed evidence rather than a
  false binary pass.
- `releaseCloseoutApproved: false`.

This attestation establishes cleanup evidence only. Independent closeout
review remains required.
