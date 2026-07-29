import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(modulePath), "..");
const defaultSpecPath = path.join(repositoryRoot, "release", "pages-deployment-allowlist.json");
const defaultOutputPath = path.join(repositoryRoot, ".pages-artifact");
const defaultMetadataPath = path.join(repositoryRoot, ".pages-artifact-metadata");

const TEXT_EXTENSIONS = new Set([
  ".css", ".eml", ".html", ".js", ".json", ".md", ".svg", ".txt", "",
]);

const SECRET_PATTERNS = Object.freeze([
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ["OpenAI key", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Stripe live key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["Supabase service-role assignment", /\b(?:SUPABASE_)?SERVICE_ROLE(?:_KEY)?\s*[:=]\s*["'][^"']{16,}["']/i],
  ["database password assignment", /\b(?:PGPASSWORD|DATABASE_PASSWORD|DB_PASSWORD)\s*[:=]\s*["'][^"']{8,}["']/i],
]);

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseArguments(argv) {
  const options = {};
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(argument);
    if (!match) throw new Error(`Unsupported argument: ${argument}`);
    options[match[1]] = match[2];
  }
  return options;
}

function normalizeRelativePath(value, label = "path") {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.length > 0, `${label} must not be empty`);
  assert.equal(value.includes("\\"), false, `${label} must use forward slashes`);
  assert.equal(path.posix.isAbsolute(value), false, `${label} must be relative`);
  const normalized = path.posix.normalize(value);
  assert.equal(normalized, value, `${label} must already be normalized`);
  assert.notEqual(normalized, ".", `${label} must identify a file`);
  assert.equal(normalized.startsWith("../"), false, `${label} must not traverse`);
  assert.equal(normalized.includes("/../"), false, `${label} must not traverse`);
  assert.equal(normalized.includes("\0"), false, `${label} must not contain NUL`);
  return normalized;
}

function sortedUnique(values, label) {
  assert.ok(Array.isArray(values), `${label} must be an array`);
  const normalized = values.map((value, index) => normalizeRelativePath(value, `${label}[${index}]`));
  const unique = [...new Set(normalized)].sort(comparePaths);
  assert.equal(unique.length, normalized.length, `${label} must not contain duplicates`);
  assert.deepEqual(normalized, unique, `${label} must be sorted`);
  return unique;
}

export function loadAllowlist(specPath = defaultSpecPath) {
  return JSON.parse(fs.readFileSync(specPath, "utf8"));
}

export function isForbiddenPath(relativePath, spec) {
  const normalized = normalizeRelativePath(relativePath);
  const lower = normalized.toLowerCase();
  const basename = path.posix.basename(normalized);
  const extension = path.posix.extname(normalized).toLowerCase();
  if (spec.forbiddenPrefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()))) return true;
  if (spec.forbiddenBasenames.some((item) => basename.toLowerCase() === item.toLowerCase())) return true;
  if (spec.forbiddenExtensions.some((item) => extension === item.toLowerCase())) return true;
  return spec.forbiddenPatterns.some((pattern) => new RegExp(pattern, "i").test(normalized));
}

