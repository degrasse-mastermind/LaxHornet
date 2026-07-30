#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "review-evidence",
      "team-members-rls-remediation",
      "production-state-c-snapshot.json",
    ),
    "utf8",
  ),
);
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "migrations",
    "20260730004700_team_members_rls_recursion.sql",
  ),
  "utf8",
);
const finalAuthorizationTest = fs.readFileSync(
  path.join(root, "supabase", "tests", "team_members_rls_recursion.sql"),
  "utf8",
);
const reproductionTest = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "tests",
    "team_members_rls_recursion_reproduction.sql",
  ),
  "utf8",
);

const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(
  fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8"),
)?.[1];
assert.ok(projectId, "local Supabase project ID is unavailable");
const container = `supabase_db_${projectId}`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout ?? 180000,
    input: options.input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`,
    );
  }
  return result;
}

function psql(sql, { allowFailure = false } = {}) {
  return run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-A",
      "-t",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql, allowFailure, timeout: 60000 },
  );
}

function resetBeforeRemediation() {
  run(
    "supabase",
    ["db", "reset", "--local", "--version", "20260728193942"],
    { timeout: 240000 },
  );
}

function normalizedPolicyHash() {
  const result = psql(`
select pg_catalog.md5(
  pg_catalog.string_agg(
    policyname
      || '|' || permissive
      || '|' || roles::text
      || '|' || cmd
      || '|' || coalesce(
        pg_catalog.regexp_replace(qual, E'\\\\s+', '', 'g'),
        ''
      )
      || '|' || coalesce(
        pg_catalog.regexp_replace(with_check, E'\\\\s+', '', 'g'),
        ''
      ),
    pg_catalog.chr(10)
    order by policyname
  )
)
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'team_members';
`);
  return result.stdout.trim();
}

const productionEnvelopeSql = `
grant all privileges on table public.team_members
  to anon, authenticated, service_role;

alter function public.laxhornet_can_create_team()
  set search_path = public;
alter function public.laxhornet_is_platform_reviewer()
  set search_path = public;
alter function public.laxhornet_is_team_member(text)
  set search_path = public;
alter function public.laxhornet_is_team_member(text)
  set row_security = off;
alter function public.laxhornet_team_role(text)
  set search_path = public;
alter function public.laxhornet_team_role(text)
  set row_security = off;

revoke all on function public.laxhornet_can_create_team()
  from public, anon, authenticated, service_role;
revoke all on function public.laxhornet_is_platform_reviewer()
  from public, anon, authenticated, service_role;
revoke all on function public.laxhornet_is_team_member(text)
  from public, anon, authenticated, service_role;
revoke all on function public.laxhornet_team_role(text)
  from public, anon, authenticated, service_role;
grant execute on function public.laxhornet_can_create_team()
  to authenticated, service_role;
grant execute on function public.laxhornet_is_platform_reviewer()
  to authenticated, service_role;
grant execute on function public.laxhornet_is_team_member(text)
  to authenticated, service_role;
grant execute on function public.laxhornet_team_role(text)
  to authenticated, service_role;
`;

const stateBPolicySql = `
drop policy "laxhornet read team members" on public.team_members;
drop policy "laxhornet insert team members" on public.team_members;
drop policy "laxhornet update team members" on public.team_members;
drop policy "laxhornet delete team members" on public.team_members;

create policy "laxhornet read team members"
on public.team_members for select to authenticated
using (
  user_id = auth.uid()
  or public.laxhornet_is_team_member(team_id)
);

create policy "laxhornet insert team members"
on public.team_members for insert to authenticated
with check (
  user_id = auth.uid()
  and role = 'admin'
  and public.laxhornet_can_create_team()
  and exists (
    select 1
    from public.teams
    where teams.id = team_members.team_id
      and teams.created_by = auth.uid()
  )
);

create policy "laxhornet update team members"
on public.team_members for update to authenticated
using (public.laxhornet_team_role(team_id) = 'admin')
with check (public.laxhornet_team_role(team_id) = 'admin');

