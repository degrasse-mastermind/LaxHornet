# LaxHornet Launch Kit

Public app link:

https://degrasse-mastermind.github.io/LaxHornet/

## Core Files

- `laxhornet-qr.png`: QR code for the public app link.
- `parent-handout.html`: Printable one-page parent quick start.
- `LaxHornet-parent-handout.pdf`: PDF version of the parent quick start.
- `parent-email.html`: HTML email template with clickable links.
- `parent-email.eml`: Ready-to-open email draft with clickable links.
- `invite-message.txt`: Longer email or team-app announcement.
- `short-text-message.txt`: Short SMS/iMessage version.
- `LaxHornet-promo-demo.mp4`: 30-second vertical promo demo video.
- `LaxHornet-promo-demo-thumbnail.png`: Still image preview for the promo video.

## New Marketing And Sharing Files

- `team-chat-posts.txt`: Copy/paste posts for GroupMe, SportsEngine, TeamSnap, iMessage, or parent chats.
- `social-captions.txt`: Captions for a team website, Facebook group, Instagram post, or parent newsletter.
- `admin-launch-checklist.html`: Printable checklist for team admins before inviting parents.
- `laxhornet-overview.html`: Polished overview/share page with QR code and feature highlights.

## Recommended Launch Flow

1. Admin creates the team in LaxHornet.
2. Admin preloads the roster with names, jersey numbers, and positions.
3. Admin shares the team code using `parent-email.html`, `invite-message.txt`, or `team-chat-posts.txt`.
4. Parents create accounts, enter the team code, and enter their child's jersey number.
5. Admin approves matching requests.
6. Parents sign back in, choose their verified player/team tile, and track games.

## iPhone Install Instructions

1. Open the app link in Safari.
2. Tap the Share button.
3. Tap Add to Home Screen.
4. Open LaxHornet from the new icon.

## Important Launch Settings

In Supabase, the app's Site URL should be:

https://degrasse-mastermind.github.io/LaxHornet/

Redirect URLs should include:

https://degrasse-mastermind.github.io/LaxHornet/
https://degrasse-mastermind.github.io/LaxHornet/?auth=verified

Run the latest `supabase-schema.sql` before inviting a lot of users so multi-player cloud sync, team rosters, and player claims are current.
