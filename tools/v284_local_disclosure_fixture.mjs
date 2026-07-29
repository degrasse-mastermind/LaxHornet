import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_PROJECT_REF = "ulbmjcvnyznvmjgpstno";
export const PRODUCTION_HOST = `${PRODUCTION_PROJECT_REF}.supabase.co`;
export const APPROVED_APPLICATION_SHA = "effca6952e647b7424f96675f390fc80d5c42368";
export const APPROVED_DEPLOYMENT_BRANCH = "main";
export const TOOLING_BRANCH = "fix/v284-local-disclosure-fixture-seeding";
export const LOCAL_PROJECT_ID = "laxhornet-v284-disclosure-local";
export const LOCAL_API_URL = "http://127.0.0.1:54321";
export const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const LOCAL_DB_CONTAINER = `supabase_db_${LOCAL_PROJECT_ID}`;
export const SYNTHETIC_PREFIX = "v284-disclosure-local-";
export const LOCAL_PROJECT_PORTS = Object.freeze([54321, 54322, 54323, 54324]);
export const TOOLING_PATHS = Object.freeze([
  "tools/v284_local_disclosure_fixture.mjs",
  "tools/test_v284_local_disclosure_fixture.mjs",
  "tools/v284_production_disclosure_smoke.mjs",
  "tools/test_v284_production_disclosure_smoke.mjs",
]);

export const LIFECYCLE_KEYS = Object.freeze([
  "actor_grant_id",
  "actor_user_id",
  "event_type",
  "grant_id",
  "id",
  "occurred_at",
  "reason",
  "related_grant_id",
  "sequence",
]);

export const FORBIDDEN_DISCLOSURE_TERMS = Object.freeze([
  "game_clock_state",
  "clock_state",
  "clock_revision",
  "is_running",
  "clock_seconds_remaining",
  "player_in",
  "player_out",
  "participation",
  "logical_event",
  "operation_id",
  "active_shift",
  "shift_start",
  "shift_end",
  "shift_duration",
  "shift_count",
  "average_shift",
  "longest_shift",
  "total_tracked_time",
  "game_share",
  "correction_reason",
  "change_reason",
  "tombstone",
  "manual_shift",
  "system_close_reason",
  "recovery_state",
  "estimated",
  "needs_review",
  "sync_state",
  "retry",
  "conflict",
  "authored_by",
  "authority",
  "private_rpc",
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localStaticOrigin = "http://127.0.0.1:5274";
const allowedGameKeys = [
  "final_score_against",
  "final_score_for",
  "game_date",
  "game_id",
  "jersey_number",
  "opponent",
  "period_format",
  "player_name",
  "position",
  "team_name",
].sort();
const allowedEventKeys = [
  "category",
  "event_id",
  "field_zone",
  "occurred_at",
  "period",
  "point_value",
  "stat_label",
  "stat_type",
].sort();
const expectedFixturePublicSemantics = new Map([
  ["groundBall", Object.freeze({
    stat_label: "Ground Ball",
    category: "Effort / IQ",
    point_value: 2,
  })],
  ["assist", Object.freeze({
    stat_label: "Assist",
    category: "Offense",
    point_value: 3,
  })],
]);
const allowedPublicPeriods = new Set(["Q1", "Q2", "Q3", "Q4", "H1", "H2", "OT"]);
const allowedPublicFieldZones = new Set([
  "",
  "Offensive end",
  "Midfield",
  "Defensive end",
  "Sideline",
  "Endline",
  "Crease",
]);

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

function localHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function validateLocalTarget({
  apiUrl,
  dbUrl,
  projectId,
  containerName,
  fixturePrefix,
}) {
  const api = new URL(apiUrl);
  const database = new URL(dbUrl);
  assert.equal(projectId, LOCAL_PROJECT_ID, "local fixture project ID mismatch");
  assert.notEqual(projectId, PRODUCTION_PROJECT_REF, "production project reference is forbidden");
  assert.equal(containerName, LOCAL_DB_CONTAINER, "local database container mismatch");
  assert.equal(api.protocol, "http:", "local API must use HTTP");
  assert.ok(localHostname(api.hostname), "local API host must be loopback");
  assert.equal(api.port, "54321", "local API port mismatch");
  assert.equal(database.protocol, "postgresql:", "local database protocol mismatch");
  assert.ok(localHostname(database.hostname), "local database host must be loopback");
  assert.equal(database.port, "54322", "local database port mismatch");
  assert.equal(database.pathname, "/postgres", "local database name mismatch");
  assert.equal(database.username, "postgres", "local database user mismatch");
  assert.equal(fixturePrefix, SYNTHETIC_PREFIX, "synthetic fixture prefix mismatch");
  const serialized = JSON.stringify({ apiUrl, dbUrl, projectId, containerName, fixturePrefix });
  assert.ok(!serialized.includes(PRODUCTION_HOST), "production host is forbidden");
  return true;
}

export function assertDeploymentIsolationSnapshot({
  approvedSha,
  approvedRefSha,
  deploymentBranch,
  treePaths,
  runtimeSources,
  workflowSources,
}) {
  assert.equal(approvedSha, APPROVED_APPLICATION_SHA, "approved application SHA mismatch");
  assert.equal(approvedRefSha, approvedSha, "approved application ref drifted");
  assert.equal(deploymentBranch, APPROVED_DEPLOYMENT_BRANCH, "tooling branch cannot be a deployment source");
  const normalizedPaths = new Set((treePaths || []).map((value) => value.replaceAll("\\", "/")));
  for (const toolingPath of TOOLING_PATHS) {
    assert.ok(!normalizedPaths.has(toolingPath), `approved application tree contains tooling path ${toolingPath}`);
  }
  const forbiddenReference = /v284_local_disclosure_fixture|test_v284_local_disclosure_fixture|fix\/v284-local-disclosure-fixture-seeding/i;
  for (const [file, content] of Object.entries(runtimeSources || {})) {
    assert.doesNotMatch(String(content), forbiddenReference, `${file} references non-deployable tooling`);
  }
  for (const [file, content] of Object.entries(workflowSources || {})) {
    assert.doesNotMatch(String(content), forbiddenReference, `${file} copies or deploys non-deployable tooling`);
  }
  return {
    approvedSha,
    deploymentBranch,
    toolingPathsAbsent: true,
    runtimeReferencesAbsent: true,
    workflowReferencesAbsent: true,
  };
}

function walkUndefined(value, location = "$") {
  if (value === undefined) throw new Error(`undefined fixture value at ${location}`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkUndefined(item, `${location}[${index}]`));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walkUndefined(item, `${location}.${key}`));
  }
}

function assertNoCredentialShape(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /(?:eyJ[a-zA-Z0-9_-]{20,}|sb_(?:secret|publishable)_|authorization"\s*:|access_token|refresh_token|password"\s*:|shareCode"\s*:)/i,
    "credential-shaped value is forbidden in fixture records",
  );
}

function assertSyntheticIdentifier(runId, key, value) {
  const fixtureKeys = new Set([
    "id",
    "grant_id",
    "actor_grant_id",
    "related_grant_id",
    "team_id",
    "roster_player_id",
    "game_id",
    "invitation_id",
  ]);
  if (!fixtureKeys.has(key) || value === null) return;
  assert.ok(
    typeof value === "string" && value.startsWith(runId),
    `non-synthetic ${key} rejected`,
  );
}

export function assertHomogeneousLifecycleBatch(records, runId) {
  assert.ok(runId.startsWith(SYNTHETIC_PREFIX), "run ID must use the synthetic prefix");
  assert.ok(Array.isArray(records) && records.length > 0, "lifecycle batch must be non-empty");
  const expected = sortedKeys(records[0]);
  records.forEach((record, index) => {
    assert.ok(record && typeof record === "object" && !Array.isArray(record), `record ${index} must be an object`);
    walkUndefined(record, `$[${index}]`);
    assertNoCredentialShape(record);
    Object.entries(record).forEach(([key, value]) => assertSyntheticIdentifier(runId, key, value));
    assert.deepEqual(sortedKeys(record), expected, "heterogeneous lifecycle batch rejected");
    assert.deepEqual(sortedKeys(record), [...LIFECYCLE_KEYS].sort(), "unexpected lifecycle key set rejected");
    JSON.parse(JSON.stringify(record));
  });
  return { recordCount: records.length, keys: expected };
}

