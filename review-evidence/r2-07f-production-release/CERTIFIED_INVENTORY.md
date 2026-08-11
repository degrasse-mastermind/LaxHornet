# R2-07F Certified Inventory

All SHA-256 values are over exact Git blob bytes from certified product source
`b7269194a4ce8b9068b0d46c44d840efc4048c69` and are copied from the
independently reviewed R2-07E V2 manifest at evidence SHA
`c2726b0c1cd979a7af2b04bc9a0a25865f4636ea`.

## Ordered migrations

| Migration | SHA-256 |
| --- | --- |
| `20260723000000_laxhornet_legacy_baseline.sql` | `60033de3bc0d92947d6c5389ec36178f20ece4bbd1f5d40884ff3ae933c9f698` |
| `20260723010000_trust_spine_release_1.sql` | `b392b91712c7c2491e5ab6b483619b34d84dcd3b9a834aef960a079ee034920d` |
| `20260723010607_remote_schema.sql` | `eee50c8cddc00dcec0171f1cadc3937d6ca8473a023c68c6858609f6813520f9` |
| `20260723020000_minimum_necessary_disclosure.sql` | `c43a562eccf4c8fd08305675b8d42e4b2d7cea58a71ece3b78df8c99a4e242a6` |
| `20260723030000_fix_disclosure_audit_and_evidence_validation.sql` | `968f8eeccbbd0252e41d3ec62ffded2b1e04cca5eead85ab3e6f4c171441ac4b` |
| `20260723040000_event_pipeline_capabilities.sql` | `7d220e88a1e742c8e79f1dfcf54e4b370a85f1363c657e6f9d02aa0527ed8c69` |
| `20260727000000_tracked_playing_time_operations.sql` | `623be1072d4ebfe579177a4001f535e245c05a22dcdb302e05c6ae70382cbffa` |
| `20260728193942_v284_public_event_semantic_boundary.sql` | `2c5f5fed62fb9d70634b8c47f121d949a22e57703f79af99caa8019c135caa78` |
| `20260730004700_team_members_rls_recursion.sql` | `497025b8965e574216ba6f4df947ca135644d281dec5ccc823b89c8b39c1fd03` |
| `20260730134439_durable_game_tombstones.sql` | `fd0b84fa2772b331b9ff01ae600e0de4cfffaf963dfb741185ff02744e9246fa` |
| `20260730151714_durable_game_tombstone_concurrency.sql` | `75c58e3dcd8dac2d23f5a296bb5112870e18ba6f7f395f53a8557821fe5dd7b0` |
| `20260806143128_r207a_dormant_concurrency_foundation.sql` | `be91fd3be313d20b8a4d51857c616e052dbf49e9348dbf3018efadae6340d800` |
| `20260809155442_r207b_controlled_preview_integration.sql` | `f1a33e478f9bdd6f203a3170522064e5e49a6a202db3c160ca0ba761731bc82e` |
| `20260809164435_r207b_qualify_preview_game_update.sql` | `40c502d3cd95e11717935d12d3655cb0822558cde556a51d7bc38ef4367c7a34` |
| `20260809173500_r207c_versioned_event_corrections.sql` | `300c94b440ea9e03e0b6916e11d64459f9b065e98f6960b7e06bc64470411f21` |
| `20260809201608_r207d_conflict_resolution_foundation.sql` | `586f46373c6068a050083aff1034d7e661d5b5f046afe88d5a481d8f095894dd` |
| `20260811010813_r207_clock_command_batch_integration.sql` | `c09cbb8988418d24c42c3882f21a465fd4365561c14cada64a3bd4dc20998409` |

Production read-only history contains all 17 versions. No migration was applied.

## Ordered rollback references

