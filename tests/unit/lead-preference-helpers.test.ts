import { describe, expect, it } from "vitest";
import {
  formatZonesInput,
  parseZonesInput,
  preferenceToFormDefaults,
} from "@/app/(app)/app/contactos/lead-preference-helpers";
import type { LeadPreference } from "@/server/db/schema";

describe("parseZonesInput", () => {
  it("splits a comma-separated string into trimmed zones", () => {
    expect(parseZonesInput("El Poblado, Laureles,  Envigado")).toEqual([
      "El Poblado",
      "Laureles",
      "Envigado",
    ]);
  });

  it("drops empty entries from stray commas", () => {
    expect(parseZonesInput("El Poblado,, ,Laureles,")).toEqual(["El Poblado", "Laureles"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseZonesInput("")).toEqual([]);
    expect(parseZonesInput("   ")).toEqual([]);
  });
});

describe("formatZonesInput", () => {
  it("joins zones with a comma and space", () => {
    expect(formatZonesInput(["El Poblado", "Laureles"])).toBe("El Poblado, Laureles");
  });

  it("returns an empty string for undefined/empty arrays", () => {
    expect(formatZonesInput(undefined)).toBe("");
    expect(formatZonesInput([])).toBe("");
  });
});

describe("preferenceToFormDefaults", () => {
  it("returns empty defaults for a new (not-yet-created) preference", () => {
    expect(preferenceToFormDefaults("venta", null)).toEqual({
      operationType: "venta",
      propertyTypes: [],
      zones: [],
    });
  });

  it("maps an existing row's fields, converting null to undefined for optional numbers", () => {
    const preference: LeadPreference = {
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: "22222222-2222-2222-2222-222222222222",
      contactId: "33333333-3333-3333-3333-333333333333",
      operationType: "arriendo",
      propertyTypes: ["apartamento", "casa"],
      zones: ["El Poblado"],
      budgetMinCop: 1_000_000,
      budgetMaxCop: null,
      minBedrooms: 2,
      minBathrooms: null,
      minParkingSpots: 1,
      minStratum: 3,
      maxStratum: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      createdBy: null,
    };

    expect(preferenceToFormDefaults("arriendo", preference)).toEqual({
      operationType: "arriendo",
      propertyTypes: ["apartamento", "casa"],
      zones: ["El Poblado"],
      budgetMinCop: 1_000_000,
      budgetMaxCop: undefined,
      minBedrooms: 2,
      minBathrooms: undefined,
      minParkingSpots: 1,
      minStratum: 3,
      maxStratum: undefined,
    });
  });
});
