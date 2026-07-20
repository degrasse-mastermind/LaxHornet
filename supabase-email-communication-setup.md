# LaxHornet Email Communication Plan

This document defines the email side of LaxHornet: what Supabase owns, what Resend owns, which product events send email, the copy for each email, and the implementation work still needed.

LaxHornet is a static PWA, so the browser must never send email directly and must never contain private email-service credentials. The browser can create auth/session/team-access records through Supabase. Supabase should queue communication events. A server-side sender should read that queue and send through Resend.

## Recommended Architecture

Use two email lanes:

1. Supabase Auth email
   - Purpose: account confirmation, password reset, email change.
   - Preferred path: Supabase Auth Send Email Hook backed by a Supabase Edge Function that calls Resend.
   - Simpler fallback: Supabase Auth email templates with Resend SMTP/custom SMTP.

2. LaxHornet transactional notifications
   - Purpose: team access request received, admin request notification, approval/rejection, player verification reminder.
   - Preferred path: write deterministic rows to `public.notification_queue`, then send with a Supabase Edge Function using Resend.
   - The Edge Function should run with server-side secrets only and update queue status after every send attempt.

Recommended sender identities:

- Auth/account email: `LaxHornet <accounts@laxhornet.mybranford.com>`
- Transactional notifications: `LaxHornet <notifications@laxhornet.mybranford.com>`
- Reply-To: `degrassed@gmail.com` until there is a dedicated support/team inbox

Before production sending, verify the sender domain in Resend and configure SPF, DKIM, DMARC, and bounce handling. Use Resend's sandbox/testing sender only for development.

## Current App Events

These flows already exist in the app and database.

| Flow | Trigger | Current behavior | Email behavior needed |
| --- | --- | --- | --- |
| New parent signs up with team code | `supabaseClient.auth.signUp(...)` in `submitSignupAccessRequest` | Supabase Auth sends confirmation; `laxhornet_handle_new_user` creates profile/request | Send account confirmation, parent request receipt, admin request notification |
| Existing signed-in parent requests player access | `laxhornet_request_team_player_access(join_code, jersey)` | Creates/updates `team_access_requests` and queues request notifications | Send parent request receipt and admin request notification |
| Team admin approves access | `laxhornet_review_team_access_request(request_id, true)` | Approves request, creates team member/player claim, queues `team_access_approved` | Send approval email |
| Team admin rejects access | `laxhornet_review_team_access_request(request_id, false)` | Rejects request, queues `team_access_rejected` | Send neutral update email |
| Admin sends reminder after approval | `laxhornet_send_player_verification_reminder(request_id)` | Queues `player_verification_reminder` | Send reminder email |
| Password reset / email change | Supabase Auth | Uses Supabase Auth templates or hook | Branded account email |
| Live Share / family recap | UI copy/share action only | No email send | Keep opt-in/manual for now; do not auto-email family links in Phase 1 |

## Queue Event Types

`public.notification_queue` currently uses:

- `team_access_requested_user`
- `team_access_requested_admin`
- `team_access_approved`
- `team_access_rejected`
- `player_verification_reminder`

The queue delivery columns below are implemented in `supabase-schema.sql` and
`supabase-notification-delivery-update.sql`:

```sql
alter table public.notification_queue
  add column if not exists template_key text not null default '',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text not null default '',
  add column if not exists provider_message_id text not null default '',
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists suppressed_at timestamptz;
```

Keep queue row IDs deterministic, such as `notify-request-user-{request_id}`. Use the queue row ID as the Resend idempotency key, formatted as `{event_type}/{queue_id}`. That makes retries safe.

## Sender Function Structure

The checked-in sender is `supabase/functions/send-laxhornet-email-queue/index.ts`.
It uses a private `x-laxhornet-worker-secret` header, defaults every invocation
to dry-run, accepts at most 10 explicit queue IDs, and only sends the five
allowlisted LaxHornet transactional event types.

Responsibilities:

1. Read a small batch of pending queue rows.
2. Choose the template from `event_type` or `template_key`.
3. Render both HTML and plain text.
4. Send through Resend with an idempotency key.
5. Update `status`, `sent_at`, `attempts`, `last_attempt_at`, `last_error`, and `provider_message_id`.
6. Leave failed rows retryable until a maximum attempt count is reached.

Recommended queue statuses:

- `pending`
- `sending`
- `sent`
- `failed`
- `bounced`
- `complained`
- `suppressed`

Recommended secrets:

```text
RESEND_API_KEY
EMAIL_FROM_NOTIFICATIONS
EMAIL_FROM_ACCOUNTS
EMAIL_REPLY_TO
SITE_URL
QUEUE_BATCH_SIZE
QUEUE_MAX_ATTEMPTS
```

Supabase Edge Functions also expose Supabase project secrets by default. Use server-side credentials only in Edge Functions; never expose service-role or Resend keys in `app.js`.

Pseudo-flow:

```text
Scheduled job or admin action
  -> invoke Supabase Edge Function
  -> Edge Function selects pending rows
  -> render template
  -> Resend sends email
  -> queue row becomes sent/failed
  -> Resend webhook later updates delivery/bounce/complaint status
```

