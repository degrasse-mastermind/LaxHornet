import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(import.meta.dirname, "..");
const migrationRoot = path.join(root, "supabase", "migrations");
const archivePath = path.join(
  root,
  "supabase",
  "production-history",
  "20260723010607_remote_schema.sql",
);
const markerPath = path.join(migrationRoot, "20260723010607_remote_schema.sql");
const migrationNames = [
  "20260723000000_laxhornet_legacy_baseline.sql",
  "20260723010000_trust_spine_release_1.sql",
  "20260723010607_remote_schema.sql",
  "20260723020000_minimum_necessary_disclosure.sql",
  "20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
  "20260723040000_event_pipeline_capabilities.sql",
];
const migrationSql = Object.fromEntries(
  migrationNames.map((name) => [
    name,
    fs.readFileSync(path.join(migrationRoot, name), "utf8"),
  ]),
);
const archive = fs.readFileSync(archivePath);
const archiveSql = archive.toString("utf8");
const marker = fs.readFileSync(markerPath, "utf8");

const digest = (algorithm, value) =>
  createHash(algorithm).update(value).digest("hex");

function parseStatements(text) {
  const matches = [...text.matchAll(
    /^-- statement (\d+) \| md5 ([a-f0-9]{32}) \| chars (\d+)\r?$/gm,
  )];
  return matches.map((match, index) => {
    assert.equal(Number(match[1]), index + 1, "historical statement order changed");
    const start = match.index + match[0].length
      + (text.slice(match.index + match[0].length).startsWith("\r\n") ? 2 : 1);
    const statement = text.slice(start, start + Number(match[3]));
    assert.equal(statement.length, Number(match[3]), `statement ${index + 1} length changed`);
    assert.equal(digest("md5", statement), match[2], `statement ${index + 1} changed`);
    return statement;
  });
}

function assertCommentOnly(text) {
  const executable = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--"));
  assert.deepEqual(executable, [], "historical marker contains executable SQL");
}

function pgliteCompatible(sql) {
  return sql.replace(
    /^create extension if not exists[^\r\n]*(?:\r?\n;)?\s*$/gim,
    "-- PGlite fixture supplies platform extensions.",
  );
}

