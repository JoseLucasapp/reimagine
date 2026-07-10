import { describe, expect, it } from "vitest";
import {
  canAccessAdminArea,
  canAccessBrand,
  canAccessDeal,
  canEditDeal,
  canSeeRoute,
  canUseInternalTakeAction,
  canViewFinancials,
  getVisibleBrandsForUser,
  getVisibleDealsForUser,
  parseUserRole,
  roleToHomeRoute,
  type ScopedUser,
} from "./permissions";

const deals = [
  { id: "deal-1", brandId: "brand-1", broker: "JH" },
  { id: "deal-2", brandId: "brand-2", broker: "JW" },
  { id: "deal-3", brandId: "brand-1", broker: "JH/JW" },
];

const brands = [
  { id: "brand-1" },
  { id: "brand-2" },
];

const adminUser: ScopedUser = { role: "admin", brandId: null, dealId: null };
const brokerUser: ScopedUser = { role: "broker", brokerName: "JH", brandId: null, dealId: null };
const brandUser: ScopedUser = { role: "brand", brandId: "brand-1", dealId: null };
const dealUser: ScopedUser = { role: "deal", brandId: "brand-2", dealId: "deal-2" };

describe("role permissions", () => {
  it("defaults invalid roles to the least privileged role", () => {
    expect(parseUserRole(null)).toBe("deal");
    expect(parseUserRole("unknown")).toBe("deal");
  });

  it("keeps legacy role values compatible", () => {
    expect(parseUserRole("reimagine_broker")).toBe("broker");
    expect(parseUserRole("franchisor")).toBe("brand");
    expect(parseUserRole("franchisee")).toBe("deal");
  });

  it("allows admins to access every route", () => {
    expect(canSeeRoute("admin", "/action-items")).toBe(true);
    expect(canSeeRoute("admin", "/mapiq")).toBe(true);
    expect(canSeeRoute("admin", "/space-requirements")).toBe(true);
    expect(canSeeRoute("admin", "/tour-book-generator")).toBe(true);
    expect(roleToHomeRoute("admin")).toBe("/");
    expect(canAccessAdminArea(adminUser)).toBe(true);
  });

  it("limits deal-level users to client-facing flows", () => {
    expect(canSeeRoute("deal", "/deals/dl01")).toBe(true);
    expect(canSeeRoute("deal", "/deals")).toBe(false);
    expect(canSeeRoute("deal", "/map")).toBe(false);
    expect(canSeeRoute("deal", "/mapiq")).toBe(false);
    expect(canSeeRoute("deal", "/action-items")).toBe(true);
    expect(canSeeRoute("deal", "/brands")).toBe(false);
    expect(canViewFinancials("deal")).toBe(false);
    expect(canEditDeal("deal")).toBe(false);
    expect(canUseInternalTakeAction("deal")).toBe(false);
    expect(roleToHomeRoute("deal")).toBe("/deal");
  });

  it("limits broker users to their assigned broker deals", () => {
    expect(canSeeRoute("broker", "/deals")).toBe(true);
    expect(canSeeRoute("broker", "/map")).toBe(false);
    expect(canSeeRoute("broker", "/mapiq")).toBe(false);
    expect(canSeeRoute("broker", "/action-items")).toBe(false);
    expect(canSeeRoute("broker", "/brands")).toBe(false);
    expect(canSeeRoute("broker", "/bizdev")).toBe(false);
    expect(roleToHomeRoute("broker")).toBe("/deals");
    expect(getVisibleDealsForUser(brokerUser, deals).map((deal) => deal.id)).toEqual(["deal-1", "deal-3"]);
  });

  it("allows brand-level users to see brand portfolio routes without admin-only sections", () => {
    expect(canSeeRoute(brandUser, "/brand")).toBe(true);
    expect(canSeeRoute(brandUser, "/brands")).toBe(false);
    expect(canSeeRoute(brandUser, "/brands/brand-1/deals")).toBe(true);
    expect(canSeeRoute(brandUser, "/brands/brand-2/deals")).toBe(false);
    expect(canSeeRoute(brandUser, "/map")).toBe(false);
    expect(canSeeRoute(brandUser, "/mapiq")).toBe(false);
    expect(canSeeRoute(brandUser, "/action-items")).toBe(true);
    expect(canSeeRoute(brandUser, "/bizdev")).toBe(false);
    expect(roleToHomeRoute("brand")).toBe("/brand");
  });

  it("scopes visible deals by role and profile assignment", () => {
    expect(getVisibleDealsForUser(adminUser, deals).map((deal) => deal.id)).toEqual(["deal-1", "deal-2", "deal-3"]);
    expect(getVisibleDealsForUser(brokerUser, deals).map((deal) => deal.id)).toEqual(["deal-1", "deal-3"]);
    expect(getVisibleDealsForUser(brandUser, deals).map((deal) => deal.id)).toEqual(["deal-1", "deal-3"]);
    expect(getVisibleDealsForUser(dealUser, deals).map((deal) => deal.id)).toEqual(["deal-2"]);
  });

  it("scopes brand visibility from brand and deal assignments", () => {
    expect(getVisibleBrandsForUser(adminUser, brands, deals).map((brand) => brand.id)).toEqual(["brand-1", "brand-2"]);
    expect(getVisibleBrandsForUser(brokerUser, brands, getVisibleDealsForUser(brokerUser, deals)).map((brand) => brand.id)).toEqual(["brand-1"]);
    expect(getVisibleBrandsForUser(brandUser, brands, deals).map((brand) => brand.id)).toEqual(["brand-1"]);
    expect(getVisibleBrandsForUser(dealUser, brands, deals).map((brand) => brand.id)).toEqual(["brand-2"]);
  });

  it("checks direct brand and deal access", () => {
    expect(canAccessBrand(brandUser, "brand-1")).toBe(true);
    expect(canAccessBrand(brandUser, "brand-2")).toBe(false);
    expect(canAccessDeal(brokerUser, deals[0])).toBe(true);
    expect(canAccessDeal(brokerUser, deals[1])).toBe(false);
    expect(canAccessDeal(dealUser, deals[1])).toBe(true);
    expect(canAccessDeal(dealUser, deals[0])).toBe(false);
  });
});
