import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { tenants } from "@/server/db/schema";
import { RegisterTenantError, registerTenant } from "./register-tenant";

const DEMO_TENANT_NAME = "Inmobiliaria Demo";
const DEMO_USER_FULL_NAME = "Usuario Demo";

/**
 * Slug fijo del tenant de demostración; es la clave por la que se detecta si ya fue creado.
 * DEBE ser exactamente lo que `buildSlug(DEMO_TENANT_NAME)` produce — si divergen, la detección
 * de "ya existe" nunca acierta y se intentaría registrar en cada clic. Hay un test que lo fija.
 */
export const DEMO_TENANT_SLUG = "inmobiliaria-demo";

export type DemoCredentials = { email: string; password: string };

type EnsureDemoTenantDeps = {
  db?: ReturnType<typeof getDb>;
  register?: typeof registerTenant;
};

/**
 * Garantiza que exista el tenant de demostración con su usuario admin, creándolo la primera vez.
 * Reutiliza `registerTenant` a propósito: así el usuario demo recibe `tenant_id`/`role` en
 * `app_metadata` igual que cualquier otro, y las políticas RLS siguen aplicando sin excepción —
 * el tenant demo es simplemente un tenant más, no una ruta que evade el aislamiento.
 *
 * Idempotente: si el tenant ya existe no hace nada. Si dos peticiones corren a la vez y la otra
 * gana la carrera, `registerTenant` falla con `email_taken`, que aquí se trata como éxito.
 */
export async function ensureDemoTenant(
  credentials: DemoCredentials,
  deps: EnsureDemoTenantDeps = {},
): Promise<void> {
  const db = deps.db ?? getDb();
  const register = deps.register ?? registerTenant;

  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, DEMO_TENANT_SLUG))
    .limit(1);

  if (existing) {
    return;
  }

  try {
    await register({
      tenantName: DEMO_TENANT_NAME,
      fullName: DEMO_USER_FULL_NAME,
      email: credentials.email,
      password: credentials.password,
    });
  } catch (error) {
    if (error instanceof RegisterTenantError && error.code === "email_taken") {
      return;
    }
    throw error;
  }
}
