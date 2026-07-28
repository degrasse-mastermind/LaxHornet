import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const context = { window: {} };
vm.runInNewContext(read("public-event-semantics.js"), context, {
  filename: "public-event-semantics.js",
});
const semantics = context.window.LaxHornetPublicEventSemantics;

assert.ok(semantics, "public semantic resolver is exported");
assert.equal(semantics.definitions.length, 19, "ordinary event vocabulary is explicit and closed");

for (const definition of semantics.definitions) {
  assert.deepEqual(
    { ...semantics.canonicalSemantic({ statType: definition.statType }) },
    { ...definition },
    `${definition.statType} resolves to its canonical semantic`,
  );
}

assert.equal(
  semantics.canonicalSemantic({ stat_type: "ground_ball" }).statType,
  "groundBall",
  "known separator variants normalize to the canonical stat type",
);
assert.equal(
  semantics.canonicalSemantic({ stat_type: "note" }).publicLiveShare,
  false,
  "ordinary notes remain canonical pipeline events but are private from Live Share",
);
assert.equal(
  semantics.publicSemantic({ stat_type: "note" }),
  null,
  "ordinary notes are excluded from the public vocabulary",
);
for (const privateType of [
  "",
  "legacy_shift_alias",
  "player_in",
  "player_out",
  "participation",
  "shift_start",
  "unknown_future_event",
]) {
  assert.equal(
    semantics.canonicalSemantic({ stat_type: privateType }),
    null,
    `${privateType || "empty stat type"} defaults private`,
  );
}
assert.equal(
  semantics.canonicalSemantic({
    stat_type: "goal",
    stat_label: "Private Participation Alias",
    category: "Private",
  }).statLabel,
  "Goal",
  "caller-controlled labels cannot change public semantics",
);

const app = read("app.js");
const appHtml = read("app.html");
const worker = read("service-worker.js");
const migration = read("supabase/migrations/20260728193942_v284_public_event_semantic_boundary.sql");
const rollback = read("supabase/rollback/20260728193942_v284_public_event_semantic_boundary_rollback.sql");

assert.ok(
  appHtml.indexOf("public-event-semantics.js?v=284") < appHtml.indexOf("app.js?v=284"),
  "semantic resolver loads before app.js",
);
assert.match(worker, /\.\/public-event-semantics\.js\?v=284/);
assert.match(app, /if \(!semantic\) return null;/);
assert.match(app, /suppressPrivateTrustSpineRecord/);
assert.match(app, /unsupported_event_semantics/);
assert.match(
  migration,
  /create or replace function lh_trust_private\.lh_public_event_semantic\(p_evidence jsonb\)/i,
);
assert.match(
  migration,
  /and semantic\.value ->> 'public' = 'true';/i,
  "anonymous egress is fail-closed",
);
assert.match(
  migration,
  /grant execute on function public\.lh_public_live_share_game\(text\) to anon, authenticated;/i,
);
assert.match(
  rollback,
  /revoke execute on function public\.lh_public_live_share_game\(text\)[\s\S]*from public, anon, authenticated;/i,
  "recovery rollback disables public disclosure",
);
assert.doesNotMatch(rollback, /drop\s+(table|function|schema)/i);

console.log("Public event semantic boundary checks passed.");
