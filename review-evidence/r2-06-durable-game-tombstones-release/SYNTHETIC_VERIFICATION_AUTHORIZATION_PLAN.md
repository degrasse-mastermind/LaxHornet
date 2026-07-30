# R2-06/R2-06A bounded production-verification authorization plan

Status: `NOT AUTHORIZED — PLAN ONLY`

Target: `https://laxhornet.mybranford.com/`

Production project: `ulbmjcvnyznvmjgpstno`

Exact runtime to verify:
`2fcc446d5f3d06ca6d24c69bc4466a13794e02b3`

## Requested future authority

Authorize one bounded synthetic production journey using exactly two newly
created disposable adult-safe accounts, one personal game, no event row, no
team/player scope, no Live Share token, and one intentionally permanent
tombstone. Authorization must explicitly cover the mutations in the matrix
below. It must not authorize a deployment, migration, rollback,
schema/configuration change, real-user inspection, release-manifest state
change, or release closeout.

The second account is required to prove authenticated wrong-account denial
without touching a real or previously created identity. Reuse of an existing
account is not part of this plan.

## Execution-tooling boundary

- RPC-level behavior and aggregate cleanup may run only from a reviewed,
  synthetic-only runner whose exact committed SHA is recorded in the future
  authorization evidence.
- The repository is public. Exact synthetic email addresses, UUIDs, game IDs,
  share codes, deletion IDs, device IDs, tokens, and credentials must not be
  committed. The future authorization must name an access-controlled private
  evidence store before execution.
- Auth Admin operations must use an approved ephemeral operator process with
  the secret injected by the environment. The process must never print, save,
  commit, prompt with, or screenshot the secret.
- Normal clean-session hydration may use the deployed application in a fresh
  browser profile.
- The repository does not currently contain a reviewed production harness for
  injecting `newer_game_revision` into the client recovery path. Do not invent
  that browser flow. Production authorization therefore covers the RPC conflict
  and normal hydration checks only. Existing local tests remain the evidence
  for reversible client recovery and preservation of individual-event deletion
  markers.
- Stop before any production mutation if the reviewed runner, secure Auth
  route, or exact cleanup procedure is unavailable.

## Synthetic identities and credentials

Create exactly two Auth users:

1. Owner: `r206-smoke-owner-<UTC>-<nonce>@example.invalid`.
2. Challenger: `r206-smoke-challenger-<UTC>-<nonce>@example.invalid`.

Both accounts:

- are disposable personal `tracker` accounts with no team membership, player
  claim, roster link, access request, phone, or real identity;
- use generated 32-byte random passwords held only in process memory;
- use no user-editable metadata for authorization;
- create exactly one automatic `public.user_profiles` row each;
- use unmistakably synthetic adult-safe profile values;
- have credentials destroyed immediately after session revocation and account
  deletion.

Create three sign-in sessions in sequence: initial owner, challenger, and a
fresh-profile owner reconstruction after the initial owner session is revoked.
Do not refresh tokens intentionally. Revoke all sessions before deleting either
Auth user; deleting an Auth user alone is not session-revocation evidence.

## Exact game and operation payload

Use one unique prefix:
`r206-smoke-<UTC compact timestamp>-<128-bit random hex>`.

The guarded write uses:

- `operation_id`: `<prefix>-write-a`, then `<prefix>-write-b`;
- `device_id`: `<prefix>-device`;
- `payload_revision`: `1`, then `2`;
- `game_row.id`: `<prefix>-game`;
- `player_id`: `<prefix>-player`;
- `user_id`: the owner UUID;
- `share_code`: a unique random synthetic value retained only until deletion;
- `is_shared`: `false`;
- `opponent`: `R2-06 SYNTHETIC DO NOT USE`;
- `game_date`: the execution UTC date;
- `location`: `SYNTHETIC`;
- `game_type`: `synthetic-verification`;
- `period_format`: `quarters`;
- `player_snapshot`: adult-safe synthetic values using the same player ID;
- `current_quarter`: `Q1`;
- `status`: `in-progress`;
- `created_at`: execution timestamp `T0`;
- `saved_at`: `T1` on create and later `T2`, where `T2 > T1`;
- `ended_at`, `team_id`, and `roster_player_id`: `null`.

Verify the guarded RPC returns `accepted / legacy_game_write_accepted`, the
expected `gameId`, `payloadRevision`, and `savedAt`. Verify the owner can read
exactly one matching row and the challenger/anonymous roles cannot read it.

Create no `public.events` row. Full injected client event-recovery verification
is outside this production plan until separately reviewed tooling exists.

## Ordered behavior checks

1. Reconfirm runtime, Pages artifact, migration ledger, catalog definitions,
   RLS/grants, function hashes, trigger, shared lock ordering, aggregate
   tombstone count, and zero `r206-smoke-*` residue.
2. Create the two users/profiles and initial owner/challenger sessions.
3. As owner, create the one personal game through
   `laxhornet_sync_game(jsonb)` at `payload_revision=1`.
