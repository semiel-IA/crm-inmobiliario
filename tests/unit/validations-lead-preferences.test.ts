import { describe, expect, it } from "vitest";
import {
  createLeadPreferenceSchema,
  updateLeadPreferenceSchema,
} from "@/lib/validations/lead-preferences";

/** Unit tests for the lead-preferences Zod schemas (T1.4). */

const validInput = {
  operationType: "venta",
  propertyTypes: ["apartamento"],
  zones: ["Chapinero"],
};

describe("createLeadPreferenceSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = createLeadPreferenceSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("rejects an unsupported operationType", () => {
    const result = createLeadPreferenceSchema.safeParse({ ...validInput, operationType: "ambas" });

    expect(result.success).toBe(false);
  });

  it("rejects a propertyTypes entry outside the allowed set", () => {
    const result = createLeadPreferenceSchema.safeParse({
      ...validInput,
      propertyTypes: ["mansion"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts an empty propertyTypes / zones array", () => {
    const result = createLeadPreferenceSchema.safeParse({
      operationType: "arriendo",
      propertyTypes: [],
      zones: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects budgetMinCop greater than budgetMaxCop", () => {
    const result = createLeadPreferenceSchema.safeParse({
      ...validInput,
      budgetMinCop: 500_000_000,
      budgetMaxCop: 300_000_000,
    });

    expect(result.success).toBe(false);
  });

  it("rejects budgetMinCop equal to budgetMaxCop (must be strictly less)", () => {
    const result = createLeadPreferenceSchema.safeParse({
      ...validInput,
      budgetMinCop: 300_000_000,
      budgetMaxCop: 300_000_000,
    });

    expect(result.success).toBe(false);
  });

  it("accepts budgetMinCop strictly less than budgetMaxCop", () => {
    const result = createLeadPreferenceSchema.safeParse({
      ...validInput,
      budgetMinCop: 200_000_000,
      budgetMaxCop: 300_000_000,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a negative budgetMinCop", () => {
    const result = createLeadPreferenceSchema.safeParse({ ...validInput, budgetMinCop: -1 });

    expect(result.success).toBe(false);
  });

  it("rejects a negative minBedrooms", () => {
    const result = createLeadPreferenceSchema.safeParse({ ...validInput, minBedrooms: -1 });

    expect(result.success).toBe(false);
  });

  it("rejects a negative minBathrooms", () => {
    const result = createLeadPreferenceSchema.safeParse({ ...validInput, minBathrooms: -1 });

    expect(result.success).toBe(false);
  });

  it("rejects a negative minParkingSpots", () => {
    const result = createLeadPreferenceSchema.safeParse({ ...validInput, minParkingSpots: -1 });

    expect(result.success).toBe(false);
  });

  it("rejects a stratum outside 1-6", () => {
    const result = createLeadPreferenceSchema.safeParse({ ...validInput, minStratum: 0 });

    expect(result.success).toBe(false);
  });

  it("rejects maxStratum below minStratum", () => {
    const result = createLeadPreferenceSchema.safeParse({
      ...validInput,
      minStratum: 4,
      maxStratum: 2,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a full valid payload", () => {
    const result = createLeadPreferenceSchema.safeParse({
      operationType: "arriendo",
      propertyTypes: ["apartamento", "casa"],
      zones: ["Chapinero", "Usaquén"],
      budgetMinCop: 1_000_000,
      budgetMaxCop: 3_000_000,
      minBedrooms: 2,
      minBathrooms: 1,
      minParkingSpots: 1,
      minStratum: 3,
      maxStratum: 5,
    });

    expect(result.success).toBe(true);
  });
});

describe("updateLeadPreferenceSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = updateLeadPreferenceSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("still rejects an unsupported operationType when provided", () => {
    const result = updateLeadPreferenceSchema.safeParse({ operationType: "ambas" });

    expect(result.success).toBe(false);
  });

  it("still enforces the budget min < max rule when both are provided", () => {
    const result = updateLeadPreferenceSchema.safeParse({
      budgetMinCop: 500_000,
      budgetMaxCop: 100_000,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a partial update with just zones", () => {
    const result = updateLeadPreferenceSchema.safeParse({ zones: ["Poblado"] });

    expect(result.success).toBe(true);
  });
});
