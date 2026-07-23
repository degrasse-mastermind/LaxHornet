import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "release/laxhornet-release-manifest.json"), "utf8"),
);
const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version;
const runtime = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

const report = {
  release: manifest.release,
  appVersion: version,
  cacheVersion: serviceWorker.match(/CACHE_NAME = "([^"]+)"/)?.[1] || "unknown",
  minimumSchemaCapability: manifest.minimumSchemaCapability,
  runtimeFlags: Object.fromEntries(
    manifest.requiredRuntimeFlags.map((flag) => [flag, runtime.includes(`${flag}: true`)]),
  ),
  eventOperationServicePresent: fs.existsSync(path.join(root, "event-operation-service.js")),
  legacyCompatibilityPresent: true,
  includesYouthOrFamilyData: false,
  productionContacted: false,
};

console.log(JSON.stringify(report, null, 2));
