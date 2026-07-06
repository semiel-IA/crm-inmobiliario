const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/**
 * Formats a numeric amount as Colombian pesos (es-CO), e.g. `formatCOP(1234567)` -> "$ 1.234.567".
 * Colombian pesos have no subunit in everyday use, so fractional values are rounded to the
 * nearest whole peso.
 */
export function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}
