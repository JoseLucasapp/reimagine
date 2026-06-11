import type { UserRole } from "@/domain/entities";
import { parseUserRole } from "@/domain/permissions";

const AUTH_KEY = "rcre_logged_in";
const TOKEN_KEY = "rcre_access_token";
const REFRESH_TOKEN_KEY = "rcre_refresh_token";
const ROLE_KEY = "rcre_role";

export type AuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
  role: UserRole;
};

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem(AUTH_KEY) !== "true") return null;
  const accessToken = sessionStorage.getItem(TOKEN_KEY);
  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken: sessionStorage.getItem(REFRESH_TOKEN_KEY),
    role: parseUserRole(sessionStorage.getItem(ROLE_KEY)),
  };
}

export function persistSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_KEY, "true");
  sessionStorage.setItem(ROLE_KEY, session.role);
  if (session.accessToken) sessionStorage.setItem(TOKEN_KEY, session.accessToken);
  else sessionStorage.removeItem(TOKEN_KEY);
  if (session.refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  else sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
}