| Rollback | SHA-256 |
| --- | --- |
| `20260723010000_trust_spine_release_1_rollback.sql` | `4b947cf6be78159454f66ef4b6f98c99266cf82255c6abd522dee9c91381e02f` |
| `20260723020000_minimum_necessary_disclosure_rollback.sql` | `40bc028fb536c1b1bf00ff1ac75a4c24fc7ae29a7f66ba155f6537a6313b4cde` |
| `20260723040000_event_pipeline_capabilities_rollback.sql` | `4a4f3d4db7e2cf05883af016551eaeef110a23ee91445941989f5cb5542306e6` |
| `20260727000000_tracked_playing_time_operations_rollback.sql` | `43871a66c8d41902e455f68a495977150c4d4f4620e29e22c7f1cb807916bf3d` |
| `20260728193942_v284_public_event_semantic_boundary_rollback.sql` | `a773663b7da1bdff905bfdc3db1699b6944349897b8bcfa3993d6d52cc69dccc` |
| `20260730004700_team_members_rls_recursion_rollback.sql` | `aad75d8909d7092f9eb5e4036af358d69e640cd2006d9484aa7798daee06a37b` |
| `20260730134439_durable_game_tombstones_rollback.sql` | `97e995995a11ffb89c628929e6ede9d576e3d3ba744a8b996d2782a4368490ff` |
| `20260730151714_durable_game_tombstone_concurrency_rollback.sql` | `802b11dd8ecbc2c0eb80cb12310246824fd3ac182b583e2cf7f9d7c144639699` |
| `20260806143128_r207a_dormant_concurrency_foundation_rollback.sql` | `28b8589f2bbb7f2126521ab4ba185450981151baacfbff07d58dd35d5ef5b5e4` |
| `20260809155442_r207b_controlled_preview_integration_rollback.sql` | `1a5ee0e79821c75d216237973db6480541d99e89d6bd9da586aaa78edbd8f9ef` |
| `20260809164435_r207b_qualify_preview_game_update_rollback.sql` | `ed862144fff4ae3e8937168d255bbd51eeb4dd3f8d35d8a11301d63b3883943f` |
| `20260809173500_r207c_versioned_event_corrections_rollback.sql` | `f7c34ba2598e4fd1a1c849a868488ffa244c3bef873cb1dc98efad5d0f599249` |
| `20260809201608_r207d_conflict_resolution_foundation_rollback.sql` | `57b550f5a136a610c85e89912cd8322239fd220456dbb4446be223da35e5bd2b` |
| `20260811010813_r207_clock_command_batch_integration_rollback.sql` | `8548bbe4e91f506a2222bfe7feab826d4e5725dcfe98ac98098075b3484e1c93` |

The independently reviewed source of truth remains the R2-07E V2 manifest at
`c2726b0...`. No rollback was executed.

## Runtime and release artifacts

| Artifact | SHA-256 |
| --- | --- |
| `app.html` | `c0978064416e0306129a85feb5a34b61a2138d3f3771eb54939da718143739a7` |
| `app.js` | `4ca6348e2ad44e4f70f4e8a3f18ef78dfa091498d875bd517760b822714bc8e6` |
| `event-operation-service.js` | `3c33cf2d47c17cfd1b3d4a1ffbeb333f9d98230c56becf3f7e50c0e85b4c96c5` |
| `tracked-playing-time-service.js` | `73e55689216c92c0746990ceaba8f253aa4d44b4016619973a310f8e864e8992` |
| `runtime-config.js` | `44f0d30dc98f2ebdf053f1677027d67dbb3d312d6ff331c8d809e38fc0344135` |
| `service-worker.js` | `8cd72d78732bd72f88c64ae5a98034943b7948c8d2ad120c4cffbc73a37b2693` |
| `version.json` | `be15d2ac52bc2e677cbecc667857af5187792dacafd1f494d41f46cd8eff070a` |
| `release/laxhornet-release-manifest.json` | `22eeed2cc3cbf3e9331052c8347b2c85b2938831191a33b3fb63f73a536cd7a3` |

Release marker: `v285`. Cache marker: `laxhornet-v285`. All R2-07 client
capability flags in the certified runtime are `false`.
