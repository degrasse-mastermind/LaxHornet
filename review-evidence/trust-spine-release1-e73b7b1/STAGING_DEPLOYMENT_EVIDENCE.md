# Staging Deployment Evidence

Checked: 2026-07-20

## Connected Supabase environment

Project reference:
`ulbmjcvnyznvmjgpstno`

Read-only database probe:

```json
{
  "database_name": "postgres",
  "database_user": "supabase_read_only_user",
  "current_schema": "public",
  "trust_spine_public_tables": 0
}
```

Branch inventory:

```json
{
  "branches": [
    {
      "name": "main",
      "project_ref": "ulbmjcvnyznvmjgpstno",
      "is_default": true,
      "git_branch": "main",
      "status": "FUNCTIONS_DEPLOYED",
      "preview_project_status": "ACTIVE_HEALTHY"
    }
  ]
}
```

No separate staging branch exists.

Migration inventory:

```json
{"migrations":[]}
```

Trust Spine function inventory:

```json
[]
```

The connected project currently contains the legacy LaxHornet tables only:
`games`, `events`, `teams`, `team_members`, `roster_players`, `user_profiles`,
`team_access_requests`, `player_claims`, and `notification_queue`.

## Migration logs

No remote staging migration was applied, so there are no legitimate remote
migration logs to provide. Creating a paid Supabase branch was deliberately not
performed without a cost confirmation.

The local migration and rollback logs are in `test-results/`.

## Supabase advisors

The advisor results describe the current legacy production schema, not the
unapplied Trust Spine migration.

Security advisor findings include:

- Multiple existing `SECURITY DEFINER` functions are executable by
  `authenticated`. Each needs an intentional public-RPC review.
- Leaked-password protection is disabled.

References:

- [SECURITY DEFINER executable lint](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

Performance advisor findings include:

- Unindexed foreign keys on `team_access_requests.reviewed_by` and
  `user_profiles.reviewed_by`.
- Several unused-index informational notices.

Reference:

- [Unindexed foreign keys lint](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

These advisor results do not validate the Trust Spine objects because those
objects are absent from the connected database.

## Manual dashboard changes

None were made during this evidence run.

## Conclusion

Remote staging deployment evidence is **not available because deployment did
not occur**. The repository implementation and isolated local rehearsal are
available. A disposable staging branch remains a release gate.
