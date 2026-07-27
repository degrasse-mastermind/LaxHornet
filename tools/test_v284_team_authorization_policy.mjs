import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function sqlFunction(sql, qualifiedName) {
  const marker = `create or replace function ${qualifiedName}`;
  const start = sql.indexOf(marker);
  assert.ok(start >= 0, `missing SQL function: ${qualifiedName}`);
  const bodyStart = sql.indexOf("as $$", start);
  const end = sql.indexOf("$$;", bodyStart);
  assert.ok(bodyStart >= 0 && end > bodyStart, `incomplete SQL function: ${qualifiedName}`);
  return sql.slice(start, end + 3);
}

const trustSpine = source(
  "supabase/migrations/20260723010000_trust_spine_release_1.sql",
);
const trackedTime = source(
  "supabase/migrations/20260727000000_tracked_playing_time_operations.sql",
);
const pgTap = source("supabase/tests/tracked_playing_time_foundation.sql");
const foundationDoc = source("docs/TRACKED_PLAYING_TIME_FOUNDATION.md");
const workflowDoc = source("docs/RELEASE_VERIFICATION_WORKFLOW.md");

const activeGrants = sqlFunction(
  trustSpine,
  "lh_trust_private.lh_active_grants_for_user",
);
assert.match(activeGrants, /latest\.event_type = 'accepted'/);
assert.match(activeGrants, /grants\.expires_at is null or grants\.expires_at > p_at/);

const mutationGrant = sqlFunction(
  trustSpine,
  "lh_trust_private.lh_mutation_grant_for_game",
);
assert.match(mutationGrant, /active\.grant_role = 'parent'/);
assert.match(mutationGrant, /active\.grant_role = 'coach'/);
assert.doesNotMatch(mutationGrant, /active\.grant_role = 'team_admin'/);

const exportGrant = sqlFunction(
  trustSpine,
  "lh_trust_private.lh_export_grant_for_game",
);
assert.match(exportGrant, /active\.grant_role = 'parent'/);
assert.match(exportGrant, /active\.grant_role = 'coach'/);
assert.match(exportGrant, /active\.grant_role = 'team_admin'/);

const initializeScope = sqlFunction(
  trackedTime,
  "lh_trust_private.lh_tracked_time_initialize_scope",
);
const registrationIndex = initializeScope.indexOf("lh_register_game_scope_impl");
const mutationIndex = initializeScope.indexOf("lh_mutation_grant_for_game");
assert.ok(registrationIndex >= 0 && mutationIndex > registrationIndex);
assert.match(initializeScope, /if mutation_grant is null then\s+return;/);

const initializeClock = sqlFunction(
  trackedTime,
  "lh_trust_private.lh_initialize_game_clock_impl",
);
assert.match(initializeClock, /lh_tracked_time_initialize_scope\(actor_id, game_id\)/);
assert.match(
  initializeClock,
  /if not found then\s+return pg_catalog\.jsonb_build_object\('outcome', 'rejected', 'code', 'unauthorized_scope'\)/,
);

const canRead = sqlFunction(
  trackedTime,
  "lh_trust_private.lh_tracked_time_can_read",
);
assert.match(canRead, /lh_export_grant_for_game\(p_user_id, p_game_id\) is not null/);

assert.match(
  pgTap,
  /'tracked-player-claim'[\s\S]*?'tracked-team-a'[\s\S]*?'tracked-roster-a'[\s\S]*?'11111111-1111-4111-8111-111111111111'/,
);
assert.match(
  pgTap,
  /'tracked-grant-parent'[\s\S]*?'parent'[\s\S]*?'player'[\s\S]*?'tracked-team-a'[\s\S]*?'tracked-roster-a'/,
);
assert.match(
  pgTap,
  /'authorized team-roster tracker initializes clock'/,
);

assert.match(foundationDoc, /Team admin alone is not a tracked-time mutation role/);
assert.match(foundationDoc, /There is no standalone `tracker` Trust Spine role or capability/);
assert.match(
  workflowDoc,
  /Do not use a team-admin-only fixture as the\s+authorized tracked-time actor/,
);

console.log("V284 team authorization policy contracts passed.");
