import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  APPROVED_AUTHORIZED_DB_PATHS,
  APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS,
  APPROVED_HISTORICAL_PROVENANCE_PATHS,
  ReleaseContainmentError,
  validateReleaseContainment,
  validateReleaseContainmentFromEnvironment,
} from "./release_containment.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "..");
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

function withoutExplicitReleaseBase(callback) {
  const previous = process.env.LAXHORNET_RELEASE_BASE_REF;
  delete process.env.LAXHORNET_RELEASE_BASE_REF;
  try {
    return callback();
  } finally {
    if (previous !== undefined) process.env.LAXHORNET_RELEASE_BASE_REF = previous;
  }
}

function validateSyntheticEnvironment(options = {}) {
  return validateReleaseContainmentFromEnvironment(tempRoot, {
    authorizedDbRef: "",
    approvedAdditiveRef: "",
    ...options,
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
      const result = validateSyntheticEnvironment();
      assert.equal(result.releaseBaseRef, "release-base");
      assert.equal(result.releaseBaseSource, "explicit");
    } finally {
      if (previous === undefined) delete process.env.LAXHORNET_RELEASE_BASE_REF;
      else process.env.LAXHORNET_RELEASE_BASE_REF = previous;
    }
  });

  test("origin/main is selected when available", () => {
    const result = withoutExplicitReleaseBase(() => validateSyntheticEnvironment());
    assert.equal(result.releaseBaseRef, "origin/main");
    assert.equal(result.releaseBaseSource, "origin/main");
  });

  test("local main is selected when origin/main is absent", () => {
    git(["update-ref", "-d", "refs/remotes/origin/main"]);
    const result = withoutExplicitReleaseBase(() => validateSyntheticEnvironment());
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

  test("additive cleanup mode permits only explicitly approved SQL paths", () => {
    const result = validateReleaseContainment({
      repoRoot: tempRoot,
      releaseBaseRef: "release-base",
      headRef: "bad-standalone-sql",
      allowedAdditiveDbPaths: ["tools/unauthorized.sql"],
    });
    assert.equal(result.mode, "additive");
    assert.deepEqual(result.allowedAdditiveDatabaseFiles, ["tools/unauthorized.sql"]);
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

  git(["switch", "-c", "approved-additive", "combined"]);
  for (const [index, file] of APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS.entries()) {
    write(file, `approved additive file ${index + 1}\n`);
  }
  commit("Synthetic approved additive capability package");
  git(["tag", "approved-additive-ref"]);

  test("exact additive package passes the existing additive phase", () => {
    const result = validateReleaseContainment({
      repoRoot: tempRoot,
      releaseBaseRef: "combined",
      headRef: "approved-additive-ref",
      allowedAdditiveDbPaths: APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS,
    });
    assert.equal(result.mode, "additive");
    assert.deepEqual(
      [...result.allowedAdditiveDatabaseFiles].sort(),
      [...APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS].sort(),
    );
  });

  git(["switch", "-c", "canonical-plus-additive"]);
  write("app.js", "export const version = 'final-combined';\n");
  commit("Synthetic final combined release");

  test("canonical plus additive mode accepts the exact approved final tree", () => {
    const result = validateReleaseContainment({
      repoRoot: tempRoot,
      releaseBaseRef: "release-base",
      authorizedDbRef: "authorized-db-ref",
      approvedAdditiveRef: "approved-additive-ref",
    });
    assert.equal(result.mode, "canonical_plus_additive");
    assert.equal(result.supabaseTreeMatchesAuthorizedRef, null);
    assert.equal(result.canonicalSupabaseFilesMatchAuthorizedRef, true);
    assert.equal(result.combinedSupabaseTreeMatchesApprovedRefs, true);
    assert.deepEqual(
      [...result.allowedAdditiveDatabaseFiles].sort(),
      [...APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS].sort(),
    );
  });

  git(["switch", "-c", "canonical-plus-additive-provenance", "canonical-plus-additive"]);
  fs.copyFileSync(path.join(sourceRoot, ".gitattributes"), path.join(tempRoot, ".gitattributes"));
  for (const file of APPROVED_HISTORICAL_PROVENANCE_PATHS) {
    const target = path.join(tempRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fs.readFileSync(path.join(sourceRoot, file)));
  }
  commit("Add reviewed historical production provenance");
  git(["tag", "provenance-ref"]);

  test("reviewed historical provenance extends the exact approved final tree", () => {
    const result = validateReleaseContainment({
      repoRoot: tempRoot,
      releaseBaseRef: "release-base",
      authorizedDbRef: "authorized-db-ref",
      approvedAdditiveRef: "approved-additive-ref",
    });
    assert.equal(result.mode, "canonical_plus_additive_with_provenance");
    assert.equal(result.combinedSupabaseTreeMatchesApprovedRefs, true);
    assert.equal(result.historicalProvenance.markerCommentOnly, true);
    assert.equal(result.historicalProvenance.statementCount, 350);
    assert.equal(
      result.historicalProvenance.orderedStatementsMd5,
      "ea4aeff5aff66a88dae1211b93e3a1fa",
    );
  });

  git(["switch", "-c", "provenance-archive-edit", "provenance-ref"]);
  append(
    "supabase/production-history/20260723010607_remote_schema.sql",
    "\n-- unauthorized archive mutation\n",
  );
  commit("Tamper historical production archive");
  test("historical provenance rejects an archive mutation", () => {
    expectContainmentFailure("HISTORICAL_PROVENANCE_FILE_IDENTITY_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "provenance-marker-edit", "provenance-ref"]);
  append("supabase/migrations/20260723010607_remote_schema.sql", "\nselect 1;\n");
  commit("Make historical marker executable");
  test("historical provenance rejects executable marker SQL", () => {
    expectContainmentFailure("HISTORICAL_PROVENANCE_FILE_IDENTITY_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "provenance-unexpected-file", "provenance-ref"]);
  write("supabase/production-history/UNREVIEWED.md", "not reviewed\n");
  commit("Add unexpected historical provenance file");
  test("historical provenance rejects an unexpected archive path", () => {
    expectContainmentFailure("COMBINED_SUPABASE_PATH_SET_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "combined-canonical-edit", "canonical-plus-additive"]);
  append(APPROVED_AUTHORIZED_DB_PATHS[1], "tampered canonical migration\n");
  commit("Tamper combined canonical migration");
  test("canonical plus additive mode rejects a modified canonical migration", () => {
    expectContainmentFailure("COMBINED_SUPABASE_FILE_IDENTITY_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "combined-canonical-missing", "canonical-plus-additive"]);
  git(["rm", APPROVED_AUTHORIZED_DB_PATHS[2]]);
  commit("Remove combined canonical migration");
  test("canonical plus additive mode rejects a missing canonical migration", () => {
    expectContainmentFailure("COMBINED_SUPABASE_PATH_SET_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "combined-additive-edit", "canonical-plus-additive"]);
  append(APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS[0], "tampered capability migration\n");
  commit("Tamper combined capability migration");
  test("canonical plus additive mode rejects a modified capability migration", () => {
    expectContainmentFailure("COMBINED_SUPABASE_FILE_IDENTITY_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "combined-additive-rollback-edit", "canonical-plus-additive"]);
  append(APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS[1], "tampered capability rollback\n");
  commit("Tamper combined capability rollback");
  test("canonical plus additive mode rejects a modified capability rollback", () => {
    expectContainmentFailure("COMBINED_SUPABASE_FILE_IDENTITY_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "combined-unexpected-migration", "canonical-plus-additive"]);
  write("supabase/migrations/20260723050000_unexpected.sql", "select 1;\n");
  commit("Add unexpected combined migration");
  test("canonical plus additive mode rejects an unexpected migration", () => {
    expectContainmentFailure("COMBINED_SUPABASE_PATH_SET_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "combined-unexpected-rollback", "canonical-plus-additive"]);
  write("supabase/rollback/20260723050000_unexpected_rollback.sql", "select 1;\n");
  commit("Add unexpected combined rollback");
  test("canonical plus additive mode rejects unexpected rollback SQL", () => {
    expectContainmentFailure("COMBINED_SUPABASE_PATH_SET_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
      }),
    );
  });

  git(["switch", "-c", "combined-unexpected-function", "canonical-plus-additive"]);
  write("supabase/functions/unexpected/index.ts", "export default () => 'unexpected';\n");
  commit("Add unexpected combined Supabase function");
  test("canonical plus additive mode rejects unexpected Supabase function code", () => {
    expectContainmentFailure("COMBINED_SUPABASE_PATH_SET_MISMATCH", () =>
      validateReleaseContainment({
        repoRoot: tempRoot,
        releaseBaseRef: "release-base",
        authorizedDbRef: "authorized-db-ref",
        approvedAdditiveRef: "approved-additive-ref",
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
    withoutExplicitReleaseBase(() => {
      expectContainmentFailure("RELEASE_BASE_REF_UNAVAILABLE", () =>
        validateReleaseContainmentFromEnvironment(tempRoot),
      );
    });
  });
} finally {
  if (tempRoot.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("historical provenance blank and production-shaped execution pass", () => {
  execFileSync(process.execPath, ["tools/test_production_ledger_provenance.mjs"], {
    cwd: sourceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
});

const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status.padEnd(4)} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}
console.log(`\n${results.length - failures.length}/${results.length} phase-aware containment tests passed.`);
if (failures.length) process.exitCode = 1;
