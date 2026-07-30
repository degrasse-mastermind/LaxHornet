-- Remove four legacy team_members policies that recursively queried the table
-- they protected. Preserve the repository's established membership semantics
-- through one narrowly scoped, non-exposed SECURITY DEFINER predicate.

begin;

do $preflight$
declare
  policy_count integer;
  policy_hash text;
  starting_state text;
  unexpected_policies text[];
begin
  if to_regclass('public.team_members') is null then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: public.team_members is missing';
  end if;

  if to_regprocedure('public.laxhornet_is_team_member(text)') is null
    or to_regprocedure('public.laxhornet_team_role(text)') is null
    or to_regprocedure('public.laxhornet_can_create_team()') is null
  then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: required authorization helpers are missing';
  end if;

  if (
    select pg_catalog.pg_get_userbyid(class.relowner) <> 'postgres'
    from pg_catalog.pg_class class
    where class.oid = 'public.team_members'::regclass
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: team_members owner is not postgres';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'laxhornet_is_team_member',
        'laxhornet_team_role',
        'laxhornet_can_create_team'
      )
      and proc.prosecdef
      and pg_catalog.pg_get_userbyid(proc.proowner) = 'postgres'
  ) <> 3 then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: authorization helper ownership or SECURITY DEFINER mode drifted';
  end if;

  if not (
    select class.relrowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.team_members'::regclass
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: RLS is not enabled';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname in (
        'laxhornet read team members',
        'laxhornet insert team members',
        'laxhornet update team members',
        'laxhornet delete team members'
      )
  ) <> 4 then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: canonical policy set is incomplete';
  end if;

  select pg_catalog.array_agg(policyname order by policyname)
  into unexpected_policies
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'team_members'
    and policyname not in (
      'laxhornet read team members',
      'laxhornet insert team members',
      'laxhornet update team members',
      'laxhornet delete team members',
      'team_members_select_team',
      'team_members_insert_team',
      'team_members_update_team',
      'team_members_delete_team'
    );

  if unexpected_policies is not null then
    raise exception
      'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: unexpected policies: %',
      unexpected_policies;
  end if;

  select
    count(*)::integer,
    pg_catalog.md5(
      pg_catalog.string_agg(
        policyname
          || '|' || permissive
          || '|' || roles::text
          || '|' || cmd
          || '|' || coalesce(
            pg_catalog.regexp_replace(qual, E'\\s+', '', 'g'),
            ''
          )
          || '|' || coalesce(
            pg_catalog.regexp_replace(with_check, E'\\s+', '', 'g'),
            ''
          ),
        pg_catalog.chr(10)
        order by policyname
      )
    )
  into policy_count, policy_hash
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'team_members';

  if policy_count = 8
    and policy_hash = '75e5d59fce7de054e5f53d7d5d73f99e'
  then
    starting_state := 'STATE_A_CAPTURED_RECURSIVE_DEFECT';
  elsif policy_count = 4
    and policy_hash = 'c4a69b0c9f9660563eb7aa8ca6e1b3b6'
  then
    starting_state := 'STATE_B_CANONICAL_ONLY';
  elsif policy_count = 4
    and policy_hash = '1c9c5d532c262c3b9ec850552bdf0512'
    and not has_table_privilege('anon', 'public.team_members', 'select')
    and not has_table_privilege('anon', 'public.team_members', 'insert')
    and not has_table_privilege('anon', 'public.team_members', 'update')
    and not has_table_privilege('anon', 'public.team_members', 'delete')
    and not exists (
      select 1
      from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace namespace
        on namespace.oid = proc.pronamespace
      where namespace.nspname = 'public'
        and proc.proname in (
          'laxhornet_is_team_member',
          'laxhornet_team_role'
        )
        and proc.proconfig @> array['row_security=off']
    )
  then
    starting_state := 'LOCAL_BLANK_CHAIN_ONLY';
  else
    raise exception
      'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: policy definition drift (count %, hash %)',
      policy_count,
      policy_hash;
  end if;

  raise notice
    'TEAM_MEMBERS_RLS_PREFLIGHT_ACCEPTED: %, policy hash %',
    starting_state,
    policy_hash;
