import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const EXPECTED_DOMAIN = "laxhornet.mybranford.com";
const RELEASE_EXPECTATION_KEYS = [
  "expected-runtime-marker",
  "expected-cache-marker",
  "expected-source-sha",
  "deployment-manifest",
];

export class PagesVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PagesVerificationError";
    this.code = code;
  }
}

function requireState(condition, code, message) {
  if (!condition) throw new PagesVerificationError(code, message);
}

export function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--production") {
      options.production = true;
      continue;
    }
    const equals = /^--([a-z-]+)=(.*)$/.exec(argument);
    if (equals) {
      options[equals[1]] = equals[2];
      continue;
    }
    const name = /^--([a-z-]+)$/.exec(argument)?.[1];
    if (!name || index + 1 >= argv.length || argv[index + 1].startsWith("--")) {
      throw new PagesVerificationError("UNSUPPORTED_ARGUMENT", `Unsupported argument: ${argument}`);
    }
    options[name] = argv[index + 1];
    index += 1;
  }

  const supported = new Set(["production", ...RELEASE_EXPECTATION_KEYS, "base-url", "attempts", "retry-delay-ms"]);
  for (const name of Object.keys(options)) {
    requireState(supported.has(name), "UNSUPPORTED_ARGUMENT", `Unsupported option: --${name}`);
  }

  const releaseSensitive = Boolean(options.production || RELEASE_EXPECTATION_KEYS.some((key) => options[key]));
  if (releaseSensitive) {
    for (const key of RELEASE_EXPECTATION_KEYS) {
      requireState(
        Boolean(options[key]),
        "EXPECTED_STATE_REQUIRED",
        `Release-sensitive verification requires --${key}`,
      );
    }
    requireState(
      /^v\d+$/.test(options["expected-runtime-marker"]),
      "INVALID_RUNTIME_MARKER",
      "Expected runtime marker must use the v<number> format",
    );
    requireState(
      options["expected-cache-marker"] === `laxhornet-${options["expected-runtime-marker"]}`,
      "INVALID_CACHE_MARKER",
      "Expected cache marker must correspond to the expected runtime marker",
    );
    requireState(
      /^[a-f0-9]{40}$/.test(options["expected-source-sha"]),
      "INVALID_SOURCE_SHA",
      "Expected source SHA must be a full lowercase Git commit SHA",
    );
  }

  return {
    ...options,
    releaseSensitive,
    attempts: Number(options.attempts || 12),
    retryDelayMs: Number(options["retry-delay-ms"] || 5_000),
  };
}

async function jsonResponse(response, code, label) {
  requireState(response.status === 200, code, `${label} request failed: ${response.status}`);
  return response.json();
}