4. Prove anonymous direct-table/RPC denial. As challenger, prove direct
   game/tombstone/event reads return no owner rows, the durable delete returns
   `rejected / authorization_denied`, and a guarded write cannot alter the
   owner game.
5. As owner, update the same game at `payload_revision=2` and `saved_at=T2`.
6. Submit deletion ID A with `known_game_saved_at=T1`. Require
   `conflicted / newer_game_revision`; the game must remain at `T2`.
7. Submit deletion ID A with `known_game_saved_at=T2`. Require
   `accepted / game_deleted`; the game must be absent and the tombstone count
   must increase by exactly one.
8. Replay deletion ID A. Require `accepted / game_delete_replayed`; no second
   tombstone or mutable game row may appear. The replay is expected to update
   only the retained tombstone's `updated_at`.
9. Submit deletion ID B. Require `conflicted / game_already_deleted` with no
   row-count change.
10. Submit the stale guarded write for the deleted game. Require
    `conflicted / game_deleted` with no resurrection.
11. Revoke the first owner session, sign in from a fresh browser profile, and
    run normal cloud hydration. Require the tombstone to be fetched before
    upload/merge and the deleted game to remain suppressed.
12. Confirm the unique share code returns no public Live Share payload, no
    public recap/share action was invoked, no Live Share token exists, no
    anonymous payload contains the identifiers, and the static Pages artifact
    contains no dynamic synthetic identifier.
13. Reconfirm challenger and anonymous denial against the retained tombstone.
14. Revoke all remaining sessions, delete both Auth users through the approved
    Auth Admin route, confirm both profile rows are removed, and clear the
    isolated browser profiles/local synthetic state.
15. Record zero mutable/auth residue and exactly one retained tombstone. Create
    the three sanitized repository evidence files and one access-controlled
    private retained-identifier record named in the matrix. Do not change the
    release manifest or closeout fields without separate review and authority.

## Exact authorization matrix

| Seq. | System | Action | Object type | Exact count | Lifecycle | Purpose / expected result | Cleanup / residual data | Rollback limitation | Stop condition |
| ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| 1 | Supabase Auth | Create owner | `auth.users` | 1 | Temporary | Isolated owner account | Revoke sessions, then Admin delete; owner UUID remains only inside the tombstone | Deletion does not itself revoke issued tokens | Secure Auth route or cleanup unavailable |
| 2 | Supabase Auth | Create challenger | `auth.users` | 1 | Temporary | Authenticated wrong-account denial | Revoke sessions, then Admin delete; no retained challenger row | Same token-revocation limitation | Account cannot remain isolated |
| 3 | Postgres | Automatic profile creation | `public.user_profiles` | 2 | Temporary | Adult-safe tracker profiles | Remove through verified account cleanup/cascade; zero remain | Do not directly improvise profile deletion | Profile lifecycle differs from expected |
| 4 | Supabase Auth | Sign in | sessions and initial refresh tokens | 3 sequential sessions | Temporary | Owner, challenger, clean-owner reconstruction | Revoke every synthetic session/token before user deletion; zero remain | Provider-internal rows are not release evidence by themselves | Any credential appears in output or cannot be revoked |
| 5 | Postgres RPC | Guarded create | `public.games` | 1 insert | Temporary | `accepted / legacy_game_write_accepted`, revision 1 | Later durable delete removes it | Must not direct-delete as cleanup | More than one game or wrong owner/scope |
| 6 | Postgres | Event creation | `public.events` | 0 | Prohibited | No event is required for the bounded RPC journey | Nothing to clean | Client event-recovery production evidence remains out of scope | Any event row appears |
| 7 | Postgres RPC | Challenger/anonymous denial probes | game/tombstone/event/RPC writes | 0 accepted mutations | Non-mutating | No owner row disclosed; delete denied; guarded write cannot alter owner row | Nothing to clean | A denial probe must not be repaired by broadening grants | Any unauthorized read or write succeeds |
| 8 | Postgres RPC | Guarded update | `public.games` | 1 update of the same row | Temporary | Revision 2 at `T2` accepted | Later durable delete removes it | Only the same game may change | Identity, owner, or row count differs |
| 9 | Postgres RPC | Stale delete A | `public.games` / tombstone | 0 mutations | Non-mutating | `conflicted / newer_game_revision`; game retained | Nothing to clean | Do not retry with altered real data | Newer row removed or altered |
| 10 | Postgres RPC | Current delete A | game plus tombstone | 1 game delete + 1 tombstone insert | Tombstone permanent | `accepted / game_deleted` | Game absent; tombstone intentionally retained | Tombstone must never be deleted or rolled back | Count delta is not exactly +1 |
| 11 | Postgres RPC | Same-ID replay A | retained tombstone | 1 update to `updated_at` | Permanent row update | `accepted / game_delete_replayed`; one tombstone only | No cleanup; same tombstone remains | Replay is intentionally not byte-static | Second tombstone or game appears |
| 12 | Postgres RPC | Different-ID replay B | game/tombstone | 0 mutations | Non-mutating | `conflicted / game_already_deleted` | Nothing to clean | Do not replace retained deletion identity | Any row changes |
| 13 | Postgres RPC | Stale guarded write | game/tombstone | 0 mutations | Non-mutating | `conflicted / game_deleted` | Nothing to clean | Game ID is permanently reserved | Game resurrection |
| 14 | Deployed app | Clean-session hydration | browser-local state | 1 isolated fresh profile | Temporary local | Tombstone precedes merge; game remains suppressed | Revoke session and delete browser profile | No injected client-conflict harness is authorized | Upload precedes tombstone read or game returns |
| 15 | Public disclosure | Do not create / verify absent | Live Share token, public recap, public payload | 0 | Prohibited | No public disclosure or token | Nothing to revoke | No token may be created merely to test revocation | Any private identifier becomes public |
| 16 | Supabase Auth | Revoke/sign out | synthetic sessions/tokens | all 3 created sessions | Cleanup | Old credentials and application authority fail | Zero synthetic sessions/refresh authority | JWT bytes may remain cryptographically unexpired; authority must still fail | Any old credential retains application authority |
| 17 | Supabase Auth | Delete users | `auth.users` | 2 | Cleanup | Both disposable accounts removed | Zero synthetic users; tombstone UUID is retained inert metadata | Permanent tombstone is deliberately not FK-bound | User deletion blocked or incomplete |
| 18 | Postgres | Account cleanup/cascade | `public.user_profiles` | 2 | Cleanup | Both synthetic profiles absent | Zero profiles remain | Do not delete unrelated profiles | Count is nonzero or target uncertain |
| 19 | Browser | Clear isolated state | local operations/recovery/cache | 2 isolated profiles | Cleanup | Zero synthetic local mutable state | No server residue affected | Local deletion is not server cleanup proof | Scope cannot be isolated |
| 20 | Public repository/GitHub | Record sanitized evidence | authorization, behavior, cleanup evidence files | 3 | Permanent public-safe evidence | Authorization scope, aggregate result, hashed identifier bindings, and zero-residue proof recorded | Retain under the R2-06 evidence directory; no exact identifiers | Manifest/closeout update remains separately authorized | Evidence contains an email, UUID, exact synthetic ID, share code, token, secret, or private real data |
| 21 | Approved private evidence store | Record retained identifiers | access-controlled retained-identifier ledger record | 1 | Permanent private evidence | Exact owner UUID, game ID, deletion ID, device ID, tombstone timestamps, and public-file hash bindings recorded | Retain with least-privilege access; reference only its opaque evidence ID publicly | The permanent tombstone and private ledger record are intentional residue | Authorization does not name the store or access controls |

