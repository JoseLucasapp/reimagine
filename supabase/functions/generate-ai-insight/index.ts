import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type InsightType = "deal_summary" | "suggested_action" | "property_insight" | "dashboard_nudge" | "bizdev_follow_up" | "tour_book_draft";
type EntityType = "brand" | "deal" | "site";
type JsonObject = Record<string, unknown>;

type RequestPayload = {
  type?: InsightType;
  entityType?: EntityType;
  entityId?: string;
  force?: boolean;
  context?: JsonObject;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT_VERSION = "reimagine-ai-v1";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function sha256(input: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(input));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function supabaseGet<T>(path: string): Promise<T> {
  const url = `${env("SUPABASE_URL")}/rest/v1/${path}`;
  const response = await fetch(url, {
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Supabase read failed: ${JSON.stringify(payload)}`);
  return payload as T;
}

async function supabasePost<T>(path: string, body: JsonObject): Promise<T> {
  const url = `${env("SUPABASE_URL")}/rest/v1/${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Supabase write failed: ${JSON.stringify(payload)}`);
  return payload as T;
}

function encodeEq(value: string): string {
  return encodeURIComponent(`eq.${value}`);
}

async function loadDealContext(dealId: string, siteId?: string): Promise<JsonObject> {
  const [deal] = await supabaseGet<JsonObject[]>(`deals?id=${encodeEq(dealId)}&select=*`);
  if (!deal) throw new Error("Deal not found");

  const brandId = String(deal.brand_id ?? "");
  const [brand] = brandId ? await supabaseGet<JsonObject[]>(`brands?id=${encodeEq(brandId)}&select=*`) : [null];
  const notes = await supabaseGet<JsonObject[]>(`deal_notes?deal_id=${encodeEq(dealId)}&select=*&order=created_at.desc&limit=8`);
  const documents = await supabaseGet<JsonObject[]>(`deal_documents?deal_id=${encodeEq(dealId)}&select=*`);
  const sitesPath = siteId
    ? `sites?id=${encodeEq(siteId)}&select=*`
    : `sites?deal_id=${encodeEq(dealId)}&select=*&order=updated_at.desc`;
  const sites = await supabaseGet<JsonObject[]>(sitesPath);
  const requirements = brandId ? await supabaseGet<JsonObject[]>(`space_requirements?brand_id=${encodeEq(brandId)}&select=*`) : [];

  return { deal, brand, notes, documents, sites, requirements };
}

function fallbackOutput(type: InsightType, context: JsonObject): JsonObject {
  const deal = context.deal as JsonObject | undefined;
  const brand = context.brand as JsonObject | undefined;
  const sites = (context.sites as JsonObject[] | undefined) ?? [];
  const franchisee = String(deal?.franchisee ?? "this franchisee");
  const brandName = String(brand?.name ?? "this brand");
  const cityState = `${String(deal?.city ?? "")}, ${String(deal?.state ?? "")}`.replace(/^,\s*/, "").replace(/,\s*$/, "");

  if (type === "suggested_action") {
    return {
      action: `Review the latest status for ${franchisee} and confirm the next milestone with Reimagine.`,
      urgency: "normal",
      confidence: "low",
      risks: ["Generated from deterministic fallback because AI provider is not configured."],
      nextActions: ["Add a recent note", "Confirm missing documents", "Verify top site status"],
    };
  }

  if (type === "property_insight") {
    const site = sites[0];
    return {
      summary: `${String(site?.property_name ?? site?.address ?? "This site")} is being evaluated for ${franchisee}. Confirm space fit, landlord contact, and current LOI status before moving forward.`,
      fitScore: 50,
      confidence: "low",
      matches: [],
      risks: ["AI provider is not configured, so this is fallback logic."],
      recommendedNextAction: "Complete missing site and landlord details.",
    };
  }

  return {
    summary: `${brandName} deal for ${franchisee}${cityState ? ` in ${cityState}` : ""} is currently at ${String(deal?.stage ?? "the current stage")}. Review recent notes, documents, and top sites before the next client update.`,
    urgency: "normal",
    confidence: "low",
    risks: ["Generated from deterministic fallback because AI provider is not configured."],
    nextActions: ["Review recent notes", "Validate required documents", "Confirm top site status"],
    missingData: [],
  };
}

function buildPrompt(type: InsightType, context: JsonObject): string {
  const instructionByType: Record<InsightType, string> = {
    deal_summary: "Create a concise executive summary of this commercial real estate deal.",
    suggested_action: "Recommend the single most useful next action for the Reimagine team.",
    property_insight: "Evaluate the selected site against the brand requirements and current deal status.",
    dashboard_nudge: "Create short dashboard nudges for deals that need attention.",
    bizdev_follow_up: "Recommend follow-up prioritization for business development prospects.",
    tour_book_draft: "Draft concise tour book copy from the selected deal and sites.",
  };

  return [
    "You are an assistant for Reimagine Commercial Real Estate.",
    "Return JSON only. Do not include markdown.",
    "Use only the supplied data. If data is missing, say what is missing instead of inventing details.",
    "Allowed JSON keys: summary, action, urgency, risks, nextActions, missingData, fitScore, matches, recommendedNextAction, confidence.",
    instructionByType[type],
    "Supabase context:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

async function callAiProvider(type: InsightType, context: JsonObject): Promise<{ output: JsonObject; model: string }> {
  const apiKey = Deno.env.get("AI_PROVIDER_API_KEY");
  const apiUrl = Deno.env.get("AI_PROVIDER_API_URL");
  const model = Deno.env.get("AI_PROVIDER_MODEL") ?? "reimagine-default";

  if (!apiKey || !apiUrl) {
    return { output: fallbackOutput(type, context), model: "template-fallback" };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You produce precise JSON for a commercial real estate workflow." },
        { role: "user", content: buildPrompt(type, context) },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(`AI provider failed: ${JSON.stringify(payload)}`);

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("AI provider response did not include message content.");

  try {
    return { output: JSON.parse(content) as JsonObject, model };
  } catch {
    return { output: { summary: content, confidence: "medium" }, model };
  }
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const payload = (await request.json()) as RequestPayload;
    const type = payload.type;
    const entityId = payload.entityId;
    const entityType = payload.entityType ?? "deal";

    if (!type || !entityId) return json({ error: "type and entityId are required" }, 400);
    if (entityType !== "deal" && entityType !== "site") return json({ error: "Only deal and site AI insights are implemented in v1" }, 400);

    let dealId = entityId;
    let siteId = typeof payload.context?.siteId === "string" ? payload.context.siteId : undefined;

    if (entityType === "site") {
      siteId = entityId;
      const [site] = await supabaseGet<JsonObject[]>(`sites?id=${encodeEq(siteId)}&select=id,deal_id`);
      if (!site?.deal_id) return json({ error: "Site not found" }, 404);
      dealId = String(site.deal_id);
    }

    if (typeof payload.context?.dealId === "string") {
      dealId = payload.context.dealId;
    }

    const context = await loadDealContext(dealId, siteId);
    const inputHash = await sha256({ type, entityType, entityId, context, promptVersion: PROMPT_VERSION });

    if (!payload.force) {
      const cached = await supabaseGet<JsonObject[]>(
        `ai_insights?insight_type=${encodeEq(type)}&entity_type=${encodeEq(entityType)}&entity_id=${encodeEq(entityId)}&input_hash=${encodeEq(inputHash)}&status=eq.completed&select=*&order=created_at.desc&limit=1`,
      );
      if (cached[0]) return json({ insight: cached[0], cached: true });
    }

    const { output, model } = await callAiProvider(type, context);
    const rows = await supabasePost<JsonObject[]>("ai_insights", {
      insight_type: type,
      entity_type: entityType,
      entity_id: entityId,
      prompt_version: PROMPT_VERSION,
      input_hash: inputHash,
      output,
      model,
      status: "completed",
    });

    return json({ insight: rows[0], cached: false });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
