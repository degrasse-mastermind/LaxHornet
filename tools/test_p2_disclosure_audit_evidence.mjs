import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.argv[2] || path.join(scriptDir, ".."));
const moduleSpecifier = process.env.PGLITE_MODULE_PATH
  ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href
  : "@electric-sql/pglite";
const { PGlite } = await import(moduleSpecifier);

const migrationNames = [
  "20260723000000_laxhornet_legacy_baseline.sql",
  "20260723010000_trust_spine_release_1.sql",
  "20260723020000_minimum_necessary_disclosure.sql",
  "20260723030000_fix_disclosure_audit_and_evidence_validation.sql",
];
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const migrations = migrationNames.map((name) => {
  const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8");
  return name.includes("trust_spine_release_1")
    ? sql.replace(
        /^create extension if not exists pgcrypto with schema extensions;\s*$/im,
        "-- PGlite compatibility harness supplies extensions.digest below.",
      )
    : sql;
});

const users = {
  teamAdmin: "11111111-1111-4111-8111-111111111111",
  teamCoach: "22222222-2222-4222-8222-222222222222",
  playerParent: "33333333-3333-4333-8333-333333333333",
  playerCoach: "44444444-4444-4444-8444-444444444444",
  otherParent: "55555555-5555-4555-8555-555555555555",
  otherCoach: "66666666-6666-4666-8666-666666666666",
  crossTeamCoach: "77777777-7777-4777-8777-777777777777",
  expiredParent: "88888888-8888-4888-8888-888888888888",
  revokedParent: "99999999-9999-4999-8999-999999999999",
  unassigned: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  crossTeamAdmin: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

const db = new PGlite();
const results = [];

function pass(name, evidence = {}) {
  results.push({ name, status: "pass", evidence });
  console.log(`PASS: ${name} ${JSON.stringify(evidence)}`);
}

function assert(condition, name, evidence = {}) {
  if (!condition) {
    throw new Error(`${name}\n${JSON.stringify(evidence, null, 2)}`);
  }
  pass(name, evidence);
}

async function one(sql, params = []) {
  const query = await db.query(sql, params);
  return query.rows[0];
}

async function setActor(userId, role = "authenticated") {
  await db.exec("reset role;");
  await db.query(
    "select pg_catalog.set_config('request.jwt.claims', $1, false)",
    [userId ? JSON.stringify({ sub: userId }) : "{}"],
  );
  await db.exec(`set role ${role};`);
}

async function asActor(userId, callback, role = "authenticated") {
  await setActor(userId, role);
  try {
    return await callback();
  } finally {
    await db.exec("reset role;");
    await db.query(
      "select pg_catalog.set_config('request.jwt.claims', '{}', false)",
    );
  }
}

function invitationGrant({
  id,
  userId,
  role,
  scopeType,
  teamId,
  rosterPlayerId = null,
  issuerUserId,
  issuerGrantId,
  expiresSql = "null",
  revoked = false,
}) {
  const playerSql = rosterPlayerId ? `'${rosterPlayerId}'` : "null";
  return `
    insert into public.lh_access_invitations(
      id,
      invited_user_id,
      invited_email,
      role,
      scope_type,
      team_id,
      roster_player_id,
      invited_by_user_id,
      invited_by_grant_id,
      status,
      accepted_at
    )
    values (
      '${id}-invite',
      '${userId}'::uuid,
      '${id}@example.invalid',
      '${role}',
      '${scopeType}',
      '${teamId}',
      ${playerSql},
      '${issuerUserId}'::uuid,
      '${issuerGrantId}',
      'accepted',
      pg_catalog.now() - interval '2 hours'
    );

    insert into public.lh_access_grants(
      id,
      user_id,
      role,
      scope_type,
      team_id,
      roster_player_id,
      provenance_type,
      invitation_id,
      issued_by_user_id,
      issued_by_grant_id,
      issued_at,
      expires_at
    )
    values (
      '${id}',
      '${userId}'::uuid,
      '${role}',
      '${scopeType}',
      '${teamId}',
      ${playerSql},
      'invitation',
      '${id}-invite',
      '${issuerUserId}'::uuid,
      '${issuerGrantId}',
      pg_catalog.now() - interval '2 hours',
      ${expiresSql}
    );

    insert into public.lh_grant_lifecycle_events(
      id,
      grant_id,
      sequence,
      event_type,
      actor_user_id,
      actor_grant_id,
      occurred_at
    )
    values
      (
        '${id}-issued',
        '${id}',
        1,
        'issued',
        '${issuerUserId}'::uuid,
        '${issuerGrantId}',
        pg_catalog.now() - interval '2 hours'
      ),
      (
        '${id}-accepted',
        '${id}',
        2,
        'accepted',
        '${userId}'::uuid,
        null,
        pg_catalog.now() - interval '119 minutes'
      )
      ${
        revoked
          ? `,
      (
        '${id}-revoked',
        '${id}',
        3,
        'revoked',
        '${issuerUserId}'::uuid,
        '${issuerGrantId}',
        pg_catalog.now() - interval '1 minute'
      )`
          : ""
      };
  `;
}

async function bootstrap() {
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
        (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
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
    create or replace function extensions.digest(value bytea, algorithm text)
    returns bytea
    language sql
    immutable
    strict
    as $$
      select value
    $$;
    grant usage on schema auth, extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
    grant execute on function extensions.digest(bytea, text) to anon, authenticated;
    create publication supabase_realtime;
  `);

  for (const migration of migrations) {
    await db.exec(migration);
  }
}

async function seedScopesAndGrants() {
  await db.exec(`
    insert into public.lh_team_scopes(team_id, team_name_snapshot)
    values
      ('team-a', 'Demo Team A'),
      ('team-b', 'Demo Team B');

    insert into public.lh_player_scopes(
      team_id,
      roster_player_id,
      player_name_snapshot,
      jersey_snapshot,
      position_snapshot
    )
    values
      ('team-a', 'player-a', 'Demo Player A', '12', 'Midfield'),
      ('team-a', 'player-b', 'Demo Player B', '24', 'Attack'),
      ('team-b', 'player-c', 'Demo Player C', '36', 'Defense');

    insert into public.lh_game_scopes(
      game_id,
      team_id,
      roster_player_id,
      opponent_snapshot,
      game_date_snapshot,
      period_format_snapshot
    )
    values (
      'game-a',
      'team-a',
      'player-a',
      'Synthetic Opponent',
      date '2026-07-23',
      'quarters'
    );

    insert into public.lh_access_grants(
      id,
      user_id,
      role,
      scope_type,
      team_id,
      provenance_type,
      issued_by_user_id,
      issued_at
    )
    values
      (
        'admin-a',
        '${users.teamAdmin}'::uuid,
        'team_admin',
        'team',
        'team-a',
        'system_bootstrap',
        '${users.teamAdmin}'::uuid,
        pg_catalog.now() - interval '4 hours'
      ),
      (
        'admin-b',
        '${users.crossTeamAdmin}'::uuid,
        'team_admin',
        'team',
        'team-b',
        'system_bootstrap',
        '${users.crossTeamAdmin}'::uuid,
        pg_catalog.now() - interval '4 hours'
      );

    insert into public.lh_grant_lifecycle_events(
      id,
      grant_id,
      sequence,
      event_type,
      actor_user_id,
      occurred_at
    )
    values
      ('admin-a-issued', 'admin-a', 1, 'issued', '${users.teamAdmin}'::uuid, pg_catalog.now() - interval '4 hours'),
      ('admin-a-accepted', 'admin-a', 2, 'accepted', '${users.teamAdmin}'::uuid, pg_catalog.now() - interval '239 minutes'),
      ('admin-b-issued', 'admin-b', 1, 'issued', '${users.crossTeamAdmin}'::uuid, pg_catalog.now() - interval '4 hours'),
      ('admin-b-accepted', 'admin-b', 2, 'accepted', '${users.crossTeamAdmin}'::uuid, pg_catalog.now() - interval '239 minutes');
  `);

  const grants = [
    {
      id: "coach-team-a",
      userId: users.teamCoach,
      role: "coach",
      scopeType: "team",
      teamId: "team-a",
      issuerUserId: users.teamAdmin,
      issuerGrantId: "admin-a",
    },
    {
      id: "parent-player-a",
      userId: users.playerParent,
      role: "parent",
      scopeType: "player",
      teamId: "team-a",
      rosterPlayerId: "player-a",
      issuerUserId: users.teamAdmin,
      issuerGrantId: "admin-a",
    },
    {
      id: "coach-player-a",
      userId: users.playerCoach,
      role: "coach",
      scopeType: "player",
      teamId: "team-a",
      rosterPlayerId: "player-a",
      issuerUserId: users.teamAdmin,
      issuerGrantId: "admin-a",
    },
    {
      id: "parent-player-b",
      userId: users.otherParent,
      role: "parent",
      scopeType: "player",
      teamId: "team-a",
      rosterPlayerId: "player-b",
      issuerUserId: users.teamAdmin,
      issuerGrantId: "admin-a",
    },
    {
      id: "coach-player-b",
      userId: users.otherCoach,
      role: "coach",
      scopeType: "player",
      teamId: "team-a",
      rosterPlayerId: "player-b",
      issuerUserId: users.teamAdmin,
      issuerGrantId: "admin-a",
    },
    {
      id: "coach-team-b",
      userId: users.crossTeamCoach,
      role: "coach",
      scopeType: "team",
      teamId: "team-b",
      issuerUserId: users.crossTeamAdmin,
      issuerGrantId: "admin-b",
    },
    {
      id: "expired-parent-player-a",
      userId: users.expiredParent,
      role: "parent",
      scopeType: "player",
      teamId: "team-a",
      rosterPlayerId: "player-a",
      issuerUserId: users.teamAdmin,
      issuerGrantId: "admin-a",
      expiresSql: "pg_catalog.now() - interval '1 minute'",
    },
    {
      id: "revoked-parent-player-a",
      userId: users.revokedParent,
      role: "parent",
      scopeType: "player",
      teamId: "team-a",
      rosterPlayerId: "player-a",
      issuerUserId: users.teamAdmin,
      issuerGrantId: "admin-a",
      revoked: true,
    },
  ];

  for (const grant of grants) {
    await db.exec(invitationGrant(grant));
  }
}

async function auditPlayer(userId, playerId = "player-a") {
  return asActor(userId, async () => {
    const row = await one(
      "select public.lh_record_disclosure_export('player_csv', 'player', $1, 'accepted') as result",
      [playerId],
    );
    return row.result;
  });
}

async function createEvent(userId, operation) {
  return asActor(userId, async () => {
    const row = await one(
      "select public.lh_create_event($1::jsonb) as result",
      [JSON.stringify(operation)],
    );
    return row.result;
  });
}

async function correctEvent(userId, operation) {
  return asActor(userId, async () => {
    const row = await one(
      "select public.lh_correct_event($1::jsonb) as result",
      [JSON.stringify(operation)],
    );
    return row.result;
  });
}

try {
  await bootstrap();
  await seedScopesAndGrants();

  const acceptedCases = [
    ["player-scoped parent for selected player", users.playerParent, "parent-player-a"],
    ["player-scoped coach for selected player", users.playerCoach, "coach-player-a"],
    ["team-scoped coach covering selected player's team", users.teamCoach, "coach-team-a"],
    ["team admin covering selected player's team", users.teamAdmin, "admin-a"],
  ];
  for (const [label, userId, expectedGrant] of acceptedCases) {
    const result = await auditPlayer(userId);
    assert(
      result?.outcome === "accepted",
      `${label}: accepted`,
      result,
    );
    const audit = await one(
      "select actor_grant_id, team_id, roster_player_id from public.lh_security_audit_events where audit_id = $1",
      [result.auditId],
    );
    assert(
      audit.actor_grant_id === expectedGrant &&
        audit.team_id === "team-a" &&
        audit.roster_player_id === "player-a",
      `${label}: canonical player scope and deterministic covering grant recorded`,
      audit,
    );
  }

  const rejectedCases = [
    ["parent assigned to another player", users.otherParent],
    ["player-scoped coach assigned to another player", users.otherCoach],
    ["team-scoped coach from another team", users.crossTeamCoach],
    ["expired grant", users.expiredParent],
    ["revoked grant", users.revokedParent],
    ["unassigned authenticated user", users.unassigned],
  ];
  for (const [label, userId] of rejectedCases) {
    const result = await auditPlayer(userId);
    assert(
      result?.outcome === "rejected" &&
        result?.code === "unauthorized_scope",
      `${label}: rejected`,
      result,
    );
  }

  const unknownPlayer = await auditPlayer(users.playerParent, "unknown-player");
  assert(
    unknownPlayer?.outcome === "rejected" &&
      unknownPlayer?.code === "unauthorized_scope",
    "unknown canonical player scope: rejected",
    unknownPlayer,
  );

  let anonymousError = null;
  try {
    await asActor(null, async () => {
      await one(
        "select public.lh_record_disclosure_export('player_csv', 'player', 'player-a', 'accepted') as result",
      );
    }, "anon");
  } catch (error) {
    anonymousError = error;
  }
  assert(
    anonymousError && /permission denied/i.test(String(anonymousError)),
    "anonymous user: rejected at RPC privilege boundary",
    { error: String(anonymousError).split("\n")[0] },
  );

  const validEvidence = {
    occurred_at: "2026-07-23T18:00:00Z",
    period: "Q1",
    stat_type: "groundBall",
    stat_label: "Ground Ball",
    category: "Possession",
    point_value: 2,
    field_zone: "Midfield",
  };
  const malformedCreates = [
    [
      "SQL-null evidence",
      {
        client_operation_id: "bad-create-missing",
        event_id: "bad-create-missing",
        game_id: "game-a",
      },
    ],
    [
      "JSON null evidence",
      {
        client_operation_id: "bad-create-json-null",
        event_id: "bad-create-json-null",
        game_id: "game-a",
        evidence: null,
      },
    ],
    [
      "array evidence",
      {
        client_operation_id: "bad-create-array",
        event_id: "bad-create-array",
        game_id: "game-a",
        evidence: [],
      },
    ],
    [
      "scalar evidence",
      {
        client_operation_id: "bad-create-scalar",
        event_id: "bad-create-scalar",
        game_id: "game-a",
        evidence: "not-an-object",
      },
    ],
  ];
  for (const [label, operation] of malformedCreates) {
    const result = await createEvent(users.playerParent, operation);
    assert(
      result?.outcome === "rejected" && result?.code === "invalid_input",
      `create event with ${label}: controlled rejection`,
      result,
    );
  }

  const validCreate = await createEvent(users.playerParent, {
    client_operation_id: "valid-create",
    event_id: "valid-event",
    game_id: "game-a",
    evidence: validEvidence,
  });
  assert(
    validCreate?.outcome === "accepted" &&
      validCreate?.code === "created" &&
      validCreate?.serverEventVersion === 1,
    "valid create behavior remains accepted",
    validCreate,
  );

  const malformedCorrections = [
    [
      "SQL-null changes",
      {
        client_operation_id: "bad-correct-missing",
        event_id: "valid-event",
        game_id: "game-a",
        base_server_event_version: 1,
      },
    ],
    [
      "JSON null changes",
      {
        client_operation_id: "bad-correct-json-null",
        event_id: "valid-event",
        game_id: "game-a",
        base_server_event_version: 1,
        changes: null,
      },
    ],
    [
      "array changes",
      {
        client_operation_id: "bad-correct-array",
        event_id: "valid-event",
        game_id: "game-a",
        base_server_event_version: 1,
        changes: [],
      },
    ],
  ];
  for (const [label, operation] of malformedCorrections) {
    const result = await correctEvent(users.playerParent, operation);
    assert(
      result?.outcome === "rejected" && result?.code === "invalid_input",
      `correction with ${label}: controlled rejection`,
      result,
    );
  }

  const malformedEffects = await one(`
    select
      (select count(*)::int from public.lh_events where event_id like 'bad-create-%') as malformed_events,
      (select count(*)::int from public.lh_event_revisions where event_id = 'valid-event') as malformed_revisions,
      (
        select count(*)::int
        from public.lh_event_operations
        where outcome_class = 'rejected'
          and outcome_code = 'invalid_input'
          and client_operation_id like 'bad-%'
      ) as rejected_operations,
      (
        select server_event_version
        from public.lh_event_effective_versions
        where event_id = 'valid-event'
      ) as effective_version,
      (
        select effective_evidence
        from public.lh_event_effective_versions
        where event_id = 'valid-event'
      ) as effective_evidence
  `);
  assert(
    malformedEffects.malformed_events === 0 &&
      malformedEffects.malformed_revisions === 0 &&
      malformedEffects.rejected_operations === 7,
    "malformed requests create no event or revision and record rejected operations",
    malformedEffects,
  );
  assert(
    malformedEffects.effective_version === 1 &&
      malformedEffects.effective_evidence?.occurred_at ===
        validEvidence.occurred_at &&
      malformedEffects.effective_evidence?.period === validEvidence.period &&
      malformedEffects.effective_evidence?.stat_type ===
        validEvidence.stat_type &&
      malformedEffects.effective_evidence?.stat_label ===
        validEvidence.stat_label &&
      malformedEffects.effective_evidence?.category ===
        validEvidence.category &&
      malformedEffects.effective_evidence?.point_value ===
        validEvidence.point_value &&
      malformedEffects.effective_evidence?.field_zone ===
        validEvidence.field_zone,
    "malformed correction leaves the effective event unchanged",
    {
      effectiveVersion: malformedEffects.effective_version,
      effectiveEvidence: malformedEffects.effective_evidence,
    },
  );

  const validCorrection = await correctEvent(users.playerParent, {
    client_operation_id: "valid-correction",
    event_id: "valid-event",
    game_id: "game-a",
    base_server_event_version: 1,
    changes: { period: "Q2" },
    correction_reason: "Synthetic regression check",
  });
  assert(
    validCorrection?.outcome === "accepted" &&
      validCorrection?.code === "corrected" &&
      validCorrection?.serverEventVersion === 2,
    "valid correction behavior remains accepted",
    validCorrection,
  );

  const finalState = await one(`
    select
      effective.server_event_version,
      effective.effective_evidence ->> 'period' as period,
      (select count(*)::int from public.lh_event_revisions where event_id = 'valid-event') as revisions
    from public.lh_event_effective_versions as effective
    where effective.event_id = 'valid-event'
  `);
  assert(
    finalState.server_event_version === 2 &&
      finalState.period === "Q2" &&
      finalState.revisions === 1,
    "valid correction updates the effective event and records one revision",
    finalState,
  );

  console.log(JSON.stringify({
    suite: "LaxHornet PR #9 P2 disclosure audit and evidence validation",
    synthetic: true,
    migrations: migrationNames,
    testsPassed: results.length,
    results,
  }, null, 2));
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
} finally {
  await db.close();
}
