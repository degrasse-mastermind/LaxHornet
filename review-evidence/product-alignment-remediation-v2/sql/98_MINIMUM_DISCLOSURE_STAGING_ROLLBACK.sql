-- Run this before 99_TRUST_SPINE_BASE_STAGING_ROLLBACK.sql.
-- Disposable staging only.

begin;

grant select on table public.games to anon;
grant select on table public.events to anon;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'games'
      and policyname = 'laxhornet read own or shared games'
  ) then
    execute 'alter policy "laxhornet read own or shared games" on public.games to anon, authenticated';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'laxhornet read own or shared events'
  ) then
    execute 'alter policy "laxhornet read own or shared events" on public.events to anon, authenticated';
  end if;
end;
$$;

drop function if exists public.lh_record_disclosure_export(text, text, text, text);
drop function if exists public.lh_revoke_live_share_tokens(text);
drop function if exists public.lh_create_live_share_token(text, timestamptz);

drop function if exists lh_trust_private.lh_record_disclosure_export_impl(text, text, text, text);
drop function if exists lh_trust_private.lh_revoke_live_share_tokens_impl(text);
drop function if exists lh_trust_private.lh_create_live_share_token_impl(text, timestamptz);

-- Keep the additive token event types in the constraint while this audit table
-- exists. Narrowing the constraint would either fail on valid append-only audit
-- rows or require rewriting/deleting evidence. The base staging rollback drops
-- the entire lh_* package in the next step.

commit;
