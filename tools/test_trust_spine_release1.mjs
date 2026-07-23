import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS,
  validateReleaseContainmentFromEnvironment,
} from "./release_containment.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const gateDir = path.join(repoRoot, "docs", "methodnorth", "trust-spine-gate");
const migrationPath = path.join(gateDir, "TRUST_SPINE_SCHEMA_PROPOSAL.sql");
const sqlTestsPath = path.join(gateDir, "TRUST_SPINE_STAGING_TESTS.sql");
const rollbackPath = path.join(gateDir, "TRUST_SPINE_STAGING_ROLLBACK.sql");
const appPath = path.join(repoRoot, "app.js");

const migration = fs.readFileSync(migrationPath, "utf8");
const sqlTests = fs.readFileSync(sqlTestsPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8");

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

function matches(source, pattern) {
  return [...source.matchAll(pattern)];
}

function extractFunction(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} was not found`);
  const openingBrace = source.indexOf("{", start);
  assert.notEqual(openingBrace, -1, `${functionName} has no body`);

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = openingBrace; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${functionName} body did not terminate`);
}

test("Migration is additive and does not alter legacy runtime tables", () => {
  const forbidden = [
    /alter\s+table\s+public\.games\b/i,
    /alter\s+table\s+public\.events\b/i,
    /alter\s+table\s+public\.teams\b/i,
    /alter\s+table\s+public\.roster_players\b/i,
    /drop\s+(table|function|policy|schema)\b/i,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(migration), false, `Forbidden migration pattern: ${pattern}`);
  }
});

test("Trust Spine foreign keys preserve evidence and never target legacy tables", () => {
  const legacyTargets = [
    /references\s+public\.games\b/i,
    /references\s+public\.events\b/i,
    /references\s+public\.teams\b/i,
    /references\s+public\.roster_players\b/i,
  ];
  for (const pattern of legacyTargets) {
    assert.equal(pattern.test(migration), false, `Legacy foreign key target found: ${pattern}`);
  }

  const foreignKeys = matches(
    migration,
    /references\s+public\.(lh_[a-z0-9_]+)\s*\([^)]*\)\s*on\s+delete\s+([a-z]+)/gi,
  );
  assert.ok(foreignKeys.length >= 20, "Expected preservation-safe Trust Spine foreign keys");
  for (const foreignKey of foreignKeys) {
    assert.equal(
      foreignKey[2].toLowerCase(),
      "restrict",
      `Non-preserving delete behavior on ${foreignKey[1]}`,
    );
  }
});

test("Release 1 scope excludes deferred roles and systems", () => {
  const forbidden = [
    /\bclub_admin\b/i,
    /\bplatform_admin\b/i,
    /\bathlete(_|\s)?role\b/i,
    /\bgeneralized_disclosure\b/i,
    /\bpersistent_ai\b/i,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(migration), false, `Deferred scope found: ${pattern}`);
  }
});

