-- Recovery rollback for the v284 public-event semantic boundary.
--
-- The prior Live Share implementation was unsafe, so rollback is deliberately
-- fail-closed: it disables anonymous/authenticated public sharing without
-- deleting evidence or restoring the vulnerable function. The safe ingress
-- wrappers remain in place. Reapply the reviewed forward migration before
-- restoring these grants.
begin;

revoke execute on function public.lh_public_live_share_game(text)
  from public, anon, authenticated;

commit;
