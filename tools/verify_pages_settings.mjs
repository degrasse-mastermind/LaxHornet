import assert from "node:assert/strict";

const expectedDomain = "laxhornet.mybranford.com";
const expectedVersion = "v284";
const repository = String(process.env.GITHUB_REPOSITORY || "");
const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "");
const verifyProduction = process.argv.includes("--production");

assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "GITHUB_REPOSITORY is required");
assert.ok(token, "GITHUB_TOKEN is required");

async function githubPagesSettings() {
  const response = await fetch(`https://api.github.com/repos/${repository}/pages`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  assert.equal(response.status, 200, `GitHub Pages settings request failed: ${response.status}`);
  return response.json();
}

async function verifyProductionEndpoint() {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(
        `https://${expectedDomain}/version.json?pages-verification=${Date.now()}`,
        { cache: "no-store", redirect: "follow" },
      );
      assert.equal(response.status, 200, `production version request failed: ${response.status}`);
      assert.equal(new URL(response.url).hostname, expectedDomain, "production redirected away from custom domain");
      assert.equal(new URL(response.url).protocol, "https:", "production did not remain on HTTPS");
      const body = await response.json();
      assert.equal(body.version, expectedVersion, "production release marker changed");
      return { url: response.url.split("?")[0], version: body.version, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  throw lastError;
}

const settings = await githubPagesSettings();
assert.equal(settings.build_type, "workflow", "Pages source must be GitHub Actions");
assert.equal(settings.cname, expectedDomain, "Pages custom domain changed");
assert.equal(settings.https_enforced, true, "Pages HTTPS enforcement must remain enabled");
assert.equal(settings.https_certificate?.state, "approved", "Pages custom-domain certificate is not approved");

const result = {
  status: "PASS",
  buildType: settings.build_type,
  customDomain: settings.cname,
  httpsEnforced: settings.https_enforced,
  certificateState: settings.https_certificate.state,
};
if (verifyProduction) result.production = await verifyProductionEndpoint();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
