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
  system_identifier text;
  is_production_cluster boolean;
  helper_profile text;
begin
  select control.system_identifier::text
  into system_identifier
  from pg_catalog.pg_control_system() control;

  is_production_cluster :=
    system_identifier = '7642734024280108049';

  if to_regclass('public.team_members') is null then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: public.team_members is missing';
  end if;

  if to_regprocedure('public.laxhornet_is_platform_reviewer()') is null
    or to_regprocedure('public.laxhornet_is_team_member(text)') is null
    or to_regprocedure('public.laxhornet_team_role(text)') is null
    or to_regprocedure('public.laxhornet_can_create_team()') is null
  then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: required authorization helpers are missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class class
    where class.oid = 'public.team_members'::regclass
      and (
        pg_catalog.pg_get_userbyid(class.relowner) <> 'postgres'
        or not class.relrowsecurity
        or class.relforcerowsecurity
      )
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: team_members owner, RLS, or FORCE RLS drifted';
  end if;

  if to_regnamespace('lh_rls_private') is not null then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: private helper schema unexpectedly exists';
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
    if not is_production_cluster and (
      select
        count(*) = 16
        and pg_catalog.md5(
          pg_catalog.string_agg(
            acl.grantee::regrole::text
              || '|' || acl.grantor::regrole::text
              || '|' || acl.privilege_type
              || '|' || acl.is_grantable::text,
            pg_catalog.chr(10)
            order by
              acl.grantee::regrole::text,
              acl.privilege_type
          )
        ) = 'a80522df72f7d68695a08b41e5e7d958'
      from pg_catalog.pg_class class
      cross join lateral pg_catalog.aclexplode(class.relacl) acl
      where class.oid = 'public.team_members'::regclass
    ) then
      helper_profile := 'NONPRODUCTION_ROLLBACK';
    else
      helper_profile := 'PRODUCTION_CAPTURED';
    end if;
  elsif policy_count = 4
    and policy_hash = 'c4a69b0c9f9660563eb7aa8ca6e1b3b6'
  then
    starting_state := 'STATE_B_CANONICAL_ONLY';
    helper_profile := 'PRODUCTION_CAPTURED';
  elsif not is_production_cluster
    and policy_count = 4
    and policy_hash = '1c9c5d532c262c3b9ec850552bdf0512'
  then
    starting_state := 'NONPRODUCTION_BLANK_CHAIN_ONLY';
    helper_profile := 'NONPRODUCTION_BLANK';
  else
    raise exception
      'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: policy definition drift (production %, system identifier %, count %, hash %)',
      is_production_cluster,
      system_identifier,
      policy_count,
      policy_hash;
  end if;

  if helper_profile = 'PRODUCTION_CAPTURED' and (
    select
      count(*) <> 32
      or pg_catalog.md5(
        pg_catalog.string_agg(
          acl.grantee::regrole::text
            || '|' || acl.grantor::regrole::text
            || '|' || acl.privilege_type
            || '|' || acl.is_grantable::text,
          pg_catalog.chr(10)
          order by
            acl.grantee::regrole::text,
            acl.privilege_type
        )
      ) <> '76611f7aba7b5501a407d96446952895'
    from pg_catalog.pg_class class
    cross join lateral pg_catalog.aclexplode(class.relacl) acl
    where class.oid = 'public.team_members'::regclass
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: production team_members ACL drifted';
  end if;

  if helper_profile = 'NONPRODUCTION_BLANK' and (
    select coalesce(class.relacl::text, '') not in (
      '{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=arwdDxtm/postgres,service_role=Dxtm/postgres}',
      '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
    )
    from pg_catalog.pg_class class
    where class.oid = 'public.team_members'::regclass
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: nonproduction team_members ACL drifted';
  end if;

  if helper_profile = 'NONPRODUCTION_ROLLBACK' and (
    select
      count(*) <> 16
      or pg_catalog.md5(
        pg_catalog.string_agg(
          acl.grantee::regrole::text
            || '|' || acl.grantor::regrole::text
            || '|' || acl.privilege_type
            || '|' || acl.is_grantable::text,
          pg_catalog.chr(10)
          order by
            acl.grantee::regrole::text,
            acl.privilege_type
        )
      ) <> 'a80522df72f7d68695a08b41e5e7d958'
    from pg_catalog.pg_class class
    cross join lateral pg_catalog.aclexplode(class.relacl) acl
    where class.oid = 'public.team_members'::regclass
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: nonproduction rollback team_members ACL drifted';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'laxhornet_is_platform_reviewer',
        'laxhornet_is_team_member',
        'laxhornet_team_role',
        'laxhornet_can_create_team'
      )
  ) <> 4 then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: authorization helper overload set drifted';
  end if;

  if exists (
    select 1
    from (
      values
        (
          'public.laxhornet_can_create_team()',
          'c2b253cf74e691f048cf29a66ddbba76'
        ),
        (
          'public.laxhornet_is_platform_reviewer()',
          'f9eb8573e91bc5758f94a3b997966a4e'
        ),
        (
          'public.laxhornet_is_team_member(text)',
          '17e2d67b8cb33781debcc01d6f1578a6'
        ),
        (
          'public.laxhornet_team_role(text)',
          'bd212e46e7fe3dc8057780eddf0d9240'
        )
    ) expected(signature, source_hash)
    join pg_catalog.pg_proc proc
      on proc.oid = pg_catalog.to_regprocedure(expected.signature)
    join pg_catalog.pg_language language
      on language.oid = proc.prolang
    where pg_catalog.pg_get_userbyid(proc.proowner) <> 'postgres'
      or not proc.prosecdef
      or language.lanname not in ('sql', 'plpgsql')
      or pg_catalog.md5(
        pg_catalog.replace(proc.prosrc, pg_catalog.chr(13), '')
      ) <> expected.source_hash
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: authorization helper body, owner, language, or SECURITY DEFINER mode drifted';
  end if;

  if helper_profile = 'PRODUCTION_CAPTURED' and exists (
    select 1
    from (
      values
        (
          'public.laxhornet_can_create_team()',
          array['search_path=public']::text[]
        ),
        (
          'public.laxhornet_is_platform_reviewer()',
          array['search_path=public']::text[]
        ),
        (
          'public.laxhornet_is_team_member(text)',
          array['search_path=public', 'row_security=off']::text[]
        ),
        (
          'public.laxhornet_team_role(text)',
          array['search_path=public', 'row_security=off']::text[]
        )
    ) expected(signature, config)
    join pg_catalog.pg_proc proc
      on proc.oid = pg_catalog.to_regprocedure(expected.signature)
    where proc.proconfig is distinct from expected.config
      or (
        select
          count(*) <> 3
          or pg_catalog.md5(
            pg_catalog.string_agg(
              acl.grantee::regrole::text
                || '|' || acl.grantor::regrole::text
                || '|' || acl.privilege_type
                || '|' || acl.is_grantable::text,
              pg_catalog.chr(10)
              order by
                acl.grantee::regrole::text,
                acl.privilege_type
            )
          ) <> '2c23155f9c6d5e4dc4d7da9fee83f183'
        from pg_catalog.aclexplode(proc.proacl) acl
      )
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: production authorization helper config or ACL drifted';
  end if;

  if helper_profile = 'NONPRODUCTION_BLANK' and exists (
    select 1
    from (
      values
        (
          'public.laxhornet_can_create_team()',
          array['search_path=public']::text[]
        ),
        (
          'public.laxhornet_is_platform_reviewer()',
          array['search_path=public']::text[]
        ),
        (
          'public.laxhornet_is_team_member(text)',
          array['search_path=public']::text[]
        ),
        (
          'public.laxhornet_team_role(text)',
          array['search_path=public']::text[]
        )
    ) expected(signature, config)
    join pg_catalog.pg_proc proc
      on proc.oid = pg_catalog.to_regprocedure(expected.signature)
    where proc.proconfig is distinct from expected.config
      or coalesce(proc.proacl::text, '') not in (
        '{postgres=X/postgres,authenticated=X/postgres}',
        '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
      )
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: nonproduction authorization helper config or ACL drifted';
  end if;

  if helper_profile = 'NONPRODUCTION_ROLLBACK' and exists (
    select 1
    from (
      values
        (
          'public.laxhornet_can_create_team()',
          array['search_path=pg_catalog, public']::text[]
        ),
        (
          'public.laxhornet_is_platform_reviewer()',
          array['search_path=pg_catalog, public']::text[]
        ),
        (
          'public.laxhornet_is_team_member(text)',
          array[
            'search_path=pg_catalog, public',
            'row_security=off'
          ]::text[]
        ),
        (
          'public.laxhornet_team_role(text)',
          array[
            'search_path=pg_catalog, public',
            'row_security=off'
          ]::text[]
        )
    ) expected(signature, config)
    join pg_catalog.pg_proc proc
      on proc.oid = pg_catalog.to_regprocedure(expected.signature)
    where proc.proconfig is distinct from expected.config
      or (
        select pg_catalog.array_agg(
          acl.grantee::regrole::text
            || '|' || acl.grantor::regrole::text
            || '|' || acl.privilege_type
            || '|' || acl.is_grantable::text
          order by
            acl.grantee::regrole::text,
            acl.privilege_type
        )
        from pg_catalog.aclexplode(proc.proacl) acl
      ) is distinct from array[
        'authenticated|postgres|EXECUTE|false',
        'postgres|postgres|EXECUTE|false',
        'service_role|postgres|EXECUTE|false'
      ]::text[]
  ) then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: nonproduction rollback authorization helper config or ACL drifted';
  end if;

  if is_production_cluster and (
    select pg_catalog.array_agg(
      history.version || '|' || history.name
      order by history.version
    )
    from supabase_migrations.schema_migrations history
  ) is distinct from array[
    '20260723000000|laxhornet_legacy_baseline',
    '20260723010000|trust_spine_release_1',
    '20260723010607|remote_schema',
    '20260723020000|minimum_necessary_disclosure',
    '20260723030000|fix_disclosure_audit_and_evidence_validation',
    '20260723040000|event_pipeline_capabilities',
    '20260727000000|tracked_playing_time_operations',
    '20260728193942|v284_public_event_semantic_boundary'
  ]::text[] then
    raise exception 'TEAM_MEMBERS_RLS_PREFLIGHT_FAILED: production migration history drifted';
  end if;

  raise notice
    'TEAM_MEMBERS_RLS_PREFLIGHT_ACCEPTED: %, production %, system identifier %, policy hash %',
    starting_state,
    is_production_cluster,
    system_identifier,
    policy_hash;
end;
$preflight$;

create schema lh_rls_private;
revoke all on schema lh_rls_private from public, anon;
grant usage on schema lh_rls_private to authenticated, service_role;

create function lh_rls_private.current_team_role(check_team_id text)
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
alter function public.laxhornet_can_create_team()
  set search_path = pg_catalog, public;
alter function public.laxhornet_is_platform_reviewer()
  set search_path = pg_catalog, public;

revoke all on function public.laxhornet_is_team_member(text)
  from public, anon;
revoke all on function public.laxhornet_team_role(text)
  from public, anon;
revoke all on function public.laxhornet_can_create_team()
  from public, anon;
revoke all on function public.laxhornet_is_platform_reviewer()
  from public, anon;
grant execute on function public.laxhornet_is_team_member(text)
  to authenticated, service_role;
grant execute on function public.laxhornet_team_role(text)
  to authenticated, service_role;
grant execute on function public.laxhornet_can_create_team()
  to authenticated, service_role;
grant execute on function public.laxhornet_is_platform_reviewer()
  to authenticated, service_role;

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
revoke truncate, references, trigger, maintain on table public.team_members
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
declare
  final_policy_hash text;
begin
  select pg_catalog.md5(
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
  into final_policy_hash
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'team_members';

  if final_policy_hash <> '2814223218999d3d6364582d5b9e85e1'
    or (
      select count(*)
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'team_members'
    ) <> 4
  then
    raise exception
      'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: canonical policy definition drift (hash %)',
      final_policy_hash;
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

  if (
    select
      count(*) <> 16
      or pg_catalog.md5(
        pg_catalog.string_agg(
          acl.grantee::regrole::text
            || '|' || acl.grantor::regrole::text
            || '|' || acl.privilege_type
            || '|' || acl.is_grantable::text,
          pg_catalog.chr(10)
          order by
            acl.grantee::regrole::text,
            acl.privilege_type
        )
      ) <> 'a80522df72f7d68695a08b41e5e7d958'
    from pg_catalog.pg_class class
    cross join lateral pg_catalog.aclexplode(class.relacl) acl
    where class.oid = 'public.team_members'::regclass
  )
  then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: table ACL is not the exact approved DML-only set';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_namespace namespace
    where namespace.nspname = 'lh_rls_private'
      and (
        pg_catalog.pg_get_userbyid(namespace.nspowner) <> 'postgres'
        or namespace.nspacl::text is distinct from
          '{postgres=UC/postgres,authenticated=U/postgres,service_role=U/postgres}'
      )
  ) or not exists (
    select 1
    from pg_catalog.pg_namespace namespace
    where namespace.nspname = 'lh_rls_private'
  ) then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: private schema owner or ACL drifted';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'lh_rls_private'
      and proc.proname = 'current_team_role'
      and (
        pg_catalog.pg_get_userbyid(proc.proowner) <> 'postgres'
        or not proc.prosecdef
        or proc.proconfig is distinct from
          array['search_path=pg_catalog', 'row_security=off']::text[]
        or pg_catalog.md5(
          pg_catalog.replace(proc.prosrc, pg_catalog.chr(13), '')
        ) <> 'c54385c307c2451078471265c63e77bd'
        or (
          select pg_catalog.array_agg(
            acl.grantee::regrole::text
              || '|' || acl.grantor::regrole::text
              || '|' || acl.privilege_type
              || '|' || acl.is_grantable::text
            order by
              acl.grantee::regrole::text,
              acl.privilege_type
          )
          from pg_catalog.aclexplode(proc.proacl) acl
        ) is distinct from array[
          'authenticated|postgres|EXECUTE|false',
          'postgres|postgres|EXECUTE|false',
          'service_role|postgres|EXECUTE|false'
        ]::text[]
      )
  ) or to_regprocedure(
    'lh_rls_private.current_team_role(text)'
  ) is null then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: private helper definition, owner, config, or ACL drifted';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc proc
    where proc.oid in (
      'public.laxhornet_can_create_team()'::regprocedure,
      'public.laxhornet_is_platform_reviewer()'::regprocedure,
      'public.laxhornet_is_team_member(text)'::regprocedure,
      'public.laxhornet_team_role(text)'::regprocedure
    )
      and (
        pg_catalog.pg_get_userbyid(proc.proowner) <> 'postgres'
        or not proc.prosecdef
        or proc.proconfig is distinct from
          case
            when proc.oid in (
              'public.laxhornet_is_team_member(text)'::regprocedure,
              'public.laxhornet_team_role(text)'::regprocedure
            )
              then array[
                'search_path=pg_catalog, public',
                'row_security=off'
              ]::text[]
            else array['search_path=pg_catalog, public']::text[]
          end
        or (
          select pg_catalog.array_agg(
            acl.grantee::regrole::text
              || '|' || acl.grantor::regrole::text
              || '|' || acl.privilege_type
              || '|' || acl.is_grantable::text
            order by
              acl.grantee::regrole::text,
              acl.privilege_type
          )
          from pg_catalog.aclexplode(proc.proacl) acl
        ) is distinct from array[
          'authenticated|postgres|EXECUTE|false',
          'postgres|postgres|EXECUTE|false',
          'service_role|postgres|EXECUTE|false'
        ]::text[]
      )
  ) then
    raise exception 'TEAM_MEMBERS_RLS_POSTFLIGHT_FAILED: public authorization helper owner, config, or ACL drifted';
  end if;
end;
$postflight$;

commit;
