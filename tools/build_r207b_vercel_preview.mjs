import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifact } from "./build_pages_artifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".vercel-preview");
const metadata = path.join(root, ".vercel-preview-metadata");
const r207eEvidenceBranch = "feature/r2-07e-integrated-certification-v2";

assert.equal(process.env.VERCEL_ENV, "preview", "R2-07B build is restricted to Vercel Preview");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";
const evidenceOnlyBuild = process.env.VERCEL_GIT_COMMIT_REF === r207eEvidenceBranch;

buildArtifact({ root, outputPath: output, metadataPath: metadata });

const runtimePath = path.join(output, "runtime-config.js");
const runtime = fs.readFileSync(runtimePath, "utf8");
assert.ok(runtime.includes("r207bControlledPreview: false"), "default-off R2-07B flag is missing");
assert.ok(runtime.includes("r207cVersionedEventCorrections: false"), "default-off R2-07C flag is missing");
assert.ok(runtime.includes("r207dConflictResolution: false"), "default-off R2-07D flag is missing");
assert.ok(runtime.includes("r207ClockCommandBatch: false"), "default-off R2-07 clock command/batch flag is missing");

if (evidenceOnlyBuild) {
  assert.equal(supabaseUrl, "", "R2-07E evidence-only Preview must not receive a Supabase URL");
  assert.equal(publishableKey, "", "R2-07E evidence-only Preview must not receive a Supabase credential");
  process.stdout.write("R2-07E evidence-only default-off Vercel Preview artifact ready; Supabase Preview is not applicable.\n");
} else {
  assert.match(supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/i, "isolated Preview Supabase URL is required");
  assert.ok(publishableKey.length >= 20, "isolated Preview publishable credential is required");

  const previewRuntime = runtime
    .replace("r207bControlledPreview: false", "r207bControlledPreview: true")
    .replace("r207cVersionedEventCorrections: false", "r207cVersionedEventCorrections: true")
    .replace("r207dConflictResolution: false", "r207dConflictResolution: true")
    .replace("r207ClockCommandBatch: false", "r207ClockCommandBatch: true")
    .replace(
      "...(window.LAXHORNET_RUNTIME_CONFIG || {}),",
      `...(window.LAXHORNET_RUNTIME_CONFIG || {}),\n  supabaseUrl: ${JSON.stringify(supabaseUrl)},\n  supabasePublishableKey: ${JSON.stringify(publishableKey)},`,
    );
  fs.writeFileSync(runtimePath, previewRuntime, "utf8");
  process.stdout.write("R2-07B isolated Vercel Preview artifact ready.\n");
}
