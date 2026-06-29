import type { UserRole } from "@/domain/entities";
import { parseUserRole } from "@/domain/permissions";

const AUTH_KEY = "rcre_logged_in";
const TOKEN_KEY = "rcre_access_token";
const REFRESH_TOKEN_KEY = "rcre_refresh_token";
const ROLE_KEY = "rcre_role";
const USER_ID_KEY = "rcre_user_id";
const EMAIL_KEY = "rcre_email";
const PROFILE_KEY = "rcre_profile";
const PREVIEW_ROLE_KEY = "rcre_preview_role";
export const AUTH_SESSION_EVENT = "rcre:session-change";

export type SessionProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  role: UserRole;
  brandId: string | null;
  dealId: string | null;
};

export type AuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string;
  email: string | null;
  role: UserRole;
  profile: SessionProfile;
};

function readProfile(): SessionProfile | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PROFILE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SessionProfile>;
    if (typeof parsed.id !== "string") return null;
    return {
      id: parsed.id,
      email: typeof parsed.email === "string" ? parsed.email : null,
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : null,
      username: typeof parsed.username === "string" ? parsed.username : null,
      role: parseUserRole(parsed.role),
      brandId: typeof parsed.brandId === "string" ? parsed.brandId : null,
      dealId: typeof parsed.dealId === "string" ? parsed.dealId : null,
    };
  } catch {
    return null;
  }
}

function emitSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem(AUTH_KEY) !== "true") return null;
  const accessToken = sessionStorage.getItem(TOKEN_KEY);
  if (!accessToken) return null;
  const profile = readProfile();
  const userId = sessionStorage.getItem(USER_ID_KEY) ?? profile?.id;
  if (!userId || !profile) return null;

  return {
    accessToken,
    refreshToken: sessionStorage.getItem(REFRESH_TOKEN_KEY),
    userId,
    email: sessionStorage.getItem(EMAIL_KEY) ?? profile.email,
    role: profile.role,
    profile,
  };
}

export function persistSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_KEY, "true");
  sessionStorage.setItem(ROLE_KEY, session.profile.role);
  sessionStorage.setItem(USER_ID_KEY, session.userId);
  if (session.email) sessionStorage.setItem(EMAIL_KEY, session.email);
  else sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(session.profile));
  sessionStorage.removeItem(PREVIEW_ROLE_KEY);
  if (session.accessToken) sessionStorage.setItem(TOKEN_KEY, session.accessToken);
  else sessionStorage.removeItem(TOKEN_KEY);
  if (session.refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  else sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  emitSessionChanged();
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(USER_ID_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
  sessionStorage.removeItem(PREVIEW_ROLE_KEY);
  emitSessionChanged();
}

export function getStoredProfile(): SessionProfile | null {
  return readProfile();
}
