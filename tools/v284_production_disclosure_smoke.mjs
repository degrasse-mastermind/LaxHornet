import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPROVED_APPLICATION_SHA,
  PRODUCTION_PROJECT_REF,
  SYNTHETIC_PREFIX,
  TOOLING_BRANCH,
  TOOLING_PATHS,
  acceptedRpc,
  apiHeaders,
  assertPublicPayload,
  createAuthUser,
  createFixtureDescriptor,
  createPrivateAndPublicEvidence,
  makeLifecycleRecords,
  removeMutableFixtureSql,
  request,
  rpc,
  seedSql,
  signIn,
  sqlLiteral,
  verifyApiDisclosure,
} from "./v284_local_disclosure_fixture.mjs";

export const PRODUCTION_ORIGIN = "https://laxhornet.mybranford.com";
export const PRODUCTION_API_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
export const CORRECTIVE_MIGRATION_VERSION = "20260728193942";
export const PRODUCTION_EVIDENCE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "review-evidence",
  "v284-tracked-playing-time-production",
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenSecretPattern = /(?:eyJ[a-zA-Z0-9_-]{20,}|sb_(?:secret|publishable)_[a-zA-Z0-9_-]{12,})/;

function run(command, args, { cwd = root, sensitive = false, timeout = 120000 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout,
  });
  if (result.error || result.status !== 0) {
    const detail = sensitive
      ? "sensitive command failed; output suppressed"
      : String(result.stderr || result.stdout || result.error?.message || "command failed").trim();
    throw new Error(`${command} ${args[0] || ""}: ${detail}`);
  }
  return String(result.stdout || "").trim();
}

