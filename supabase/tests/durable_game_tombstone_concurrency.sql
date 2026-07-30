begin;

select plan(6);

select ok(
  pg_get_functiondef('public.laxhornet_sync_game(jsonb)'::regprocedure)
    like '%pg_advisory_xact_lock(%hashtextextended(''laxhornet:legacy-game:'' || incoming.id, 0)%',
  'guarded game writes acquire the namespaced per-game transaction lock'
);
select ok(
  pg_get_functiondef('public.laxhornet_delete_game_durable(jsonb)'::regprocedure)
    like '%pg_advisory_xact_lock(%hashtextextended(''laxhornet:legacy-game:'' || target_game_id, 0)%',
  'durable game deletes acquire the same namespaced per-game transaction lock'
);
select ok(
  pg_get_functiondef('lh_sync_private.reject_tombstoned_game_write()'::regprocedure)
    like '%pg_advisory_xact_lock(%hashtextextended(''laxhornet:legacy-game:'' || new.id, 0)%',
  'direct-write trigger uses the same deterministic lock derivation'
);
select ok(
  strpos(
    pg_get_functiondef('public.laxhornet_sync_game(jsonb)'::regprocedure),
    'pg_advisory_xact_lock'
  ) < strpos(
    pg_get_functiondef('public.laxhornet_sync_game(jsonb)'::regprocedure),
    'from public.legacy_game_tombstones'
  ),
  'guarded write locks before its tombstone read'
);
select ok(
  strpos(
    pg_get_functiondef('public.laxhornet_delete_game_durable(jsonb)'::regprocedure),
    'pg_advisory_xact_lock'
  ) < strpos(
    pg_get_functiondef('public.laxhornet_delete_game_durable(jsonb)'::regprocedure),
    'from public.legacy_game_tombstones'
  ),
  'durable delete locks before its tombstone read'
);
select function_privs_are(
  'lh_sync_private',
  'reject_tombstoned_game_write',
  array[]::text[],
  'public',
  array[]::text[],
  'private direct-write guard is not exposed to public'
);

select * from finish();
rollback;
