import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  LIFECYCLE_KEYS,
  LOCAL_API_URL,
  LOCAL_DB_CONTAINER,
  LOCAL_DB_URL,
  LOCAL_PROJECT_ID,
  PRODUCTION_HOST,
  PRODUCTION_PROJECT_REF,
  SYNTHETIC_PREFIX,
  assertHomogeneousLifecycleBatch,
  assertSyntheticFixtureDescriptor,
  validateLocalTarget,
} from "./v284_local_disclosure_fixture.mjs";

const results = [];
const runId = `${SYNTHETIC_PREFIX}unit`;
const validTarget = {
  apiUrl: LOCAL_API_URL,
  dbUrl: LOCAL_DB_URL,
  projectId: LOCAL_PROJECT_ID,
  containerName: LOCAL_DB_CONTAINER,
  fixturePrefix: SYNTHETIC_PREFIX,
};
const canonicalRecord = {
  actor_grant_id: `${runId}-admin-grant`,
  actor_user_id: "00000000-0000-4000-8000-000000000001",
  event_type: "grant_issued",
  grant_id: `${runId}-coach-grant`,
  id: `${runId}-lifecycle-1`,
  occurred_at: "2026-07-28T12:00:00.000Z",
  reason: null,
  related_grant_id: null,
  sequence: 1,
};

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

function rejects(name, callback, pattern) {
  test(name, () => assert.throws(callback, pattern));
}

test("accepts the exact disposable local target", () => {
  assert.equal(validateLocalTarget(validTarget), true);
});

rejects(
  "rejects the production API host",
  () => validateLocalTarget({ ...validTarget, apiUrl: `https://${PRODUCTION_HOST}` }),
  /must use HTTP|loopback|port mismatch|production host is forbidden/,
);
rejects(
  "rejects the production database host",
  () => validateLocalTarget({
    ...validTarget,
    dbUrl: `postgresql://postgres:postgres@db.${PRODUCTION_HOST}:5432/postgres`,
  }),
  /loopback|port mismatch|production host is forbidden/,
);
rejects(
  "rejects the production project reference",
  () => validateLocalTarget({ ...validTarget, projectId: PRODUCTION_PROJECT_REF }),
  /project ID mismatch|production project reference is forbidden/,
);
rejects(
  "rejects a nonstandard local API port",
  () => validateLocalTarget({ ...validTarget, apiUrl: "http://127.0.0.1:54320" }),
  /port mismatch/,
);
rejects(
  "rejects a nonstandard local database",
  () => validateLocalTarget({
    ...validTarget,
    dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/production",
  }),
  /database name mismatch/,
);
rejects(
  "rejects a mismatched container",
  () => validateLocalTarget({ ...validTarget, containerName: "supabase_db_other" }),
  /container mismatch/,
);

test("accepts one canonical nine-key lifecycle record", () => {
  const result = assertHomogeneousLifecycleBatch([canonicalRecord], runId);
  assert.equal(result.recordCount, 1);
  assert.deepEqual(result.keys, [...LIFECYCLE_KEYS].sort());
});
rejects(
  "rejects heterogeneous lifecycle record shapes",
  () => assertHomogeneousLifecycleBatch([
    canonicalRecord,
    { ...canonicalRecord, id: `${runId}-lifecycle-2`, sequence: 2, extra: true },
  ], runId),
  /heterogeneous lifecycle batch rejected/,
);
rejects(
  "rejects undefined lifecycle values before serialization",
  () => assertHomogeneousLifecycleBatch([
    { ...canonicalRecord, reason: undefined },
  ], runId),
  /undefined fixture value/,
);
rejects(
  "rejects non-synthetic lifecycle identifiers",
  () => assertHomogeneousLifecycleBatch([
    { ...canonicalRecord, grant_id: "real-team-grant" },
  ], runId),
  /non-synthetic grant_id rejected/,
);
rejects(
  "rejects credential-shaped lifecycle data",
  () => assertHomogeneousLifecycleBatch([
    { ...canonicalRecord, reason: "access_token" },
  ], runId),
  /credential-shaped value is forbidden/,
);

test("accepts a fully synthetic fixture descriptor", () => {
  assert.equal(assertSyntheticFixtureDescriptor({
    runId,
    ids: {
      team: `${runId}-team`,
      game: `${runId}-game`,
      player: `${runId}-player`,
    },
    adminEmail: `${runId}-admin@example.invalid`,
    coachEmail: `${runId}-coach@example.invalid`,
    teamName: "V284 Synthetic Team",
    playerName: "V284 Synthetic Player",
    opponent: "V284 Synthetic Opponent",
  }), true);
});
rejects(
  "rejects a realistic fixture email",
  () => assertSyntheticFixtureDescriptor({
    runId,
    ids: { team: `${runId}-team` },
    adminEmail: "coach@example.com",
    coachEmail: `${runId}-coach@example.invalid`,
    teamName: "V284 Synthetic Team",
    playerName: "V284 Synthetic Player",
    opponent: "V284 Synthetic Opponent",
  }),
  /did not match/,
);
rejects(
  "rejects realistic fixture labels",
  () => assertSyntheticFixtureDescriptor({
    runId,
    ids: { team: `${runId}-team` },
    adminEmail: `${runId}-admin@example.invalid`,
    coachEmail: `${runId}-coach@example.invalid`,
    teamName: "LaxHornet Varsity",
    playerName: "V284 Synthetic Player",
    opponent: "V284 Synthetic Opponent",
  }),
  /did not match/,
);

test("runner has no production mutation command", () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, "v284_local_disclosure_fixture.mjs"),
    "utf8",
  );
  assert.doesNotMatch(source, /supabase\s+(?:link|db\s+push|migration\s+repair|functions\s+deploy)/i);
  assert.doesNotMatch(source, /--linked\b/i);
  assert.match(source, /--no-backup/);
  assert.match(source, /validateLocalTarget/);
});

for (const result of results) {
  process.stdout.write(`${result.status} ${result.name}${result.error ? `: ${result.error}` : ""}\n`);
}
const failed = results.filter((result) => result.status === "FAIL");
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS ${results.length}/${results.length} local fixture safety contracts\n`);
}
