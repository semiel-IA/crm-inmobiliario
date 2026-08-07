import { describe, expect, it } from "vitest";
import { getMockMonthlyFinancials } from "@/server/services/dashboard/mock-data";

describe("getMockMonthlyFinancials", () => {
  it("devuelve una serie de 30 días", () => {
    expect(getMockMonthlyFinancials(1).series).toHaveLength(30);
  });

  it("mantiene net = netGains - netLosses", () => {
    const data = getMockMonthlyFinancials(7);
    expect(data.net).toBe(data.netGains - data.netLosses);
  });

  it("los totales coinciden con la suma de la serie", () => {
    const data = getMockMonthlyFinancials(3);
    const gains = data.series.reduce((sum, day) => sum + day.gains, 0);
    const losses = data.series.reduce((sum, day) => sum + day.losses, 0);
    expect(data.netGains).toBe(gains);
    expect(data.netLosses).toBe(losses);
  });

  it("es determinista: la misma semilla da el mismo resultado", () => {
    expect(getMockMonthlyFinancials(42)).toEqual(getMockMonthlyFinancials(42));
  });

  it("semillas distintas dan resultados distintos", () => {
    expect(getMockMonthlyFinancials(1).net).not.toBe(getMockMonthlyFinancials(2).net);
  });

  it("usa COP y valores enteros no negativos", () => {
    const data = getMockMonthlyFinancials(5);
    expect(data.currency).toBe("COP");
    for (const day of data.series) {
      expect(Number.isInteger(day.gains)).toBe(true);
      expect(Number.isInteger(day.losses)).toBe(true);
      expect(day.gains).toBeGreaterThanOrEqual(0);
      expect(day.losses).toBeGreaterThanOrEqual(0);
    }
  });

  it("fecha en formato YYYY-MM-DD y días en orden ascendente", () => {
    const dates = getMockMonthlyFinancials(9).series.map((day) => day.date);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect([...dates].sort()).toEqual(dates);
  });
});
