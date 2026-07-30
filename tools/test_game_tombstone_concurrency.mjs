import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ACCOUNT_A = "00000000-0000-4000-8000-00000000000a";
const container = `laxhornet-r206a-${process.pid}`;
let checks = 0;

function check(condition, message, evidence = {}) {
  assert.ok(condition, `${message}\n${JSON.stringify(evidence, null, 2)}`);
  checks += 1;
  console.log(`PASS: ${message}`);
}

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout || 120000,
    input: options.input,
  });
  if (result.status !== 0) {
    throw new Error(
      `docker ${args.join(" ")} failed\n${result.stdout || ""}\n${result.stderr || ""}`,
    );
  }
  return result.stdout.trim();
}

function psql(sql) {
  return docker(
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { input: sql, timeout: 120000 },
  );
}

function psqlAsync(sql) {
  const child = spawn(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(sql);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`concurrent psql failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

function authenticated(sql) {
  return `
select set_config(
  'request.jwt.claims',
  '{"sub":"${ACCOUNT_A}","role":"authenticated","email":"synthetic@example.invalid"}',
  false
);
set role authenticated;
${sql}
reset role;
`;
}

function gameRow(gameId, savedAt, opponent) {
  return {
    id: gameId,
    user_id: ACCOUNT_A,
    share_code: `SYNTHETIC-${gameId}`,
    is_shared: false,
    opponent,
    game_date: "2026-07-30",
    period_format: "quarters",
    player_snapshot: {},
    current_quarter: "Q1",
    status: "complete",
    created_at: "2026-07-30T13:00:00.000Z",
    saved_at: savedAt,
  };
}

function writeSql(gameId, savedAt, opponent, operationId) {
  return `
select public.laxhornet_sync_game(
  $json$${JSON.stringify({
    operation_id: operationId,
    device_id: "device-write",
    payload_revision: 1,
    game_row: gameRow(gameId, savedAt, opponent),
  })}$json$::jsonb
)::text;
`;
}

function deleteSql(gameId, knownSavedAt, deletionId) {
  return `
select public.laxhornet_delete_game_durable(
  $json$${JSON.stringify({
    game_id: gameId,
    account_id: ACCOUNT_A,
    deletion_id: deletionId,
    device_id: "device-delete",
    deleted_at: "2026-07-30T14:30:00.000Z",
    known_game_saved_at: knownSavedAt,
  })}$json$::jsonb
)::text;
`;
}

function resultJson(output) {
  const line = output.split(/\r?\n/).reverse().find((value) => value.trim().startsWith("{"));
  assert.ok(line, `No JSON result found in output:\n${output}`);
  return JSON.parse(line);
}

const baseline = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260723000000_laxhornet_legacy_baseline.sql"),
  "utf8",
);
const tombstones = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260730134439_durable_game_tombstones.sql"),
  "utf8",
);
const concurrency = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260730151714_durable_game_tombstone_concurrency.sql"),
  "utf8",
);

try {
  docker([
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=synthetic-only",
    "postgres:17-alpine",
  ], { timeout: 180000 });

  let ready = false;
  let consecutiveReady = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const probe = spawnSync(
      "docker",
      ["exec", container, "pg_isready", "-U", "postgres", "-d", "postgres"],
      { encoding: "utf8", timeout: 5000 },
    );
    if (probe.status === 0) {
      consecutiveReady += 1;
      if (consecutiveReady >= 3) {
        ready = true;
        break;
      }
    } else {
      consecutiveReady = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check(ready, "disposable PostgreSQL concurrency target became ready");

  psql(`
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
${baseline}
${tombstones}
${concurrency}
insert into auth.users(id, email)
values ('${ACCOUNT_A}', 'synthetic-a@example.invalid');
`);

  psql(authenticated(writeSql(
    "delete-first",
    "2026-07-30T14:00:00.000Z",
    "Before delete",
    "seed-delete-first",
  )));
  const deleteFirst = psqlAsync(authenticated(`
begin;
select pg_advisory_xact_lock(
  hashtextextended('laxhornet:legacy-game:delete-first', 0)
);
select pg_sleep(2);
${deleteSql("delete-first", "2026-07-30T14:00:00.000Z", "delete-first-id")}
commit;
`));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const blockedWrite = psqlAsync(authenticated(writeSql(
    "delete-first",
    "2026-07-30T14:01:00.000Z",
    "Must not resurrect",
    "write-after-delete-lock",
  )));
  const [deleteFirstOutput, blockedWriteOutput] = await Promise.all([
    deleteFirst,
    blockedWrite,
  ]);
  check(
    resultJson(deleteFirstOutput).outcome === "accepted",
    "delete-first transaction accepts the durable tombstone",
    { deleteFirstOutput },
  );
  check(
    resultJson(blockedWriteOutput).code === "game_deleted",
    "write waiting behind delete sees the committed tombstone",
    { blockedWriteOutput },
  );
  const deleteFirstFinal = psql(`
select json_build_object(
  'games', (select count(*) from public.games where id = 'delete-first'),
  'tombstones', (select count(*) from public.legacy_game_tombstones where game_id = 'delete-first')
)::text;
`);
  check(
    resultJson(deleteFirstFinal).games === 0
      && resultJson(deleteFirstFinal).tombstones === 1,
    "delete-first race cannot recreate a game beside its tombstone",
    { deleteFirstFinal },
  );

  psql(authenticated(writeSql(
    "write-first",
    "2026-07-30T14:00:00.000Z",
    "Original",
    "seed-write-first",
  )));
  const writeFirst = psqlAsync(authenticated(`
begin;
select pg_advisory_xact_lock(
  hashtextextended('laxhornet:legacy-game:write-first', 0)
);
${writeSql(
    "write-first",
    "2026-07-30T14:10:00.000Z",
    "Committed newer revision",
    "write-first-update",
  )}
select pg_sleep(2);
commit;
`));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const blockedDelete = psqlAsync(authenticated(deleteSql(
    "write-first",
    "2026-07-30T14:00:00.000Z",
    "write-first-delete",
  )));
  const [writeFirstOutput, blockedDeleteOutput] = await Promise.all([
    writeFirst,
    blockedDelete,
  ]);
  check(
    resultJson(writeFirstOutput).outcome === "accepted",
    "write-first transaction commits its guarded write",
    { writeFirstOutput },
  );
  check(
    resultJson(blockedDeleteOutput).code === "newer_game_revision",
    "delete waiting behind write compares the committed newer revision",
    { blockedDeleteOutput },
  );
  const writeFirstFinal = resultJson(psql(`
select json_build_object(
  'games', (select count(*) from public.games where id = 'write-first'),
  'tombstones', (select count(*) from public.legacy_game_tombstones where game_id = 'write-first')
)::text;
`));
  check(
    writeFirstFinal.games === 1 && writeFirstFinal.tombstones === 0,
    "write-first newer-revision conflict retains the game without a tombstone",
    writeFirstFinal,
  );

  const unrelatedLock = psqlAsync(`
begin;
select pg_advisory_xact_lock(
  hashtextextended('laxhornet:legacy-game:independent-a', 0)
);
select pg_sleep(2);
commit;
`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const independentStarted = Date.now();
  const independentWrite = resultJson(psql(authenticated(writeSql(
    "independent-b",
    "2026-07-30T14:20:00.000Z",
    "Independent",
    "independent-write",
  ))));
  const independentElapsed = Date.now() - independentStarted;
  await unrelatedLock;
  check(
    independentWrite.outcome === "accepted" && independentElapsed < 1500,
    "different game IDs remain independently processable",
    { independentWrite, independentElapsed },
  );
} finally {
  spawnSync("docker", ["rm", "-f", container], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
}

console.log(`${checks} durable game tombstone concurrency checks passed.`);
