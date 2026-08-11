# R2-07E Exact-SHA Baseline Manifest

Status: `BOUND BEFORE CERTIFICATION EXECUTION`

- Certification baseline: `08e7abf01d22cb60fc88422c961104a952b9b7e9`
- Baseline tree: `708c6a7dad9b65248f90ae566616f6be50101439`
- R2-07D PR head: `72e9d745e469cf1bb0ea713c8bbdbe19870483bb`
- PR-head/merge tree identity: `EXACT MATCH`
- Branch: `feature/r2-07e-integrated-certification`
- Release marker: `v285`
- Service-worker cache marker: `laxhornet-v285`
- Runtime capabilities: R2-07B `false`; R2-07C `false`; R2-07D `false`
- Production-write activation: `DORMANT`

The user explicitly ratified a governance exception on 2026-08-10 after the
R2-07D exact-tree independent technical PASS was necessarily completed after
PR #69 had already been squash-merged. This does not rewrite the historical
review chronology. It authorizes R2-07E disposable certification only and does
not authorize production mutation, deployment, activation, or R2-07F.

All hashes below are SHA-256 over exact Git blob bytes obtained from
`git show 08e7abf01d22cb60fc88422c961104a952b9b7e9:<path>`. They are not hashes
of the Windows working-tree representation.

## Ordered R2-07 migrations

| Path | SHA-256 |
| --- | --- |
| `supabase/migrations/20260806143128_r207a_dormant_concurrency_foundation.sql` | `be91fd3be313d20b8a4d51857c616e052dbf49e9348dbf3018efadae6340d800` |
| `supabase/migrations/20260809155442_r207b_controlled_preview_integration.sql` | `f1a33e478f9bdd6f203a3170522064e5e49a6a202db3c160ca0ba761731bc82e` |
| `supabase/migrations/20260809164435_r207b_qualify_preview_game_update.sql` | `40c502d3cd95e11717935d12d3655cb0822558cde556a51d7bc38ef4367c7a34` |
| `supabase/migrations/20260809173500_r207c_versioned_event_corrections.sql` | `300c94b440ea9e03e0b6916e11d64459f9b065e98f6960b7e06bc64470411f21` |
| `supabase/migrations/20260809201608_r207d_conflict_resolution_foundation.sql` | `586f46373c6068a050083aff1034d7e661d5b5f046afe88d5a481d8f095894dd` |

## Ordered R2-07 rollbacks

| Path | SHA-256 |
| --- | --- |
| `supabase/rollback/20260806143128_r207a_dormant_concurrency_foundation_rollback.sql` | `28b8589f2bbb7f2126521ab4ba185450981151baacfbff07d58dd35d5ef5b5e4` |
| `supabase/rollback/20260809155442_r207b_controlled_preview_integration_rollback.sql` | `1a5ee0e79821c75d216237973db6480541d99e89d6bd9da586aaa78edbd8f9ef` |
| `supabase/rollback/20260809164435_r207b_qualify_preview_game_update_rollback.sql` | `ed862144fff4ae3e8937168d255bbd51eeb4dd3f8d35d8a11301d63b3883943f` |
| `supabase/rollback/20260809173500_r207c_versioned_event_corrections_rollback.sql` | `f7c34ba2598e4fd1a1c849a868488ffa244c3bef873cb1dc98efad5d0f599249` |
| `supabase/rollback/20260809201608_r207d_conflict_resolution_foundation_rollback.sql` | `57b550f5a136a610c85e89912cd8322239fd220456dbb4446be223da35e5bd2b` |

## Runtime and release artifacts

| Path | SHA-256 |
| --- | --- |
| `app.html` | `c0978064416e0306129a85feb5a34b61a2138d3f3771eb54939da718143739a7` |
| `app.js` | `2c52cca9e12d74b8564d44eedb8d9c049c5172fdb9d8f0e087fc84a549c73a86` |
| `event-operation-service.js` | `1513662c3d070374b07f5b177d89bf5f17448797ffccfbda57258bede5952745` |
| `runtime-config.js` | `fa92601060bbdb248a990b983535f2b72677e90351693c4d4b0cc197ae4ac457` |
| `service-worker.js` | `8cd72d78732bd72f88c64ae5a98034943b7948c8d2ad120c4cffbc73a37b2693` |
| `version.json` | `be15d2ac52bc2e677cbecc667857af5187792dacafd1f494d41f46cd8eff070a` |
| `release/laxhornet-release-manifest.json` | `22eeed2cc3cbf3e9331052c8347b2c85b2938831191a33b3fb63f73a536cd7a3` |

## Environment boundary

Certification is limited to synthetic adult identities and disposable
PostgreSQL 17 containers plus isolated local browser contexts. Production
Supabase, production credentials/data, production Vercel, GitHub Pages,
release markers, and production runtime configuration are excluded.
