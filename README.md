# LaxHornet

LaxHornet is a mobile-first offline PWA for tracking youth lacrosse stats during games. It uses plain HTML, CSS, and JavaScript. Player settings, active games, and saved games are stored in `localStorage`, with optional cloud sync and Live Share for real-time viewing on another device.

## Features

- Home, Track, Games, Season Dashboard, Player & Team, More, and Live Game Tracker screens
- Preloaded team roster picker with active-player switching
- Big one-handed live stat buttons for game-day use
- Game format selector for Quarters or Halves, with OT support
- Faceoff Win and Faceoff Loss tracking with faceoff win percentage
- Grouped live stat buttons with high-frequency events first and specialty stats lower on the screen
- Undo last event, save game, end game, review, and delete game actions
- Bounded 0-100 proprietary LaxHornet Game Impact summary with recorded-input breakdown and evidence limitations
- Per-player season totals and averages from saved games
- Offline-ready `manifest.json` and service worker
- Optional user profiles with approved team access for parents
- Optional shared team rosters with parent access requests
- Optional Live Share with a share code/link for read-only real-time viewing
- Purpose-specific output modes: public-safe Live Share, user-previewed recap, selected-scope CSV, and sensitive private backup
- Explicit annotation choices for CSV plus confirmation-gated private backup and import merge

## Minimum-Necessary Disclosure

The hardened disclosure path has passed isolated staging and managed preview verification. It remains staged behind `window.LAXHORNET_RUNTIME_CONFIG` feature flags, and all production defaults remain off until a deliberate Trust Spine cutover is approved.

- **Hardened Live Share path:** backend-allowlisted game and event facts only; no notes, tags, process context, account data, corrections, focus records, or generated recommendations. The trusted viewer polls the public-safe RPC instead of subscribing to ordinary game/event tables. This path is verified outside production but is not active in production yet; the legacy fallback remains an unresolved cutover risk.
- **Share Recap:** a short, user-previewed summary with cautious interpretation, a conversation prompt, and an optional focus only when the user adds it.
- **CSV Data Export:** selected player or one selected game. Recorded facts are included by default; descriptive tags, private process tags, and notes each require an explicit checkbox.
- **Private Full Backup:** broader recovery data with a sensitive-data warning and explicit confirmation. It downloads directly and does not invoke native/public sharing.
- **Import:** previews and merges only new, authorized games. It does not restore claims, team membership, roster authority, account ownership, deleted games, or Live Share state, and it never replaces an existing same-ID game.

The staging migration and evidence suite are under `review-evidence/product-alignment-remediation-v2/`. They must not be applied to production as part of this release-hygiene correction. Current users should avoid sensitive or private information in notes or tags for games they intend to share, and should treat every Private Full Backup as a sensitive recovery artifact.

## Local Setup

No install step is required.

```bash
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

The root page is the public landing page. Open the working app directly at:

```text
http://localhost:5173/app.html
```

You can also use any static file server. Serving over `http://localhost` is recommended so the service worker can register during testing.

## Project Work Control

LaxHornet uses a risk-based, repository-backed workflow:

- `docs/CODEX_WORKFLOW.md` defines Level 1 routine, Level 2 standard, and Level
  3 critical work, with process and testing proportional to actual risk.
- `TICKETS.md` is used for ticketed work; routine Level 1 changes do not require
  an entry.
- One Codex task may carry authorized implementation through a pushed feature
  branch and draft pull request.
- `docs/templates/CODEX_TASK_KICKOFF.md` and
  `docs/templates/CODEX_TASK_CLOSEOUT.md` provide concise reusable records.

Independent review is required only for Level 3 before merge. Evidence packages
are limited to migrations, production releases, security incidents, and
disclosure incidents. Task titles, summaries, pins, and archives are optional
navigation hygiene; the repository, Git history, pull requests, applicable
tests, and ticket records remain authoritative.

## GitHub Pages Deployment

Production is deployed by `.github/workflows/pages-deployment.yml`. The
workflow builds a clean artifact from the affirmative specification at
`release/pages-deployment-allowlist.json`, validates it, uploads only
`.pages-artifact`, and deploys through the `github-pages` environment.

Repository-root or `/docs` branch publishing must not be enabled. Internal
tools, documentation, SQL, migrations, tests, review evidence, and release
runbooks are not production assets.

The site is configured for:

```text
https://laxhornet.mybranford.com/
```

The public landing page lives at `/`. The PWA app lives at `/app.html`, and the manifest opens installed home-screen icons directly into the app.

Build and validate locally with:

