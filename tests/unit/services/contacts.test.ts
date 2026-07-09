import { beforeEach, describe, expect, it } from "vitest";
import type { getDb } from "@/server/db/client";
import {
  assignAgent,
  ContactError,
  createContact,
  deactivateContact,
  getContact,
  listContacts,
  updateContact,
} from "@/server/services/contacts";
import { chainResolve, createMockDb, type MockDb } from "../support/mock-db";

/**
 * Unit tests for the contacts service (T1.2), mocking `db` via the injectable `deps` param (no
 * network/DB access). Cross-tenant isolation itself is enforced by RLS and covered by
 * `tests/rls/properties-isolation.test.ts`; here we only assert the service applies the
 * defense-in-depth `tenantId` scoping described in `docs/plan-maestro.md` §2.2 (i.e. that it's
 * always present in the query args), plus validation and business-rule branches a mock can
 * observe deterministically.
 */

function withDb(db: MockDb) {
  return { db: db as unknown as ReturnType<typeof getDb> };
}

const baseContact = {
  id: "contact-1",
  tenantId: "tenant-1",
  fullName: "Juana Pérez",
  phone: "+573001234567",
  email: null,
  documentId: null,
  contactTypes: ["comprador"],
  source: null,
  assignedAgentId: null,
  leadStatus: "nuevo",
  consentAt: null,
  consentChannel: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "admin-1",
};

describe("createContact", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("rejects an invalid E.164 phone without touching the database", async () => {
    const error = await createContact(
      {
        tenantId: "tenant-1",
        fullName: "Juana Pérez",
        phone: "3001234567",
        contactTypes: ["comprador"],
      },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("validation");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects an empty contactTypes array", async () => {
    const error = await createContact(
      { tenantId: "tenant-1", fullName: "Juana Pérez", phone: "+573001234567", contactTypes: [] },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("validation");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const error = await createContact(
      {
        tenantId: "tenant-1",
        fullName: "Juana Pérez",
        phone: "+573001234567",
        contactTypes: ["comprador"],
        email: "not-an-email",
      },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("validation");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects an unsupported contact type", async () => {
    const error = await createContact(
      {
        tenantId: "tenant-1",
        fullName: "Juana Pérez",
        phone: "+573001234567",
        contactTypes: ["inquilino" as never],
      },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("validation");
  });

  it("inserts a valid contact scoped to tenantId, defaulting leadStatus to nuevo", async () => {
    const insertChain = chainResolve([baseContact]);
    db.insert.mockReturnValueOnce(insertChain);

    const result = await createContact(
      {
        tenantId: "tenant-1",
        actorUserId: "admin-1",
        fullName: "  Juana Pérez  ",
        phone: "+573001234567",
        contactTypes: ["comprador"],
      },
      withDb(db),
    );

    expect(result).toEqual(baseContact);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        fullName: "Juana Pérez",
        phone: "+573001234567",
        contactTypes: ["comprador"],
        leadStatus: "nuevo",
        createdBy: "admin-1",
      }),
    );
  });
});

