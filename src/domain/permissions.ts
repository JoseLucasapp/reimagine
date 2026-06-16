import type { UserRole } from "./entities";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  brand: "Brand Level",
  deal: "Deal Level",
};

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: ["/", "/brand", "/deal", "/brands", "/bizdev", "/deals", "/map", "/space-requirements", "/one-off", "/settings", "/tour-book-generator"],
  brand: ["/", "/brand", "/brands", "/deals", "/map", "/space-requirements", "/settings", "/tour-book-generator"],
  deal: ["/", "/deal", "/deals", "/map", "/settings", "/tour-book-generator"],
};

export function parseUserRole(value: string | null | undefined): UserRole {
  if (value === "admin" || value === "brand" || value === "deal") return value;
  if (value === "franchisor") return "brand";
  if (value === "franchisee") return "deal";
  return "admin";
}

export function roleToHomeRoute(role: UserRole): string {
  if (role === "brand") return "/brand";
  if (role === "deal") return "/deal";
  return "/";
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
  return role !== "deal";
}
