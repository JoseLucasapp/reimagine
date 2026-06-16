import { describe, expect, it } from "vitest";
import { canEditDeal, canSeeRoute, canUseInternalTakeAction, canViewFinancials, parseUserRole, roleToHomeRoute } from "./permissions";

describe("role permissions", () => {
  it("defaults invalid roles to admin preview mode", () => {
    expect(parseUserRole(null)).toBe("admin");
    expect(parseUserRole("unknown")).toBe("admin");
  });

  it("keeps legacy role values compatible", () => {
    expect(parseUserRole("franchisor")).toBe("brand");
    expect(parseUserRole("franchisee")).toBe("deal");
  });

  it("allows admins to access every route", () => {
    expect(canSeeRoute("admin", "/space-requirements")).toBe(true);
    expect(canSeeRoute("admin", "/tour-book-generator")).toBe(true);
    expect(roleToHomeRoute("admin")).toBe("/");
  });

  it("limits deal-level users to client-facing flows", () => {
    expect(canSeeRoute("deal", "/deals/dl01")).toBe(true);
    expect(canSeeRoute("deal", "/brands")).toBe(false);
    expect(canViewFinancials("deal")).toBe(false);
    expect(canEditDeal("deal")).toBe(false);
    expect(canUseInternalTakeAction("deal")).toBe(false);
    expect(roleToHomeRoute("deal")).toBe("/deal");
  });

  it("allows brand-level users to see brand portfolio routes without admin-only sections", () => {
    expect(canSeeRoute("brand", "/brand")).toBe(true);
    expect(canSeeRoute("brand", "/brands")).toBe(true);
    expect(canSeeRoute("brand", "/bizdev")).toBe(false);
    expect(roleToHomeRoute("brand")).toBe("/brand");
  });
});