end;
$preflight$;

create schema if not exists lh_rls_private;
revoke all on schema lh_rls_private from public, anon;
grant usage on schema lh_rls_private to authenticated, service_role;

create or replace function lh_rls_private.current_team_role(check_team_id text)
returns text
language sql
stable
security definer
set search_path = pg_catalog
set row_security = off
as $function$
  select case
    when member.role = 'admin'
      and public.laxhornet_is_platform_reviewer()
      then 'admin'
    when member.role in ('admin', 'viewer', 'member')
      then 'tracker'
    else member.role
  end
  from public.team_members member
  where auth.uid() is not null
    and member.team_id = check_team_id
    and member.user_id = auth.uid()
  limit 1
$function$;

alter function lh_rls_private.current_team_role(text) owner to postgres;
revoke all on function lh_rls_private.current_team_role(text) from public, anon;
grant execute on function lh_rls_private.current_team_role(text)
  to authenticated, service_role;

-- These established helpers also inspect team_members. Make their intentional
-- RLS bypass and fixed lookup path explicit before FORCE RLS is enabled.
alter function public.laxhornet_is_team_member(text)
  set search_path = pg_catalog, public;
alter function public.laxhornet_is_team_member(text)
  set row_security = off;
alter function public.laxhornet_team_role(text)
  set search_path = pg_catalog, public;
alter function public.laxhornet_team_role(text)
  set row_security = off;

drop policy if exists "team_members_select_team" on public.team_members;
drop policy if exists "team_members_insert_team" on public.team_members;
drop policy if exists "team_members_update_team" on public.team_members;
drop policy if exists "team_members_delete_team" on public.team_members;

drop policy if exists "laxhornet read team members" on public.team_members;
drop policy if exists "laxhornet insert team members" on public.team_members;
drop policy if exists "laxhornet update team members" on public.team_members;
drop policy if exists "laxhornet delete team members" on public.team_members;

create policy "laxhornet read team members"
on public.team_members
for select
to authenticated
using (
  lh_rls_private.current_team_role(team_id) is not null
);

create policy "laxhornet insert team members"
on public.team_members
for insert
to authenticated
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
on public.team_members
for update
to authenticated
using (
  lh_rls_private.current_team_role(team_id) = 'admin'
)
with check (
  lh_rls_private.current_team_role(team_id) = 'admin'
);

create policy "laxhornet delete team members"
on public.team_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or lh_rls_private.current_team_role(team_id) = 'admin'
);

revoke all on table public.team_members from public, anon;
revoke truncate, references, trigger on table public.team_members
  from authenticated, service_role;
grant select, insert, update, delete on table public.team_members
  to authenticated;
grant select, insert, update, delete on table public.team_members
  to service_role;

alter table public.team_members enable row level security;
alter table public.team_members force row level security;

comment on function lh_rls_private.current_team_role(text) is
  'Returns only the signed-in user role for one team. SECURITY DEFINER and row_security=off prevent recursive evaluation when used by team_members RLS.';

do $postflight$
begin
  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
  ) <> 4 then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: unexpected policy count';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname like 'team_members_%_team'
  ) then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: recursive legacy policy survived';
  end if;

  if not (
    select class.relrowsecurity and class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'public.team_members'::regclass
  ) then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: RLS or FORCE RLS is disabled';
  end if;

  if has_table_privilege('anon', 'public.team_members', 'select')
    or has_table_privilege('anon', 'public.team_members', 'insert')
    or has_table_privilege('anon', 'public.team_members', 'update')
    or has_table_privilege('anon', 'public.team_members', 'delete')
    or has_table_privilege('authenticated', 'public.team_members', 'truncate')
    or has_table_privilege('authenticated', 'public.team_members', 'references')
    or has_table_privilege('authenticated', 'public.team_members', 'trigger')
    or has_table_privilege('service_role', 'public.team_members', 'truncate')
    or has_table_privilege('service_role', 'public.team_members', 'references')
    or has_table_privilege('service_role', 'public.team_members', 'trigger')
  then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: table grants are broader than approved';
  end if;
end;
$postflight$;

commit;
