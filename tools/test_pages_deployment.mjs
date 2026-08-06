import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildArtifact,
  isForbiddenPath,
  loadAllowlist,
  validateAllowlist,
  validateArtifact,
} from "./build_pages_artifact.mjs";

const modulePath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(modulePath), "..");
const specPath = path.join(root, "release", "pages-deployment-allowlist.json");
const workflowPath = path.join(root, ".github", "workflows", "pages-deployment.yml");
const spec = loadAllowlist(specPath);
const releaseVersion = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-pages-contracts-"));
let passed = 0;

function test(name, callback) {
  try {
    callback();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack || error}\n`);
    process.exitCode = 1;
  }
}

function expectFailure(name, callback, pattern) {
  test(name, () => assert.throws(callback, pattern));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function copyFixture(destination) {
  for (const relativePath of spec.files) {
    const source = path.join(root, ...relativePath.split("/"));
    const target = path.join(destination, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  fs.mkdirSync(path.join(destination, "docs"), { recursive: true });
  fs.writeFileSync(path.join(destination, "docs", "unknown-internal.md"), "must not deploy\n");
  fs.writeFileSync(path.join(destination, "NEW_ROOT_FILE.txt"), "must not deploy\n");
}

function artifactOptions(name, fixtureRoot = root) {
  return {
    root: fixtureRoot,
    specPath,
    outputPath: path.join(tempRoot, `${name}-artifact`),
    metadataPath: path.join(tempRoot, `${name}-metadata`),
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    sourceCommitTime: "2026-07-29T20:00:00Z",
  };
}

try {
  test("allowlist schema is valid and all-files explicit", () => {
    const files = validateAllowlist(spec);
    assert.equal(files.length, 47);
    assert.deepEqual(spec.directories, []);
  });

  test("required application and PWA files are allowlisted", () => {
    for (const item of [
      "CNAME", "index.html", "app.html", "app.js", "styles.css",
      "runtime-config.js", "assets/supabase.min.js", "manifest.json",
      "service-worker.js", "version.json", "tracked-playing-time-service.js",
    ]) assert.ok(spec.files.includes(item), item);
  });

  test("launch-kit downloads required by runtime are allowlisted explicitly", () => {
    for (const item of [
      "LaxHornet-launch-kit.zip",
      "launch-kit/LaxHornet-promo-demo.mp4",
      "launch-kit/LaxHornet-parent-handout.pdf",
      "launch-kit/parent-email.eml",
      "launch-kit/launch-kit-readme.md",
    ]) assert.ok(spec.files.includes(item), item);
  });

  expectFailure(
    "launch-kit ZIP path traversal is rejected",
    () => {
      const fixture = path.join(tempRoot, "zip-traversal-fixture");
      copyFixture(fixture);
      const archive = path.join(fixture, "LaxHornet-launch-kit.zip");
      const bytes = fs.readFileSync(archive);
      const original = Buffer.from("invite-message.txt");
      const malicious = Buffer.from("../escape-file.txt");
      let replacements = 0;
      for (let offset = bytes.indexOf(original); offset >= 0; offset = bytes.indexOf(original, offset + malicious.length)) {
        malicious.copy(bytes, offset);
        replacements += 1;
      }
      assert.equal(replacements, 2, "fixture must replace local and central ZIP paths");
      fs.writeFileSync(archive, bytes);
      buildArtifact(artifactOptions("zip-traversal", fixture));
    },
    /traverse|normalized/,
  );

  test("internal path families and credential files are forbidden", () => {
    for (const item of [
      ".git/config",
      ".github/workflows/pages-deployment.yml",
      ".codex/config.toml",
      ".agents/skills/example/SKILL.md",
      "tools/v284_local_disclosure_fixture.mjs",
      "docs/LOCAL_SUPABASE_WORKFLOW.md",
      "review-evidence/v284-tracked-playing-time-production/production-smoke-results.json",
      "supabase/migrations/20260728193942_v284_public_event_semantic_boundary.sql",
      "supabase/migrations/20260730004700_team_members_rls_recursion.sql",
      "supabase/rollback/example.sql",
      "release/laxhornet-release-manifest.json",
      "REPO_CURRENT_STATE.md",
      "TICKETS.md",
      ".env.local",
      "assets/app.js.map",
    ]) assert.equal(isForbiddenPath(item, spec), true, item);
  });

  test("PR 29 fixture harness paths are absent", () => {
    assert.equal(spec.files.some((item) => /v284_(?:local|production)_disclosure_fixture/.test(item)), false);
    assert.equal(spec.files.some((item) => item.startsWith("tools/")), false);
  });

  const first = artifactOptions("first");
  test("real artifact builds and validates", () => {
    const result = buildArtifact(first);
    assert.equal(result.fileCount, 47);
    assert.equal(result.releaseVersion, releaseVersion);
    assert.ok(result.references > 0);
  });

  test("artifact contains exactly the affirmative allowlist", () => {
    const actual = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else actual.push(path.relative(first.outputPath, absolute).split(path.sep).join("/"));
      }
    };
    walk(first.outputPath);
    assert.deepEqual(actual.sort(), [...spec.files].sort());
  });

  test("new root and internal files do not deploy automatically", () => {
    const fixture = path.join(tempRoot, "unknown-fixture");
    copyFixture(fixture);
    const options = artifactOptions("unknown", fixture);
    buildArtifact(options);
    assert.equal(fs.existsSync(path.join(options.outputPath, "NEW_ROOT_FILE.txt")), false);
    assert.equal(fs.existsSync(path.join(options.outputPath, "docs", "unknown-internal.md")), false);
  });

  test("artifact and manifest are deterministic for one source identity", () => {
    const second = artifactOptions("second");
    buildArtifact(second);
    const firstManifest = fs.readFileSync(path.join(first.metadataPath, "pages-deployment-manifest.json"));
    const secondManifest = fs.readFileSync(path.join(second.metadataPath, "pages-deployment-manifest.json"));
    assert.deepEqual(firstManifest, secondManifest);
    for (const relativePath of spec.files) {
      assert.deepEqual(
        fs.readFileSync(path.join(first.outputPath, ...relativePath.split("/"))),
        fs.readFileSync(path.join(second.outputPath, ...relativePath.split("/"))),
        relativePath,
      );
    }
  });

  expectFailure(
    "path traversal is rejected",
    () => validateAllowlist({ ...spec, files: [...spec.files, "../escape.txt"].sort() }),
    /traverse|normalized/,
  );

  expectFailure(
    "forbidden file cannot be added to allowlist",
    () => validateAllowlist({ ...spec, files: [...spec.files, "tools/fixture.mjs"].sort() }),
    /forbidden/,
  );

  test("symlink ancestor escape is rejected", () => {
    const fixture = path.join(tempRoot, "symlink-fixture");
    copyFixture(fixture);
    const outside = path.join(tempRoot, "outside");
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, "secret.txt"), "outside\n");
    fs.symlinkSync(outside, path.join(fixture, "linked"), "junction");
    const maliciousSpec = {
      ...spec,
      files: [...spec.files, "linked/secret.txt"].sort(),
    };
    const maliciousSpecPath = path.join(tempRoot, "symlink-allowlist.json");
    writeJson(maliciousSpecPath, maliciousSpec);
    assert.throws(
      () => buildArtifact({ ...artifactOptions("symlink", fixture), specPath: maliciousSpecPath }),
      /symbolic link is forbidden/,
    );
  });

  test("valid CNAME is required", () => {
    const options = artifactOptions("cname");
    buildArtifact(options);
    fs.writeFileSync(path.join(options.outputPath, "CNAME"), "wrong.example\n");
    assert.throws(() => validateArtifact(options), /laxhornet\.mybranford\.com/);
  });

  test("missing artifact file blocks deployment", () => {
    const options = artifactOptions("missing");
    buildArtifact(options);
    fs.rmSync(path.join(options.outputPath, "app.html"));
    assert.throws(() => validateArtifact(options), /artifact files differ/);
  });

  test("unexpected artifact file blocks deployment", () => {
    const options = artifactOptions("unexpected");
    buildArtifact(options);
    fs.writeFileSync(path.join(options.outputPath, "unexpected.txt"), "unexpected\n");
    assert.throws(() => validateArtifact(options), /artifact files differ/);
  });

  test("hash drift blocks deployment", () => {
    const options = artifactOptions("hash");
    buildArtifact(options);
    fs.appendFileSync(path.join(options.outputPath, "index.html"), "\n");
    assert.throws(() => validateArtifact(options), /manifest (?:size|hash) mismatch/);
  });

  test("credential-shaped content blocks deployment", () => {
    const options = artifactOptions("secret");
    buildArtifact(options);
    const runtime = path.join(options.outputPath, "runtime-config.js");
    fs.writeFileSync(runtime, 'const SERVICE_ROLE_KEY = \"this-is-a-production-secret-value\";\\n');
    const manifestPath = path.join(options.metadataPath, "pages-deployment-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const entry = manifest.files.find((item) => item.path === "runtime-config.js");
    const bytes = fs.readFileSync(runtime);
    entry.size = bytes.length;
    entry.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    manifest.totalBytes = manifest.files.reduce((sum, item) => sum + item.size, 0);
    writeJson(manifestPath, manifest);
    assert.throws(() => validateArtifact(options), /credential-shaped/);
  });

  test("service worker uses the current release cache and purges non-allowlisted cached requests", () => {
    const source = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
    assert.match(source, new RegExp(`CACHE_NAME = "laxhornet-${releaseVersion}"`));
    assert.match(source, /PUBLIC_PATH_ALLOWLIST/);
    assert.match(source, /!PUBLIC_PATH_ALLOWLIST\.has\(requestUrl\.pathname\)/);
    assert.match(source, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
    assert.match(source, /const replacingSameReleaseWorker = await caches\.has\(CACHE_NAME\)/);
    assert.match(source, /if \(replacingSameReleaseWorker\) await self\.skipWaiting\(\)/);
  });

  test("workflow deploys generated artifact only with least privilege", () => {
    const workflow = fs.readFileSync(workflowPath, "utf8");
    assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /authorized_source_sha:[\s\S]*required: true/);
    assert.match(workflow, /expected_runtime_marker:[\s\S]*required: true/);
    assert.match(workflow, /expected_cache_marker:[\s\S]*required: true/);
    assert.match(workflow, /deployment_authorized:[\s\S]*type: boolean/);
    assert.match(workflow, /group: laxhornet-pages-production/);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /permissions:\s*\n\s*contents: read/);
    assert.match(workflow, /pages: read/);
    assert.match(workflow, /deploy:[\s\S]*permissions:\s*\n\s*pages: write\s*\n\s*id-token: write/);
    assert.match(workflow, /needs: build/);
    assert.match(workflow, /name: github-pages/);
    assert.match(workflow, /node tools\/build_pages_artifact\.mjs/);
    assert.match(workflow, /node tools\/validate_pages_artifact\.mjs/);
    assert.match(workflow, /node tools\/verify_pages_settings\.mjs/);
    assert.match(workflow, /--expected-runtime-marker=\$\{\{ needs\.build\.outputs\.release_marker \}\}/);
    assert.match(workflow, /--expected-cache-marker=\$\{\{ needs\.build\.outputs\.cache_marker \}\}/);
    assert.match(workflow, /--expected-source-sha=\$\{\{ needs\.build\.outputs\.production_source_sha \}\}/);
    assert.match(workflow, /node tools\/verify_pages_production\.mjs/);
    assert.match(workflow, /uses: actions\/upload-pages-artifact@v4[\s\S]*path: \.pages-artifact/);
    assert.doesNotMatch(workflow, /upload-pages-artifact@v4[\s\S]{0,200}path:\s*[.'"]+\s*$/m);
  });

  test("main reconciliation cannot redeploy and a new release requires explicit dispatch authorization", () => {
    const workflow = fs.readFileSync(workflowPath, "utf8");
    assert.match(workflow, /AUTOMATIC_DEPLOYMENT_NOT_AUTHORIZED/);
    assert.match(workflow, /deployment_required=false/);
    assert.match(workflow, /deployment_required=true/);
    assert.match(workflow, /if: needs\.build\.outputs\.deployment_required == 'true'/);
    assert.match(workflow, /DEPLOYMENT_AUTHORIZATION_REQUIRED/);
    assert.match(workflow, /AUTHORIZED_SOURCE_SHA_MISMATCH/);
  });

  test("deployment success and post-deploy verification are distinct workflow results", () => {
    const workflow = fs.readFileSync(workflowPath, "utf8");
    assert.match(workflow, /deploy:[\s\S]*Deploy to GitHub Pages/);
    assert.match(workflow, /verify:[\s\S]*needs:[\s\S]*- deploy/);
    assert.match(workflow, /needs\.deploy\.result == 'success' \|\| needs\.deploy\.result == 'skipped'/);
  });

  test("validation precedes artifact upload and deployment", () => {
    const workflow = fs.readFileSync(workflowPath, "utf8");
    const validateIndex = workflow.indexOf("node tools/validate_pages_artifact.mjs");
    const uploadIndex = workflow.indexOf("uses: actions/upload-pages-artifact@v4");
    const deployIndex = workflow.indexOf("uses: actions/deploy-pages@v4");
    const productionVerifyIndex = workflow.indexOf("--expected-runtime-marker=${{ needs.build.outputs.release_marker }}");
    const productionReconcileIndex = workflow.indexOf("node tools/verify_pages_production.mjs");
    assert.ok(
      validateIndex > 0
      && uploadIndex > validateIndex
      && deployIndex > uploadIndex
      && productionVerifyIndex > deployIndex,
    );
    assert.ok(productionReconcileIndex > productionVerifyIndex);
  });
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

if (process.exitCode) {
  process.stderr.write(`\n${passed} Pages deployment contracts passed before failure.\n`);
} else {
  process.stdout.write(`\n${passed}/${passed} Pages deployment contracts passed.\n`);
}