The three future public-repository evidence files are:

- `PRODUCTION_SYNTHETIC_AUTHORIZATION.md`;
- `PRODUCTION_SYNTHETIC_VERIFICATION_RESULTS.json`;
- `PRODUCTION_SYNTHETIC_CLEANUP_RESULTS.json`.

They must contain only aggregate counts, outcomes, timestamps, SHA-256 bindings,
and an opaque reference to the one private retained-identifier record. The
exact identifiers belong only in the private store named by the authorization.

## Expected retained residue

Exactly one `public.legacy_game_tombstones` row remains. It permanently retains
the synthetic game ID, owner/deleter UUID, deletion ID, device ID,
`known_game_saved_at`, and deletion/audit timestamps. No Auth foreign key is
retained. No game, event, profile, Auth user, session authority, Live Share
token, team, roster, claim, access request, notification, Storage object, or
server append-only operation row is expected.

The legacy game RPCs do not create server append-only operation rows. Their
durable client operation/recovery records are browser-local and are cleared
only after the server and Auth cleanup proof is complete.

## Stop conditions

Stop immediately without cleanup improvisation if:

- runtime identity, Pages artifact identity, migration history, catalog
  definitions, RLS, grants, function hashes, trigger, or lock ordering differs;
- the aggregate tombstone count or any `r206-smoke-*` count changes before the
  run;
- the reviewed runner, secure Auth Admin route, exact cleanup path, or named
  access-controlled private evidence store is absent;
- the two accounts, one game, and zero-event scope cannot be isolated;
- a real user, game, team, player, event, token, or private row could be read or
  affected;
- credentials, tokens, or secrets appear in output or cannot be contained;
- an operation returns an unclassified result;
- same-ID replay is not deterministic, different-ID replay does not conflict,
  or stale write is accepted;
- a conflict removes the newer game, hydration resurrects the game, or
  disclosure exposes any private identifier;
- the permanent residue would exceed one tombstone;
- cleanup would require deleting the tombstone or changing schema, RLS, grants,
  functions, triggers, Auth configuration, or Storage policy; or
- any mutable/auth residue cannot be proven zero.

Successful execution would satisfy bounded production behavior evidence only.
It would not resolve migration actor attribution, retroactively authorize the
observed release, authorize another deployment, or mark R2-06 production
verified or release-complete.
