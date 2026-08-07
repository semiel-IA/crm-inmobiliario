/** Cifras de un día concreto. `date` en formato ISO corto (`YYYY-MM-DD`). */
export type DailyFinancials = {
  date: string;
  gains: number;
  losses: number;
};

/**
 * Resumen financiero del mes que consume el dashboard. **Este es el contrato estable**: hoy lo
 * llena un generador de datos de ejemplo (`mock-data.ts`) porque las tablas `deals`/`payments`
 * todavía no existen. Cuando lleguen (T2.1), el servicio real debe implementar exactamente este
 * tipo y la UI no cambiará.
 *
 * Todos los montos son pesos colombianos enteros; formatearlos siempre con `formatCOP`.
 */
export type MonthlyFinancials = {
  netGains: number;
  netLosses: number;
  /** Invariante: siempre `netGains - netLosses`. Puede ser negativo. */
  net: number;
  currency: "COP";
  series: DailyFinancials[];
};
