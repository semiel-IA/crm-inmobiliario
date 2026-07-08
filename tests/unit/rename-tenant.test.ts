import { beforeEach, describe, expect, it } from "vitest";
import type { getDb } from "@/server/db/client";
import { renameTenant, RenameTenantError } from "@/server/services/tenants/rename-tenant";
import { chainResolve, createMockDb, type MockDb } from "./support/mock-db";

/**
 * Unit tests for `renameTenant`, mocking `db` via the injectable `deps` param (no network/DB
 * access). Covers the happy path (including the audit log payload), the `not_found` error when
 * the tenant row doesn't exist, and the race-condition guard where the tenant disappears between
 * the initial select and the update.
 */

function withDb(db: MockDb) {
  return { db: db as unknown as ReturnType<typeof getDb> };
}

describe("renameTenant", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("renames the tenant and appends an audit log entry with the previous and new name", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ name: "Nombre Viejo" }]));
    const updateChain = chainResolve([{ name: "Nombre Nuevo" }]);
    db.update.mockReturnValueOnce(updateChain);
    const auditInsert = chainResolve(undefined);
    db.insert.mockReturnValueOnce(auditInsert);

    const result = await renameTenant(
      { tenantId: "tenant-1", name: "Nombre Nuevo", actorUserId: "admin-1" },
      withDb(db),
    );

    expect(result).toEqual({ name: "Nombre Nuevo" });
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nombre Nuevo", updatedAt: expect.any(Date) }),
    );
    expect(auditInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "admin-1",
        action: "tenant.renamed",
        entityType: "tenant",
        entityId: "tenant-1",
        payload: { previousName: "Nombre Viejo", name: "Nombre Nuevo" },
      }),
    );
  });

  it("throws a typed not_found error when no tenant matches the id, without touching update/insert", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const error = await renameTenant(
      { tenantId: "missing-tenant", name: "Nombre Nuevo", actorUserId: "admin-1" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(RenameTenantError);
    expect((error as RenameTenantError).code).toBe("not_found");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws not_found when the tenant disappears between the select and the update (race), without logging", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ name: "Nombre Viejo" }]));
    db.update.mockReturnValueOnce(chainResolve([]));

    const error = await renameTenant(
      { tenantId: "tenant-1", name: "Nombre Nuevo", actorUserId: "admin-1" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(RenameTenantError);
    expect((error as RenameTenantError).code).toBe("not_found");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
