# Local Supabase Workflow

Status: verified on Windows for LH-DEV-002.

This workflow exists to validate the committed LaxHornet database migrations against a local Docker-based Supabase environment without contacting or mutating the hosted production project.

## Verified environment

- Windows with Docker Desktop using Linux containers.
- Docker Engine: `29.6.2`.
- Docker Compose: `v5.3.1`.
- Supabase CLI: `2.109.1`.
- Repository: `C:\Users\user\Documents\LaxHornet`.
- Local database URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

The local stack uses the project ID in `supabase/config.toml` only as a local container-name namespace. The commands below do not link to or modify the remote project.

## Safety rules

Never run these commands as part of the local workflow:

```powershell
supabase link
supabase db push
supabase db reset --linked
supabase migration up --linked
supabase migration repair
```

Do not use host-managed Supabase app or connector mutation tools during this workflow.

Do not commit local API keys, JWT secrets, database credentials, generated branch metadata, or Docker state.

## Start the verified Windows stack

The full local stack produced an unhealthy Storage container on the verified Windows environment. Database migration verification does not require Storage, Imgproxy, Logflare, Vector, or the connection pooler.

Start the reduced stack:

```powershell
cd C:\Users\user\Documents\LaxHornet

supabase start `
  --exclude storage-api,imgproxy,logflare,vector
```

Expected result:

- Database starts successfully.
- Migrations apply in filename order.
- Studio, Auth, REST, Realtime, Edge Runtime, Mailpit, PgMeta, and Kong become available.
- Storage, Imgproxy, Analytics/Logflare, Vector, and Pooler remain stopped or excluded.

## Verify status

```powershell
supabase status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected healthy containers include:

- `supabase_db_*`
- `supabase_studio_*`
- `supabase_pg_meta_*`
- `supabase_rest_*`
- `supabase_realtime_*`
- `supabase_inbucket_*`
- `supabase_auth_*`
- `supabase_kong_*`

## Clean migration rebuild

Use the explicit local flag:

```powershell
supabase db reset --local
```

The verified migration order is:

1. `20260723000000_laxhornet_legacy_baseline.sql`
2. `20260723010000_trust_spine_release_1.sql`
3. `20260723010607_remote_schema.sql`
4. `20260723020000_minimum_necessary_disclosure.sql`
5. `20260723030000_fix_disclosure_audit_and_evidence_validation.sql`
6. `20260723040000_event_pipeline_capabilities.sql`

The clean local reset completed successfully with all six migrations applied. The `NOTICE` messages about missing policies/functions or already-existing columns are expected idempotency notices from the legacy baseline and are not migration failures.

## Stop the local stack

```powershell
supabase stop --no-backup
```

Use `--no-backup` when the goal is a disposable verification environment.

## Repository cleanliness

The CLI may generate:

```text
supabase/.branches/
```

This path is local metadata and is ignored by Git. After testing:

```powershell
git status --short
```

The working tree should be clean unless an approved ticket intentionally changed repository files.

## Verified outcome

LH-DEV-002 established that the committed migration sequence can rebuild a clean local Supabase database on Windows without linking to, pushing to, resetting, repairing, or otherwise contacting production.

## v284 local-only public-disclosure fixture

The v284 disclosure gate uses a disposable local project when normal REST
prerequisite seeding is correctly blocked by least-privilege grants:

```powershell
node tools/v284_local_disclosure_fixture.mjs
```

The runner:

- copies `supabase/` into a temporary directory and rewrites only the copied
  project ID to `laxhornet-v284-disclosure-local`;
- rejects the production project reference, production host, non-loopback
  endpoints, unexpected ports, database names, and container names before any
  fixture write;
- creates only synthetic adults, teams, players, games, events, grants, and
  tracked-time operations whose IDs begin `v284-disclosure-local-`;
- uses direct local `psql` only for prerequisite seeding and cleanup, then
  exercises disclosure through the normal RPC, anonymous REST, and browser
  paths;
- validates canonical nine-key lifecycle records individually so JSON payloads
  cannot silently omit `undefined` fields;
- revokes the token, deletes mutable rows and local Auth users, verifies zero
  remaining fixture rows, stops the stack with `--no-backup`, and removes the
  temporary project.

Run the safety contracts before the integration runner:

```powershell
node tools/test_v284_local_disclosure_fixture.mjs
```

This harness must never be linked to a remote project and must never be used
with production credentials or real youth, family, team, player, or game data.
