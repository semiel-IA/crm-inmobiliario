import { z } from "zod";
import { isValidE164 } from "@/lib/format";

/** Shared Zod schemas for the contacts CRUD (T1.2). Error messages are user-facing → es-CO. */

export const CONTACT_TYPES = ["comprador", "arrendatario", "propietario"] as const;
export const CONTACT_SOURCES = [
  "portal",
  "referido",
  "redes",
  "fachada",
  "whatsapp",
  "web",
] as const;
export const LEAD_STATUSES = ["nuevo", "contactado", "calificado", "inactivo"] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ContactSource = (typeof CONTACT_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const contactTypeSchema = z.enum(CONTACT_TYPES, {
  error: "Selecciona un tipo de contacto válido.",
});
const contactSourceSchema = z.enum(CONTACT_SOURCES, { error: "Selecciona un origen válido." });
const leadStatusSchema = z.enum(LEAD_STATUSES, { error: "Selecciona un estado de lead válido." });

/** Treats an empty/whitespace string as "not provided" so callers (forms included) can send `""`
 * for an untouched optional field instead of omitting the key. */
function emptyToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}

const phoneSchema = z
  .string()
  .trim()
  .refine(isValidE164, {
    error: "Ingresa un teléfono en formato E.164, ej. +573001234567.",
  });

const optionalEmailSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Ingresa un correo válido." }))
    .optional(),
);

const optionalTextSchema = (maxLength: number, tooLongMessage: string) =>
  z.preprocess(
    emptyToUndefined,
    z.string().trim().max(maxLength, { error: tooLongMessage }).optional(),
  );

/**
 * Base object shape, without cross-field checks — kept separate so both the "create" (full,
 * `contactTypes` required non-empty) and "update" (`.partial()`) variants can share it. Zod v4
 * forbids `.partial()` on a schema that already carries a `.check()`/refinement, so the
 * consent-pair validation below is layered on top of each variant individually instead.
 */
const contactBaseSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Ingresa el nombre completo." })
    .max(160, { error: "El nombre es demasiado largo." }),
  phone: phoneSchema,
  email: optionalEmailSchema,
  documentId: optionalTextSchema(40, "La cédula/NIT es demasiado larga."),
  contactTypes: z
    .array(contactTypeSchema)
    .min(1, { error: "Selecciona al menos un tipo de contacto." }),
  source: contactSourceSchema.optional(),
  leadStatus: leadStatusSchema.optional(),
  notes: optionalTextSchema(2000, "Las notas son demasiado largas."),
  consentAt: z.coerce.date({ error: "Fecha de consentimiento inválida." }).optional(),
  consentChannel: optionalTextSchema(60, "El canal de consentimiento es demasiado largo."),
});

/** Consent is optional as a whole, but recording only half of it (a date with no channel, or a
 * channel with no date) is never meaningful. Written twice (once per schema, below) rather than
 * factored into a shared helper: the `ctx` parameter type comes from `CheckFn<Output>`, which
 * differs between the full and `.partial()` shapes, and a hand-written annotation for it drifts
 * out of sync with zod's internal `ParsePayload` issue union (tried; TS2345). Inline callbacks let
 * TypeScript infer the correct type for each call site instead. */
export const createContactSchema = contactBaseSchema.check((ctx) => {
  if (Boolean(ctx.value.consentAt) !== Boolean(ctx.value.consentChannel)) {
    ctx.issues.push({
      code: "custom",
      message: "El consentimiento requiere fecha y canal.",
      path: ["consentChannel"],
      input: ctx.value.consentChannel,
    });
  }
});

export const updateContactSchema = contactBaseSchema.partial().check((ctx) => {
  if (Boolean(ctx.value.consentAt) !== Boolean(ctx.value.consentChannel)) {
    ctx.issues.push({
      code: "custom",
      message: "El consentimiento requiere fecha y canal.",
      path: ["consentChannel"],
      input: ctx.value.consentChannel,
    });
  }
});

export type CreateContactData = z.infer<typeof createContactSchema>;
export type UpdateContactData = z.infer<typeof updateContactSchema>;
