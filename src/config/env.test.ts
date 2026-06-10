import { describe, expect, it } from "vitest";
import { getRuntimeConfig } from "./env";

describe("runtime config", () => {
  it("exposes a stable configuration shape", () => {
    const config = getRuntimeConfig();
    expect(typeof config.isSupabaseConfigured).toBe("boolean");
    expect(config).toHaveProperty("supabaseUrl");
    expect(config).toHaveProperty("supabaseAnonKey");
  });
});
