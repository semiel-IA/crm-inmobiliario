import { describe, expect, it } from "vitest";
import { formatCOP } from "@/lib/format";

// Intl inserts a non-breaking space (U+00A0) between the currency symbol and the amount.
const NBSP = "\u00A0";

describe("formatCOP", () => {
  it("formats a whole number of pesos with thousands separators", () => {
    expect(formatCOP(1234567)).toBe(`$${NBSP}1.234.567`);
  });

  it("formats zero", () => {
    expect(formatCOP(0)).toBe(`$${NBSP}0`);
  });

  it("formats a typical subscription price", () => {
    expect(formatCOP(69900)).toBe(`$${NBSP}69.900`);
  });

  it("rounds fractional pesos to the nearest whole peso", () => {
    expect(formatCOP(1500.75)).toBe(`$${NBSP}1.501`);
  });

  it("formats negative amounts", () => {
    expect(formatCOP(-500)).toBe(`-$${NBSP}500`);
  });
});
