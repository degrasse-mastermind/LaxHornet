import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  R206_API_URL,
  R206_APPLICATION_ORIGIN,
  R206_CACHE_NAME,
  R206_MIGRATION_VERSIONS,
  R206_PAGES_RUN_ID,
  R206_PROJECT_REF,
  R206_RELEASE_MARKER,
  R206_RUNTIME_SHA,
  R206StopError,
  assertPublicEvidenceSafe,
  sha256,
} from "./r206_synthetic_runner_core.mjs";

const ACCOUNT_CLAIMS = (accountId) =>
  JSON.stringify({
    sub: accountId,
    role: "authenticated",
    email: "synthetic@example.invalid",
  }).replaceAll("'", "''");

async function asAccount(db, accountId, sql, params = []) {
  await db.exec("reset role");
  await db.exec(
    `select set_config('request.jwt.claims', '${ACCOUNT_CLAIMS(accountId)}', false)`,
  );
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function asAnon(db, sql, params = []) {
  await db.exec("reset role");
  await db.exec("select set_config('request.jwt.claims', '{}', false)");
  await db.exec("set role anon");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

function markdown(title, value) {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
}

export async function createDisposableAdapter({
  repoRoot,
  privateEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-private-")),
  publicEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "laxhornet-r206-public-")),
} = {}) {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const credentials = new Map();
  const sessions = new Map();
  const browserProfiles = new Set();
  const migrations = path.join(repoRoot, "supabase", "migrations");
  const baseline = fs.readFileSync(
    path.join(migrations, "20260723000000_laxhornet_legacy_baseline.sql"),
    "utf8",
  );
  const tombstones = fs.readFileSync(
    path.join(migrations, "20260730134439_durable_game_tombstones.sql"),
    "utf8",
  );
  const concurrency = fs.readFileSync(
    path.join(migrations, "20260730151714_durable_game_tombstone_concurrency.sql"),
    "utf8",
  );
  const ledgerPath = path.join(privateEvidenceDir, "R2-06_RETAINED_IDENTIFIERS.json");
  let privateLedgerInitialized = false;

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema extensions;
    create table auth.users(
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(
        nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
        ''
      )::uuid
    $$;
    create or replace function auth.jwt()
    returns jsonb
    language sql
    stable
    as $$
      select coalesce(
        nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
      )
    $$;
    grant usage on schema auth, extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(baseline);
  await db.exec(`
    create table if not exists public.lh_live_share_tokens (
      token_id uuid primary key default gen_random_uuid(),
      game_id text not null references public.games(id) on delete cascade
    );
    alter table public.lh_live_share_tokens enable row level security;
    grant select on public.lh_live_share_tokens to anon, authenticated;
  `);
  await db.exec(tombstones);
  await db.exec(concurrency);
  await db.exec(`
    grant execute on function public.laxhornet_can_track_roster_player(text, text)
      to anon, authenticated;
  `);

  const exactCounts = async (ledger) => {
    const ids = [...ledger.users.values()].map((item) => `'${item.id}'::uuid`);
    const userClause = ids.length ? ids.join(",") : "null::uuid";
    const result = await db.query(`
      select
        (select count(*)::int from auth.users where id in (${userClause})) as auth_users,
        (select count(*)::int from public.user_profiles where user_id in (${userClause})) as profiles,
        (select count(*)::int from public.games where id = $1) as games,
        (select count(*)::int from public.events where game_id = $1) as events,
        (select count(*)::int from public.lh_live_share_tokens where game_id = $1) as live_share_tokens,
        (select count(*)::int from public.legacy_game_tombstones where game_id = $1) as tombstones
    `, [ledger.game.id]);
    const row = result.rows[0];
    return {
      authUsers: row.auth_users,
      profiles: row.profiles,
      games: row.games,
      events: row.events,
      liveShareTokens: row.live_share_tokens,
      tombstones: row.tombstones,
      sessions: [...sessions.values()].filter((session) => !session.revoked).length,
      operations: 0,
    };
  };

  const callRpc = async (accountId, name, payload) => {
    const parameter = name === "laxhornet_sync_game" ? "p_operation" : "p_deletion";
    const result = await asAccount(
      db,
      accountId,
      `select public.${name}($1::jsonb) as result`,
      [payload[parameter]],
    );
    return result.rows[0].result;
  };

  return {
    async preflight() {
      const counts = await db.query(`
        select
          (select count(*)::int from public.legacy_game_tombstones) as tombstones,
          (select count(*)::int from auth.users where email like 'r206-smoke-%') as auth_users,
          (select count(*)::int from public.user_profiles where email like 'r206-smoke-%') as profiles,
          (select count(*)::int from public.games where id like 'r206-smoke-%') as games,
          (select count(*)::int from public.events where game_id like 'r206-smoke-%') as events,
          (select count(*)::int from public.lh_live_share_tokens where game_id like 'r206-smoke-%') as tokens
      `);
      const row = counts.rows[0];
      return {
        projectRef: R206_PROJECT_REF,
        apiUrl: R206_API_URL,
        applicationOrigin: R206_APPLICATION_ORIGIN,
        runtimeSourceSha: R206_RUNTIME_SHA,
        pagesRunId: R206_PAGES_RUN_ID,
        releaseMarker: R206_RELEASE_MARKER,
        cacheName: R206_CACHE_NAME,
        migrationVersions: [...R206_MIGRATION_VERSIONS],
        unexpectedMigrations: 0,
        pendingMigrations: 0,
        catalogMatches: true,
        rlsMatches: true,
        grantsMatch: true,
        rpcsMatch: true,
        triggerMatches: true,
        lockOrderingMatches: true,
        startingTombstones: row.tombstones,
        startingResidue: {
          authUsers: row.auth_users,
          profiles: row.profiles,
          sessions: 0,
          games: row.games,
          events: row.events,
          tombstones: row.tombstones,
          liveShareTokens: row.tokens,
        },
      };
    },

    async createSyntheticUser(alias, identity) {
      const id = randomUUID();
      await db.query(
        `insert into auth.users(id, email, raw_user_meta_data)
         values ($1::uuid, $2, $3::jsonb)`,
        [
          id,
          identity.email,
          {
            first_name: identity.firstName,
            last_name: identity.lastName,
            phone: "",
            child_jersey_number: "",
          },
        ],
      );
      credentials.set(alias, {
        id,
        email: identity.email,
        password: identity.password,
      });
      return { id };
    },

    async verifyProfiles(ledger) {
      const ids = [...ledger.users.values()].map((item) => `'${item.id}'::uuid`).join(",");
      const result = await db.query(
        `select count(*)::int as count from public.user_profiles where user_id in (${ids})`,
      );
      return result.rows[0].count;
    },

    async signInSyntheticUser(alias, identity, options = {}) {
      const userAlias = alias.startsWith("challenger") ? "challenger_user" : "owner_user";
      const expected = credentials.get(userAlias);
      if (
        !expected
        || expected.email !== identity.email
        || expected.password !== identity.password
        || expected.id !== options.expectedPrincipalId
      ) {
        throw new R206StopError("disposable Auth rejected the synthetic credential", {
          code: "DISPOSABLE_AUTH_REJECTED",
        });
      }
      const session = {
        sessionId: randomUUID(),
        accessToken: `disposable-access-${randomUUID()}`,
        refreshToken: `disposable-refresh-${randomUUID()}`,
        accountId: expected.id,
        revoked: false,
      };
      if (alias === "challenger_initial" || alias === "owner_hydration") {
        const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), `laxhornet-${alias}-`));
        browserProfiles.add(path.resolve(profilePath));
        session.browserProfilePath = profilePath;
        session.browserSessionEvidence = {
          sessionConfirmed: true,
          sessionIdentityConfirmed: true,
          persistenceConfirmed: true,
          applicationBootstrapConfirmed: true,
          protectedCapabilityConfirmed: true,
          authenticatedUiMarkerObserved: true,
          authenticatedUiMarkerElapsedMilliseconds: 0,
          authenticatedUiMarkerType: "sign_out_action",
          uiMarkerAbsenceAffectedExecution: false,
          reloadAttempted: false,
        };
      }
      sessions.set(alias, session);
      return { ...session };
    },

    async guardedCreate({ session, operation, ledger }) {
      const result = await callRpc(session.accountId, "laxhornet_sync_game", {
        p_operation: operation,
      });
      const counts = await exactCounts(ledger);
      if (
        counts.games !== 1
        || counts.events !== 0
        || counts.liveShareTokens !== 0
        || counts.tombstones !== 0
      ) {
        throw new R206StopError(
          `disposable guarded create exceeded its scope (${JSON.stringify({
            outcome: result?.outcome,
            code: result?.code,
            counts,
          })})`,
          {
          code: "CREATE_RECORD_BOUNDARY_VIOLATION",
          },
        );
      }
      return result;
    },

    async verifyDenials({ challengerSession, ledger, scope }) {
      const ownerId = ledger.users.get("owner_user").id;
      const challengerRead = await asAccount(
        db,
        challengerSession.accountId,
        "select count(*)::int as count from public.games where id = $1",
        [ledger.game.id],
      );
      const anonymousRead = await asAnon(
        db,
        "select count(*)::int as count from public.games where id = $1",
        [ledger.game.id],
      );
      const challengerDelete = await callRpc(
        challengerSession.accountId,
        "laxhornet_delete_game_durable",
        {
          p_deletion: {
            game_id: ledger.game.id,
            account_id: challengerSession.accountId,
            deletion_id: scope.game.deletionB,
            device_id: scope.game.deviceId,
            deleted_at: scope.createdAt,
            known_game_saved_at: null,
          },
        },
      );
      let directMutationRejected = false;
      try {
        const result = await asAccount(
          db,
          challengerSession.accountId,
          "update public.games set opponent = 'r206-smoke-denial' where id = $1 returning id",
          [ledger.game.id],
        );
        directMutationRejected = result.rows.length === 0;
      } catch {
        directMutationRejected = true;
      }
      let directEventRejected = false;
      try {
        await asAccount(
          db,
          challengerSession.accountId,
          `insert into public.events(
            id, game_id, user_id, timestamp, quarter, stat_type, stat_label, category
          ) values ($1, $2, $3::uuid, now(), 'Q1', 'note', 'denial', 'other')`,
          [`${scope.prefix}-denial-event`, ledger.game.id, challengerSession.accountId],
        );
      } catch {
        directEventRejected = true;
      }
      const counts = await exactCounts(ledger);
      const allDenied =
        challengerRead.rows[0].count === 0
        && anonymousRead.rows[0].count === 0
        && challengerDelete.outcome === "rejected"
        && challengerDelete.code === "authorization_denied"
        && directMutationRejected
        && directEventRejected
        && counts.games === 1
        && counts.events === 0
        && counts.tombstones === 0
        && counts.liveShareTokens === 0
        && ownerId !== challengerSession.accountId;
      return {
        outcome: allDenied ? "verified" : "failed",
        code: allDenied ? "authorization_denials_verified" : "unauthorized_success",
        unauthorizedSuccess: !allDenied,
        disclosure: false,
      };
    },

    async guardedUpdate({ session, operation, ledger }) {
      const result = await callRpc(session.accountId, "laxhornet_sync_game", {
        p_operation: operation,
      });
      const counts = await exactCounts(ledger);
      const deleted = result.code === "game_deleted";
      if (
        counts.games !== (deleted ? 0 : 1)
        || counts.tombstones !== (deleted ? 1 : 0)
        || counts.events !== 0
        || counts.liveShareTokens !== 0
      ) {
        throw new R206StopError("disposable guarded update exceeded its scope", {
          code: "UPDATE_RECORD_BOUNDARY_VIOLATION",
        });
      }
      return result;
    },

    async durableDelete({ session, deletion, ledger }) {
      const result = await callRpc(session.accountId, "laxhornet_delete_game_durable", {
        p_deletion: deletion,
      });
      const counts = await exactCounts(ledger);
      const deleted = ["game_deleted", "game_delete_replayed", "game_already_deleted"]
        .includes(result.code);
      if (
        counts.games !== (deleted ? 0 : 1)
        || counts.tombstones !== (deleted ? 1 : 0)
        || counts.events !== 0
        || counts.liveShareTokens !== 0
      ) {
        throw new R206StopError("disposable durable delete exceeded its scope", {
          code: "DELETE_RECORD_BOUNDARY_VIOLATION",
        });
      }
      return result;
    },

    async verifyHydration({ session, ledger }) {
      const order = [];
      const tombstonesResult = await asAccount(
        db,
        session.accountId,
        "select game_id from public.legacy_game_tombstones where game_id = $1",
        [ledger.game.id],
      );
      order.push("tombstones");
      const gamesResult = await asAccount(
        db,
        session.accountId,
        "select id from public.games where id = $1",
        [ledger.game.id],
      );
      order.push("games");
      return {
        outcome: "verified",
        code: "clean_hydration_verified",
        gameVisible: gamesResult.rows.length > 0,
        rawPersistenceGameVisible: false,
        applicationStateGameVisible: gamesResult.rows.length > 0,
        renderedGameVisible: false,
        tombstoneBeforeMerge:
          order.indexOf("tombstones") < order.indexOf("games")
          && tombstonesResult.rows.length === 1,
        tombstoneSuppressionComplete:
          tombstonesResult.rows.length === 1 && gamesResult.rows.length === 0,
        retryStorm: false,
        resurrectionWriteRequests: 0,
        applicationConsoleErrors: 0,
        browserProfilePath: session.browserProfilePath,
      };
    },

    async verifyDisclosure({ challengerSession, ledger }) {
      const challenger = await asAccount(
        db,
        challengerSession.accountId,
        "select game_id from public.legacy_game_tombstones where game_id = $1",
        [ledger.game.id],
      );
      const anonymous = await asAnon(
        db,
        "select id from public.games where id = $1",
        [ledger.game.id],
      );
      const counts = await exactCounts(ledger);
      const disclosed =
        challenger.rows.length > 0
        || anonymous.rows.length > 0
        || counts.liveShareTokens > 0;
      return {
        outcome: disclosed ? "failed" : "verified",
        code: disclosed ? "synthetic_disclosure_detected" : "disclosure_absent",
        disclosed,
        liveShareTokens: counts.liveShareTokens,
      };
    },

    async persistPrivateLedger(snapshot) {
      fs.mkdirSync(privateEvidenceDir, { recursive: true });
      const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
      if (/password|access[_-]?token|refresh[_-]?token|api[_-]?key|service[_-]?role/i.test(serialized)) {
        throw new R206StopError("disposable private ledger contains a credential field", {
          code: "CREDENTIAL_EXPOSURE_DETECTED",
        });
      }
      if (!privateLedgerInitialized) {
        fs.writeFileSync(ledgerPath, serialized, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
        privateLedgerInitialized = true;
      } else {
        const temporary = `${ledgerPath}.tmp`;
        fs.writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o600 });
        fs.renameSync(temporary, ledgerPath);
      }
      const digest = createHash("sha256").update(serialized).digest("hex");
      return {
        path: ledgerPath,
        sha256: digest,
        opaqueReference: `r206-private-${digest.slice(0, 16)}`,
      };
    },

    async revokeSession(alias) {
      const session = sessions.get(alias);
      if (!session) {
        throw new R206StopError("disposable cleanup attempted an unknown session", {
          code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
        });
      }
      session.revoked = true;
    },

    async verifyRevokedAuthority(alias) {
      const session = sessions.get(alias);
      if (!session?.revoked) {
        throw new R206StopError("disposable session retained authority", {
          code: "SESSION_REVOCATION_INCOMPLETE",
        });
      }
      return true;
    },

    async deleteSyntheticUser(alias, user) {
      const expected = credentials.get(alias);
      if (!expected || expected.id !== user.id) {
        throw new R206StopError("disposable cleanup attempted an unknown user", {
          code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
        });
      }
      await db.query("delete from auth.users where id = $1::uuid", [user.id]);
      for (const session of sessions.values()) {
        if (session.accountId === user.id) session.revoked = true;
      }
      expected.password = null;
      expected.email = null;
    },

    async verifyProfilesRemoved(ledger) {
      const ids = [...ledger.users.values()].map((item) => `'${item.id}'::uuid`).join(",");
      const result = await db.query(
        `select count(*)::int as count from public.user_profiles where user_id in (${ids})`,
      );
      if (result.rows[0].count !== 0) {
        throw new R206StopError("disposable profile cascade did not complete", {
          code: "PROFILE_CASCADE_INCOMPLETE",
        });
      }
      return [...ledger.profiles.keys()];
    },

    async clearBrowserProfile(profilePath) {
      const resolved = path.resolve(profilePath);
      if (!browserProfiles.has(resolved)) {
        throw new R206StopError("disposable cleanup attempted an unknown browser profile", {
          code: "CLEANUP_LEDGER_OWNERSHIP_VIOLATION",
        });
      }
      fs.rmSync(resolved, { recursive: true, force: true });
      browserProfiles.delete(resolved);
    },

    async finalCounts(ledger) {
      return exactCounts(ledger);
    },

    async writePublicEvidence(bundle) {
      fs.mkdirSync(publicEvidenceDir, { recursive: true });
      const files = [
        ["SYNTHETIC_VERIFICATION_AUTHORIZATION.md", "Authorization", bundle.authorization],
        ["SYNTHETIC_VERIFICATION_RESULT.md", "Operation result", bundle.operations],
        ["SYNTHETIC_CLEANUP_RESULT.md", "Cleanup result", bundle.cleanup],
      ];
      const paths = [];
      const hashes = {};
      for (const [name, title, value] of files) {
        const content = markdown(title, value);
        assertPublicEvidenceSafe(content);
        const target = path.join(publicEvidenceDir, name);
        fs.writeFileSync(target, content, { encoding: "utf8", flag: "wx" });
        paths.push(target);
        hashes[name] = sha256(content);
      }
      return { paths, hashes };
    },

    async cleanupGameViaReviewedRpc({ ledger }) {
      const ownerSessionEntry = [...sessions.entries()].find(
        ([alias, session]) => alias.startsWith("owner") && !session.revoked,
      );
      if (!ownerSessionEntry) {
        throw new R206StopError("disposable owner session is unavailable for RPC cleanup", {
          code: "CLEANUP_GAME_RPC_UNAVAILABLE",
        });
      }
      const [, ownerSession] = ownerSessionEntry;
      return callRpc(ownerSession.accountId, "laxhornet_delete_game_durable", {
        p_deletion: {
          game_id: ledger.game.id,
          account_id: ownerSession.accountId,
          deletion_id: ledger.deletions.deletion_a,
          device_id: ledger.game.deviceId,
          deleted_at: new Date().toISOString(),
          known_game_saved_at: ledger.game.savedAtT2 || ledger.game.savedAtT1,
        },
      });
    },

    async close() {
      for (const profilePath of browserProfiles) {
        fs.rmSync(profilePath, { recursive: true, force: true });
      }
      browserProfiles.clear();
      for (const credential of credentials.values()) {
        credential.password = null;
        credential.email = null;
      }
      credentials.clear();
      sessions.clear();
      await db.close();
    },
  };
}
