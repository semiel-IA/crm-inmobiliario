import { z } from "zod";
import { PROPERTY_TYPES } from "@/lib/validations/properties";

/** Shared Zod schemas for the lead-preferences CRUD (T1.4). Error messages are user-facing →
 * es-CO. `propertyTypes` reuses `PROPERTY_TYPES` from `properties.ts` (same enum tokens the DB
 * check constraint on `lead_preferences.property_types` enforces) instead of duplicating it. */

export const LEAD_PREFERENCE_OPERATION_TYPES = ["venta", "arriendo"] as const;

export type LeadPreferenceOperationType = (typeof LEAD_PREFERENCE_OPERATION_TYPES)[number];

const operationTypeSchema = z.enum(LEAD_PREFERENCE_OPERATION_TYPES, {
  error: "Selecciona un tipo de operación válido (venta o arriendo).",
});

const propertyTypesSchema = z
  .array(z.enum(PROPERTY_TYPES, { error: "Selecciona un tipo de inmueble válido." }))
  .optional();

const zonesSchema = z.array(z.string().trim().min(1).max(120)).optional();

const nonNegativeSmallint = (label: string) =>
  z
    .number()
    .int({ error: `${label} debe ser un número entero.` })
    .nonnegative({ error: `${label} no puede ser negativo.` });

const stratumSchema = z
  .number()
  .int({ error: "El estrato debe ser un número entero." })
  .min(1, { error: "El estrato debe estar entre 1 y 6." })
  .max(6, { error: "El estrato debe estar entre 1 y 6." });

const leadPreferenceObjectSchema = z.object({
  operationType: operationTypeSchema,
  propertyTypes: propertyTypesSchema,
  zones: zonesSchema,
  budgetMinCop: nonNegativeSmallint("El presupuesto mínimo").optional(),
  budgetMaxCop: nonNegativeSmallint("El presupuesto máximo").optional(),
  minBedrooms: nonNegativeSmallint("El número mínimo de habitaciones").optional(),
  minBathrooms: nonNegativeSmallint("El número mínimo de baños").optional(),
  minParkingSpots: nonNegativeSmallint("El número mínimo de parqueaderos").optional(),
  minStratum: stratumSchema.optional(),
  maxStratum: stratumSchema.optional(),
});

export type LeadPreferenceBudgetIssue = {
  field: "budgetMinCop" | "budgetMaxCop" | "minStratum" | "maxStratum";
  message: string;
};

/**
 * Cross-field checks shared by `createLeadPreferenceSchema` (via `.check()`) and the
 * `updatePreference` service (which re-checks after merging a partial update with the existing
 * row, since Zod alone can't see DB state): `budgetMinCop` must be strictly less than
 * `budgetMaxCop` when both are present, and `minStratum` must be <= `maxStratum` when both are
 * present. Mirrors `getOperationPricingIssues` in `src/lib/validations/properties.ts`.
 */
export function getLeadPreferenceRangeIssues(
  budgetMinCop: number | null | undefined,
  budgetMaxCop: number | null | undefined,
  minStratum: number | null | undefined,
  maxStratum: number | null | undefined,
): LeadPreferenceBudgetIssue[] {
  const issues: LeadPreferenceBudgetIssue[] = [];

  if (
    budgetMinCop !== null &&
    budgetMinCop !== undefined &&
    budgetMaxCop !== null &&
    budgetMaxCop !== undefined &&
    budgetMinCop >= budgetMaxCop
  ) {
    issues.push({
      field: "budgetMaxCop",
      message: "El presupuesto máximo debe ser mayor que el presupuesto mínimo.",
    });
  }

  if (
    minStratum !== null &&
    minStratum !== undefined &&
    maxStratum !== null &&
    maxStratum !== undefined &&
    minStratum > maxStratum
  ) {
    issues.push({
      field: "maxStratum",
      message: "El estrato máximo debe ser mayor o igual al estrato mínimo.",
    });
  }

  return issues;
}

export const createLeadPreferenceSchema = leadPreferenceObjectSchema.check((ctx) => {
  const issues = getLeadPreferenceRangeIssues(
    ctx.value.budgetMinCop,
    ctx.value.budgetMaxCop,
    ctx.value.minStratum,
    ctx.value.maxStratum,
  );
  for (const issue of issues) {
    ctx.issues.push({
      code: "custom",
      message: issue.message,
      path: [issue.field],
      input: ctx.value,
    });
  }
});

export const updateLeadPreferenceSchema = leadPreferenceObjectSchema.partial().check((ctx) => {
  const issues = getLeadPreferenceRangeIssues(
    ctx.value.budgetMinCop,
    ctx.value.budgetMaxCop,
    ctx.value.minStratum,
    ctx.value.maxStratum,
  );
  for (const issue of issues) {
    ctx.issues.push({
      code: "custom",
      message: issue.message,
      path: [issue.field],
      input: ctx.value,
    });
  }
});

export type CreateLeadPreferenceData = z.infer<typeof createLeadPreferenceSchema>;
export type UpdateLeadPreferenceData = z.infer<typeof updateLeadPreferenceSchema>;
