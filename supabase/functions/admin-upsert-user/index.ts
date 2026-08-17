import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type UserRole = "admin" | "broker" | "brand" | "deal" | "mapiq";

type Payload = {
  id?: unknown;
  email?: unknown;
  fullName?: unknown;
  username?: unknown;
  role?: unknown;
  brandId?: unknown;
  dealId?: unknown;
  brokerName?: unknown;
  disabled?: unknown;
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type ProfileState = {
  role: UserRole | null;
  disabledAt: string | null;
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

function asRole(value: unknown): UserRole | null {
  return value === "admin" || value === "broker" || value === "brand" || value === "deal" || value === "mapiq" ? value : null;
}

function asOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function usernameFromEmail(email: string): string {
  return normalizeEmail(email).split("@")[0]?.replace(/[^a-z0-9._-]/gi, "").toLowerCase() || normalizeEmail(email);
}

function redirectUrl(request: Request): string {
  const configured = optionalEnv("APP_URL") ?? optionalEnv("SITE_URL") ?? optionalEnv("PUBLIC_SITE_URL");
  const origin = configured ?? request.headers.get("origin") ?? "http://localhost:8080";
  return `${origin.replace(/\/$/, "")}/set-password`;
}

async function getAdminUser(supabase: ReturnType<typeof createClient>, authHeader: string | null): Promise<AuthUser> {
  if (!authHeader?.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });
  const jwt = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !authData.user?.id) throw new Response("Unauthorized", { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,disabled_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "admin" || profile.disabled_at) throw new Response("Forbidden", { status: 403 });
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

async function resolveDealBrandId(supabase: ReturnType<typeof createClient>, dealId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("deals")
    .select("brand_id")
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw error;
  return data?.brand_id ?? null;
}

async function getProfileState(supabase: ReturnType<typeof createClient>, userId: string): Promise<ProfileState> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role,disabled_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    role: asRole(data?.role),
    disabledAt: typeof data?.disabled_at === "string" ? data.disabled_at : null,
  };
}

async function countAdminProfiles(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .is("disabled_at", null);
  if (error) throw error;
  return count ?? 0;
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
    const requestedId = asString(payload.id);
    const email = asString(payload.email);
    const fullName = asString(payload.fullName);
    const username = asString(payload.username);
    const role = asRole(payload.role);
    const disabled = asOptionalBoolean(payload.disabled);
    let brandId = asString(payload.brandId);
    let dealId = asString(payload.dealId);
    let brokerName = asString(payload.brokerName);

    if (!email) return json({ error: "Email is required." }, 400);
    if (!fullName) return json({ error: "Full name is required." }, 400);
    if (!role) return json({ error: "A valid role is required." }, 400);

    if (role === "brand" && !brandId) return json({ error: "Brand Level users require a brand scope." }, 400);
    if (role === "deal" && !dealId) return json({ error: "Deal Level users require a deal scope." }, 400);
    if (role === "broker" && !brokerName) return json({ error: "Broker users require a broker code." }, 400);

    if (role === "deal" && dealId) {
      const resolvedBrandId = await resolveDealBrandId(supabase, dealId);
      if (!resolvedBrandId) return json({ error: "Selected deal was not found." }, 400);
      brandId = resolvedBrandId;
    }

    if (role === "admin" || role === "mapiq") {
      brandId = null;
      dealId = null;
      brokerName = null;
    }

    if (role === "brand") {
      dealId = null;
      brokerName = null;
    }

    if (role === "deal") {
      brokerName = null;
    }

    if (role === "broker") {
      brandId = null;
      dealId = null;
    }

    const normalizedEmail = normalizeEmail(email);
    let authUser: AuthUser | null = requestedId ? { id: requestedId, email: normalizedEmail } : await findAuthUserByEmail(supabase, normalizedEmail);
    let emailMode: "invite" | "none" = "none";
    const existingProfile = authUser ? await getProfileState(supabase, authUser.id) : { role: null, disabledAt: null };
    const existingRole = existingProfile.role;

    if (authUser?.id === adminUser.id && existingRole && role !== existingRole) {
      return json({ error: "Admins cannot change their own role." }, 400);
    }

    if (existingRole === "admin" && role !== "admin") {
      const adminCount = await countAdminProfiles(supabase);
      if (adminCount <= 1) {
        return json({ error: "At least one admin must remain in the system." }, 400);
      }
    }

    if (disabled === true && (existingRole === "admin" || role === "admin")) {
      return json({ error: "Admin users cannot be deactivated." }, 400);
    }

    if (existingProfile.disabledAt && role === "admin") {
      return json({ error: "Reactivate this user before assigning admin access." }, 400);
    }

    if (!authUser) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: {
          full_name: fullName,
          role,
        },
        redirectTo: redirectUrl(request),
      });
      if (inviteError) throw inviteError;
      if (!inviteData.user?.id) return json({ error: "Supabase Auth did not return the invited user." }, 502);
      authUser = { id: inviteData.user.id, email: inviteData.user.email };
      emailMode = "invite";
      if (disabled !== null) {
        const { error: banError } = await supabase.auth.admin.updateUserById(authUser.id, {
          ban_duration: disabled ? "876000h" : "none",
        });
        if (banError) throw banError;
      }
    } else {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(authUser.id, {
        email: normalizedEmail,
        user_metadata: {
          full_name: fullName,
          role,
        },
        ...(disabled !== null ? { ban_duration: disabled ? "876000h" : "none" } : {}),
      });
      if (authUpdateError) throw authUpdateError;
    }

    const profileValues: Record<string, unknown> = {
      id: authUser.id,
      email: normalizedEmail,
      full_name: fullName,
      username: username || usernameFromEmail(normalizedEmail),
      role,
      brand_id: brandId,
      deal_id: dealId,
      broker_name: brokerName,
    };
    if (disabled !== null) profileValues.disabled_at = disabled ? new Date().toISOString() : null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(profileValues, { onConflict: "id" })
      .select("id,email,full_name,username,role,brand_id,deal_id,broker_name,disabled_at,created_at,updated_at")
      .single();
    if (profileError) throw profileError;

    return json({ profile, emailMode });
  } catch (error) {
    if (error instanceof Response) return json({ error: await error.text() }, error.status);
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to save user." }, 500);
  }
});
