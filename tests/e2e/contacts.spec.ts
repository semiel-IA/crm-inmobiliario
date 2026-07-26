import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * E2E de la UI de contactos (T1.3) contra la BD real:
 *   1. Registro de tenant → /app/contactos muestra el estado vacío.
 *   2. Validación in-situ: teléfono inválido muestra el mensaje del schema Zod.
 *   3. Crear contacto → aparece en el listado con tipos/estado.
 *   4. La búsqueda filtra (un segundo contacto aparece/desaparece según el término).
 *   5. Abrir ficha → editar nombre → persiste en ficha y listado.
 *
 * Serial: los tests comparten el tenant/usuario creados en el paso 1. Mismo patrón de
 * setup/teardown que `tests/e2e/app-shell.spec.ts` (los contactos se borran en cascada al
 * eliminar el tenant).
 */

test.describe.configure({ mode: "serial" });

const RUN_SUFFIX = randomUUID().slice(0, 8);
const TENANT_NAME = `E2E Contactos Inmobiliaria ${RUN_SUFFIX}`;
const TENANT_SLUG_PREFIX = `e2e-contactos-inmobiliaria-${RUN_SUFFIX}`;
const ADMIN_EMAIL = `e2e-contactos-admin+${RUN_SUFFIX}@example.com`;
const PASSWORD = `E2e-Contactos-${RUN_SUFFIX}!Aa1`;

const CONTACT_NAME = `María Pérez E2E ${RUN_SUFFIX}`;
const CONTACT_PHONE = "+573001234567";
const SECOND_CONTACT_NAME = `Carlos Gómez E2E ${RUN_SUFFIX}`;
const SECOND_CONTACT_PHONE = "+573109876543";
const EDITED_CONTACT_NAME = `María Pérez Editada ${RUN_SUFFIX}`;

test.afterAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    console.error(
      "Teardown E2E (contactos): faltan variables de entorno; limpieza manual necesaria.",
    );
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
        console.error(
          `Teardown E2E (contactos): no se pudo borrar el usuario ${user.email}:`,
          error,
        );
      }
    }

    await sql`delete from tenants where slug like ${TENANT_SLUG_PREFIX + "%"}`;
  } catch (error) {
    console.error("Teardown E2E (contactos): error limpiando datos de prueba:", error);
  } finally {
    await sql.end();
  }
});

test("1. tras el registro, el listado de contactos muestra el estado vacío", async ({ page }) => {
  await page.goto("/registro");

  await page.getByLabel("Nombre de la inmobiliaria").fill(TENANT_NAME);
  await page.getByLabel("Tu nombre completo").fill("Admin Contactos E2E");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/app");

  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Contactos" })
    .click();
  await page.waitForURL("**/app/contactos");

  await expect(page.getByText("No hay contactos todavía.")).toBeVisible();
});

test("2. el formulario rechaza un teléfono inválido con el mensaje del schema", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/contactos");
  await page.getByRole("button", { name: "Nuevo contacto" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Nombre completo").fill(CONTACT_NAME);
  await dialog.getByLabel("Teléfono").fill("300 123 45 67");
  await dialog.getByRole("checkbox", { name: "Comprador" }).click();
  await dialog.getByRole("button", { name: "Crear contacto" }).click();

  await expect(
    dialog.getByText("Ingresa un teléfono en formato E.164, ej. +573001234567."),
  ).toBeVisible();

  // El contacto NO debe haberse creado.
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("No hay contactos todavía.")).toBeVisible();
});

test("3. crear contacto → aparece en el listado", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/contactos");
  await page.getByRole("button", { name: "Nuevo contacto" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre completo").fill(CONTACT_NAME);
  await dialog.getByLabel("Teléfono").fill(CONTACT_PHONE);
  await dialog.getByRole("checkbox", { name: "Comprador" }).click();
  await dialog.getByRole("button", { name: "Crear contacto" }).click();

  await expect(dialog).toBeHidden();

  const row = page.getByRole("row", { name: new RegExp(CONTACT_NAME) });
  await expect(row).toBeVisible();
  await expect(row.getByText(CONTACT_PHONE)).toBeVisible();
  await expect(row.getByText("Comprador")).toBeVisible();
  await expect(row.getByText("Nuevo")).toBeVisible();
});

test("4. la búsqueda filtra por nombre", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/contactos");

  // Crea un segundo contacto para que el filtro tenga algo que excluir.
  await page.getByRole("button", { name: "Nuevo contacto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre completo").fill(SECOND_CONTACT_NAME);
  await dialog.getByLabel("Teléfono").fill(SECOND_CONTACT_PHONE);
  await dialog.getByRole("checkbox", { name: "Propietario" }).click();
  await dialog.getByRole("button", { name: "Crear contacto" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("row", { name: new RegExp(SECOND_CONTACT_NAME) })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(CONTACT_NAME) })).toBeVisible();

  // Busca por el nombre del primer contacto: el segundo debe desaparecer.
  await page
    .getByRole("searchbox", { name: "Buscar contactos por nombre o teléfono" })
    .fill("María Pérez");

  await expect(page.getByRole("row", { name: new RegExp(SECOND_CONTACT_NAME) })).toBeHidden();
  await expect(page.getByRole("row", { name: new RegExp(CONTACT_NAME) })).toBeVisible();
});

test("5. abrir ficha → editar nombre → persiste", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/contactos");
  await page
    .getByRole("row", { name: new RegExp(CONTACT_NAME) })
    .getByRole("link", { name: "Ver" })
    .click();
  await page.waitForURL("**/app/contactos/**");

  // Ficha cargada: datos básicos + consentimiento sin registrar.
  await expect(page.getByRole("heading", { name: CONTACT_NAME })).toBeVisible();
  await expect(page.getByText(CONTACT_PHONE)).toBeVisible();
  await expect(page.getByText("Sin registrar.")).toBeVisible();

  await page.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const nameInput = dialog.getByLabel("Nombre completo");
  await expect(nameInput).toHaveValue(CONTACT_NAME);
  await nameInput.fill(EDITED_CONTACT_NAME);
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toBeHidden();

  // Persiste en la ficha sin recargar…
  await expect(page.getByRole("heading", { name: EDITED_CONTACT_NAME })).toBeVisible();

  // …y tras recargar y volver al listado.
  await page.reload();
  await expect(page.getByRole("heading", { name: EDITED_CONTACT_NAME })).toBeVisible();

  await page.goto("/app/contactos");
  await expect(page.getByRole("row", { name: new RegExp(EDITED_CONTACT_NAME) })).toBeVisible();
});
