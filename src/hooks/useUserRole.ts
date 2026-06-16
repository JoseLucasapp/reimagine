// Reactive user-role store backed by sessionStorage.
// Switching roles updates every subscriber synchronously so the whole app
// re-renders without a page reload.
import { useSyncExternalStore } from "react";
import type { UserRole } from "@/domain/entities";
import {
  canEditDeal,
  canSeeRoute,
  canUseInternalTakeAction,
  canViewBrokerFiles,
  canViewFinancials,
  parseUserRole,
  ROLE_LABELS,
  ROLE_ROUTES,
} from "@/domain/permissions";

const KEY = "rcre_role";
const EVENT = "rcre:role-change";
const DEFAULT_ROLE: UserRole = "admin";

// Bump this when the default preview role changes. This prevents existing
// browser sessions that were saved as Deal Level from locking the user out
// after a deployment.
const DEFAULT_ROLE_VERSION_KEY = "rcre_role_default_version";
const DEFAULT_ROLE_VERSION = "brand-deal-platforms-2026-06-15";

type Listener = () => void;
const listeners = new Set<Listener>();

function ensureDefaultRole(): void {
  if (typeof window === "undefined") return;

  const currentVersion = sessionStorage.getItem(DEFAULT_ROLE_VERSION_KEY);
  const currentRole = sessionStorage.getItem(KEY);

  if (currentVersion !== DEFAULT_ROLE_VERSION || !currentRole) {
    sessionStorage.setItem(KEY, DEFAULT_ROLE);
    sessionStorage.setItem(DEFAULT_ROLE_VERSION_KEY, DEFAULT_ROLE_VERSION);
  }
}

function readRole(): UserRole {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  ensureDefaultRole();
  return parseUserRole(sessionStorage.getItem(KEY));
}

// Cache so useSyncExternalStore receives a stable reference between updates.
let current: UserRole = readRole();

function emit() {
  current = readRole();
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  ensureDefaultRole();

  // Sync across tabs.
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === DEFAULT_ROLE_VERSION_KEY) emit();
  });
  // Sync within the same tab.
  window.addEventListener(EVENT, emit as EventListener);
}

export const roleStore = {
  get(): UserRole {
    return current;
  },
  set(role: UserRole) {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(KEY, role);
    sessionStorage.setItem(DEFAULT_ROLE_VERSION_KEY, DEFAULT_ROLE_VERSION);
    window.dispatchEvent(new Event(EVENT));
  },
  resetToAdmin() {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(KEY, DEFAULT_ROLE);
    sessionStorage.setItem(DEFAULT_ROLE_VERSION_KEY, DEFAULT_ROLE_VERSION);
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
    () => current,
    () => DEFAULT_ROLE,
  );
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export {
  canEditDeal,
  canSeeRoute,
  canUseInternalTakeAction,
  canViewBrokerFiles,
  canViewFinancials,
  ROLE_LABELS,
  ROLE_ROUTES,
};
export type { UserRole };