test("All 20 Trust Spine tables are in the deny-all RLS list", () => {
  const createdTables = matches(
    migration,
    /create\s+table\s+public\.(lh_[a-z0-9_]+)\s*\(/gi,
  ).map((match) => match[1]);
  assert.equal(createdTables.length, 20, "Unexpected Trust Spine table count");

  const denyAllBlock = migration.match(
    /foreach\s+table_name\s+in\s+array\s+array\[(?<tables>[\s\S]*?)\]\s+loop/i,
  );
  assert.ok(denyAllBlock?.groups?.tables, "Deny-all RLS table list not found");
  const denyAllTables = matches(denyAllBlock.groups.tables, /'(lh_[a-z0-9_]+)'/gi)
    .map((match) => match[1]);
  assert.deepEqual(
    [...denyAllTables].sort(),
    [...createdTables].sort(),
    "RLS deny-all list differs from created tables",
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(
    migration,
    /revoke all on table public\.%I from public, anon, authenticated/i,
  );
});

test("No direct Trust Spine table grants are given to browser roles", () => {
  assert.equal(
    /grant\s+(select|insert|update|delete|all)[\s\S]{0,120}on\s+(table\s+)?public\.lh_/i.test(
      migration,
    ),
    false,
    "Direct Trust Spine table grant found",
  );
});

test("Staging rollback removes exactly the additive Trust Spine tables", () => {
  const createdTables = matches(
    migration,
    /create\s+table\s+public\.(lh_[a-z0-9_]+)\s*\(/gi,
  ).map((match) => match[1]);
  const droppedTables = matches(
    rollback,
    /drop\s+table\s+if\s+exists\s+public\.(lh_[a-z0-9_]+)\s*;/gi,
  ).map((match) => match[1]);

  assert.deepEqual([...droppedTables].sort(), [...createdTables].sort());
  for (const legacyTable of ["games", "events", "teams", "roster_players"]) {
    assert.equal(
      new RegExp(`drop\\s+table[\\s\\S]{0,80}public\\.${legacyTable}\\b`, "i").test(rollback),
      false,
      `Rollback targets legacy table ${legacyTable}`,
    );
  }
});

test("Only the nine approved public RPCs are created and granted", () => {
  const expected = [
    "lh_register_team_scope",
    "lh_register_player_scope",
    "lh_register_game_scope",
    "lh_resolve_active_grants",
    "lh_create_event",
    "lh_correct_event",
    "lh_tombstone_event",
    "lh_public_live_share_game",
    "lh_record_sensitive_export",
  ];
  const publicFunctions = matches(
    migration,
    /create\s+or\s+replace\s+function\s+public\.(lh_[a-z0-9_]+)/gi,
  ).map((match) => match[1]);
  assert.deepEqual(publicFunctions.sort(), expected.sort());
  for (const functionName of expected) {
    assert.match(
      migration,
      new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\b`, "i"),
      `${functionName} is not explicitly granted`,
    );
  }
});

test("Public RPC wrappers are fixed-path definers and private helpers are unreachable", () => {
  const publicBlocks = matches(
    migration,
    /create\s+or\s+replace\s+function\s+public\.lh_[\s\S]*?\$\$;/gi,
  );
  assert.equal(publicBlocks.length, 9);
  for (const block of publicBlocks) {
    assert.match(block[0], /security definer/i);
    assert.match(block[0], /set search_path = ''/i);
  }
  assert.match(
    migration,
    /create\s+or\s+replace\s+function\s+lh_trust_private\.lh_create_event_impl[\s\S]*?security definer[\s\S]*?set search_path = ''/i,
  );
  assert.match(
    migration,
    /revoke all on schema lh_trust_private from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /revoke all on all functions in schema lh_trust_private from public, anon, authenticated/i,
  );
  assert.equal(
    /grant\s+usage\s+on\s+schema\s+lh_trust_private/i.test(migration),
    false,
    "Private schema usage is granted to a browser role",
  );
  assert.equal(
    /grant\s+execute\s+on\s+function\s+lh_trust_private\./i.test(migration),
    false,
    "Private helper execution is granted to a browser role",
  );
});

test("Grant lifecycle and constrained provenance are represented", () => {
  for (const term of [
    "issued",
    "accepted",
    "expired",
    "revoked",
    "renewed",
    "system_bootstrap",
    "invitation",
    "renewal",
  ]) {
    assert.match(migration, new RegExp(`'${term}'`, "i"));
  }
  assert.match(migration, /lh_validate_grant_provenance/i);
  assert.match(migration, /lh_validate_grant_lifecycle/i);
});

test("Create, correction, and permanent tombstone operation records are separate", () => {
  for (const tableName of [
    "lh_event_create_operations",
    "lh_event_correction_operations",
    "lh_event_tombstone_operations",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${tableName}\\b`, "i"));
  }
  assert.equal(/restore_event|lh_event_restore|lh_event_restoration/i.test(migration), false);
});

test("Operations preserve all outcomes while revisions preserve accepted evidence only", () => {
  assert.match(migration, /check \(outcome_class in \('accepted', 'rejected', 'conflicted'\)\)/i);
  assert.match(migration, /create table public\.lh_event_conflicts/i);
  assert.match(migration, /create table public\.lh_conflict_adjudications/i);
  assert.match(migration, /lh_conflict_adjudications_immutable/i);
  assert.match(migration, /accepted_evidence_fields jsonb not null/i);
  assert.match(migration, /lh_validate_accepted_revision/i);
  const revisionTable = migration.match(
    /create table public\.lh_event_revisions\s*\(([\s\S]*?)\n\);/i,
  )?.[1] || "";
  assert.equal(
    /outcome_class|outcome_code|proposed_evidence_fields/i.test(revisionTable),
    false,
    "Revision rows still carry rejected/conflicted outcomes",
  );
});

test("Scope registration is canonical, idempotent, and does not issue grants", () => {
  for (const helper of [
    "lh_register_team_scope_impl",
    "lh_register_player_scope_impl",
    "lh_register_game_scope_impl",
  ]) {
    assert.match(migration, new RegExp(`function\\s+lh_trust_private\\.${helper}\\b`, "i"));
  }
  assert.match(migration, /on conflict \(team_id\) do update/i);
  assert.match(migration, /on conflict \(team_id, roster_player_id\) do update/i);
  assert.match(migration, /on conflict \(game_id\) do update/i);
  assert.match(migration, /historical_game_identity_mismatch/i);
  assert.match(migration, /invalid_game_player_team_scope/i);
  const registrationSection = migration.slice(
    migration.indexOf("function lh_trust_private.lh_can_register_legacy_scope"),
    migration.indexOf("function lh_trust_private.lh_create_event_impl"),
  );
  assert.equal(
    /insert\s+into\s+public\.lh_access_grants/i.test(registrationSection),
    false,
    "Scope registration issues access grants",
  );
});

test("Accepted revision sequencing uses the locked effective-row counter", () => {
  assert.match(migration, /accepted_revision_sequence integer not null default 0/i);
  assert.match(
    migration,
    /select \* into effective[\s\S]*?from public\.lh_event_effective_versions[\s\S]*?for update;/i,
  );
  assert.match(
    migration,
    /revision_sequence := effective\.accepted_revision_sequence \+ 1/i,
  );
  assert.match(
    migration,
    /accepted_revision_sequence = revision_sequence/i,
  );
  assert.equal(/lh_next_revision_sequence|max\(revision_sequence\)/i.test(migration), false);
});

test("Evidence, annotations, Live Share, and export field allowlists are explicit", () => {
  assert.match(migration, /lh_evidence_fields\(\)/i);
  assert.match(migration, /lh_annotation_fields\(\)/i);
  assert.match(migration, /lh_valid_annotations/i);
  assert.match(migration, /create table public\.lh_event_annotations/i);
  assert.match(migration, /lh_live_share_game_fields\(\)/i);
  assert.match(migration, /lh_live_share_event_fields\(\)/i);
  assert.match(migration, /lh_sensitive_export_game_fields\(\)/i);
  assert.match(migration, /lh_sensitive_export_event_fields\(\)/i);
  assert.match(migration, /lh_sensitive_export_annotation_fields\(\)/i);
  assert.match(migration, /lh_jsonb_has_only_keys/i);
  const evidenceFields = migration.match(
    /function lh_trust_private\.lh_evidence_fields\(\)[\s\S]*?\$\$;/i,
  )?.[0] || "";
  assert.equal(/'note'|'tags'/i.test(evidenceFields), false);
});

test("The SQL suite covers every required staging scenario", () => {
  const requiredMarkers = [
    "parent grant boundary",
    "coach boundary",
    "team admin evidence mutation",
    "pending grant",
    "expired grant",
    "revoked grant",
    "cross-scope denial",
    "grant escalation",
    "direct event update",
    "direct event delete",
    "correction idempotency",
    "duplicate operation tampering",
    "different-field merge",
    "same-field conflict",
    "tombstone resurrection prevention",
    "correction replay after revocation",
    "Live Share",
    "export audit",
    "adjudication update",
    "RLS posture",
    "private helper invocation",
    "accepted revision",
    "annotation fields",
    "scope registration",
    "tombstones are permanent",
    "inactive Live Share token",
    "concurrency-safe revision counter",
  ];
  for (const marker of requiredMarkers) {
    assert.match(sqlTests, new RegExp(marker, "i"), `Missing test marker: ${marker}`);
  }
  assert.match(sqlTests, /sqlTestsPassed', 33/i);
  assert.match(sqlTests, /rollback;/i);
});

test("LaxHornet account storage keys isolate users", () => {
  const scopedStorageKey = extractFunction(appSource, "scopedStorageKey");
  const context = vm.createContext({
    activeStorageUserId: "",
    result: null,
  });
  vm.runInContext(`${scopedStorageKey};`, context);

  context.activeStorageUserId = "user-a";
  const userAKey = vm.runInContext(`scopedStorageKey("laxhornet.games.v1")`, context);
  context.activeStorageUserId = "user-b";
  const userBKey = vm.runInContext(`scopedStorageKey("laxhornet.games.v1")`, context);
  context.activeStorageUserId = "";
  const deviceKey = vm.runInContext(`scopedStorageKey("laxhornet.games.v1")`, context);

  assert.equal(userAKey, "laxhornet.games.v1.user.user-a");
  assert.equal(userBKey, "laxhornet.games.v1.user.user-b");
  assert.equal(deviceKey, "laxhornet.games.v1");
  assert.notEqual(userAKey, userBKey);
  assert.notEqual(userAKey, deviceKey);
});

test("Next-game focus keys isolate account, team, and roster player", () => {
  const focusStorageSegment = extractFunction(appSource, "focusStorageSegment");
  const nextGameFocusStorageKey = extractFunction(appSource, "nextGameFocusStorageKey");
  const context = vm.createContext({
    state: { player: {} },
    DEFAULT_PLAYER: {},
    normalizePlayer: (player) => player,
    focusAccountId: () => context.accountId,
    accountId: "account-a",
    result: null,
  });
  vm.runInContext(`${focusStorageSegment}; ${nextGameFocusStorageKey};`, context);

  context.accountId = "account-a";
  const aTeamAPlayer1 = vm.runInContext(
    `nextGameFocusStorageKey({id:"local-a",teamId:"team-a",rosterPlayerId:"player-1"})`,
    context,
  );
  context.accountId = "account-b";
  const bTeamAPlayer1 = vm.runInContext(
    `nextGameFocusStorageKey({id:"local-a",teamId:"team-a",rosterPlayerId:"player-1"})`,
    context,
  );
  context.accountId = "account-a";
  const aTeamBPlayer1 = vm.runInContext(
    `nextGameFocusStorageKey({id:"local-a",teamId:"team-b",rosterPlayerId:"player-1"})`,
    context,
  );
  const aTeamAPlayer2 = vm.runInContext(
    `nextGameFocusStorageKey({id:"local-b",teamId:"team-a",rosterPlayerId:"player-2"})`,
    context,
  );

  assert.notEqual(aTeamAPlayer1, bTeamAPlayer1);
  assert.notEqual(aTeamAPlayer1, aTeamBPlayer1);
  assert.notEqual(aTeamAPlayer1, aTeamAPlayer2);
  assert.match(aTeamAPlayer1, /user\.account-a\.team\.team-a\.player\.player-1$/);
});

test("Phase-aware release containment preserves the authorized Trust Spine SQL", () => {
  const containment = validateReleaseContainmentFromEnvironment(repoRoot);
  if (containment.mode === "standalone") {
    assert.equal(containment.releaseDeltaFiles.some((file) => file.endsWith(".sql")), false);
    assert.equal(
      containment.releaseDeltaFiles.some((file) => file.startsWith("supabase/migrations/")),
      false,
    );
    assert.equal(
      containment.releaseDeltaFiles.some((file) => file.startsWith("supabase/rollback/")),
      false,
    );
  } else if (containment.mode === "additive") {
    assert.deepEqual(
      [...containment.allowedAdditiveDatabaseFiles].sort(),
      [...APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS].sort(),
    );
    assert.deepEqual(containment.postAuthorizationDatabaseFiles, []);
    assert.equal(containment.supabaseTreeMatchesAuthorizedRef, null);
  } else {
    assert.equal(containment.supabaseTreeMatchesAuthorizedRef, true);
    assert.deepEqual(containment.postAuthorizationDatabaseFiles, []);
    assert.equal(containment.authorizedSupabaseDeltaFiles.length, 7);
  }
  assert.match(appSource, /publicLiveShareRpc:\s*RUNTIME_CONFIG\.publicLiveShareRpc === true/);
  assert.match(appSource, /liveShareTokenRpc:\s*RUNTIME_CONFIG\.liveShareTokenRpc === true/);
  assert.match(appSource, /exportAuditRpc:\s*RUNTIME_CONFIG\.exportAuditRpc === true/);
  assert.match(appSource, /\.select\("\*, events\(\*\)"\)/);
});

const failed = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  const suffix = result.error ? `: ${result.error}` : "";
  console.log(`${result.status.padEnd(4)} ${result.name}${suffix}`);
}
console.log(`\n${results.length - failed.length}/${results.length} local contract tests passed.`);

if (failed.length) process.exitCode = 1;
