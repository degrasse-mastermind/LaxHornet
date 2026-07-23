import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(evidenceDir, "..", "..");
const moduleSpecifier = process.env.PGLITE_MODULE_PATH
  ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href
  : "@electric-sql/pglite";
const { PGlite } = await import(moduleSpecifier);

const read = (relativePath) => fs.readFileSync(path.join(evidenceDir, relativePath), "utf8");
const baseMigration = read("sql/00_TRUST_SPINE_BASE_STAGING_MIGRATION.sql").replace(
  /^create extension if not exists pgcrypto with schema extensions;\s*$/im,
  "-- PGlite compatibility harness supplies extensions.digest below.",
);
const disclosureMigration = read("sql/01_MINIMUM_DISCLOSURE_STAGING_MIGRATION.sql");
const disclosureRollback = read("sql/98_MINIMUM_DISCLOSURE_STAGING_ROLLBACK.sql");
const baseRollback = read("sql/99_TRUST_SPINE_BASE_STAGING_ROLLBACK.sql");
const testUserId = "11111111-1111-4111-8111-111111111111";
const fixture = read("tests/STAGING_DISCLOSURE_FIXTURE_TEMPLATE.sql").replaceAll("__TEST_USER_ID__", testUserId);

const db = new PGlite();
const results = [];

function pass(name, evidence = {}) {
  results.push({ name, status: "pass", evidence });
  console.log(`PASS: ${name} ${JSON.stringify(evidence)}`);
}

function assert(condition, name, evidence = {}) {
  if (!condition) throw new Error(`${name}\n${JSON.stringify(evidence, null, 2)}`);
  pass(name, evidence);
}

