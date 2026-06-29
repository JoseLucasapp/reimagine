// Reactive role/profile access backed by the authenticated Supabase profile.
// Admin preview is intentionally stored separately from the persisted session.
import { useMemo, useSyncExternalStore } from "react";
import { AUTH_SESSION_EVENT, getStoredProfile, type SessionProfile } from "@/application/auth/session";
import type { UserRole } from "@/domain/entities";
import {
  canAccessAdminArea,
  canAccessBrand,
  canAccessDeal,
  canEditDeal,
  canSeeRoute,
  canUseInternalTakeAction,
  canViewBrokerFiles,
  canViewFinancials,
  getVisibleBrandsForUser,
  getVisibleDealsForUser,
  parseUserRole,
  ROLE_LABELS,
  ROLE_ROUTES,
  type ScopedUser,
} from "@/domain/permissions";

const PREVIEW_KEY = "rcre_preview_role";
const EVENT = "rcre:role-change";
const DEFAULT_ROLE: UserRole = "admin";

type Listener = () => void;
const listeners = new Set<Listener>();

function readProfile(): SessionProfile | null {
  return getStoredProfile();
}

function readPreviewRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PREVIEW_KEY);
  if (!raw) return null;
  return parseUserRole(raw);
}

function readEffectiveRole(): UserRole {
  const profile = readProfile();
  if (!profile) return DEFAULT_ROLE;
  if (profile.role !== "admin") return profile.role;
  return readPreviewRole() ?? profile.role;
}

function readRealRole(): UserRole {
  return readProfile()?.role ?? DEFAULT_ROLE;
}

function emit() {
  currentRole = readEffectiveRole();
  currentProfile = readProfile();
  listeners.forEach((listener) => listener());
}

let currentRole: UserRole = readEffectiveRole();
let currentProfile: SessionProfile | null = readProfile();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === PREVIEW_KEY || event.key?.startsWith("rcre_")) emit();
  });
  window.addEventListener(EVENT, emit as EventListener);
  window.addEventListener(AUTH_SESSION_EVENT, emit as EventListener);
}

export const roleStore = {
  get(): UserRole {
    return currentRole;
  },
  getRealRole(): UserRole {
    return readRealRole();
  },
  isPreviewing(): boolean {
    const profile = readProfile();
    return Boolean(profile && profile.role === "admin" && readPreviewRole() && readPreviewRole() !== "admin");
  },
  set(role: UserRole) {
    if (typeof window === "undefined") return;
    const profile = readProfile();
    if (!profile || profile.role !== "admin") return;
    if (role === "admin") sessionStorage.removeItem(PREVIEW_KEY);
    else sessionStorage.setItem(PREVIEW_KEY, role);
    window.dispatchEvent(new Event(EVENT));
  },
  resetToAdmin() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(PREVIEW_KEY);
    window.dispatchEvent(new Event(EVENT));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useUserRole(): UserRole {
  return useSyncExternalStore(
    roleStore.subscribe,
    () => currentRole,
    () => DEFAULT_ROLE,
  );
}

export function useCurrentProfile(): SessionProfile | null {
  return useSyncExternalStore(
    roleStore.subscribe,
    () => currentProfile,
    () => null,
  );
}

export function useScopedUser(): ScopedUser | null {
  const profile = useCurrentProfile();
  const role = useUserRole();
  return useMemo(() => {
    if (!profile) return null;
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      username: profile.username,
      role,
      realRole: profile.role,
      brandId: profile.brandId,
      dealId: profile.dealId,
    };
  }, [profile, role]);
}

export function useRealUserRole(): UserRole {
  return useSyncExternalStore(
    roleStore.subscribe,
    () => readRealRole(),
    () => DEFAULT_ROLE,
  );
}

export function useIsRolePreview(): boolean {
  return useSyncExternalStore(
    roleStore.subscribe,
    () => roleStore.isPreviewing(),
    () => false,
  );
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export {
  canAccessAdminArea,
  canAccessBrand,
  canAccessDeal,
  canEditDeal,
  canSeeRoute,
  canUseInternalTakeAction,
  canViewBrokerFiles,
  canViewFinancials,
  getVisibleBrandsForUser,
  getVisibleDealsForUser,
  ROLE_LABELS,
  ROLE_ROUTES,
};
export type { ScopedUser, UserRole };
