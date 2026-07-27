import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260727000000_tracked_playing_time_operations.sql";
const rollbackPath =
  "supabase/rollback/20260727000000_tracked_playing_time_operations_rollback.sql";
const testSqlPath = "supabase/tests/tracked_playing_time_foundation.sql";
const servicePath = "tracked-playing-time-service.js";
const results = [];

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

const migration = source(migrationPath);
const rollback = source(rollbackPath);
const service = source(servicePath);
const app = source("app.js");
const appHtml = source("app.html");
const manifest = JSON.parse(source("release/laxhornet-release-manifest.json"));

test("foundation uses the single required forward migration", () => {
  const changedMigrations = git(
    "diff",
    "--name-only",
    "origin/main",
    "--",
    "supabase/migrations",
  )
    .split(/\r?\n/)
    .filter(Boolean);
  assert.deepEqual(changedMigrations, [migrationPath]);
});

test("forward, rollback, and pgTAP paths are exact", () => {
  for (const file of [migrationPath, rollbackPath, testSqlPath]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test("clock state and append-only participation operations are distinct", () => {
  for (const table of [
    "lh_game_clock_states",
    "lh_participation_logical_events",
    "lh_participation_operations",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /lh_participation_operations_immutable/);
  assert.match(migration, /participation history is append-only/);
});

test("effective participation resolves correction and tombstone history", () => {
  assert.match(migration, /create view public\.lh_effective_participation_operations/);
  assert.match(migration, /operation_kind <> 'tombstone'/);
  assert.match(migration, /current_operation_id/);
  assert.match(migration, /target_operation_id/);
});

test("all tracked-time RPCs are authenticated only", () => {
  const rpcNames = [
    "lh_initialize_game_clock",
    "lh_update_game_clock",
    "lh_reconcile_game_clock",
    "lh_read_game_clock",
    "lh_create_participation_operation",
    "lh_correct_participation_operation",
    "lh_tombstone_participation_operation",
    "lh_list_effective_participation",
    "lh_reconcile_participation_operations",
  ];
  for (const rpc of rpcNames) {
    assert.match(migration, new RegExp(`revoke execute on function public\\.${rpc}`));
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*? to authenticated;`),
    );
  }
  assert.doesNotMatch(migration, /grant execute[\s\S]*\bto anon\b/);
});

test("new tables use forced RLS with no direct browser grants", () => {
  for (const table of [
    "lh_game_clock_states",
    "lh_participation_logical_events",
    "lh_participation_operations",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table}`));
  }
});

test("public Live Share contract is not redefined or expanded", () => {
  assert.doesNotMatch(migration, /lh_public_live_share_game/);
  assert.equal(
    git("diff", "--name-only", "origin/main", "--", "app.js", "app.html"),
    "",
  );
});

test("private backup retains game-local tracked state while scoped CSV remains event-only", () => {
  assert.match(app, /function normalizeGame\(game = \{\}/);
  assert.match(app, /return \{\s*\.\.\.game,/);
  assert.match(app, /games: state\.games\.map\(normalizeGame\)/);
  assert.match(app, /return normalizedGame\.events\.map\(\(event\) =>/);
});

test("client service remains local-first and outside the UI ticket", () => {
  assert.match(service, /persistLocal/);
  assert.match(service, /participationOperations/);
  assert.match(service, /reconcileParticipationOperations/);
  assert.doesNotMatch(appHtml, /tracked-playing-time-service\.js/);
});

test("rollback fails closed when history exists and removes only foundation objects", () => {
  assert.match(rollback, /rollback refused/i);
  assert.match(rollback, /lh_participation_operations/);
  assert.doesNotMatch(rollback, /drop table(?: if exists)? public\.events/i);
  assert.doesNotMatch(rollback, /drop function(?: if exists)? public\.lh_public_live_share_game/i);
});

test("release manifest identifies a review-only, unapplied package", () => {
  const review = manifest.reviewDatabasePackages?.find(
    (entry) => entry.name === "tracked_playing_time_foundation",
  );
  assert.equal(review?.status, "draft_review");
  assert.equal(review?.productionApplied, false);
  assert.equal(review?.productionAuthorizationRequired, true);
  assert.deepEqual(
    [review.forwardMigration, review.rollbackReference, review.testSql],
    [migrationPath, rollbackPath, testSqlPath],
  );
});

const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(
    `${result.status.padEnd(4)} ${result.name}${result.error ? `: ${result.error}` : ""}`,
  );
}
console.log(
  `\n${results.length - failures.length}/${results.length} tracked playing time foundation tests passed.`,
);
if (failures.length) process.exitCode = 1;
