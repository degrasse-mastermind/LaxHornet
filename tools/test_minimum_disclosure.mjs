import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS,
  validateReleaseContainmentFromEnvironment,
} from "./release_containment.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const styles = read("styles.css");
const privacy = read("privacy.html");
const terms = read("terms.html");
const trust = read("access-and-trust.html");
const readme = read("README.md");
const migration = read("review-evidence/product-alignment-remediation-v2/sql/01_MINIMUM_DISCLOSURE_STAGING_MIGRATION.sql");
const baseRollback = read("review-evidence/product-alignment-remediation-v2/sql/99_TRUST_SPINE_BASE_STAGING_ROLLBACK.sql");
const remote = read("review-evidence/product-alignment-remediation-v2/tests/test_minimum_disclosure_remote.mjs");

const checks = [];
const failures = [];
function expect(condition, message) {
  checks.push(message);
  if (!condition) failures.push(message);
}

const secureLoadStart = app.indexOf("if (TRUSTED_DISCLOSURE_FEATURES.publicLiveShareRpc)");
const legacyWildcard = app.indexOf('.select("*, events(*)")', secureLoadStart);
const secureReturn = app.indexOf("return;", secureLoadStart);
const importStart = app.indexOf("function prepareImportJSONFile");
const importEnd = app.indexOf("function cancelPendingImport", importStart);
const importSource = app.slice(importStart, importEnd);
const backupStart = app.indexOf("function fullBackupPayload");
const backupEnd = app.indexOf("function openExportDialog", backupStart);
const containment = validateReleaseContainmentFromEnvironment(root);
const changedFiles = containment.releaseDeltaFiles;

