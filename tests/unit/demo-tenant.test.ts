import { describe, expect, it, vi } from "vitest";
import { DEMO_TENANT_SLUG, ensureDemoTenant } from "@/server/services/auth/demo-tenant";
import { RegisterTenantError } from "@/server/services/auth/register-tenant";

const credentials = { email: "demo@crm.test", password: "demo-crm-2026" };

/**
 * Simula el `db` de Drizzle solo en la cadena que usa ensureDemoTenant:
 * select().from().where().limit(). No necesita más superficie, así que se castea en vez de
 * reconstruir el tipo completo de Drizzle.
 */
function fakeDb(existingRows: { id: string }[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => existingRows,
        }),
      }),
    }),
    delete: () => ({
      where: async () => undefined,
    }),
  } as never;
}

/** Doble del cliente admin: solo `auth.admin.listUsers`, que es lo único que se consulta. */
function fakeAdmin(emails: string[]) {
  return {
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: emails.map((email) => ({ email })) },
          error: null,
        }),
      },
    },
  } as never;
}

describe("ensureDemoTenant", () => {
  it("registra el tenant demo cuando todavía no existe", async () => {
    const register = vi
      .fn()
      .mockResolvedValue({ tenantId: "t1", userId: "u1", slug: DEMO_TENANT_SLUG });

    await ensureDemoTenant(credentials, {
      db: fakeDb([]),
      register,
      adminClient: fakeAdmin([]),
    });

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ email: credentials.email, password: credentials.password }),
    );
  });

  it("no vuelve a registrar cuando el tenant Y el usuario de auth existen", async () => {
    const register = vi.fn();

    await ensureDemoTenant(credentials, {
      db: fakeDb([{ id: "t1" }]),
      register,
      adminClient: fakeAdmin([credentials.email]),
    });

    expect(register).not.toHaveBeenCalled();
  });

  it("repara el tenant huérfano: existe la fila pero no el usuario de auth", async () => {
    // Regresión de la verificación en vivo del 2026-08-07: si `registerTenant` falla después de
    // crear el tenant, su compensación borra el usuario de auth pero la fila del tenant puede
    // sobrevivir. Comprobar solo el tenant dejaba el demo roto para siempre: se salía temprano y
    // el login fallaba porque no había usuario que autenticar.
    const register = vi
      .fn()
      .mockResolvedValue({ tenantId: "t2", userId: "u2", slug: DEMO_TENANT_SLUG });

    await ensureDemoTenant(credentials, {
      db: fakeDb([{ id: "t1" }]),
      register,
      adminClient: fakeAdmin([]),
    });

    expect(register).toHaveBeenCalledTimes(1);
  });

  it("tolera una carrera: si el correo ya fue tomado, no propaga el error", async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new RegisterTenantError("Este correo ya está registrado.", "email_taken"));

    await expect(
      ensureDemoTenant(credentials, { db: fakeDb([]), register, adminClient: fakeAdmin([]) }),
    ).resolves.toBeUndefined();
  });

  it("propaga cualquier otro error de registro", async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new RegisterTenantError("Falló la base de datos.", "unknown"));

    await expect(ensureDemoTenant(credentials, { db: fakeDb([]), register, adminClient: fakeAdmin([]) })).rejects.toThrow(
      "Falló la base de datos.",
    );
  });

  it("el slug buscado coincide con el que genera registerTenant para el nombre demo", async () => {
    const register = vi
      .fn()
      .mockResolvedValue({ tenantId: "t1", userId: "u1", slug: DEMO_TENANT_SLUG });

    await ensureDemoTenant(credentials, { db: fakeDb([]), register, adminClient: fakeAdmin([]) });

    // Si estos dos divergen, la detección de "ya existe" nunca acierta y se intenta registrar
    // en cada clic (el registro fallaría por email duplicado en vez de reusar el tenant).
    const { buildSlug } = await import("@/server/services/auth/helpers");
    expect(buildSlug(register.mock.calls[0][0].tenantName)).toBe(DEMO_TENANT_SLUG);
  });
});
