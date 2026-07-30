\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

create policy "team_members_select_team"
on public.team_members
for select
to authenticated
using (
  exists (
    select 1
    from public.team_members member
    where member.team_id = team_members.team_id
      and member.user_id = auth.uid()
  )
);

create policy "team_members_insert_team"
on public.team_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.team_members member
    where member.team_id = team_members.team_id
      and member.user_id = auth.uid()
  )
);

create policy "team_members_update_team"
on public.team_members
for update
to authenticated
using (
  exists (
    select 1
    from public.team_members member
    where member.team_id = team_members.team_id
      and member.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_members member
    where member.team_id = team_members.team_id
      and member.user_id = auth.uid()
  )
);

create policy "team_members_delete_team"
on public.team_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.team_members member
    where member.team_id = team_members.team_id
      and member.user_id = auth.uid()
  )
);

insert into auth.users(id, email)
values
  ('30100000-0000-4000-8000-000000000001', 'recursion-admin@example.test'),
  ('30100000-0000-4000-8000-000000000002', 'recursion-member@example.test');

insert into public.teams(id, name, invite_code, tracker_code, created_by)
values (
  'recursion-team',
  'Synthetic Recursion Team',
  'RECURSION-INVITE',
  'RECURSION-TRACK',
  '30100000-0000-4000-8000-000000000001'
);

insert into public.team_members(id, team_id, user_id, role)
values (
  'recursion-member',
  'recursion-team',
  '30100000-0000-4000-8000-000000000002',
  'tracker'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"30100000-0000-4000-8000-000000000002","role":"authenticated","email":"recursion-member@example.test"}',
  true
);

select extensions.throws_ok(
  $$select * from public.team_members where team_id = 'recursion-team'$$,
  '42P17',
  'infinite recursion detected in policy for relation "team_members"',
  'captured SELECT policy reproduces SQLSTATE 42P17'
);
select extensions.throws_ok(
  $$insert into public.team_members(id, team_id, user_id, role)
    values (
      'recursion-insert',
      'recursion-team',
      '30100000-0000-4000-8000-000000000001',
      'tracker'
    )$$,
  '42P17',
  'infinite recursion detected in policy for relation "team_members"',
  'captured INSERT policy reproduces SQLSTATE 42P17'
);
select extensions.throws_ok(
  $$update public.team_members
    set role = 'member'
    where id = 'recursion-member'$$,
  '42P17',
  'infinite recursion detected in policy for relation "team_members"',
  'captured UPDATE policy reproduces SQLSTATE 42P17'
);
select extensions.throws_ok(
  $$delete from public.team_members where id = 'recursion-member'$$,
  '42P17',
  'infinite recursion detected in policy for relation "team_members"',
  'captured DELETE policy reproduces SQLSTATE 42P17'
);

reset role;
select extensions.finish();
rollback;
