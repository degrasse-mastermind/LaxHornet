import "jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts";
import {
  buildIdempotencyKey,
  isAllowedEventType,
  normalizeQueueRequest,
  renderNotificationEmail,
} from "../_shared/email-templates.js";

const JSON_HEADERS = { "Content-Type": "application/json" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readAdminKey() {
  const modernKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modernKeys) {
    try {
      const parsed = JSON.parse(modernKeys);
      if (parsed.default) return String(parsed.default);
    } catch {
      // Fall back to the legacy service role key during the platform transition.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function adminHeaders(key: string, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    apikey: key,
    ...extra,
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function restUrl(supabaseUrl: string, path: string) {
  return `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 1000) };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("QUEUE_WORKER_SECRET") || "";
  const suppliedSecret = request.headers.get("x-laxhornet-worker-secret") || "";
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const adminKey = readAdminKey();
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("EMAIL_FROM_NOTIFICATIONS") || "LaxHornet <notifications@laxhornet.mybranford.com>";
  const replyTo = Deno.env.get("EMAIL_REPLY_TO") || "degrassed@gmail.com";
  const siteUrl = Deno.env.get("SITE_URL") || "https://laxhornet.mybranford.com";
  const maxAttempts = Math.max(1, Math.min(Number.parseInt(Deno.env.get("QUEUE_MAX_ATTEMPTS") || "4", 10), 10));

  if (!supabaseUrl || !adminKey) {
    return jsonResponse({ error: "Supabase server credentials are unavailable" }, 503);
  }

  let input: unknown = {};
  try {
    input = await request.json();
  } catch {
    input = {};
  }
  const options = normalizeQueueRequest(input);

  const filters = [
    "select=id,event_type,recipient_email,subject,body,payload,status,attempts,created_at",
    "status=eq.pending",
    `attempts=lt.${maxAttempts}`,
    "order=created_at.asc",
    `limit=${options.limit}`,
  ];
  if (options.queueIds.length) {
    const encodedIds = options.queueIds.map((id) => encodeURIComponent(id.replaceAll(",", ""))).join(",");
    filters.push(`id=in.(${encodedIds})`);
  }

  const listResponse = await fetch(restUrl(supabaseUrl, `notification_queue?${filters.join("&")}`), {
    headers: adminHeaders(adminKey),
  });
  const rows = await parseJson(listResponse);
  if (!listResponse.ok || !Array.isArray(rows)) {
    return jsonResponse({ error: "Unable to read the notification queue", detail: rows }, 502);
  }

  const eligible = rows.filter((row) =>
    isAllowedEventType(row.event_type) &&
    EMAIL_PATTERN.test(String(row.recipient_email || "")),
  );

  if (options.dryRun) {
    return jsonResponse({
      dryRun: true,
      selected: rows.length,
      eligible: eligible.length,
      notifications: eligible.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        createdAt: row.created_at,
        attempts: row.attempts,
      })),
    });
  }

  if (!resendKey) {
    return jsonResponse({ error: "RESEND_API_KEY is unavailable; no queue rows were claimed" }, 503);
  }

  const results = [];
  for (const row of eligible) {
    const claimResponse = await fetch(
      restUrl(
        supabaseUrl,
        `notification_queue?id=eq.${encodeURIComponent(row.id)}&status=eq.pending&attempts=eq.${Number(row.attempts) || 0}`,
      ),
      {
        method: "PATCH",
        headers: adminHeaders(adminKey, {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        }),
        body: JSON.stringify({
          status: "sending",
          attempts: (Number(row.attempts) || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: "",
        }),
      },
    );
    const claimedRows = await parseJson(claimResponse);
    if (!claimResponse.ok || !Array.isArray(claimedRows) || claimedRows.length !== 1) {
      results.push({ id: row.id, status: "skipped", reason: "already claimed" });
      continue;
    }

    try {
      const rendered = renderNotificationEmail(row, { siteUrl });
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": buildIdempotencyKey(row),
        },
        body: JSON.stringify({
          from,
          to: [row.recipient_email],
          reply_to: replyTo,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        }),
      });
      const providerResult = await parseJson(resendResponse);
      if (!resendResponse.ok || !providerResult?.id) {
        throw new Error(`Resend ${resendResponse.status}: ${JSON.stringify(providerResult).slice(0, 700)}`);
      }

      const sentAt = new Date().toISOString();
      const updateResponse = await fetch(restUrl(supabaseUrl, `notification_queue?id=eq.${encodeURIComponent(row.id)}`), {
        method: "PATCH",
        headers: adminHeaders(adminKey, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          status: "sent",
          sent_at: sentAt,
          last_error: "",
          provider_message_id: providerResult.id,
        }),
      });
      if (!updateResponse.ok) throw new Error(`Queue sent-status update failed: ${updateResponse.status}`);
      results.push({ id: row.id, status: "sent", providerMessageId: providerResult.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = (Number(row.attempts) || 0) + 1;
      const status = attempts >= maxAttempts ? "failed" : "pending";
      await fetch(restUrl(supabaseUrl, `notification_queue?id=eq.${encodeURIComponent(row.id)}`), {
        method: "PATCH",
        headers: adminHeaders(adminKey, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          status,
          last_error: message.slice(0, 1000),
        }),
      });
      results.push({ id: row.id, status, error: message.slice(0, 240) });
    }
  }

  return jsonResponse({
    dryRun: false,
    selected: rows.length,
    eligible: eligible.length,
    results,
  });
});
