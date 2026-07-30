import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const match = /^--([a-z-]+)=(.*)$/.exec(argument);
    if (!match) throw new Error(`Unsupported argument: ${argument}`);
    return [match[1], match[2]];
  }),
);
const baseUrl = new URL(options["base-url"] || "https://laxhornet.mybranford.com/");
const manifestPath = path.resolve(
  options.manifest || path.join(root, ".pages-artifact-metadata", "pages-deployment-manifest.json"),
);
const outputPath = options.output ? path.resolve(options.output) : "";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const allowed = new Set(manifest.files.map((entry) => entry.path));
const sourceFiles = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", manifest.sourceCommit],
  { cwd: root, encoding: "utf8", windowsHide: true },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();
const excluded = sourceFiles.filter((item) => !allowed.has(item));
const additionalProbes = [
  ".git/config",
  ".github/workflows/pages-deployment.yml",
  ".codex/config.toml",
  ".env",
  "docs/",
  "review-evidence/",
  "supabase/",
  "tools/",
  "tools/v284_local_disclosure_fixture.mjs",
  "tools/v284_production_disclosure_fixture.mjs",
];

function publicUrl(relativePath, cacheBust = false) {
  const encoded = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(encoded, baseUrl);
  if (cacheBust) url.searchParams.set("pages-verification", manifest.sourceCommit);
  return url;
}

async function request(url, init, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { cache: "no-store", redirect: "manual", ...init });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError;
}

async function mapLimit(values, concurrency, callback) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

const deployedFiles = await mapLimit(manifest.files, 8, async (entry) => {
  const response = await request(publicUrl(entry.path, true));
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    path: entry.path,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    size: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    expectedSize: entry.size,
    expectedSha256: entry.sha256,
  };
});
const deployedFailures = deployedFiles.filter(
  (entry) =>
    entry.status !== 200
    || entry.size !== entry.expectedSize
    || entry.sha256 !== entry.expectedSha256,
);
assert.deepEqual(deployedFailures, [], `deployed artifact mismatch:\n${JSON.stringify(deployedFailures, null, 2)}`);

const excludedFiles = await mapLimit(excluded, 16, async (relativePath) => {
  const response = await request(publicUrl(relativePath, true), { method: "HEAD" });
  return { path: relativePath, status: response.status };
});
const excludedFailures = excludedFiles.filter((entry) => entry.status >= 200 && entry.status < 400);
assert.deepEqual(excludedFailures, [], `excluded tracked files remain public:\n${JSON.stringify(excludedFailures, null, 2)}`);

const probeResults = await mapLimit(additionalProbes, 8, async (relativePath) => {
  const response = await request(publicUrl(relativePath, true), { method: "HEAD" });
  return { path: relativePath, status: response.status };
});
const probeFailures = probeResults.filter((entry) => entry.status >= 200 && entry.status < 400);
assert.deepEqual(probeFailures, [], `internal probes remain public:\n${JSON.stringify(probeFailures, null, 2)}`);

const evidence = {
  capturedAt: new Date().toISOString(),
  productionUrl: baseUrl.toString(),
  sourceCommit: manifest.sourceCommit,
  releaseVersion: manifest.releaseVersion,
  deployedFileCount: deployedFiles.length,
  excludedTrackedFileCount: excludedFiles.length,
  deployedFiles,
  excludedFiles,
  additionalProbes: probeResults,
  realUserDataTouched: false,
  status: "PASS",
};
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}
process.stdout.write(
  `${JSON.stringify({
    status: evidence.status,
    sourceCommit: evidence.sourceCommit,
    deployedFileCount: evidence.deployedFileCount,
    excludedTrackedFileCount: evidence.excludedTrackedFileCount,
    additionalProbeCount: evidence.additionalProbes.length,
    outputPath: outputPath || null,
  }, null, 2)}\n`,
);
