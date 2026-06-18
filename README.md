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
- 0-100 Game Impact score for each game, with season Average Impact
- Per-player season totals and averages from saved games
- Offline-ready `manifest.json` and service worker
- Optional user profiles with approved team access for parents
- Optional shared team rosters with parent access requests
- Optional Live Share with a share code/link for read-only real-time viewing

## Local Setup

No install step is required.

```bash
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

You can also use any static file server. Serving over `http://localhost` is recommended so the service worker can register during testing.

## GitHub Pages Deployment

1. Push this repository to GitHub.
2. In the GitHub repository, open **Settings**.
3. Go to **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your branch, usually `main`, and the root folder `/`.
6. Save. GitHub Pages will publish the static PWA.

The app uses relative paths (`./`) so it can run from a GitHub Pages project URL such as:

```text
https://your-username.github.io/LaxHornet/
```

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

## Game Impact Scoring

Game Impact is a 0-100 score that estimates how much a player helped create possessions, convert possessions, protect possessions, and prevent opponent scoring chances. Game Review shows the Game Impact score for one game. Season Dashboard shows Average Impact across saved games.

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
