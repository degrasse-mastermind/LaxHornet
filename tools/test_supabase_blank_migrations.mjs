import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] || path.join(scriptDir, ".."));
const moduleSpecifier = process.env.PGLITE_MODULE_PATH
  ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href
  : "@electric-sql/pglite";
const { PGlite } = await import(moduleSpecifier);

const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const legacyBaseline = fs.readFileSync(
  path.join(migrationsDir, "20260723000000_laxhornet_legacy_baseline.sql"),
  "utf8",
);
const trustSpine = fs
  .readFileSync(
    path.join(migrationsDir, "20260723010000_trust_spine_release_1.sql"),
    "utf8",
  )
  .replace(
    /^create extension if not exists pgcrypto with schema extensions;\s*$/im,
    "-- PGlite compatibility harness supplies extensions.digest below.",
  );
const minimumDisclosure = fs.readFileSync(
  path.join(migrationsDir, "20260723020000_minimum_necessary_disclosure.sql"),
  "utf8",
);

const requiredLegacyTables = [
  "events",
  "games",
  "notification_queue",
  "player_claims",
  "roster_players",
  "team_access_requests",
  "team_members",
  "teams",
  "user_profiles",
];

function assert(condition, label, evidence = {}) {
  if (!condition) {
    throw new Error(`${label}\n${JSON.stringify(evidence, null, 2)}`);
  }
  console.log(`PASS: ${label} ${JSON.stringify(evidence)}`);
}