export function assertSyntheticFixtureDescriptor(fixture) {
  assert.ok(fixture.runId.startsWith(SYNTHETIC_PREFIX), "fixture run ID is not synthetic");
  for (const value of Object.values(fixture.ids)) {
    assert.ok(String(value).startsWith(fixture.runId), "fixture identifier is not synthetic");
  }
  assert.match(fixture.adminEmail, new RegExp(`^${fixture.runId}-admin@example\\.invalid$`));
  assert.match(fixture.coachEmail, new RegExp(`^${fixture.runId}-coach@example\\.invalid$`));
  assert.match(fixture.teamName, /^V284 Synthetic /);
  assert.match(fixture.playerName, /^V284 Synthetic /);
  assert.match(fixture.opponent, /^V284 Synthetic /);
  assertNoCredentialShape({
    runId: fixture.runId,
    ids: fixture.ids,
    adminEmail: fixture.adminEmail,
    coachEmail: fixture.coachEmail,
    teamName: fixture.teamName,
    playerName: fixture.playerName,
    opponent: fixture.opponent,
  });
  return true;
}

export function assertTeardownProof(proof) {
  assert.equal(proof?.stopExitCode, 0, "local Supabase stop did not exit 0");
  assert.deepEqual(proof?.remainingContainers, [], "disposable project containers survived teardown");
  assert.deepEqual(proof?.openPorts, [], "disposable project ports survived teardown");
  assert.equal(proof?.temporaryRootRemoved, true, "temporary harness directory survived teardown");
  assert.equal(proof?.disposableStackRemoved, true, "optimistic teardown success rejected");
  return true;
}

function assertExactZeroCount(value, message) {
  assert.equal(Number.isInteger(value) && value === 0, true, message);
}

export function assertSessionRevocationProof(proof) {
  assert.ok([200, 204].includes(proof?.logoutStatus), "Auth session revocation failed");
  assertExactZeroCount(proof?.sessionsRemaining, "Auth session remained after revocation or count was unavailable");
  assertExactZeroCount(proof?.refreshTokensRemaining, "refresh token remained after revocation or count was unavailable");
  assert.equal(proof?.oldAuthTokenRejected, true, "old access token was not rejected by Auth");
  assert.equal(proof?.oldAuthTokenRejectedAfterDelete, true, "old access token was not rejected after user deletion");
  assert.equal(proof?.oldRefreshTokenRejected, true, "old refresh token remained usable");
  assert.equal(proof?.oldPrivateRpcRejected, true, "old access token retained private RPC authority");
  assert.equal(proof?.privateRpcProbeGameRows, 1, "private RPC token probe did not target the retained synthetic game");
  assertExactZeroCount(proof?.usersRemaining, "synthetic Auth user remained after deletion or count was unavailable");
  assert.match(proof?.accessTokenFingerprint || "", /^[a-f0-9]{12}$/);
  assert.match(proof?.refreshTokenFingerprint || "", /^[a-f0-9]{12}$/);
  return true;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout || 120000,
    input: options.input,
    env: { ...process.env, ...(options.env || {}) },
  });
  if (result.status !== 0) {
    const diagnostic = String(result.stderr || "")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
      .trim()
      .slice(-4000);
    throw new Error(
      `${options.label || command} failed with exit ${result.status ?? 1}` +
        (diagnostic ? `: ${diagnostic}` : ""),
    );
  }
  return result;
}

function gitOutput(args) {
  return run("git", args, { label: `git ${args[0]}` }).stdout.trim();
}

function gitTextAt(ref, file) {
  const result = spawnSync("git", ["show", `${ref}:${file}`], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
  });
  if (result.status === 128) return "";
  if (result.status !== 0) throw new Error(`git show failed for ${file}`);
  return result.stdout;
}

export function verifyApprovedApplicationIsolation() {
  const approvedRefSha = gitOutput(["rev-parse", "origin/main"]);
  const treePaths = gitOutput(["ls-tree", "-r", "--name-only", APPROVED_APPLICATION_SHA])
    .split(/\r?\n/)
    .filter(Boolean);
  const runtimePaths = treePaths.filter((file) => (
    !file.includes("/")
    && /\.(?:html|js|json)$/i.test(file)
  )).concat(["release/laxhornet-release-manifest.json"]);
  const workflowPaths = treePaths.filter((file) => /^\.github\/workflows\/.+\.ya?ml$/i.test(file));
  const runtimeSources = Object.fromEntries(
    runtimePaths.map((file) => [file, gitTextAt(APPROVED_APPLICATION_SHA, file)]),
  );
  const workflowSources = Object.fromEntries(
    workflowPaths.map((file) => [file, gitTextAt(APPROVED_APPLICATION_SHA, file)]),
  );
  return assertDeploymentIsolationSnapshot({
    approvedSha: APPROVED_APPLICATION_SHA,
    approvedRefSha,
    deploymentBranch: APPROVED_DEPLOYMENT_BRANCH,
    treePaths,
    runtimeSources,
    workflowSources,
  });
}

function psql(containerName, sql) {
  validateLocalTarget({
    apiUrl: LOCAL_API_URL,
    dbUrl: LOCAL_DB_URL,
    projectId: LOCAL_PROJECT_ID,
    containerName,
    fixturePrefix: SYNTHETIC_PREFIX,
  });
  return run(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-A",
      "-t",
    ],
    { input: sql, label: "local psql", timeout: 60000 },
  ).stdout.trim();
}

export function sqlLiteral(value) {
  if (value === null) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function lifecycleRecordSql(record) {
  assertHomogeneousLifecycleBatch([record], record.grant_id.split("-").slice(0, -2).join("-"));
  return `
insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id,
  actor_grant_id, related_grant_id, reason, occurred_at
) values (
  ${sqlLiteral(record.id)},
  ${sqlLiteral(record.grant_id)},
  ${record.sequence},
  ${sqlLiteral(record.event_type)},
  ${sqlLiteral(record.actor_user_id)}::uuid,
  ${sqlLiteral(record.actor_grant_id)},
  ${sqlLiteral(record.related_grant_id)},
  ${sqlLiteral(record.reason)},
  ${sqlLiteral(record.occurred_at)}::timestamptz
);`;
}

export function createFixtureDescriptor() {
  const runId = `${SYNTHETIC_PREFIX}${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const ids = {
    team: `${runId}-team`,
    player: `${runId}-player`,
    game: `${runId}-game`,
    adminMember: `${runId}-admin-member`,
    coachMember: `${runId}-coach-member`,
    coachClaim: `${runId}-coach-claim`,
    adminGrant: `${runId}-admin-grant`,
    coachGrant: `${runId}-coach-grant`,
    coachInvitation: `${runId}-coach-invitation`,
  };
  const fixture = {
    runId,
    ids,
    adminEmail: `${runId}-admin@example.invalid`,
    coachEmail: `${runId}-coach@example.invalid`,
    teamName: "V284 Synthetic Hornets",
    playerName: "V284 Synthetic Player",
    opponent: "V284 Synthetic Rivals",
  };
  assertSyntheticFixtureDescriptor(fixture);
  return fixture;
}

export function makeLifecycleRecords(fixture, adminId, coachId) {
  const base = Date.now() - 10 * 60 * 1000;
  return {
    admin: [
      {
        id: `${fixture.runId}-admin-issued`,
        grant_id: fixture.ids.adminGrant,
        sequence: 1,
        event_type: "issued",
        actor_user_id: adminId,
        actor_grant_id: null,
        related_grant_id: null,
        reason: "",
        occurred_at: new Date(base).toISOString(),
      },
      {
        id: `${fixture.runId}-admin-accepted`,
        grant_id: fixture.ids.adminGrant,
        sequence: 2,
        event_type: "accepted",
        actor_user_id: adminId,
        actor_grant_id: null,
        related_grant_id: null,
        reason: "",
        occurred_at: new Date(base + 1000).toISOString(),
      },
    ],
    coach: [
      {
        id: `${fixture.runId}-coach-issued`,
        grant_id: fixture.ids.coachGrant,
        sequence: 1,
        event_type: "issued",
        actor_user_id: adminId,
        actor_grant_id: fixture.ids.adminGrant,
        related_grant_id: null,
        reason: "",
        occurred_at: new Date(base + 2000).toISOString(),
      },
      {
        id: `${fixture.runId}-coach-accepted`,
        grant_id: fixture.ids.coachGrant,
        sequence: 2,
        event_type: "accepted",
        actor_user_id: coachId,
        actor_grant_id: null,
        related_grant_id: null,
        reason: "",
        occurred_at: new Date(base + 3000).toISOString(),
      },
    ],
  };
}

export function seedSql(fixture, adminId, coachId, lifecycle) {
  const now = new Date(Date.now() - 8 * 60 * 1000).toISOString();
  const eventB = new Date(Date.now() - 7 * 60 * 1000).toISOString();
  return `
begin;
do $guard$
begin
  if current_database() <> 'postgres' or inet_server_port() <> 5432 then
    raise exception 'LOCAL_FIXTURE_DATABASE_GUARD_FAILED';
  end if;
end
$guard$;

insert into public.teams(id, name, invite_code, tracker_code, created_by)
values (
  ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(fixture.teamName)},
  ${sqlLiteral(`${fixture.runId}-INVITE`)}, ${sqlLiteral(`${fixture.runId}-TRACK`)},
  ${sqlLiteral(adminId)}::uuid
);
insert into public.team_members(id, team_id, user_id, role) values
  (${sqlLiteral(fixture.ids.adminMember)}, ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(adminId)}::uuid, 'admin'),
  (${sqlLiteral(fixture.ids.coachMember)}, ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(coachId)}::uuid, 'tracker');
