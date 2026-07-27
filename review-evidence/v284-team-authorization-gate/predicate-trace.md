# Failed Predicate Trace

Failed production fixture prefix:
`v284-smoke-ms3fexpj-6afce422`

The earlier confirming run used:
`v284-smoke-ms3fee0d-66d1837a`

| Predicate | Required value | Synthetic fixture value | Result | Evidence |
| --- | --- | --- | --- | --- |
| Input shape | Reviewed clock allowlist and required fields | Valid reviewed payload | Pass | RPC returned `unauthorized_scope`, not `invalid_input` |
| Authenticated subject | Non-null `auth.uid()` | Authenticated synthetic account | Pass | RPC returned scope denial, not `unauthorized` |
| Canonical game | Existing team-roster game | Synthetic team game existed during call | Pass | Retained game scope records exact game/team/player identity |
| Canonical team/player | Existing active player on same team | Synthetic team and active roster player existed during call | Pass | Scope registration succeeded and retained snapshots remain |
| Legacy registration relationship | Same-team legacy admin membership or exact player claim | Same-team legacy membership with role `admin` | Pass | Rollout fixture definition and successful scope registration |
| Game scope identity | Exact game/team/roster-player tuple | Exact retained tuple | Pass | `lh_game_scopes` retained the expected tuple |
| Grant subject | Grant belongs to caller | Same synthetic user | Pass | Sanitized grant/user reference matched |
| Grant lifecycle | Latest event `accepted` at call time | Issued then accepted; revoke appended only during cleanup | Pass | Retained lifecycle sequences `1/2/3` |
| Grant expiration | Null or future | `expires_at` null | Pass | Retained grant |
| Mutation role | `parent` or `coach` | `team_admin` | **Fail** | `lh_mutation_grant_for_game` has no team-admin branch |

## Exact return path

1. `public.lh_initialize_game_clock(jsonb)` delegates to
   `lh_initialize_game_clock_impl`.
2. The implementation validates the authenticated subject and input.
3. No existing team clock was found.
4. `lh_tracked_time_initialize_scope(actor_id, game_id)` loads the canonical
   game.
5. `lh_register_game_scope_impl(game_id)` accepts the legacy admin relationship
   and canonical team/player identity.
6. `lh_mutation_grant_for_game(actor_id, game_id)` returns `null` because the
   active grant role is `team_admin`.
7. `lh_tracked_time_initialize_scope` returns no row.
8. `lh_initialize_game_clock_impl` returns `unauthorized_scope`.

The first failing predicate is therefore the mutation-role allowlist, not
authentication, acceptance, revocation timing, expiration, game identity,
player identity, or production schema drift.
