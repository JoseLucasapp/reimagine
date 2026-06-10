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
type Listener = () => void;
const listeners = new Set<Listener>();

function readRole(): UserRole {
  if (typeof window === "undefined") return "admin";
  return parseUserRole(sessionStorage.getItem(KEY));
}

// Cache so useSyncExternalStore receives a stable reference between updates.
let current: UserRole = readRole();

function emit() {
  current = readRole();
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  // Sync across tabs.
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) emit();
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
    () => "admin" as UserRole,
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
