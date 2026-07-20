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
    create table auth.users(
      id uuid primary key,
      email text
    );
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

    create table public.teams(
      id text primary key,
      name text not null,
      invite_code text not null unique,
      tracker_code text unique,
      created_by uuid,
      created_at timestamptz not null default now()
    );
    create table public.team_members(
      id text primary key,
      team_id text not null,
      user_id uuid not null,
      role text not null default 'member',
      created_at timestamptz not null default now(),
      unique(team_id, user_id)
    );
    create table public.roster_players(
      id text primary key,
      team_id text not null,
      name text not null,
      number text not null default '',
      position text not null default '',
      active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table public.player_claims(
      id text primary key,
      team_id text not null,
      roster_player_id text not null,
      user_id uuid not null,
      created_at timestamptz not null default now(),
      unique(team_id, user_id, roster_player_id)
    );
    create table public.games(
      id text primary key,
      player_id text,
      user_id uuid,
      share_code text not null unique,
      is_shared boolean not null default false,
      opponent text not null,
      game_date date not null,
      location text,
      game_type text,
      period_format text not null default 'quarters',
      player_snapshot jsonb not null default '{}'::jsonb,
      current_quarter text not null default 'Q1',
      status text not null default 'in-progress',
      created_at timestamptz not null default now(),
      saved_at timestamptz,
      ended_at timestamptz,
      team_id text,
      roster_player_id text
    );
    create table public.events(
      id text primary key,
      game_id text,
      user_id uuid,
      timestamp timestamptz,
      quarter text,
      stat_type text,
      stat_label text,
      category text,
      point_value integer not null default 0
    );
    insert into public.teams(id, name, invite_code)
    values ('legacy-team-sentinel', 'Legacy Sentinel', 'SENTINEL');
    insert into public.roster_players(id, team_id, name)
    values ('legacy-player-sentinel', 'legacy-team-sentinel', 'Legacy Sentinel Player');
    insert into public.games(id, share_code, opponent, game_date)
    values ('legacy-game-sentinel', 'LEGACY-SENTINEL', 'Legacy Opponent', date '2026-01-01');
    insert into public.events(id, game_id)
    values ('legacy-event-sentinel', 'legacy-game-sentinel');
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
