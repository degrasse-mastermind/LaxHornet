#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromRoot = createRequire(path.join(root, "tools", "release-preflight.cjs"));
const manifestPath = path.join(root, "release", "laxhornet-release-manifest.json");
const pgliteVersion = "0.5.4";
const playwrightVersion = "1.61.1";
const dependencyRoot = path.join(
  tmpdir(),
  "laxhornet-release-preflight",
  createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0, 12),
);
const dependencyNodeModules = path.join(dependencyRoot, "node_modules");
const repositoryNodeModules = path.join(root, "node_modules");
const packageMetadata = ["package.json", "package-lock.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];

function command(commandName, args = [], options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(commandName),
    ...options,
  });
}

function git(...args) {
  return command("git", args);
}

function trimmed(result) {
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function addResult(results, label, status, detail = "") {
  const row = { label, status, detail };
  results.push(row);
  console.log(`${status.padEnd(24)} ${label}${detail ? ` — ${detail}` : ""}`);
  return row;
}

function packageVersion(name) {
  try {
    let packagePath;
    try {
      packagePath = requireFromRoot.resolve(`${name}/package.json`);
    } catch {
      let current = path.dirname(requireFromRoot.resolve(name));
      while (current !== path.dirname(current)) {
        const candidate = path.join(current, "package.json");
        if (existsSync(candidate)) {
          const metadata = JSON.parse(readFileSync(candidate, "utf8"));
          if (metadata.name === name) {
            packagePath = candidate;
            break;
          }
        }
        current = path.dirname(current);
      }
    }
    if (!packagePath) return null;
    return {
      path: path.dirname(packagePath),
      version: JSON.parse(readFileSync(packagePath, "utf8")).version,
    };
  } catch {
    return null;
  }
}

function resolvePython() {
  const bundled = path.resolve(path.dirname(process.execPath), "..", "..", "python", "python.exe");
  const candidates = [
    process.env.LAXHORNET_PYTHON,
    existsSync(bundled) ? bundled : "",
    "python",
    "python3",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = command(candidate, ["--version"]);
    if (result.status === 0) return { command: candidate, version: trimmed(result) };
  }
  return null;
}

function releaseEnvironment(manifest) {
  const isAncestor = (ref) => git("merge-base", "--is-ancestor", ref, "HEAD").status === 0;
  const combinedMode = isAncestor(manifest.databaseCandidate) && isAncestor(manifest.cleanupCandidate);
  const baseRef = combinedMode
    ? trimmed(git("merge-base", manifest.databaseCandidate, manifest.preCutoverRuntime))
    : "7cf58df9a43ce235fc6068bd4c50549e05906de4";
  return {
    LAXHORNET_RELEASE_BASE_REF: baseRef,
    LAXHORNET_ALLOWED_ADDITIVE_DB_PATHS: [
      "supabase/migrations/20260723040000_event_pipeline_capabilities.sql",
      "supabase/rollback/20260723040000_event_pipeline_capabilities_rollback.sql",
      "supabase/migrations/20260727000000_tracked_playing_time_operations.sql",
      "supabase/rollback/20260727000000_tracked_playing_time_operations_rollback.sql",
      "supabase/tests/tracked_playing_time_foundation.sql",
    ].join(","),
    ...(combinedMode
      ? {
          LAXHORNET_AUTHORIZED_DB_REF: manifest.databaseCandidate,
          LAXHORNET_APPROVED_ADDITIVE_REF: manifest.cleanupCandidate,
        }
      : {}),
  };
}

export function reviewedTextSha256(file) {
  const canonicalCrLf = readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\r\n");
  return createHash("sha256").update(Buffer.from(canonicalCrLf, "utf8")).digest("hex");
}

export function validateManifestReleaseIdentity(manifest, release = "") {
  const failures = [];
  if (release && manifest.release !== release) {
    failures.push(`manifest release ${manifest.release || "(missing)"} does not match ${release}`);
  }
  if (!manifest.preReleaseBaseSha) failures.push("preReleaseBaseSha is missing");
  if (!manifest.releaseHeadSha) failures.push("releaseHeadSha is missing");
  if (!manifest.releaseHeadTreeSha) failures.push("releaseHeadTreeSha is missing");
  if (!manifest.approvedMergeSha) failures.push("approvedMergeSha is missing");
  if (manifest.preReleaseBaseSha !== manifest.finalMainBaseSha) {
    failures.push("preReleaseBaseSha does not preserve finalMainBaseSha provenance");
  }
  return failures;
}

export function evaluateReleaseIdentity({
  phase,
  release,
  branch,
  headSha,
  mainSha,
  manifest,
  approvedRolloutSha = "",
  isAncestor,
  isSameTree,
  treeOf,
}) {
  const rows = [];
  const add = (label, ok, detail) => rows.push({
    label,
    status: ok ? "PASS" : "FAIL",
    detail,
  });
  const ancestor = (older, newer) =>
    Boolean(older && newer && typeof isAncestor === "function" && isAncestor(older, newer));

  if (!release) {
    add("Current branch", true, branch || "(detached)");
    return rows;
  }

  if (phase === "preparation") {
    add("Current branch", branch.startsWith(`release/${release}-`), branch || "(detached)");
    add(
      "Pre-release main base",
      mainSha === manifest.preReleaseBaseSha,
      mainSha || "main unavailable",
    );
    add(
      "Release changes from approved base",
      headSha !== manifest.preReleaseBaseSha && ancestor(manifest.preReleaseBaseSha, headSha),
      `${manifest.preReleaseBaseSha || "(missing)"} -> ${headSha || "(missing)"}`,
    );
    return rows;
  }

  if (phase === "production") {
    const approvedHead = approvedRolloutSha || manifest.approvedMergeSha;
    add("Current branch", branch === "main", branch || "(detached)");
    add("Approved production HEAD", headSha === approvedHead, headSha || "HEAD unavailable");
    add(
      "Release head incorporated by approved merge",
      ancestor(manifest.releaseHeadSha, manifest.approvedMergeSha) ||
        Boolean(isSameTree?.(manifest.releaseHeadSha, manifest.approvedMergeSha)) ||
        Boolean(
          manifest.releaseHeadTreeSha &&
          treeOf?.(manifest.approvedMergeSha) === manifest.releaseHeadTreeSha
        ),
      `${manifest.releaseHeadSha || "(missing)"} -> ${manifest.approvedMergeSha || "(missing)"}`,
    );
    add(
      "Pre-release base ancestry",
      ancestor(manifest.preReleaseBaseSha, manifest.approvedMergeSha),
      `${manifest.preReleaseBaseSha || "(missing)"} -> ${manifest.approvedMergeSha || "(missing)"}`,
    );
    add(
      "Approved merge ancestry",
      ancestor(manifest.approvedMergeSha, approvedHead),
      `${manifest.approvedMergeSha || "(missing)"} -> ${approvedHead || "(missing)"}`,
    );
    return rows;
  }

  add("Preflight phase", false, phase || "(missing)");
  return rows;
}

export function findReleaseSurfaceFailures(rootPath, release) {
  const failures = [];
  const version = JSON.parse(readFileSync(path.join(rootPath, "version.json"), "utf8")).version;
  const serviceWorker = readFileSync(path.join(rootPath, "service-worker.js"), "utf8");
  const appHtml = readFileSync(path.join(rootPath, "app.html"), "utf8");
  if (version !== release) failures.push(`version.json is ${version}`);
  if (!serviceWorker.includes(`const CACHE_NAME = "laxhornet-${release}";`)) {
    failures.push(`service-worker cache is not laxhornet-${release}`);
  }
  for (const asset of [
    "runtime-config.js",
    "event-operation-service.js",
    "next-focus-recommendation.js",
    "tracked-playing-time-service.js",
    "app.js",
  ]) {
    if (!appHtml.includes(`${asset}?v=${release.slice(1)}`)) {
      failures.push(`${asset} query marker is not ${release}`);
    }
  }
  return failures;
}

function checkRepository(results, release, phase, approvedRolloutSha) {
  const topLevel = trimmed(git("rev-parse", "--show-toplevel"));
  addResult(
    results,
    "Repository root",
    path.resolve(topLevel).toLowerCase() === root.toLowerCase() ? "PASS" : "FAIL",
    topLevel,
  );

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const branch = trimmed(git("branch", "--show-current"));
  const headSha = trimmed(git("rev-parse", "HEAD"));
  const mainShaResult = git("rev-parse", "main");
  const mainSha = mainShaResult.status === 0 ? trimmed(mainShaResult) : "";
  const identityRows = evaluateReleaseIdentity({
    phase,
    release,
    branch,
    headSha,
    mainSha,
    manifest,
    approvedRolloutSha,
    isAncestor: (older, newer) =>
      git("merge-base", "--is-ancestor", older, newer).status === 0,
    isSameTree: (left, right) => {
      const leftTree = git("rev-parse", `${left}^{tree}`);
      const rightTree = git("rev-parse", `${right}^{tree}`);
      return leftTree.status === 0 &&
        rightTree.status === 0 &&
        trimmed(leftTree) === trimmed(rightTree);
    },
    treeOf: (ref) => {
      const result = git("rev-parse", `${ref}^{tree}`);
      return result.status === 0 ? trimmed(result) : "";
    },
  });
  for (const row of identityRows) {
    addResult(results, row.label, row.status, row.detail);
  }

  const status = trimmed(git("status", "--short"));
  const changedPaths = status
    ? status.split(/\r?\n/).map((line) => line.slice(3).trim()).filter(Boolean)
    : [];
  const unsafeChanges = changedPaths.filter(
    (file) =>
      file.startsWith("supabase/migrations/") ||
      file.startsWith("supabase/rollback/") ||
      file.startsWith("supabase/tests/") ||
      packageMetadata.includes(file),
  );
  addResult(
    results,
    "Tracked worktree state",
    phase === "production"
      ? status
        ? "FAIL"
        : "PASS"
      : unsafeChanges.length
        ? "FAIL"
        : "PASS",
    status
      ? phase === "production"
        ? `${changedPaths.length} changed paths; production rollout requires a clean tree`
        : `${changedPaths.length} identified release-path changes; no SQL/package metadata drift`
      : "clean",
  );
  if (unsafeChanges.length) {
    addResult(results, "Unexpected protected changes", "FAIL", unsafeChanges.join(", "));
  }

  const manifestIdentityFailures = validateManifestReleaseIdentity(manifest, release);
  addResult(
    results,
    "Manifest release identity",
    manifestIdentityFailures.length ? "FAIL" : "PASS",
    manifestIdentityFailures.length ? manifestIdentityFailures.join("; ") : "base, release head, and merge SHA recorded",
  );

  const migrationPath = "supabase/migrations/20260727000000_tracked_playing_time_operations.sql";
  const reviewPackage = manifest.reviewDatabasePackages?.find(
    (item) => item.name === "tracked_playing_time_foundation",
  );
  const expectedMigrationHash = reviewPackage?.sha256?.[migrationPath] || "";
  const actualMigrationHash = reviewedTextSha256(path.join(root, migrationPath));
  addResult(
    results,
    "Reviewed migration checksum",
    actualMigrationHash === expectedMigrationHash ? "PASS" : "FAIL",
    actualMigrationHash,
  );

  const releaseEnv = releaseEnvironment(manifest);
  const manifestResult = command(process.execPath, [
    "tools/validate_release_manifest.mjs",
    "--require-combined",
    "--combined-ref=HEAD",
  ], { env: { ...process.env, ...releaseEnv } });
  addResult(
    results,
    "Release manifest",
    manifestResult.status === 0 ? "PASS" : "FAIL",
    manifestResult.status === 0 ? trimmed(manifestResult).split(/\r?\n/).at(-1) : trimmed(manifestResult),
  );

  const releaseSurfaceFailures = release ? findReleaseSurfaceFailures(root, release) : [];
  addResult(
    results,
    "Release marker, cache, and asset queries",
    releaseSurfaceFailures.length ? "FAIL" : "PASS",
    releaseSurfaceFailures.length ? releaseSurfaceFailures.join("; ") : `${release || manifest.release} surfaces present`,
  );

  const publicLiveShareSql = "supabase/migrations/20260723020000_minimum_necessary_disclosure.sql";
  const publicLiveShareDiff = git(
    "diff",
    "--quiet",
    manifest.databaseCandidate,
    "--",
    publicLiveShareSql,
  );
  addResult(
    results,
    "Public Live Share SQL identity",
    publicLiveShareDiff.status === 0 ? "PASS" : "FAIL",
    publicLiveShareDiff.status === 0 ? "matches approved canonical source" : `${publicLiveShareSql} drifted`,
  );

  const protectedDiff = git(
    "diff",
    "--quiet",
    "HEAD",
    "--",
    "supabase/migrations",
    "supabase/rollback",
    "supabase/tests",
  );
  addResult(
    results,
    "Historical migration drift",
    protectedDiff.status === 0 ? "PASS" : "FAIL",
    protectedDiff.status === 0 ? "none" : "protected SQL/test paths differ from HEAD",
  );

  const diffCheck = git("diff", "--check");
  addResult(
    results,
    "Git diff hygiene",
    diffCheck.status === 0 ? "PASS" : "FAIL",
    diffCheck.status === 0 ? "no whitespace errors" : trimmed(diffCheck),
  );

  return { manifest, releaseEnv };
}

function checkRuntime(results, releaseRequired, prepare) {
  addResult(results, "Node.js", "PASS", process.version);

  const python = resolvePython();
  addResult(results, "Python", python ? "PASS" : "FAIL", python?.version || "not found");

  let docker = command("docker", [
    "version",
    "--format",
    "{{.Client.Version}}|{{.Server.Version}}|{{.Server.Os}}",
  ]);
  if (docker.status !== 0 && prepare) {
    const restart = command("docker", ["desktop", "restart"], { timeout: 120000 });
    if (restart.status === 0) {
      docker = command("docker", [
        "version",
        "--format",
        "{{.Client.Version}}|{{.Server.Version}}|{{.Server.Os}}",
      ]);
    }
    addResult(
      results,
      "Docker Desktop recovery",
      docker.status === 0 ? "PASS" : "FAIL",
      docker.status === 0 ? "Docker Desktop restarted" : trimmed(restart) || "restart failed",
    );
  }
  const dockerParts = docker.status === 0 ? trimmed(docker).split("|") : [];
  addResult(
    results,
    "Docker client/server",
    docker.status === 0 ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
    docker.status === 0 ? `client ${dockerParts[0]}, server ${dockerParts[1]}` : "Docker engine unavailable",
  );
  addResult(
    results,
    "Docker Linux engine",
    docker.status === 0 && dockerParts[2] === "linux" ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
    docker.status === 0 ? dockerParts[2] || "unknown server OS" : "not running",
  );

  const compose = command("docker", ["compose", "version", "--short"]);
  addResult(
    results,
    "Docker Compose",
    compose.status === 0 ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
    compose.status === 0 ? trimmed(compose) : "not available",
  );

  const supabase = command("supabase", ["--version"]);
  addResult(
    results,
    "Supabase CLI",
    supabase.status === 0 ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
    supabase.status === 0 ? trimmed(supabase) : "not available",
  );

  return { python };
}

function ensureDependencies(results, prepare, releaseRequired) {
  let pglite = packageVersion("@electric-sql/pglite");
  let playwright = packageVersion("playwright");
  const versionsReady =
    pglite?.version === pgliteVersion && playwright?.version === playwrightVersion;

  if (!versionsReady && prepare) {
    if (existsSync(repositoryNodeModules)) {
      const stats = lstatSync(repositoryNodeModules);
      if (!stats.isSymbolicLink()) {
        addResult(results, "Ephemeral dependency bootstrap", "FAIL", "repository node_modules exists and is not a junction");
        return { pglite, playwright };
      }
      rmSync(repositoryNodeModules);
    }
    rmSync(dependencyRoot, { recursive: true, force: true });
    mkdirSync(dependencyRoot, { recursive: true });
    const bundledPnpm = path.resolve(
      path.dirname(process.execPath),
      "..",
      "node_modules",
      "pnpm",
      "bin",
      "pnpm.mjs",
    );
    const pnpm = process.env.LAXHORNET_PNPM || (existsSync(bundledPnpm) ? process.execPath : "pnpm.cmd");
    const pnpmPrefix = !process.env.LAXHORNET_PNPM && existsSync(bundledPnpm) ? [bundledPnpm] : [];
    const install = command(
      pnpm,
      [
        ...pnpmPrefix,
        "add",
        "--dir",
        dependencyRoot,
        "--ignore-workspace",
        "--save-exact",
        "--ignore-scripts",
        `@electric-sql/pglite@${pgliteVersion}`,
        `playwright@${playwrightVersion}`,
      ],
      { timeout: 180000 },
    );
    if (install.status !== 0) {
      addResult(results, "Ephemeral dependency bootstrap", "FAIL", trimmed(install));
      return { pglite, playwright };
    }
    symlinkSync(dependencyNodeModules, repositoryNodeModules, "junction");
    pglite = packageVersion("@electric-sql/pglite");
    playwright = packageVersion("playwright");
    addResult(
      results,
      "Ephemeral dependency bootstrap",
      pglite?.version === pgliteVersion && playwright?.version === playwrightVersion
        ? "RESTORED EPHEMERALLY"
        : "FAIL",
      dependencyRoot,
    );
  } else {
    addResult(
      results,
      "Ephemeral dependency bootstrap",
      versionsReady ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
      versionsReady ? "exact versions already available" : "run with --prepare --release <version>",
    );
  }

  addResult(
    results,
    "PGlite",
    pglite?.version === pgliteVersion ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
    pglite ? `${pglite.version} at ${pglite.path}` : "not available",
  );
  addResult(
    results,
    "Playwright",
    playwright?.version === playwrightVersion ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
    playwright ? `${playwright.version} at ${playwright.path}` : "not available",
  );

  const browserCandidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const browser = browserCandidates.find((candidate) => existsSync(candidate));
  addResult(
    results,
    "Browser executable",
    browser ? "PASS" : releaseRequired ? "FAIL" : "NOT REQUIRED",
    browser || "not found",
  );
  return { pglite, playwright, browser };
}

function startLocalSupabase(results) {
  const status = command("supabase", ["status"]);
  if (status.status === 0) {
    addResult(results, "Local Supabase stack", "PASS", "already running and healthy");
    return true;
  }
  const start = command("supabase", [
    "start",
    "--exclude",
    "storage-api,imgproxy,logflare,vector",
  ], { timeout: 180000 });
  if (start.status !== 0) {
    addResult(results, "Local Supabase stack", "FAIL", trimmed(start));
    return false;
  }
  const healthy = command("supabase", ["status"]);
  addResult(
    results,
    "Local Supabase stack",
    healthy.status === 0 ? "PASS" : "FAIL",
    healthy.status === 0 ? "reduced local stack started and healthy" : "stack did not become healthy",
  );
  return healthy.status === 0;
}

export function cleanupReleasePreflight({ stopSupabase = true } = {}) {
  const results = [];
  if (stopSupabase) {
    const status = command("supabase", ["status"]);
    if (status.status === 0) {
      const stop = command("supabase", ["stop", "--no-backup"], { timeout: 120000 });
      addResult(results, "Local Supabase cleanup", stop.status === 0 ? "PASS" : "FAIL", "disposable stack stopped");
    } else {
      addResult(results, "Local Supabase cleanup", "NOT REQUIRED", "no local stack running");
    }
  }

  if (existsSync(repositoryNodeModules)) {
    const stats = lstatSync(repositoryNodeModules);
    if (!stats.isSymbolicLink()) {
      addResult(results, "Dependency junction cleanup", "FAIL", "refused to remove non-junction node_modules");
    } else {
      const target = readlinkSync(repositoryNodeModules);
      rmSync(repositoryNodeModules);
      addResult(results, "Dependency junction cleanup", "PASS", `removed junction to ${target}`);
    }
  } else {
    addResult(results, "Dependency junction cleanup", "NOT REQUIRED", "junction absent");
  }

  if (existsSync(dependencyRoot)) {
    rmSync(dependencyRoot, { recursive: true, force: true });
    addResult(results, "Disposable dependency cleanup", "PASS", dependencyRoot);
  } else {
    addResult(results, "Disposable dependency cleanup", "NOT REQUIRED", "directory absent");
  }
  return { ok: !results.some((row) => row.status === "FAIL"), results };
}

export function runReleasePreflight({
  prepare = false,
  release = "",
  phase = "",
  approvedRolloutSha = "",
  startSupabase = false,
} = {}) {
  const results = [];
  const normalizedRelease = release && !release.startsWith("v") ? `v${release}` : release;
  const normalizedPhase = phase || (normalizedRelease ? "preparation" : "general");
  const repository = checkRepository(
    results,
    normalizedRelease,
    normalizedPhase,
    approvedRolloutSha,
  );
  const validPhase =
    normalizedPhase === "general" ||
    normalizedPhase === "preparation" ||
    normalizedPhase === "production";
  addResult(
    results,
    "Preflight phase",
    validPhase && (normalizedPhase === "general" || Boolean(normalizedRelease)) ? "PASS" : "FAIL",
    normalizedPhase,
  );
  const versionMatches = !normalizedRelease || repository.manifest.release === normalizedRelease;
  addResult(
    results,
    "Requested release",
    versionMatches ? "PASS" : "FAIL",
    normalizedRelease || "general preflight",
  );
  const runtime = checkRuntime(results, Boolean(normalizedRelease), prepare);
  const dependencies = ensureDependencies(results, prepare, Boolean(normalizedRelease));
  if (startSupabase) startLocalSupabase(results);
  else addResult(results, "Local Supabase stack", "NOT REQUIRED", "start only with --start-supabase");

  const metadataCreated = packageMetadata.filter((file) => existsSync(path.join(root, file)));
  addResult(
    results,
    "Repository package metadata",
    metadataCreated.length ? "FAIL" : "PASS",
    metadataCreated.length ? metadataCreated.join(", ") : "none created",
  );

  return {
    ok: !results.some((row) => row.status === "FAIL"),
    results,
    root,
    release: normalizedRelease,
    phase: normalizedPhase,
    environment: {
      ...repository.releaseEnv,
      ...(runtime.python ? { LAXHORNET_PYTHON: runtime.python.command } : {}),
    },
    dependencyRoot,
    dependencies,
  };
}

function parseArguments(args) {
  const options = {
    prepare: args.includes("--prepare"),
    cleanup: args.includes("--cleanup"),
    startSupabase: args.includes("--start-supabase"),
    release: "",
    phase: "",
    approvedRolloutSha: "",
  };
  const releaseIndex = args.indexOf("--release");
  if (releaseIndex >= 0) options.release = args[releaseIndex + 1] || "";
  const phaseIndex = args.indexOf("--phase");
  if (phaseIndex >= 0) options.phase = args[phaseIndex + 1] || "";
  const rolloutIndex = args.indexOf("--approved-rollout-sha");
  if (rolloutIndex >= 0) options.approvedRolloutSha = args[rolloutIndex + 1] || "";
  return options;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  if (options.cleanup) {
    const cleanup = cleanupReleasePreflight();
    if (!cleanup.ok) process.exitCode = 1;
  } else {
    const preflight = runReleasePreflight(options);
    if (!preflight.ok) process.exitCode = 1;
  }
}