insert into public.roster_players(id, team_id, name, number, position, active)
values (
  ${sqlLiteral(fixture.ids.player)}, ${sqlLiteral(fixture.ids.team)},
  ${sqlLiteral(fixture.playerName)}, '99', 'Midfield', true
);
insert into public.player_claims(id, team_id, roster_player_id, user_id)
values (
  ${sqlLiteral(fixture.ids.coachClaim)}, ${sqlLiteral(fixture.ids.team)},
  ${sqlLiteral(fixture.ids.player)}, ${sqlLiteral(coachId)}::uuid
);
insert into public.games(
  id, player_id, user_id, share_code, is_shared, opponent, game_date,
  location, game_type, period_format, player_snapshot, current_quarter,
  status, team_id, roster_player_id, created_at, saved_at, ended_at
) values (
  ${sqlLiteral(fixture.ids.game)}, ${sqlLiteral(fixture.ids.player)}, ${sqlLiteral(coachId)}::uuid,
  ${sqlLiteral(`${fixture.runId}-LEGACY`)}, true, ${sqlLiteral(fixture.opponent)}, date '2026-07-28',
  'V284 Synthetic Field', 'Synthetic disclosure test', 'quarters',
  jsonb_build_object(
    'id', ${sqlLiteral(fixture.ids.player)}, 'name', ${sqlLiteral(fixture.playerName)},
    'number', '99', 'position', 'Midfield', 'team', ${sqlLiteral(fixture.teamName)}
  ),
  'Q4', 'completed', ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(fixture.ids.player)},
  ${sqlLiteral(now)}::timestamptz, ${sqlLiteral(eventB)}::timestamptz, ${sqlLiteral(eventB)}::timestamptz
);
insert into public.events(
  id, game_id, user_id, timestamp, quarter, stat_type, stat_label,
  category, point_value, tags, note, field_zone, team_id, roster_player_id
) values
  (
    ${sqlLiteral(`${fixture.runId}-legacy-event-a`)}, ${sqlLiteral(fixture.ids.game)},
    ${sqlLiteral(coachId)}::uuid, ${sqlLiteral(now)}::timestamptz, 'Q1',
    'ground_ball', 'Ground Ball', 'Possession', 1,
    array['synthetic-public'], 'synthetic private legacy note', 'midfield',
    ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(fixture.ids.player)}
  ),
  (
    ${sqlLiteral(`${fixture.runId}-legacy-event-b`)}, ${sqlLiteral(fixture.ids.game)},
    ${sqlLiteral(coachId)}::uuid, ${sqlLiteral(eventB)}::timestamptz, 'Q1',
    'assist', 'Assist', 'Offense', 2,
    array[]::text[], '', 'offense',
    ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(fixture.ids.player)}
  );

insert into public.lh_team_scopes(team_id, team_name_snapshot)
values (${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(fixture.teamName)});
insert into public.lh_player_scopes(
  team_id, roster_player_id, player_name_snapshot, jersey_snapshot, position_snapshot
) values (
  ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(fixture.ids.player)},
  ${sqlLiteral(fixture.playerName)}, '99', 'Midfield'
);
insert into public.lh_game_scopes(
  game_id, team_id, roster_player_id, opponent_snapshot, game_date_snapshot,
  period_format_snapshot, final_score_for, final_score_against
) values (
  ${sqlLiteral(fixture.ids.game)}, ${sqlLiteral(fixture.ids.team)}, ${sqlLiteral(fixture.ids.player)},
  ${sqlLiteral(fixture.opponent)}, date '2026-07-28', 'quarters', 6, 4
);

insert into public.lh_access_grants(
  id, user_id, role, scope_type, team_id, roster_player_id, provenance_type,
  invitation_id, renewed_from_grant_id, issued_by_user_id, issued_by_grant_id,
  issued_at, expires_at
) values (
  ${sqlLiteral(fixture.ids.adminGrant)}, ${sqlLiteral(adminId)}::uuid,
  'team_admin', 'team', ${sqlLiteral(fixture.ids.team)}, null, 'system_bootstrap',
  null, null, ${sqlLiteral(adminId)}::uuid, null,
  ${sqlLiteral(lifecycle.admin[0].occurred_at)}::timestamptz, null
);
${lifecycle.admin.map(lifecycleRecordSql).join("\n")}

insert into public.lh_access_invitations(
  id, invited_user_id, invited_email, role, scope_type, team_id,
  roster_player_id, invited_by_user_id, invited_by_grant_id, status,
  invitation_code_hash, created_at, accepted_at, declined_at, expires_at,
  revoked_at, revocation_reason
) values (
  ${sqlLiteral(fixture.ids.coachInvitation)}, ${sqlLiteral(coachId)}::uuid,
  ${sqlLiteral(fixture.coachEmail)}, 'coach', 'team', ${sqlLiteral(fixture.ids.team)},
  null, ${sqlLiteral(adminId)}::uuid, ${sqlLiteral(fixture.ids.adminGrant)}, 'accepted',
  null, ${sqlLiteral(lifecycle.coach[0].occurred_at)}::timestamptz,
  ${sqlLiteral(lifecycle.coach[1].occurred_at)}::timestamptz,
  null, null, null, ''
);
insert into public.lh_access_grants(
  id, user_id, role, scope_type, team_id, roster_player_id, provenance_type,
  invitation_id, renewed_from_grant_id, issued_by_user_id, issued_by_grant_id,
  issued_at, expires_at
) values (
  ${sqlLiteral(fixture.ids.coachGrant)}, ${sqlLiteral(coachId)}::uuid,
  'coach', 'team', ${sqlLiteral(fixture.ids.team)}, null, 'invitation',
  ${sqlLiteral(fixture.ids.coachInvitation)}, null, ${sqlLiteral(adminId)}::uuid,
  ${sqlLiteral(fixture.ids.adminGrant)},
  ${sqlLiteral(lifecycle.coach[0].occurred_at)}::timestamptz, null
);
${lifecycle.coach.map(lifecycleRecordSql).join("\n")}
commit;
`;
}

export function revokeFixtureGrantsSql(fixture, adminId) {
  const lifecycle = [
    {
      id: `${fixture.runId}-coach-revoked`,
      grant_id: fixture.ids.coachGrant,
      sequence: 3,
      event_type: "revoked",
      actor_user_id: adminId,
      actor_grant_id: fixture.ids.adminGrant,
      related_grant_id: null,
      reason: "v284 local disclosure fixture cleanup",
      occurred_at: new Date().toISOString(),
    },
    {
      id: `${fixture.runId}-admin-revoked`,
      grant_id: fixture.ids.adminGrant,
      sequence: 3,
      event_type: "revoked",
      actor_user_id: adminId,
      actor_grant_id: fixture.ids.adminGrant,
      related_grant_id: null,
      reason: "v284 local disclosure fixture cleanup",
      occurred_at: new Date(Date.now() + 1).toISOString(),
    },
  ];
  return `
begin;
${lifecycle.map(lifecycleRecordSql).join("\n")}
commit;
`;
}

export function removeMutableFixtureSql(fixture, adminId, coachId) {
  return `
