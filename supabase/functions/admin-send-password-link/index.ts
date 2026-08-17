import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Payload = {
  id?: unknown;
  email?: unknown;
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type TargetProfile = {
  id: string;
  email: string | null;
  disabled_at: string | null;
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

async function getTargetProfile(
  supabase: ReturnType<typeof createClient>,
  id: string | null,
  email: string | null,
): Promise<TargetProfile | null> {
  let query = supabase.from("profiles").select("id,email,disabled_at").limit(1);
  if (id) query = query.eq("id", id);
  else if (email) query = query.eq("email", email);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as TargetProfile | null;
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
    await getAdminUser(supabase, request.headers.get("Authorization"));

    const payload = (await request.json().catch(() => ({}))) as Payload;
    const requestedId = asString(payload.id);
    const requestedEmail = asString(payload.email);
    const normalizedRequestedEmail = requestedEmail ? normalizeEmail(requestedEmail) : null;
    const targetProfile = await getTargetProfile(supabase, requestedId, normalizedRequestedEmail);
    if (!targetProfile) return json({ error: "User profile was not found." }, 404);
    if (targetProfile.disabled_at) return json({ error: "Reactivate this user before sending a password link." }, 400);

    const profileEmail = targetProfile.email ? normalizeEmail(targetProfile.email) : normalizedRequestedEmail;
    if (!profileEmail) return json({ error: "This user does not have an email address." }, 400);

    let authUser: AuthUser | null = null;
    if (requestedId) {
      const { data, error } = await supabase.auth.admin.getUserById(requestedId);
      if (error) throw error;
      if (data.user?.id) authUser = { id: data.user.id, email: data.user.email };
    }
    if (!authUser) authUser = await findAuthUserByEmail(supabase, profileEmail);
    if (!authUser?.email) return json({ error: "Supabase Auth user was not found for this profile." }, 404);

    const email = normalizeEmail(authUser.email);
    const redirectTo = redirectUrl(request);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (resetError) throw resetError;

    return json({ email, redirectTo });
  } catch (error) {
    if (error instanceof Response) return json({ error: await error.text() }, error.status);
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to send password link." }, 500);
  }
});
