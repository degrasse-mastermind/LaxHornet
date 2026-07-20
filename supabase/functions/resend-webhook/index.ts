import "jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };
const EVENT_UPDATES: Record<string, Record<string, string>> = {
  "email.delivered": { status: "sent", timestampColumn: "delivered_at" },
  "email.bounced": { status: "bounced", timestampColumn: "bounced_at" },
  "email.complained": { status: "complained", timestampColumn: "complained_at" },
};

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
      // Fall back during the platform key transition.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function adminHeaders(key: string, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { apikey: key, ...extra };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function validSignature(request: Request, rawBody: string, secret: string) {
  const id = request.headers.get("svix-id") || request.headers.get("webhook-id") || "";
  const timestamp = request.headers.get("svix-timestamp") || request.headers.get("webhook-timestamp") || "";
  const signatureHeader = request.headers.get("svix-signature") || request.headers.get("webhook-signature") || "";
  if (!id || !timestamp || !signatureHeader || !secret) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(encodedSecret);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  const expected = btoa(String.fromCharCode(...digest));
  return signatureHeader
    .split(" ")
    .map((value) => value.split(","))
    .some(([version, signature]) => version === "v1" && signature === expected);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await request.text();
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";
  if (!(await validSignature(request, rawBody, webhookSecret))) {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const mapping = EVENT_UPDATES[event?.type];
  if (!mapping) return jsonResponse({ received: true, ignored: true });

  const providerMessageId = String(event?.data?.email_id || event?.data?.id || "");
  if (!providerMessageId) return jsonResponse({ error: "Missing provider message ID" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const adminKey = readAdminKey();
  if (!supabaseUrl || !adminKey) return jsonResponse({ error: "Server credentials unavailable" }, 503);

  const occurredAt = event?.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString();
  const update = {
    status: mapping.status,
    [mapping.timestampColumn]: occurredAt,
    last_error: "",
  };
  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/notification_queue?provider_message_id=eq.${encodeURIComponent(providerMessageId)}`,
    {
      method: "PATCH",
      headers: adminHeaders(adminKey, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify(update),
    },
  );
  const changed = await response.json().catch(() => []);
  if (!response.ok) return jsonResponse({ error: "Queue update failed" }, 502);

  return jsonResponse({ received: true, matched: Array.isArray(changed) ? changed.length : 0 });
});
