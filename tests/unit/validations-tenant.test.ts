import { describe, expect, it } from "vitest";
import { renameTenantSchema } from "@/lib/validations/tenant";

describe("renameTenantSchema", () => {
  it("accepts a valid trimmed name", () => {
    const result = renameTenantSchema.safeParse({ name: "  Inmobiliaria Central  " });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Inmobiliaria Central");
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = renameTenantSchema.safeParse({ name: "A" });

    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 120 characters", () => {
    const result = renameTenantSchema.safeParse({ name: "A".repeat(121) });

    expect(result.success).toBe(false);
  });

  it("rejects an empty/whitespace-only name", () => {
    const result = renameTenantSchema.safeParse({ name: "   " });

    expect(result.success).toBe(false);
  });
});
