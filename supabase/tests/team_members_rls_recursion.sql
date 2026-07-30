\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(37);

select extensions.ok(
  (
    select class.relrowsecurity and class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.team_members'::regclass
  ),
  'team_members has RLS and FORCE RLS enabled'
);
select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
  ),
  4,
  'exactly four canonical team_members policies remain'
);
select extensions.is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname like 'team_members_%_team'
  ),
  0,
  'all recursive legacy policies are absent'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.team_members', 'select')
  and not has_table_privilege('anon', 'public.team_members', 'insert')
  and not has_table_privilege('anon', 'public.team_members', 'update')
  and not has_table_privilege('anon', 'public.team_members', 'delete'),
  'anonymous direct-table privileges are denied'
);
select extensions.ok(
  has_table_privilege('authenticated', 'public.team_members', 'select')
  and has_table_privilege('authenticated', 'public.team_members', 'insert')
  and has_table_privilege('authenticated', 'public.team_members', 'update')
  and has_table_privilege('authenticated', 'public.team_members', 'delete')
  and not has_table_privilege('authenticated', 'public.team_members', 'truncate')
  and not has_table_privilege('authenticated', 'public.team_members', 'references')
  and not has_table_privilege('authenticated', 'public.team_members', 'trigger'),
  'authenticated direct privileges are limited to RLS-governed DML'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.team_members', 'select')
  and has_table_privilege('service_role', 'public.team_members', 'insert')
  and has_table_privilege('service_role', 'public.team_members', 'update')
  and has_table_privilege('service_role', 'public.team_members', 'delete')
  and not has_table_privilege('service_role', 'public.team_members', 'truncate')
  and not has_table_privilege('service_role', 'public.team_members', 'references')
  and not has_table_privilege('service_role', 'public.team_members', 'trigger'),
  'service-role maintenance privileges are explicit and limited to DML'
);
select extensions.ok(
  has_schema_privilege('authenticated', 'lh_rls_private', 'usage')
  and has_function_privilege(
    'authenticated',
    'lh_rls_private.current_team_role(text)',
    'execute'
  )
  and not has_schema_privilege('anon', 'lh_rls_private', 'usage')
  and not has_function_privilege(
    'anon',
    'lh_rls_private.current_team_role(text)',
    'execute'
  ),
  'private helper privileges are minimal'
);
select extensions.ok(
  (
    select proc.prosecdef
      and proc.proconfig @> array['search_path=pg_catalog']
      and proc.proconfig @> array['row_security=off']
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'lh_rls_private'
      and proc.proname = 'current_team_role'
  ),
  'private helper is SECURITY DEFINER with fixed search path and explicit RLS bypass'
);

insert into auth.users(id, email)
values
  ('30000000-0000-4000-8000-000000000001', 'degrassed@gmail.com'),
  ('30000000-0000-4000-8000-000000000002', 'tracker-a@example.test'),
  ('30000000-0000-4000-8000-000000000003', 'member-a@example.test'),
  ('30000000-0000-4000-8000-000000000004', 'member-b@example.test'),
  ('30000000-0000-4000-8000-000000000005', 'nonmember@example.test'),
  ('30000000-0000-4000-8000-000000000006', 'parent@example.test'),
  ('30000000-0000-4000-8000-000000000007', 'coach@example.test'),
  ('30000000-0000-4000-8000-000000000008', 'revoked@example.test'),
  ('30000000-0000-4000-8000-000000000009', 'expired@example.test'),
  ('30000000-0000-4000-8000-000000000010', 'grant-admin@example.test'),
  ('30000000-0000-4000-8000-000000000011', 'pending@example.test');

insert into public.teams(id, name, invite_code, tracker_code, created_by)
values
  (
    'rls-team-a',
    'Synthetic Team A',
    'RLS-TEAM-A-INVITE',
    'RLS-TEAM-A-TRACK',
    '30000000-0000-4000-8000-000000000001'
  ),
  (
    'rls-team-b',
    'Synthetic Team B',
    'RLS-TEAM-B-INVITE',
    'RLS-TEAM-B-TRACK',
    '30000000-0000-4000-8000-000000000001'
  ),
  (
    'rls-team-bootstrap',
    'Synthetic Bootstrap Team',
    'RLS-BOOTSTRAP-INVITE',
    'RLS-BOOTSTRAP-TRACK',
    '30000000-0000-4000-8000-000000000001'
  );