export async function verifyPages({
  options,
  repository,
  token,
  fetchImpl = fetch,
  readFile = (file) => fs.readFileSync(file, "utf8"),
  resolvePath = (file) => path.resolve(file),
}) {
  requireState(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),
    "GITHUB_REPOSITORY_REQUIRED",
    "GITHUB_REPOSITORY is required",
  );
  requireState(Boolean(token), "GITHUB_TOKEN_REQUIRED", "GITHUB_TOKEN is required");

  const settings = await jsonResponse(
    await fetchImpl(`https://api.github.com/repos/${repository}/pages`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
    }),
    "PAGES_SETTINGS_REQUEST_FAILED",
    "GitHub Pages settings",
  );
  requireState(settings.build_type === "workflow", "PAGES_BUILD_TYPE_MISMATCH", "Pages source must be GitHub Actions");
  requireState(settings.cname === EXPECTED_DOMAIN, "PAGES_DOMAIN_MISMATCH", "Pages custom domain changed");
  requireState(settings.https_enforced === true, "PAGES_HTTPS_NOT_ENFORCED", "Pages HTTPS enforcement must remain enabled");
  requireState(settings.https_certificate?.state === "approved", "PAGES_CERTIFICATE_NOT_APPROVED", "Pages custom-domain certificate is not approved");

  const result = {
    status: "PASS",
    mode: options.releaseSensitive ? "release-sensitive" : "settings-only",
    buildType: settings.build_type,
    customDomain: settings.cname,
    httpsEnforced: settings.https_enforced,
    certificateState: settings.https_certificate.state,
  };
  if (!options.releaseSensitive) return result;

  const manifestPath = resolvePath(options["deployment-manifest"]);
  const deploymentManifest = JSON.parse(readFile(manifestPath));
  requireState(
    deploymentManifest.sourceCommit === options["expected-source-sha"],
    "DEPLOYED_SOURCE_SHA_MISMATCH",
    `Deployment manifest source ${deploymentManifest.sourceCommit || "(missing)"} does not match expected ${options["expected-source-sha"]}`,
  );
  requireState(
    deploymentManifest.releaseVersion === options["expected-runtime-marker"],
    "DEPLOYMENT_MANIFEST_RUNTIME_MISMATCH",
    "Deployment manifest runtime marker does not match the explicit expectation",
  );

  const baseUrl = new URL(options["base-url"] || `https://${EXPECTED_DOMAIN}/`);
  requireState(baseUrl.hostname === EXPECTED_DOMAIN, "PRODUCTION_DOMAIN_MISMATCH", "Production base URL must use the approved domain");
  let lastError;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const cacheBust = `${options["expected-source-sha"]}-${Date.now()}`;
      const versionUrl = new URL("version.json", baseUrl);
      versionUrl.searchParams.set("pages-verification", cacheBust);
      const versionResponse = await fetchImpl(versionUrl, { cache: "no-store", redirect: "manual" });
      requireState(versionResponse.status === 200, "PRODUCTION_RUNTIME_REQUEST_FAILED", `Production version request failed: ${versionResponse.status}`);
      requireState(new URL(versionResponse.url).hostname === EXPECTED_DOMAIN, "PRODUCTION_REDIRECTED", "Production runtime redirected away from the custom domain");
      requireState(new URL(versionResponse.url).protocol === "https:", "PRODUCTION_NOT_HTTPS", "Production runtime did not remain on HTTPS");
      const version = await versionResponse.json();
      requireState(
        version.version === options["expected-runtime-marker"],
        "LIVE_RUNTIME_MARKER_MISMATCH",
        `Live runtime marker ${version.version || "(missing)"} does not match expected ${options["expected-runtime-marker"]}`,
      );

      const workerUrl = new URL("service-worker.js", baseUrl);
      workerUrl.searchParams.set("pages-verification", cacheBust);
      const workerResponse = await fetchImpl(workerUrl, { cache: "no-store", redirect: "manual" });
      requireState(workerResponse.status === 200, "PRODUCTION_WORKER_REQUEST_FAILED", `Production service-worker request failed: ${workerResponse.status}`);
      requireState(new URL(workerResponse.url).hostname === EXPECTED_DOMAIN, "PRODUCTION_REDIRECTED", "Production service worker redirected away from the custom domain");
      const worker = await workerResponse.text();
      const cacheMarker = worker.match(/const CACHE_NAME = "([^"]+)";/)?.[1] || "";
      requireState(
        cacheMarker === options["expected-cache-marker"],
        "LIVE_CACHE_MARKER_MISMATCH",
        `Live cache marker ${cacheMarker || "(missing)"} does not match expected ${options["expected-cache-marker"]}`,
      );

      result.production = {
        runtimeUrl: versionResponse.url.split("?")[0],
        serviceWorkerUrl: workerResponse.url.split("?")[0],
        runtimeMarker: version.version,
        cacheMarker,
        sourceSha: deploymentManifest.sourceCommit,
        attempts: attempt,
      };
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < options.attempts) await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));
    }
  }
  throw lastError;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  return verifyPages({
    options,
    repository: String(process.env.GITHUB_REPOSITORY || ""),
    token: String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""),
  });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      const code = error.code || "PAGES_VERIFICATION_FAILED";
      process.stderr.write(`${code}: ${error.message}\n`);
      process.exitCode = 1;
    });
}