begin;
delete from public.events where game_id = ${sqlLiteral(fixture.ids.game)};
delete from public.games where id = ${sqlLiteral(fixture.ids.game)};
delete from public.player_claims where id = ${sqlLiteral(fixture.ids.coachClaim)};
delete from public.team_members where team_id = ${sqlLiteral(fixture.ids.team)};
delete from public.roster_players where id = ${sqlLiteral(fixture.ids.player)};
delete from public.teams where id = ${sqlLiteral(fixture.ids.team)};
delete from public.user_profiles where user_id in (${sqlLiteral(adminId)}::uuid, ${sqlLiteral(coachId)}::uuid);
commit;
`;
}

function copyLocalProject(tempRoot) {
  const target = path.join(tempRoot, "supabase");
  fs.cpSync(path.join(root, "supabase"), target, {
    recursive: true,
    filter: (source) => !/[\\/]\.(?:temp|branches)(?:[\\/]|$)/.test(source),
  });
  const configPath = path.join(target, "config.toml");
  const config = fs.readFileSync(configPath, "utf8");
  const matches = config.match(/^project_id\s*=\s*"[^"]+"/gm) || [];
  assert.equal(matches.length, 1, "expected exactly one local project_id setting");
  const rewritten = config.replace(
    /^project_id\s*=\s*"[^"]+"/m,
    `project_id = "${LOCAL_PROJECT_ID}"`,
  );
  assert.ok(!rewritten.includes(PRODUCTION_PROJECT_REF), "temporary local config retained production project reference");
  fs.writeFileSync(configPath, rewritten, "utf8");
}

function safeRemoveTempRoot(tempRoot) {
  const resolved = path.resolve(tempRoot);
  const expectedParent = path.resolve(os.tmpdir());
  assert.equal(path.dirname(resolved), expectedParent, "temporary fixture root is outside the system temp directory");
  assert.ok(path.basename(resolved).startsWith("laxhornet-v284-disclosure-"), "temporary fixture root prefix mismatch");
  if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
}

export async function request(url, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { message: "non-json response" };
  }
  return { status: response.status, body: parsed };
}

export function apiHeaders(publishableKey, token, extra = {}) {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function tokenFingerprint(token) {
  return createHash("sha256").update(String(token)).digest("hex").slice(0, 12);
}

export async function createAuthUser(apiUrl, publishableKey, serviceRoleKey, fixture, role, password) {
  const email = role === "admin" ? fixture.adminEmail : fixture.coachEmail;
  const result = await request(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: apiHeaders(publishableKey, serviceRoleKey),
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        synthetic: true,
        fixture_role: role,
        fixture_run_id: fixture.runId,
      },
    },
  });
  assert.equal(result.status, 200, `local ${role} Auth user creation failed`);
  assert.ok(result.body?.id, `local ${role} Auth user returned no id`);
  return result.body.id;
}

export async function signIn(apiUrl, publishableKey, email, password) {
  const result = await request(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: apiHeaders(publishableKey, publishableKey),
    body: { email, password },
  });
  assert.equal(result.status, 200, "local synthetic sign-in failed");
  assert.ok(result.body?.access_token && result.body?.refresh_token, "local synthetic session is incomplete");
  return result.body;
}

export async function rpc(apiUrl, publishableKey, name, args, token = publishableKey) {
  return request(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: apiHeaders(publishableKey, token),
    body: args,
  });
}

export async function acceptedRpc(apiUrl, publishableKey, name, args, token) {
  const result = await rpc(apiUrl, publishableKey, name, args, token);
  assert.equal(result.status, 200, `${name} HTTP status mismatch`);
  assert.equal(result.body?.outcome, "accepted", `${name} outcome mismatch`);
  return result.body;
}

export async function createPrivateAndPublicEvidence(context) {
  const { apiUrl, publishableKey, fixture, coachSession, containerName } = context;
  const now = Date.now();
  const ordinaryEvents = [
    {
      id: `${fixture.runId}-trust-event-a`,
      occurredAt: new Date(now - 6 * 60 * 1000).toISOString(),
      statType: "groundBall",
      statLabel: "Ground Ball",
      category: "Effort / IQ",
      pointValue: 2,
      fieldZone: "Midfield",
    },
    {
      id: `${fixture.runId}-trust-event-b`,
      occurredAt: new Date(now - 5 * 60 * 1000).toISOString(),
      statType: "assist",
      statLabel: "Assist",
      category: "Offense",
      pointValue: 3,
      fieldZone: "Offensive end",
    },
  ];
  for (const event of context.createOrdinaryEvents === false ? [] : ordinaryEvents) {
    const created = await acceptedRpc(apiUrl, publishableKey, "lh_create_event", {
      p_operation: {
        client_operation_id: `${fixture.runId}-create-${event.id}`,
        event_id: event.id,
        game_id: fixture.ids.game,
        evidence: {
          occurred_at: event.occurredAt,
          period: "Q1",
          stat_type: event.statType,
          stat_label: event.statLabel,
          category: event.category,
          point_value: event.pointValue,
          field_zone: event.fieldZone,
        },
        annotations: {
          note: "synthetic private Trust Spine note",
          tags: ["synthetic_private_tag"],
        },
        client_created_at: event.occurredAt,
      },
    }, coachSession.access_token);
    assert.equal(created.code, "created");
  }

  const clock = await acceptedRpc(apiUrl, publishableKey, "lh_initialize_game_clock", {
    p_clock: {
      game_id: fixture.ids.game,
      period_format: "quarters",
      regulation_period_duration_seconds: 720,
      overtime_duration_seconds: 180,
      current_period: "Q1",
      clock_seconds_remaining: 600,
      is_running: false,
      started_at: null,
      paused_at: new Date(now - 4 * 60 * 1000).toISOString(),
      client_updated_at: new Date(now - 4 * 60 * 1000).toISOString(),
      recovery_state: "needs_review",
    },
  }, coachSession.access_token);
  assert.equal(clock.code, "clock_initialized");

  const entries = {
    inA: { logical: `${fixture.runId}-logical-in-a`, operation: `${fixture.runId}-op-in-a` },
    outA: { logical: `${fixture.runId}-logical-out-a`, operation: `${fixture.runId}-op-out-a` },
    inB: { logical: `${fixture.runId}-logical-in-b`, operation: `${fixture.runId}-op-in-b` },
    outB: { logical: `${fixture.runId}-logical-out-b`, operation: `${fixture.runId}-op-out-b` },
    recovery: { logical: `${fixture.runId}-logical-recovery`, operation: `${fixture.runId}-op-recovery` },
    active: { logical: `${fixture.runId}-logical-active`, operation: `${fixture.runId}-op-active` },
  };
  const createParticipation = async (entry, kind, seconds, source, uncertain, closeReason = null) =>
    acceptedRpc(apiUrl, publishableKey, "lh_create_participation_operation", {
      p_operation: {
        operation_id: entry.operation,
        client_operation_id: `${entry.operation}-client`,
        logical_event_id: entry.logical,
        game_id: fixture.ids.game,
        operation_kind: kind,
        player_id: fixture.ids.player,
        period: "Q1",
        game_clock_seconds: seconds,
        occurred_at: new Date(now - (720 - seconds) * 1000).toISOString(),
        client_created_at: new Date().toISOString(),
        source,
        system_close_reason: closeReason,
        recovery_uncertain: uncertain,
      },
    }, coachSession.access_token);

  await createParticipation(entries.inA, "player_in", 600, "live", false);
  const correctionId = `${fixture.runId}-op-in-a-correction`;
  await acceptedRpc(apiUrl, publishableKey, "lh_correct_participation_operation", {
    p_operation: {
      operation_id: correctionId,
      client_operation_id: `${correctionId}-client`,
      logical_event_id: entries.inA.logical,
      target_operation_id: entries.inA.operation,
      game_id: fixture.ids.game,
      operation_kind: "correct",
      period: "Q1",
      game_clock_seconds: 580,
      occurred_at: new Date(now - 140 * 1000).toISOString(),
      client_created_at: new Date().toISOString(),
      source: "manual",
      recovery_uncertain: false,
      change_reason: "Synthetic correction must remain private",
    },
  }, coachSession.access_token);
  await createParticipation(entries.outA, "player_out", 500, "live", false);
  await createParticipation(entries.inB, "player_in", 450, "manual", false);
  await createParticipation(entries.outB, "player_out", 0, "system_period_end", false, "period_end");
  await createParticipation(entries.recovery, "player_in", 300, "recovery", true);
  const tombstoneId = `${fixture.runId}-op-recovery-tombstone`;
  await acceptedRpc(apiUrl, publishableKey, "lh_tombstone_participation_operation", {
    p_operation: {
      operation_id: tombstoneId,
      client_operation_id: `${tombstoneId}-client`,
      logical_event_id: entries.recovery.logical,
      target_operation_id: entries.recovery.operation,
      game_id: fixture.ids.game,
      operation_kind: "tombstone",
      client_created_at: new Date().toISOString(),
      source: "manual",
      recovery_uncertain: true,
      change_reason: "Synthetic tombstone must remain private",
    },
  }, coachSession.access_token);
  await createParticipation(entries.active, "player_in", 250, "live", false);

  const token = await acceptedRpc(apiUrl, publishableKey, "lh_create_live_share_token", {
    p_game_id: fixture.ids.game,
    p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  }, coachSession.access_token);
  assert.match(token.shareCode, /^[A-F0-9]{32}$/);
  const expiredCode = randomBytes(18).toString("hex").toUpperCase();
  const revokedCode = randomBytes(18).toString("hex").toUpperCase();
  const insertTokenSql = `