async function bootstrapSupabaseCompatibility(db) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema extensions;
    create table auth.users(
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
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
    create or replace function auth.jwt()
    returns jsonb
    language sql
    stable
    as $$
      select coalesce(
        nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
      )
    $$;
    create or replace function extensions.digest(value bytea, algorithm text)
    returns bytea
    language sql
    immutable
    strict
    as $$
      select value
    $$;
    grant usage on schema auth, extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
    grant execute on function extensions.digest(bytea, text) to anon, authenticated;
    create publication supabase_realtime;
  `);
}

async function proveMissingBaselineFails() {
  const db = new PGlite();
  try {
    await bootstrapSupabaseCompatibility(db);
    let failure = null;
    try {
      await db.exec(trustSpine);
    } catch (error) {
      failure = error;
    }
    assert(
      failure && /public\.(team_members|teams|roster_players|player_claims|games)/i.test(String(failure)),
      "Trust Spine cannot apply when the required legacy baseline is absent",
      { error: String(failure).split("\n")[0] },
    );
  } finally {
    await db.close();
  }
}

async function proveBlankDatabaseBuilds() {
  const db = new PGlite();
  try {
    await bootstrapSupabaseCompatibility(db);
    await db.exec(legacyBaseline);
    await db.exec(trustSpine);
    await db.exec(minimumDisclosure);
    console.log("PASS: all three migrations apply from a blank database");

    const legacyTables = await db.query(`
      select tablename
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename
    `, [requiredLegacyTables]);
    assert(
      legacyTables.rows.length === requiredLegacyTables.length,
      "all required legacy tables exist",
      { tables: legacyTables.rows.map((row) => row.tablename) },
    );

    const trustTables = await db.query(`
      select tablename, rowsecurity
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename like 'lh_%'
      order by tablename
    `);
    assert(
      trustTables.rows.length === 20,
      "exactly 20 Trust Spine tables exist",
      { count: trustTables.rows.length },
    );
    assert(
      trustTables.rows.every((row) => row.rowsecurity),
      "RLS is enabled on every Trust Spine table",
      {
        disabled: trustTables.rows
          .filter((row) => !row.rowsecurity)
          .map((row) => row.tablename),
      },
    );

    const legacyRls = await db.query(`
      select tablename, rowsecurity
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename
    `, [requiredLegacyTables]);
    assert(
      legacyRls.rows.every((row) => row.rowsecurity),
      "legacy RLS configuration is preserved",
      {
        disabled: legacyRls.rows
          .filter((row) => !row.rowsecurity)
          .map((row) => row.tablename),
      },
    );

    const privileges = await db.query(`
      select
        has_table_privilege('anon', 'public.games', 'select') as anon_games,
        has_table_privilege('anon', 'public.events', 'select') as anon_events,
        has_table_privilege('authenticated', 'public.games', 'select') as auth_games,
        has_table_privilege('authenticated', 'public.events', 'select') as auth_events,
        has_function_privilege(
          'anon',
          'public.lh_public_live_share_game(text)',
          'execute'
        ) as anon_live_share
    `);
    const access = privileges.rows[0];
    assert(
      !access.anon_games &&
        !access.anon_events &&
        access.auth_games &&
        access.auth_events &&
        access.anon_live_share,
      "minimum disclosure preserves authenticated reads and denies anonymous ordinary-table reads",
      access,
    );

    const policyRows = await db.query(`
      select tablename, policyname, roles
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and policyname in (
          'laxhornet read own or shared games',
          'laxhornet read own or shared events'
        )
      order by tablename
    `);
    assert(
      policyRows.rows.length === 2 &&
        policyRows.rows.every(
          (row) =>
            Array.isArray(row.roles) &&
            row.roles.includes("authenticated") &&
            !row.roles.includes("anon"),
        ),
      "legacy game and event policies are narrowed to authenticated after disclosure",
      { policies: policyRows.rows },
    );

    const rowCounts = {};
    for (const table of requiredLegacyTables) {
      const result = await db.query(
        `select count(*)::int as count from public.${table}`,
      );
      rowCounts[table] = result.rows[0].count;
    }
    assert(
      Object.values(rowCounts).every((count) => count === 0),
      "the canonical baseline embeds no legacy data rows",
      rowCounts,
    );

    const legacyFunctions = await db.query(`
      select count(*)::int as count
      from pg_catalog.pg_proc as proc
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = proc.pronamespace
      where namespace.nspname = 'public'
        and proc.proname like 'laxhornet_%'
    `);
    assert(
      legacyFunctions.rows[0].count === 34,
      "all canonical legacy LaxHornet functions exist",
      legacyFunctions.rows[0],
    );

    const legacyIndexes = await db.query(`
      select count(*)::int as count
      from pg_catalog.pg_indexes
      where schemaname = 'public'
        and indexname in (
          'games_player_id_idx',
          'games_team_id_idx',
          'games_roster_player_id_idx',
          'games_user_id_idx',
          'games_share_code_idx',
          'events_user_id_idx',
          'events_team_id_idx',
          'events_roster_player_id_idx',
          'events_game_id_timestamp_idx',
          'teams_invite_code_idx',
          'teams_tracker_code_idx',
          'teams_created_by_idx',
          'team_members_team_id_idx',
          'team_members_user_id_idx',
          'roster_players_team_id_idx',
          'team_access_requests_team_id_idx',
          'team_access_requests_user_id_idx',
          'notification_queue_status_idx',
          'player_claims_team_id_idx',
          'player_claims_user_id_idx',
          'player_claims_roster_player_id_idx',
          'user_profiles_email_idx',
          'user_profiles_admin_status_idx'
        )
    `);
    assert(
      legacyIndexes.rows[0].count === 23,
      "all canonical named legacy indexes exist",
      legacyIndexes.rows[0],
    );

    console.log(JSON.stringify({
      suite: "LaxHornet blank Supabase migration regression",
      migrations: [
        "20260723000000_laxhornet_legacy_baseline.sql",
        "20260723010000_trust_spine_release_1.sql",
        "20260723020000_minimum_necessary_disclosure.sql",
      ],
      requiredLegacyTables,
      trustSpineTableCount: trustTables.rows.length,
      legacyDataRows: rowCounts,
    }, null, 2));
  } finally {
    await db.close();
  }
}

await proveMissingBaselineFails();
await proveBlankDatabaseBuilds();
