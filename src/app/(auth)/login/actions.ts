"use server";

import { redirect } from "next/navigation";
import { getEnv, isDemoModeEnabled } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";
import { ensureDemoTenant } from "@/server/services/auth/demo-tenant";

export type LoginState = {
  error?: string;
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/app");
}

/**
 * Acceso de un clic al tenant de demostración. Puerta lateral para poder probar la app sin
 * credenciales: NO sustituye ni modifica el login real. Solo funciona con
 * `NEXT_PUBLIC_DEMO_MODE === "true"`; en cualquier otro caso devuelve error, de modo que el atajo
 * no quede expuesto si la variable no se define al desplegar.
 */
export async function loginDemo(
  // Ambos parámetros los exige la firma de `useActionState`, aunque el acceso demo no lea nada
  // del formulario: las credenciales vienen del entorno, no del usuario.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: LoginState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<LoginState> {
  if (!isDemoModeEnabled(process.env)) {
    return { error: "El modo demo no está habilitado." };
  }

  const env = getEnv();
  if (!env.DEMO_USER_EMAIL || !env.DEMO_USER_PASSWORD) {
    return { error: "Faltan las credenciales del usuario demo." };
  }

  const credentials = { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD };

  try {
    await ensureDemoTenant(credentials);
  } catch (error) {
    console.error("No se pudo preparar el tenant demo:", error);
    return { error: "No se pudo preparar la cuenta de demostración." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: "No se pudo iniciar sesión en la cuenta de demostración." };
  }

  // Fuera del try/catch a propósito: `redirect()` señaliza lanzando una excepción interna de
  // Next.js, así que atraparla aquí rompería la redirección.
  redirect("/app");
}
