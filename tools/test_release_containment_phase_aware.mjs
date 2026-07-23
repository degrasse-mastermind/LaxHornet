import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  APPROVED_AUTHORIZED_DB_PATHS,
  ReleaseContainmentError,
  validateReleaseContainment,
  validateReleaseContainmentFromEnvironment,
} from "./release_containment.mjs";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-containment-"));
const results = [];

function git(args) {
  return execFileSync("git", args, {
    cwd: tempRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function write(file, contents) {
  const target = path.join(tempRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, "utf8");
}

function append(file, contents) {
  fs.appendFileSync(path.join(tempRoot, file), contents, "utf8");
}

function commit(message) {
  git(["add", "--all"]);
  git(["commit", "-m", message]);
  return git(["rev-parse", "HEAD"]);
}

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

function expectContainmentFailure(expectedCode, callback) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof ReleaseContainmentError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

try {
  git(["init"]);
  git(["config", "user.name", "LaxHornet Containment Test"]);
  git(["config", "user.email", "containment@example.invalid"]);
  git(["switch", "-c", "main"]);
  write("app.js", "export const version = 'base';\n");
  commit("Synthetic release base");
  git(["tag", "release-base"]);

  git(["switch", "-c", "release"]);
  write("app.js", "export const version = 'release';\n");
  commit("Synthetic release hygiene");

  git(["update-ref", "refs/remotes/origin/main", "release-base"]);

  test("explicit environment release base wins", () => {
    const previous = process.env.LAXHORNET_RELEASE_BASE_REF;
    process.env.LAXHORNET_RELEASE_BASE_REF = "release-base";
    try {
      const result = validateReleaseContainmentFromEnvironment(tempRoot);
      assert.equal(result.releaseBaseRef, "release-base");
      assert.equal(result.releaseBaseSource, "explicit");
    } finally {
      if (previous === undefined) delete process.env.LAXHORNET_RELEASE_BASE_REF;
      else process.env.LAXHORNET_RELEASE_BASE_REF = previous;
    }
  });

  test("origin/main is selected when available", () => {
    const result = validateReleaseContainmentFromEnvironment(tempRoot);
    assert.equal(result.releaseBaseRef, "origin/main");
    assert.equal(result.releaseBaseSource, "origin/main");
  });

  test("local main is selected when origin/main is absent", () => {
    git(["update-ref", "-d", "refs/remotes/origin/main"]);
    const result = validateReleaseContainmentFromEnvironment(tempRoot);
    assert.equal(result.releaseBaseRef, "main");
    assert.equal(result.releaseBaseSource, "main");
  });

  test("invalid explicit release base fails closed", () => {
    expectContainmentFailure("RELEASE_BASE_REF_UNAVAILABLE", () =>
      validateReleaseContainmentFromEnvironment(tempRoot, {
        releaseBaseRef: "missing-release-base",
      }),
    );
  });

  test("PR #10 standalone mode passes against the release base", () => {
    const result = validateReleaseContainment({
      repoRoot: tempRoot,
      releaseBaseRef: "release-base",
    });
    assert.equal(result.mode, "standalone");
    assert.equal(result.authorizedDbRef, null);
  });

  git(["switch", "-c", "bad-standalone-sql"]);
  write("tools/unauthorized.sql", "select 1;\n");
  commit("Add forbidden standalone SQL");
  test("standalone mode rejects any SQL change", () => {
    expectContainmentFailure("STANDALONE_DATABASE_CHANGE", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
      }),
    );
  });

  git(["switch", "-c", "authorized-db", "release-base"]);
  for (const [index, file] of APPROVED_AUTHORIZED_DB_PATHS.entries()) {
    write(file, `authorized candidate file ${index + 1}\n`);
  }
  commit("Synthetic authorized database candidate");
  git(["tag", "authorized-db-ref"]);

  git(["switch", "-c", "combined"]);
  write("app.js", "export const version = 'release';\n");
  commit("Integrate release hygiene");

  test("combined mode passes with the exact authorized database candidate", () => {
    const result = validateReleaseContainment({
      repoRoot: tempRoot,
      releaseBaseRef: "release-base",
      authorizedDbRef: "authorized-db-ref",
    });
    assert.equal(result.mode, "integration");
    assert.equal(result.supabaseTreeMatchesAuthorizedRef, true);
    assert.deepEqual(result.authorizedSupabaseDeltaFiles, [...APPROVED_AUTHORIZED_DB_PATHS].sort());
  });

  git(["switch", "-c", "bad-fifth-migration", "combined"]);
  write("supabase/migrations/20260723040000_unauthorized.sql", "select 1;\n");
  commit("Add unauthorized fifth migration");
  test("integration mode rejects a fifth migration", () => {
    expectContainmentFailure("POST_AUTHORIZATION_DATABASE_CHANGE", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
      }),
    );
  });

  git(["switch", "-c", "bad-canonical-edit", "combined"]);
  append(APPROVED_AUTHORIZED_DB_PATHS[1], "tampered migration\n");
  commit("Edit canonical migration");
  test("integration mode rejects edits to a canonical migration", () => {
    expectContainmentFailure("POST_AUTHORIZATION_DATABASE_CHANGE", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
      }),
    );
  });

  git(["switch", "-c", "bad-rollback-edit", "combined"]);
  append(APPROVED_AUTHORIZED_DB_PATHS[5], "tampered rollback\n");
  commit("Edit authorized rollback");
  test("integration mode rejects edits to a rollback file", () => {
    expectContainmentFailure("POST_AUTHORIZATION_DATABASE_CHANGE", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
      }),
    );
  });

  git(["switch", "-c", "bad-unknown-supabase-file", "combined"]);
  write("supabase/UNAPPROVED.md", "not authorized\n");
  commit("Add unknown Supabase file");
  test("integration mode rejects an unknown Supabase file", () => {
    expectContainmentFailure("POST_AUTHORIZATION_DATABASE_CHANGE", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
      }),
    );
  });

  git(["switch", "combined"]);
  test("integration mode rejects an unavailable authorized database ref", () => {
    expectContainmentFailure("AUTHORIZED_DB_REF_UNAVAILABLE", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "missing-authorized-ref",
      }),
    );
  });

  git(["switch", "-c", "unrepresented-db", "release-base"]);
  for (const [index, file] of APPROVED_AUTHORIZED_DB_PATHS.entries()) {
    write(file, `different candidate file ${index + 1}\n`);
  }
  commit("Synthetic unrepresented database candidate");
  git(["tag", "unrepresented-db-ref"]);
  git(["switch", "combined"]);
  test("integration mode rejects a database ref absent from combined HEAD", () => {
    expectContainmentFailure("AUTHORIZED_DB_REF_NOT_IN_HEAD", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "unrepresented-db-ref",
      }),
    );
  });

  git(["switch", "-c", "advanced-release-base", "release-base"]);
  write("approved-base-marker.txt", "current approved base\n");
  write("review-evidence/historical.sql", "approved release-base evidence\n");
  commit("Advance the approved release base");
  git(["tag", "advanced-release-base-ref"]);
  git(["switch", "-c", "combined-divergent-history"]);
  git(["merge", "--no-ff", "--no-edit", "authorized-db-ref"]);
  write("app.js", "export const version = 'release';\n");
  commit("Integrate release hygiene after database review began");
  test("combined mode accepts an authorized database ref from earlier review history", () => {
    const result = validateReleaseContainment({
      repoRoot: tempRoot,
      releaseBaseRef: "advanced-release-base-ref",
      authorizedDbRef: "authorized-db-ref",
    });
    assert.equal(result.mode, "integration");
    assert.equal(result.supabaseTreeMatchesAuthorizedRef, true);
  });

  git(["branch", "-D", "main"]);
  test("validation fails when origin/main and main are unavailable", () => {
    expectContainmentFailure("RELEASE_BASE_REF_UNAVAILABLE", () =>
      validateReleaseContainmentFromEnvironment(tempRoot),
    );
  });
} finally {
  if (tempRoot.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status.padEnd(4)} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}
console.log(`\n${results.length - failures.length}/${results.length} phase-aware containment tests passed.`);
if (failures.length) process.exitCode = 1;
