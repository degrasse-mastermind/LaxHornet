begin;

select plan(14);

select has_table(
  'public',
  'legacy_game_tombstones',
  'durable legacy game tombstone table exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.legacy_game_tombstones'::regclass),
  true,
  'legacy game tombstones use RLS'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.legacy_game_tombstones'::regclass),
  true,
  'legacy game tombstones force RLS'
);
select has_function(
  'public',
  'laxhornet_sync_game',
  array['jsonb'],
  'guarded legacy game write RPC exists'
);
select has_function(
  'public',
  'laxhornet_delete_game_durable',
  array['jsonb'],
  'durable game delete RPC exists'
);
select has_trigger(
  'public',
  'games',
  'laxhornet_reject_tombstoned_game_write',
  'legacy game writes are guarded by tombstone trigger'
);
select table_privs_are(
  'public',
  'legacy_game_tombstones',
  'authenticated',
  array['SELECT'],
  'authenticated receives read-only tombstone access'
);
select table_privs_are(
  'public',
  'legacy_game_tombstones',
  'anon',
  array[]::text[],
  'anonymous receives no tombstone access'
);
select ok(
  has_function_privilege('authenticated', 'public.laxhornet_sync_game(jsonb)', 'execute'),
  'authenticated can execute guarded game writes'
);
select ok(
  has_function_privilege('authenticated', 'public.laxhornet_delete_game_durable(jsonb)', 'execute'),
  'authenticated can execute durable game deletes'
);
select ok(
  not has_function_privilege('anon', 'public.laxhornet_delete_game_durable(jsonb)', 'execute'),
  'anonymous cannot execute durable game deletes'
);
select ok(
  not has_table_privilege('authenticated', 'public.games', 'delete'),
  'authenticated direct game deletion is revoked'
);
select policies_are(
  'public',
  'legacy_game_tombstones',
  array['laxhornet read authorized legacy game tombstones'],
  'only the bounded tombstone read policy exists'
);
select col_is_pk(
  'public',
  'legacy_game_tombstones',
  'game_id',
  'a deleted game ID has one permanent tombstone'
);

select * from finish();
rollback;