async function setupFixture(db) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create schema extensions;
    create table auth.users(
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid()
    returns uuid language sql stable as $$ select null::uuid $$;
    create or replace function auth.jwt()
    returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create or replace function extensions.digest(value bytea, algorithm text)
    returns bytea language sql immutable strict as $$ select value $$;
    grant usage on schema auth, extensions to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant execute on function auth.jwt() to anon, authenticated, service_role;
    grant execute on function extensions.digest(bytea, text) to anon, authenticated, service_role;
    create publication supabase_realtime;
  `);
}

async function captureCatalog(db) {
  const query = async (sql) => (await db.query(sql)).rows;
  return {
    relations: await query(`
      select n.nspname schema_name,c.relname relation_name,c.relkind,
             c.relrowsecurity rls_enabled,c.relforcerowsecurity rls_forced
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname in ('public','lh_trust_private')
         and c.relkind in ('r','p','v','m','S')
       order by 1,2
    `),
    columns: await query(`
      select table_schema,table_name,ordinal_position,column_name,data_type,
             udt_schema,udt_name,is_nullable,column_default
        from information_schema.columns
       where table_schema in ('public','lh_trust_private')
       order by 1,2,3
    `),
    functions: await query(`
      select n.nspname schema_name,p.proname function_name,
             pg_get_function_identity_arguments(p.oid) identity_arguments,
             pg_get_function_result(p.oid) result_type,
             l.lanname language,p.prosecdef security_definer,
             p.provolatile volatility,pg_get_functiondef(p.oid) definition
        from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace
        join pg_language l on l.oid=p.prolang
       where n.nspname in ('public','lh_trust_private')
       order by 1,2,3
    `),
    constraints: await query(`
      select n.nspname schema_name,c.relname relation_name,k.conname,
             k.contype,pg_get_constraintdef(k.oid,true) definition
        from pg_constraint k
        join pg_class c on c.oid=k.conrelid
        join pg_namespace n on n.oid=c.relnamespace
       where n.nspname in ('public','lh_trust_private')
       order by 1,2,3
    `),
    indexes: await query(`
      select schemaname schema_name,tablename relation_name,indexname,
             indexdef definition
        from pg_indexes
       where schemaname in ('public','lh_trust_private')
       order by 1,2,3
    `),
    policies: await query(`
      select schemaname schema_name,tablename relation_name,policyname,
             permissive,roles,cmd,qual,with_check
        from pg_policies
       where schemaname in ('public','lh_trust_private')
       order by 1,2,3
    `),
    triggers: await query(`
      select n.nspname schema_name,c.relname relation_name,t.tgname,
             pg_get_triggerdef(t.oid,true) definition
        from pg_trigger t
        join pg_class c on c.oid=t.tgrelid
        join pg_namespace n on n.oid=c.relnamespace
       where not t.tgisinternal
         and n.nspname in ('public','auth','lh_trust_private')
       order by 1,2,3
    `),
  };
}

const normalize = (value) => {
  const comparable = structuredClone(value);
  if (comparable.columns) {
    comparable.columns = comparable.columns
      .map(({ ordinal_position: _ordinalPosition, ...column }) => column)
      .sort((left, right) =>
        `${left.table_schema}.${left.table_name}.${left.column_name}`.localeCompare(
          `${right.table_schema}.${right.table_name}.${right.column_name}`,
        ));
  }
  const normalizeValue = (item) => {
    if (Array.isArray(item)) return item.map(normalizeValue);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).map(([key, nested]) => [key, normalizeValue(nested)]),
      );
    }
    if (typeof item !== "string") return item;
    return item
      .toLowerCase()
      .replaceAll('"', "")
      .replace(/\bpg_catalog\./g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([(),;=<>])\s*/g, "$1")
      .trim();
  };
  return JSON.stringify(normalizeValue(comparable));
};

async function applySequence(db) {
  for (const name of migrationNames) {
    await db.exec(pgliteCompatible(migrationSql[name]));
  }
}

const statements = parseStatements(archiveSql);
assert.equal(statements.length, 350);
assert.equal(
  digest("md5", statements.join("\n-- statement boundary --\n")),
  "ea4aeff5aff66a88dae1211b93e3a1fa",
);
assert.equal(
  digest("sha256", archive),
  "c8bd4bc55cc13b6506ccb859cf658f6962beec65f91d713f0867c91b4b046c82",
);
assertCommentOnly(marker);

const blankDb = new PGlite();
const productionDb = new PGlite();
try {
  await setupFixture(blankDb);
  await applySequence(blankDb);
  await blankDb.exec("set search_path=public,auth");
  const blankCatalog = await captureCatalog(blankDb);

  await setupFixture(productionDb);
  await productionDb.exec(pgliteCompatible(archiveSql));
  await productionDb.exec(`
    create trigger laxhornet_on_auth_user_created
    after insert on auth.users for each row
    execute function public.laxhornet_handle_new_user();
    insert into auth.users(id,email)
    values ('00000000-0000-0000-0000-000000000001','synthetic-ledger-test@example.invalid');
    insert into public.teams(id,name,invite_code,created_by)
    values ('ledger-team','Synthetic Ledger Team','LEDGER-ONLY','00000000-0000-0000-0000-000000000001');
    insert into public.roster_players(id,team_id,name,number)
    values ('ledger-player','ledger-team','Synthetic Ledger Player','00');
    insert into public.games(id,user_id,share_code,opponent,game_date,team_id,roster_player_id)
    values ('ledger-game','00000000-0000-0000-0000-000000000001','LEDGER-SHARE',
            'Synthetic Opponent',date '2026-01-01','ledger-team','ledger-player');
    insert into public.events(
      id,game_id,user_id,timestamp,quarter,stat_type,stat_label,category,
      team_id,roster_player_id
    ) values (
      'ledger-event','ledger-game','00000000-0000-0000-0000-000000000001',
      timestamptz '2026-01-01 00:00:00+00','Q1','ledger','Synthetic Ledger Event',
      'ledger','ledger-team','ledger-player'
    );
  `);
  await applySequence(productionDb);
  await productionDb.exec("set search_path=public,auth");
  const productionCatalog = await captureCatalog(productionDb);

  const sentinels = (await productionDb.query(`
    select
      (select count(*)::int from auth.users where id='00000000-0000-0000-0000-000000000001') auth_users,
      (select count(*)::int from public.teams where id='ledger-team') teams,
      (select count(*)::int from public.roster_players where id='ledger-player') roster_players,
      (select count(*)::int from public.games where id='ledger-game') games,
      (select count(*)::int from public.events where id='ledger-event') events
  `)).rows[0];
  assert.deepEqual(sentinels, {
    auth_users: 1,
    teams: 1,
    roster_players: 1,
    games: 1,
    events: 1,
  });

  const accessFunction = (await productionDb.query(`
    select pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname='laxhornet_request_team_player_access'
       and p.pronargs=2
  `)).rows[0]?.definition || "";
  assert.match(accessFunction, /notification_queue/i);
  assert.match(accessFunction, /team_access_requested_user/i);

  const capability = (await productionDb.query(
    "select public.lh_release_capabilities() capability",
  )).rows[0]?.capability;
  assert.equal(Number(capability?.schemaVersion), 1);
  const functionSignatures = (catalog) => catalog.functions.map(
    ({ definition: _definition, ...signature }) => signature,
  );
  for (const category of Object.keys(blankCatalog)) {
    const productionCategory = category === "functions"
      ? functionSignatures(productionCatalog)
      : productionCatalog[category];
    const blankCategory = category === "functions"
      ? functionSignatures(blankCatalog)
      : blankCatalog[category];
    assert.equal(
      normalize({ [category]: productionCategory }),
      normalize({ [category]: blankCategory }),
      `final ${category} catalogs differ`,
    );
  }

  console.log("ARCHIVE_IDENTITY: PASS (350 statements)");
  console.log("COMMENT_ONLY_MARKER: PASS");
  console.log("BLANK_DATABASE_SEQUENCE: PASS");
  console.log("PRODUCTION_SHAPED_UPGRADE: PASS");
  console.log(`SENTINELS_SURVIVED: ${JSON.stringify(sentinels)}`);
  console.log("ACCESS_REQUEST_FUNCTION_UPGRADED: PASS");
  console.log("FINAL_SCHEMA_EQUIVALENCE: PASS");
  console.log("SCHEMA_CAPABILITY: 1");
} finally {
  await blankDb.close();
  await productionDb.close();
}
