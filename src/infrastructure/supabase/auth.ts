import type { UserRole } from "@/domain/entities";
import { parseUserRole } from "@/domain/permissions";
import { supabaseRequest, type JsonObject } from "./client";

export type SupabaseAuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string | null;
  role: UserRole;
};

export type SignInResult =
  | { ok: true; session: SupabaseAuthSession }
  | { ok: false; message: string };

type SupabaseAuthResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  user?: {
    id?: unknown;
    email?: unknown;
    user_metadata?: {
      role?: unknown;
    };
    app_metadata?: {
      role?: unknown;
    };
  };
};

function readRole(response: SupabaseAuthResponse): UserRole {
  const metadataRole = response.user?.user_metadata?.role;
  const appRole = response.user?.app_metadata?.role;
  return parseUserRole(typeof metadataRole === "string" ? metadataRole : typeof appRole === "string" ? appRole : null);
}

function normalizeAuthResponse(payload: unknown): SupabaseAuthSession | null {
  const response = payload as SupabaseAuthResponse;
  if (typeof response.access_token !== "string") return null;
  if (typeof response.refresh_token !== "string") return null;
  if (typeof response.user?.id !== "string") return null;

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    userId: response.user.id,
    email: typeof response.user.email === "string" ? response.user.email : null,
    role: readRole(response),
  };
}

export async function signInWithSupabase(email: string, password: string): Promise<SignInResult> {
  try {
    const payload = await supabaseRequest<unknown>("/auth/v1/token", {
      method: "POST",
      query: new URLSearchParams({ grant_type: "password" }),
      body: { email, password } satisfies JsonObject,
    });
    const session = normalizeAuthResponse(payload);
    if (!session) return { ok: false, message: "Authentication response was invalid." };
    return { ok: true, session };
  } catch {
    return { ok: false, message: "Invalid username or password" };
  }
}