async function one(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows[0];
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key, email text);
    create or replace function extensions.digest(value bytea, algorithm text)
    returns bytea language sql immutable strict as $$ select value $$;
    create or replace function auth.uid()
    returns uuid language sql stable as $$
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
    grant select on table public.games, public.events to anon, authenticated;
    insert into public.teams(id, name, invite_code)
    values ('legacy-team-sentinel', 'Legacy Sentinel', 'SENTINEL');
    insert into public.roster_players(id, team_id, name)
    values ('legacy-player-sentinel', 'legacy-team-sentinel', 'Legacy Sentinel Player');
    insert into public.games(id, share_code, opponent, game_date)
    values ('legacy-game-sentinel', 'LEGACY-SENTINEL', 'Legacy Opponent', date '2026-01-01');
    insert into public.events(id, game_id)
    values ('legacy-event-sentinel', 'legacy-game-sentinel');
  `);

  await db.exec(baseMigration);
  await db.exec(disclosureMigration);
  await db.exec(fixture);
  pass("base and disclosure migrations apply", { synthetic: true });

  const privileges = await one(`
    select
      has_table_privilege('anon', 'public.games', 'select') as anon_games,
      has_table_privilege('anon', 'public.events', 'select') as anon_events,
      has_table_privilege('anon', 'public.lh_live_share_tokens', 'select') as anon_tokens,
      has_table_privilege('anon', 'public.lh_security_audit_events', 'select') as anon_audit,
      has_function_privilege('anon', 'public.lh_public_live_share_game(text)', 'execute') as anon_public_rpc,
      has_function_privilege('anon', 'public.lh_create_live_share_token(text,timestamptz)', 'execute') as anon_create_token,
      has_function_privilege('authenticated', 'public.lh_create_live_share_token(text,timestamptz)', 'execute') as auth_create_token
  `);
  assert(
    !privileges.anon_games && !privileges.anon_events && !privileges.anon_tokens && !privileges.anon_audit,
    "anonymous ordinary and private table privileges are denied",
    privileges,
  );
  assert(privileges.anon_public_rpc && !privileges.anon_create_token && privileges.auth_create_token, "RPC grants are purpose-bounded", privileges);

  await db.exec(`select pg_catalog.set_config('request.jwt.claims', '{"sub":"${testUserId}"}', false); set role authenticated;`);
  const created = await one(`select public.lh_create_live_share_token('disclosure-game', null) as result`);
  assert(created.result?.outcome === "accepted" && /^[A-F0-9]{32}$/.test(created.result.shareCode), "authenticated actor creates a game-scoped random token", {
    outcome: created.result?.outcome,
    codeLength: created.result?.shareCode?.length,
  });
  const shareCode = created.result.shareCode;

  await db.exec("reset role; set role anon;");
  const shared = await one("select public.lh_public_live_share_game($1) as result", [shareCode]);
  const gameKeys = Object.keys(shared.result.game).sort();
  const eventKeys = Object.keys(shared.result.events[0]).sort();
  const expectedGameKeys = [
    "final_score_against", "final_score_for", "game_date", "game_id", "jersey_number",
    "opponent", "period_format", "player_name", "position", "team_name",
  ].sort();
  const expectedEventKeys = [
    "category", "event_id", "field_zone", "occurred_at", "period", "point_value", "stat_label", "stat_type",
  ].sort();
  assert(JSON.stringify(gameKeys) === JSON.stringify(expectedGameKeys), "anonymous game response uses the exact allowlist", { gameKeys });
  assert(JSON.stringify(eventKeys) === JSON.stringify(expectedEventKeys), "anonymous event response uses the exact allowlist", { eventKeys });
  const serialized = JSON.stringify(shared.result).toLowerCase();
  assert(!["note", "tags", "user_id", "grant_id", "revision", "operation", "focus", "email"].some((key) => serialized.includes(`"${key}"`)), "public response excludes private and authority fields");

  for (const code of ["UNKNOWNLIVE1234567890", "EXPIREDTOKEN1234567890", "REVOKEDTOKEN1234567890"]) {
    const unavailable = await one("select public.lh_public_live_share_game($1) as result", [code]);
    assert(unavailable.result === null, `${code.slice(0, 7).toLowerCase()} token fails neutrally`);
  }

  await db.exec(`reset role; select pg_catalog.set_config('request.jwt.claims', '{"sub":"${testUserId}"}', false); set role authenticated;`);
  const audited = await one(`select public.lh_record_disclosure_export('player_csv', 'game', 'disclosure-game', 'accepted') as result`);
  assert(audited.result?.outcome === "accepted" && audited.result?.recordedAt, "authorized export writes audit metadata", audited.result);
  await db.exec("reset role;");
  const auditRow = await one(`
    select details
    from public.lh_security_audit_events
    where audit_id = $1
  `, [audited.result.auditId]);
  assert(
    auditRow.details?.exportType === "player_csv" && auditRow.details?.scopeType === "game" && !Object.hasOwn(auditRow.details, "payload"),
    "export audit stores purpose metadata without payload",
    auditRow.details,
  );

  await db.exec(`select pg_catalog.set_config('request.jwt.claims', '{"sub":"${testUserId}"}', false); set role authenticated;`);
  const wrongAccountAudit = await one(`select public.lh_record_disclosure_export('full_backup', 'account', '22222222-2222-4222-8222-222222222222', 'accepted') as result`);
  assert(wrongAccountAudit.result?.outcome === "rejected" && wrongAccountAudit.result?.code === "unauthorized_scope", "account backup audit cannot name another account", wrongAccountAudit.result);
  const ownAccountAudit = await one(`select public.lh_record_disclosure_export('full_backup', 'account', '${testUserId}', 'accepted') as result`);
  assert(ownAccountAudit.result?.outcome === "accepted", "account backup audit accepts only the signed-in account scope", ownAccountAudit.result);
  await db.exec("reset role;");

  await db.exec(`select pg_catalog.set_config('request.jwt.claims', '{"sub":"${testUserId}"}', false); set role authenticated;`);
  const revoked = await one(`select public.lh_revoke_live_share_tokens('disclosure-game') as result`);
  assert(revoked.result?.outcome === "accepted" && revoked.result?.revokedTokenCount >= 1, "authorized actor revokes active game tokens", revoked.result);
  await db.exec("reset role; set role anon;");
  const afterRevoke = await one("select public.lh_public_live_share_game($1) as result", [shareCode]);
  assert(afterRevoke.result === null, "revoked generated token can no longer disclose the game");
  await db.exec("reset role;");

  await db.exec(disclosureRollback);
  await db.exec(baseRollback);
  const rollback = await one(`
    select
      (select count(*)::int from pg_catalog.pg_tables where schemaname = 'public' and tablename like 'lh_%') as trust_tables,
      (select count(*)::int from public.games where id = 'legacy-game-sentinel') as legacy_games,
      (select count(*)::int from public.events where id = 'legacy-event-sentinel') as legacy_events,
      has_table_privilege('anon', 'public.games', 'select') as anon_games_restored,
      has_table_privilege('anon', 'public.events', 'select') as anon_events_restored
  `);
  assert(
    rollback.trust_tables === 0 && rollback.legacy_games === 1 && rollback.legacy_events === 1 && rollback.anon_games_restored && rollback.anon_events_restored,
    "rollback removes staging objects and preserves legacy sentinels",
    rollback,
  );

  console.log(JSON.stringify({
    suite: "LaxHornet minimum-necessary disclosure PGlite rehearsal",
    repoRoot,
    synthetic: true,
    testsPassed: results.length,
    results,
  }, null, 2));
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
} finally {
  await db.close();
}
