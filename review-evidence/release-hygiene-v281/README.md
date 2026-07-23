# LaxHornet v281 Release-Hygiene Evidence

## Scope

This evidence covers the separate `review/release-hygiene-v281` branch only.
It coordinates the browser/PWA release identity, corrects public disclosure
wording, and proves that the trusted disclosure flags remain disabled by
default.

It does not:

- apply or modify SQL;
- alter canonical production-candidate migrations or rollback files;
- enable Trust Spine runtime flags;
- call a hosted Supabase project during browser verification;
- deploy or migrate production;
- merge or modify draft PR #9.

## Browser Evidence

All screenshots use a 390 by 844 mobile viewport, synthetic data, and a local
Supabase stub at `127.0.0.1`. The browser test fails if it observes a request
to any hosted `*.supabase.co` project.

1. `browser/01-anonymous-shared-game.png`
   - Anonymous, read-only, code-scoped shared-game entry state.
2. `browser/02-scoped-csv-export.png`
   - Scoped CSV export with private process tags and notes off by default.
3. `browser/03-sensitive-backup-confirmation.png`
   - Sensitive private backup warning and explicit confirmation.
4. `browser/04-import-review.png`
   - Import merge review and authority-preservation copy.
5. `browser/05-help-disclosure-copy.png`
   - In-app Help wording for staged/preview proof and pending production cutover.
6. `browser/06-update-available.png`
   - Installed-app update-available banner and Update Now action.

## Test Evidence

`raw-test-results.txt` contains the raw output for:

- JavaScript syntax;
- v281 release coordination;
- service-worker/cache and installed-app update contracts;
- release-hygiene containment;
- minimum disclosure;
- Product Alignment source and browser regressions;
- Trust Spine contracts;
- Cancel Game;
- delete permissions;
- player-removal cleanup;
- local browser disclosure checks;
- secret and staging-reference scans;
- SQL/canonical migration diff checks;
- `git diff --check`.

The repository has no package manifest defining a separate build, lint, or
typecheck command. JavaScript syntax and the executable source/browser suites
are the available checks for this static PWA.

## Runtime Boundary

The browser reads trusted disclosure flags only when a deliberate runtime
configuration sets them to boolean `true`:

- `publicLiveShareRpc`
- `liveShareTokenRpc`
- `exportAuditRpc`

No active runtime or public file contains a staging project reference. Historical
staging references remain only under checked-in `review-evidence/` records and
are not runtime configuration or credentials.

The legacy Live Share fallback remains present and is documented as an unresolved
production-cutover risk.
