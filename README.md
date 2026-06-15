# LaxHornet

LaxHornet is a mobile-first offline PWA for tracking youth lacrosse stats during games. It uses plain HTML, CSS, and JavaScript. Player settings, active games, and saved games are stored in `localStorage`, with optional cloud sync and Live Share for real-time viewing on another device.

## Features

- Home, Player Settings, Start New Game, Live Game Tracker, Game Review, Past Games, and Season Dashboard screens
- Big one-handed live stat buttons for game-day use
- Game format selector for Quarters or Halves, with OT support
- Faceoff Win and Faceoff Loss tracking with faceoff win percentage
- Grouped live stat buttons with high-frequency events first and specialty stats lower on the screen
- Undo last event, save game, end game, review, and delete game actions
- Game Impact Score calculated from each event
- Season totals and averages from saved games
- Offline-ready `manifest.json` and service worker
- Optional user profiles so each user keeps separate games
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
6. Open LaxHornet and create a user profile from the Home screen.
7. Start a new game.
8. Use **Copy Share Link** from the Live Game Tracker when you want a read-only viewer link.

Games and events are private to the signed-in user by default. Copying a share link marks that game as shared so family can watch it read-only from another iPhone.

## Stat Scoring

- Goal: +5
- Assist: +4
- Save: +3
- Shot on Goal: +2
- Shot: +1
- Ground Ball: +3
- Caused Turnover: +3
- Defensive Stop: +3
- Successful Clear: +2
- Hustle Play: +1
- Smart Play: +1
- Turnover: -2
- Failed Clear: -2
- Goal Allowed: -2
- Penalty: -2
- Note: 0

For dashboard percentages, `Shot on Goal` counts as both a shot and a shot on goal. The `Shot` button is best used for shots that are not on goal.
