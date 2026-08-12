import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const runner = fs.readFileSync("tools/run_supabase_preview_server_matrix.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/supabase-preview-server-matrix.yml", "utf8");
const mapping = JSON.parse(fs.readFileSync("release/hosted-postgres-verification-map.json", "utf8"));

assert.equal(mapping.suites.length, 6, "all six retired suites must be mapped");
assert.equal(new Set(mapping.suites.map((suite) => suite.retiredSuite)).size, 6, "retired suite mappings must be unique");
for (const suite of mapping.suites) {
  assert.ok(suite.portable.length, `${suite.retiredSuite} needs portable coverage`);
  assert.ok(suite.hosted.length, `${suite.retiredSuite} needs hosted coverage`);
  assert.ok(suite.hostedGroup, `${suite.retiredSuite} needs a hosted runner group`);
}

for (const required of [
  "SUPABASE_PREVIEW_URL", "SUPABASE_PREVIEW_ANON_KEY", "SUPABASE_PREVIEW_DB_URL",
  "SUPABASE_PREVIEW_PROJECT_REF", "SUPABASE_PREVIEW_BRANCH", "SUPABASE_PREVIEW_SHA",
]) assert.ok(runner.includes(required), `${required} must be required`);

assert.ok(runner.includes("const productionRef"), "production project must be denylisted");
assert.ok(runner.includes("psqlConcurrent"), "hosted runner must create independent concurrent PostgreSQL sessions");
assert.ok(runner.includes("auth.uid()"), "hosted runner must prove authenticated auth.uid behavior");
assert.ok(runner.includes("relforcerowsecurity"), "hosted runner must inspect FORCE RLS");
assert.ok(runner.includes("has_function_privilege"), "hosted runner must inspect RPC grants");
assert.ok(runner.includes("r207_apply_game_operation_for_test"), "hosted runner must exercise injected transaction failure");
assert.ok(workflow.includes("branches get"), "workflow must resolve the automatic Supabase Preview branch");
assert.ok(workflow.includes("PREVIEW_CONFIGURATION_REQUIRED"), "missing external Preview configuration must fail closed");
assert.ok(!workflow.includes("supabase db push"), "workflow must not push migrations manually");

const cleared = { ...process.env };
for (const key of Object.keys(cleared)) if (/SUPABASE|POSTGRES_URL|GITHUB_HEAD_REF|GITHUB_SHA/.test(key)) delete cleared[key];
const missing = spawnSync(process.execPath, ["tools/run_supabase_preview_server_matrix.mjs"], { encoding: "utf8", env: cleared });
assert.notEqual(missing.status, 0, "missing Preview identity must fail");
assert.match(`${missing.stdout}\n${missing.stderr}`, /url is present|HOSTED_PREVIEW_MATRIX_FAILED/);

const productionRef = ["ulbmjcvn", "yznvmjgpstno"].join("");
const production = spawnSync(process.execPath, ["tools/run_supabase_preview_server_matrix.mjs"], {
  encoding: "utf8",
  env: {
    ...cleared,
    SUPABASE_PREVIEW_URL: `https://${productionRef}.supabase.co`,
    SUPABASE_PREVIEW_ANON_KEY: "synthetic-not-a-real-key-xxxxxxxx",
    SUPABASE_PREVIEW_DB_URL: `postgresql://example.invalid/postgres?ref=${productionRef}`,
    SUPABASE_PREVIEW_PROJECT_REF: productionRef,
    SUPABASE_PREVIEW_BRANCH: "codex/test",
    SUPABASE_PREVIEW_SHA: "a".repeat(40),
  },
});
assert.notEqual(production.status, 0, "production project identity must fail before contact");
assert.match(`${production.stdout}\n${production.stderr}`, /Preview project is not the production project|HOSTED_PREVIEW_MATRIX_FAILED/);

console.log("Supabase Preview server-matrix contracts: 20/20 passed.");
