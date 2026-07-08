import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type RequestPayload = {
  recipients?: unknown;
  actionTypeLabel?: unknown;
  message?: unknown;
  requestedBy?: unknown;
  contextName?: unknown;
  contextUrl?: unknown;
  urgency?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value ? value : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function recipientList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function isAuthenticated(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return false;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
  });

  return response.ok;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await isAuthenticated(request.headers.get("Authorization")))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const apiKey = env("RESEND_API_KEY");
  const from = env("TAKE_ACTION_EMAIL_FROM");
  const fallbackTo = env("TAKE_ACTION_EMAIL_FALLBACK_TO");

  const payload = (await request.json().catch(() => ({}))) as RequestPayload;
  const recipients = recipientList(payload.recipients);
  const to = recipients.length > 0 ? recipients : recipientList(fallbackTo ? fallbackTo.split(",") : []);

  if (!apiKey) return json({ sent: false, reason: "RESEND_API_KEY is not configured." });
  if (!from) return json({ sent: false, reason: "TAKE_ACTION_EMAIL_FROM is not configured." });
  if (to.length === 0) return json({ sent: false, reason: "No email recipients were provided." });

  const actionType = asString(payload.actionTypeLabel, "Take Action");
  const requestedBy = asString(payload.requestedBy, "A Reimagine IQ user");
  const contextName = asString(payload.contextName, "Reimagine IQ");
  const contextUrl = asString(payload.contextUrl);
  const message = asString(payload.message, "No message provided.");
  const urgency = asString(payload.urgency, "normal");
  const subject = `Take Action: ${actionType}`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#243c51;line-height:1.5">
      <h2 style="margin:0 0 12px">Take Action</h2>
      <p><strong>Action:</strong> ${escapeHtml(actionType)}</p>
      <p><strong>Context:</strong> ${escapeHtml(contextName)}</p>
      <p><strong>Requested by:</strong> ${escapeHtml(requestedBy)}</p>
      <p><strong>Urgency:</strong> ${escapeHtml(urgency)}</p>
      <div style="margin:16px 0;padding:14px;border-left:4px solid #E18739;background:#f8fafc">
        ${escapeHtml(message).replaceAll("\n", "<br>")}
      </div>
      ${contextUrl ? `<p><a href="${escapeHtml(contextUrl)}" style="color:#E18739;font-weight:700">Open in Reimagine IQ</a></p>` : ""}
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text: [
        `Take Action: ${actionType}`,
        `Context: ${contextName}`,
        `Requested by: ${requestedBy}`,
        `Urgency: ${urgency}`,
        "",
        message,
        "",
        contextUrl ? `Open in Reimagine IQ: ${contextUrl}` : "",
      ].filter(Boolean).join("\n"),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ sent: false, reason: "Resend request failed.", details: result }, 502);
  return json({ sent: true, id: result?.id ?? null });
});
