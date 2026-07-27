# Known Limitations and Remaining Work

- No UI is included. The current application cannot yet start a tracked-time clock or record substitutions through normal controls.
- The companion service has contract tests but no signed-in browser/device proof because it is deliberately not loaded by the UI.
- Local Supabase tests prove schema and authorization behavior against synthetic fixtures, not production state.
- `estimated` recovery is intentionally bounded; `needs_review` requires a later human-facing correction flow.
- The rollback refuses to proceed after participation history exists. Any production rollback would require a reviewed export/disposal decision and recovery plan.
- The package is hash-pinned as `draft_review`; it is not part of the v283 pending-production migration list.
- No version marker, service-worker cache name, runtime flag, deployment, merge, or production database state changed.
- Future work requires a separately approved UI ticket, then a separately authorized database release and production validation plan.
