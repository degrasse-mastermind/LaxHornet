import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildIdempotencyKey,
  escapeHtml,
  isAllowedEventType,
  normalizeQueueRequest,
  normalizeSiteUrl,
  renderNotificationEmail,
} from "../supabase/functions/_shared/email-templates.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerSource = fs.readFileSync(
  path.join(root, "supabase", "functions", "send-laxhornet-email-queue", "index.ts"),
  "utf8",
);
const webhookSource = fs.readFileSync(
  path.join(root, "supabase", "functions", "resend-webhook", "index.ts"),
  "utf8",
);
const migrationSource = fs.readFileSync(path.join(root, "supabase-notification-delivery-update.sql"), "utf8");

const knownEvents = [
  "team_access_requested_user",
  "team_access_requested_admin",
  "team_access_approved",
  "team_access_rejected",
  "player_verification_reminder",
];

for (const eventType of knownEvents) assert.equal(isAllowedEventType(eventType), true);
assert.equal(isAllowedEventType("arbitrary_email"), false);
assert.equal(escapeHtml(`<script>"test"&'`), "&lt;script&gt;&quot;test&quot;&amp;&#039;");
assert.equal(normalizeSiteUrl("javascript:alert(1)"), "https://laxhornet.mybranford.com");
assert.equal(normalizeSiteUrl("https://laxhornet.mybranford.com/"), "https://laxhornet.mybranford.com");

assert.deepEqual(normalizeQueueRequest({}), { dryRun: true, limit: 5, queueIds: [] });
assert.deepEqual(normalizeQueueRequest({ dryRun: false, limit: 99, queueIds: ["one", "one", "two"] }), {
  dryRun: false,
  limit: 10,
  queueIds: ["one", "two"],
});

const row = {
  id: "notify-request-user-test",
  event_type: "team_access_requested_user",
  recipient_email: "demo@example.com",
  subject: "LaxHornet request <received>",
  body: "Your request is ready & waiting.",
};
const rendered = renderNotificationEmail(row, { siteUrl: "https://laxhornet.mybranford.com" });
assert.match(rendered.text, /Your request is ready & waiting\./);
assert.match(rendered.html, /request &lt;received&gt;/);
assert.doesNotMatch(rendered.html, /<received>/);
assert.equal(buildIdempotencyKey(row), "team_access_requested_user/notify-request-user-test");
assert.throws(() => renderNotificationEmail({ ...row, event_type: "unsupported" }), /Unsupported/);

assert.match(workerSource, /x-laxhornet-worker-secret/);
assert.match(workerSource, /dryRun/);
assert.match(workerSource, /Idempotency-Key/);
assert.match(workerSource, /status=eq\.pending/);
assert.match(workerSource, /status: "sending"/);
assert.match(workerSource, /RESEND_API_KEY/);
assert.match(webhookSource, /RESEND_WEBHOOK_SECRET/);
assert.match(webhookSource, /email\.delivered/);
assert.match(webhookSource, /email\.bounced/);
assert.match(webhookSource, /email\.complained/);

for (const column of [
  "attempts",
  "last_attempt_at",
  "last_error",
  "provider_message_id",
  "delivered_at",
  "bounced_at",
  "complained_at",
  "suppressed_at",
]) {
  assert.match(migrationSource, new RegExp(`add column if not exists ${column}`));
}

console.log("PASS: email worker templates, guards, idempotency, webhook, and migration checks");
