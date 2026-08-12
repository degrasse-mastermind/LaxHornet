# Hosted PostgreSQL verification

Docker is retired from the active LaxHornet workflow. Historical Docker tests
and evidence remain historical only and do not contribute current evidence.

## Verification architecture

The complete local portable gate is:

```powershell
node tools/run_v283_local_regression.mjs
```

It proves deterministic application, client, browser, PGlite, release-control,
manifest, disclosure, and offline contracts. It does not prove hosted Auth,
RLS, grants, RPC, transaction, or concurrent-session behavior.

Every PR that changes `supabase/migrations/**`, server RPCs, RLS, grants,
authorization, server-side identity, transaction, or concurrency contracts must
also run:

```powershell
node tools/run_supabase_preview_server_matrix.mjs
```

The command is fail-closed. Before mutation it requires and cross-checks the
isolated Preview URL, publishable key, direct Preview database URL, project
reference, branch name, and exact PR SHA. It rejects the production project
`ulbmjcvnyznvmjgpstno`, `main`, and any database URL naming production. It then
uses independent real PostgreSQL sessions with authenticated JWT claims against
the migration-installed Preview RPCs. The checked-in mapping is
`release/hosted-postgres-verification-map.json`.

The supported GitHub path uses Supabase CLI branch discovery with a narrowly
scoped `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` stored only in the
GitHub `Preview` environment. `supabase --experimental branches get` supplies
branch-specific values. Values are masked and never written to artifacts.

If those environment secrets are absent, branch identity cannot be proven, or
the Supabase branch is not ready, the hosted gate fails. A skipped gate, green
migration-application status, PGlite result, or browser mock is not a PASS.

## Browser Preview

When the Supabase/Vercel branching integration supplies a matched isolated
Preview URL and publishable credential, the Vercel Preview may connect only to
that branch. When either value is missing, the build remains device-only:
cloud access and trusted-disclosure RPC capabilities are disabled, with no
fallback to production.

## Cleanup

The hosted matrix uses adult-safe synthetic identities and a per-run namespace.
It removes mutable games, teams, and Auth identities when possible. Append-only
evidence that cannot safely be deleted remains confined to the disposable
Preview branch; deletion of the Preview branch is the ultimate cleanup boundary.

## Retired-suite guarantee map

| Retired suite | Portable replacement | Hosted Preview group |
|---|---|---|
| Game tombstone concurrency | Tombstone, migration, hydration tests | `tombstone` |
| R2-07A concurrency | Durable sync, capabilities, exact binding | `r207a-r207b` |
| R2-07B Preview migration | Controlled Preview and two-session browser | `r207a-r207b` |
| R2-07C versioned events | Event client, safety, two-session browser | `r207c` |
| R2-07D conflicts | Conflict client and dismiss browser | `r207d` |
| Clock/batch integration | Clock client and two-context browser | `clock-batch` |

The JSON map is normative and lists the material guarantee-to-gate mapping.
