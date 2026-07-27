# Local Reproduction

Environment:

- Supabase CLI `2.109.1`
- Docker Engine `29.6.2`
- reviewed seven-migration blank reset
- real public tracked-time RPCs
- all fixture work wrapped in a transaction and rolled back

The local matrix executed `126` RPC calls across `18` actor/scope cases. No
result had a missing code.

| Case | Initialize | Read/list | Mutations |
| --- | --- | --- | --- |
| Personal owner | Allow | Allow | Allow |
| Parent + active player grant + matching claim | Allow | Allow | Allow |
| Coach + active team grant + same-team registration relationship | Allow | Allow | Allow |
| Coach + active player grant + matching claim | Allow | Allow | Allow |
| Parent/coach grant without registration relationship | Deny | Allow | Allow |
| Team admin only | Deny | Allow | Deny |
| Legacy tracker label only | Deny | Deny | Deny |
| Pending grant | Deny | Deny | Deny |
| Revoked grant | Deny | Deny | Deny |
| Expired grant | Deny | Deny | Deny |
| Wrong team | Deny | Deny | Deny |
| Wrong player | Deny | Deny | Deny |
| Unknown game | Deny | Deny | Deny |
| Cross-team coach | Deny | Deny | Deny |
| Cross-player coach | Deny | Deny | Deny |
| Service role with no user subject | `unauthorized` | `unauthorized` | `unauthorized` |

Accepted mutation codes were:

- `clock_initialized`
- `clock_updated`
- `participation_operation_created`
- `participation_operation_corrected`
- `participation_operation_tombstoned`

Accepted read codes were:

- `clock_read`
- `effective_participation_listed`

All denied authenticated scope cases returned `unauthorized_scope`.

The production-shaped team-admin case exactly reproduced the stopped rollout:
initialization and all mutations were denied, while read/list remained allowed.
