import { describe, expect, it } from "vitest";
import { createContactSchema, updateContactSchema } from "@/lib/validations/contacts";

/** Unit tests for the contacts Zod schemas (T1.2). */

const validInput = {
  fullName: "Juana Pérez",
  phone: "+573001234567",
  contactTypes: ["comprador"],
};

describe("createContactSchema", () => {
  it("accepts a minimal valid contact and trims the name", () => {
    const result = createContactSchema.safeParse({ ...validInput, fullName: "  Juana Pérez  " });

    expect(result.success).toBe(true);
    expect(result.data?.fullName).toBe("Juana Pérez");
  });

  it("rejects an invalid E.164 phone", () => {
    const result = createContactSchema.safeParse({ ...validInput, phone: "3001234567" });

    expect(result.success).toBe(false);
  });

  it("rejects an empty contactTypes array", () => {
    const result = createContactSchema.safeParse({ ...validInput, contactTypes: [] });

    expect(result.success).toBe(false);
  });

  it("rejects a contactTypes entry outside the allowed set", () => {
    const result = createContactSchema.safeParse({ ...validInput, contactTypes: ["inquilino"] });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = createContactSchema.safeParse({ ...validInput, email: "not-an-email" });

    expect(result.success).toBe(false);
  });

  it("accepts a missing email and normalizes an empty string to undefined", () => {
    const result = createContactSchema.safeParse({ ...validInput, email: "" });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBeUndefined();
  });

  it("lowercases and trims a valid email", () => {
    const result = createContactSchema.safeParse({ ...validInput, email: "  Juana@Example.com " });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("juana@example.com");
  });

  it("rejects an unsupported source", () => {
    const result = createContactSchema.safeParse({ ...validInput, source: "instagram" });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported leadStatus", () => {
    const result = createContactSchema.safeParse({ ...validInput, leadStatus: "cerrado" });

    expect(result.success).toBe(false);
  });

  it("rejects a fullName shorter than 2 characters", () => {
    const result = createContactSchema.safeParse({ ...validInput, fullName: "J" });

    expect(result.success).toBe(false);
  });

  it("rejects consentAt without consentChannel", () => {
    const result = createContactSchema.safeParse({ ...validInput, consentAt: new Date() });

    expect(result.success).toBe(false);
  });

  it("rejects consentChannel without consentAt", () => {
    const result = createContactSchema.safeParse({ ...validInput, consentChannel: "whatsapp" });

    expect(result.success).toBe(false);
  });

  it("accepts a full consent pair", () => {
    const result = createContactSchema.safeParse({
      ...validInput,
      consentAt: new Date().toISOString(),
      consentChannel: "whatsapp",
    });

    expect(result.success).toBe(true);
  });
});

describe("updateContactSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = updateContactSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("still rejects an empty contactTypes array when provided", () => {
    const result = updateContactSchema.safeParse({ contactTypes: [] });

    expect(result.success).toBe(false);
  });

  it("still rejects an invalid phone when provided", () => {
    const result = updateContactSchema.safeParse({ phone: "not-a-phone" });

    expect(result.success).toBe(false);
  });

  it("still enforces the consent pairing rule", () => {
    const result = updateContactSchema.safeParse({ consentAt: new Date() });

    expect(result.success).toBe(false);
  });

  it("accepts a partial update with just a leadStatus change", () => {
    const result = updateContactSchema.safeParse({ leadStatus: "contactado" });

    expect(result.success).toBe(true);
  });
});
