import { beforeEach, describe, expect, it } from "vitest";
import type { createAdminClient } from "@/server/db/admin";
import type { getDb } from "@/server/db/client";
import { registerTenant, RegisterTenantError } from "@/server/services/auth/register-tenant";
import {
  chainReject,
  chainResolve,
  createMockAdminClient,
  createMockDb,
  type MockAdminClient,
  type MockDb,
} from "./support/mock-db";

/**
 * Unit tests for `registerTenant`, mocking `db`/`adminClient` via the injectable `deps` param
 * (no network/DB access). Covers the happy path, the typed `email_taken` error, the slug
 * collision retry, and the auth-user + tenant compensation on a post-createUser failure (Fix 1).
 */

const baseInput = {
  tenantName: "Inmobiliaria Central",
  fullName: "Ana Pérez",
  email: "ana@example.com",
  password: "supersecret123",
};

function deps(db: MockDb, adminClient: MockAdminClient) {
  return {
    db: db as unknown as ReturnType<typeof getDb>,
    adminClient: adminClient as unknown as ReturnType<typeof createAdminClient>,
  };
}

describe("registerTenant", () => {
  let db: MockDb;
  let admin: MockAdminClient;

  beforeEach(() => {
    db = createMockDb();
    admin = createMockAdminClient();
  });

  it("registers the tenant, the auth user, the membership and the audit entry (happy path)", async () => {
    db.select.mockReturnValueOnce(chainResolve([])); // slug available on first try
    const tenantInsert = chainResolve([{ id: "tenant-1" }]);
    const membershipInsert = chainResolve(undefined);
    const auditInsert = chainResolve(undefined);
    db.insert
      .mockReturnValueOnce(tenantInsert)
      .mockReturnValueOnce(membershipInsert)
      .mockReturnValueOnce(auditInsert);

    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const result = await registerTenant(baseInput, deps(db, admin));

    expect(result).toEqual({
      tenantId: "tenant-1",
      userId: "user-1",
      slug: "inmobiliaria-central",
    });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: baseInput.email,
        app_metadata: { tenant_id: "tenant-1", role: "admin" },
      }),
    );
    expect(membershipInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", userId: "user-1", role: "admin" }),
    );
    expect(auditInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", action: "tenant.registered" }),
    );
    expect(db.delete).not.toHaveBeenCalled();
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("throws a typed email_taken error when the auth user already exists", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));
    db.insert.mockReturnValueOnce(chainResolve([{ id: "tenant-1" }]));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { code: "email_exists", status: 422, message: "already been registered" },
    });

    const error = await registerTenant(baseInput, deps(db, admin)).catch((e) => e);

    expect(error).toBeInstanceOf(RegisterTenantError);
    expect((error as RegisterTenantError).code).toBe("email_taken");
    // No auth user was ever created, so there's nothing to compensate there — only the tenant.
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("retries with a random suffix when the generated slug collides with an existing tenant", async () => {
    db.select
      .mockReturnValueOnce(chainResolve([{ id: "existing-tenant" }])) // collision
      .mockReturnValueOnce(chainResolve([])); // free on retry
    const tenantInsert = chainResolve([{ id: "tenant-1" }]);
    db.insert
      .mockReturnValueOnce(tenantInsert)
      .mockReturnValueOnce(chainResolve(undefined))
      .mockReturnValueOnce(chainResolve(undefined));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });

    await registerTenant(baseInput, deps(db, admin));

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(tenantInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: expect.stringMatching(/^inmobiliaria-central-[0-9a-f]{6}$/),
      }),
    );
  });

  it("deletes the orphaned auth user AND the tenant row when the membership insert fails (Fix 1)", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));
    db.insert
      .mockReturnValueOnce(chainResolve([{ id: "tenant-1" }]))
      .mockReturnValueOnce(chainReject(new Error("membership insert failed")));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const error = await registerTenant(baseInput, deps(db, admin)).catch((e) => e);

    expect((error as Error).message).toBe("membership insert failed");
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("still surfaces the original error when the auth-user compensation delete itself fails", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));
    db.insert
      .mockReturnValueOnce(chainResolve([{ id: "tenant-1" }]))
      .mockReturnValueOnce(chainReject(new Error("membership insert failed")));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    admin.auth.admin.deleteUser.mockRejectedValueOnce(new Error("auth cleanup failed"));

    const error = await registerTenant(baseInput, deps(db, admin)).catch((e) => e);

    expect((error as Error).message).toBe("membership insert failed");
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});
