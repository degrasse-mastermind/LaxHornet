# R2-06/R2-06A bounded production-verification authorization plan

Status: `NOT AUTHORIZED — PLAN ONLY`

Target: `https://laxhornet.mybranford.com/`

Production project: `ulbmjcvnyznvmjgpstno`

Exact runtime to verify:
`2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`

## Requested future authority

Authorize one bounded synthetic production journey using only generated
adult-safe labels and IDs. Authorization must explicitly cover creation,
mutation, deletion, read-back, cleanup, and the one permanent tombstone
described below. It must not authorize a deployment, migration, rollback,
schema/configuration change, real-user inspection, or release closeout.

## Preconditions

- Reconfirm the runtime source and Pages artifact identity.
- Reconfirm both migration versions and the bounded catalog/RLS/grant snapshot.
- Reconfirm tombstone count and record the aggregate starting count.
- Use an approved dedicated synthetic owner account. If none exists, creation
  of exactly one Auth user and its automatic `user_profiles` row requires
  explicit Auth/data authority.
- Use anonymous access for public-denial checks. A cross-account authenticated
  denial check requires one separately approved existing synthetic non-owner;
  do not use a real account and do not create a second account without explicit
  authority.
- Use unique `r206-smoke-<timestamp>-<random>` identifiers and `.invalid`
  contact data. Do not use a real child, player, family, team, or opponent.

## Exact production records

Maximum mutable rows created by the plan:

| Object | Count | Lifecycle |
| --- | ---: | --- |
| `auth.users` synthetic owner | 0 or 1 | Reuse an approved synthetic account; otherwise create exactly one only if authorized, then remove after session teardown. |
| `public.user_profiles` synthetic owner profile | 0 or 1 | May be created automatically with the Auth user; remove only through the approved account-cleanup procedure. |
| `public.games` synthetic personal game | 1 | Created through `laxhornet_sync_game(jsonb)` and removed through `laxhornet_delete_game_durable(jsonb)`. |
| `public.events` synthetic event | 0 or 1 | Create only if the event-conflict recovery journey requires it; remove with the accepted game deletion/cascade. |
| local durable operation/recovery records | bounded to the one game | Browser-local only; clear after evidence capture. |
| `public.legacy_game_tombstones` | exactly 1 retained | Permanent and intentionally not deleted. Record the synthetic `game_id`, `deletion_id`, creation time, and inert disclosure state. |

No team, roster player, team membership, player claim, access request,
notification, Live Share token, public audit, or Storage object is needed.
Keep `is_shared=false` throughout.

## Ordered checks

1. Sign in as the synthetic owner and create the one personal synthetic game
   through the guarded write RPC. Confirm `accepted /
   legacy_game_write_accepted`.
2. Update the same game to a newer `saved_at`, then submit an intentionally
   stale durable delete using the older known timestamp. Confirm `conflicted /
   newer_game_revision`; confirm the game and optional event remain.
3. If safely supported by the approved browser procedure, confirm the client
   restores reversible game/event evidence after that conflict and does not
   leave whole-game event-delete markers.
4. Submit the current durable delete with deletion ID A. Confirm `accepted /
   game_deleted`, the game/event rows are absent, and one tombstone exists.
5. Replay deletion ID A. Confirm `accepted / game_delete_replayed` and that no
   second tombstone or mutable game/event row appears.
6. Submit deletion ID B for the same game. Confirm `conflicted /
   game_already_deleted` and no row-count change.
7. Submit a stale guarded write for the deleted game ID. Confirm `conflicted /
   game_deleted`, with no game/event resurrection.
8. Rehydrate a clean local session for the same owner. Confirm the tombstone is
   fetched before upload/merge and the deleted game remains suppressed.
9. In an anonymous session, confirm no tombstone row or private game/event
   payload is readable and neither guarded RPC is executable.
10. If a separately approved synthetic non-owner is available, confirm that
    account cannot read the owner tombstone/game or operate on the ID. Omit
    rather than substituting a real user.
11. Confirm no Live Share token was created, the game never became public, and
    public endpoints disclose no tombstone, private game, event, recovery, or
    operation detail.

## Cleanup and retained evidence

- Sign out and revoke/delete the synthetic owner session/account only through
  the already approved account-cleanup procedure.
- Confirm zero synthetic mutable game/event/profile/Auth residue, subject to
  the exact account path authorized above.
- Clear browser-local synthetic operations, recovery snapshots, and caches.
- Do not delete or alter the durable tombstone.
- Record final aggregate counts and the exact retained synthetic tombstone ID.
- Prove the retained tombstone is inaccessible to anonymous and unauthorized
  users and does not appear in Live Share or public output.

## Stop conditions

Stop without cleanup improvisation if:

- runtime or catalog identity differs from this plan;
- any real-user/private row becomes visible;
- an operation returns an unclassified result;
- a stale write recreates the game;
- a conflict removes the newer game or event;
- the tombstone count changes by more than one;
- cleanup would require deleting the permanent tombstone or changing schema,
  RLS, grants, functions, triggers, Auth configuration, or Storage policy; or
- the only available non-owner account is a real user.

Successful execution of this plan would satisfy bounded production behavior
evidence only. It would not by itself reconcile the release manifest, resolve
migration actor attribution, authorize another deployment, or mark R2-06
production-verified.
