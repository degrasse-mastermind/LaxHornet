# Trust Spine Test Plan

Status: precise test plan tied to current repository paths. No tests were added or run against production in this gate.

## Test targets

Current files to target:

- `app.js`
  - client visibility: `canShowGameForCurrentAccess`, `visiblePlayers`, `canEditGame`
  - sync: `loadCloudGames`, `syncGameToSupabase`, `syncLoggedEvent`, `flushDeletedCloudRecords`
  - deletion: `confirmDeleteGame`, `deleteEvent`, `deleteSupabaseGame`, `deleteSupabaseEvent`
  - Live Share: `loadSharedGame`, `subscribeToSharedGame`, `renderSharedGame`
  - export/import: `exportCSV`, `exportJSON`, `importJSONFile`
- `supabase-schema.sql`
  - grants: lines around `224-238`
  - RLS policies: lines around `1954-2239`
  - delete RPCs: lines around `1599-1709`
  - access request/claim RPCs: lines around `796-1119`
  - realtime publication: lines around `2241-2269`
- Future staging SQL: `docs/methodnorth/trust-spine-gate/TRUST_SPINE_SCHEMA_PROPOSAL.sql`

## Required security tests

Use real authenticated sessions in staging:

1. Parent reads assigned player's ordinary game evidence: allow.
2. Parent reads another player on same team: deny.
3. Parent reads another team: deny.
4. Parent reads coach-only context: deny.
5. Team-scoped coach reads team evidence: allow.
6. Player-scoped coach reads full roster: deny.
7. Team admin manages roster: allow.
8. Team admin creates coach context without coach grant: deny.
9. Pending invitation reads protected records: deny.
10. Revoked grant reads protected records: deny.
11. User spoofs `author_role=coach`: deny or ignore client label.
12. Direct event row update through PostgREST: deny after cutover.
13. Direct event row delete through PostgREST: deny after cutover.
14. Authorized correction RPC appends revision: allow.
15. User updates prior revision row: deny.
16. User deletes prior revision row: deny.
17. Cross-team correction attempt: deny.
18. Live Share reads public-safe projection: allow.
19. Live Share reads revision/context/note/internal state: deny.
20. Duplicate offline operation replay: one accepted operation only.
21. Same-field concurrent correction: preserve both; flag conflict.
22. Different-field concurrent correction: merge if policy allows; preserve both.
23. Offline correction after revocation: reject; preserve local draft.
24. Offline edit against tombstoned event: reject or conflict; never resurrect.

## Live Share regression tests

1. Create shared game with public-safe events.
2. Query share endpoint unauthenticated.
3. Assert allowed fields only.
4. Add private note/tag/revision in staging.
5. Assert private fields are absent from share response and realtime payload.
6. Revoke Live Share and assert share code no longer returns game.

## Export regression tests

1. Backup export includes expected private data only for authenticated owner/admin use.
2. Family/share export excludes private notes, private process tags, revision author, internal states, and coach context.
3. Sensitive export audit event is inserted.
4. Import does not bypass authority or directly publish imported evidence without accepted sync/correction.

## Offline sync tests

1. Create event offline, reconnect, assert accepted once.
2. Replay same operation ID, assert no duplicate event/revision.
3. Edit event offline while another device edits same field, reconnect, assert conflict.
4. Edit different fields concurrently, assert merge only if policy permits.
5. Delete/tombstone event on device A, edit offline on device B, reconnect, assert no resurrection.
6. Revoke parent access while offline, reconnect, assert rejected_authority_changed and local draft preserved.

## App regression tests

Because the current app is static, at minimum run:

- `git diff --check`
- local browser smoke for `index.html`
- local browser smoke for `app.html`
- existing manual QA flows for:
  - login
  - request player access
  - admin approve
  - live tracking
  - review edit/tags/delete
  - Live Share
  - CSV/JSON export/import
  - offline capture/update banner

When executable tests are added, prefer Playwright for app flows and SQL/RLS tests with isolated staging fixtures.