## Resend Webhooks

The checked-in delivery handler is `supabase/functions/resend-webhook/index.ts`.
It verifies Resend's signed webhook headers before reconciling provider message
IDs with queue rows.

## Safe Deployment and Backlog Handling

The sender is intentionally fail-closed:

1. Deploy both functions with JWT verification disabled only because each
   function performs its own authentication.
2. Set `QUEUE_WORKER_SECRET`, `RESEND_API_KEY`,
   `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM_NOTIFICATIONS`,
   `EMAIL_REPLY_TO`, and `SITE_URL` as Edge Function secrets.
3. Invoke the sender with `{ "dryRun": true }` first.
4. Test one newly-created queue row by passing its ID in `queueIds`.
5. Review old pending rows before sending them. Do not release stale access
   notifications as a bulk batch without an explicit decision.

Example dry-run request:

```bash
curl -X POST \
  "https://ulbmjcvnyznvmjgpstno.supabase.co/functions/v1/send-laxhornet-email-queue" \
  -H "Content-Type: application/json" \
  -H "x-laxhornet-worker-secret: $QUEUE_WORKER_SECRET" \
  -d '{"dryRun":true,"limit":5}'
```

Track these outcomes:

- delivered: set `delivered_at`
- bounced: set `status = 'bounced'`, set `bounced_at`
- complained: set `status = 'complained'`, set `complained_at`
- suppressed: set `status = 'suppressed'`, set `suppressed_at`

Use this to avoid repeatedly emailing addresses that bounce or complain.

## Email Templates

All emails should be short, mobile-friendly, and plain English. Avoid sensitive youth data beyond the team name, player first/last name when approved, and jersey number needed to match the request. Do not include private game stats in automatic emails.

Use a consistent footer:

```text
You are receiving this transactional LaxHornet message because this email address was used for a LaxHornet account, team access request, or team admin action.

Questions? Reply to this email or contact degrassed@gmail.com.
```

### 1. Account Confirmation

Event source: Supabase Auth signup confirmation.

Subject:

```text
Confirm your LaxHornet account
```

Preview:

```text
Confirm your email so your team admin can finish approving player access.
```

Body:

```text
Hi {{first_name | default: "there"}},

Welcome to LaxHornet.

Confirm your email so your team admin can finish reviewing your player access request.

Confirm your account:
{{confirmation_url}}

After confirming, sign in to LaxHornet. Once your team admin approves access, the app will only show the player/team access assigned to your account.

If you did not request access to LaxHornet, you can ignore this email.
```

CTA:

```text
Confirm my LaxHornet account
```

### 2. Parent Request Received

Event type: `team_access_requested_user`

Subject:

```text
LaxHornet request received for {{team_name}}
```

Preview:

```text
Your team admin will review jersey #{{child_jersey_number}}.
```

Body:

```text
Hi {{first_name | default: "there"}},

We received your LaxHornet request for {{team_name}}, jersey #{{child_jersey_number}}.

What happens next:

1. Confirm your LaxHornet account email if you have not already.
2. A team admin reviews your team code and jersey number.
3. After approval, sign in and your verified player will appear automatically.

Player privacy matters. Parent accounts only see the player/team access approved by a team admin.

Open LaxHornet:
{{site_url}}/app.html
```

CTA:

```text
Open LaxHornet
```

### 3. Admin New Request Notification

Event type: `team_access_requested_admin`

Subject:

```text
LaxHornet player access request: {{team_name}} #{{child_jersey_number}}
```

Preview:

```text
{{parent_name}} requested access to {{team_name}}.
```

Body:

```text
Hi Team Admin,

{{parent_name | default: recipient_email}} requested LaxHornet access.

Team: {{team_name}}
Jersey: #{{child_jersey_number}}
Parent email: {{email}}
Phone: {{phone | default: "Not provided"}}

Open LaxHornet, go to More > Team Admin Tools, and approve or reject the request.

Only approve if the team code and jersey number match the rostered player this parent should track.

Open admin tools:
{{site_url}}/app.html
```

CTA:

```text
Review request
```

### 4. Access Approved

Event type: `team_access_approved`

Subject:

```text
LaxHornet access approved
```

Preview:

```text
You are approved for {{team_name}}, jersey #{{child_jersey_number}}.
```

Body:

```text
Hi {{first_name | default: "there"}},

Your LaxHornet access was approved for {{team_name}}, jersey #{{child_jersey_number}}.

Sign in to LaxHornet and sync your account. Your verified player should appear automatically.

Open LaxHornet:
{{site_url}}/app.html

If the player does not appear, use More > Sync or contact your team admin.
```

CTA:

```text
Open LaxHornet
```

### 5. Access Not Approved

Event type: `team_access_rejected`

Subject:

```text
LaxHornet access update
```

Preview:

```text
Your player access request needs a correction.
```

Body:

```text
Hi {{first_name | default: "there"}},

Your LaxHornet request was not approved.

This usually means the team code or jersey number did not match the team roster, or the team admin needs more information.

You can submit a new request with the correct team code and jersey number, or contact your team admin.

Open LaxHornet:
{{site_url}}/app.html
```

