import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RequestedRole = "broker" | "brand" | "deal";

type AccountRequestRow = {
  id: string;
  full_name: string;
  email: string;
  requested_role: RequestedRole;
  company: string | null;
  brand_name: string | null;
  deal_name: string | null;
  brand_id: string | null;
  deal_id: string | null;
  broker_name: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Payload = {
  requestId?: unknown;
  updates?: Record<string, unknown>;
};

type AuthUser = {
  id: string;
  email?: string | null;
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

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function optionalEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function usernameFromEmail(email: string): string {
  return normalizeEmail(email).split("@")[0]?.replace(/[^a-z0-9._-]/gi, "").toLowerCase() || normalizeEmail(email);
}

function brokerCodeFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function redirectUrl(request: Request): string {
  const configured = optionalEnv("APP_URL") ?? optionalEnv("SITE_URL") ?? optionalEnv("PUBLIC_SITE_URL");
  const origin = configured ?? request.headers.get("origin") ?? "http://localhost:8080";
  return `${origin.replace(/\/$/, "")}/set-password`;
}

function sanitizeUpdates(input: Record<string, unknown> | undefined): Partial<AccountRequestRow> {
  const updates: Record<string, string | null> = {};
  const textColumns = ["full_name", "email", "company", "brand_name", "deal_name", "brand_id", "deal_id", "broker_name", "message", "admin_notes"];
  for (const column of textColumns) {
    if (!input || !(column in input)) continue;
    updates[column] = asString(input[column]);
  }

  if (input?.requested_role === "broker" || input?.requested_role === "brand" || input?.requested_role === "deal") {
    updates.requested_role = input.requested_role;
  }

  if (updates.email) updates.email = normalizeEmail(updates.email);
  return updates as Partial<AccountRequestRow>;
}

async function getAdminUser(supabase: ReturnType<typeof createClient>, authHeader: string | null): Promise<AuthUser> {
  if (!authHeader?.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });
  const jwt = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !authData.user?.id) throw new Response("Unauthorized", { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "admin") throw new Response("Forbidden", { status: 403 });
  return { id: authData.user.id, email: authData.user.email };
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createClient>, email: string): Promise<AuthUser | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => normalizeEmail(user.email ?? "") === email);
    if (found) return { id: found.id, email: found.email };
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function resolveBrandId(supabase: ReturnType<typeof createClient>, request: AccountRequestRow): Promise<string | null> {
  if (request.brand_id) return request.brand_id;
  const candidates = [request.brand_name, request.company].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const { data: exact, error: exactError } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", candidate)
      .limit(2);
    if (exactError) throw exactError;
    const exactRows = exact ?? [];
    if (exactRows.length === 1) return exactRows[0].id;

    const { data: fuzzy, error: fuzzyError } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", `%${candidate}%`)
      .limit(2);
    if (fuzzyError) throw fuzzyError;
    const fuzzyRows = fuzzy ?? [];
    if (fuzzyRows.length === 1) return fuzzyRows[0].id;
  }
  return null;
}

