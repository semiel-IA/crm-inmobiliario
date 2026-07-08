import { z } from "zod";

/** Shared Zod schemas for the auth flows (T0.4). Error messages are user-facing → es-CO. */

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresa un correo válido." }));

const passwordSchema = z
  .string()
  .min(8, { error: "La contraseña debe tener al menos 8 caracteres." });

const fullNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Ingresa tu nombre completo." })
  .max(120, { error: "El nombre es demasiado largo." });

export const registerSchema = z.object({
  tenantName: z
    .string()
    .trim()
    .min(2, { error: "Ingresa el nombre de la inmobiliaria." })
    .max(120, { error: "El nombre es demasiado largo." }),
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Ingresa tu contraseña." }),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "agent", "assistant"], {
    error: "Selecciona un rol válido.",
  }),
});

export const acceptInvitationSchema = z.object({
  fullName: fullNameSchema,
  password: passwordSchema,
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type InviteFormValues = z.infer<typeof inviteSchema>;
export type AcceptInvitationFormValues = z.infer<typeof acceptInvitationSchema>;
