import assert from "node:assert/strict";
import { parseOptions, verifyPages } from "./verify_pages_settings.mjs";

const SOURCE_SHA = "9e434e33534a1b348b19e2081b91d7e0724299fc";
const tests = [];

function test(name, callback) {
  tests.push(Promise.resolve().then(callback).then(
    () => console.log(`PASS ${name}`),
    (error) => {
      console.error(`FAIL ${name}: ${error.message}`);
      throw error;
    },
  ));
}

function response(body, { status = 200, url = "https://laxhornet.mybranford.com/" } = {}) {
  return {
    status,
    url,
    async json() { return typeof body === "string" ? JSON.parse(body) : body; },
    async text() { return typeof body === "string" ? body : JSON.stringify(body); },
  };
}

function fixtureFetch({ runtime = "v285", cache = "laxhornet-v285" } = {}) {
  return async (input) => {
    const url = String(input);
    if (url.includes("api.github.com")) {
      return response({
        build_type: "workflow",
        cname: "laxhornet.mybranford.com",
        https_enforced: true,
        https_certificate: { state: "approved" },
      }, { url });
    }
    if (url.includes("version.json")) return response({ version: runtime }, { url });
    if (url.includes("service-worker.js")) return response(`const CACHE_NAME = "${cache}";`, { url });
    throw new Error(`Unexpected request: ${url}`);
  };
}

function releaseOptions(runtime = "v285", cache = "laxhornet-v285", source = SOURCE_SHA) {
  return parseOptions([
    "--expected-runtime-marker", runtime,
    "--expected-cache-marker", cache,
    "--expected-source-sha", source,
    "--deployment-manifest", "fixture.json",
    "--attempts", "1",
    "--retry-delay-ms", "0",
  ]);
}

async function verify({ options = releaseOptions(), fetchImpl = fixtureFetch(), manifest = {} } = {}) {
  return verifyPages({
    options,
    repository: "degrasse-mastermind/LaxHornet",
    token: "fixture-token",
    fetchImpl,
    resolvePath: (file) => file,
    readFile: () => JSON.stringify({
      sourceCommit: SOURCE_SHA,
      releaseVersion: options["expected-runtime-marker"],
      ...manifest,
    }),
  });
}

test("settings-only pre-deployment verification needs no historical live marker", async () => {
  const result = await verifyPages({
    options: parseOptions([]),
    repository: "degrasse-mastermind/LaxHornet",
    token: "fixture-token",
    fetchImpl: fixtureFetch({ runtime: "v284", cache: "laxhornet-v284" }),
  });
  assert.equal(result.mode, "settings-only");
});

test("explicit pre-deployment v284 expectation passes", async () => {
  const result = await verify({
    options: releaseOptions("v284", "laxhornet-v284"),
    fetchImpl: fixtureFetch({ runtime: "v284", cache: "laxhornet-v284" }),
  });
  assert.equal(result.production.runtimeMarker, "v284");
});

test("explicit post-deployment v285 expectation passes", async () => {
  const result = await verify();
  assert.equal(result.production.cacheMarker, "laxhornet-v285");
});

test("release-sensitive mode rejects missing explicit expectations", () => {
  assert.throws(() => parseOptions(["--production"]), /requires --expected-runtime-marker/);
});

test("wrong live runtime marker fails with a classified error", async () => {
  await assert.rejects(() => verify({ fetchImpl: fixtureFetch({ runtime: "v284" }) }), (error) => error.code === "LIVE_RUNTIME_MARKER_MISMATCH");
});

test("wrong live cache marker fails with a classified error", async () => {
  await assert.rejects(() => verify({ fetchImpl: fixtureFetch({ cache: "laxhornet-v284" }) }), (error) => error.code === "LIVE_CACHE_MARKER_MISMATCH");
});

test("wrong deployed SHA fails with a classified error", async () => {
  await assert.rejects(() => verify({ manifest: { sourceCommit: "0".repeat(40) } }), (error) => error.code === "DEPLOYED_SOURCE_SHA_MISMATCH");
});

await Promise.all(tests);
console.log(`\n${tests.length}/${tests.length} Pages settings verifier tests passed.`);
