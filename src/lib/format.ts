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

/**
 * E.164 format: a leading `+`, followed by 1–15 digits, the first of which is never `0` (ITU-T
 * E.164 §6). Not restricted to Colombian numbers (`+57...`) — contacts/agents may use any
 * country's number — but rejects spaces, dashes, parentheses, and any other formatting.
 */
const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

/**
 * Validates that `phone` is a plain E.164 string, e.g. `+573001234567`. Pure function: no
 * normalization is attempted — callers must pass an already-formatted string (trimmed, no
 * separators).
 */
export function isValidE164(phone: string): boolean {
  return E164_PATTERN.test(phone);
}
