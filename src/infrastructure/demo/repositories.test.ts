import { describe, expect, it } from "vitest";
import { createDemoRepositories } from "./repositories";

describe("demo repositories", () => {
  it("returns seeded brands and deals for prototype mode", async () => {
    const repositories = createDemoRepositories();
    const [brands, deals, prospects] = await Promise.all([
      repositories.brands.list(),
      repositories.deals.list(),
      repositories.prospects.list(),
    ]);

    expect(brands.length).toBeGreaterThan(0);
    expect(deals.length).toBeGreaterThan(0);
    expect(prospects.length).toBeGreaterThan(0);
  });

  it("creates take action items in memory", async () => {
    const repositories = createDemoRepositories();
    const item = await repositories.takeActions.create({
      dealId: "dl01",
      audience: "internal",
      status: "open",
      title: "Follow up with landlord",
      body: "Confirm latest lease comments.",
      createdBy: "admin",
    });

    expect(item.id).toMatch(/^ta_/);
    expect(item.status).toBe("open");
  });
});
