import { readdirSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceFile = path.join(root, "review-evidence", "secure-disclosure-activation-v282", "local-regression-output.txt");
const python = process.env.LAXHORNET_PYTHON || "python";

const rootJavaScript = readdirSync(root)
  .filter((name) => name.endsWith(".js"))
  .sort()
  .map((name) => ({ name: `syntax: ${name}`, command: process.execPath, args: ["--check", name] }));

const tests = [
  ...rootJavaScript,
  { name: "v282 update release", command: process.execPath, args: ["tools/test_update_release.mjs"] },
  { name: "release hygiene", command: process.execPath, args: ["tools/test_release_hygiene.mjs"] },
  { name: "secure disclosure activation", command: process.execPath, args: ["tools/test_secure_disclosure_activation.mjs"] },
  { name: "secure disclosure browser", command: process.execPath, args: ["tools/test_secure_disclosure_activation_browser.cjs"] },
  { name: "Product Alignment source", command: process.execPath, args: ["tools/test_product_alignment_remediation.mjs"] },
  {
    name: "Product Alignment browser",
    command: process.execPath,
    args: ["tools/test_product_alignment_browser.cjs"],
    localServer: { port: 5251 },
  },
  { name: "Trust Spine contracts", command: process.execPath, args: ["tools/test_trust_spine_release1.mjs"] },
  { name: "Cancel Game", command: python, args: ["tools/test_cancel_game.py"] },
  { name: "delete permissions", command: python, args: ["tools/test_delete_rpc_permissions.py"] },
  { name: "player-removal cleanup", command: python, args: ["tools/test_player_removal_request_cleanup.py"] },
];

const log = [];
let failed = 0;

for (const test of tests) {
  let localServer;
  if (test.localServer) {
    localServer = spawn(python, ["-m", "http.server", String(test.localServer.port), "--bind", "127.0.0.1"], {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  const result = spawnSync(test.command, test.args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      LAXHORNET_RELEASE_BASE_REF: process.env.LAXHORNET_RELEASE_BASE_REF || "origin/review/release-hygiene-v281",
    },
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  if (exitCode !== 0) failed += 1;
  if (localServer && !localServer.killed) localServer.kill();
  log.push(
    `===== ${test.name} =====`,
    (result.stdout || "").trimEnd(),
    (result.stderr || "").trimEnd(),
    `EXIT: ${exitCode}`,
    "",
  );
}

log.push(`TOTAL: ${tests.length - failed} passed, ${failed} failed`, "");
writeFileSync(evidenceFile, log.filter((line, index) => line || index === log.length - 1).join("\n"));
console.log(log.at(-2));

if (failed) process.exitCode = 1;