insert into public.team_members(id, team_id, user_id, role)
values
  (
    'rls-member-admin-a',
    'rls-team-a',
    '30000000-0000-4000-8000-000000000001',
    'admin'
  ),
  (
    'rls-member-tracker-a',
    'rls-team-a',
    '30000000-0000-4000-8000-000000000002',
    'tracker'
  ),
  (
    'rls-member-member-a',
    'rls-team-a',
    '30000000-0000-4000-8000-000000000003',
    'member'
  ),
  (
    'rls-member-b',
    'rls-team-b',
    '30000000-0000-4000-8000-000000000004',
    'tracker'
  );

insert into public.lh_team_scopes(team_id, team_name_snapshot)
values
  ('rls-team-a', 'Synthetic Team A'),
  ('rls-team-b', 'Synthetic Team B');

insert into public.lh_player_scopes(
  team_id,
  roster_player_id,
  player_name_snapshot,
  jersey_snapshot,
  position_snapshot
)
values
  (
    'rls-team-a',
    'rls-player-a',
    'Synthetic Player A',
    '20',
    'Midfield'
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
values (
  'rls-grant-issuer',
  '30000000-0000-4000-8000-000000000001',
  'team_admin',
  'team',
  'rls-team-a',
  'system_bootstrap',
  '30000000-0000-4000-8000-000000000001',
  timestamptz '2026-07-28 23:59:00+00'
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
  ('rls-issuer-issued', 'rls-grant-issuer', 1, 'issued', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-28 23:59:00+00'),
  ('rls-issuer-accepted', 'rls-grant-issuer', 2, 'accepted', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-28 23:59:01+00');

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
  created_at,
  accepted_at
)
values
  (
    'rls-invite-parent',
    '30000000-0000-4000-8000-000000000006',
    'parent@example.test',
    'parent',
    'player',
    'rls-team-a',
    'rls-player-a',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    'accepted',
    timestamptz '2026-07-29 00:00:00+00',
    timestamptz '2026-07-29 00:01:00+00'
  ),
  (
    'rls-invite-coach',
    '30000000-0000-4000-8000-000000000007',
    'coach@example.test',
    'coach',
    'team',
    'rls-team-a',
    null,
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    'accepted',
    timestamptz '2026-07-29 00:00:00+00',
    timestamptz '2026-07-29 00:01:00+00'
  ),
  (
    'rls-invite-revoked',
    '30000000-0000-4000-8000-000000000008',
    'revoked@example.test',
    'parent',
    'player',
    'rls-team-a',
    'rls-player-a',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    'accepted',
    timestamptz '2026-07-29 00:00:00+00',
    timestamptz '2026-07-29 00:01:00+00'
  ),
  (
    'rls-invite-expired',
    '30000000-0000-4000-8000-000000000009',
    'expired@example.test',
    'coach',
    'team',
    'rls-team-a',
    null,
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    'accepted',
    timestamptz '2026-07-28 00:00:00+00',
    timestamptz '2026-07-28 00:01:00+00'
  ),
  (
    'rls-invite-admin',
    '30000000-0000-4000-8000-000000000010',
    'grant-admin@example.test',
    'team_admin',
    'team',
    'rls-team-a',
    null,
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    'accepted',
    timestamptz '2026-07-29 00:00:00+00',
    timestamptz '2026-07-29 00:01:00+00'
  ),
  (
    'rls-invite-pending',
    '30000000-0000-4000-8000-000000000011',
    'pending@example.test',
    'coach',
    'team',
    'rls-team-a',
    null,
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    'accepted',
    timestamptz '2026-07-29 00:00:00+00',
    timestamptz '2026-07-29 00:01:00+00'
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
values
  (
    'rls-grant-parent',
    '30000000-0000-4000-8000-000000000006',
    'parent',
    'player',
    'rls-team-a',
    'rls-player-a',
    'invitation',
    'rls-invite-parent',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    timestamptz '2026-07-29 00:01:00+00',
    null
  ),
  (
    'rls-grant-coach',
    '30000000-0000-4000-8000-000000000007',
    'coach',
    'team',
    'rls-team-a',
    null,
    'invitation',
    'rls-invite-coach',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    timestamptz '2026-07-29 00:01:00+00',
    null
  ),
  (
    'rls-grant-revoked',
    '30000000-0000-4000-8000-000000000008',
    'parent',
    'player',
    'rls-team-a',
    'rls-player-a',
    'invitation',
    'rls-invite-revoked',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    timestamptz '2026-07-29 00:01:00+00',
    null
  ),
  (
    'rls-grant-expired',
    '30000000-0000-4000-8000-000000000009',
    'coach',
    'team',
    'rls-team-a',
    null,
    'invitation',
    'rls-invite-expired',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    timestamptz '2026-07-28 00:01:00+00',
    timestamptz '2026-07-28 01:00:00+00'
  ),
  (
    'rls-grant-admin',
    '30000000-0000-4000-8000-000000000010',
    'team_admin',
    'team',
    'rls-team-a',
    null,
    'invitation',
    'rls-invite-admin',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    timestamptz '2026-07-29 00:01:00+00',
    null
  ),
  (
    'rls-grant-pending',
    '30000000-0000-4000-8000-000000000011',
    'coach',
    'team',
    'rls-team-a',
    null,
    'invitation',
    'rls-invite-pending',
    '30000000-0000-4000-8000-000000000001',
    'rls-grant-issuer',
    timestamptz '2026-07-29 00:01:00+00',
    null
  );

select extensions.throws_ok(
  $$insert into public.lh_access_grants(
      id,
      user_id,
      role,
      scope_type,
      team_id,
      provenance_type,
      issued_by_user_id,
      issued_at
    )
    values (
      'rls-grant-malformed',
      '30000000-0000-4000-8000-000000000005',
      'parent',
      'player',
      'rls-team-a',
      'system_bootstrap',
      '30000000-0000-4000-8000-000000000001',
      timestamptz '2026-07-29 00:01:00+00'
    )$$,
  '23514',
  'new row for relation "lh_access_grants" violates check constraint "lh_access_grants_provenance_shape_check"',
  'malformed grant provenance fails closed'
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
  ('rls-parent-issued', 'rls-grant-parent', 1, 'issued', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-30 00:00:01+00'),
  ('rls-parent-accepted', 'rls-grant-parent', 2, 'accepted', '30000000-0000-4000-8000-000000000006', timestamptz '2026-07-30 00:00:02+00'),
  ('rls-coach-issued', 'rls-grant-coach', 1, 'issued', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-30 00:00:01+00'),
  ('rls-coach-accepted', 'rls-grant-coach', 2, 'accepted', '30000000-0000-4000-8000-000000000007', timestamptz '2026-07-30 00:00:02+00'),
  ('rls-revoked-issued', 'rls-grant-revoked', 1, 'issued', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-30 00:00:01+00'),
  ('rls-revoked-accepted', 'rls-grant-revoked', 2, 'accepted', '30000000-0000-4000-8000-000000000008', timestamptz '2026-07-30 00:00:02+00'),
  ('rls-revoked-event', 'rls-grant-revoked', 3, 'revoked', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-30 00:00:03+00'),
  ('rls-expired-issued', 'rls-grant-expired', 1, 'issued', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-29 00:00:01+00'),
  ('rls-expired-accepted', 'rls-grant-expired', 2, 'accepted', '30000000-0000-4000-8000-000000000009', timestamptz '2026-07-29 00:00:02+00'),
  ('rls-admin-issued', 'rls-grant-admin', 1, 'issued', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-30 00:00:01+00'),
  ('rls-admin-accepted', 'rls-grant-admin', 2, 'accepted', '30000000-0000-4000-8000-000000000010', timestamptz '2026-07-30 00:00:02+00'),
  ('rls-pending-issued', 'rls-grant-pending', 1, 'issued', '30000000-0000-4000-8000-000000000001', timestamptz '2026-07-30 00:00:01+00');

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated","email":"tracker-a@example.test"}',
  true
);

select extensions.is(
  (select count(*)::integer from public.team_members),
  3,
  'same-team tracker can read all memberships on its team'
);
select extensions.is(
  (select count(*)::integer from public.team_members where team_id = 'rls-team-b'),
  0,
  'same-team tracker cannot read a wrong team'
);
select extensions.is(
  lh_rls_private.current_team_role('rls-team-a'),
  'tracker',
  'approved tracker role resolves within its team'
);
select extensions.is(
  lh_rls_private.current_team_role('rls-team-b'),
  null::text,
  'wrong-team role resolves to null'
);
select extensions.lives_ok(
  $$select * from public.team_members where team_id = 'rls-team-a'$$,
  'select no longer returns SQLSTATE 42P17'
);
select extensions.throws_ok(
  $$insert into public.team_members(id, team_id, user_id, role)
    values (
      'rls-forbidden-tracker-insert',
      'rls-team-b',
      '30000000-0000-4000-8000-000000000002',
      'tracker'
    )$$,
  '42501',
  'new row violates row-level security policy for table "team_members"',
  'tracker cannot insert membership'
);
select extensions.lives_ok(
  $$update public.team_members
    set role = role
    where id = 'rls-member-tracker-a'$$,
  'update path does not recurse'
);
update public.team_members
set role = 'admin'
where id = 'rls-member-member-a';
select extensions.is(
  (select role from public.team_members where id = 'rls-member-member-a'),
  'member',
  'tracker cannot update another membership'
);
select extensions.lives_ok(
  $$delete from public.team_members where id = 'rls-member-member-a'$$,
  'delete path does not recurse'
);
select extensions.is(
  (select count(*)::integer from public.team_members where id = 'rls-member-member-a'),
  1,
  'tracker cannot delete another membership'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated","email":"member-a@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  3,
  'own membership can read the team membership set'
);
select extensions.lives_ok(
  $$delete from public.team_members where id = 'rls-member-member-a'$$,
  'own membership delete does not recurse'
);
select extensions.is(
  (select count(*)::integer from public.team_members where id = 'rls-member-member-a'),
  0,
  'a member may remove only its own membership'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000005","role":"authenticated","email":"nonmember@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  0,
  'non-member sees no memberships'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000006","role":"authenticated","email":"parent@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  0,
  'accepted parent grant alone does not grant membership-table access'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000007","role":"authenticated","email":"coach@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  0,
  'accepted coach grant alone does not grant membership-table access'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000008","role":"authenticated","email":"revoked@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  0,
  'revoked grant grants no membership-table access'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000009","role":"authenticated","email":"expired@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  0,
  'expired grant grants no membership-table access'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000010","role":"authenticated","email":"grant-admin@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  0,
  'team-admin grant alone is not direct membership authority'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000011","role":"authenticated","email":"pending@example.test"}',
  true
);
select extensions.is(
  (select count(*)::integer from public.team_members),
  0,
  'pending grant grants no membership-table access'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","email":"degrassed@gmail.com"}',
  true
);
select extensions.is(
  lh_rls_private.current_team_role('rls-team-a'),
  'admin',
  'platform reviewer admin membership resolves as admin'
);
update public.team_members
set role = 'member'
where id = 'rls-member-tracker-a';
select extensions.is(
  (select role from public.team_members where id = 'rls-member-tracker-a'),
  'member',
  'team admin may update a same-team membership'
);
select extensions.lives_ok(
  $$insert into public.team_members(id, team_id, user_id, role)
    values (
      'rls-bootstrap-admin',
      'rls-team-bootstrap',
      '30000000-0000-4000-8000-000000000001',
      'admin'
    )$$,
  'platform reviewer may bootstrap its own admin membership on its owned team'
);
delete from public.team_members
where id = 'rls-member-tracker-a';
select extensions.is(
  (select count(*)::integer from public.team_members where id = 'rls-member-tracker-a'),
  0,
  'team admin may delete another same-team membership'
);
select extensions.lives_ok(
  $$delete from public.team_members where id = 'rls-member-b'$$,
  'wrong-team delete path does not recurse and remains RLS-filtered'
);

reset role;
set local role anon;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
select extensions.throws_ok(
  $$select * from public.team_members$$,
  '42501',
  'permission denied for table team_members',
  'anonymous membership read is denied before RLS'
);

reset role;
set local role service_role;
select extensions.is(
  (select count(*)::integer from public.team_members),
  3,
  'service role retains explicit maintenance visibility'
);
select extensions.lives_ok(
  $$insert into public.team_members(id, team_id, user_id, role)
    values (
      'rls-service-maintenance',
      'rls-team-b',
      '30000000-0000-4000-8000-000000000005',
      'tracker'
    )$$,
  'service role retains explicit maintenance mutation'
);

reset role;
select extensions.finish();
rollback;