async function resolveDealId(supabase: ReturnType<typeof createClient>, request: AccountRequestRow, brandId: string | null): Promise<{ dealId: string | null; brandId: string | null }> {
  if (request.deal_id) {
    const { data, error } = await supabase
      .from("deals")
      .select("id,brand_id")
      .eq("id", request.deal_id)
      .maybeSingle();
    if (error) throw error;
    return { dealId: data?.id ?? request.deal_id, brandId: data?.brand_id ?? brandId };
  }

  const candidate = request.deal_name?.trim();
  if (!candidate) return { dealId: null, brandId };

  let query = supabase.from("deals").select("id,brand_id").ilike("franchisee", candidate).limit(2);
  if (brandId) query = query.eq("brand_id", brandId);
  const { data: exact, error: exactError } = await query;
  if (exactError) throw exactError;
  const exactRows = exact ?? [];
  if (exactRows.length === 1) return { dealId: exactRows[0].id, brandId: exactRows[0].brand_id };

  let fuzzyQuery = supabase.from("deals").select("id,brand_id").ilike("franchisee", `%${candidate}%`).limit(2);
  if (brandId) fuzzyQuery = fuzzyQuery.eq("brand_id", brandId);
  const { data: fuzzy, error: fuzzyError } = await fuzzyQuery;
  if (fuzzyError) throw fuzzyError;
  const fuzzyRows = fuzzy ?? [];
  if (fuzzyRows.length === 1) return { dealId: fuzzyRows[0].id, brandId: fuzzyRows[0].brand_id };
  return { dealId: null, brandId };
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminUser = await getAdminUser(supabase, request.headers.get("Authorization"));
    const payload = (await request.json().catch(() => ({}))) as Payload;
    const requestId = asString(payload.requestId);
    if (!requestId) return json({ error: "requestId is required." }, 400);

    const updates = sanitizeUpdates(payload.updates);
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("account_requests")
        .update(updates)
        .eq("id", requestId);
      if (updateError) throw updateError;
    }

    const { data: accountRequestRaw, error: requestError } = await supabase
      .from("account_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    const accountRequest = accountRequestRaw as AccountRequestRow | null;
    if (!accountRequest) return json({ error: "Account request not found." }, 404);
    if (accountRequest.requested_role !== "broker" && accountRequest.requested_role !== "brand" && accountRequest.requested_role !== "deal") {
      return json({ error: "Only broker, brand, and deal-level account requests can be approved." }, 400);
    }

    const email = normalizeEmail(accountRequest.email);
    const setupRedirectUrl = redirectUrl(request);
    let brandId = await resolveBrandId(supabase, accountRequest);
    let dealId: string | null = null;
    let brokerName: string | null = accountRequest.broker_name?.trim() || null;

    if (accountRequest.requested_role === "deal") {
      const resolvedDeal = await resolveDealId(supabase, accountRequest, brandId);
      dealId = resolvedDeal.dealId;
      brandId = resolvedDeal.brandId;
      if (!dealId) return json({ error: "Deal-level approval needs a selected deal scope or an unambiguous deal name match." }, 400);
    }

    if (accountRequest.requested_role === "brand" && !brandId) {
      return json({ error: "Brand-level approval needs a selected brand scope or an unambiguous brand name match." }, 400);
    }

    if (accountRequest.requested_role === "broker" && !brokerName) {
      brokerName = brokerCodeFromName(accountRequest.full_name);
    }

    let authUser = await findAuthUserByEmail(supabase, email);
    let emailMode: "invite" | "reset" = "reset";
    if (!authUser) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: accountRequest.full_name,
          role: accountRequest.requested_role,
        },
        redirectTo: setupRedirectUrl,
      });
      if (inviteError) throw inviteError;
      if (!inviteData.user?.id) return json({ error: "Supabase Auth did not return the invited user." }, 502);
      authUser = { id: inviteData.user.id, email: inviteData.user.email };
      emailMode = "invite";
    } else {
      const { error: metadataError } = await supabase.auth.admin.updateUserById(authUser.id, {
        email,
        user_metadata: {
          full_name: accountRequest.full_name,
          role: accountRequest.requested_role,
        },
      });
      if (metadataError) throw metadataError;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: setupRedirectUrl,
      });
      if (resetError) throw resetError;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: authUser.id,
        email,
        full_name: accountRequest.full_name,
        username: usernameFromEmail(email),
        role: accountRequest.requested_role,
        brand_id: accountRequest.requested_role === "broker" ? null : brandId,
        deal_id: accountRequest.requested_role === "deal" ? dealId : null,
        broker_name: accountRequest.requested_role === "broker" ? brokerName : null,
      }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { data: approvedRequestRaw, error: approvalError } = await supabase
      .from("account_requests")
      .update({
        status: "approved",
        brand_id: brandId,
        deal_id: dealId,
        broker_name: brokerName,
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select("*")
      .single();
    if (approvalError) throw approvalError;
    const approvedRequest = approvedRequestRaw as AccountRequestRow;

    return json({
      request: approvedRequest,
      userId: authUser.id,
      emailMode,
      redirectTo: setupRedirectUrl,
    });
  } catch (error) {
    if (error instanceof Response) return json({ error: await error.text() }, error.status);
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to approve account request." }, 500);
  }
});
