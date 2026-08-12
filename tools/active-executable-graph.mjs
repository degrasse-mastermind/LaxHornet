import fs from "node:fs";
import path from "node:path";

const defaultRoots = [
  ".github/workflows",
  "package.json",
  "vercel.json",
  "tools/run_v283_local_regression.mjs",
  "tools/run_release_preflight.mjs",
  "tools/run_release_verification.mjs",
  "tools/run_supabase_preview_server_matrix.mjs",
  "tools/build_r207b_vercel_preview.mjs",
  "tools/verify_pages_settings.mjs",
  "tools/verify_pages_production.mjs",
  "tools/validate_release_manifest.mjs",
  "docs/CODEX_WORKFLOW.md",
  "docs/RELEASE_VERIFICATION_WORKFLOW.md",
];

const prohibited = [
  { label: "Docker executable", pattern: /\bdocker(?:\.exe)?\s+(?:build|compose|exec|info|ps|pull|push|rm|run|start|stop|version)\b/i },
  { label: "Docker child process", pattern: /(?:spawn|spawnSync|execFile|execFileSync|command|run|runGate)\s*\(\s*["']docker(?:\.exe)?["']/i },
  { label: "Docker Compose executable", pattern: /\bdocker-compose\s+(?:build|down|exec|ps|pull|run|start|stop|up|version)\b/i },
  { label: "Docker daemon socket", pattern: /(?:\/var\/run\/docker\.sock|DOCKER_HOST|npipe:\/\/\.\/pipe\/docker_engine)/i },
  { label: "retired local Supabase stack", pattern: /(?:^|[\s"'`])supabase\s+(?:start|stop|status|db\s+(?:reset|push)|migration\s+up|test\s+db)(?=$|[\s"'`])/im },
];

const ignoredReferences = [
  /^review-evidence\//,
  /^docs\/archive\//,
  /^docs\/LOCAL_SUPABASE_WORKFLOW\.md$/,
];

const safeModeFiles = new Set([
  "tools/test_r207_forward_migration_b_activation.mjs",
  "tools/test_team_members_state_c.mjs",
]);

const guardImplementationFiles = new Set([
  "tools/active-executable-graph.mjs",
  "tools/test_active_executable_graph.mjs",
  "tools/test_no_container_active_paths.mjs",
  "tools/test_supabase_preview_server_matrix_contract.mjs",
]);

function normalize(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isIgnored(relative) {
  return ignoredReferences.some((pattern) => pattern instanceof RegExp ? pattern.test(relative) : false);
}

function filesUnder(root, relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relative];
  return fs.readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => filesUnder(root, normalize(path.join(relative, entry.name))));
}

function localReferences(source, relative) {
  const refs = new Set();
  const add = (candidate) => {
    if (!candidate || /^(?:https?:|node:|@)/.test(candidate)) return;
    const base = candidate.startsWith(".")
      ? normalize(path.join(path.dirname(relative), candidate))
      : normalize(candidate);
    refs.add(base);
  };

  for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(|)|require\s*\()\s*["']([^"']+)["']/g)) add(match[1]);
  for (const match of source.matchAll(/["'`](\.?\.?\/?(?:tools|\.github|scripts|supabase)\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|py|ps1|sh|yml|yaml|json|sql))["'`]/g)) add(match[1]);
  for (const match of source.matchAll(/(?:node|python(?:3)?|pwsh|powershell|bash|sh)\s+([^\s"'`]+\.(?:mjs|cjs|js|py|ps1|sh))/g)) add(match[1]);
  return [...refs];
}

export function analyzeActiveExecutableGraph(root, roots = defaultRoots) {
  const queue = roots.flatMap((relative) => filesUnder(root, normalize(relative)));
  const visited = new Set();
  const edges = [];
  const failures = [];

  while (queue.length) {
    const relative = normalize(queue.shift());
    if (visited.has(relative) || isIgnored(relative)) continue;
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    visited.add(relative);
    const source = fs.readFileSync(absolute, "utf8");
    for (const rule of prohibited) {
      if (
        !relative.endsWith(".md")
        && !safeModeFiles.has(relative)
        && !guardImplementationFiles.has(relative)
        && rule.pattern.test(source)
      ) failures.push({ file: relative, rule: rule.label });
    }
    for (const reference of localReferences(source, relative)) {
      if (!fs.existsSync(path.join(root, reference)) || isIgnored(reference)) continue;
      edges.push({ from: relative, to: reference });
      queue.push(reference);
    }
  }

  return { roots: [...roots], files: [...visited].sort(), edges, failures };
}

export { defaultRoots };