export function validateAllowlist(spec) {
  assert.equal(spec.schemaVersion, 1, "unsupported Pages allowlist schema");
  assert.match(spec.allowlistVersion, /^\d{4}-\d{2}-\d{2}$/, "allowlistVersion must be YYYY-MM-DD");
  assert.equal(spec.expectedCustomDomain, "laxhornet.mybranford.com", "unexpected custom domain");
  assert.deepEqual(spec.directories, [], "directory-wide deployment is forbidden");

  const files = sortedUnique(spec.files, "files");
  const requiredRootFiles = sortedUnique(spec.requiredRootFiles, "requiredRootFiles");
  const entryPoints = sortedUnique(spec.entryPoints, "entryPoints");
  const approvedMarkdown = sortedUnique(spec.approvedPublicMarkdownFiles, "approvedPublicMarkdownFiles");
  const forbiddenPrefixes = sortedUnique(spec.forbiddenPrefixes, "forbiddenPrefixes");
  const forbiddenBasenames = sortedUnique(spec.forbiddenBasenames, "forbiddenBasenames");

  assert.deepEqual(
    spec.forbiddenExtensions,
    [...spec.forbiddenExtensions].sort(comparePaths),
    "forbiddenExtensions must be sorted",
  );
  assert.ok(spec.forbiddenPatterns.every((pattern) => typeof pattern === "string" && pattern.length > 0));

  for (const item of [
    ...requiredRootFiles,
    ...entryPoints,
    spec.serviceWorker,
    spec.webManifest,
    spec.customDomainFile,
    spec.releaseVersionFile,
  ]) {
    const normalized = normalizeRelativePath(item);
    assert.ok(files.includes(normalized), `required deployment file is absent from allowlist: ${normalized}`);
  }

  for (const relativePath of files) {
    assert.equal(isForbiddenPath(relativePath, spec), false, `allowlisted path is forbidden: ${relativePath}`);
    if (relativePath.toLowerCase().endsWith(".md")) {
      assert.ok(approvedMarkdown.includes(relativePath), `public Markdown lacks explicit approval: ${relativePath}`);
    }
  }
  assert.ok(forbiddenPrefixes.includes("tools/"), "tools/ must be forbidden");
  assert.ok(forbiddenPrefixes.includes("docs/"), "docs/ must be forbidden");
  assert.ok(forbiddenPrefixes.includes("review-evidence/"), "review-evidence/ must be forbidden");
  assert.ok(forbiddenPrefixes.includes("supabase/"), "supabase/ must be forbidden");
  assert.ok(spec.forbiddenExtensions.includes(".sql"), "SQL must be forbidden");
  assert.ok(spec.forbiddenExtensions.includes(".map"), "source maps must be forbidden");
  return files;
}

function resolveInside(base, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, ...normalized.split("/"));
  assert.ok(
    resolved.startsWith(`${resolvedBase}${path.sep}`),
    `resolved path escaped its base: ${relativePath}`,
  );
  return resolved;
}

function assertNoSymlink(root, relativePath) {
  const segments = normalizeRelativePath(relativePath).split("/");
  let current = path.resolve(root);
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    assert.equal(stat.isSymbolicLink(), false, `symbolic link is forbidden: ${relativePath}`);
  }
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function repositoryValue(root, args, fallback = "") {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
  } catch {
    return fallback;
  }
}

function sourceIdentity(root, overrides = {}) {
  const sourceCommit = overrides.sourceCommit
    || process.env.GITHUB_SHA
    || repositoryValue(root, ["rev-parse", "HEAD"], "WORKTREE");
  assert.match(sourceCommit, /^(?:[0-9a-f]{40}|WORKTREE)$/, "source commit must be an exact Git SHA");
  const sourceCommitTime = overrides.sourceCommitTime
    || repositoryValue(root, ["show", "-s", "--format=%cI", sourceCommit], new Date(0).toISOString());
  return { sourceCommit, sourceCommitTime };
}

function walkFiles(root) {
  const results = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => comparePaths(a.name, b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      const stat = fs.lstatSync(absolute);
      assert.equal(stat.isSymbolicLink(), false, `artifact symbolic link is forbidden: ${relative}`);
      if (entry.isDirectory()) visit(absolute);
      else {
        assert.ok(entry.isFile(), `artifact contains a non-file entry: ${relative}`);
        results.push(relative);
      }
    }
  };
  visit(root);
  return results.sort(comparePaths);
}

function stripQueryAndFragment(value) {
  return value.split("#", 1)[0].split("?", 1)[0];
}

function normalizeRuntimeReference(sourcePath, value) {
  const trimmed = String(value || "").trim();
  if (
    !trimmed
    || trimmed.startsWith("#")
    || /^(?:https?:|mailto:|tel:|data:|javascript:|blob:|about:)/i.test(trimmed)
  ) return null;
  const clean = stripQueryAndFragment(trimmed);
  if (!clean || clean === "." || clean === "./" || clean === "/") return "index.html";
  if (clean.startsWith("/")) return normalizeRelativePath(clean.slice(1), `reference in ${sourcePath}`);
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), clean));
  if (joined.endsWith("/")) return path.posix.join(joined, "index.html");
  return normalizeRelativePath(joined, `reference in ${sourcePath}`);
}

function extractMatches(source, expressions) {
  const values = [];
  for (const expression of expressions) {
    for (const match of source.matchAll(expression)) values.push(match[1]);
  }
  return values;
}

