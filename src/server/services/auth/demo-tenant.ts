import { eq } from "drizzle-orm";
import { createAdminClient } from "@/server/db/admin";
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
  adminClient?: ReturnType<typeof createAdminClient>;
};

/** ¿Existe ya el usuario demo en Supabase Auth? */
async function demoUserExists(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) {
    throw error;
  }
  return data.users.some((user) => user.email === email);
}

/**
 * Garantiza que exista el tenant de demostración con su usuario admin, creándolo la primera vez.
 * Reutiliza `registerTenant` a propósito: así el usuario demo recibe `tenant_id`/`role` en
 * `app_metadata` igual que cualquier otro, y las políticas RLS siguen aplicando sin excepción —
 * el tenant demo es simplemente un tenant más, no una ruta que evade el aislamiento.
 *
 * Idempotente: si el tenant Y su usuario de auth ya existen no hace nada. Si dos peticiones corren
 * a la vez y la otra gana la carrera, `registerTenant` falla con `email_taken`, que aquí se trata
 * como éxito.
 *
 * Se comprueban **las dos** cosas, no solo la fila del tenant: cuando `registerTenant` falla
 * después de haber creado el tenant, su compensación borra el usuario de auth pero la fila del
 * tenant puede sobrevivir. Mirar solo el tenant dejaba el acceso demo roto de forma permanente
 * (salía temprano y luego el login fallaba porque no había usuario que autenticar). En ese caso
 * se vuelve a registrar, reparando el estado a medias.
 */
export async function ensureDemoTenant(
  credentials: DemoCredentials,
  deps: EnsureDemoTenantDeps = {},
): Promise<void> {
  const db = deps.db ?? getDb();
  const register = deps.register ?? registerTenant;
  const admin = deps.adminClient ?? createAdminClient();

  const [existingTenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, DEMO_TENANT_SLUG))
    .limit(1);

  if (existingTenant && (await demoUserExists(admin, credentials.email))) {
    return;
  }

  if (existingTenant) {
    // Tenant huérfano: se borra para que `registerTenant` pueda recrearlo con su usuario y su
    // membership de forma consistente (el slug es único, así que no se puede duplicar).
    await db.delete(tenants).where(eq(tenants.id, existingTenant.id));
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
