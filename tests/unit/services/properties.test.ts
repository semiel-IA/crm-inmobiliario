import { beforeEach, describe, expect, it } from "vitest";
import type { getDb } from "@/server/db/client";
import {
  createProperty,
  deactivateProperty,
  generatePropertyCode,
  getProperty,
  listProperties,
  PropertyServiceError,
  updateProperty,
} from "@/server/services/properties";
import { createPropertySchema, updatePropertySchema } from "@/lib/validations/properties";
import { chainReject, chainResolve, createMockDb, type MockDb } from "../support/mock-db";

/**
 * Unit tests for the properties module (T1.7): the Zod validation rules (venta/arriendo/ambas
 * pricing, stratum, invalid enums) and the service functions, mocking `db` via the injectable
 * `deps` param (no network/DB access) following the pattern in `rename-tenant.test.ts` /
 * `invitations.test.ts`.
 */

function withDb(db: MockDb) {
  return { db: db as unknown as ReturnType<typeof getDb> };
}

const TENANT_ID = "11111111-2222-3333-4444-555555555555";
const OWNER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const basePropertyInput = {
  propertyType: "apartamento" as const,
  operationType: "venta" as const,
  ownerContactId: OWNER_ID,
  salePriceCop: 100_000_000,
};

describe("createPropertySchema — validaciones", () => {
  it("accepts a valid 'venta' payload", () => {
    const result = createPropertySchema.safeParse(basePropertyInput);
    expect(result.success).toBe(true);
  });

  it("rejects 'venta' without salePriceCop", () => {
    const result = createPropertySchema.safeParse({
      propertyType: "apartamento",
      operationType: "venta",
      ownerContactId: OWNER_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("salePriceCop"))).toBe(true);
    }
  });

  it("rejects 'arriendo' without monthlyRentCop", () => {
    const result = createPropertySchema.safeParse({
      propertyType: "apartamento",
      operationType: "arriendo",
      ownerContactId: OWNER_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("monthlyRentCop"))).toBe(true);
    }
  });

  it("rejects 'ambas' missing both prices, with an issue for each", () => {
    const result = createPropertySchema.safeParse({
      propertyType: "lote",
      operationType: "ambas",
      ownerContactId: OWNER_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("salePriceCop");
      expect(paths).toContain("monthlyRentCop");
    }
  });

  it("accepts 'ambas' with both prices set", () => {
    const result = createPropertySchema.safeParse({
      propertyType: "lote",
      operationType: "ambas",
      ownerContactId: OWNER_ID,
      salePriceCop: 500_000_000,
      monthlyRentCop: 3_000_000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects stratum 7 (out of 1–6 range)", () => {
    const result = createPropertySchema.safeParse({ ...basePropertyInput, stratum: 7 });
    expect(result.success).toBe(false);
  });

  it("rejects stratum 0", () => {
    const result = createPropertySchema.safeParse({ ...basePropertyInput, stratum: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid propertyType", () => {
    const result = createPropertySchema.safeParse({ ...basePropertyInput, propertyType: "yate" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid operationType", () => {
    const result = createPropertySchema.safeParse({
      ...basePropertyInput,
      operationType: "permuta",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid ownerContactId", () => {
    const result = createPropertySchema.safeParse({ ...basePropertyInput, ownerContactId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects negative areaM2/bedrooms/bathrooms/parkingSpots", () => {
    expect(createPropertySchema.safeParse({ ...basePropertyInput, areaM2: -1 }).success).toBe(
      false,
    );
    expect(createPropertySchema.safeParse({ ...basePropertyInput, bedrooms: -1 }).success).toBe(
      false,
    );
    expect(createPropertySchema.safeParse({ ...basePropertyInput, bathrooms: -1 }).success).toBe(
      false,
    );
    expect(createPropertySchema.safeParse({ ...basePropertyInput, parkingSpots: -1 }).success).toBe(
      false,
    );
  });
});

describe("updatePropertySchema — validaciones", () => {
  it("accepts a partial payload with only status", () => {
    const result = updatePropertySchema.safeParse({ status: "reservada" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty payload (no-op update)", () => {
    const result = updatePropertySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = updatePropertySchema.safeParse({ status: "regalada" });
    expect(result.success).toBe(false);
  });

  it("does not enforce the venta/arriendo pricing rule on a partial payload (service re-checks after merge)", () => {
    const result = updatePropertySchema.safeParse({ operationType: "venta" });
    expect(result.success).toBe(true);
  });
});

describe("generatePropertyCode", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns '<prefix>-0001' when the tenant has no properties yet", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const code = await generatePropertyCode(TENANT_ID, withDb(db));

    expect(code).toBe(`${TENANT_ID.slice(0, 8)}-0001`);
  });

  it("increments the sequential from the highest existing code", async () => {
    db.select.mockReturnValueOnce(
      chainResolve([{ internalCode: `${TENANT_ID.slice(0, 8)}-0007` }]),
    );

    const code = await generatePropertyCode(TENANT_ID, withDb(db));

    expect(code).toBe(`${TENANT_ID.slice(0, 8)}-0008`);
  });

  it("zero-pads sequentials under 4 digits and grows past them without padding loss", async () => {
    db.select.mockReturnValueOnce(
      chainResolve([{ internalCode: `${TENANT_ID.slice(0, 8)}-9999` }]),
    );

    const code = await generatePropertyCode(TENANT_ID, withDb(db));

    expect(code).toBe(`${TENANT_ID.slice(0, 8)}-10000`);
  });
});

describe("createProperty", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("validates input and rejects before touching the database", async () => {
    const error = await createProperty(
      {
        tenantId: TENANT_ID,
        propertyType: "apartamento",
        operationType: "venta",
        ownerContactId: OWNER_ID,
      },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("validation");
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws owner_not_found when ownerContactId does not belong to the tenant", async () => {
    db.select.mockReturnValueOnce(chainResolve([])); // owner lookup: no match

    const error = await createProperty(
      { tenantId: TENANT_ID, ...basePropertyInput },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("owner_not_found");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates the property with a generated internal code (happy path)", async () => {
    db.select
      .mockReturnValueOnce(chainResolve([{ id: OWNER_ID }])) // owner lookup
      .mockReturnValueOnce(chainResolve([])); // code lookup: no existing properties
    const insertChain = chainResolve([
      { id: "prop-1", internalCode: `${TENANT_ID.slice(0, 8)}-0001`, tenantId: TENANT_ID },
    ]);
    db.insert.mockReturnValueOnce(insertChain);

    const created = await createProperty({ tenantId: TENANT_ID, ...basePropertyInput }, withDb(db));

    expect(created.id).toBe("prop-1");
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        internalCode: `${TENANT_ID.slice(0, 8)}-0001`,
        ownerContactId: OWNER_ID,
        salePriceCop: 100_000_000,
      }),
    );
  });

  it("retries with a new code when the insert hits the unique-code constraint (concurrent create)", async () => {
    db.select
      .mockReturnValueOnce(chainResolve([{ id: OWNER_ID }])) // owner lookup
      .mockReturnValueOnce(chainResolve([])) // code lookup attempt 1 -> 0001
      .mockReturnValueOnce(chainResolve([{ internalCode: `${TENANT_ID.slice(0, 8)}-0001` }])); // code lookup attempt 2 -> 0002 (competitor won 0001 meanwhile)

    const conflictError = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint_name: "properties_tenant_internal_code_unique",
    });
    db.insert
      .mockReturnValueOnce(chainReject(conflictError))
      .mockReturnValueOnce(
        chainResolve([
          { id: "prop-2", internalCode: `${TENANT_ID.slice(0, 8)}-0002`, tenantId: TENANT_ID },
        ]),
      );

    const created = await createProperty({ tenantId: TENANT_ID, ...basePropertyInput }, withDb(db));

    expect(created.id).toBe("prop-2");
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it("converts lat/lng/commissionPercentage to strings before hitting the numeric columns", async () => {
    db.select
      .mockReturnValueOnce(chainResolve([{ id: OWNER_ID }])) // owner lookup
      .mockReturnValueOnce(chainResolve([])); // code lookup
    const insertChain = chainResolve([
      { id: "prop-1", internalCode: `${TENANT_ID.slice(0, 8)}-0001`, tenantId: TENANT_ID },
    ]);
    db.insert.mockReturnValueOnce(insertChain);

    await createProperty(
      {
        tenantId: TENANT_ID,
        ...basePropertyInput,
        lat: 4.711,
        lng: -74.0721,
        commissionPercentage: 3,
      },
      withDb(db),
    );

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ lat: "4.711", lng: "-74.0721", commissionPercentage: "3" }),
    );
  });

  it("gives up after repeated unique-code collisions", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ id: OWNER_ID }])); // owner lookup
    // Every code lookup afterwards returns empty (always suggests 0001) so every insert collides.
    for (let i = 0; i < 5; i += 1) {
      db.select.mockReturnValueOnce(chainResolve([]));
    }

    const conflictError = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint_name: "properties_tenant_internal_code_unique",
    });
    for (let i = 0; i < 5; i += 1) {
      db.insert.mockReturnValueOnce(chainReject(conflictError));
    }

    const error = await createProperty(
      { tenantId: TENANT_ID, ...basePropertyInput },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("code_generation_failed");
  });
});