export function collectRuntimeReferences(outputRoot, spec) {
  const references = new Map();
  const record = (sourcePath, value) => {
    const normalized = normalizeRuntimeReference(sourcePath, value);
    if (!normalized) return;
    if (!references.has(normalized)) references.set(normalized, new Set());
    references.get(normalized).add(sourcePath);
  };

  for (const relativePath of spec.files) {
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (![".html", ".css", ".js", ".json"].includes(extension)) continue;
    const source = fs.readFileSync(resolveInside(outputRoot, relativePath), "utf8");
    if (extension === ".html") {
      for (const value of extractMatches(source, [/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi])) {
        record(relativePath, value);
      }
    } else if (extension === ".css") {
      for (const value of extractMatches(source, [/\burl\(\s*["']?([^"')]+)["']?\s*\)/gi])) {
        record(relativePath, value);
      }
    } else if (relativePath === spec.webManifest) {
      const manifest = JSON.parse(source);
      record(relativePath, manifest.start_url);
      for (const icon of manifest.icons || []) record(relativePath, icon.src);
    } else if (relativePath === spec.serviceWorker) {
      for (const value of extractMatches(source, [
        /["'](\.?\/[^"']+\.(?:html|js|css|json|png|svg|jpg|jpeg|webp|mp4|pdf|zip|eml|txt|md)(?:\?[^"']*)?)["']/gi,
      ])) record(relativePath, value);
    } else if (relativePath === "app.js") {
      for (const value of extractMatches(source, [
        /\bhref\s*:\s*["']([^"']+)["']/gi,
        /\.register\(\s*["']([^"']+)["']/gi,
        /\bfetch\(\s*[`"']([^`"']+)[`"']/gi,
      ])) record(relativePath, value);
    }
  }
  return [...references.entries()]
    .map(([reference, sources]) => ({ reference, sources: [...sources].sort() }))
    .sort((left, right) => comparePaths(left.reference, right.reference));
}

function scanSecrets(outputRoot, files) {
  const findings = [];
  for (const relativePath of files) {
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    const source = fs.readFileSync(resolveInside(outputRoot, relativePath), "utf8");
    for (const [name, pattern] of SECRET_PATTERNS) {
      if (pattern.test(source)) findings.push(`${relativePath}: ${name}`);
    }
  }
  assert.deepEqual(findings, [], `credential-shaped content detected:\n${findings.join("\n")}`);
}

function findZipEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("launch-kit ZIP end-of-central-directory record is missing");
}

export function validateLaunchKitArchive(outputRoot, spec) {
  const archivePath = resolveInside(outputRoot, "LaxHornet-launch-kit.zip");
  const bytes = fs.readFileSync(archivePath);
  const endOffset = findZipEndOfCentralDirectory(bytes);
  const disk = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const diskEntries = bytes.readUInt16LE(endOffset + 8);
  const totalEntries = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  assert.equal(disk, 0, "multi-disk launch-kit ZIP is forbidden");
  assert.equal(centralDisk, 0, "multi-disk launch-kit ZIP is forbidden");
  assert.equal(diskEntries, totalEntries, "launch-kit ZIP entry count is inconsistent");
  assert.notEqual(totalEntries, 0xffff, "ZIP64 launch-kit archive is forbidden");
  assert.ok(centralOffset + centralSize <= endOffset, "launch-kit ZIP central directory is out of bounds");

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50, "launch-kit ZIP central entry is invalid");
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const externalAttributes = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    normalizeRelativePath(name, `launch-kit ZIP entry ${index}`);
    assert.equal(name.endsWith("/"), false, `launch-kit ZIP directory entry is forbidden: ${name}`);
    assert.equal(flags & 0x1, 0, `encrypted launch-kit ZIP entry is forbidden: ${name}`);
    assert.ok(method === 0 || method === 8, `unsupported launch-kit ZIP compression: ${name}`);
    assert.notEqual(compressedSize, 0xffffffff, "ZIP64 launch-kit entry is forbidden");
    assert.notEqual(uncompressedSize, 0xffffffff, "ZIP64 launch-kit entry is forbidden");
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    assert.notEqual(unixMode & 0o170000, 0o120000, `launch-kit ZIP symlink is forbidden: ${name}`);

    assert.equal(bytes.readUInt32LE(localOffset), 0x04034b50, `launch-kit ZIP local entry is invalid: ${name}`);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString("utf8");
    assert.equal(localName, name, `launch-kit ZIP local/central path mismatch: ${name}`);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    assert.equal(compressed.length, compressedSize, `launch-kit ZIP payload is truncated: ${name}`);
    const content = method === 0 ? compressed : zlib.inflateRawSync(compressed);
    assert.equal(content.length, uncompressedSize, `launch-kit ZIP size mismatch: ${name}`);
    entries.push({ name, content });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(cursor, centralOffset + centralSize, "launch-kit ZIP central directory size is inconsistent");

  const sourceNames = spec.files
    .filter((item) => item.startsWith("launch-kit/"))
    .map((item) => item.slice("launch-kit/".length))
    .sort(comparePaths);
  const approvedEntries = spec.archives?.["LaxHornet-launch-kit.zip"]?.entries;
  assert.ok(approvedEntries && typeof approvedEntries === "object", "launch-kit ZIP approval manifest is missing");
  const expectedNames = Object.keys(approvedEntries);
  assert.deepEqual(expectedNames, [...expectedNames].sort(comparePaths), "launch-kit ZIP approval paths must be sorted");
  assert.ok(
    Object.values(approvedEntries).every((hash) => /^[0-9a-f]{64}$/.test(hash)),
    "launch-kit ZIP approval hashes must be SHA-256",
  );
  assert.deepEqual(expectedNames, sourceNames, "launch-kit ZIP approvals must cover the explicit launch-kit file set");
  const actualNames = entries.map((entry) => entry.name).sort(comparePaths);
  assert.equal(new Set(actualNames).size, actualNames.length, "launch-kit ZIP contains duplicate paths");
  assert.deepEqual(actualNames, expectedNames, "launch-kit ZIP entries differ from approved launch-kit files");

  const findings = [];
  for (const entry of entries) {
    assert.equal(
      sha256(entry.content),
      approvedEntries[entry.name],
      `launch-kit ZIP member hash differs from approval: ${entry.name}`,
    );
    if (!TEXT_EXTENSIONS.has(path.posix.extname(entry.name).toLowerCase())) continue;
    const source = entry.content.toString("utf8");
    for (const [name, pattern] of SECRET_PATTERNS) {
      if (pattern.test(source)) findings.push(`LaxHornet-launch-kit.zip!${entry.name}: ${name}`);
    }
  }
  assert.deepEqual(findings, [], `credential-shaped archive content detected:\n${findings.join("\n")}`);
  return entries.length;
}