begin;
insert into public.lh_live_share_tokens(
  token_id, token_hash, game_id, created_by_user_id, created_by_grant_id,
  created_at, expires_at, revoked_at
) values
  (
    ${sqlLiteral(`${fixture.runId}-expired-token`)},
    ${sqlLiteral(createHash("sha256").update(expiredCode).digest("hex"))},
    ${sqlLiteral(fixture.ids.game)}, ${sqlLiteral(context.coachId)}::uuid,
    ${sqlLiteral(fixture.ids.coachGrant)}, now() - interval '2 hours',
    now() - interval '1 hour', null
  ),
  (
    ${sqlLiteral(`${fixture.runId}-revoked-token`)},
    ${sqlLiteral(createHash("sha256").update(revokedCode).digest("hex"))},
    ${sqlLiteral(fixture.ids.game)}, ${sqlLiteral(context.coachId)}::uuid,
    ${sqlLiteral(fixture.ids.coachGrant)}, now() - interval '2 hours',
    null, now() - interval '1 hour'
  );
commit;
`;
  if (context.databaseQuery) {
    await context.databaseQuery(insertTokenSql);
  } else {
    psql(containerName, insertTokenSql);
  }
  return {
    shareCode: token.shareCode,
    expiredCode,
    revokedCode,
    unknownCode: randomBytes(18).toString("hex").toUpperCase(),
    trackedOperationCount: 8,
  };
}

export function assertPublicPayload(payload) {
  assert.ok(payload?.game && Array.isArray(payload.events), "public payload missing");
  assert.deepEqual(sortedKeys(payload.game), allowedGameKeys, "public game allowlist mismatch");
  assert.equal(payload.events.length, 2, "public ordinary event count mismatch");
  const observedTypes = new Set();
  payload.events.forEach((event) => {
    assert.deepEqual(sortedKeys(event), allowedEventKeys, "public event allowlist mismatch");
    const semantic = expectedFixturePublicSemantics.get(event.stat_type);
    assert.ok(semantic, `noncanonical public stat type ${event.stat_type}`);
    assert.equal(event.stat_label, semantic.stat_label, "public stat label is noncanonical");
    assert.equal(event.category, semantic.category, "public category is noncanonical");
    assert.equal(event.point_value, semantic.point_value, "public point value is noncanonical");
    assert.ok(allowedPublicPeriods.has(event.period), "public period is noncanonical");
    assert.ok(allowedPublicFieldZones.has(event.field_zone), "public field zone is noncanonical");
    assert.equal(
      new Date(event.occurred_at).toISOString(),
      event.occurred_at,
      "public timestamp is noncanonical",
    );
    observedTypes.add(event.stat_type);
  });
  assert.deepEqual(observedTypes, new Set(expectedFixturePublicSemantics.keys()), "public semantic set mismatch");
  const serialized = JSON.stringify(payload).toLowerCase();
  const forbiddenMatches = FORBIDDEN_DISCLOSURE_TERMS.filter((term) => serialized.includes(term));
  assert.deepEqual(forbiddenMatches, [], "public payload exposed tracked-time fields");
  assert.doesNotMatch(serialized, /synthetic private|synthetic_private_tag/);
  return {
    gameKeys: sortedKeys(payload.game),
    eventKeys: sortedKeys(payload.events[0]),
    eventCount: payload.events.length,
    forbiddenMatches,
  };
}

export async function verifyApiDisclosure(context, evidence) {
  const { apiUrl, publishableKey, fixture } = context;
  const publicRead = await rpc(apiUrl, publishableKey, "lh_public_live_share_game", {
    p_share_code: evidence.shareCode,
  });
  assert.equal(publicRead.status, 200);
  const payload = assertPublicPayload(publicRead.body);

  const neutral = [];
  for (const [kind, code] of [
    ["unknown", evidence.unknownCode],
    ["invalid", "!invalid!"],
    ["expired", evidence.expiredCode],
    ["revoked", evidence.revokedCode],
  ]) {
    const result = await rpc(apiUrl, publishableKey, "lh_public_live_share_game", { p_share_code: code });
    const unavailable = result.status === 200 && result.body === null;
    assert.ok(unavailable, `${kind} token did not fail neutrally`);
    neutral.push({ kind, status: result.status, unavailable });
  }

  const anonymousRpcs = [];
  for (const [name, args] of [
    ["lh_initialize_game_clock", { p_clock: {} }],
    ["lh_update_game_clock", { p_clock: {} }],
    ["lh_reconcile_game_clock", { p_clock: {} }],
    ["lh_read_game_clock", { p_game_id: fixture.ids.game }],
    ["lh_create_participation_operation", { p_operation: {} }],
    ["lh_correct_participation_operation", { p_operation: {} }],
    ["lh_tombstone_participation_operation", { p_operation: {} }],
    ["lh_list_effective_participation", { p_game_id: fixture.ids.game }],
    ["lh_reconcile_participation_operations", { p_operations: [] }],
  ]) {
    const result = await rpc(apiUrl, publishableKey, name, args);
    assert.equal(result.status, 401, `${name} anonymous HTTP status mismatch`);
    assert.equal(result.body?.code, "42501", `${name} anonymous denial code mismatch`);
    anonymousRpcs.push({ name, status: result.status, code: result.body.code });
  }

  const anonymousTables = [];
  for (const table of [
    "lh_game_clock_states",
    "lh_participation_logical_events",
    "lh_participation_operations",
    "lh_effective_participation_operations",
  ]) {
    const result = await request(
      `${apiUrl}/rest/v1/${table}?select=*&game_id=eq.${encodeURIComponent(fixture.ids.game)}`,
      { headers: apiHeaders(publishableKey, publishableKey) },
    );
    assert.equal(result.status, 401, `${table} anonymous HTTP status mismatch`);
    assert.equal(result.body?.code, "42501", `${table} anonymous denial code mismatch`);
    anonymousTables.push({ table, status: result.status, code: result.body.code });
  }

  const legacy = [];
  for (const [table, column] of [["games", "id"], ["events", "game_id"]]) {
    const result = await request(
      `${apiUrl}/rest/v1/${table}?select=*&${column}=eq.${encodeURIComponent(fixture.ids.game)}`,
      { headers: apiHeaders(publishableKey, publishableKey) },
    );
    const deniedOrEmpty = result.status >= 400 || (Array.isArray(result.body) && result.body.length === 0);
    assert.ok(deniedOrEmpty, `${table} legacy fallback exposed fixture rows`);
    legacy.push({ table, status: result.status, deniedOrEmpty });
  }
  const aliasProbe = await request(
    `${apiUrl}/rest/v1/events?select=*&stat_type=in.(player_in,player_out,legacy_shift_alias)`,
    { headers: apiHeaders(publishableKey, publishableKey) },
  );
  assert.ok(
    aliasProbe.status >= 400 || (Array.isArray(aliasProbe.body) && aliasProbe.body.length === 0),
    "legacy event aliases were anonymously disclosed",
  );

  return { payload, neutral, anonymousRpcs, anonymousTables, legacy, aliasProbeStatus: aliasProbe.status };
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = decodeURIComponent(new URL(req.url, localStaticOrigin).pathname);
      if (pathname === "/") pathname = "/app.html";
      const target = path.resolve(root, `.${pathname}`);
      if (!target.startsWith(root) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType(target) });
      res.end(fs.readFileSync(target));
    });
    server.listen(5274, "127.0.0.1", () => resolve(server));
  });
}

async function verifyBrowserDisclosure(context, disclosure) {
  const { chromium } = await import("playwright");
  const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  assert.ok(fs.existsSync(executablePath), "approved Chrome executable is unavailable");
  const browser = await chromium.launch({ headless: true, executablePath });
  const server = await startStaticServer();
  const network = [];
  const diagnostics = [];
  const expectedDiagnostics = [];
  try {
    const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await viewerContext.addInitScript(({ url, key }) => {
      window.LAXHORNET_RUNTIME_CONFIG = {
        supabaseUrl: url,
        supabasePublishableKey: key,
      };
    }, { url: context.apiUrl, key: context.publishableKey });
    const viewer = await viewerContext.newPage();
    viewer.on("request", (request) => {
      const url = new URL(request.url());
      network.push({ method: request.method(), host: url.host, path: url.pathname });
    });
    viewer.on("console", (message) => {
      const diagnostic = `console:${message.type()}:${message.text()}`;
      if (diagnostic === "console:warning:Service Worker registration blocked by Playwright") {
        expectedDiagnostics.push(diagnostic);
      } else if (["error", "warning"].includes(message.type())) {
        diagnostics.push(diagnostic);
      }
    });
    viewer.on("pageerror", (error) => diagnostics.push(`pageerror:${error.message}`));
    await viewer.goto(`${localStaticOrigin}/app.html?share=${encodeURIComponent(disclosure.shareCode)}&fresh=v284-local-disclosure`, {
      waitUntil: "domcontentloaded",
    });
    await viewer.getByText("Ground Ball", { exact: false }).first().waitFor({ timeout: 30000 });
    const publicState = await viewer.evaluate(() => ({
      status: state.syncStatus,
      eventCount: state.sharedGame?.events?.length || 0,
      body: document.body.innerText,
    }));
    assert.equal(publicState.status, "Watching live");
    assert.equal(publicState.eventCount, 2);
    const publicLower = publicState.body.toLowerCase();
    FORBIDDEN_DISCLOSURE_TERMS.forEach((term) => {
      assert.ok(!publicLower.includes(term.replaceAll("_", " ")), `public DOM exposed ${term}`);
    });
    assert.doesNotMatch(publicLower, /player in|player out|synthetic private|needs review|estimated/);
    const apiRequests = network.filter((item) => item.host === "127.0.0.1:54321");
    assert.ok(
      apiRequests.some((item) => item.path === "/rest/v1/rpc/lh_public_live_share_game"),
      "public client did not use the allowlisted Live Share RPC",
    );
    assert.ok(
      apiRequests.every((item) => (
        item.path === "/rest/v1/rpc/lh_release_capabilities"
        || item.path === "/rest/v1/rpc/lh_public_live_share_game"
      )),
      `public client contacted an unexpected API path: ${JSON.stringify(apiRequests)}`,
    );

    const trackerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await trackerContext.addInitScript(({ url, key }) => {
      window.LAXHORNET_RUNTIME_CONFIG = {
        supabaseUrl: url,
        supabasePublishableKey: key,
      };
    }, { url: context.apiUrl, key: context.publishableKey });
    const tracker = await trackerContext.newPage();
    await tracker.goto(`${localStaticOrigin}/app.html?fresh=v284-local-export`, { waitUntil: "domcontentloaded" });
    const auth = await tracker.evaluate(async (session) => {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      return { ok: !error && Boolean(data?.user), message: error?.message || "" };
    }, context.coachSession);
    assert.equal(auth.ok, true, `local browser sign-in failed: ${auth.message}`);
    const exportResult = await tracker.evaluate(async ({ fixtureIds, teamName, playerName }) => {
      setAuthUser((await supabaseClient.auth.getUser()).data.user);
      const team = normalizeTeam({ id: fixtureIds.team, name: teamName, role: "tracker", cloudBacked: true });
      const roster = normalizeRosterPlayer({
        id: fixtureIds.player,
        teamId: fixtureIds.team,
        name: playerName,
        number: "99",
        position: "Midfield",
        active: true,
      });
      const player = rosterPlayerToPlayer(roster);
      const events = [
        normalizeEvent({
          id: `${fixtureIds.game}-csv-event-a`,
          gameId: fixtureIds.game,
          timestamp: "2026-07-28T12:00:00.000Z",
          quarter: "Q1",
          statType: "groundBall",
          statLabel: "Ground Ball",
          category: "Possession",
          pointValue: 1,
          fieldZone: "Midfield",
          note: "SYNTHETIC_PRIVATE_CSV_NOTE",
          tags: ["SYNTHETIC_PRIVATE_CSV_TAG"],
        }, fixtureIds.game),
        normalizeEvent({
          id: `${fixtureIds.game}-csv-event-b`,
          gameId: fixtureIds.game,
          timestamp: "2026-07-28T12:01:00.000Z",
          quarter: "Q1",
          statType: "assist",
          statLabel: "Assist",
          category: "Offense",
          pointValue: 2,
          fieldZone: "Offensive",
        }, fixtureIds.game),
      ];
      const game = normalizeGame({
        id: fixtureIds.game,
        userId: currentUserId(),
        teamId: fixtureIds.team,
        rosterPlayerId: fixtureIds.player,
        opponent: "V284 Synthetic Rivals",
        date: "2026-07-28",
        periodFormat: "quarters",
        playerSnapshot: player,
        events,
        trackedPlayingTime: {
          clockState: {
            isRunning: true,
            clockSecondsRemaining: 250,
            recoveryState: "needs_review",
          },
          participationOperations: [{
            operationKind: "player_in",
            changeReason: "SYNTHETIC_PRIVATE_CORRECTION",
          }],
        },
      });
      state.teams = [team];
      state.rosterPlayers = [roster];
      state.players = [player];
      state.player = player;
      state.activePlayerId = player.id;
      state.activeTeamId = team.id;
      state.games = [game];
      state.activeGame = null;
      const audit = await recordSensitiveExportAudit("player_csv", "game", game.id);
      const csv = buildCSV({ scope: "current_game", gameId: game.id });
      const recap = buildFamilyRecap(game, events, player, calculateTotals(events, player));
      return { audit, csv, recap };
    }, {
      fixtureIds: context.fixture.ids,
      teamName: context.fixture.teamName,
      playerName: context.fixture.playerName,
    });
    assert.equal(exportResult.audit?.outcome, "accepted");
    assert.match(exportResult.csv, /Ground Ball/);
    assert.match(exportResult.csv, /Assist/);
    assert.doesNotMatch(exportResult.csv, /player_in|Player In|clock|shift|tracked|needs_review|SYNTHETIC_PRIVATE/i);
    assert.equal(typeof exportResult.recap?.text, "string");
    assert.doesNotMatch(exportResult.recap.text, /player_in|Player In|clock|shift|tracked|needs_review|SYNTHETIC_PRIVATE/i);
    const header = exportResult.csv.split(/\r?\n/)[0].toLowerCase();
    assert.doesNotMatch(header, /clock|participation|shift|tracked|correction|recovery/);

    const revoke = await acceptedRpc(
      context.apiUrl,
      context.publishableKey,
      "lh_revoke_live_share_tokens",
      { p_game_id: context.fixture.ids.game },
      context.coachSession.access_token,
    );
    assert.match(revoke.code, /live_share_tokens?_revoked/);
    await viewer.reload({ waitUntil: "domcontentloaded" });
    await viewer.waitForFunction(() => state.syncStatus === "Shared game unavailable", null, { timeout: 30000 });
    const revokedState = await viewer.evaluate(() => ({
      status: state.syncStatus,
      hasGame: Boolean(state.sharedGame),
      body: document.body.innerText,
    }));
    assert.equal(revokedState.status, "Shared game unavailable");
    assert.equal(revokedState.hasGame, false);
    assert.match(revokedState.body, /unavailable/i);
    assert.deepEqual(diagnostics, [], `browser diagnostics: ${diagnostics.join(" | ")}`);

    const viewerTitle = await viewer.title();
    await trackerContext.close();
    await viewerContext.close();
    return {
      pageIdentity: {
        title: viewerTitle,
        publicStatusBeforeRevoke: publicState.status,
        publicStatusAfterRevoke: revokedState.status,
      },
      publicDomEventCount: publicState.eventCount,
      selectedCsv: {
        auditOutcome: exportResult.audit.outcome,
        rowCount: exportResult.csv.split(/\r?\n/).length - 1,
        forbiddenMatches: [],
      },
      recap: {
        routablePublicSurface: false,
        result: "Not applicable — no routable public recap surface",
        privatePreviewForbiddenMatches: [],
      },
      network: {
        apiRequests,
        unexpectedApiRequests: [],
      },
      diagnostics,
      expectedDiagnostics,
      stalePayloadClearedAfterRevoke: true,
    };
  } finally {
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

function localAuthState(containerName, userId) {
  return JSON.parse(psql(containerName, `
