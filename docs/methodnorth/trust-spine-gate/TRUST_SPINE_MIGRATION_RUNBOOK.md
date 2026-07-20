# Trust Spine Migration Runbook

Status: staging-only proposal. Do not run against production without LH-00 approval.

## Phase A: tests before schema

Write tests first for:

- Authorization matrix.
- Direct event update/delete denial.
- Correction RPC acceptance.
- Duplicate operation replay.
- Concurrent corrections.
- Revoked grant replay.
- Tombstone replay.
- Live Share projection allowlist.
- Export allowlist.
- Rollback behavior.

Deliverable: `TRUST_SPINE_TEST_PLAN.md` plus executable tests when staging is approved.

## Phase B: deny-all additive schema

In staging only:

1. Apply only additive Trust Spine tables.
2. Enable RLS on every new table.
3. Grant no ordinary `anon`/`authenticated` table access.
4. Add indexes for grant lookup and revision lookup.
5. Verify direct table access is denied.

Do not alter existing production tables in this phase unless LH-00 approves a specific compatibility column/index.

## Phase C: shadow writes

Where safe in staging:

1. Continue current app behavior.
2. Write candidate correction operations/revisions in parallel.
3. Do not change reads.
4. Compare current effective events to shadow revisions.
5. Log mismatches.

Exit criteria:

- No duplicate revisions for same operation ID.
- No cross-team grant resolution.
- No private data in shadow Live Share projection.

## Phase D: authenticated security testing

Use real authenticated sessions for:

- Parent on authorized player.
- Parent on another player in same team.
- Parent on another team.
- Team-scoped coach.
- Player-scoped coach.
- Team admin without coach grant.
- User with multiple grants.
- Revoked grant.
- Expired grant.
- Pending invitation.
- Unauthenticated Live Share viewer.

Attempt:

- Direct event update.
- Direct event delete.
- Direct revision update/delete.
- Cross-team correction.
- Client role spoof.
- Live Share private-field read.

## Phase E: narrow pilot

After LH-00 approval:

- Enable one controlled team/account only.
- Keep old path available for rollback.
- Monitor correction outcomes, sync failures, duplicate operation IDs, and disclosure tests.

## Phase F: surface-by-surface cutover

Cut over one path at a time:

1. Public-safe Live Share projection.
2. Sensitive export allowlists/audit.
3. Event correction RPC for post-game edits.
4. Event tombstone RPC for deletes.
5. Live event capture operation receipts.
6. Legacy direct mutation removal.

Do not replace all legacy behavior in one release.

## Phase G: legacy deprecation

Remove legacy checks only after:

- Parity metrics pass.
- Rollback is proven.
- Data-retention review is complete.
- LH-00 explicitly approves.

## Stop conditions

Stop and report if:

- Secure role enforcement cannot be expressed and proven.
- Direct client event mutation cannot be blocked safely.
- Conflict handling would destroy evidence.
- Offline replay can duplicate or resurrect evidence.
- Live Share can see private foundation records.
- Rollback requires deleting production data.
