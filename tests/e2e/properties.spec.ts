import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * E2E de la UI de propiedades (T1.8) contra la BD real:
 *   1. Registro de tenant nuevo + contacto propietario sembrado por SQL (la UI de contactos es
 *      T1.3, en construcción en paralelo — no se depende de ella).
 *   2. Crear propiedad vía wizard: la validación de precio faltante según operación (venta sin
 *      precio) muestra error en español; al completar, aparece en el listado con el código
 *      interno autogenerado `${tenantId.slice(0,8)}-0001`.
 *   3. Abrir la ficha → cambiar estado a "Reservada" → persiste tras recargar.
 *   4. Filtrar por tipo: "Casa" no muestra resultados; "Apartamento" sí.
 *
 * Serial: los tests comparten el tenant/usuario del paso 1. Mismo patrón de setup/teardown que
 * `tests/e2e/auth.spec.ts` / `app-shell.spec.ts`.
 */

test.describe.configure({ mode: "serial" });

const RUN_SUFFIX = randomUUID().slice(0, 8);
const TENANT_NAME = `E2E Props Inmobiliaria ${RUN_SUFFIX}`;
const TENANT_SLUG_PREFIX = `e2e-props-inmobiliaria-${RUN_SUFFIX}`;
const ADMIN_EMAIL = `e2e-props-admin+${RUN_SUFFIX}@example.com`;
const PASSWORD = `E2e-Props-${RUN_SUFFIX}!Aa1`;
const OWNER_NAME = `Propietario E2E ${RUN_SUFFIX}`;
const OWNER_PHONE = "+573001112233";

let tenantId: string;
let expectedCode: string;

test.afterAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    console.error("Teardown E2E (props): faltan variables de entorno; limpieza manual necesaria.");
    return;
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const users = await sql`select id, email from auth.users where email = ${ADMIN_EMAIL}`;
    for (const user of users) {
      try {
        await admin.auth.admin.deleteUser(user.id as string);
      } catch (error) {
        console.error(`Teardown E2E (props): no se pudo borrar el usuario ${user.email}:`, error);
      }
    }

    // Cascade limpia contacts, properties, property_media, property_documents, memberships…
    await sql`delete from tenants where slug like ${TENANT_SLUG_PREFIX + "%"}`;
  } catch (error) {
    console.error("Teardown E2E (props): error limpiando datos de prueba:", error);
  } finally {
    await sql.end();
  }
});

test("1. registro de tenant y siembra del contacto propietario", async ({ page }) => {
  await page.goto("/registro");

  await page.getByLabel("Nombre de la inmobiliaria").fill(TENANT_NAME);
  await page.getByLabel("Tu nombre completo").fill("Admin Props E2E");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/app");

  const databaseUrl = process.env.DATABASE_URL;
  expect(databaseUrl, "DATABASE_URL debe estar configurado para este E2E").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  try {
    const [tenant] = await sql`
      select id from tenants where slug like ${TENANT_SLUG_PREFIX + "%"} limit 1
    `;
    expect(tenant?.id).toBeTruthy();
    tenantId = tenant.id as string;
    expectedCode = `${tenantId.slice(0, 8)}-0001`;

    await sql`
      insert into contacts (tenant_id, full_name, phone, contact_types, source)
      values (${tenantId}, ${OWNER_NAME}, ${OWNER_PHONE}, ARRAY['propietario']::text[], 'referido')
    `;
  } finally {
    await sql.end();
  }
});

test("2. crear propiedad vía wizard: validación de precio y código autogenerado", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/propiedades");
  await expect(page.getByRole("heading", { name: "Propiedades" })).toBeVisible();

  await page.getByRole("button", { name: "Nueva propiedad" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Paso 1 de 4")).toBeVisible();

  // Paso 1: tipo (Apartamento) y operación (Venta) vienen por defecto. Seleccionar propietario.
  await page.getByRole("combobox", { name: "Selecciona un propietario…" }).click();
  await page.getByPlaceholder("Buscar por nombre o teléfono…").fill("Propietario E2E");
  await page.getByRole("option", { name: new RegExp(OWNER_NAME) }).click();

  // Validación de la regla venta/arriendo: sin precio de venta, "Siguiente" no avanza y muestra
  // el error en español junto al campo.
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Las propiedades en venta requieren precio de venta.")).toBeVisible();
  await expect(page.getByText("Paso 1 de 4")).toBeVisible();

  await page.getByLabel("Precio de venta (COP)").fill("350000000");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Paso 2 de 4")).toBeVisible();

  // Paso 2: ubicación.
  await page.getByLabel("Barrio").fill("El Poblado");
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Paso 3 de 4")).toBeVisible();

  // Paso 3: características.
  await page.getByLabel("Área (m²)").fill("80");
  await page.getByLabel("Habitaciones").fill("3");
  await page.getByLabel("Baños").fill("2");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Paso 4 de 4")).toBeVisible();

  // Paso 4: confirmar muestra el resumen y crea.
  await expect(page.getByRole("dialog").getByText("El Poblado, Medellín")).toBeVisible();
  await page.getByRole("button", { name: "Crear propiedad" }).click();

  // La propiedad aparece en el listado con el código interno autogenerado.
  const row = page.getByTestId(`property-row-${expectedCode}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText("Apartamento");
  await expect(row).toContainText("El Poblado, Medellín");
  await expect(row).toContainText("Disponible");
});

test("3. ficha: cambiar estado a 'Reservada' persiste", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/propiedades");
  await page
    .getByTestId(`property-row-${expectedCode}`)
    .getByRole("link", { name: "Ver ficha" })
    .click();
  await page.waitForURL("**/app/propiedades/**");

  await expect(page.getByTestId("property-code")).toHaveText(expectedCode);
  await expect(page.getByTestId("property-status-trigger")).toContainText("Disponible");

  await page.getByTestId("property-status-trigger").click();
  await page.getByRole("option", { name: "Reservada" }).click();

  await expect(page.getByTestId("property-status-trigger")).toContainText("Reservada");

  // Persiste tras recargar la página.
  await page.reload();
  await expect(page.getByTestId("property-status-trigger")).toContainText("Reservada");
});

test("4. listado: filtrar por tipo", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/propiedades");
  await expect(page.getByTestId(`property-row-${expectedCode}`)).toBeVisible();

  // Filtrar por un tipo sin propiedades → estado vacío.
  await page.locator("#filter-tipo").click();
  await page.getByRole("option", { name: "Casa" }).click();
  await expect(page.getByText("No hay propiedades que coincidan.")).toBeVisible();

  // Filtrar por el tipo correcto → la propiedad vuelve a aparecer.
  await page.locator("#filter-tipo").click();
  await page.getByRole("option", { name: "Apartamento" }).click();
  await expect(page.getByTestId(`property-row-${expectedCode}`)).toBeVisible();
});
