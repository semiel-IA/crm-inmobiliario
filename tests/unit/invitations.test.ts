import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createAdminClient } from "@/server/db/admin";
import type { getDb } from "@/server/db/client";
import type { EmailSender } from "@/server/integrations/email";
import {
  acceptInvitation,
  createInvitation,
  InvitationError,
  revokeInvitation,
} from "@/server/services/auth/invitations";
import {
  chainReject,
  chainResolve,
  createMockAdminClient,
  createMockDb,
  type MockAdminClient,
  type MockDb,
} from "./support/mock-db";

/**
 * Unit tests for the invitation lifecycle (`createInvitation`, `acceptInvitation`,
 * `revokeInvitation`), mocking `db`/`adminClient`/`emailSender` via the injectable `deps` param
 * (no network/DB access). Covers dedupe (Fix 4a), revoke (Fix 4b), and the auth-user compensation
 * on a post-createUser failure during accept (Fix 1).
 */

function dbAndAdmin(db: MockDb, admin: MockAdminClient) {
  return {
    db: db as unknown as ReturnType<typeof getDb>,
    adminClient: admin as unknown as ReturnType<typeof createAdminClient>,
  };
}

function fakeEmailSender(): EmailSender {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

describe("createInvitation", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("creates an invitation and returns a URL under the given origin (happy path)", async () => {
    db.select.mockReturnValueOnce(chainResolve([])); // no pending invitation
    const insertInvitation = chainResolve([{ id: "inv-1" }]);
    db.insert.mockReturnValueOnce(insertInvitation).mockReturnValueOnce(chainResolve(undefined));
    const emailSender = fakeEmailSender();

    const result = await createInvitation(
      {
        tenantId: "tenant-1",
        email: "invited@example.com",
        role: "agent",
        invitedBy: "admin-1",
        appOrigin: "https://app.example.com",
      },
      { db: db as unknown as ReturnType<typeof getDb>, emailSender },
    );

    expect(result.invitationId).toBe("inv-1");
    expect(result.invitationUrl.startsWith("https://app.example.com/invitacion/")).toBe(true);
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "invited@example.com" }),
    );
  });

  it("throws a typed invitation_pending error when a pending, non-expired invitation exists", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ id: "existing-inv" }]));

    const error = await createInvitation(
      {
        tenantId: "tenant-1",
        email: "invited@example.com",
        role: "agent",
        invitedBy: "admin-1",
        appOrigin: "https://app.example.com",
      },
      { db: db as unknown as ReturnType<typeof getDb>, emailSender: fakeEmailSender() },
    ).catch((e) => e);

    expect(error).toBeInstanceOf(InvitationError);
    expect((error as InvitationError).code).toBe("invitation_pending");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates a new invitation when the dedupe query finds nothing pending", async () => {
    // Note: this mock only models the query RESULT (no pending row). That the real query filters
    // out expired/accepted rows (`accepted_at IS NULL AND expires_at > now`) is SQL behavior a
    // unit mock cannot observe — it is exercised against the real database by the E2E suite.
    db.select.mockReturnValueOnce(chainResolve([]));
    db.insert
      .mockReturnValueOnce(chainResolve([{ id: "inv-2" }]))
      .mockReturnValueOnce(chainResolve(undefined));

    const result = await createInvitation(
      {
        tenantId: "tenant-1",
        email: "invited@example.com",
        role: "agent",
        invitedBy: "admin-1",
        appOrigin: "https://app.example.com",
      },
      { db: db as unknown as ReturnType<typeof getDb>, emailSender: fakeEmailSender() },
    );

    expect(result.invitationId).toBe("inv-2");
  });
});