function git(args, options) {
  return run("git", args, options);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJsonOutput(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export function parseApprovedToolingSha(argv = process.argv.slice(2)) {
  const index = argv.indexOf("--approved-tooling-sha");
  assert.ok(index >= 0 && argv[index + 1], "--approved-tooling-sha is required");
  const sha = argv[index + 1].toLowerCase();
  assert.match(sha, /^[0-9a-f]{40}$/, "approved tooling SHA must be a full Git SHA");
  return sha;
}

export function assertProductionTarget({
  projectRef,
  apiUrl,
  applicationOrigin,
  approvedApplicationSha,
  branch,
  headSha,
  approvedToolingSha,
  configProjectId,
  workingTreeClean,
}) {
  assert.equal(projectRef, PRODUCTION_PROJECT_REF, "production project reference mismatch");
  assert.equal(apiUrl, PRODUCTION_API_URL, "production API origin mismatch");
  assert.equal(applicationOrigin, PRODUCTION_ORIGIN, "production application origin mismatch");
  assert.equal(approvedApplicationSha, APPROVED_APPLICATION_SHA, "approved application SHA mismatch");
  assert.equal(branch, TOOLING_BRANCH, "production smoke must run from the non-deployable tooling branch");
  assert.equal(headSha, approvedToolingSha, "tooling HEAD differs from the independently approved SHA");
  assert.equal(configProjectId, PRODUCTION_PROJECT_REF, "linked Supabase project mismatch");
  assert.equal(workingTreeClean, true, "production smoke tooling worktree must be clean");
  assert.notEqual(headSha, approvedApplicationSha, "tooling must remain outside the deployed application SHA");
  return true;
}

export function assertPrewriteState(state) {
  assert.equal(Number.isInteger(state.migrationCount), true, "migration count is not an integer");
  assert.equal(state.migrationCount, 1, "corrective migration must appear exactly once");
  assert.equal(Number.isInteger(state.activeTokenCount), true, "active token count is not an integer");
  assert.equal(state.activeTokenCount, 0, "pre-existing active Live Share tokens forbid synthetic production writes");
  assert.equal(state.hostedAssetsMatch, true, "hosted application bytes differ from the approved application SHA");
  assert.equal(state.toolingAbsentFromDeployment, true, "non-deployable tooling entered the application tree");
  return true;
}

export function assertCleanupProof(proof) {
  for (const key of [
    "retainedEventOperations",
    "retainedParticipationOperations",
    "retainedLifecycleEvents",
    "retainedGameScopes",
  ]) {
    assert.equal(Number.isInteger(proof[key]), true, `${key} retained-history count is not an integer`);
    assert.ok(proof[key] >= 0, `${key} retained-history count is negative`);
  }
  for (const key of [
    "authUsers",
    "authSessions",
    "refreshTokens",
    "legacyEvents",
    "legacyGames",
    "playerClaims",
    "teamMembers",
    "rosterPlayers",
    "teams",
    "userProfiles",
    "activeTokens",
    "activeGrants",
    "clockRows",
    "activeEventVersions",
    "activeParticipation",
    "pendingEventOperations",
    "conflictedEventOperations",
  ]) {
    assert.equal(Number.isInteger(proof[key]), true, `${key} cleanup count is not an integer`);
    assert.equal(proof[key], 0, `${key} survived production cleanup`);
  }
  assert.equal(proof.oldAccessTokenRejected, true, "old access token retained authority");
  assert.equal(proof.oldRefreshTokenRejected, true, "old refresh token remained usable");
  assert.equal(proof.oldPrivateRpcRejected, true, "old private RPC authority remained usable");
  assert.equal(proof.realDataTouched, false, "cleanup proof did not preserve the real-data boundary");
  return true;
}

export function isOldPrivateAuthorityRejected(result) {
  return [401, 403].includes(result?.status)
    || (
      result?.status === 200
      && result?.body?.outcome === "rejected"
      && ["unauthorized", "unauthorized_scope", "authority_changed"].includes(result?.body?.code)
    );
}

export function unresolvedParticipationStarts(rows = [], periodFormat = "quarters") {
  const periods = periodFormat === "halves"
    ? ["H1", "H2", "OT"]
    : ["Q1", "Q2", "Q3", "Q4", "OT"];
  const ordered = [...rows].sort((left, right) => {
    const leftPeriod = periods.indexOf(left.period);
    const rightPeriod = periods.indexOf(right.period);
    if (leftPeriod !== rightPeriod) {
      return (leftPeriod < 0 ? Number.MAX_SAFE_INTEGER : leftPeriod)
        - (rightPeriod < 0 ? Number.MAX_SAFE_INTEGER : rightPeriod);
    }
    const clockDifference = Number(right.game_clock_seconds) - Number(left.game_clock_seconds);
    if (clockDifference) return clockDifference;
    const occurredDifference = Date.parse(left.occurred_at || left.client_created_at)
      - Date.parse(right.occurred_at || right.client_created_at);
    if (occurredDifference) return occurredDifference;
    return String(left.client_operation_id).localeCompare(String(right.client_operation_id));
  });
  const activeByPlayer = new Map();
  for (const operation of ordered) {
    const playerId = String(operation.player_id || "");
    if (!playerId || !periods.includes(operation.period)) continue;
    if (operation.operation_kind === "player_in") {
      if (!activeByPlayer.has(playerId)) activeByPlayer.set(playerId, operation);
      continue;
    }
    if (operation.operation_kind !== "player_out") continue;
    const active = activeByPlayer.get(playerId);
    if (!active) continue;
    activeByPlayer.delete(playerId);
  }
  return [...activeByPlayer.values()];
}

function configProjectId() {
  const source = fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
  const match = source.match(/^project_id\s*=\s*"([^"]+)"/m);
  assert.ok(match, "Supabase project_id is unavailable");
  return match[1];
}

function verifyToolingAndDeployment(approvedToolingSha) {
  const headSha = git(["rev-parse", "HEAD"]).toLowerCase();
  const branch = git(["branch", "--show-current"]);
  const status = git(["status", "--porcelain"]);
  const mainSha = git(["rev-parse", "origin/main"]).toLowerCase();
  assert.equal(mainSha, APPROVED_APPLICATION_SHA, "origin/main is not the approved application SHA");
  const deployedTree = git(["ls-tree", "-r", "--name-only", APPROVED_APPLICATION_SHA])
    .split(/\r?\n/)
    .filter(Boolean);
  const toolingAbsentFromDeployment = TOOLING_PATHS.every((item) => !deployedTree.includes(item));
  assertProductionTarget({
    projectRef: PRODUCTION_PROJECT_REF,
    apiUrl: PRODUCTION_API_URL,
    applicationOrigin: PRODUCTION_ORIGIN,
    approvedApplicationSha: mainSha,
    branch,
    headSha,
    approvedToolingSha,
    configProjectId: configProjectId(),
    workingTreeClean: status === "",
  });
  assert.equal(toolingAbsentFromDeployment, true, "non-deployable tooling exists in deployed main");
  return { headSha, branch, toolingAbsentFromDeployment };
}

async function verifyHostedAssets() {
  const results = [];
  for (const file of ["app.html", "app.js", "public-event-semantics.js", "service-worker.js", "version.json"]) {
    const committedResult = spawnSync("git", ["show", `${APPROVED_APPLICATION_SHA}:${file}`], {
      cwd: root,
      encoding: null,
      windowsHide: true,
      timeout: 30000,
    });
    if (committedResult.error || committedResult.status !== 0) {
      throw new Error(`unable to read approved Git bytes for ${file}`);
    }
    const committed = Buffer.from(committedResult.stdout);
    const response = await fetch(`${PRODUCTION_ORIGIN}/${file}?v284-proof=${APPROVED_APPLICATION_SHA}`);
    assert.equal(response.status, 200, `hosted ${file} returned ${response.status}`);
    const hosted = Buffer.from(await response.arrayBuffer());
    assert.equal(sha256(hosted), sha256(committed), `hosted ${file} differs from approved Git bytes`);
    results.push({ file, sha256: sha256(hosted), matches: true });
  }
  return results;
}

function databaseQuery(sql) {
  const parsed = parseJsonOutput(
    run("supabase", ["db", "query", "--linked", sql, "-o", "json"], { timeout: 120000 }),
    "Supabase database query",
  );
  assert.ok(Array.isArray(parsed.rows), "Supabase query rows are unavailable");
  return parsed.rows;
}

function queryResult(sql) {
  const rows = databaseQuery(sql);
  assert.equal(rows.length, 1, "expected one database result row");
  return rows[0].result ?? rows[0];
}

function apiKeys() {
  const keys = parseJsonOutput(
    run(
      "supabase",
      ["projects", "api-keys", "--project-ref", PRODUCTION_PROJECT_REF, "--reveal", "-o", "json"],
      { sensitive: true },
    ),
    "Supabase API key inventory",
  );
  assert.ok(Array.isArray(keys), "Supabase API key inventory is unavailable");
  const publishable = keys.find((item) => item.name === "anon")?.api_key
    || keys.find((item) => item.type === "publishable")?.api_key;
  const serviceRole = keys.find((item) => item.name === "service_role")?.api_key
    || keys.find((item) => item.type === "secret")?.api_key;
  assert.ok(publishable && serviceRole, "required production API keys are unavailable");
  return { publishable, serviceRole };
}

function prewriteDatabaseState() {
  return queryResult(`
select json_build_object(
  'migrationCount', (
    select count(*)::integer
    from supabase_migrations.schema_migrations
    where version = ${sqlLiteral(CORRECTIVE_MIGRATION_VERSION)}
  ),
  'activeTokenCount', (
    select count(*)::integer
    from public.lh_live_share_tokens
    where revoked_at is null
      and (expires_at is null or expires_at > now())
  )
) result;
`);
}

function productionSeedSql(fixture, adminId, coachId, lifecycle) {
  const guard = `
do $production_guard$
begin
  if current_database() <> 'postgres'
    or (
      select count(*)
      from supabase_migrations.schema_migrations
      where version = ${sqlLiteral(CORRECTIVE_MIGRATION_VERSION)}
    ) <> 1
  then
    raise exception 'V284_PRODUCTION_FIXTURE_GUARD_FAILED';
  end if;
end
$production_guard$;
`;
  return seedSql(fixture, adminId, coachId, lifecycle).replace("begin;\ndo $guard$", `begin;\n${guard}\ndo $guard$`);
}

function revokeFixtureGrantsSafelySql(context) {
  return `
begin;
insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id,
  actor_grant_id, related_grant_id, reason, occurred_at
)
select
  ${sqlLiteral(`${context.fixture.runId}-coach-revoked`)},
  grant_row.id,
  coalesce((
    select max(existing.sequence)
    from public.lh_grant_lifecycle_events existing
    where existing.grant_id = grant_row.id
  ), 0) + 1,
  'revoked',
  ${sqlLiteral(context.adminId)}::uuid,
  ${sqlLiteral(context.fixture.ids.adminGrant)},
  null,
  'v284 synthetic production fixture cleanup',
  now()
from public.lh_access_grants grant_row
where grant_row.id = ${sqlLiteral(context.fixture.ids.coachGrant)}
  and not exists (
    select 1
    from public.lh_grant_lifecycle_events existing
    where existing.grant_id = grant_row.id
      and existing.event_type in ('revoked', 'expired')
  )
on conflict (id) do nothing;

insert into public.lh_grant_lifecycle_events(
  id, grant_id, sequence, event_type, actor_user_id,
  actor_grant_id, related_grant_id, reason, occurred_at
)
select
  ${sqlLiteral(`${context.fixture.runId}-admin-revoked`)},
  grant_row.id,
  coalesce((
    select max(existing.sequence)
    from public.lh_grant_lifecycle_events existing
    where existing.grant_id = grant_row.id
  ), 0) + 1,
  'revoked',
  ${sqlLiteral(context.adminId)}::uuid,
  ${sqlLiteral(context.fixture.ids.adminGrant)},
  null,
  'v284 synthetic production fixture cleanup',
  now()
from public.lh_access_grants grant_row
where grant_row.id = ${sqlLiteral(context.fixture.ids.adminGrant)}
  and not exists (
    select 1
    from public.lh_grant_lifecycle_events existing
    where existing.grant_id = grant_row.id
      and existing.event_type in ('revoked', 'expired')
  )
on conflict (id) do nothing;
commit;
`;
}

async function verifyHostedReconciliation(context) {
  const { chromium } = await import("playwright");
  const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  assert.ok(fs.existsSync(executablePath), "approved Chrome executable is unavailable");
  const browser = await chromium.launch({ headless: true, executablePath });
  const trackerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const network = [];
  const diagnostics = [];
  try {
    const page = await trackerContext.newPage();
    page.on("request", (request_) => {
      const url = new URL(request_.url());
      if (url.host.endsWith(".supabase.co")) {
        network.push({ method: request_.method(), host: url.host, path: url.pathname });
      }
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())
        && message.text() !== "Service Worker registration blocked by Playwright") {
        diagnostics.push(`console:${message.type()}:${message.text()}`);
      }
    });
    page.on("pageerror", (error) => diagnostics.push(`pageerror:${error.message}`));
    await page.goto(`${PRODUCTION_ORIGIN}/app.html?fresh=v284-production-smoke-${Date.now()}`, {
      waitUntil: "domcontentloaded",
    });
    const auth = await page.evaluate(async (session) => {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (!error && data?.user) setAuthUser(data.user);
      return { ok: !error && Boolean(data?.user), message: error?.message || "" };
    }, context.coachSession);
    assert.equal(auth.ok, true, `hosted synthetic sign-in failed: ${auth.message}`);

    const initial = await page.evaluate(({ fixture, userId }) => {
      state.userProfile = normalizeUserProfile({
        userId,
        email: fixture.coachEmail,
        firstName: "V284",
        lastName: "Synthetic",
        approvedRole: "tracker",
        onboardingCompleted: true,
      });
      const team = normalizeTeam({
        id: fixture.ids.team,
        name: fixture.teamName,
        role: "tracker",
        cloudBacked: true,
      });
      const roster = normalizeRosterPlayer({
        id: fixture.ids.player,
        teamId: fixture.ids.team,
        name: fixture.playerName,
        number: "99",
        position: "Midfield",
        active: true,
      });
      const player = rosterPlayerToPlayer(roster);
      const events = [
        normalizeEvent({
          id: `${fixture.runId}-hosted-public-a`,
          gameId: fixture.ids.game,
          timestamp: "2026-07-28T12:00:00.000Z",
          quarter: "Q1",
          statType: "groundBall",
          statLabel: "Ground Ball",
          category: "Effort / IQ",
          pointValue: 2,
          fieldZone: "Midfield",
          note: "SYNTHETIC_PRIVATE_HOSTED_NOTE",
          tags: ["SYNTHETIC_PRIVATE_HOSTED_TAG"],
        }, fixture.ids.game),
        normalizeEvent({
          id: `${fixture.runId}-hosted-public-b`,
          gameId: fixture.ids.game,
          timestamp: "2026-07-28T12:01:00.000Z",
          quarter: "Q1",
          statType: "assist",
          statLabel: "Assist",
          category: "Offense",
          pointValue: 3,
          fieldZone: "Offensive end",
        }, fixture.ids.game),
      ];
      const game = normalizeGame({
        id: fixture.ids.game,
        userId,
        teamId: fixture.ids.team,
        rosterPlayerId: fixture.ids.player,
        opponent: fixture.opponent,
        date: "2026-07-28",
        periodFormat: "quarters",
        currentQuarter: "Q1",
        playerSnapshot: player,
        events,
      });
      state.teams = [team];
      state.rosterPlayers = [roster];
      state.playerClaims = [{
        id: fixture.ids.coachClaim,
        teamId: fixture.ids.team,
        rosterPlayerId: fixture.ids.player,
        userId,
      }];
      state.players = [player];
      state.player = player;
      state.activePlayerId = player.id;
      state.activeTeamId = team.id;
      state.activeGame = game;
      state.games = [game];
      state.screen = "live";
      persistAll();
      render();
      return { eventIds: events.map((event) => event.id) };
    }, { fixture: context.fixture, userId: context.coachId });
    const synchronized = await page.evaluate(async () => ({
      ok: await reconcileGameEventOperations(state.activeGame),
      pending: Object.values(state.trustSpineSync.events).reduce(
        (sum, record) => sum + (record.pendingOperations?.length || 0),
        0,
      ),
    }));
    assert.deepEqual(synchronized, { ok: true, pending: 0 }, "hosted ordinary reconciliation failed");

    const ordinaryJourney = await page.evaluate(async () => {
      const beforeCount = state.activeGame.events.length;
      const beforeScore = Number(state.activeGame.scoreFor || 0);
      const added = logEvent("goal");
      await eventOperationService().retryGameEventOperations(state.activeGame.id);
      const scored = Number(state.activeGame.scoreFor || 0) === beforeScore + 1;
      saveActiveGame("V284 synthetic production save");
      undoLastEvent();
      await eventOperationService().retryGameEventOperations(state.activeGame.id);
      const undoRestoredCount = state.activeGame.events.length === beforeCount;
      updateActiveGameScore("against");
      const savedId = state.activeGame.id;
      endGame();
      const endPrompted = state.pendingEndGame === true;
      confirmEndGame();
      navigate("review");
      const reviewRendered = document.body.innerText.includes("Game Review");
      const saved = state.games.find((game) => game.id === savedId);
      state.activeGame = saved;
      state.screen = "live";
      render();
      return {
        entryAccepted: Boolean(added),
        scored,
        undoRestoredCount,
        saved: Boolean(saved?.savedAt),
        endPrompted,
        ended: saved?.status === "complete",
        reviewRendered,
      };
    });
    assert.deepEqual(ordinaryJourney, {
      entryAccepted: true,
      scored: true,
      undoRestoredCount: true,
      saved: true,
      endPrompted: true,
      ended: true,
      reviewRendered: true,
    }, "hosted ordinary game journey failed");

    const correction = await page.evaluate(async (eventId) => {
      const event = state.activeGame.events.find((item) => item.id === eventId);
      const operation = correctGameEventOperation(state.activeGame, () => {
        event.fieldZone = "Defensive end";
        event.note = "SYNTHETIC_PRIVATE_CORRECTION";
        event.tags = ["SYNTHETIC_PRIVATE_CORRECTION"];
        event.correctedAt = new Date().toISOString();
        return { game: state.activeGame, event };
      });
      return { synchronized: await operation.cloudPromise, eventId };
    }, initial.eventIds[0]);
    assert.equal(correction.synchronized, true, "hosted correction did not synchronize");

    await trackerContext.setOffline(true);
    await page.locator('[data-stat="goal"]').click();
    const offline = await page.evaluate((knownIds) => {
      const event = state.activeGame.events.find((item) => !knownIds.includes(item.id));
      const pending = Object.values(state.trustSpineSync.events).reduce(
        (sum, record) => sum + (record.pendingOperations?.length || 0),
        0,
      );
      return { eventId: event?.id || "", pending };
    }, initial.eventIds);
    assert.ok(offline.eventId && offline.pending >= 1, "offline event was not retained locally");
    await trackerContext.setOffline(false);
    const retry = await page.evaluate(async () => ({
      ok: await eventOperationService().retryGameEventOperations(state.activeGame.id),
      pending: Object.values(state.trustSpineSync.events).reduce(
        (sum, record) => sum + (record.pendingOperations?.length || 0),
        0,
      ),
    }));
    assert.deepEqual(retry, { ok: true, pending: 0 }, "hosted offline retry did not reconcile");
    const tombstone = await page.evaluate(async (eventId) => {
      const event = state.activeGame.events.find((item) => item.id === eventId);
      const operation = tombstoneGameEventOperation(
        state.activeGame,
        "V284 synthetic production cleanup",
        () => {
          state.activeGame.events = state.activeGame.events.filter((item) => item.id !== eventId);
          state.games = [state.activeGame];
          rememberDeletedEvent(eventId);
          return { game: state.activeGame, event };
        },
      );
      return { synchronized: await operation.cloudPromise, lifecycle: state.trustSpineSync.events[eventId]?.lifecycleState };
    }, offline.eventId);
    assert.equal(tombstone.synchronized, true, "hosted tombstone did not synchronize");
    assert.equal(tombstone.lifecycle, "tombstoned", "hosted event did not become tombstoned");

    const boundaries = await page.evaluate(async ({ fixture, expectedPublicIds }) => {
      const privateEvents = [
        {
          id: `${fixture.runId}-legacy-alias`,
          statType: "legacy_shift_alias",
          statLabel: "Legacy Participation Alias",
          category: "Private Legacy Alias",
          fieldZone: "Player In at 12:34",
        },
        {
          id: `${fixture.runId}-player-in`,
          statType: "player_in",
          statLabel: "Player In",
          category: "Tracked Playing Time",
          fieldZone: "Midfield",
        },
        {
          id: `${fixture.runId}-unknown`,
          statType: "unknown_future_event",
          statLabel: "Unknown Future Event",
          category: "Unknown",
          fieldZone: "Midfield",
        },
        {
          id: `${fixture.runId}-poisoned`,
          statType: "goal",
          statLabel: "Goal",
          category: "Offense",
          fieldZone: "Player In at 12:34",
        },
      ].map((item, index) => normalizeEvent({
        ...item,
        gameId: fixture.ids.game,
        timestamp: new Date(Date.now() + index).toISOString(),
        quarter: "Q1",
        pointValue: 1,
        note: "SYNTHETIC_PRIVATE_ALIAS_NOTE",
      }, fixture.ids.game));
      state.activeGame.events.push(...privateEvents);
      state.games = [state.activeGame];
      persistAll();
      const synchronized = await reconcileGameEventOperations(state.activeGame);
      const localPrivate = state.activeGame.events.filter((event) =>
        ["legacy_shift_alias", "player_in", "unknown_future_event"].includes(event.statType)
        || event.fieldZone === "Player In at 12:34"
      );
      const csv = buildCSV({ scope: "current_game", gameId: state.activeGame.id });
      const recap = buildFamilyRecap(
        state.activeGame,
        state.activeGame.events,
        state.player,
        calculateTotals(state.activeGame.events, state.player),
      );
      return {
        synchronized,
        localPrivateCount: localPrivate.length,
        privatePublicationStates: localPrivate.map((event) => {
          const record = state.trustSpineSync.events[event.id] || {};
          return {
            id: event.id,
            reason: record.publicationSuppressedReason || "",
            pending: record.pendingOperations?.length || 0,
          };
        }),
        csvRetainsPrivateSemantics: /legacy_shift_alias|player_in|unknown_future_event/i.test(csv),
        csvOmitsPrivateNoteByDefault: !/SYNTHETIC_PRIVATE_ALIAS_NOTE/i.test(csv),
        recapText: recap?.text || "",
        expectedPublicIds,
      };
    }, { fixture: context.fixture, expectedPublicIds: initial.eventIds });
    assert.equal(boundaries.synchronized, true, "final hosted reconciliation did not settle");
    assert.equal(boundaries.localPrivateCount, 4, "former-failure aliases were not retained as private local evidence");
    assert.ok(
      boundaries.privatePublicationStates.every((item) =>
        item.reason === "unsupported_event_semantics" && item.pending === 0),
      "private or unknown semantics were not fail-closed",
    );
    assert.equal(boundaries.csvRetainsPrivateSemantics, true, "selected CSV lost scoped private evidence");
    assert.equal(boundaries.csvOmitsPrivateNoteByDefault, true, "selected CSV exposed private notes by default");
    assert.doesNotMatch(
      boundaries.recapText,
      /Legacy Participation Alias|Private Legacy Alias|Unknown Future Event|Player In at 12:34/i,
      "family recap included private or unknown semantics",
    );

    const finalPublic = await rpc(
      PRODUCTION_API_URL,
      context.publishableKey,
      "lh_public_live_share_game",
      { p_share_code: context.disclosure.shareCode },
    );
    assert.equal(finalPublic.status, 200, "final public payload request failed");
    const expectedPublicEvents = [
      {
        category: "Effort / IQ",
        event_id: initial.eventIds[0],
        field_zone: "Defensive end",
        occurred_at: "2026-07-28T12:00:00.000Z",
        period: "Q1",
        point_value: 2,
        stat_label: "Ground Ball",
        stat_type: "groundBall",
      },
      {
        category: "Offense",
        event_id: initial.eventIds[1],
        field_zone: "Offensive end",
        occurred_at: "2026-07-28T12:01:00.000Z",
        period: "Q1",
        point_value: 3,
        stat_label: "Assist",
        stat_type: "assist",
      },
    ];
    context.disclosure.expectedPublicEvents = expectedPublicEvents;
    const payload = assertPublicPayload(finalPublic.body, expectedPublicEvents);
    const ids = finalPublic.body.events.map((event) => event.event_id).sort();
    assert.deepEqual(ids, [...initial.eventIds].sort(), "former failure changed the exact public timeline");

    const viewerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const viewer = await viewerContext.newPage();
    viewer.on("request", (request_) => {
      const url = new URL(request_.url());
      if (url.host.endsWith(".supabase.co")) {
        network.push({ method: request_.method(), host: url.host, path: url.pathname });
      }
    });
    await viewer.goto(
      `${PRODUCTION_ORIGIN}/app.html?share=${encodeURIComponent(context.disclosure.shareCode)}&fresh=v284-final-failure`,
      { waitUntil: "domcontentloaded" },
    );
    await viewer.getByText("Ground Ball", { exact: false }).first().waitFor({ timeout: 30000 });
    const viewerState = await viewer.evaluate(() => ({
      status: state.syncStatus,
      eventCount: state.sharedGame?.events?.length || 0,
      body: document.body.innerText,
    }));
    assert.equal(viewerState.status, "Watching live");
    assert.equal(viewerState.eventCount, 2);
    assert.doesNotMatch(
      viewerState.body,
      /Legacy Participation Alias|Private Legacy Alias|unknown_future_event|Player In at 12:34|SYNTHETIC_PRIVATE/i,
      "hosted Live Share DOM disclosed forbidden semantics",
    );
    const viewerApi = network.filter((item) => item.host === `${PRODUCTION_PROJECT_REF}.supabase.co`);
    assert.ok(
      viewerApi.some((item) => item.path === "/rest/v1/rpc/lh_public_live_share_game"),
      "hosted viewer did not use the public-safe RPC",
    );
    assert.ok(
      viewerApi.every((item) =>
        item.path === "/rest/v1/rpc/lh_public_live_share_game"
        || item.path === "/rest/v1/rpc/lh_release_capabilities"
        || !item.path.startsWith("/rest/v1/")),
      "hosted viewer contacted an unexpected Supabase data path",
    );
    await viewerContext.close();
    assert.deepEqual(diagnostics, [], `hosted browser diagnostics: ${diagnostics.join(" | ")}`);
    return {
      publicPayload: payload,
      exactPublicEventIds: ids,
      localPrivateCount: boundaries.localPrivateCount,
      selectedCsvPrivateEvidenceRetained: boundaries.csvRetainsPrivateSemantics,
      selectedCsvPrivateNotesOmitted: boundaries.csvOmitsPrivateNoteByDefault,
      recapPrivateSemanticsOmitted: true,
      offlineRecovery: retry,
      ordinaryJourney,
      correction,
      tombstone,
      viewer: { status: viewerState.status, eventCount: viewerState.eventCount },
      network: {
        publicSafeRpcObserved: true,
        legacyGamesOrEventsRequests: viewerApi.filter((item) =>
          /^\/rest\/v1\/(?:games|events)(?:\/|$)/.test(item.path)).length,
      },
    };
  } finally {
    await trackerContext.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function runAdversarialRpcChecks(context) {
  const observedAliases = [
    ["legacy_shift_alias", "Legacy Participation Alias", "Private Legacy Alias", "Midfield"],
    ["player_in", "Player In", "Tracked Playing Time", "Midfield"],
    ["goal", "Goal", "Offense", "Player In at 12:34"],
    ["unknown_future_event", "Unknown Future Event", "Unknown", "Midfield"],
  ];
  const results = [];
  for (const [statType, statLabel, category, fieldZone] of observedAliases) {
    const operationId = `${context.fixture.runId}-rejected-${results.length}`;
    const result = await rpc(
      context.apiUrl,
      context.publishableKey,
      "lh_create_event",
      {
        p_operation: {
          client_operation_id: operationId,
          event_id: `${operationId}-event`,
          game_id: context.fixture.ids.game,
          evidence: {
            occurred_at: new Date().toISOString(),
            period: "Q1",
            stat_type: statType,
            stat_label: statLabel,
            category,
            point_value: 1,
            field_zone: fieldZone,
          },
          annotations: {},
          client_created_at: new Date().toISOString(),
        },
      },
      context.coachSession.access_token,
    );
    assert.equal(result.status, 200, `${statType} rejection HTTP status mismatch`);
    assert.equal(result.body?.outcome, "rejected", `${statType} was not rejected`);
    assert.equal(result.body?.code, "unsupported_event_semantics", `${statType} rejection code mismatch`);
    results.push({ statType, code: result.body.code });
  }
  return results;
}

async function closeActiveParticipation(context) {
  const now = new Date().toISOString();
  const result = await acceptedRpc(
    context.apiUrl,
    context.publishableKey,
    "lh_create_participation_operation",
    {
      p_operation: {
        operation_id: `${context.fixture.runId}-op-active-out`,
        client_operation_id: `${context.fixture.runId}-op-active-out-client`,
        logical_event_id: `${context.fixture.runId}-logical-active-out`,
        game_id: context.fixture.ids.game,
        operation_kind: "player_out",
        player_id: context.fixture.ids.player,
        period: "Q1",
        game_clock_seconds: 200,
        occurred_at: now,
        client_created_at: now,
        source: "live",
        system_close_reason: null,
        recovery_uncertain: false,
      },
    },
    context.coachSession.access_token,
  );
  return { code: result.code, trackedOperationCount: 9 };
}

async function exerciseClockFormats(context) {
  const update = (gameId, baseRevision, currentPeriod, remaining, running, recoveryState) =>
    acceptedRpc(
      context.apiUrl,
      context.publishableKey,
      "lh_update_game_clock",
      {
        p_clock: {
          game_id: gameId,
          base_revision: baseRevision,
          current_period: currentPeriod,
          clock_seconds_remaining: remaining,
          is_running: running,
          started_at: running ? new Date().toISOString() : null,
          paused_at: running ? null : new Date().toISOString(),
          client_updated_at: new Date().toISOString(),
          recovery_state: recoveryState,
        },
      },
      context.coachSession.access_token,
    );
  const quarterStart = await update(context.fixture.ids.game, 1, "Q1", 590, true, "estimated");
  const quarterPause = await update(context.fixture.ids.game, 2, "Q1", 580, false, "needs_review");
  const quarterResume = await update(context.fixture.ids.game, 3, "Q1", 570, true, "complete");
  const halves = await acceptedRpc(
    context.apiUrl,
    context.publishableKey,
    "lh_initialize_game_clock",
    {
      p_clock: {
        game_id: context.halvesGameId,
        period_format: "halves",
        regulation_period_duration_seconds: 1200,
        overtime_duration_seconds: 180,
        current_period: "H1",
        clock_seconds_remaining: 1200,
        is_running: false,
        started_at: null,
        paused_at: new Date().toISOString(),
        client_updated_at: new Date().toISOString(),
        recovery_state: "complete",
      },
    },
    context.coachSession.access_token,
  );
  const halvesStart = await update(context.halvesGameId, 1, "H1", 1190, true, "estimated");
  const halvesPause = await update(context.halvesGameId, 2, "H1", 1180, false, "complete");
  return {
    quarters: [quarterStart.code, quarterPause.code, quarterResume.code],
    halves: [halves.code, halvesStart.code, halvesPause.code],
    recoveryStates: ["estimated", "needs_review", "complete"],
  };
}

async function tombstoneActiveEvents(context) {
  const rows = databaseQuery(`
select event_id, server_event_version
from public.lh_event_effective_versions
where game_id = ${sqlLiteral(context.fixture.ids.game)}
  and lifecycle_state = 'active'
order by event_id;
`);
  const outcomes = [];
  for (const row of rows) {
    const result = await acceptedRpc(
      context.apiUrl,
      context.publishableKey,
      "lh_tombstone_event",
      {
        p_operation: {
          client_operation_id: `${context.fixture.runId}-cleanup-tombstone-${sha256(row.event_id).slice(0, 12)}`,
          event_id: row.event_id,
          game_id: context.fixture.ids.game,
          base_server_event_version: row.server_event_version,
          tombstone_reason: "V284 synthetic production fixture cleanup",
          client_created_at: new Date().toISOString(),
        },
      },
      context.coachSession.access_token,
    );
    outcomes.push({ eventId: row.event_id, code: result.code });
  }
  return outcomes;
}

async function revokeTokens(context) {
  if (!context.coachSession) return;
  let rpcAccepted = false;
  try {
    const result = await rpc(
      context.apiUrl,
      context.publishableKey,
      "lh_revoke_live_share_tokens",
      { p_game_id: context.fixture.ids.game },
      context.coachSession.access_token,
    );
    rpcAccepted = result.status === 200 && result.body?.outcome === "accepted";
  } catch {
    rpcAccepted = false;
  }
  databaseQuery(`
update public.lh_live_share_tokens
set revoked_at = coalesce(revoked_at, now())
where game_id = ${sqlLiteral(context.fixture.ids.game)}
returning token_id;
`);
  const neutral = await rpc(
    context.apiUrl,
    context.publishableKey,
    "lh_public_live_share_game",
    { p_share_code: context.disclosure?.shareCode || "V284-SYNTHETIC-CLEANUP" },
  );
  assert.equal(neutral.status, 200, "post-cleanup public token probe failed");
  assert.equal(neutral.body, null, "post-cleanup public token remained usable");
  return { rpcAccepted, directFallbackVerified: true, publicTokenNeutral: true };
}

function participationResolverRows(context) {
  return databaseQuery(`
select
  effective.player_id,
  effective.operation_kind,
  effective.period,
  effective.game_clock_seconds,
  effective.occurred_at,
  effective.client_created_at,
  effective.client_operation_id,
  scope.period_format_snapshot as period_format,
  clock.clock_seconds_remaining
from public.lh_effective_participation_operations effective
join public.lh_game_scopes scope on scope.game_id = effective.game_id
left join public.lh_game_clock_states clock on clock.game_id = effective.game_id
where effective.game_id = ${sqlLiteral(context.fixture.ids.game)}
  and effective.operation_kind in ('player_in', 'player_out');
`);
}

async function closeResidualParticipation(context) {
  if (!context.coachSession) return [];
  const rows = participationResolverRows(context);
  const periodFormat = rows[0]?.period_format || "quarters";
  const active = unresolvedParticipationStarts(rows, periodFormat);
  const outcomes = [];
  for (const [index, row] of active.entries()) {
    const timestamp = new Date().toISOString();
    const closeClockSeconds = Math.min(
      Number(row.game_clock_seconds),
      Number(row.clock_seconds_remaining),
    );
    assert.ok(
      Number.isInteger(closeClockSeconds) && closeClockSeconds >= 0,
      "residual participation close position is invalid",
    );
    const result = await acceptedRpc(
      context.apiUrl,
      context.publishableKey,
      "lh_create_participation_operation",
      {
        p_operation: {
          operation_id: `${context.fixture.runId}-cleanup-player-out-${index}`,
          client_operation_id: `${context.fixture.runId}-cleanup-player-out-${index}-client`,
          logical_event_id: `${context.fixture.runId}-cleanup-player-out-${index}-logical`,
          game_id: context.fixture.ids.game,
          operation_kind: "player_out",
          player_id: row.player_id,
          period: row.period,
          game_clock_seconds: closeClockSeconds,
          occurred_at: timestamp,
          client_created_at: timestamp,
          source: "recovery",
          system_close_reason: null,
          recovery_uncertain: true,
        },
      },
      context.coachSession.access_token,
    );
    outcomes.push({ playerId: row.player_id, code: result.code });
  }
  return outcomes;
}

async function deleteAuthUsers(context) {
  if (!context.publishableKey || !context.serviceRoleKey) return;
  if (context.coachSession) {
    const logout = await request(`${context.apiUrl}/auth/v1/logout?scope=global`, {
      method: "POST",
      headers: apiHeaders(context.publishableKey, context.coachSession.access_token),
      body: {},
    });
    assert.ok([200, 204].includes(logout.status), "synthetic global logout failed");
  }
  for (const userId of [context.coachId, context.adminId].filter(Boolean)) {
    const result = await request(`${context.apiUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: apiHeaders(context.publishableKey, context.serviceRoleKey),
    });
    assert.ok([200, 204, 404].includes(result.status), "synthetic Auth user deletion failed");
  }
}

async function oldAuthorityProof(context) {
  if (!context.coachSession) {
    return {
      oldAccessTokenRejected: true,
      oldRefreshTokenRejected: true,
      oldPrivateRpcRejected: true,
    };
  }
  const access = await request(`${context.apiUrl}/auth/v1/user`, {
    headers: apiHeaders(context.publishableKey, context.coachSession.access_token),
  });
  const refresh = await request(`${context.apiUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: apiHeaders(context.publishableKey, context.publishableKey),
    body: { refresh_token: context.coachSession.refresh_token },
  });
  const privateRpc = await rpc(
    context.apiUrl,
    context.publishableKey,
    "lh_read_game_clock",
    { p_game_id: context.fixture.ids.game },
    context.coachSession.access_token,
  );
  return {
    oldAccessTokenRejected: [401, 403].includes(access.status),
    oldRefreshTokenRejected: [400, 401, 403].includes(refresh.status),
    oldPrivateRpcRejected: isOldPrivateAuthorityRejected(privateRpc),
  };
}

function cleanupCounts(context) {
  const counts = queryResult(`
select json_build_object(
  'authUsers', (select count(*)::integer from auth.users where id in (${sqlLiteral(context.adminId)}::uuid, ${sqlLiteral(context.coachId)}::uuid)),
  'authSessions', (select count(*)::integer from auth.sessions where user_id in (${sqlLiteral(context.adminId)}::uuid, ${sqlLiteral(context.coachId)}::uuid)),
  'refreshTokens', (select count(*)::integer from auth.refresh_tokens where user_id in (${sqlLiteral(context.adminId)}::uuid, ${sqlLiteral(context.coachId)}::uuid)),
  'legacyEvents', (select count(*)::integer from public.events where game_id = ${sqlLiteral(context.fixture.ids.game)}),
  'legacyGames', (select count(*)::integer from public.games where id = ${sqlLiteral(context.fixture.ids.game)}),
  'playerClaims', (select count(*)::integer from public.player_claims where id = ${sqlLiteral(context.fixture.ids.coachClaim)}),
  'teamMembers', (select count(*)::integer from public.team_members where team_id = ${sqlLiteral(context.fixture.ids.team)}),
  'rosterPlayers', (select count(*)::integer from public.roster_players where id = ${sqlLiteral(context.fixture.ids.player)}),
  'teams', (select count(*)::integer from public.teams where id = ${sqlLiteral(context.fixture.ids.team)}),
  'userProfiles', (select count(*)::integer from public.user_profiles where user_id in (${sqlLiteral(context.adminId)}::uuid, ${sqlLiteral(context.coachId)}::uuid)),
  'activeTokens', (select count(*)::integer from public.lh_live_share_tokens where game_id = ${sqlLiteral(context.fixture.ids.game)} and revoked_at is null),
  'activeGrants', (
    select count(*)::integer
    from public.lh_access_grants grants
    where grants.id in (${sqlLiteral(context.fixture.ids.adminGrant)}, ${sqlLiteral(context.fixture.ids.coachGrant)})
      and not exists (
        select 1 from public.lh_grant_lifecycle_events events
        where events.grant_id = grants.id and events.event_type in ('revoked', 'expired')
      )
  ),
  'clockRows', (
    select count(*)::integer
    from public.lh_game_clock_states
    where game_id in (${sqlLiteral(context.fixture.ids.game)}, ${sqlLiteral(context.halvesGameId)})
  ),
  'activeEventVersions', (select count(*)::integer from public.lh_event_effective_versions where game_id = ${sqlLiteral(context.fixture.ids.game)} and lifecycle_state = 'active'),
  'pendingEventOperations', (select count(*)::integer from public.lh_event_operations where game_id = ${sqlLiteral(context.fixture.ids.game)} and outcome_class = 'pending'),
  'conflictedEventOperations', (select count(*)::integer from public.lh_event_operations where game_id = ${sqlLiteral(context.fixture.ids.game)} and outcome_class = 'conflicted'),
  'retainedEventOperations', (select count(*)::integer from public.lh_event_operations where game_id = ${sqlLiteral(context.fixture.ids.game)}),
  'retainedParticipationOperations', (select count(*)::integer from public.lh_participation_operations where game_id = ${sqlLiteral(context.fixture.ids.game)}),
  'retainedLifecycleEvents', (select count(*)::integer from public.lh_grant_lifecycle_events where grant_id in (${sqlLiteral(context.fixture.ids.adminGrant)}, ${sqlLiteral(context.fixture.ids.coachGrant)})),
  'retainedGameScopes', (
    select count(*)::integer
    from public.lh_game_scopes
    where game_id in (${sqlLiteral(context.fixture.ids.game)}, ${sqlLiteral(context.halvesGameId)})
  )
) result;
`);
  const resolverRows = participationResolverRows(context);
  return {
    ...counts,
    activeParticipation: unresolvedParticipationStarts(
      resolverRows,
      resolverRows[0]?.period_format || "quarters",
    ).length,
  };
}

async function cleanup(context) {
  let firstError = null;
  const attempt = async (callback) => {
    try {
      await callback();
    } catch (error) {
      firstError ||= error;
    }
  };
  await attempt(() => revokeTokens(context));
  await attempt(() => tombstoneActiveEvents(context));
  await attempt(() => closeResidualParticipation(context));
  await attempt(async () => {
    databaseQuery(`
delete from public.lh_game_clock_states
where game_id in (${sqlLiteral(context.fixture.ids.game)}, ${sqlLiteral(context.halvesGameId)})
returning game_id;
`);
  });
  await attempt(async () => {
    databaseQuery(revokeFixtureGrantsSafelySql(context));
    context.grantsRevoked = true;
  });
  await attempt(() => deleteAuthUsers(context));
  await attempt(async () => {
    databaseQuery(removeMutableFixtureSql(context.fixture, context.adminId, context.coachId));
  });
  const authority = await oldAuthorityProof(context);
  const counts = cleanupCounts(context);
  const proof = { ...counts, ...authority, realDataTouched: false };
  assertCleanupProof(proof);
  if (firstError) throw firstError;
  return proof;
}

function sanitizeSummary(summary) {
  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, forbiddenSecretPattern, "sanitized evidence contains a credential");
  assert.doesNotMatch(serialized, /shareCode|access_token|refresh_token|api_key/i, "sanitized evidence names credential fields");
  return summary;
}

export async function runProductionDisclosureSmoke(argv = process.argv.slice(2)) {
  const approvedToolingSha = parseApprovedToolingSha(argv);
  const tooling = verifyToolingAndDeployment(approvedToolingSha);
  const hostedAssets = await verifyHostedAssets();
  const initial = {
    ...prewriteDatabaseState(),
    hostedAssetsMatch: hostedAssets.every((item) => item.matches),
    toolingAbsentFromDeployment: tooling.toolingAbsentFromDeployment,
  };
  assertPrewriteState(initial);
  const keys = apiKeys();
  const fixture = createFixtureDescriptor();
  const password = `V284-${randomBytes(18).toString("base64url")}!`;
  const context = {
    apiUrl: PRODUCTION_API_URL,
    publishableKey: keys.publishable,
    serviceRoleKey: keys.serviceRole,
    fixture,
    halvesGameId: `${fixture.runId}-halves-game`,
    grantsRevoked: false,
    createOrdinaryEvents: false,
    databaseQuery: async (sql) => databaseQuery(sql),
  };
  let operationError = null;
  let result = null;
  let cleanupProof = null;
  try {
    context.adminId = await createAuthUser(
      context.apiUrl,
      context.publishableKey,
      context.serviceRoleKey,
      fixture,
      "admin",
      password,
    );
    context.coachId = await createAuthUser(
      context.apiUrl,
      context.publishableKey,
      context.serviceRoleKey,
      fixture,
      "coach",
      password,
    );
    const lifecycle = makeLifecycleRecords(fixture, context.adminId, context.coachId);
    databaseQuery(productionSeedSql(fixture, context.adminId, context.coachId, lifecycle));
    databaseQuery(`
insert into public.lh_game_scopes(
  game_id, team_id, roster_player_id, opponent_snapshot, game_date_snapshot,
  period_format_snapshot, final_score_for, final_score_against
) values (
  ${sqlLiteral(context.halvesGameId)},
  ${sqlLiteral(fixture.ids.team)},
  ${sqlLiteral(fixture.ids.player)},
  'V284 Synthetic Halves Opponent',
  date '2026-07-28',
  'halves',
  0,
  0
);
`);
    context.coachSession = await signIn(
      context.apiUrl,
      context.publishableKey,
      fixture.coachEmail,
      password,
    );
    context.disclosure = await createPrivateAndPublicEvidence(context);
    const clocks = await exerciseClockFormats(context);
    const participationClosure = await closeActiveParticipation(context);
    const adversarial = await runAdversarialRpcChecks(context);
    const browser = await verifyHostedReconciliation(context);
    const api = await verifyApiDisclosure(context, context.disclosure);
    result = { clocks, participationClosure, adversarial, api, browser };
  } catch (error) {
    operationError = error;
  } finally {
    try {
      if (context.adminId && context.coachId) cleanupProof = await cleanup(context);
      else await deleteAuthUsers(context);
    } catch (cleanupError) {
      throw new Error(`PRODUCTION CLEANUP FAILED: ${cleanupError.message}`, { cause: cleanupError });
    }
  }
  if (operationError) throw operationError;
  assert.ok(result && cleanupProof, "production smoke did not produce complete evidence");
  assert.ok(cleanupProof.retainedEventOperations >= 7, "successful smoke retained too few Event Pipeline operations");
  assert.ok(cleanupProof.retainedParticipationOperations >= 9, "successful smoke retained too few participation operations");
  assert.equal(cleanupProof.retainedLifecycleEvents, 6, "successful smoke lifecycle history count mismatch");
  assert.equal(cleanupProof.retainedGameScopes, 2, "successful smoke game-scope history count mismatch");
  const summary = sanitizeSummary({
    status: "PASS",
    environment: "production",
    syntheticAdultFixture: true,
    approvedApplicationSha: APPROVED_APPLICATION_SHA,
    approvedToolingSha,
    productionOrigin: PRODUCTION_ORIGIN,
    correctiveMigrationVersion: CORRECTIVE_MIGRATION_VERSION,
    prewrite: initial,
    hostedAssets,
    smoke: result,
    cleanup: cleanupProof,
    retainedHistory: {
      eventOperations: cleanupProof.retainedEventOperations,
      participationOperations: cleanupProof.retainedParticipationOperations,
      grantLifecycleEvents: cleanupProof.retainedLifecycleEvents,
      gameScopes: cleanupProof.retainedGameScopes,
      inert: true,
      private: true,
      synthetic: true,
    },
    secretsEmitted: false,
    realDataTouched: false,
  });
  fs.mkdirSync(PRODUCTION_EVIDENCE_DIR, { recursive: true });
  const evidencePath = path.join(PRODUCTION_EVIDENCE_DIR, "production-smoke-results.json");
  fs.writeFileSync(evidencePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return { summary, evidencePath };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runProductionDisclosureSmoke()
    .then(({ summary, evidencePath }) => {
      process.stdout.write(`${JSON.stringify({
        status: summary.status,
        approvedApplicationSha: summary.approvedApplicationSha,
        approvedToolingSha: summary.approvedToolingSha,
        publicEventCount: summary.smoke.browser.publicPayload.eventCount,
        cleanup: summary.cleanup,
        evidencePath,
      }, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`FAIL ${error.message}\n`);
      process.exitCode = 1;
    });
}
