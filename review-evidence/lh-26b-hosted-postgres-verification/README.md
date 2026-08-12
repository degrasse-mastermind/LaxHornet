# LH-26B hosted PostgreSQL verification foundation

## Binding

- Starting main: `24b339ac46678dd3fd42c753ab817a311dc6b183`
- Merged PR #77 tree: `5679ba81a2519f671255671a7d40a92de9a4d863`
- Retrospective failure: <https://github.com/degrasse-mastermind/LaxHornet/pull/77#pullrequestreview-4920341769>
- Branch: `codex/lh-26b-hosted-postgres-verification`

## Remediation

- `release/hosted-postgres-verification-map.json` maps every retired suite to
  complementary portable gates and non-substitutable hosted guarantees.
- `tools/run_supabase_preview_server_matrix.mjs` requires exact isolated branch
  identity and exercises real PostgreSQL migration state, authenticated claims,
  RPCs, RLS/FORCE RLS, grants, concurrency, rollback, replay, tombstone, event,
  conflict, and clock/batch contracts.
- `.github/workflows/supabase-preview-server-matrix.yml` retrieves only the
  automatic branch's values and masks them. It refuses production and never
  applies a migration manually.
- `tools/active-executable-graph.mjs` recursively follows active roots and local
  descendants, including `vercel.json` and its build tool.

## Synthetic actors

Each hosted run creates three adult-safe synthetic identities: personal owner,
team/tracker-capable actor reserved for scoped cases, and unrelated actor. Each
run uses a SHA-derived namespace. Mutable fixtures are deleted where safe;
append-only evidence remains only until the disposable Preview is destroyed.

## External gate

At implementation start, GitHub exposed no repository or `Preview` environment
secrets/variables. Therefore no hosted result is recorded here yet. Missing
`SUPABASE_ACCESS_TOKEN` or `SUPABASE_PROJECT_ID`, an unavailable automatic
branch, incomplete branch credentials, or any production identity causes the
workflow to fail. This is a blocker, not a skip or portable-equivalent PASS.

## Published exact-head result

- Initial implementation head: `3a08e2fd2a46cfd22e956b14f495be8971562703`
- Draft PR: <https://github.com/degrasse-mastermind/LaxHornet/pull/79>
- Portable CI: PASS, run `31636860805`
- Credential-free Vercel Preview: PASS
- Hosted matrix: FAIL before mutation, run `31636860903`
- Exact classification: `PREVIEW_CONFIGURATION_REQUIRED` because GitHub
  `Preview` environment secret `SUPABASE_ACCESS_TOKEN` is absent
- Supabase automatic Preview status: absent; the PR contains no fake migration
  or semantic Supabase change merely to force branch creation

No hosted assertion, synthetic actor, RPC call, database query, or cleanup step
ran. The failure occurred before branch discovery and before any database URL
was available.

No production database, data, migration history, deployment, configuration, PR
#78 implementation, or PR #76 implementation was contacted or changed.
