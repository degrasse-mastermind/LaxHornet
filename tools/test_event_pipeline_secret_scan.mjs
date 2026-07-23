import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const excludedDirectories = new Set([".git", "assets", "node_modules", "research"]);
const currentEvidence = path.join("review-evidence", "event-pipeline-release-control-cleanup");
const allowedProductionHostFiles = new Set([
  "README.md",
  "app.js",
  "supabase-email-communication-setup.md",
  path.join("tools", "test_release_hygiene.mjs"),
]);
const productionRef = "ulbmjcvnyznvmjgpstno";
const findings = [];

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute);
    if (relative.startsWith("review-evidence") && !relative.startsWith(currentEvidence)) continue;
    if (entry.isDirectory()) {
      files.push(...walk(absolute));
      continue;
    }
    if (!/\.(?:cjs|js|json|md|mjs|sql|ts|txt|html|css)$/i.test(entry.name)) continue;
    files.push({ absolute, relative });
  }
  return files;
}

for (const file of walk(root)) {
  const content = fs.readFileSync(file.absolute, "utf8");
  if (/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/.test(content)) {
    findings.push(`${file.relative}: JWT-like credential`);
  }
  if (/\bsb_secret_[A-Za-z0-9_-]{12,}\b/.test(content)) {
    findings.push(`${file.relative}: Supabase secret key`);
  }
  if (content.includes(`${productionRef}.supabase.co`) && !allowedProductionHostFiles.has(file.relative)) {
    findings.push(`${file.relative}: unexpected production host reference`);
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Secret and host scan passed.");
console.log("No JWTs, Supabase secret keys, or unexpected production host references found.");
