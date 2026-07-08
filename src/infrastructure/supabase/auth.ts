import { clearSession, getStoredSession, persistSession, type AuthSession, type SessionProfile } from "@/application/auth/session";
import type { UserRole } from "@/domain/entities";
import { parseUserRole } from "@/domain/permissions";
import { SupabaseHttpError, supabaseRequest, type JsonObject } from "./client";

export const DEFAULT_USERNAME_DOMAIN = "reimaginecre.local";

export type SupabaseAuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string | null;
};

export type AuthResult =
  | { ok: true; session: AuthSession; message?: string }
  | { ok: false; message: string };

export type PasswordChangeResult =
  | { ok: true }
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

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name: string | null;
  username: string | null;
  role: UserRole;
  brand_id: string | null;
  deal_id: string | null;
  broker_name?: string | null;
};

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
  };
}

function mapProfile(row: ProfileRow, authEmail: string | null): SessionProfile {
  return {
    id: row.id,
    email: row.email ?? authEmail,
    fullName: row.full_name,
    username: row.username,
    role: parseUserRole(row.role),
    brandId: row.brand_id,
    dealId: row.deal_id,
    brokerName: row.broker_name ?? null,
  };
}

async function fetchProfileRows(accessToken: string, userId: string, select: string): Promise<ProfileRow[]> {
  return supabaseRequest<ProfileRow[]>("/rest/v1/profiles", {
    query: new URLSearchParams({
      id: `eq.${userId}`,
      select,
      limit: "1",
    }),
    accessToken,
  });
}

export async function fetchCurrentProfile(accessToken: string, userId: string, authEmail: string | null): Promise<SessionProfile> {
  try {
    const rows = await fetchProfileRows(accessToken, userId, "id,email,full_name,username,role,brand_id,deal_id,broker_name");
    if (rows[0]) return mapProfile(rows[0], authEmail);
  } catch (error) {
    const canFallbackWithoutBrokerName = error instanceof SupabaseHttpError && error.status === 400;
    if (!canFallbackWithoutBrokerName) throw error;
    try {
      const rows = await fetchProfileRows(accessToken, userId, "id,email,full_name,username,role,brand_id,deal_id");
      if (rows[0]) return mapProfile(rows[0], authEmail);
    } catch (fallbackError) {
      const canFallbackWithoutEmail = fallbackError instanceof SupabaseHttpError && fallbackError.status === 400;
      if (!canFallbackWithoutEmail) throw fallbackError;
      const rows = await fetchProfileRows(accessToken, userId, "id,full_name,username,role,brand_id,deal_id");
      if (rows[0]) return mapProfile(rows[0], authEmail);
    }
  }

  throw new Error("Your Supabase Auth user does not have a platform profile. Ask an admin to create a row in public.profiles.");
}

export async function refreshProfileSession(session: AuthSession): Promise<AuthSession> {
  if (!session.accessToken) throw new Error("Session expired. Refresh the page and log in again.");
  const profile = await fetchCurrentProfile(session.accessToken, session.userId, session.email);
  return {
    ...session,
    role: profile.role,
    profile,
    email: profile.email ?? session.email,
  };
}

export function credentialToSupabaseEmail(credential: string): string {
  const normalized = credential.trim();
  if (normalized.includes("@")) return normalized.toLowerCase();
  return `${normalized.toLowerCase()}@${DEFAULT_USERNAME_DOMAIN}`;
}

export async function signInWithSupabase(credential: string, password: string): Promise<AuthResult> {
  try {
    const email = credentialToSupabaseEmail(credential);
    const payload = await supabaseRequest<unknown>("/auth/v1/token", {
      method: "POST",
      query: new URLSearchParams({ grant_type: "password" }),
      body: { email, password } satisfies JsonObject,
    });
    const authSession = normalizeAuthResponse(payload);
    if (!authSession) return { ok: false, message: "Authentication response was invalid." };
    const profile = await fetchCurrentProfile(authSession.accessToken, authSession.userId, authSession.email);
    const session: AuthSession = {
      accessToken: authSession.accessToken,
      refreshToken: authSession.refreshToken,
      userId: authSession.userId,
      email: profile.email ?? authSession.email,
      role: profile.role,
      profile,
    };
    return { ok: true, session };
  } catch (error) {
    if (error instanceof Error && !error.message.includes("Supabase request failed")) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Invalid username or password" };
  }
}

export async function changeSupabasePassword(currentPassword: string, newPassword: string): Promise<PasswordChangeResult> {
  const session = getStoredSession();
  const credential = session?.email ?? session?.profile.email ?? session?.profile.username;
  if (!credential) {
    return { ok: false, message: "Your profile does not have an email or username for password verification." };
  }

  const authCheck = await signInWithSupabase(credential, currentPassword);
  if (!authCheck.ok) {
    return { ok: false, message: "Current password is incorrect." };
  }

  try {
    await supabaseRequest<unknown>("/auth/v1/user", {
      method: "PUT",
      accessToken: authCheck.session.accessToken,
      body: { password: newPassword } satisfies JsonObject,
    });
    persistSession(authCheck.session);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && !error.message.includes("Supabase request failed")) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Unable to update password. Please try again." };
  }
}

export async function signOutOfSupabase(): Promise<void> {
  const session = getStoredSession();
  try {
    if (session?.accessToken) {
      await supabaseRequest<unknown>("/auth/v1/logout", {
        method: "POST",
        accessToken: session.accessToken,
      });
    }
  } catch {
    // Local session cleanup is still the important part for this browser session.
  } finally {
    clearSession();
  }
}