```powershell
node tools/build_pages_artifact.mjs
node tools/validate_pages_artifact.mjs
node tools/test_pages_deployment.mjs
node tools/test_pages_artifact_browser.cjs
```

The production workflow also runs `tools/verify_pages_settings.mjs` before
upload and after deployment. It fails closed unless Pages uses Actions and the
configured custom domain, HTTPS enforcement, approved certificate, and v284
production marker remain intact.

Rollback uses a previously verified allowlisted `main` commit through manual
workflow dispatch. See
`docs/deployment/LAXHORNET_PAGES_ARTIFACT_ROLLBACK.md`.

## Launch Kit

The `launch-kit/` folder includes a QR code, printable parent handout, PDF handout, and message templates for sharing LaxHornet with teams and families.

## Supabase Multi-User Setup

The app is configured for:

```text
https://ulbmjcvnyznvmjgpstno.supabase.co
```

To create or update the database tables:

1. Open the Supabase project dashboard.
2. Go to **SQL Editor**.
3. Open `supabase-schema.sql` from this repo.
4. Paste the full SQL into Supabase and run it.
5. In Supabase, open **Authentication > Providers** and make sure Email is enabled.
6. Open LaxHornet and create a team from the platform reviewer account.
7. Add rostered players with jersey numbers.
8. Share the team code with approved parents.
9. Parents create an account, submit their team code and child jersey number, and wait for approval.
10. Use **Copy Share Link** from the Live Game Tracker when you want a read-only share link.

Games and events are private to the signed-in user by default. Team roster games are visible to signed-in parents who are approved for the same team and claimed to one rostered player. Parent Tracker accounts can enter shared team stats only after admin approval. Copying a share link marks that game as shared so family can watch it read-only from another iPhone.

Team creation and roster administration are limited to the platform reviewer account: `degrassed@gmail.com`.

### Request And Approval Emails

`supabase-schema.sql` creates a `notification_queue` table for account request and approval email events. A static GitHub Pages app cannot send private transactional email by itself, so connect this queue to a Supabase Edge Function, Database Webhook, or Resend worker to deliver the queued messages.

## Shared Teams

Use **Team** when multiple parents need to track or view stats for the same approved rostered player.

1. Sign in with a User Profile.
2. Create a team to generate team access codes.
3. Add rostered players by name and jersey number.
4. Give team access codes only to parents who should request access.
5. The parent creates an account and submits the team code plus their child's jersey number.
6. The platform reviewer approves the request; approval automatically claims the matching rostered player.
7. The parent signs in and sees only that rostered player.

Best practice: choose one official Parent Tracker for each player/game. Multiple parents can sync and review the same stats, but two Parent Tracker accounts logging the same player at the same time can create duplicate events.

## LaxHornet Game Impact Summary

Game Impact is a LaxHornet-created summary of selected recorded events. It is not a coach grade, player rating, ranking, or complete measure of performance or development. Missing or incorrectly recorded events can change the result. Game Review shows the bounded numeric summary beside its recorded contribution inputs. Season Dashboard shows the average of those saved-game summaries with the same limitations.

Game Impact is position-weighted:

- Attack: higher scoring weight; medium possession and hustle; lower defense.
- Midfield: higher possession and hustle; medium scoring and defense.
- Defense / LSM: higher defense and hustle; medium possession; lower scoring.
- Faceoff / Draw: very high possession; medium defense and hustle; lower scoring.
- Goalie: very high goalie weight; medium possession and hustle; lower defense; scoring events receive no additional weight.

The raw event values behind the score are:

- Goal: +5
- Assist: +3
- Save: +3
- Shot on Goal: +1
- Missed Shot: -0.5
- Ground Ball: +2
- Caused Turnover: +3
- Defensive Stop: +3
- Successful Clear: +1
- Backed Up Shot: +2
- Hustle Play: +1
- Smart Play: +1
- Turnover: -2
- Failed Clear: -2
- Goal Allowed: -1
- Penalty: -2
- Note: 0

For dashboard percentages, total shots are `Missed Shot` plus `Shot on Goal`.

## Possession Impact

Possession Impact separates two related ideas:

- Extra Possessions: the count of additional chances created or protected.
- Possession Value: the weighted value of those possession-changing plays.

Current possession rules:

- Faceoff / draw win: +1 extra possession, +1.0 value
- Ground ball won: +1, +1.2
- Caused turnover: +1, +1.8
- Save retained by the team: +1, +2.5
- Successful clear: +0.5, +0.8
- Backed Up Shot: +1, +1.5
- Turnover: -1, -1.5
- Failed clear: -1, -2.0
- Penalty: 0, -1.5
