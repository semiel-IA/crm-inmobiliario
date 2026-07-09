import { z } from "zod";

/** Shared Zod schemas for the properties module (T1.7). Error messages are user-facing → es-CO. */

export const PROPERTY_TYPES = [
  "apartamento",
  "casa",
  "lote",
  "local",
  "oficina",
  "bodega",
  "finca",
] as const;

export const OPERATION_TYPES = ["venta", "arriendo", "ambas"] as const;

export const PROPERTY_STATUSES = [
  "disponible",
  "reservada",
  "vendida",
  "arrendada",
  "inactiva",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type OperationType = (typeof OPERATION_TYPES)[number];
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

const nonNegativeInt = (label: string) =>
  z
    .number()
    .int({ error: `${label} debe ser un número entero.` })
    .nonnegative({ error: `${label} no puede ser negativo.` });

const propertyObjectSchema = z.object({
  propertyType: z.enum(PROPERTY_TYPES, { error: "Selecciona un tipo de propiedad válido." }),
  operationType: z.enum(OPERATION_TYPES, { error: "Selecciona un tipo de operación válido." }),
  ownerContactId: z.uuid({ error: "Selecciona un propietario válido." }),
  salePriceCop: nonNegativeInt("El precio de venta").optional(),
  monthlyRentCop: nonNegativeInt("El canon de arriendo").optional(),
  areaM2: nonNegativeInt("El área").optional(),
  bedrooms: nonNegativeInt("El número de habitaciones").optional(),
  bathrooms: nonNegativeInt("El número de baños").optional(),
  parkingSpots: nonNegativeInt("El número de parqueaderos").optional(),
  stratum: z
    .number()
    .int({ error: "El estrato debe ser un número entero." })
    .min(1, { error: "El estrato debe estar entre 1 y 6." })
    .max(6, { error: "El estrato debe estar entre 1 y 6." })
    .optional(),
  privateAddress: z.string().trim().min(1).max(255).optional(),
  neighborhood: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  department: z.string().trim().min(1).max(120).optional(),
  lat: z
    .number()
    .min(-90, { error: "La latitud debe estar entre -90 y 90." })
    .max(90, { error: "La latitud debe estar entre -90 y 90." })
    .optional(),
  lng: z
    .number()
    .min(-180, { error: "La longitud debe estar entre -180 y 180." })
    .max(180, { error: "La longitud debe estar entre -180 y 180." })
    .optional(),
  registrationNumber: z.string().trim().min(1).max(120).optional(),
  exclusivity: z.boolean().optional(),
  exclusivityUntil: z.iso.date({ error: "La fecha de exclusividad no es válida." }).optional(),
  commissionPercentage: z
    .number()
    .min(0, { error: "La comisión debe estar entre 0 y 100." })
    .max(100, { error: "La comisión debe estar entre 0 y 100." })
    .optional(),
  description: z.string().trim().max(4000).optional(),
});

export type OperationPricingIssue = {
  field: "salePriceCop" | "monthlyRentCop";
  message: string;
};

/**
 * Business rule shared by `createPropertySchema` (via `superRefine`) and the `updateProperty`
 * service (which re-checks it after merging a partial update with the existing row, since Zod
 * alone cannot see DB state): `venta` requires `salePriceCop`, `arriendo` requires
 * `monthlyRentCop`, `ambas` requires both. Returns every violated field so the UI can highlight
 * all of them at once, not just the first.
 */
export function getOperationPricingIssues(
  operationType: OperationType,
  salePriceCop: number | null | undefined,
  monthlyRentCop: number | null | undefined,
): OperationPricingIssue[] {
  const issues: OperationPricingIssue[] = [];

  if (
    (operationType === "venta" || operationType === "ambas") &&
    (salePriceCop === null || salePriceCop === undefined)
  ) {
    issues.push({
      field: "salePriceCop",
      message: "Las propiedades en venta requieren precio de venta.",
    });
  }

  if (
    (operationType === "arriendo" || operationType === "ambas") &&
    (monthlyRentCop === null || monthlyRentCop === undefined)
  ) {
    issues.push({
      field: "monthlyRentCop",
      message: "Las propiedades en arriendo requieren canon mensual.",
    });
  }

  return issues;
}

export const createPropertySchema = propertyObjectSchema.superRefine((data, ctx) => {
  const issues = getOperationPricingIssues(
    data.operationType,
    data.salePriceCop,
    data.monthlyRentCop,
  );
  for (const issue of issues) {
    ctx.addIssue({ code: "custom", message: issue.message, path: [issue.field] });
  }
});

export const updatePropertySchema = propertyObjectSchema.partial().extend({
  status: z.enum(PROPERTY_STATUSES, { error: "Selecciona un estado válido." }).optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
