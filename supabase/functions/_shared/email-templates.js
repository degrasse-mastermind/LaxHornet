const ALLOWED_EVENT_TYPES = new Set([
  "team_access_requested_user",
  "team_access_requested_admin",
  "team_access_approved",
  "team_access_rejected",
  "player_verification_reminder",
]);

const EVENT_CTA_LABELS = Object.freeze({
  team_access_requested_user: "Open LaxHornet",
  team_access_requested_admin: "Review request",
  team_access_approved: "Open LaxHornet",
  team_access_rejected: "Open LaxHornet",
  player_verification_reminder: "Verify your player",
});

export function isAllowedEventType(eventType) {
  return ALLOWED_EVENT_TYPES.has(String(eventType || ""));
}

export function normalizeSiteUrl(value) {
  const fallback = "https://laxhornet.mybranford.com";
  const input = String(value || fallback).trim();
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return fallback;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeQueueRequest(input) {
  const body = input && typeof input === "object" ? input : {};
  const requestedIds = Array.isArray(body.queueIds)
    ? body.queueIds.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    dryRun: body.dryRun !== false,
    limit: Math.max(1, Math.min(Number.parseInt(body.limit, 10) || 5, 10)),
    queueIds: [...new Set(requestedIds)],
  };
}

export function buildIdempotencyKey(row) {
  const eventType = String(row?.event_type || "unknown").replace(/[^a-z0-9_-]/gi, "-");
  const queueId = String(row?.id || "missing").replace(/[^a-z0-9_-]/gi, "-");
  return `${eventType}/${queueId}`.slice(0, 256);
}

function requestIdFromQueueRow(row) {
  const payloadRequestId = String(row?.payload?.request_id || "").trim();
  if (payloadRequestId) return payloadRequestId;
  const queueId = String(row?.id || "");
  const prefix = "notify-request-admin-";
  return queueId.startsWith(prefix) ? queueId.slice(prefix.length) : "";
}

export function buildNotificationAppUrl(row, siteUrl) {
  const url = new URL(`${normalizeSiteUrl(siteUrl)}/app.html`);
  if (row?.event_type !== "team_access_requested_admin") return url.toString();

  const teamId = String(row?.payload?.team_id || "").trim();
  const requestId = requestIdFromQueueRow(row);
  url.searchParams.set("open", "team-request");
  if (teamId) url.searchParams.set("team", teamId);
  if (requestId) url.searchParams.set("request", requestId);
  return url.toString();
}

export function renderNotificationEmail(row, options = {}) {
  if (!isAllowedEventType(row?.event_type)) {
    throw new Error(`Unsupported notification event type: ${String(row?.event_type || "missing")}`);
  }

  const siteUrl = normalizeSiteUrl(options.siteUrl);
  const appUrl = buildNotificationAppUrl(row, siteUrl);
  const subject = String(row.subject || "LaxHornet account update").trim().slice(0, 180);
  const body = String(row.body || "").trim().slice(0, 4000);
  const ctaLabel = EVENT_CTA_LABELS[row.event_type] || "Open LaxHornet";
  const footer =
    "You are receiving this transactional LaxHornet message because this email address was used for a LaxHornet account, team access request, or team admin action.";

  const text = `${body}\n\n${ctaLabel}: ${appUrl}\n\n${footer}\n\nQuestions? Reply to this email or contact degrassed@gmail.com.`;
  const safeBody = escapeHtml(body).replaceAll("\n", "<br>");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#111214;color:#17191d;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111214;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden">
            <tr>
              <td style="background:#090a0b;padding:22px 24px;color:#fff;font-size:24px;font-weight:800">
                LAX<span style="color:#e81010">HORNET</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">${escapeHtml(subject)}</h1>
                <p style="margin:0 0 24px;font-size:17px;line-height:1.55;color:#343840">${safeBody}</p>
                <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#17191d;border-left:6px solid #e81010;border-radius:6px;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 20px">${escapeHtml(ctaLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e1e3e6;padding:20px 24px;color:#626873;font-size:13px;line-height:1.5">
                ${escapeHtml(footer)}<br><br>
                Questions? Reply to this email or contact degrassed@gmail.com.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html, appUrl, ctaLabel };
}