describe("acceptInvitation", () => {
  let db: MockDb;
  let admin: MockAdminClient;

  const invitationRow = {
    id: "inv-1",
    tenantId: "tenant-1",
    email: "invited@example.com",
    role: "agent",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    acceptedAt: null as Date | null,
  };

  beforeEach(() => {
    db = createMockDb();
    admin = createMockAdminClient();
  });

  it("accepts a valid invitation: creates the user, the membership, marks it accepted (happy path)", async () => {
    db.select.mockReturnValueOnce(chainResolve([invitationRow]));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const membershipInsert = chainResolve(undefined);
    const invitationUpdate = chainResolve(undefined);
    const auditInsert = chainResolve(undefined);
    db.insert.mockReturnValueOnce(membershipInsert).mockReturnValueOnce(auditInsert);
    db.update.mockReturnValueOnce(invitationUpdate);

    const result = await acceptInvitation(
      { token: "raw-token", fullName: "Nuevo Miembro", password: "supersecret123" },
      dbAndAdmin(db, admin),
    );

    expect(result).toEqual({
      tenantId: "tenant-1",
      userId: "user-1",
      email: "invited@example.com",
      role: "agent",
    });
    expect(membershipInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", userId: "user-1", role: "agent" }),
    );
    expect(invitationUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedAt: expect.any(Date) }),
    );
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("throws expired without ever calling createUser", async () => {
    db.select.mockReturnValueOnce(
      chainResolve([{ ...invitationRow, expiresAt: new Date(Date.now() - 1000) }]),
    );

    const error = await acceptInvitation(
      { token: "raw-token", fullName: "X", password: "supersecret123" },
      dbAndAdmin(db, admin),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(InvitationError);
    expect((error as InvitationError).code).toBe("expired");
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("throws already_accepted when the invitation has an acceptedAt", async () => {
    db.select.mockReturnValueOnce(chainResolve([{ ...invitationRow, acceptedAt: new Date() }]));

    const error = await acceptInvitation(
      { token: "raw-token", fullName: "X", password: "supersecret123" },
      dbAndAdmin(db, admin),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(InvitationError);
    expect((error as InvitationError).code).toBe("already_accepted");
  });

  it("throws invalid_token when no invitation matches the token hash", async () => {
    db.select.mockReturnValueOnce(chainResolve([]));

    const error = await acceptInvitation(
      { token: "unknown-token", fullName: "X", password: "supersecret123" },
      dbAndAdmin(db, admin),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(InvitationError);
    expect((error as InvitationError).code).toBe("invalid_token");
  });

  it("throws email_taken when the auth user already exists, without touching membership/invitation", async () => {
    db.select.mockReturnValueOnce(chainResolve([invitationRow]));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { code: "email_exists", status: 422, message: "already been registered" },
    });

    const error = await acceptInvitation(
      { token: "raw-token", fullName: "X", password: "supersecret123" },
      dbAndAdmin(db, admin),
    ).catch((e) => e);

    expect(error).toBeInstanceOf(InvitationError);
    expect((error as InvitationError).code).toBe("email_taken");
    expect(db.insert).not.toHaveBeenCalled();
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the orphaned auth user and leaves the invitation NOT accepted when the membership insert fails (Fix 1)", async () => {
    db.select.mockReturnValueOnce(chainResolve([invitationRow]));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    db.insert.mockReturnValueOnce(chainReject(new Error("membership insert failed")));

    const error = await acceptInvitation(
      { token: "raw-token", fullName: "X", password: "supersecret123" },
      dbAndAdmin(db, admin),
    ).catch((e) => e);

    expect((error as Error).message).toBe("membership insert failed");
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    // The accepted_at update must never have been reached/run.
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does not leave the invitation marked accepted when the audit log insert fails (accepted_at set last)", async () => {
    db.select.mockReturnValueOnce(chainResolve([invitationRow]));
    admin.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    db.insert
      .mockReturnValueOnce(chainResolve(undefined)) // membership insert succeeds
      .mockReturnValueOnce(chainReject(new Error("audit insert failed"))); // audit log fails

    const error = await acceptInvitation(
      { token: "raw-token", fullName: "X", password: "supersecret123" },
      dbAndAdmin(db, admin),
    ).catch((e) => e);

    expect((error as Error).message).toBe("audit insert failed");
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    // `accepted_at` is set LAST, so the invitation must NOT have been marked accepted — otherwise
    // it would be permanently `already_accepted` with no auth user behind it.
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("revokeInvitation", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("deletes the invitation and appends an audit log entry", async () => {
    // Note: the tenant scoping of the DELETE (`id AND tenant_id`) lives inside the `.where()`
    // clause, which this mock cannot inspect meaningfully. Tenant isolation for invitation
    // deletes is covered by the RLS suite (delete policy) and the E2E revoke flow.
    const deleteChain = chainResolve([
      { id: "inv-1", email: "invited@example.com", role: "agent" },
    ]);
    db.delete.mockReturnValueOnce(deleteChain);
    const auditInsert = chainResolve(undefined);
    db.insert.mockReturnValueOnce(auditInsert);

    await revokeInvitation(
      { invitationId: "inv-1", tenantId: "tenant-1", revokedBy: "admin-1" },
      { db: db as unknown as ReturnType<typeof getDb> },
    );

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(auditInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "admin-1",
        action: "invitation.revoked",
        entityId: "inv-1",
      }),
    );
  });

  it("throws invalid_token when no invitation matches (wrong tenant or already gone)", async () => {
    db.delete.mockReturnValueOnce(chainResolve([]));

    const error = await revokeInvitation(
      { invitationId: "inv-1", tenantId: "tenant-1", revokedBy: "admin-1" },
      { db: db as unknown as ReturnType<typeof getDb> },
    ).catch((e) => e);

    expect(error).toBeInstanceOf(InvitationError);
    expect((error as InvitationError).code).toBe("invalid_token");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
