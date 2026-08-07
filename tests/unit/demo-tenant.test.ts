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
  } as never;
}

describe("ensureDemoTenant", () => {
  it("registra el tenant demo cuando todavía no existe", async () => {
    const register = vi
      .fn()
      .mockResolvedValue({ tenantId: "t1", userId: "u1", slug: DEMO_TENANT_SLUG });

    await ensureDemoTenant(credentials, { db: fakeDb([]), register });

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ email: credentials.email, password: credentials.password }),
    );
  });

  it("no vuelve a registrar si el tenant demo ya existe", async () => {
    const register = vi.fn();

    await ensureDemoTenant(credentials, { db: fakeDb([{ id: "t1" }]), register });

    expect(register).not.toHaveBeenCalled();
  });

  it("tolera una carrera: si el correo ya fue tomado, no propaga el error", async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new RegisterTenantError("Este correo ya está registrado.", "email_taken"));

    await expect(
      ensureDemoTenant(credentials, { db: fakeDb([]), register }),
    ).resolves.toBeUndefined();
  });

  it("propaga cualquier otro error de registro", async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new RegisterTenantError("Falló la base de datos.", "unknown"));

    await expect(ensureDemoTenant(credentials, { db: fakeDb([]), register })).rejects.toThrow(
      "Falló la base de datos.",
    );
  });

  it("el slug buscado coincide con el que genera registerTenant para el nombre demo", async () => {
    const register = vi
      .fn()
      .mockResolvedValue({ tenantId: "t1", userId: "u1", slug: DEMO_TENANT_SLUG });

    await ensureDemoTenant(credentials, { db: fakeDb([]), register });

    // Si estos dos divergen, la detección de "ya existe" nunca acierta y se intenta registrar
    // en cada clic (el registro fallaría por email duplicado en vez de reusar el tenant).
    const { buildSlug } = await import("@/server/services/auth/helpers");
    expect(buildSlug(register.mock.calls[0][0].tenantName)).toBe(DEMO_TENANT_SLUG);
  });
});
