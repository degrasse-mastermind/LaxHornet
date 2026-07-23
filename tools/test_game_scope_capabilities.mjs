import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const runtime = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260723040000_event_pipeline_capabilities.sql"),
  "utf8",
);

assert.match(app, /TEAM_ROSTER:\s*"team_roster"/);
assert.match(app, /PERSONAL:\s*"personal"/);
assert.match(app, /scopeType:\s*gameScopeType\(/);
assert.match(app, /function hasCanonicalTrustSpineScope[\s\S]*isTeamRosterGame/);
assert.match(app, /function personalGameLiveShareMessage/);
assert.match(app, /requireSecureCapability\("secureLiveShare"/);
assert.match(app, /backendCapabilityAvailable\("exportAudit"\)/);
assert.doesNotMatch(
  app.slice(app.indexOf("async function loadSharedGame"), app.indexOf("async function copyShareLink")),
  /\.from\("games"\)/,
  "anonymous shared-game load must not fall back to direct table reads",
);

for (const setting of [
  "publicLiveShareRpc: true",
  "liveShareTokenRpc: true",
  "exportAuditRpc: true",
  "minimumSchemaCapability: 1",
]) {
  assert.ok(runtime.includes(setting), `runtime setting missing: ${setting}`);
}

for (const field of [
  "'schemaVersion', 1",
  "'trustSpineEvents', true",
  "'secureLiveShare', true",
  "'exportAudit', true",
  "'personalGameSharing', false",
]) {
  assert.ok(migration.includes(field), `capability field missing: ${field}`);
}
assert.match(migration, /security invoker/i);
assert.match(migration, /revoke all on function public\.lh_release_capabilities\(\) from public/i);
assert.match(migration, /grant execute on function public\.lh_release_capabilities\(\) to anon, authenticated/i);
assert.doesNotMatch(migration, /create table|alter table|insert into/i);

console.log("Game scope and backend capability contracts passed.");
