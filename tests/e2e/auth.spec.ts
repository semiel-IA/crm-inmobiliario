import "dotenv/config";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * E2E de auth multi-tenant (T0.4) contra la BD real — el flujo de 5 puntos del brief:
 *   1. Registrar inmobiliaria → aterriza en /app como admin.
 *   2. Invitar a un agente desde /app/equipo → capturar el link copiable.
 *   3. Cerrar sesión → abrir el link → completar datos → aterrizar en /app como agente.
 *   4. El agente NO accede a /app/configuracion ni /app/equipo (redirigido a /app con aviso).
 *   5. Login con contraseña incorrecta muestra error y no crea sesión.
 *
 * Serial: los tests comparten el tenant/usuarios creados en el paso 1. El teardown SIEMPRE borra
 * usuarios (Admin API) y tenant (cascade limpia memberships/invitations/audit) — mismo patrón que
 * `tests/rls/`.
 */

test.describe.configure({ mode: "serial" });

const RUN_SUFFIX = randomUUID().slice(0, 8);
const TENANT_NAME = `E2E Inmobiliaria ${RUN_SUFFIX}`;
const TENANT_SLUG_PREFIX = `e2e-inmobiliaria-${RUN_SUFFIX}`;
const ADMIN_EMAIL = `e2e-admin+${RUN_SUFFIX}@example.com`;
const AGENT_EMAIL = `e2e-agent+${RUN_SUFFIX}@example.com`;
const PASSWORD = `E2e-Test-${RUN_SUFFIX}!Aa1`;

let invitationUrl: string;

test.afterAll(async () => {
  // Teardown SIEMPRE, best-effort e idempotente: cada paso aislado para no dejar huérfanos.
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    console.error("Teardown E2E: faltan variables de entorno; limpieza manual necesaria.");
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
        console.error(`Teardown E2E: no se pudo borrar el usuario ${user.email}:`, error);
      }
    }

    // Cascade limpia memberships, invitations y audit_log.
    await sql`delete from tenants where slug like ${TENANT_SLUG_PREFIX + "%"}`;
  } catch (error) {
    console.error("Teardown E2E: error limpiando datos de prueba:", error);
  } finally {
    await sql.end();
  }
});

test("1. registro self-service: la inmobiliaria queda creada y el admin aterriza en /app", async ({
  page,
}) => {
  await page.goto("/registro");

  await page.getByLabel("Nombre de la inmobiliaria").fill(TENANT_NAME);
  await page.getByLabel("Tu nombre completo").fill("Admin E2E");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await page.waitForURL("**/app");
  await expect(page.getByRole("heading", { name: "Hola, Admin E2E" })).toBeVisible();
  await expect(page.getByTestId("tenant-name")).toHaveText(TENANT_NAME);
  await expect(page.getByTestId("member-role")).toContainText("Administrador");
});

test("2. el admin invita a un agente y obtiene el link copiable", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.getByRole("link", { name: "Equipo" }).click();
  await page.waitForURL("**/app/equipo");

  await page.getByLabel("Correo electrónico").fill(AGENT_EMAIL);
  await page.getByLabel("Rol").selectOption("agent");
  await page.getByRole("button", { name: "Invitar" }).click();

  const linkInput = page.getByTestId("invitation-url");
  await expect(linkInput).toBeVisible();
  invitationUrl = await linkInput.inputValue();
  expect(invitationUrl).toContain("/invitacion/");

  // El botón Copiar deja el link en el portapapeles.
  await page.getByRole("button", { name: "Copiar" }).click();
  await expect(page.getByRole("button", { name: "¡Copiado!" })).toBeVisible();

  // La invitación aparece como pendiente.
  await expect(page.getByTestId("pending-invitations")).toContainText(AGENT_EMAIL);
});

test("2b. el admin puede revocar una invitación pendiente (Fix 4b)", async ({ page }) => {
  const REVOKE_EMAIL = `e2e-revoke+${RUN_SUFFIX}@example.com`;

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/equipo");

  await page.getByLabel("Correo electrónico").fill(REVOKE_EMAIL);
  await page.getByLabel("Rol").selectOption("assistant");
  await page.getByRole("button", { name: "Invitar" }).click();

  const pending = page.getByTestId("pending-invitations");
  await expect(pending).toContainText(REVOKE_EMAIL);

  // Inviting the same email again while it's pending must be rejected (Fix 4a: dedupe).
  await page.getByLabel("Correo electrónico").fill(REVOKE_EMAIL);
  await page.getByLabel("Rol").selectOption("assistant");
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Ya hay una invitación pendiente" }),
  ).toBeVisible();

  const row = pending.locator("li").filter({ hasText: REVOKE_EMAIL });
  await row.getByRole("button", { name: "Revocar" }).click();

  await expect(pending).not.toContainText(REVOKE_EMAIL);
  // The agent invitation from test 2 (used by test 3 next) must be unaffected.
  await expect(pending).toContainText(AGENT_EMAIL);
});

test("3. el invitado abre el link, se registra y aterriza en /app como agente", async ({
  page,
}) => {
  expect(invitationUrl, "el test 2 debe haber capturado el link").toBeTruthy();

  await page.goto(invitationUrl);
  await expect(page.getByText(`Te invitaron a ${TENANT_NAME}`)).toBeVisible();
  await expect(page.getByText("Agente", { exact: false })).toBeVisible();

  await page.getByLabel("Tu nombre completo").fill("Agente E2E");
  await page.getByLabel("Crea una contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Unirme al equipo" }).click();

  await page.waitForURL("**/app");
  await expect(page.getByRole("heading", { name: "Hola, Agente E2E" })).toBeVisible();
  await expect(page.getByTestId("tenant-name")).toHaveText(TENANT_NAME);
  await expect(page.getByTestId("member-role")).toContainText("Agente");
});

test("4. el agente no puede entrar a configuración ni equipo (redirigido a /app)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(AGENT_EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/app");

  await page.goto("/app/configuracion");
  await page.waitForURL((url) => url.pathname === "/app");
  await expect(
    page.getByText("Solo los administradores pueden acceder a esa sección."),
  ).toBeVisible();

  await page.goto("/app/equipo");
  await page.waitForURL((url) => url.pathname === "/app");
  await expect(
    page.getByText("Solo los administradores pueden acceder a esa sección."),
  ).toBeVisible();
});

test("5. login con contraseña incorrecta muestra error y no crea sesión", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill("contrasena-incorrecta-123");
  await page.getByRole("button", { name: "Entrar" }).click();

  // `.filter(...)` evita la colisión con el route announcer de Next (también role="alert").
  await expect(
    page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  // Sin sesión: /app sigue protegida y redirige a /login.
  await page.goto("/app");
  await page.waitForURL("**/login");
});
