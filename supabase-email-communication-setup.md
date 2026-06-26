# LaxHornet Email Communication Setup

This app is hosted as a static frontend, so the browser can request access and write records, but it cannot safely send private transactional email by itself.

LaxHornet currently uses two communication layers:

1. Supabase Auth sends the account verification email after `signUp`.
2. The database writes request/approval messages into `public.notification_queue`.

To make the communication feel professional, configure both.

## 1. Account Verification Email

In Supabase:

1. Open the project.
2. Go to Authentication.
3. Open Email Templates.
4. Edit the Confirm signup template.

Recommended subject:

```text
Confirm your LaxHornet account
```

Recommended body:

```html
<h2>Welcome to LaxHornet</h2>
<p>Confirm your account so your team admin can finish approving player access.</p>
<p>
  <a href="{{ .ConfirmationURL }}">Confirm my LaxHornet account</a>
</p>
<p>After confirming, sign in to LaxHornet. Once your team admin approves your request, you will only see the player/team access assigned to your account.</p>
<p>If you did not request access to LaxHornet, you can ignore this email.</p>
```

Make sure email confirmations are enabled for email/password signups.

## 2. Request And Approval Emails

The schema writes these event types to `public.notification_queue`:

- `team_access_requested_user`
- `team_access_requested_admin`
- `team_access_approved`
- `team_access_rejected`

Those rows are not emails yet. They need a sender, such as:

- Supabase Edge Function with Resend
- Supabase Database Webhook to an email service
- A small scheduled worker that reads pending rows and sends email

Recommended sender:

```text
LaxHornet <notifications@your-domain.com>
```

Recommended parent request-submitted email:

```text
Subject: LaxHornet request received

Hi [First Name],

We received your LaxHornet request for [Team Name], jersey #[Jersey Number].

A team admin will review your request. After approval, sign in to LaxHornet and your verified player will appear automatically.

Player privacy matters. Parents only see the player/team access approved by a team admin.
```

Recommended admin notification email:

```text
Subject: LaxHornet player access request

[Parent Name] ([Email]) requested access to [Team Name], jersey #[Jersey Number].

Open LaxHornet, go to More > Team Admin Tools, and approve or reject the request.
```

Recommended approval email:

```text
Subject: LaxHornet access approved

Hi [First Name],

Your LaxHornet access was approved for [Player Name] #[Jersey Number] on [Team Name].

Sign in to start tracking games, reviewing stats, and following season progress for this player.
```

Recommended rejection email:

```text
Subject: LaxHornet access update

Hi [First Name],

Your LaxHornet access request was not approved.

If the team code or jersey number was entered incorrectly, you can submit a new request or contact your team admin.
```

## 3. Verification Checks

Use `supabase-access-flow-audit.sql` to check:

- Approved requests missing player claims
- Which roster players are verified by parent accounts
- Duplicate jersey numbers on the same team
- Recent queued notification messages

If a parent was approved but the app still shows the player as unverified, first run:

```sql
select * from public.laxhornet_my_player_claims();
```

while signed in as the admin in Supabase SQL Editor impersonation is not available, so the more practical check is the audit query for approved requests missing claims.
