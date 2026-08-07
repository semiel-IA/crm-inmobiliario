import type { DailyFinancials, MonthlyFinancials } from "./types";

/**
 * ⚠️ DATOS DE EJEMPLO — NO SON CIFRAS REALES DEL NEGOCIO.
 *
 * Este archivo es la ÚNICA fuente de cifras inventadas del dashboard. Existe porque las tablas
 * `deals` y `payments` aún no están construidas (T2.1 y F3 siguen pendientes).
 *
 * Para conectar datos reales: implementar una función con la misma firma que
 * `getMockMonthlyFinancials` que consulte la base filtrando por `tenant_id`, y sustituir la
 * importación en `src/app/(app)/app/dashboard/page.tsx`. La UI no necesita cambios.
 */
export const IS_MOCK_DATA = true;

const DAYS = 30;
const BASE_GAINS = 12_000_000;
const BASE_LOSSES = 4_500_000;

/**
 * PRNG determinista (mulberry32). Se usa en vez de `Math.random()` para que la misma semilla
 * produzca siempre las mismas cifras: así el refresco "en vivo" del dashboard varía de forma
 * predecible en lugar de saltar a valores absurdos en cada tick.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fecha `YYYY-MM-DD` de hace `daysAgo` días, en hora local. */
function isoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Genera el resumen financiero de ejemplo de los últimos 30 días. `seed` controla la variación:
 * el dashboard la incrementa en cada refresco para simular movimiento en vivo.
 */
export function getMockMonthlyFinancials(seed = 1): MonthlyFinancials {
  const random = createRandom(seed);
  const series: DailyFinancials[] = [];

  for (let index = DAYS - 1; index >= 0; index -= 1) {
    series.push({
      date: isoDate(index),
      gains: Math.round((BASE_GAINS * (0.55 + random() * 0.9)) / DAYS),
      losses: Math.round((BASE_LOSSES * (0.4 + random() * 1.2)) / DAYS),
    });
  }

  const netGains = series.reduce((sum, day) => sum + day.gains, 0);
  const netLosses = series.reduce((sum, day) => sum + day.losses, 0);

  return { netGains, netLosses, net: netGains - netLosses, currency: "COP", series };
}
