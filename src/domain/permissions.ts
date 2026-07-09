import type { UserRole } from "./entities";

export type ScopedUser = {
  id?: string | null;
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
  role: UserRole;
  realRole?: UserRole;
  brandId?: string | null;
  dealId?: string | null;
  brokerName?: string | null;
};

type DealLike = {
  id: string;
  brandId?: string | null;
  brand_id?: string | null;
  broker?: string | null;
};

type BrandLike = {
  id: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  broker: "Broker",
  brand: "Brand Level",
  deal: "Deal Level",
};

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: ["/", "/brand", "/deal", "/brands", "/bizdev", "/deals", "/mapiq", "/action-items", "/map", "/space-requirements", "/one-off", "/settings", "/tour-book-generator"],
  broker: ["/", "/deals", "/map", "/settings", "/tour-book-generator"],
  brand: ["/", "/brand", "/deals", "/map", "/space-requirements", "/settings", "/tour-book-generator"],
  deal: ["/", "/deal", "/map", "/settings", "/tour-book-generator"],
};

export function parseUserRole(value: string | null | undefined): UserRole {
  if (value === "admin" || value === "broker" || value === "brand" || value === "deal") return value;
  if (value === "reimagine_broker") return "broker";
  if (value === "franchisor") return "brand";
  if (value === "franchisee") return "deal";
  return "deal";
}

export function roleToHomeRoute(role: UserRole): string {
  if (role === "broker") return "/deals";
  if (role === "brand") return "/brand";
  if (role === "deal") return "/deal";
  return "/";
}

function asUser(userOrRole: ScopedUser | UserRole): ScopedUser {
  return typeof userOrRole === "string" ? { role: userOrRole } : userOrRole;
}

function dealBrandId(deal: DealLike): string | null {
  return deal.brandId ?? deal.brand_id ?? null;
}

function normalizeBrokerToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function brokerMatchesDeal(user: ScopedUser, deal: DealLike): boolean {
  const brokerName = normalizeBrokerToken(user.brokerName ?? user.username ?? user.fullName);
  const dealBroker = normalizeBrokerToken(deal.broker);
  if (!brokerName || !dealBroker) return false;
  return dealBroker
    .split(/[,&/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .includes(brokerName);
}

function isUnscopedAdminPreview(user: ScopedUser): boolean {
  return user.realRole === "admin" && user.role !== "admin";
}

export function canAccessAdminArea(userOrRole: ScopedUser | UserRole): boolean {
  return asUser(userOrRole).role === "admin";
}

export function canAccessBrand(userOrRole: ScopedUser | UserRole | null | undefined, brandId: string | null | undefined): boolean {
  if (!userOrRole || !brandId) return false;
  const user = asUser(userOrRole);
  if (user.role === "admin") return true;
  if (isUnscopedAdminPreview(user) && !user.brandId && !user.dealId) return true;
  if (user.role === "brand") return user.brandId === brandId;
  if (user.role === "broker") return false;
  return user.brandId === brandId;
}

export function canAccessDeal(userOrRole: ScopedUser | UserRole | null | undefined, deal: DealLike | null | undefined): boolean {
  if (!userOrRole || !deal) return false;
  const user = asUser(userOrRole);
  if (user.role === "admin") return true;
  if (isUnscopedAdminPreview(user) && !user.brandId && !user.dealId) return true;
  if (user.role === "broker") return brokerMatchesDeal(user, deal);
  if (user.role === "brand") return Boolean(user.brandId && dealBrandId(deal) === user.brandId);
  return Boolean(user.dealId && deal.id === user.dealId);
}

export function getVisibleDealsForUser<T extends DealLike>(userOrRole: ScopedUser | UserRole | null | undefined, deals: T[]): T[] {
  if (!userOrRole) return [];
  const user = asUser(userOrRole);
  if (user.role === "admin") return deals;
  if (isUnscopedAdminPreview(user) && !user.brandId && !user.dealId) return deals;
  if (user.role === "broker") return deals.filter((deal) => brokerMatchesDeal(user, deal));
  if (user.role === "brand") return deals.filter((deal) => Boolean(user.brandId && dealBrandId(deal) === user.brandId));
  return deals.filter((deal) => Boolean(user.dealId && deal.id === user.dealId));
}

export function getVisibleBrandsForUser<TBrand extends BrandLike, TDeal extends DealLike>(
  userOrRole: ScopedUser | UserRole | null | undefined,
  brands: TBrand[],
  deals: TDeal[],
): TBrand[] {
  if (!userOrRole) return [];
  const user = asUser(userOrRole);
  if (user.role === "admin") return brands;
  if (isUnscopedAdminPreview(user) && !user.brandId && !user.dealId) return brands;

  if (user.role === "brand") {
    return brands.filter((brand) => user.brandId === brand.id);
  }

  if (user.role === "broker") {
    const visibleBrandIds = new Set(deals.map((deal) => dealBrandId(deal)).filter(Boolean));
    return brands.filter((brand) => visibleBrandIds.has(brand.id));
  }

  const assignedDeal = deals.find((deal) => user.dealId === deal.id);
  const assignedBrandId = assignedDeal ? dealBrandId(assignedDeal) : user.brandId;
  return brands.filter((brand) => assignedBrandId === brand.id);
}

export function canSeeRoute(userOrRole: ScopedUser | UserRole, path: string): boolean {
  const user = asUser(userOrRole);
  if (user.role === "admin") return true;

  if (user.role === "brand" && path.startsWith("/brands/") && path.endsWith("/deals")) {
    return true;
  }

  if (user.role === "deal" && path.startsWith("/deals/")) {
    return true;
  }

  return ROLE_ROUTES[user.role].some((route) => path === route || (route !== "/" && path.startsWith(`${route}/`)));
}

export function canViewBrokerFiles(userOrRole: ScopedUser | UserRole): boolean {
  return asUser(userOrRole).role === "admin";
}

export function canViewFinancials(userOrRole: ScopedUser | UserRole): boolean {
  return asUser(userOrRole).role === "admin";
}

export function canEditDeal(userOrRole: ScopedUser | UserRole): boolean {
  return asUser(userOrRole).role === "admin";
}

export function canUseInternalTakeAction(userOrRole: ScopedUser | UserRole): boolean {
  return asUser(userOrRole).role !== "deal";
}
