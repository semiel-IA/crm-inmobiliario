import { describe, expect, it } from "vitest";
import {
  buildPublicPropertyUrl,
  formatPropertyLocation,
  formatPropertyPrice,
} from "@/app/(app)/app/propiedades/property-helpers";

// Intl inserts a non-breaking space (U+00A0) between the currency symbol and the amount.
const NBSP = " ";

describe("formatPropertyPrice", () => {
  it("shows only the sale price for 'venta'", () => {
    expect(
      formatPropertyPrice({ operationType: "venta", salePriceCop: 350_000_000, monthlyRentCop: null }),
    ).toBe(`$${NBSP}350.000.000`);
  });

  it("shows only the monthly rent for 'arriendo'", () => {
    expect(
      formatPropertyPrice({ operationType: "arriendo", salePriceCop: null, monthlyRentCop: 2_500_000 }),
    ).toBe(`$${NBSP}2.500.000/mes`);
  });

  it("shows both prices for 'ambas', joined", () => {
    expect(
      formatPropertyPrice({
        operationType: "ambas",
        salePriceCop: 350_000_000,
        monthlyRentCop: 2_500_000,
      }),
    ).toBe(`$${NBSP}350.000.000 · $${NBSP}2.500.000/mes`);
  });

  it("falls back to a placeholder when the expected price is missing", () => {
    expect(
      formatPropertyPrice({ operationType: "venta", salePriceCop: null, monthlyRentCop: null }),
    ).toBe("Venta: precio no definido");
  });
});

describe("formatPropertyLocation", () => {
  it("joins neighborhood and city", () => {
    expect(formatPropertyLocation({ neighborhood: "El Poblado", city: "Medellín" })).toBe(
      "El Poblado, Medellín",
    );
  });

  it("falls back to em dash when both are missing", () => {
    expect(formatPropertyLocation({ neighborhood: null, city: null })).toBe("—");
  });

  it("shows just the city when neighborhood is missing", () => {
    expect(formatPropertyLocation({ neighborhood: null, city: "Cali" })).toBe("Cali");
  });
});

describe("buildPublicPropertyUrl", () => {
  it("builds the public listing URL from tenant slug and internal code", () => {
    expect(buildPublicPropertyUrl("inmobiliaria-la-84", "a1b2c3d4-0007", "https://crm.example.com")).toBe(
      "https://crm.example.com/p/inmobiliaria-la-84/a1b2c3d4-0007",
    );
  });

  it("defaults to an empty origin outside the browser (relative path)", () => {
    expect(buildPublicPropertyUrl("tenant", "code-0001", "")).toBe("/p/tenant/code-0001");
  });
});
