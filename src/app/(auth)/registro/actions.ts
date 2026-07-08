"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validations/auth";
import { registerTenant, RegisterTenantError } from "@/server/services/auth";

export type RegisterState = {
  error?: string;
};

export async function register(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    tenantName: formData.get("tenantName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await registerTenant(parsed.data);
  } catch (error) {
    if (error instanceof RegisterTenantError && error.code === "email_taken") {
      return { error: "Este correo ya está registrado. ¿Quieres iniciar sesión?" };
    }
    console.error("registerTenant falló:", error);
    return { error: "No se pudo completar el registro. Intenta de nuevo." };
  }

  // Auto-login: the user was created confirmed (ADR-006), so password sign-in works right away.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError) {
    // Extremely unlikely (we just created the user); send them to login rather than fail.
    redirect("/login");
  }

  redirect("/app");
}
