import { describe, expect, it } from "vitest";
import { canEditDeal, canSeeRoute, canUseInternalTakeAction, canViewFinancials, parseUserRole } from "./permissions";

describe("role permissions", () => {
  it("defaults invalid roles to admin for prototype compatibility", () => {
    expect(parseUserRole(null)).toBe("admin");
    expect(parseUserRole("unknown")).toBe("admin");
  });

  it("allows admins to access every route", () => {
    expect(canSeeRoute("admin", "/space-requirements")).toBe(true);
    expect(canSeeRoute("admin", "/tour-book-generator")).toBe(true);
  });

  it("limits franchisee users to client-facing flows", () => {
    expect(canSeeRoute("franchisee", "/deals/dl01")).toBe(true);
    expect(canSeeRoute("franchisee", "/brands")).toBe(false);
    expect(canViewFinancials("franchisee")).toBe(false);
    expect(canEditDeal("franchisee")).toBe(false);
    expect(canUseInternalTakeAction("franchisee")).toBe(false);
  });
});
