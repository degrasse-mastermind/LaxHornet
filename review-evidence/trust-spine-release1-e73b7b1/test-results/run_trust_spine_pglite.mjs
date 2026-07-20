import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] || path.join(scriptDir, ".."));
const gateDir = path.join(repoRoot, "docs", "methodnorth", "trust-spine-gate");
const migration = fs
  .readFileSync(path.join(gateDir, "TRUST_SPINE_SCHEMA_PROPOSAL.sql"), "utf8")
  .replace(
    /^create extension if not exists pgcrypto with schema extensions;\s*$/im,
    "-- PGlite compatibility harness: pgcrypto is supplied by the target Supabase Postgres.",
  );
const tests = fs
  .readFileSync(path.join(gateDir, "TRUST_SPINE_STAGING_TESTS.sql"), "utf8")
  .replace(/^\\set\s+ON_ERROR_STOP\s+on\s*$/im, "");
const rollback = fs
  .readFileSync(path.join(gateDir, "TRUST_SPINE_STAGING_ROLLBACK.sql"), "utf8")
  .replace(/^\\set\s+ON_ERROR_STOP\s+on\s*$/im, "");

const db = new PGlite();
const output = [];

function log(label, value) {
  const line = `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`;
  output.push(line);
  console.log(line);
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema extensions;
    create or replace function extensions.digest(value bytea, algorithm text)
    returns bytea
    language sql
    immutable
    strict
    as $$
      select value
    $$;
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(
        (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
        ''
      )::uuid
    $$;
    grant usage on schema auth, extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function extensions.digest(bytea, text) to anon, authenticated;

    create table public.games(id text primary key);
    create table public.events(id text primary key);
    create table public.teams(id text primary key);
    create table public.roster_players(id text primary key);
    insert into public.games(id) values ('legacy-game-sentinel');
    insert into public.events(id) values ('legacy-event-sentinel');
    insert into public.teams(id) values ('legacy-team-sentinel');
    insert into public.roster_players(id) values ('legacy-player-sentinel');
  `);

  await db.exec(migration);
  const migratedTables = await db.query(`
    select count(*)::int as count
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename like 'lh_%'
  `);
  log("MIGRATION", "PASS");
  log("TRUST_SPINE_TABLES", migratedTables.rows[0]?.count ?? null);

  const testResults = await db.exec(tests);
  const suiteRow = [...testResults]
    .reverse()
    .flatMap((result) => result.rows || [])
    .find(
      (row) =>
        row.trust_spine_test_result?.suite === "LaxHornet Trust Spine Release 1",
    );
  log(
    "SQL_ACCEPTANCE",
    suiteRow?.trust_spine_test_result || "PASS (suite transaction rolled back)",
  );

  await db.exec(rollback);
  const remaining = await db.query(`
    select count(*)::int as count
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename like 'lh_%'
  `);
  const sentinels = await db.query(`
    select
      (select count(*)::int from public.games) as games,
      (select count(*)::int from public.events) as events,
      (select count(*)::int from public.teams) as teams,
      (select count(*)::int from public.roster_players) as roster_players
  `);
  log("ROLLBACK", remaining.rows[0]?.count === 0 ? "PASS" : "FAIL");
  log("TRUST_SPINE_TABLES_AFTER_ROLLBACK", remaining.rows[0]?.count ?? null);
  log("LEGACY_SENTINELS_AFTER_ROLLBACK", sentinels.rows[0]);
} catch (error) {
  log("FAIL", error?.stack || error?.message || String(error));
  process.exitCode = 1;
} finally {
  await db.close();
}
