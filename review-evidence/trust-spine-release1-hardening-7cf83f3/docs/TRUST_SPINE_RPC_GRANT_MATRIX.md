# Trust Spine Release 1 RPC and Grant Matrix

Status: implemented in the additive staging migration; not applied to
production.

## Client boundary

- `lh_trust_private` is not an exposed client schema.
- `PUBLIC`, `anon`, and `authenticated` have no `USAGE` on
  `lh_trust_private`.
- Those roles have no direct `EXECUTE` on private helper functions.
- All public wrappers are owned by `postgres`, use `SECURITY DEFINER`, and set
  `search_path = ''`.
- Browser roles receive no direct privileges on any Trust Spine table.
- Authorization is resolved from `auth.uid()` and server-side grants or legacy
  team/player relationships. No wrapper accepts a role label from the client.

## Public RPC matrix

| Public RPC | Owner | Security | Search path | `anon` | `authenticated` | Purpose |
|---|---|---|---|---|---|---|
| `lh_register_team_scope(text)` | `postgres` | definer | empty | deny | execute | Register or refresh an existing authorized team snapshot |
| `lh_register_player_scope(text,text)` | `postgres` | definer | empty | deny | execute | Register or refresh an existing authorized active roster-player snapshot |
| `lh_register_game_scope(text)` | `postgres` | definer | empty | deny | execute | Register or refresh an existing authorized game snapshot |
| `lh_resolve_active_grants()` | `postgres` | definer | empty | deny | execute | Resolve accepted, active, unexpired, unrevoked grants for `auth.uid()` |
| `lh_create_event(jsonb)` | `postgres` | definer | empty | deny | execute | Create immutable core evidence and an operation receipt |
| `lh_correct_event(jsonb)` | `postgres` | definer | empty | deny | execute | Append an accepted evidence revision or record a conflict/rejection |
| `lh_tombstone_event(jsonb)` | `postgres` | definer | empty | deny | execute | Permanently tombstone an event without physical deletion |
| `lh_public_live_share_game(text)` | `postgres` | definer | empty | execute | execute | Return only the explicit public game/event allowlist for an active token |
| `lh_record_sensitive_export(text,text)` | `postgres` | definer | empty | deny | execute | Record a sensitive-export audit event and return explicit field manifests |

## Private helper posture

Private helpers are implementation details. Their owners retain execution so
the public wrappers can call them, but ordinary client roles cannot resolve or
execute them. The migration ends with:

```sql
revoke all on all functions in schema lh_trust_private
from public, anon, authenticated;

revoke all on schema lh_trust_private
from public, anon, authenticated;
```

The staging gate must also confirm that `lh_trust_private` is absent from the
Supabase API exposed-schema list. This dashboard/configuration check cannot be
proven from repository SQL alone.

## Grant audit queries

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname like 'lh\_%' escape '\')
   or n.nspname = 'lh_trust_private'
order by n.nspname, p.proname;

select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema in ('public', 'lh_trust_private')
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by routine_schema, routine_name, grantee;
```

Expected:

- No private-schema rows grant ordinary client execution.
- Only the nine public wrappers have client execution.
- `anon` can execute only `lh_public_live_share_game(text)`.