select json_build_object(
  'usersRemaining', (select count(*) from auth.users where id = ${sqlLiteral(userId)}::uuid),
  'sessionsRemaining', (select count(*) from auth.sessions where user_id::text = ${sqlLiteral(userId)}),
  'refreshTokensRemaining', (select count(*) from auth.refresh_tokens where user_id::text = ${sqlLiteral(userId)})
)::text;
`));
}

async function revokeAndDeleteLocalAuthUsers(context) {
  const proofs = [];
  for (const { role, userId, session } of [
    { role: "coach", userId: context.coachId, session: context.coachSession },
    { role: "admin", userId: context.adminId, session: null },
  ].filter((entry) => entry.userId)) {
    const logout = session
      ? await request(`${context.apiUrl}/auth/v1/logout?scope=global`, {
          method: "POST",
          headers: apiHeaders(context.publishableKey, session.access_token),
          body: {},
        })
      : null;
    if (session) {
      assert.ok(
        [200, 204].includes(logout.status),
        `local ${role} Auth session revocation failed with status ${logout.status}`,
      );
    }
    const afterLogout = localAuthState(context.containerName, userId);
    assertExactZeroCount(afterLogout.sessionsRemaining, `local ${role} Auth session remained or count was unavailable`);
    assertExactZeroCount(afterLogout.refreshTokensRemaining, `local ${role} refresh token remained or count was unavailable`);

    let tokenProof = {
      oldAuthTokenRejected: true,
      oldAuthTokenRejectedAfterDelete: true,
      oldRefreshTokenRejected: true,
      oldPrivateRpcRejected: true,
      privateRpcProbeGameRows: 1,
      accessTokenFingerprint: "not_issued",
      refreshTokenFingerprint: "not_issued",
    };
    if (session) {
      const oldAuth = await request(`${context.apiUrl}/auth/v1/user`, {
        headers: apiHeaders(context.publishableKey, session.access_token),
      });
      const oldRefresh = await request(`${context.apiUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: apiHeaders(context.publishableKey, context.publishableKey),
        body: { refresh_token: session.refresh_token },
      });
      const privateRpcProbe = JSON.parse(psql(context.containerName, `
select json_build_object(
  'gameRows', (select count(*) from public.games where id = ${sqlLiteral(context.fixture.ids.game)})
)::text;
`));
      assert.equal(
        privateRpcProbe.gameRows,
        1,
        "old-token private RPC probe requires the synthetic game to remain present",
      );
      const oldPrivateRpc = await rpc(
        context.apiUrl,
        context.publishableKey,
        "lh_read_game_clock",
        { p_game_id: context.fixture.ids.game },
        session.access_token,
      );
      tokenProof = {
        oldAuthTokenRejected: [401, 403].includes(oldAuth.status),
        oldRefreshTokenRejected: oldRefresh.status >= 400,
        oldPrivateRpcRejected:
          oldPrivateRpc.status >= 400
          || oldPrivateRpc.body?.outcome !== "accepted",
        privateRpcProbeGameRows: privateRpcProbe.gameRows,
        accessTokenFingerprint: tokenFingerprint(session.access_token),
        refreshTokenFingerprint: tokenFingerprint(session.refresh_token),
      };
    }
    const removed = await request(`${context.apiUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: apiHeaders(context.publishableKey, context.serviceRoleKey),
    });
    assert.ok([200, 204, 404].includes(removed.status), "local synthetic Auth user deletion failed");
    if (session) {
      const oldAuthAfterDelete = await request(`${context.apiUrl}/auth/v1/user`, {
        headers: apiHeaders(context.publishableKey, session.access_token),
      });
      tokenProof.oldAuthTokenRejectedAfterDelete = [401, 403].includes(oldAuthAfterDelete.status);
    }
    const finalState = localAuthState(context.containerName, userId);
    assertExactZeroCount(finalState.usersRemaining, `local ${role} Auth user remained or count was unavailable`);
    assertExactZeroCount(finalState.sessionsRemaining, `local ${role} Auth session remained after user deletion or count was unavailable`);
    assertExactZeroCount(finalState.refreshTokensRemaining, `local ${role} refresh token remained after user deletion or count was unavailable`);
    const proof = {
      role,
      logoutStatus: logout?.status ?? "no_session_issued",
      ...finalState,
      ...tokenProof,
      noSessionIssued: !session,
    };
    if (session) assertSessionRevocationProof(proof);
    proofs.push(proof);
  }
  return proofs;
}

async function cleanupFixture(context) {
  const publicAfterRevoke = await rpc(
    context.apiUrl,
    context.publishableKey,
    "lh_public_live_share_game",
    { p_share_code: context.disclosure?.shareCode || "V284-LOCAL-CLEANUP" },
  );
  assert.equal(publicAfterRevoke.status, 200);
  assert.equal(publicAfterRevoke.body, null);
  psql(context.containerName, revokeFixtureGrantsSql(context.fixture, context.adminId));
  const auth = await revokeAndDeleteLocalAuthUsers(context);
  psql(context.containerName, removeMutableFixtureSql(context.fixture, context.adminId, context.coachId));
  const proof = JSON.parse(psql(context.containerName, `
select json_build_object(
  'authUsers', (
    select count(*) from auth.users
    where raw_user_meta_data ->> 'fixture_run_id' = ${sqlLiteral(context.fixture.runId)}
  ),
  'authSessions', (
    select count(*) from auth.sessions
    where user_id::text in (${sqlLiteral(context.adminId)}, ${sqlLiteral(context.coachId)})
  ),
  'authRefreshTokens', (
    select count(*) from auth.refresh_tokens
    where user_id::text in (${sqlLiteral(context.adminId)}, ${sqlLiteral(context.coachId)})
  ),
  'legacyTeams', (select count(*) from public.teams where id = ${sqlLiteral(context.fixture.ids.team)}),
  'legacyGames', (select count(*) from public.games where id = ${sqlLiteral(context.fixture.ids.game)}),
  'legacyEvents', (select count(*) from public.events where game_id = ${sqlLiteral(context.fixture.ids.game)}),
  'activeTokens', (
    select count(*) from public.lh_live_share_tokens
    where game_id = ${sqlLiteral(context.fixture.ids.game)}
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ),
  'activeGrants', (
    with latest as (
      select distinct on (grant_id) grant_id, event_type
      from public.lh_grant_lifecycle_events
      where grant_id in (${sqlLiteral(context.fixture.ids.adminGrant)}, ${sqlLiteral(context.fixture.ids.coachGrant)})
      order by grant_id, sequence desc
    )
    select count(*) from latest where event_type = 'accepted'
  ),
  'pendingOrConflictedOperations', (
    select count(*) from public.lh_event_operations
    where game_id = ${sqlLiteral(context.fixture.ids.game)}
      and outcome_class in ('pending', 'conflicted')
  ),
  'retainedScopes', (
    (select count(*) from public.lh_team_scopes where team_id = ${sqlLiteral(context.fixture.ids.team)})
    + (select count(*) from public.lh_player_scopes where team_id = ${sqlLiteral(context.fixture.ids.team)})
    + (select count(*) from public.lh_game_scopes where game_id = ${sqlLiteral(context.fixture.ids.game)})
  ),
  'retainedGrants', (
    select count(*) from public.lh_access_grants
    where id in (${sqlLiteral(context.fixture.ids.adminGrant)}, ${sqlLiteral(context.fixture.ids.coachGrant)})
  ),
  'retainedLifecycleEvents', (
    select count(*) from public.lh_grant_lifecycle_events
    where grant_id in (${sqlLiteral(context.fixture.ids.adminGrant)}, ${sqlLiteral(context.fixture.ids.coachGrant)})
  ),
  'retainedTrackedOperations', (
    select count(*) from public.lh_participation_operations
    where game_id = ${sqlLiteral(context.fixture.ids.game)}
  )
)::text;
`));
  for (const key of [
    "authUsers",
    "authSessions",
    "authRefreshTokens",
    "legacyTeams",
    "legacyGames",
    "legacyEvents",
    "activeTokens",
    "activeGrants",
    "pendingOrConflictedOperations",
  ]) {
    assertExactZeroCount(proof[key], `local cleanup proof failed for ${key}`);
  }
  return { ...proof, auth };
}

function startLocalStack(tempRoot) {
  run(
    "supabase",
    [
      "start",
      "--workdir",
      tempRoot,
      "--exclude",
      "storage-api,imgproxy,logflare,vector",
    ],
    { label: "local Supabase start", timeout: 180000 },
  );
  const raw = run(
    "supabase",
    ["status", "--workdir", tempRoot, "-o", "json"],
    { label: "local Supabase status", timeout: 30000 },
  ).stdout;
  const status = JSON.parse(raw);
  const normalized = {
    apiUrl: status.API_URL || status.api_url || LOCAL_API_URL,
    dbUrl: status.DB_URL || status.db_url,
    publishableKey:
      status.PUBLISHABLE_KEY ||
      status.publishable_key ||
      status.ANON_KEY ||
      status.anon_key,
    serviceRoleKey: status.SERVICE_ROLE_KEY || status.service_role_key,
  };
  assert.ok(normalized.dbUrl, "local Supabase status omitted the database URL");
  assert.ok(normalized.publishableKey, "local Supabase status omitted the publishable/anon key");
  assert.ok(normalized.serviceRoleKey, "local Supabase status omitted the service-role key");
  validateLocalTarget({
    apiUrl: normalized.apiUrl,
    dbUrl: normalized.dbUrl,
    projectId: LOCAL_PROJECT_ID,
    containerName: LOCAL_DB_CONTAINER,
    fixturePrefix: SYNTHETIC_PREFIX,
  });
  psql(LOCAL_DB_CONTAINER, `
do $guard$
begin
  if current_database() <> 'postgres' or inet_server_port() <> 5432 then
    raise exception 'LOCAL_FIXTURE_DATABASE_GUARD_FAILED';
  end if;
end
$guard$;
`);
  return normalized;
}

function isTcpPortOpen(port, timeout = 300) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeout, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function waitForPortToClose(port) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!(await isTcpPortOpen(port))) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return true;
}

function projectContainers() {
  return run(
    "docker",
    ["ps", "-a", "--format", "{{.Names}}"],
    { label: "local Docker container inventory", timeout: 30000 },
  ).stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.endsWith(`_${LOCAL_PROJECT_ID}`));
}

export async function completeLocalTeardown(tempRoot, operations = {}) {
  const stop = operations.stop || (() => {
    run(
      "supabase",
      ["stop", "--workdir", tempRoot, "--no-backup"],
      { label: "local Supabase stop", timeout: 60000 },
    );
    return { exitCode: 0 };
  });
  const listContainers = operations.listContainers || projectContainers;
  const isPortStillOpen = operations.isPortOpen || waitForPortToClose;
  const removeTemporaryRoot = operations.removeTemporaryRoot || (() => safeRemoveTempRoot(tempRoot));
  const temporaryRootExists = operations.temporaryRootExists || (() => fs.existsSync(tempRoot));

  const stopResult = await stop();
  const proof = {
    stopExitCode: stopResult?.exitCode,
    remainingContainers: await listContainers(),
    openPorts: [],
    temporaryRootRemoved: false,
    disposableStackRemoved: false,
  };
  assert.equal(proof.stopExitCode, 0, "local Supabase stop did not exit 0");
  assert.deepEqual(proof.remainingContainers, [], "disposable project containers survived teardown");
  for (const port of LOCAL_PROJECT_PORTS) {
    if (await isPortStillOpen(port)) proof.openPorts.push(port);
  }
  assert.deepEqual(proof.openPorts, [], "disposable project ports survived teardown");
  await removeTemporaryRoot();
  proof.temporaryRootRemoved = !temporaryRootExists();
  assert.equal(proof.temporaryRootRemoved, true, "temporary harness directory survived teardown");
  proof.disposableStackRemoved = true;
  assertTeardownProof(proof);
  return proof;
}

function cleanupFailure(error) {
  const failure = new Error(`cleanup_failed: ${error?.message || "local teardown verification failed"}`);
  failure.code = "cleanup_failed";
  return failure;
}

export async function runLocalDisclosureFixture() {
  const deploymentIsolation = verifyApprovedApplicationIsolation();
  validateLocalTarget({
    apiUrl: LOCAL_API_URL,
    dbUrl: LOCAL_DB_URL,
    projectId: LOCAL_PROJECT_ID,
    containerName: LOCAL_DB_CONTAINER,
    fixturePrefix: SYNTHETIC_PREFIX,
  });
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-v284-disclosure-"));
  const fixture = createFixtureDescriptor();
  const password = `V284-${randomBytes(18).toString("base64url")}!`;
  let context = null;
  let stackStarted = false;
  let summary = null;
  let operationError = null;
  let teardown = null;
  try {
    copyLocalProject(tempRoot);
    stackStarted = true;
    const status = startLocalStack(tempRoot);
    context = {
      apiUrl: status.apiUrl,
      publishableKey: status.publishableKey,
      serviceRoleKey: status.serviceRoleKey,
      containerName: LOCAL_DB_CONTAINER,
      fixture,
    };
    context.adminId = await createAuthUser(
      context.apiUrl,
      context.publishableKey,
      context.serviceRoleKey,
      fixture,
      "admin",
      password,
    );
    context.coachId = await createAuthUser(
      context.apiUrl,
      context.publishableKey,
      context.serviceRoleKey,
      fixture,
      "coach",
      password,
    );
    const lifecycle = makeLifecycleRecords(fixture, context.adminId, context.coachId);
    lifecycle.admin.forEach((record) => assertHomogeneousLifecycleBatch([record], fixture.runId));
    lifecycle.coach.forEach((record) => assertHomogeneousLifecycleBatch([record], fixture.runId));
    psql(context.containerName, seedSql(fixture, context.adminId, context.coachId, lifecycle));
    context.coachSession = await signIn(
      context.apiUrl,
      context.publishableKey,
      fixture.coachEmail,
      password,
    );
    context.disclosure = await createPrivateAndPublicEvidence(context);
    const api = await verifyApiDisclosure(context, context.disclosure);
    const browser = await verifyBrowserDisclosure(context, context.disclosure);
    const cleanup = await cleanupFixture(context);
    context.cleanupComplete = true;
    summary = {
      status: "PASS",
      mechanism: "direct guarded psql seeding into a disposable local Supabase container",
      deploymentIsolation,
      environment: {
        projectId: LOCAL_PROJECT_ID,
        apiHost: "127.0.0.1",
        apiPort: 54321,
        databaseHost: "127.0.0.1",
        databasePort: 54322,
        databaseName: "postgres",
        containerName: LOCAL_DB_CONTAINER,
        productionProjectRejected: true,
        productionHostRejected: true,
      },
      fixture: {
        syntheticAdultUsers: 2,
        teams: 1,
        players: 1,
        games: 1,
        legacyEvents: 2,
        publicEvents: 2,
        trackedOperations: context.disclosure.trackedOperationCount,
        lifecycleStrategy: "canonical nine-key records inserted in explicit sequence order",
      },
      disclosure: { api, browser },
      cleanup,
      productionContacted: false,
      productionPermissionsChanged: false,
      rawCredentialsEmitted: false,
    };
  } catch (error) {
    operationError = error;
  } finally {
    if (context && context.disclosure && context.coachSession && !context.cleanupComplete) {
      try {
        await acceptedRpc(
          context.apiUrl,
          context.publishableKey,
          "lh_revoke_live_share_tokens",
          { p_game_id: context.fixture.ids.game },
          context.coachSession.access_token,
        );
      } catch {
        // The overall operation already fails; verified stack destruction remains mandatory.
      }
    }
    try {
      if (stackStarted) {
        teardown = await completeLocalTeardown(tempRoot);
      } else {
        safeRemoveTempRoot(tempRoot);
        assert.equal(fs.existsSync(tempRoot), false, "temporary harness directory survived setup failure");
      }
    } catch (error) {
      throw cleanupFailure(error);
    }
  }
  if (operationError) throw operationError;
  assert.ok(summary, "local disclosure summary was not produced");
  assertTeardownProof(teardown);
  return {
    ...summary,
    teardown,
    disposableStackRemoved: true,
  };
}

async function main() {
  if (process.argv.includes("--verify-deployment-isolation")) {
    process.stdout.write(`${JSON.stringify({
      status: "PASS",
      deploymentIsolation: verifyApprovedApplicationIsolation(),
    }, null, 2)}\n`);
    return;
  }
  const summary = await runLocalDisclosureFixture();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