expect(app.includes("publicLiveShareRpc: RUNTIME_CONFIG.publicLiveShareRpc === true"), "trusted Live Share is off by default");
expect(app.includes("liveShareTokenRpc: RUNTIME_CONFIG.liveShareTokenRpc === true"), "trusted token lifecycle is off by default");
expect(app.includes("exportAuditRpc: RUNTIME_CONFIG.exportAuditRpc === true"), "trusted export audit is off by default");
expect(app.includes("Read-only live updates"), "shared viewers receive public-view status copy");
expect(secureLoadStart >= 0 && secureReturn >= 0 && (legacyWildcard < 0 || secureReturn < legacyWildcard), "secure Live Share returns before the legacy wildcard path");
expect(app.includes('supabaseClient.rpc("lh_public_live_share_game"'), "secure Live Share calls the public-safe RPC");
expect(app.includes("schedulePublicLiveSharePoll") && app.includes("PUBLIC_LIVE_SHARE_POLL_MS"), "secure Live Share uses allowlisted polling");
expect(app.includes("stopSharedGameTransport") && app.includes("removeChannel"), "secure cutover removes ordinary table subscriptions");
expect(app.includes('note: ""') && app.includes("tags: []"), "public payload mapping cannot render notes or tags");
expect(migration.includes("revoke select on table public.games from anon") && migration.includes("revoke select on table public.events from anon"), "staging denies anonymous ordinary game/event reads");
expect(!/^\\set\b/im.test(baseRollback), "base rollback is executable in the Supabase SQL editor without psql meta-commands");
expect(migration.includes("lh_public_live_share_game(text) to anon, authenticated"), "only the public-safe Live Share RPC is granted anonymously");
expect(migration.includes("lh_create_live_share_token") && migration.includes("lh_revoke_live_share_tokens"), "staging has explicit token create/revoke RPCs");
expect(migration.includes("token_hash") && !migration.includes("'rawToken'"), "server stores only the token hash");
expect(migration.includes("expires_at is null") || read("review-evidence/product-alignment-remediation-v2/sql/00_TRUST_SPINE_BASE_STAGING_MIGRATION.sql").includes("expires_at is null"), "public token resolution enforces expiration");
expect(remote.includes("UNKNOWNLIVE1234567890") && remote.includes("EXPIREDTOKEN1234567890") && remote.includes("REVOKEDTOKEN1234567890"), "remote tests cover unknown, expired, and revoked tokens");
expect(app.includes('const scope = options.scope || "selected_player"'), "CSV defaults to the selected player scope");
expect(app.includes("includeNotes = options.includeNotes === true") && app.includes("includeProcessTags = options.includeProcessTags === true"), "CSV annotations require explicit inclusion");
expect(app.includes('id="confirmSensitiveBackup"') && app.includes("Confirm that you understand this is a sensitive private backup"), "full backup requires explicit confirmation");
expect(!app.slice(backupStart, backupEnd).includes("navigator.share"), "full backup never invokes native/public sharing");
expect(app.includes("recordSensitiveExportAudit") && app.includes("lh_record_disclosure_export"), "trusted export auditing is integrated behind its flag");
expect(migration.includes("'exportType', p_export_type") && migration.includes("'scopeType', p_scope_type") && migration.includes("'outcome', p_outcome"), "export audit stores metadata and outcome");
expect(!migration.includes("exportPayload") && !migration.includes("full_payload"), "export audit does not store exported payloads");
expect(migration.includes("p_scope_id is distinct from actor_id::text"), "account backup audit is scoped to the signed-in account");
expect((migration.match(/owner to postgres;/g) || []).length >= 6, "security-definer function ownership is explicit");
expect(!importSource.includes("state.playerClaims =") && !importSource.includes("state.teamAccessRequests ="), "import cannot grant player or team access");
expect(!importSource.includes("state.teams =") && !importSource.includes("state.rosterPlayers =") && !importSource.includes("state.players ="), "import cannot replace team, roster, or player authority state");
expect(app.includes("isShared: false") && app.includes("shareCode: makeShareCode()"), "imported games cannot reactivate Live Share tokens");
expect(app.includes("existing same-ID games will remain unchanged") || app.includes("existing same-ID game"), "import explains that existing games are not replaced");
expect(app.includes("deletedIds.has(game.id)") && app.includes("isDeletedGame(game.id)"), "import cannot resurrect locally deleted games");
expect(app.includes("buildFamilyRecap") && app.includes("publicRecapIntelligence") && !app.slice(app.indexOf("function buildFamilyRecap"), app.indexOf("function renderFamilyRecapSection")).includes("event.note"), "recap excludes private event notes and private process intelligence");
expect([privacy, terms, trust, readme].every((text) => text.includes("Live Share")) && readme.includes("Minimum-Necessary Disclosure"), "privacy, terms, access, and README distinguish output purposes");
expect(styles.includes(".disclosure-modal") && styles.includes(".confirm-check"), "mobile export/import confirmations have dedicated accessible layout");
expect(remote.includes("allowedGameKeys") && remote.includes("allowedEventKeys") && remote.includes("Anonymous ordinary-table read exposed"), "remote suite asserts exact allowlists and ordinary-table denial");
expect(changedFiles.includes("service-worker.js") && changedFiles.includes("version.json"), "release hygiene coordinates the service worker and version manifest");
expect(!changedFiles.some((file) => file.endsWith("supabase-schema.sql")), "production Supabase schema remains unchanged");
if (containment.mode === "standalone") {
  expect(
    !changedFiles.some((file) => file.endsWith(".sql") || file.startsWith("supabase/migrations/")),
    "standalone release-hygiene delta changes no SQL or canonical migration history",
  );
} else if (containment.mode === "additive") {
  expect(
    JSON.stringify([...containment.allowedAdditiveDatabaseFiles].sort())
      === JSON.stringify([...APPROVED_EVENT_PIPELINE_ADDITIVE_DB_PATHS].sort()),
    "additive cleanup changes only the approved capability migration and rollback",
  );
  expect(
    containment.postAuthorizationDatabaseFiles.length === 0,
    "additive cleanup has no post-authorization database changes",
  );
} else if (containment.mode === "canonical_plus_additive") {
  expect(
    containment.combinedSupabaseTreeMatchesApprovedRefs,
    "combined Supabase tree matches the approved canonical and additive file identities",
  );
  expect(
    containment.postAuthorizationDatabaseFiles.length === 0,
    "combined release contains no unapproved database files",
  );
} else {
  expect(
    containment.supabaseTreeMatchesAuthorizedRef,
    "combined Supabase tree matches the authorized PR #9 ref exactly",
  );
  expect(
    containment.postAuthorizationDatabaseFiles.length === 0,
    "release-hygiene delta does not alter canonical database files",
  );
}
expect(
  [privacy, terms, trust, readme].every((text) => /staging/i.test(text) && /not (?:yet )?active in production|production activation|production defaults remain off/i.test(text)),
  "public copy distinguishes staged proof from production activation",
);
expect(app.includes('data-action="undo"') && app.includes('data-action="cancel-game"') && app.includes('data-action="end-game"'), "live tracking controls remain intact");
expect(app.includes("function renderReview()") && app.includes("function renderDashboard()") && app.includes("function persistAll()"), "Game Review, Season Review, and offline persistence remain present");

if (failures.length) {
  console.error(`Minimum-disclosure checks failed (${failures.length}/${checks.length}):`);
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(`Minimum-disclosure checks passed (${checks.length}/${checks.length}).`);
checks.forEach((check) => console.log(`PASS: ${check}`));