describe("updateProperty", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("throws not_found when the property does not exist for this tenant", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const error = await updateProperty(
      "prop-1",
      TENANT_ID,
      { status: "reservada" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("not_found");
  });

  it("updates status without requiring the price fields", async () => {
    db.select.mockReturnValueOnce(
      chainResolve([
        {
          id: "prop-1",
          tenantId: TENANT_ID,
          operationType: "venta",
          salePriceCop: 100_000_000,
          monthlyRentCop: null,
        },
      ]),
    );
    const updateChain = chainResolve([{ id: "prop-1", status: "reservada" }]);
    db.update.mockReturnValueOnce(updateChain);

    const updated = await updateProperty("prop-1", TENANT_ID, { status: "reservada" }, withDb(db));

    expect(updated.status).toBe("reservada");
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "reservada", updatedAt: expect.any(Date) }),
    );
  });

  it("rejects switching operationType to 'arriendo' without a monthlyRentCop (merged with existing row)", async () => {
    db.select.mockReturnValueOnce(
      chainResolve([
        {
          id: "prop-1",
          tenantId: TENANT_ID,
          operationType: "venta",
          salePriceCop: 100_000_000,
          monthlyRentCop: null,
        },
      ]),
    );

    const error = await updateProperty(
      "prop-1",
      TENANT_ID,
      { operationType: "arriendo" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("validation");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("throws owner_not_found when the new ownerContactId does not belong to the tenant", async () => {
    const newOwnerId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
    db.select
      .mockReturnValueOnce(
        chainResolve([
          {
            id: "prop-1",
            tenantId: TENANT_ID,
            operationType: "venta",
            salePriceCop: 100_000_000,
            monthlyRentCop: null,
          },
        ]),
      )
      .mockReturnValueOnce(chainResolve([])); // owner lookup: no match

    const error = await updateProperty(
      "prop-1",
      TENANT_ID,
      { ownerContactId: newOwnerId },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("owner_not_found");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates ownerContactId when the new owner belongs to the tenant", async () => {
    const newOwnerId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
    db.select
      .mockReturnValueOnce(
        chainResolve([
          {
            id: "prop-1",
            tenantId: TENANT_ID,
            operationType: "venta",
            salePriceCop: 100_000_000,
            monthlyRentCop: null,
          },
        ]),
      )
      .mockReturnValueOnce(chainResolve([{ id: newOwnerId }])); // owner lookup: match
    const updateChain = chainResolve([{ id: "prop-1", ownerContactId: newOwnerId }]);
    db.update.mockReturnValueOnce(updateChain);

    const updated = await updateProperty(
      "prop-1",
      TENANT_ID,
      { ownerContactId: newOwnerId },
      withDb(db),
    );

    expect(updated.ownerContactId).toBe(newOwnerId);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ ownerContactId: newOwnerId }),
    );
  });

  it("never allows internalCode to be part of the update payload", async () => {
    db.select.mockReturnValueOnce(
      chainResolve([
        {
          id: "prop-1",
          tenantId: TENANT_ID,
          operationType: "venta",
          salePriceCop: 100_000_000,
          monthlyRentCop: null,
        },
      ]),
    );
    const updateChain = chainResolve([{ id: "prop-1", internalCode: "should-not-change" }]);
    db.update.mockReturnValueOnce(updateChain);

    // `internalCode` isn't a field of `updatePropertySchema`, so Zod strips it even if a caller
    // sneaks it into the raw input object.
    await updateProperty("prop-1", TENANT_ID, { internalCode: "hacked-0001" }, withDb(db));

    const setArg = updateChain.set.mock.calls[0][0];
    expect(setArg.internalCode).toBeUndefined();
  });
});

