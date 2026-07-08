import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * E2E del shell de la app (T0.5) contra la BD real:
 *   1. Registro → como admin, el nav muestra todos los módulos (incluidos Equipo/Configuración).
 *   2. El admin renombra la inmobiliaria desde /app/configuracion y el cambio se refleja.
 *   3. Se invita a un agente y acepta la invitación.
 *   4. Como agente, el nav NO muestra Equipo ni Configuración (aunque sí el resto de módulos).
 *
 * Serial: los tests comparten el tenant/usuarios creados en el paso 1. Mismo patrón de
 * setup/teardown que `tests/e2e/auth.spec.ts`.
 */

test.describe.configure({ mode: "serial" });

const RUN_SUFFIX = randomUUID().slice(0, 8);
const TENANT_NAME = `E2E Shell Inmobiliaria ${RUN_SUFFIX}`;
const RENAMED_TENANT_NAME = `E2E Shell Renombrada ${RUN_SUFFIX}`;
const TENANT_SLUG_PREFIX = `e2e-shell-inmobiliaria-${RUN_SUFFIX}`;
const ADMIN_EMAIL = `e2e-shell-admin+${RUN_SUFFIX}@example.com`;
const AGENT_EMAIL = `e2e-shell-agent+${RUN_SUFFIX}@example.com`;
const PASSWORD = `E2e-Shell-${RUN_SUFFIX}!Aa1`;

let invitationUrl: string;

test.afterAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    console.error("Teardown E2E (shell): faltan variables de entorno; limpieza manual necesaria.");
    return;
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const users = await sql`
      select id, email from auth.users where email in (${ADMIN_EMAIL}, ${AGENT_EMAIL})
    `;
    for (const user of users) {
      try {
        await admin.auth.admin.deleteUser(user.id as string);
      } catch (error) {
        console.error(`Teardown E2E (shell): no se pudo borrar el usuario ${user.email}:`, error);
      }
    }

    await sql`delete from tenants where slug like ${TENANT_SLUG_PREFIX + "%"}`;
  } catch (error) {
    console.error("Teardown E2E (shell): error limpiando datos de prueba:", error);
  } finally {
    await sql.end();
  }
});

test("1. como admin, el nav muestra todos los módulos", async ({ page }) => {
  await page.goto("/registro");

  await page.getByLabel("Nombre de la inmobiliaria").fill(TENANT_NAME);
  await page.getByLabel("Tu nombre completo").fill("Admin Shell E2E");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/app");

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const label of [
    "Inicio",
    "Contactos",
    "Propiedades",
    "Negocios",
    "Agenda",
    "Equipo",
    "Configuración",
  ]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  // Placeholder modules render without crashing and show the "Próximamente" notice.
  await nav.getByRole("link", { name: "Contactos" }).click();
  await page.waitForURL("**/app/contactos");
  await expect(page.getByText("Próximamente")).toBeVisible();
});

test("2. el admin renombra la inmobiliaria desde Configuración", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Configuración" })
    .click();
  await page.waitForURL("**/app/configuracion");

  await expect(page.getByTestId("tenant-name")).toHaveText(TENANT_NAME);

  await page.getByLabel("Nombre de la inmobiliaria").fill(RENAMED_TENANT_NAME);
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Nombre actualizado." })).toBeVisible();
  await expect(page.getByTestId("tenant-name")).toHaveText(RENAMED_TENANT_NAME);

  await page.goto("/app");
  await expect(page.getByTestId("tenant-name")).toHaveText(RENAMED_TENANT_NAME);
});

test("3. el admin invita a un agente y el agente acepta la invitación", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Equipo" })
    .click();
  await page.waitForURL("**/app/equipo");

  await page.getByLabel("Correo electrónico").fill(AGENT_EMAIL);
  await page.getByLabel("Rol").selectOption("agent");
  await page.getByRole("button", { name: "Invitar" }).click();

  const linkInput = page.getByTestId("invitation-url");
  await expect(linkInput).toBeVisible();
  invitationUrl = await linkInput.inputValue();

  await page.goto(invitationUrl);
  await page.getByLabel("Tu nombre completo").fill("Agente Shell E2E");
  await page.getByLabel("Crea una contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Unirme al equipo" }).click();

  await page.waitForURL("**/app");
  await expect(page.getByTestId("member-role")).toContainText("Agente");
});

test("4. como agente, el nav no muestra Equipo ni Configuración", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(AGENT_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const label of ["Inicio", "Contactos", "Propiedades", "Negocios", "Agenda"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Equipo" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Configuración" })).toHaveCount(0);
});
