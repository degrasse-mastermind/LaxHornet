import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifact } from "./build_pages_artifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".vercel-preview");
const metadata = path.join(root, ".vercel-preview-metadata");

assert.equal(process.env.VERCEL_ENV, "preview", "R2-07B build is restricted to Vercel Preview");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

const hasSupabaseUrl = Boolean(supabaseUrl);
const hasPublishableKey = Boolean(publishableKey);
assert.equal(
  hasSupabaseUrl,
  hasPublishableKey,
  "isolated Preview Supabase URL and publishable credential must be supplied together",
);
const connectedPreview = hasSupabaseUrl && hasPublishableKey;
if (connectedPreview) {
  assert.match(supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/i, "isolated Preview Supabase URL is invalid");
  assert.ok(publishableKey.length >= 20, "isolated Preview publishable credential is invalid");
}

buildArtifact({ root, outputPath: output, metadataPath: metadata });

const runtimePath = path.join(output, "runtime-config.js");
const runtime = fs.readFileSync(runtimePath, "utf8");
assert.ok(runtime.includes("r207bControlledPreview: false"), "default-off R2-07B flag is missing");
assert.ok(runtime.includes("r207cVersionedEventCorrections: false"), "default-off R2-07C flag is missing");
assert.ok(runtime.includes("r207dConflictResolution: false"), "default-off R2-07D flag is missing");
assert.ok(runtime.includes("r207ClockCommandBatch: false"), "default-off R2-07 clock command/batch flag is missing");
const previewRuntime = connectedPreview
  ? runtime
    .replace("r207bControlledPreview: false", "r207bControlledPreview: true")
    .replace("r207cVersionedEventCorrections: false", "r207cVersionedEventCorrections: true")
    .replace("r207dConflictResolution: false", "r207dConflictResolution: true")
    .replace("r207ClockCommandBatch: false", "r207ClockCommandBatch: true")
    .replace(
      "...(window.LAXHORNET_RUNTIME_CONFIG || {}),",
      `...(window.LAXHORNET_RUNTIME_CONFIG || {}),\n  supabaseUrl: ${JSON.stringify(supabaseUrl)},\n  supabasePublishableKey: ${JSON.stringify(publishableKey)},`,
    )
  : runtime
    .replace("publicLiveShareRpc: true", "publicLiveShareRpc: false")
    .replace("liveShareTokenRpc: true", "liveShareTokenRpc: false")
    .replace("exportAuditRpc: true", "exportAuditRpc: false")
    .replace(
      "...(window.LAXHORNET_RUNTIME_CONFIG || {}),",
      "...(window.LAXHORNET_RUNTIME_CONFIG || {}),\n  cloudDisabled: true,",
    );
fs.writeFileSync(runtimePath, previewRuntime, "utf8");

process.stdout.write(
  connectedPreview
    ? "R2-07B isolated connected Vercel Preview artifact ready.\n"
    : "LaxHornet device-only Vercel Preview artifact ready; cloud runtime disabled.\n",
);