describe("getProperty", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("throws not_found when the property does not exist for this tenant", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const error = await getProperty("prop-1", TENANT_ID, withDb(db)).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("not_found");
  });

  it("returns the property with media and documents", async () => {
    db.select
      .mockReturnValueOnce(chainResolve([{ id: "prop-1", tenantId: TENANT_ID }]))
      .mockReturnValueOnce(chainResolve([{ id: "media-1", sortOrder: 0 }]))
      .mockReturnValueOnce(chainResolve([{ id: "doc-1" }]));

    const result = await getProperty("prop-1", TENANT_ID, withDb(db));

    expect(result.id).toBe("prop-1");
    expect(result.media).toEqual([{ id: "media-1", sortOrder: 0 }]);
    expect(result.documents).toEqual([{ id: "doc-1" }]);
  });
});

describe("listProperties", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns items and total with default pagination", async () => {
    db.select
      .mockReturnValueOnce(chainResolve([{ id: "prop-1" }, { id: "prop-2" }]))
      .mockReturnValueOnce(chainResolve([{ count: 2 }]));

    const result = await listProperties(TENANT_ID, {}, withDb(db));

    expect(result).toEqual({ items: [{ id: "prop-1" }, { id: "prop-2" }], total: 2 });
  });

  it("applies status/type/operation filters and paginates", async () => {
    const itemsChain = chainResolve([{ id: "prop-3" }]);
    const countChain = chainResolve([{ count: 1 }]);
    db.select.mockReturnValueOnce(itemsChain).mockReturnValueOnce(countChain);

    const result = await listProperties(
      TENANT_ID,
      {
        status: "disponible",
        propertyType: "casa",
        operationType: "arriendo",
        page: 2,
        pageSize: 5,
      },
      withDb(db),
    );

    expect(result.items).toEqual([{ id: "prop-3" }]);
    expect(itemsChain.limit).toHaveBeenCalledWith(5);
    expect(itemsChain.offset).toHaveBeenCalledWith(5);
  });
});

describe("deactivateProperty", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("sets status to 'inactiva' (soft delete)", async () => {
    const updateChain = chainResolve([{ id: "prop-1", status: "inactiva" }]);
    db.update.mockReturnValueOnce(updateChain);

    await deactivateProperty("prop-1", TENANT_ID, withDb(db));

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "inactiva", updatedAt: expect.any(Date) }),
    );
  });

  it("throws not_found when nothing matches", async () => {
    db.update.mockReturnValueOnce(chainResolve([]));

    const error = await deactivateProperty("missing", TENANT_ID, withDb(db)).catch((e) => e);

    expect(error).toBeInstanceOf(PropertyServiceError);
    expect((error as PropertyServiceError).code).toBe("not_found");
  });
});