create policy "laxhornet delete team members"
on public.team_members for delete to authenticated
using (
  user_id = auth.uid()
  or public.laxhornet_team_role(team_id) = 'admin'
);
`;

const recursivePoliciesSql = reproductionTest.slice(
  reproductionTest.indexOf('create policy "team_members_select_team"'),
  reproductionTest.indexOf("insert into auth.users"),
);

const fixtureSource = finalAuthorizationTest.slice(
  finalAuthorizationTest.indexOf("insert into auth.users"),
  finalAuthorizationTest.indexOf("set local role authenticated"),
);
const malformedGrantAssertionStart = fixtureSource.indexOf(
  "select extensions.throws_ok(",
);
const lifecycleAfterMalformedGrant = fixtureSource.indexOf(
  "insert into public.lh_grant_lifecycle_events",
  malformedGrantAssertionStart,
);
assert.ok(
  malformedGrantAssertionStart > 0 &&
    lifecycleAfterMalformedGrant > malformedGrantAssertionStart,
  "unable to isolate the shared synthetic fixture",
);
const fixtureSql =
  fixtureSource.slice(0, malformedGrantAssertionStart) +
  fixtureSource.slice(lifecycleAfterMalformedGrant);

const actors = {
  anon: {
    role: "anon",
    claims: { role: "anon" },
  },
  reviewer: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000001",
      role: "authenticated",
      email: "degrassed@gmail.com",
    },
  },
  tracker: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000002",
      role: "authenticated",
      email: "tracker-a@example.test",
    },
  },
  member: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000003",
      role: "authenticated",
      email: "member-a@example.test",
    },
  },
  nonmember: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000005",
      role: "authenticated",
      email: "nonmember@example.test",
    },
  },
  parent: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000006",
      role: "authenticated",
      email: "parent@example.test",
    },
  },
  coach: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000007",
      role: "authenticated",
      email: "coach@example.test",
    },
  },
  revoked: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000008",
      role: "authenticated",
      email: "revoked@example.test",
    },
  },
  expired: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000009",
      role: "authenticated",
      email: "expired@example.test",
    },
  },
  grantAdmin: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000010",
      role: "authenticated",
      email: "grant-admin@example.test",
    },
  },
  pending: {
    role: "authenticated",
    claims: {
      sub: "30000000-0000-4000-8000-000000000011",
      role: "authenticated",
      email: "pending@example.test",
    },
  },
  service: {
    role: "service_role",
    claims: { role: "service_role" },
  },
};

const cases = [
  ["anonymous", "anon", "select count(*) from public.team_members"],
  ["own membership", "member", "select count(*) from public.team_members"],
  ["same-team member", "tracker", "select count(*) from public.team_members"],
  [
    "wrong team",
    "tracker",
    "select count(*) from public.team_members where team_id = 'rls-team-b'",
  ],
  ["non-member", "nonmember", "select count(*) from public.team_members"],
  ["parent grant only", "parent", "select count(*) from public.team_members"],
  ["coach grant only", "coach", "select count(*) from public.team_members"],
  [
    "team-admin grant only",
    "grantAdmin",
    "select count(*) from public.team_members",
  ],
  [
    "tracker membership",
    "tracker",
    "select count(*) from public.team_members where team_id = 'rls-team-a'",
  ],
  ["revoked grant", "revoked", "select count(*) from public.team_members"],
  ["expired grant", "expired", "select count(*) from public.team_members"],
  ["pending grant", "pending", "select count(*) from public.team_members"],
  [
    "self-removal",
    "member",
    "with changed as (delete from public.team_members where id = 'rls-member-member-a' returning 1) select count(*) from changed",
  ],
  [
    "insert another member",
    "tracker",
    "with changed as (insert into public.team_members(id, team_id, user_id, role) values ('rls-forbidden-insert', 'rls-team-a', '30000000-0000-4000-8000-000000000005', 'tracker') returning 1) select count(*) from changed",
  ],
  [
    "update another member",
    "tracker",
    "with changed as (update public.team_members set role = 'admin' where id = 'rls-member-member-a' returning 1) select count(*) from changed",
  ],
  [
    "delete another member",
    "tracker",
    "with changed as (delete from public.team_members where id = 'rls-member-member-a' returning 1) select count(*) from changed",
  ],
  [
    "platform-reviewer management",
    "reviewer",
    "with changed as (update public.team_members set role = 'member' where id = 'rls-member-tracker-a' returning 1) select count(*) from changed",
  ],
  [
    "service-role maintenance",
    "service",
    "with changed as (insert into public.team_members(id, team_id, user_id, role) values ('rls-service-maintenance', 'rls-team-b', '30000000-0000-4000-8000-000000000005', 'tracker') returning 1) select count(*) from changed",
  ],
];

function evaluateCase([name, actorName, statement]) {
  const actor = actors[actorName];
  const claims = JSON.stringify(actor.claims).replaceAll("'", "''");
  const result = psql(
    `\\set VERBOSITY verbose
