import { z } from "zod";

/** Shared Zod schema for tenant settings (T0.5). Error messages are user-facing → es-CO. */

export const renameTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Ingresa el nombre de la inmobiliaria." })
    .max(120, { error: "El nombre es demasiado largo." }),
});

export type RenameTenantFormValues = z.infer<typeof renameTenantSchema>;
