# Remote Evidence Gaps

Status: blocked by the absence of a disposable Supabase staging branch.

These items were not fabricated and were not tested against production:

- Raw staging migration log.
- Real `pgcrypto` behavior in Supabase staging.
- Real `auth.uid()` results through synthetic Auth sessions.
- Real PostgREST parent, coach, and team-admin responses.
- Real private-helper denial at the API edge.
- Anonymous Live Share network response.
- Expired/revoked Live Share network responses.
- Realtime publication inspection.
- Supabase advisor and lint output.
- Separate-session remote concurrency results.
- Remote rollback rehearsal.

The executable remote harness is included at
`tests/test_trust_spine_remote.mjs`. It uses only synthetic credentials and
requires a pre-seeded disposable staging fixture. It verifies:

- Active grant resolution.
- Direct table read denial.
- Private helper denial.
- Concurrent different-field accepted sequencing.
- Concurrent same-field accepted/conflicted behavior.
- Exact replay idempotency.
- Duplicate operation ID tamper rejection.
- Anonymous Live Share field exclusions when a synthetic share code is
  provided.

## Stop-condition decision

The implementation is locally sound, but the release recommendation remains
**revise** until this remote evidence is produced on a disposable target.

