# Authorization Call Graph

Status: current-state inventory and Release 1 Trust Spine target.

## Current client-side gates

Client-side checks live in `app.js`. These checks shape UI and local filtering but are not security boundaries.

```text
render/select surface
  -> visiblePlayers()
    -> visibleRosterPlayers()
      -> canTrackRosterPlayer(teamId, rosterPlayerId)
  -> visibleGames()
    -> canShowGameForCurrentAccess(game)
  -> canEditGame(game)
    -> canTrackRosterPlayer(teamId, rosterPlayerId)
```

Known functions:

- `canTrackPlayer()` in `app.js:1177-1181`.
- `canShowGameForCurrentAccess()` in `app.js:1183-1196`.
- `visibleRosterPlayers()` in `app.js:1198-1202`.
- `visiblePlayers()` in `app.js:1213-1221`.
- `canEditGame()` in `app.js:1223-1227`.

Client-side current behavior:

- Non-team/local players are always trackable.
- Team players depend on roster-player claim/team access helpers.
- `isPlatformReviewer()` bypasses most client filters.
- Deleted local IDs hide rows locally.

LH-00 finding: useful for UX, but not sufficient. The Trust Spine requires backend-enforced visibility and write authority.

## Current Supabase role and profile resolution

Current role sources:

```text
auth.uid()
auth.jwt().email
user_profiles.approved_role/admin_status
team_members.role
player_claims
hard-coded reviewer email
```

Key RPC/helper functions:

- `laxhornet_is_platform_reviewer()` checks email against `degrassed@gmail.com` in `supabase-schema.sql:264-282`.
- `laxhornet_approved_app_role()` maps reviewer to `admin`, else `tracker` in `supabase-schema.sql:284-303`.
- `laxhornet_my_profile()` returns profile plus reviewer override in `supabase-schema.sql:392-427`.
- `laxhornet_team_role(team_id)` is used throughout RLS/RPCs for admin checks.
- `laxhornet_can_track_roster_player(team_id, roster_player_id)` is used in games/events policies and client sync gates.

LH-00 conflict: Release 1 roles must be `parent`, `coach`, and `team_admin`. Current labels `tracker` and `admin` do not cleanly separate parent authority from coach authority or team administration.

## Current team/player access request flow

```text
parent creates/signs in
  -> user profile
  -> request team/player access with team code and jersey
    -> laxhornet_request_team_player_access(join_code, jersey)
      -> team_access_requests row pending
team admin/reviewer approves
  -> laxhornet_review_team_access_request(request_id, approve)
    -> team_access_requests approved/rejected
    -> team_members row
    -> player_claims row by matching jersey
```

Key lines:

- Request by code: `supabase-schema.sql:796-939`.
- Pending request inbox: `supabase-schema.sql:943-993`.
- Review/approve request: `supabase-schema.sql:1035-1119`.
- Repair approved claims: `supabase-schema.sql:1211-1270`.
- My claims and visible roster players: `supabase-schema.sql:1711-1840`.

Current good property:

- Parent visibility can be player-claim scoped.

Current Trust Spine gaps:

- Invitation/request and active grants are not separated as first-class concepts.
- Parent and coach roles are not distinct.
- Active authority is inferred from `team_members` and `player_claims`, not from a single auditable access-grant primitive.
- Grant/revocation security audit events do not exist.

## Current RLS graph

```text
public.games
  select: anon/authenticated if is_shared OR owner OR can_track_roster_player(team_id, roster_player_id)
  insert/update/delete: authenticated owner or can_track_roster_player

public.events
  select: anon/authenticated if owner OR can_track_roster_player OR parent shared game
  insert/update/delete: authenticated owner or can_track_roster_player

public.roster_players
  select: platform reviewer OR team admin OR matching player_claim
  insert/update/delete: platform reviewer OR team admin

public.team_access_requests
  select: requester OR platform reviewer OR team admin
  insert: requester
  update: platform reviewer OR team admin

public.player_claims
  select: claimant OR platform reviewer OR team admin
  insert: false via table policy; RPC inserts
```

Key lines:

- Table grants: `supabase-schema.sql:224-238`.
- RLS enabled: `supabase-schema.sql:240-248`.
- Team access request policies: `supabase-schema.sql:1970-1988`.
- Player claim policies: `supabase-schema.sql:1990-2002`.
- Team policies: `supabase-schema.sql:2015-2037`.
- Roster policies: `supabase-schema.sql:2070-2099`.
- Game policies: `supabase-schema.sql:2101-2136`.
- Event policies: `supabase-schema.sql:2138-2239`.

## Current privileged functions

Many `SECURITY DEFINER` functions live in exposed `public` and are executable by `authenticated` users in `supabase-schema.sql:1880-1912`.

Current mitigating pattern:

- The schema revokes default execute privileges from future functions in `supabase-schema.sql:1854-1878`.
- `laxhornet_handle_new_user()` is revoked from public/anon/authenticated in `supabase-schema.sql:1913`.

Remaining Trust Spine concern:

- Supabase guidance treats `SECURITY DEFINER` in exposed schemas as high-risk. Release 1 should limit public RPCs to narrow entrypoints and move internal helper functions to a private schema when possible.

## Current server routes

No application server routes are present in the repo. The browser client talks to Supabase directly.

## Release 1 target authorization graph

```text
auth.uid()
  -> trusted RPC/view
    -> resolve active lh_access_grants
      -> role in parent, coach, team_admin
      -> scope constraints
      -> operation-specific authority
        -> return only allowed fields / perform only allowed mutation
```

Release 1 must prove:

- Pending invitation never satisfies authorization.
- Revoked/expired grant never satisfies authorization.
- Parent grant is player-scoped and team-associated.
- Coach grant can be team-scoped or player-scoped but is distinct from team admin.
- Team admin can manage roster/access inside owned scope but does not become coach by implication.
- Client-submitted role labels are ignored for authority.