function validateServiceWorkerPublicPaths(outputRoot, spec) {
  const source = fs.readFileSync(resolveInside(outputRoot, spec.serviceWorker), "utf8");
  const block = /const PUBLIC_PATH_ALLOWLIST = new Set\(\[([\s\S]*?)\]\);/.exec(source);
  assert.ok(block, "service worker public path allowlist is missing");
  const declared = extractMatches(block[1], [/["']([^"']+)["']/g]).sort(comparePaths);
  const expected = ["/", ...spec.files.map((item) => `/${item}`)].sort(comparePaths);
  assert.deepEqual(declared, expected, "service worker public paths differ from deployment allowlist");
}

export function validateArtifact({
  root = repositoryRoot,
  specPath = defaultSpecPath,
  outputPath = defaultOutputPath,
  metadataPath = defaultMetadataPath,
} = {}) {
  const spec = loadAllowlist(specPath);
  const allowedFiles = validateAllowlist(spec);
  const actualFiles = walkFiles(outputPath);
  assert.deepEqual(actualFiles, allowedFiles, "artifact files differ from the affirmative allowlist");

  for (const relativePath of spec.requiredRootFiles) {
    assert.ok(actualFiles.includes(relativePath), `required root file is missing: ${relativePath}`);
  }
  assert.equal(fs.readFileSync(resolveInside(outputPath, spec.customDomainFile), "utf8").trim(), spec.expectedCustomDomain);

  const manifestPath = path.join(metadataPath, "pages-deployment-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.allowlistVersion, spec.allowlistVersion);
  assert.equal(manifest.fileCount, actualFiles.length);
  assert.deepEqual(manifest.files.map((entry) => entry.path), actualFiles);
  for (const entry of manifest.files) {
    const bytes = fs.readFileSync(resolveInside(outputPath, entry.path));
    assert.equal(entry.size, bytes.length, `manifest size mismatch: ${entry.path}`);
    assert.equal(entry.sha256, sha256(bytes), `manifest hash mismatch: ${entry.path}`);
    assert.equal(entry.required, true, `manifest required marker mismatch: ${entry.path}`);
  }

  const references = collectRuntimeReferences(outputPath, spec);
  const unresolved = references.filter(({ reference }) => !actualFiles.includes(reference));
  assert.deepEqual(
    unresolved,
    [],
    `runtime references are absent from artifact:\n${unresolved.map((item) => `${item.reference} <- ${item.sources.join(", ")}`).join("\n")}`,
  );
  validateServiceWorkerPublicPaths(outputPath, spec);
  validateLaunchKitArchive(outputPath, spec);
  scanSecrets(outputPath, actualFiles);

  return {
    fileCount: actualFiles.length,
    totalBytes: manifest.totalBytes,
    sourceCommit: manifest.sourceCommit,
    releaseVersion: manifest.releaseVersion,
    references: references.length,
    manifestPath,
  };
}

export function buildArtifact({
  root = repositoryRoot,
  specPath = defaultSpecPath,
  outputPath = defaultOutputPath,
  metadataPath = defaultMetadataPath,
  sourceCommit,
  sourceCommitTime,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(outputPath);
  const resolvedMetadata = path.resolve(metadataPath);
  assert.notEqual(resolvedOutput, resolvedRoot, "artifact output must not be the repository root");
  assert.notEqual(resolvedMetadata, resolvedRoot, "artifact metadata must not be the repository root");
  assert.notEqual(resolvedOutput, resolvedMetadata, "artifact and metadata outputs must differ");

  const spec = loadAllowlist(specPath);
  const files = validateAllowlist(spec);
  fs.rmSync(resolvedOutput, { recursive: true, force: true });
  fs.rmSync(resolvedMetadata, { recursive: true, force: true });
  fs.mkdirSync(resolvedOutput, { recursive: true });
  fs.mkdirSync(resolvedMetadata, { recursive: true });

  const entries = [];
  for (const relativePath of files) {
    assert.equal(isForbiddenPath(relativePath, spec), false, `forbidden path requested: ${relativePath}`);
    const source = resolveInside(resolvedRoot, relativePath);
    assert.ok(fs.existsSync(source), `allowlisted source file is missing: ${relativePath}`);
    assertNoSymlink(resolvedRoot, relativePath);
    const stat = fs.statSync(source);
    assert.ok(stat.isFile(), `allowlisted source is not a regular file: ${relativePath}`);
    const destination = resolveInside(resolvedOutput, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    const bytes = fs.readFileSync(destination);
    entries.push({
      path: relativePath,
      size: bytes.length,
      sha256: sha256(bytes),
      required: true,
    });
  }

  const identity = sourceIdentity(resolvedRoot, { sourceCommit, sourceCommitTime });
  const releaseVersion = JSON.parse(
    fs.readFileSync(resolveInside(resolvedRoot, spec.releaseVersionFile), "utf8"),
  ).version;
  assert.match(releaseVersion, /^v\d+$/, "release version marker is invalid");
  const manifest = {
    schemaVersion: 1,
    sourceCommit: identity.sourceCommit,
    buildTime: identity.sourceCommitTime,
    allowlistVersion: spec.allowlistVersion,
    releaseVersion,
    customDomain: spec.expectedCustomDomain,
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
    files: entries,
  };
  fs.writeFileSync(
    path.join(resolvedMetadata, "pages-deployment-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return validateArtifact({
    root: resolvedRoot,
    specPath,
    outputPath: resolvedOutput,
    metadataPath: resolvedMetadata,
  });
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const root = path.resolve(options.root || repositoryRoot);
  const specPath = path.resolve(options.spec || defaultSpecPath);
  const outputPath = path.resolve(options.output || path.join(root, ".pages-artifact"));
  const metadataPath = path.resolve(options.metadata || path.join(root, ".pages-artifact-metadata"));
  for (const [label, candidate] of [["artifact output", outputPath], ["artifact metadata", metadataPath]]) {
    assert.ok(
      candidate.startsWith(`${root}${path.sep}`),
      `${label} must remain inside the selected repository root`,
    );
  }
  const result = buildArtifact({
    root,
    specPath,
    outputPath,
    metadataPath,
    sourceCommit: options["source-sha"],
    sourceCommitTime: options["source-time"],
  });
  process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) runCli();
