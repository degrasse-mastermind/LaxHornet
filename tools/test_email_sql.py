from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "supabase-schema.sql").read_text(encoding="utf-8")
REMINDER = (ROOT / "supabase-player-verification-reminder-update.sql").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")
DOC = (ROOT / "supabase-email-communication-setup.md").read_text(encoding="utf-8")


def function_body(sql, name):
    pattern = re.compile(
        rf"create or replace function public\.{re.escape(name)}\b(?P<body>.*?)(?=\ncreate or replace function public\.|\ndrop function|\nrevoke |\ngrant |\nnotify |\ncommit;|\Z)",
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(sql)
    return match.group("body") if match else ""


checks = []
warnings = []


def check(name, condition, detail=""):
    checks.append((name, bool(condition), detail))


notification_table = re.search(
    r"create table if not exists public\.notification_queue\s*\((.*?)\);",
    SCHEMA,
    re.IGNORECASE | re.DOTALL,
)
table_body = notification_table.group(1) if notification_table else ""
for column in [
    "event_type",
    "recipient_email",
    "subject",
    "body",
    "payload",
    "template_key",
    "status",
    "attempts",
    "last_attempt_at",
    "last_error",
    "provider_message_id",
    "sent_at",
    "delivered_at",
    "bounced_at",
    "complained_at",
    "suppressed_at",
]:
    check(f"notification_queue has {column}", column in table_body)

new_user = function_body(SCHEMA, "laxhornet_handle_new_user")
signed_in_request = function_body(SCHEMA, "laxhornet_request_team_player_access")
review_request = function_body(SCHEMA, "laxhornet_review_team_access_request")
reminder_request = function_body(SCHEMA, "laxhornet_send_player_verification_reminder")
standalone_reminder = function_body(REMINDER, "laxhornet_send_player_verification_reminder")

check("new signup queues parent request email", "team_access_requested_user" in new_user)
check("new signup queues admin request email", "team_access_requested_admin" in new_user)
check("new signup uses deterministic parent request id", "notify-request-user-" in new_user)
check("new signup uses deterministic admin request id", "notify-request-admin-" in new_user)

check("signed-in request queues parent request email", "team_access_requested_user" in signed_in_request)
check("signed-in request queues admin request email", "team_access_requested_admin" in signed_in_request)
check("signed-in request uses deterministic parent request id", "notify-request-user-" in signed_in_request)
check("signed-in request uses deterministic admin request id", "notify-request-admin-" in signed_in_request)

check("review queues approval email", "team_access_approved" in review_request)
check("review queues rejection email", "team_access_rejected" in review_request)
check("review notification is deterministic", "notify-team-access-" in review_request)

check("schema reminder queues reminder email", "player_verification_reminder" in reminder_request)
check("schema reminder resets to pending on retry", "status = 'pending'" in reminder_request)
check("standalone reminder queues reminder email", "player_verification_reminder" in standalone_reminder)
check("standalone reminder resets to pending on retry", "status = 'pending'" in standalone_reminder)

for rpc_name in [
    "laxhornet_request_team_player_access",
    "laxhornet_review_team_access_request",
    "laxhornet_send_player_verification_reminder",
]:
    check(f"app invokes {rpc_name}", rpc_name in APP)

for event_type in [
    "team_access_requested_user",
    "team_access_requested_admin",
    "team_access_approved",
    "team_access_rejected",
    "player_verification_reminder",
]:
    check(f"plan documents {event_type}", event_type in DOC)

sender_source = ROOT / "supabase" / "functions" / "send-laxhornet-email-queue" / "index.ts"
webhook_source = ROOT / "supabase" / "functions" / "resend-webhook" / "index.ts"

if not sender_source.exists():
    warnings.append("No send-laxhornet-email-queue Edge Function source is checked in yet.")
else:
    sender = sender_source.read_text(encoding="utf-8")
    check("sender requires a private worker secret", "x-laxhornet-worker-secret" in sender)
    check("sender defaults to dry-run", "dryRun" in sender)
    check("sender uses Resend idempotency keys", "Idempotency-Key" in sender)

if not webhook_source.exists():
    warnings.append("No resend-webhook Edge Function source is checked in yet.")
else:
    webhook = webhook_source.read_text(encoding="utf-8")
    check("webhook verifies a Resend signing secret", "RESEND_WEBHOOK_SECRET" in webhook)
    check("webhook records delivered messages", "email.delivered" in webhook)
    check("webhook records bounced messages", "email.bounced" in webhook)
    check("webhook records complaints", "email.complained" in webhook)

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    status = "PASS" if ok else "FAIL"
    suffix = f" - {detail}" if detail else ""
    print(f"{status}: {name}{suffix}")

for warning in warnings:
    print(f"WARN: {warning}")

if failed:
    print(f"\n{len(failed)} email SQL test(s) failed.", file=sys.stderr)
    sys.exit(1)

print(f"\n{len(checks)} email SQL checks passed.")
