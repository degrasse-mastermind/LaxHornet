-- EMERGENCY ROLLBACK ONLY.
-- This rollback intentionally restores the four recursive legacy policies and
-- therefore restores the SQLSTATE 42P17 defect. It does not broaden the table
-- grants that the forward migration tightened.

\set ON_ERROR_STOP on

begin;

do $guard$
begin
  if to_regprocedure('lh_rls_private.current_team_role(text)') is null then
    raise exception 'TEAM_MEMBERS_RLS_ROLLBACK_REFUSED: corrective helper is missing';
  end if;
end;
$guard$;

drop policy if exists "laxhornet read team members" on public.team_members;
drop policy if exists "laxhornet insert team members" on public.team_members;
drop policy if exists "laxhornet update team members" on public.team_members;
drop policy if exists "laxhornet delete team members" on public.team_members;

create policy "laxhornet read team members"
on public.team_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.laxhornet_is_team_member(team_id)
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
using (public.laxhornet_team_role(team_id) = 'admin')
with check (public.laxhornet_team_role(team_id) = 'admin');

create policy "laxhornet delete team members"
on public.team_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.laxhornet_team_role(team_id) = 'admin'
);

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

revoke all on function lh_rls_private.current_team_role(text)
  from public, anon, authenticated, service_role;
drop function lh_rls_private.current_team_role(text);
revoke all on schema lh_rls_private
  from public, anon, authenticated, service_role;
drop schema lh_rls_private;

alter table public.team_members no force row level security;
alter table public.team_members enable row level security;

commit;