begin;
set local role ${actor.role};
select pg_catalog.set_config('request.jwt.claims', '${claims}', true);
${statement};
rollback;
`,
    { allowFailure: true },
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const value =
    (result.stdout || "")
      .trim()
      .split(/\r?\n/)
      .filter((line) => /^\d+$/.test(line))
      .at(-1) ?? null;
  const sqlstate =
    /ERROR:\s+([0-9A-Z]{5}):/.exec(output)?.[1] ??
    (result.status === 0 ? "00000" : "UNKNOWN");
  return {
    case: name,
    actor: actorName,
    success: result.status === 0,
    result: value === null ? null : Number(value),
    sqlstate,
    recursion: sqlstate === "42P17",
  };
}

function prepareState(state) {
  resetBeforeRemediation();
  psql(productionEnvelopeSql);
  assert.equal(
    normalizedPolicyHash(),
    snapshot.policySet.orderedNormalizedMd5,
    "exact local State C policy hash",
  );

  if (state === "STATE_A") {
    psql(`${stateBPolicySql}\n${recursivePoliciesSql}`);
    assert.equal(
      normalizedPolicyHash(),
      "75e5d59fce7de054e5f53d7d5d73f99e",
      "exact local State A policy hash",
    );
  } else if (state === "STATE_B") {
    psql(stateBPolicySql);
    assert.equal(
      normalizedPolicyHash(),
      "c4a69b0c9f9660563eb7aa8ca6e1b3b6",
      "exact local State B policy hash",
    );
  } else if (state === "FINAL") {
    run("supabase", ["migration", "up", "--local"], { timeout: 180000 });
    assert.equal(
      normalizedPolicyHash(),
      "2814223218999d3d6364582d5b9e85e1",
      "exact final policy hash",
    );
  }

  psql(fixtureSql);
}

function verifyStaticBindings() {
  assert.equal(
    createHash("sha256")
      .update(snapshot.authorizationEnvelope.bindingLines.join("\n"))
      .digest("hex"),
    snapshot.authorizationEnvelope.sha256,
  );
  assert.match(migration, /STATE_C_SCALAR_SUBSELECT_CANONICAL/);
  assert.match(migration, new RegExp(snapshot.policySet.orderedNormalizedMd5));
  assert.match(migration, new RegExp(snapshot.table.normalizedAclMd5));
  for (const helper of snapshot.helpers.functions) {
    assert.match(migration, new RegExp(helper.normalizedSourceMd5));
  }
}

verifyStaticBindings();

if (!process.argv.includes("--local")) {
  console.log("PASS State C snapshot and migration bindings are internally consistent.");
  process.exit(0);
}

const matrix = {};
for (const state of ["STATE_A", "STATE_B", "STATE_C", "FINAL"]) {
  prepareState(state);
  matrix[state] = {
    policyHash: normalizedPolicyHash(),
    cases: cases.map(evaluateCase),
  };
}

const stateB = matrix.STATE_B.cases;
const stateC = matrix.STATE_C.cases;
const final = matrix.FINAL.cases;
assert.deepEqual(stateC, stateB, "State C authorization matrix differs from State B");
assert.deepEqual(
  final.filter((entry) => entry.actor !== "anon"),
  stateB.filter((entry) => entry.actor !== "anon"),
  "final authenticated/service authorization matrix differs from State B",
);
assert.equal(
  final.find((entry) => entry.actor === "anon")?.sqlstate,
  "42501",
  "final state did not harden anonymous access to a direct permission denial",
);
assert.equal(
  matrix.STATE_A.cases
    .some((entry) => entry.sqlstate === "42P17"),
  true,
  "State A did not reproduce recursion in the authorization matrix",
);
assert.equal(
  stateC.some((entry) => entry.recursion),
  false,
  "State C produced SQLSTATE 42P17",
);

const history = psql(`
select version || '|' || name
from supabase_migrations.schema_migrations
where version = '20260730004700'
order by version;
`).stdout
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
assert.deepEqual(
  history,
  ["20260730004700|team_members_rls_recursion"],
  "final migration history is not exactly once",
);

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      syntheticOnly: true,
      realUserDataTouched: false,
      stateCEnvelopeSha256: snapshot.authorizationEnvelope.sha256,
      classification: "SEMANTICALLY EQUIVALENT TO STATE B",
      matrix,
      finalMigrationHistory: history,
    },
    null,
    2,
  ),
);
