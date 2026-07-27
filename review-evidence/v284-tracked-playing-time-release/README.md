# v284 Tracked Playing Time release evidence

Status: local release verification passed; release PR pending

## Approved inputs

- Starting `main`: `fc9c079d69757cfc2667dea7e1dfcc56524dce56`
- Foundation PR #24 merge: `2deb8c8df92a612d233f9dad58765e0a22bee618`
- UI PR #25 merge: `fc9c079d69757cfc2667dea7e1dfcc56524dce56`
- Migration: `supabase/migrations/20260727000000_tracked_playing_time_operations.sql`
- Reviewed migration SHA-256: `E0F28F527992C4083635CE4E23C6BE880C787C3C16C95A11198EABC70E243CB9`
- Reviewed rollback SHA-256: `F949D0D934BD3CCAFDDE6EBBB779B5522941F382363B0F528901366996B13EE3`
- Reviewed pgTAP SHA-256: `69C83141BE962D4339730BDCE1CC0A0A11F32E432C85132626B2EA2B6BD7A65D`

The three reviewed artifacts match their PR #24 Git blobs. The manifest validator canonicalizes only this text review package to the approved Windows/CRLF identity; all other database identities retain their existing raw Git checks.

## Dependency restoration

`@electric-sql/pglite@0.5.4` is installed in a disposable directory outside the repository and exposed through an ignored worktree junction. No repository package metadata is created.

## Completed pre-release gates

- Release manifest hash correction: passed focused validation.
- Tracked Playing Time foundation: 11/11 passed.
- Phase-aware release containment: 32/32 passed.
- Production-ledger provenance: passed.
- Secure-disclosure timeout diagnosis: the test signaled v284 as an available update while the app was already v284, so the app correctly cleared the banner and the locator waited for an impossible state.
- Secure-disclosure repair: the fixture derives the next version from `version.json`, waits only for the specific update banner, preserves all disclosure assertions, and records timestamped console/page/network diagnostics.
- Focused disclosure verification: three consecutive secure-disclosure browser runs passed 62/62; minimum disclosure passed 42/42; secure activation passed 21/21; diff hygiene passed.
- Reusable release workflow: preflight and canonical verification commands use pinned disposable dependencies, explicit local-only Supabase commands, fail-fast gates, external logs, and cleanup.
- Canonical command: `node tools/run_release_verification.mjs v284`.
- Canonical database result: production-ledger provenance passed; blank and production-shaped paths passed; pgTAP passed 37/37 on both paths; empty-history rollback and accepted-history refusal/preservation passed; lint reported only the documented pre-existing ambiguous `id` finding.
- Canonical application result: UI 44/44; service 16/16; calculations 7/7; tracked-time browser 33/33 with no console errors; secure-disclosure browser 62/62 with no unexpected console/page errors; containment 32/32; complete regression 29/29.
- Cleanup result: the reduced local Supabase stack stopped, the ignored dependency junction was removed, the disposable dependency directory was deleted, and no repository package metadata was created.

Pull-request CI and the separately authorized production rollout results will be recorded only after those phases complete.

## Safety boundary

No credential, token, private name, or real youth data belongs in this evidence directory. Production actions stop at the first failed gate.
