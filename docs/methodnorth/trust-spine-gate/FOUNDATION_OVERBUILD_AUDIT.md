# Foundation Overbuild and Safety Audit

Status: audit of previously added foundation docs/proposal and current runtime against LH-00 Trust Spine Release 1.

## Summary

The previous `docs/methodnorth/foundation-upgrade` package is explicitly review-only, but it over-expanded the foundation concept beyond the current LH-00 gate. Nothing from that package appears active in runtime. It should be treated as quarantined source material until narrowed.

## Classification table

| Item | File/line | Intended purpose | Actual runtime effect | Boundary affected | Classification | Recommendation |
|---|---|---|---|---|---|---|
| `club_admin` role | `docs/methodnorth/foundation-upgrade/ARCHITECTURE_PLAN.md:26`, `ROLE_MODEL.md:10`, proposal SQL `:24` | Future org-level admin | None; docs/proposal only | Role authority | Unsupported future abstraction | Quarantine for Release 1 |
| `platform_admin` role | `ARCHITECTURE_PLAN.md:26`, `ROLE_MODEL.md:11`, proposal SQL `:24` | Platform-wide support/admin | None; docs/proposal only | Broad support access | Unsafe or privilege-broadening | Quarantine; future support must be time-bound/case-bound/audited |
| `athlete_visible_future` | `DISCLOSURE_MODEL.md:15`, proposal SQL `:162` | Reserve future athlete visibility | None; docs/proposal only | Athlete access/disclosure | Unsupported future abstraction | Quarantine; no athlete accounts in Release 1 |
| `project_one_disclosure_rules` | proposal SQL `:134-164`, policies `:424-441` | Generic disclosure engine | None; docs/proposal only | Visibility policy | Unsupported scope expansion | Remove from Release 1 proposal |
| `PROJECT_ONE_FOUNDATION` / `PROJECT_ONE_EVIDENCE_REVIEW` flags | `MIGRATION_PLAN.md:56-57`, `ROLLBACK_PLAN.md:11-12` | Rollout controls | None; docs only | Rollout | Useful but deferrable | Keep only as rollout controls, never as security controls |
| `project_one_role_assignments` | proposal SQL `:6-34` | New role primitive | None; docs/proposal only | Authorization | Required but overbroad | Revise into active grants + invitations with only `parent`, `coach`, `team_admin` |
| `project_one_event_revisions` | proposal SQL `:34-54` | Append-only event revisions | None; docs/proposal only | Evidence integrity | Required but incomplete | Revise with operation IDs, server versions, tombstone outcomes, and no ordinary mutation grants |
| `project_one_coach_context` | proposal SQL `:56-83` | Coach context | None; docs/proposal only | Coach/private context | Useful but deferrable | Defer or keep as later private context; do not include in minimum Release 1 unless coach scope is tested |
| `project_one_game_review_state` | proposal SQL `:85-107` | Review workflow | None; docs/proposal only | Review workflow | Duplicate/overmixed primitive | Split personal progress from evidence review state |
| `project_one_evidence_status` | proposal SQL `:109-131` | Evidence status | None; docs/proposal only | Evidence integrity/disclosure | Required but overcombined | Split evidence integrity, context state, heuristic suggestion, and review state |
| Direct event update policies | `supabase-schema.sql:2171-2218` | Let authorized clients edit events | Active | Evidence integrity | Unsafe for Trust Spine | Replace during cutover with controlled correction RPC |
| Direct event delete policies | `supabase-schema.sql:2220-2239` | Let authorized clients delete events | Active | Evidence persistence | Unsafe for Trust Spine | Replace with durable tombstone RPC |
| Direct game/event table grants | `supabase-schema.sql:224-227` | Browser CRUD | Active | Evidence writes | Unsafe for Trust Spine | Remove after staged cutover and tests |
| Live Share wildcard query | `app.js:5451-5454` | Load shared game | Active | Public disclosure | Unsafe when private fields are added | Replace with public-safe RPC/view allowlist |
| Realtime ordinary event table | `app.js:5425-5435`, `supabase-schema.sql:2241-2259` | Live updates | Active | Public disclosure | Unsafe when private fields are added | Use public-safe realtime channel/projection or restricted broadcast |
| Local deleted ID arrays | `app.js:2075-2105` | Hide deleted records locally and retry deletes | Active | Delete persistence | Useful but insufficient | Keep for UX, add server tombstones before relying cross-device |
| Direct delete fallback | `app.js:5349-5350`, `app.js:5382-5383` | Delete when RPC missing | Active | Evidence persistence | Unsafe for Trust Spine | Remove after RPC is required and verified |
| Hard-coded reviewer email | `supabase-schema.sql:264-282`, `app.js:27` | Owner/admin bootstrap | Active | Admin authority | Useful but not Release 1 role model | Keep only as temporary owner bootstrap; separate from team admin/coach |
| Client role labels | profile/onboarding flows in `app.js` and metadata in `supabase-schema.sql:446-452` | UX setup | Active | Authorization if trusted | Needs review | Do not trust client labels for authority |
| Broad OR access logic | examples `supabase-schema.sql:1973-1977`, `1993-1997`, `2073-2083`, `2104-2108` | Legacy + reviewer + team access compatibility | Active | Protected reads | Useful but audit-sensitive | Replace with grant resolver tested per role/scope |

## Specific unsafe or blocked items

### Public generalized disclosure engine

The previous proposal includes `project_one_disclosure_rules`. LH-00 explicitly prohibits a generalized polymorphic disclosure engine in this slice. This should be removed from the Release 1 proposal and replaced by narrow, surface-specific allowlists:

- Live Share allowlist.
- Export allowlist.
- Role-scoped read RPCs/views.

### Broad platform administration

The previous proposal allowed platform-level administration. LH-00 blocks ordinary broad platform support access. Any future support access must be:

- time-bound
- case-bound
- audited
- separate from product roles
- not present in Release 1

### Athlete visibility

Any `athlete_visible_future` language remains conceptual only. No athlete accounts, athlete-visible release, or child login flow belongs in Release 1.

### Direct event mutation

Current production behavior allows direct evidence row updates/deletes under RLS. That is an existing product limitation, not a Trust Spine behavior. Release 1 must introduce a controlled correction path and then cut over one surface at a time.

## What can be kept

Keep the direction, but narrow the implementation:

- Append-only event revisions.
- Durable tombstones.
- Active access grants.
- Separate invitations.
- Security audit events.
- Evidence integrity state.
- Context state.
- Personal review progress.
- Public-safe projection idea.
- Rollback-first rollout plan.

## What should be quarantined

Quarantine from Release 1:

- `club_admin`.
- `platform_admin`.
- `athlete_visible_future`.
- `project_one_disclosure_rules`.
- Any Project One UI.
- Any AI interpretation persistence.
- Any broad support access.
- Any feature flag used as authorization.
