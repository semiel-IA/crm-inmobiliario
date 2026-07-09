import { describe, expect, it } from "vitest";
import { formatCOP, isValidE164 } from "@/lib/format";

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

describe("isValidE164", () => {
  it("accepts a Colombian mobile number", () => {
    expect(isValidE164("+573001234567")).toBe(true);
  });

  it("accepts a Colombian landline (Bogotá, 1-digit indicativo)", () => {
    expect(isValidE164("+5716015000")).toBe(true);
  });

  it("accepts other-country E.164 numbers (not restricted to +57)", () => {
    expect(isValidE164("+14155552671")).toBe(true);
  });

  it("rejects numbers without the leading +", () => {
    expect(isValidE164("573001234567")).toBe(false);
  });

  it("rejects numbers with a leading zero after +", () => {
    expect(isValidE164("+0573001234567")).toBe(false);
  });

  it("rejects numbers with spaces, dashes or parentheses", () => {
    expect(isValidE164("+57 300 123 4567")).toBe(false);
    expect(isValidE164("+57-300-123-4567")).toBe(false);
    expect(isValidE164("(+57)3001234567")).toBe(false);
  });

  it("rejects numbers with non-digit characters", () => {
    expect(isValidE164("+57300123456a")).toBe(false);
  });

  it("rejects too-short numbers", () => {
    expect(isValidE164("+1")).toBe(false);
  });

  it("rejects numbers longer than 15 digits total", () => {
    expect(isValidE164("+1234567890123456")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidE164("")).toBe(false);
  });
});
