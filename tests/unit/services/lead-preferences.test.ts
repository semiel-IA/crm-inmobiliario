import { beforeEach, describe, expect, it } from "vitest";
import type { getDb } from "@/server/db/client";
import {
  createPreference,
  getPreference,
  LeadPreferenceError,
  listPreferences,
  updatePreference,
} from "@/server/services/lead-preferences";
import { chainResolve, createMockDb, type MockDb } from "../support/mock-db";

/**
 * Unit tests for the lead-preferences service (T1.4), mocking `db` via the injectable `deps`
 * param — same pattern as `tests/unit/services/contacts.test.ts` / `properties.test.ts`.
 */

function withDb(db: MockDb) {
  return { db: db as unknown as ReturnType<typeof getDb> };
}

const basePreference = {
  id: "pref-1",
  tenantId: "tenant-1",
  contactId: "contact-1",
  operationType: "venta",
  propertyTypes: ["apartamento"],
  zones: ["Chapinero"],
  budgetMinCop: 200_000_000,
  budgetMaxCop: 300_000_000,
  minBedrooms: null,
  minBathrooms: null,
  minParkingSpots: null,
  minStratum: null,
  maxStratum: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "admin-1",
};

describe("createPreference", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("rejects invalid data without touching the database", async () => {
    const error = await createPreference(
      {
        contactId: "contact-1",
        tenantId: "tenant-1",
        operationType: "ambas" as never,
        propertyTypes: [],
        zones: [],
      },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(LeadPreferenceError);
    expect((error as LeadPreferenceError).code).toBe("validation");
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects when the contact does not belong to the tenant", async () => {
    db.select.mockReturnValueOnce(chainResolve([])); // no contact found

    const error = await createPreference(
      {
        contactId: "contact-1",
        tenantId: "tenant-1",
        operationType: "venta",
        propertyTypes: ["apartamento"],
        zones: ["Chapinero"],
      },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(LeadPreferenceError);
    expect((error as LeadPreferenceError).code).toBe("contact_not_found");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("inserts a valid preference scoped to tenantId, after verifying the contact", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ id: "contact-1" }]));
    const insertChain = chainResolve([basePreference]);
    db.insert.mockReturnValueOnce(insertChain);

    const result = await createPreference(
      {
        contactId: "contact-1",
        tenantId: "tenant-1",
        actorUserId: "admin-1",
        operationType: "venta",
        propertyTypes: ["apartamento"],
        zones: ["Chapinero"],
        budgetMinCop: 200_000_000,
        budgetMaxCop: 300_000_000,
      },
      withDb(db),
    );

    expect(result).toEqual(basePreference);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        contactId: "contact-1",
        operationType: "venta",
        propertyTypes: ["apartamento"],
        zones: ["Chapinero"],
        createdBy: "admin-1",
      }),
    );
  });
});

describe("updatePreference", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("rejects invalid data without touching the database", async () => {
    const error = await updatePreference(
      { id: "pref-1", tenantId: "tenant-1", budgetMinCop: 500, budgetMaxCop: 100 },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(LeadPreferenceError);
    expect((error as LeadPreferenceError).code).toBe("validation");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates only the provided fields and bumps updatedAt, scoped by id + tenantId", async () => {
    db.select.mockReturnValueOnce(chainResolve([basePreference]));
    const updateChain = chainResolve([{ ...basePreference, zones: ["Poblado"] }]);
    db.update.mockReturnValueOnce(updateChain);

    const result = await updatePreference(
      { id: "pref-1", tenantId: "tenant-1", zones: ["Poblado"] },
      withDb(db),
    );

    expect(result.zones).toEqual(["Poblado"]);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ zones: ["Poblado"], updatedAt: expect.any(Date) }),
    );
    const setPayload = updateChain.set.mock.calls[0][0];
    expect(setPayload).not.toHaveProperty("propertyTypes");
  });

  it("throws a typed not_found error when no row matches id + tenantId", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const error = await updatePreference(
      { id: "missing", tenantId: "tenant-1", zones: ["Poblado"] },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(LeadPreferenceError);
    expect((error as LeadPreferenceError).code).toBe("not_found");
  });
});

const rentPreference = {
  ...basePreference,
  id: "pref-2",
  operationType: "arriendo",
  propertyTypes: ["apartamento"],
  zones: ["Poblado"],
  budgetMinCop: 1_000_000,
  budgetMaxCop: 2_000_000,
};

describe("getPreference", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns the preference row for the exact (contactId, tenantId, operationType) key", async () => {
    db.select.mockReturnValueOnce(chainResolve([basePreference]));

    const result = await getPreference(
      { contactId: "contact-1", tenantId: "tenant-1", operationType: "venta" },
      withDb(db),
    );

    expect(result).toEqual(basePreference);
  });

  it("selects the correct row by operationType when a mixed contact has both venta and arriendo rows", async () => {
    // Simulates the unique-index key filtering server-side: only the arriendo row comes back.
    db.select.mockReturnValueOnce(chainResolve([rentPreference]));

    const result = await getPreference(
      { contactId: "contact-1", tenantId: "tenant-1", operationType: "arriendo" },
      withDb(db),
    );

    expect(result).toEqual(rentPreference);
    expect(result?.operationType).toBe("arriendo");
  });

  it("returns null when nothing matches", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const result = await getPreference(
      { contactId: "missing", tenantId: "tenant-1", operationType: "venta" },
      withDb(db),
    );

    expect(result).toBeNull();
  });
});

describe("listPreferences", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns all rows for a mixed buyer+renter contact (venta AND arriendo), ordered", async () => {
    const itemsChain = chainResolve([basePreference, rentPreference]);
    db.select.mockReturnValueOnce(itemsChain);

    const result = await listPreferences({ contactId: "contact-1", tenantId: "tenant-1" }, withDb(db));

    expect(result).toEqual([basePreference, rentPreference]);
    expect(result.map((r) => r.operationType)).toEqual(["venta", "arriendo"]);
    expect(itemsChain.orderBy).toHaveBeenCalled();
  });

  it("returns an empty array when the contact has no preferences", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const result = await listPreferences({ contactId: "missing", tenantId: "tenant-1" }, withDb(db));

    expect(result).toEqual([]);
  });
});
