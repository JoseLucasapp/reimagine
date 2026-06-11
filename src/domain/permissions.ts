import type { UserRole } from "./entities";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  franchisor: "Brand Level",
  franchisee: "Deal Level",
};

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: ["/", "/brands", "/bizdev", "/deals", "/map", "/space-requirements", "/one-off", "/settings", "/tour-book-generator"],
  franchisor: ["/brands", "/deals", "/settings", "/tour-book-generator"],
  franchisee: ["/deals", "/settings"],
};

export function parseUserRole(value: string | null | undefined): UserRole {
  if (value === "admin" || value === "franchisor" || value === "franchisee") return value;
  return "admin";
}

export function canSeeRoute(role: UserRole, path: string): boolean {
  if (role === "admin") return true;
  return ROLE_ROUTES[role].some((route) => path === route || path.startsWith(`${route}/`));
}

export function canViewBrokerFiles(role: UserRole): boolean {
  return role === "admin";
}

export function canViewFinancials(role: UserRole): boolean {
  return role === "admin";
}

export function canEditDeal(role: UserRole): boolean {
  return role === "admin";
}

export function canUseInternalTakeAction(role: UserRole): boolean {
  return role !== "franchisee";
}