describe("updateContact", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("updates only the provided fields and bumps updatedAt, scoped by id + tenantId", async () => {
    const updateChain = chainResolve([{ ...baseContact, leadStatus: "contactado" }]);
    db.update.mockReturnValueOnce(updateChain);

    const result = await updateContact(
      { id: "contact-1", tenantId: "tenant-1", leadStatus: "contactado" },
      withDb(db),
    );

    expect(result.leadStatus).toBe("contactado");
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ leadStatus: "contactado", updatedAt: expect.any(Date) }),
    );
    // Fields that weren't part of this update must not appear in the SET payload.
    const setPayload = updateChain.set.mock.calls[0][0];
    expect(setPayload).not.toHaveProperty("fullName");
    expect(setPayload).not.toHaveProperty("phone");
  });

  it("rejects an invalid phone on partial update without touching the database", async () => {
    const error = await updateContact(
      { id: "contact-1", tenantId: "tenant-1", phone: "not-a-phone" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("validation");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("throws a typed not_found error when no row matches id + tenantId", async () => {
    db.update.mockReturnValueOnce(chainResolve([]));

    const error = await updateContact(
      { id: "missing", tenantId: "tenant-1", notes: "hola" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("not_found");
  });
});

describe("getContact", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("returns the contact with its nested lead preferences", async () => {
    const preferences = [{ id: "pref-1", contactId: "contact-1", operationType: "venta" }];
    db.select
      .mockReturnValueOnce(chainResolve([baseContact]))
      .mockReturnValueOnce(chainResolve(preferences));

    const result = await getContact({ id: "contact-1", tenantId: "tenant-1" }, withDb(db));

    expect(result).toEqual({ ...baseContact, leadPreferences: preferences });
  });

  it("returns null when no contact matches id + tenantId, without querying preferences", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const result = await getContact({ id: "missing", tenantId: "tenant-1" }, withDb(db));

    expect(result).toBeNull();
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

describe("listContacts", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("defaults to page 1 / pageSize 10, ordered by created_at DESC", async () => {
    const itemsChain = chainResolve([baseContact]);
    db.select
      .mockReturnValueOnce(itemsChain)
      .mockReturnValueOnce(chainResolve([{ total: 1 }]));

    const result = await listContacts({ tenantId: "tenant-1" }, withDb(db));

    expect(result).toEqual({ items: [baseContact], total: 1 });
    expect(itemsChain.limit).toHaveBeenCalledWith(10);
    expect(itemsChain.offset).toHaveBeenCalledWith(0);
    expect(itemsChain.orderBy).toHaveBeenCalled();
  });

  it("computes the offset from page/pageSize", async () => {
    const itemsChain = chainResolve([]);
    db.select
      .mockReturnValueOnce(itemsChain)
      .mockReturnValueOnce(chainResolve([{ total: 0 }]));

    await listContacts({ tenantId: "tenant-1", page: 3, pageSize: 5 }, withDb(db));

    expect(itemsChain.limit).toHaveBeenCalledWith(5);
    expect(itemsChain.offset).toHaveBeenCalledWith(10);
  });

  it("runs two selects (items + total count), both scoped to the same filters", async () => {
    db.select
      .mockReturnValueOnce(chainResolve([baseContact]))
      .mockReturnValueOnce(chainResolve([{ total: 1 }]));

    await listContacts(
      { tenantId: "tenant-1", search: "Juana", contactTypes: ["comprador"] },
      withDb(db),
    );

    expect(db.select).toHaveBeenCalledTimes(2);
  });
});

describe("deactivateContact", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("soft-deletes: sets leadStatus to inactivo via UPDATE, never calls delete()", async () => {
    const updateChain = chainResolve([{ ...baseContact, leadStatus: "inactivo" }]);
    db.update.mockReturnValueOnce(updateChain);

    const result = await deactivateContact({ id: "contact-1", tenantId: "tenant-1" }, withDb(db));

    expect(result.leadStatus).toBe("inactivo");
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ leadStatus: "inactivo" }),
    );
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("throws not_found when no row matches id + tenantId", async () => {
    db.update.mockReturnValueOnce(chainResolve([]));

    const error = await deactivateContact(
      { id: "missing", tenantId: "tenant-1" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("not_found");
  });
});

describe("assignAgent", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("assigns the contact when the agent is an active member of the same tenant", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ id: "membership-1" }]));
    const updateChain = chainResolve([{ ...baseContact, assignedAgentId: "agent-1" }]);
    db.update.mockReturnValueOnce(updateChain);

    const result = await assignAgent(
      { contactId: "contact-1", tenantId: "tenant-1", agentUserId: "agent-1" },
      withDb(db),
    );

    expect(result.assignedAgentId).toBe("agent-1");
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ assignedAgentId: "agent-1" }),
    );
  });

  it("rejects an agent that belongs to another tenant (or is inactive) without updating", async () => {
    db.select.mockReturnValueOnce(chainResolve([])); // no active membership for this tenant

    const error = await assignAgent(
      { contactId: "contact-1", tenantId: "tenant-1", agentUserId: "agent-from-tenant-b" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("invalid_agent");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("throws not_found when the membership is valid but the contact doesn't exist in this tenant", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ id: "membership-1" }]));
    db.update.mockReturnValueOnce(chainResolve([]));

    const error = await assignAgent(
      { contactId: "missing", tenantId: "tenant-1", agentUserId: "agent-1" },
      withDb(db),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ContactError);
    expect((error as ContactError).code).toBe("not_found");
  });
});
