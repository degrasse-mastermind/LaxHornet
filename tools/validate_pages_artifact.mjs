import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateArtifact } from "./build_pages_artifact.mjs";

const modulePath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(modulePath), "..");

function parseArguments(argv) {
  const options = {};
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(argument);
    if (!match) throw new Error(`Unsupported argument: ${argument}`);
    options[match[1]] = match[2];
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const result = validateArtifact({
  root: path.resolve(options.root || root),
  specPath: path.resolve(options.spec || path.join(root, "release", "pages-deployment-allowlist.json")),
  outputPath: path.resolve(options.output || path.join(root, ".pages-artifact")),
  metadataPath: path.resolve(options.metadata || path.join(root, ".pages-artifact-metadata")),
});

process.stdout.write(`${JSON.stringify({ status: "PASS", ...result }, null, 2)}\n`);
