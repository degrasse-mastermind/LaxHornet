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

assert.match(supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/i, "isolated Preview Supabase URL is required");
assert.ok(publishableKey.length >= 20, "isolated Preview publishable credential is required");

buildArtifact({ root, outputPath: output, metadataPath: metadata });

const runtimePath = path.join(output, "runtime-config.js");
const runtime = fs.readFileSync(runtimePath, "utf8");
assert.ok(runtime.includes("r207bControlledPreview: false"), "default-off R2-07B flag is missing");
assert.ok(runtime.includes("r207cVersionedEventCorrections: false"), "default-off R2-07C flag is missing");
assert.ok(runtime.includes("r207dConflictResolution: false"), "default-off R2-07D flag is missing");
const previewRuntime = runtime
  .replace("r207bControlledPreview: false", "r207bControlledPreview: true")
  .replace("r207cVersionedEventCorrections: false", "r207cVersionedEventCorrections: true")
  .replace("r207dConflictResolution: false", "r207dConflictResolution: true")
  .replace(
    "...(window.LAXHORNET_RUNTIME_CONFIG || {}),",
    `...(window.LAXHORNET_RUNTIME_CONFIG || {}),\n  supabaseUrl: ${JSON.stringify(supabaseUrl)},\n  supabasePublishableKey: ${JSON.stringify(publishableKey)},`,
  );
fs.writeFileSync(runtimePath, previewRuntime, "utf8");

process.stdout.write("R2-07B isolated Vercel Preview artifact ready.\n");