CTA:

```text
Open LaxHornet
```

### 6. Player Verification Reminder

Event type: `player_verification_reminder`

Subject:

```text
Verify your LaxHornet player
```

Preview:

```text
Finish connecting jersey #{{child_jersey_number}} on {{team_name}}.
```

Body:

```text
Hi {{first_name | default: "there"}},

Your LaxHornet access for {{team_name}} was approved.

Please sign in and verify jersey #{{child_jersey_number}} so your player's tracker opens on this device.

Open LaxHornet:
{{site_url}}/app.html

If you already verified your player, no action is needed.
```

CTA:

```text
Verify my player
```

### 7. Password Reset

Event source: Supabase Auth recovery email.

Subject:

```text
Reset your LaxHornet password
```

Preview:

```text
Use this secure link to reset your password.
```

Body:

```text
Hi {{first_name | default: "there"}},

We received a request to reset your LaxHornet password.

Reset your password:
{{recovery_url}}

If you did not request this, you can ignore this email.
```

CTA:

```text
Reset password
```

### 8. Optional Future: Live Share Invitation

Do not send automatically in Phase 1. Keep Live Share manual until family-recipient permissions are explicit.

Subject:

```text
Watch {{player_name}} live on LaxHornet
```

Body:

```text
{{sender_name}} shared a read-only LaxHornet game link.

Player: {{player_name}}
Game: {{opponent}} on {{game_date}}

Watch live:
{{share_url}}

This link is read-only. It does not allow editing stats or account access.
```

## Template Data Contract

Normalize payload values before rendering:

```text
recipient_email
event_type
subject
body
payload.team_id
payload.team_name
payload.request_id
payload.email
payload.first_name
payload.last_name
payload.parent_name
payload.phone
payload.child_jersey_number
payload.roster_player_id
payload.roster_player_name
SITE_URL
```

Derived helpers:

```text
first_name = payload.first_name || "there"
parent_name = trim(payload.parent_name || payload.first_name + " " + payload.last_name) || payload.email
team_name = payload.team_name || "your team"
child_jersey_number = payload.child_jersey_number || "provided"
site_url = SITE_URL || "https://laxhornet.mybranford.com"
```

## Backend Fixes Needed

1. Keep request email queueing covered for both request paths.
   - `laxhornet_handle_new_user` queues `team_access_requested_user` and `team_access_requested_admin` during signup with a team code.
   - `laxhornet_request_team_player_access` should also queue those two events for already signed-in users.
   - Run `tools/test_email_sql.py` after touching email SQL.

2. Add queue delivery columns.
   - Add attempts/error/provider/delivery fields from the SQL above.

3. Add an Edge Function queue sender.
   - Use Resend API key from Edge Function secrets.
   - Use idempotency key `{event_type}/{queue_id}`.
   - Send HTML and text.
   - Update queue rows.

4. Add a Resend webhook endpoint.
   - Store delivered/bounced/complained/suppressed outcomes.
   - Prevent repeat sends to suppressed/bounced addresses.

5. Decide how to send Supabase Auth mail.
   - Recommended: Auth Send Email Hook -> Supabase Edge Function -> Resend.
   - Acceptable launch shortcut: Supabase built-in auth templates with Resend SMTP/custom SMTP.

6. Update Supabase Auth templates.
   - Confirm signup.
   - Password reset.
   - Email change, if enabled.

7. Create a test matrix before production.
   - New parent signup with team code.
   - Existing signed-in parent requests access.
   - Admin approves request.
   - Admin rejects request.
   - Admin sends verification reminder.
   - Duplicate function retry does not duplicate sends.
   - Bounce/complaint webhook marks status.

## Suggested Edge Function File Layout

If this repo starts tracking Supabase function source, use:

```text
supabase/
  functions/
    send-laxhornet-email-queue/
      index.ts
    resend-webhook/
      index.ts
```

Keep reusable template rendering either in each function or in:

```text
supabase/functions/_shared/email-templates.ts
```

## QA Checklist

Database checks:

```sql
select created_at, event_type, status, recipient_email, subject, attempts, last_error
from public.notification_queue
order by created_at desc
limit 50;
```

Request flow checks:

- Parent sees "Request sent" screen.
- Parent receives account confirmation email.
- Parent receives request received email.
- Admin receives request review email.
- Admin approval creates a `player_claims` row.
- Parent receives approval email.
- More > Sync shows the approved player.

Delivery checks:

- Resend dashboard shows the same provider message ID stored in the queue.
- Retrying the same queue row does not send duplicates.
- Webhook updates delivery status.
- Suppressed/bounced addresses are not retried indefinitely.

## Phase 1 Decision

Ship transactional email only:

- Account confirmation
- Request received
- Admin request notification
- Approval/rejection
- Verification reminder
- Password reset

Do not ship marketing emails, newsletters, automatic family recap emails, or automatic Live Share invitations until recipient consent and unsubscribe/suppression flows are explicitly designed.
