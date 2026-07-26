import { formatCOP } from "@/lib/format";
import {
  OPERATION_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type OperationType,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/validations/properties";

/**
 * Pure presentation helpers for the properties UI (T1.8): es-CO labels, price formatting and the
 * public-listing URL builder. Kept separate from components so the non-trivial logic (price
 * formatting per operation, URL building) is unit-testable without rendering React.
 */

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  lote: "Lote",
  local: "Local",
  oficina: "Oficina",
  bodega: "Bodega",
  finca: "Finca",
};

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  venta: "Venta",
  arriendo: "Arriendo",
  ambas: "Venta y arriendo",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
  arrendada: "Arrendada",
  inactiva: "Inactiva",
};

/**
 * Tailwind classes per status, layered on the existing neutral shadcn palette (no new brand
 * hues introduced) — every state still shows its es-CO label as text, so color is never the only
 * signal (WCAG "don't convey info by color alone").
 */
export const PROPERTY_STATUS_BADGE_CLASS: Record<PropertyStatus, string> = {
  disponible:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  reservada: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  vendida: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  arrendada: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  inactiva: "bg-muted text-muted-foreground",
};

export { OPERATION_TYPES, PROPERTY_STATUSES, PROPERTY_TYPES };

export type PropertyPriceSummary = Pick<
  { operationType: OperationType; salePriceCop: number | null; monthlyRentCop: number | null },
  "operationType" | "salePriceCop" | "monthlyRentCop"
>;

/**
 * Formats the price(s) shown on a property card/row/ficha, honoring the venta/arriendo/ambas
 * business rule (T1.7): `venta` shows only the sale price, `arriendo` only the monthly rent,
 * `ambas` shows both joined by " · ". Returns "—" when the relevant price is missing (defensive —
 * the backend's `createPropertySchema` rule should prevent this, but `updateProperty` allows
 * partial payloads and existing rows may predate the rule).
 */
export function formatPropertyPrice(property: PropertyPriceSummary): string {
  const parts: string[] = [];

  if (property.operationType === "venta" || property.operationType === "ambas") {
    parts.push(
      property.salePriceCop != null ? formatCOP(property.salePriceCop) : "Venta: precio no definido",
    );
  }

  if (property.operationType === "arriendo" || property.operationType === "ambas") {
    parts.push(
      property.monthlyRentCop != null
        ? `${formatCOP(property.monthlyRentCop)}/mes`
        : "Arriendo: canon no definido",
    );
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}

/**
 * Builds the public listing URL for a property (T1.10, not yet built — the share button still
 * needs to construct and copy this link today per the T1.8 brief). `origin` defaults to
 * `window.location.origin` when available (browser), otherwise the path is returned relative.
 */
export function buildPublicPropertyUrl(
  tenantSlug: string,
  internalCode: string,
  origin?: string,
): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/p/${tenantSlug}/${internalCode}`;
}

/** Location summary shown in the list/table — neighborhood and city, joined; "—" if both blank. */
export function formatPropertyLocation(property: {
  neighborhood?: string | null;
  city?: string | null;
}): string {
  const parts = [property.neighborhood, property.city].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : "—";
}
