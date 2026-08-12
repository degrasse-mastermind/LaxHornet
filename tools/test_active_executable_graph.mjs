import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeActiveExecutableGraph } from "./active-executable-graph.mjs";

function fixture(files, roots) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-active-graph-"));
  try {
    for (const [relative, source] of Object.entries(files)) {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
    }
    return analyzeActiveExecutableGraph(root, roots);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const cases = [
  ["direct workflow", { ".github/workflows/x.yml": "run: docker version" }, [".github/workflows"]],
  ["workflow nested script", { ".github/workflows/x.yml": "run: node tools/a.mjs", "tools/a.mjs": "spawnSync('docker', ['run'])" }, [".github/workflows"]],
  ["package nested script", { "package.json": '{"scripts":{"verify":"node tools/a.mjs"}}', "tools/a.mjs": "import './b.mjs'", "tools/b.mjs": "docker-compose up" }, ["package.json"]],
  ["Vercel build", { "vercel.json": '{"buildCommand":"node tools/build.mjs"}', "tools/build.mjs": "docker build ." }, ["vercel.json"]],
  ["release helper", { "tools/release.mjs": "import './helper.mjs'", "tools/helper.mjs": "docker.exe version" }, ["tools/release.mjs"]],
  ["Compose command", { "tools/release.mjs": "docker compose up" }, ["tools/release.mjs"]],
];

for (const [label, files, roots] of cases) {
  assert.ok(fixture(files, roots).failures.length, `${label} must be rejected`);
  console.log(`PASS: ${label} is rejected`);
}

const historical = fixture({
  "tools/live.mjs": "const evidence = 'review-evidence/old.txt'",
  "review-evidence/old.txt": "docker run historical-only",
}, ["tools/live.mjs"]);
assert.equal(historical.failures.length, 0, "historical evidence must be excluded");
console.log("PASS: historical evidence reference is excluded");
console.log("Recursive active-executable graph adversarial tests: 7/7 passed.");
