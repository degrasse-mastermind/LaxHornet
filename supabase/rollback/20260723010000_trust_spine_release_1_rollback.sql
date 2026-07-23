-- LaxHornet Trust Spine Release 1
-- STAGING-ONLY destructive rollback for the additive lh_* objects.
--
-- Do not run in production. This removes Trust Spine staging evidence,
-- operation receipts, revisions, tombstones, conflicts, grants, and audits.
-- It does not alter or delete any legacy LaxHornet runtime object.

begin;

drop function if exists public.lh_record_sensitive_export(text, text);
drop function if exists public.lh_public_live_share_game(text);
drop function if exists public.lh_tombstone_event(jsonb);
drop function if exists public.lh_correct_event(jsonb);
drop function if exists public.lh_create_event(jsonb);
drop function if exists public.lh_resolve_active_grants();
drop function if exists public.lh_register_game_scope(text);
drop function if exists public.lh_register_player_scope(text, text);
drop function if exists public.lh_register_team_scope(text);

-- CASCADE removes only private helper functions and their triggers on lh_*
-- staging tables. Public wrappers were removed above.
drop schema if exists lh_trust_private cascade;

-- Break the intentional invitation/grant provenance cycle before dropping the
-- two preservation-safe tables in dependency order.
alter table if exists public.lh_access_invitations
  drop constraint if exists lh_access_invitations_issuer_grant_fk;

drop table if exists public.lh_security_audit_events;
drop table if exists public.lh_live_share_tokens;
drop table if exists public.lh_event_annotations;
drop table if exists public.lh_event_revisions;
drop table if exists public.lh_conflict_adjudications;
drop table if exists public.lh_event_conflicts;
drop table if exists public.lh_event_tombstones;
drop table if exists public.lh_event_tombstone_operations;
drop table if exists public.lh_event_correction_operations;
drop table if exists public.lh_event_create_operations;
drop table if exists public.lh_event_operation_attempts;
drop table if exists public.lh_event_operations;
drop table if exists public.lh_event_effective_versions;
drop table if exists public.lh_events;
drop table if exists public.lh_grant_lifecycle_events;
drop table if exists public.lh_access_grants;
drop table if exists public.lh_access_invitations;
drop table if exists public.lh_game_scopes;
drop table if exists public.lh_player_scopes;
drop table if exists public.lh_team_scopes;

commit;
