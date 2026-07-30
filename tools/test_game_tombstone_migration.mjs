import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const baseline = fs.readFileSync(
  path.join(migrations, "20260723000000_laxhornet_legacy_baseline.sql"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(migrations, "20260730134439_durable_game_tombstones.sql"),
  "utf8",
);
const rollback = fs.readFileSync(
  path.join(root, "supabase", "rollback", "20260730134439_durable_game_tombstones_rollback.sql"),
  "utf8",
);

const ACCOUNT_A = "00000000-0000-4000-8000-00000000000a";
const ACCOUNT_B = "00000000-0000-4000-8000-00000000000b";

function check(condition, message, evidence = {}) {
  assert.ok(condition, `${message}\n${JSON.stringify(evidence, null, 2)}`);
  console.log(`PASS: ${message}`);
}

async function bootstrap(db) {
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
        nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
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
    grant usage on schema auth, extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(baseline);
  await db.exec(migration);
  await db.exec(`
    insert into auth.users(id, email)
    values
      ('${ACCOUNT_A}', 'synthetic-a@example.invalid'),
      ('${ACCOUNT_B}', 'synthetic-b@example.invalid');
  `);
}

async function asAccount(db, accountId, sql, params = []) {
  await db.exec("reset role");
  await db.exec(`select set_config(
    'request.jwt.claims',
    '{"sub":"${accountId}","role":"authenticated","email":"synthetic@example.invalid"}',
    false
  )`);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

function deletePayload(overrides = {}) {
  return {
    game_id: "game-123",
    account_id: ACCOUNT_A,
    deletion_id: "delete-123",
    device_id: "device-a",
    deleted_at: "2026-07-30T14:00:00.000Z",
    known_game_saved_at: "2026-07-30T13:55:00.000Z",
    ...overrides,
  };
}

const db = new PGlite();
try {
  await bootstrap(db);
  await db.exec(`
    insert into public.games(
      id, user_id, share_code, opponent, game_date, created_at, saved_at
    )
    values (
      'game-123',
      '${ACCOUNT_A}',
      'SYNTHETIC123',
      'Synthetic Opponent',
      date '2026-07-30',
      timestamptz '2026-07-30T13:00:00.000Z',
      timestamptz '2026-07-30T13:55:00.000Z'
    );
  `);

  const accepted = await asAccount(
    db,
    ACCOUNT_A,
    "select public.laxhornet_delete_game_durable($1::jsonb) as result",
    [deletePayload()],
  );
  check(
    accepted.rows[0].result.outcome === "accepted"
      && accepted.rows[0].result.code === "game_deleted",
    "authorized delete creates a new durable tombstone",
    accepted.rows[0],
  );

  const durableRows = await db.query(`
    select
      (select count(*)::int from public.games where id = 'game-123') as games,
      (select count(*)::int from public.legacy_game_tombstones where game_id = 'game-123') as tombstones
  `);
  check(
    durableRows.rows[0].games === 0 && durableRows.rows[0].tombstones === 1,
    "game removal and tombstone insertion commit together",
    durableRows.rows[0],
  );

  const replay = await asAccount(
    db,
    ACCOUNT_A,
    "select public.laxhornet_delete_game_durable($1::jsonb) as result",
    [deletePayload()],
  );
  check(
    replay.rows[0].result.outcome === "accepted"
      && replay.rows[0].result.code === "game_delete_replayed",
    "same deletion ID is an accepted replay",
    replay.rows[0],
  );

  const differentDelete = await asAccount(
    db,
    ACCOUNT_A,
    "select public.laxhornet_delete_game_durable($1::jsonb) as result",
    [deletePayload({ deletion_id: "delete-other" })],
  );
  check(
    differentDelete.rows[0].result.outcome === "conflicted"
      && differentDelete.rows[0].result.code === "game_already_deleted",
    "different deletion ID receives deterministic already-deleted conflict",
    differentDelete.rows[0],
  );

  const staleWrite = await asAccount(
    db,
    ACCOUNT_A,
    "select public.laxhornet_sync_game($1::jsonb) as result",
    [{
      operation_id: "write-stale",
      device_id: "device-b",
      payload_revision: 1,
      game_row: {
        id: "game-123",
        user_id: ACCOUNT_A,
        share_code: "SYNTHETIC123",
        opponent: "Stale Opponent",
        game_date: "2026-07-30",
        period_format: "quarters",
        player_snapshot: {},
        current_quarter: "Q1",
        status: "complete",
        created_at: "2026-07-30T13:00:00.000Z",
        saved_at: "2026-07-30T13:55:00.000Z",
      },
    }],
  );
  check(
    staleWrite.rows[0].result.outcome === "conflicted"
      && staleWrite.rows[0].result.code === "game_deleted",
    "guarded stale-device write receives deterministic deleted result",
    staleWrite.rows[0],
  );

  let directWriteFailure = null;
  try {
    await asAccount(db, ACCOUNT_A, `
      insert into public.games(
        id, user_id, share_code, opponent, game_date
      )
      values (
        'game-123',
        '${ACCOUNT_A}',
        'SYNTHETIC-OLD',
        'Old Client',
        date '2026-07-30'
      )
    `);
  } catch (error) {
    directWriteFailure = error;
  }
  check(
    /laxhornet_game_deleted/i.test(String(directWriteFailure)),
    "old-client direct upsert is blocked by the database trigger",
    { error: String(directWriteFailure).split("\n")[0] },
  );

  const crossAccountDelete = await asAccount(
    db,
    ACCOUNT_B,
    "select public.laxhornet_delete_game_durable($1::jsonb) as result",
    [deletePayload({ account_id: ACCOUNT_B, deletion_id: "delete-cross-account" })],
  );
  check(
    crossAccountDelete.rows[0].result.outcome === "rejected"
      && crossAccountDelete.rows[0].result.code === "authorization_denied",
    "cross-account deletion is rejected without changing evidence",
    crossAccountDelete.rows[0],
  );

  const hidden = await asAccount(
    db,
    ACCOUNT_B,
    "select count(*)::int as count from public.legacy_game_tombstones",
  );
  check(hidden.rows[0].count === 0, "RLS hides another account's tombstones", hidden.rows[0]);

  await db.exec(`
    insert into public.games(
      id, user_id, share_code, opponent, game_date, created_at, saved_at
    )
    values (
      'newer-game',
      '${ACCOUNT_A}',
      'SYNTHETICNEW',
      'Newer Opponent',
      date '2026-07-30',
      timestamptz '2026-07-30T13:00:00.000Z',
      timestamptz '2026-07-30T14:10:00.000Z'
    );
  `);
  const olderDelete = await asAccount(
    db,
    ACCOUNT_A,
    "select public.laxhornet_delete_game_durable($1::jsonb) as result",
    [deletePayload({
      game_id: "newer-game",
      deletion_id: "delete-older",
      known_game_saved_at: "2026-07-30T14:00:00.000Z",
    })],
  );
  check(
    olderDelete.rows[0].result.outcome === "conflicted"
      && olderDelete.rows[0].result.code === "newer_game_revision",
    "older delete cannot remove a legitimately newer game revision",
    olderDelete.rows[0],
  );

  let rollbackRefusal = null;
  try {
    await db.exec(rollback);
  } catch (error) {
    rollbackRefusal = error;
  }
  check(
    /Rollback refused: retain durable legacy game tombstones/i.test(String(rollbackRefusal)),
    "rollback refuses to discard activated tombstones",
    { error: String(rollbackRefusal).split("\n")[0] },
  );
} finally {
  await db.close();
}

const cleanDb = new PGlite();
try {
  await bootstrap(cleanDb);
  await cleanDb.exec(rollback);
  const reversed = await cleanDb.query(`
    select
      to_regclass('public.legacy_game_tombstones') is null as table_removed,
      to_regprocedure('public.laxhornet_delete_game_durable(jsonb)') is null as rpc_removed,
      has_table_privilege('authenticated', 'public.games', 'delete') as delete_restored
  `);
  check(
    reversed.rows[0].table_removed
      && reversed.rows[0].rpc_removed
      && reversed.rows[0].delete_restored,
    "pre-activation rollback reverses schema and restores legacy delete grant",
    reversed.rows[0],
  );
} finally {
  await cleanDb.close();
}

console.log("11 durable game tombstone migration checks passed.");
