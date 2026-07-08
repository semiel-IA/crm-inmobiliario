import { and, eq, isNull } from "drizzle-orm";
import { createAdminClient } from "@/server/db/admin";
import { getDb } from "@/server/db/client";
import { invitations, memberships } from "@/server/db/schema";
import type { InvitationRole } from "./invitations";

export type TeamMember = {
  userId: string;
  email: string;
  fullName: string;
  role: InvitationRole;
  status: string;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: InvitationRole;
  expiresAt: Date;
};

export type TeamOverview = {
  members: TeamMember[];
  pendingInvitations: PendingInvitation[];
};

type TeamDeps = {
  db?: ReturnType<typeof getDb>;
  adminClient?: ReturnType<typeof createAdminClient>;
};

/**
 * Lists a tenant's active members (email/full name resolved via the Auth Admin API — `auth.users`
 * is not readable through PostgREST) and its pending (not yet accepted) invitations. Runs with
 * service-role/`postgres` privileges that bypass RLS, so `tenantId` MUST come from verified JWT
 * claims (`requireAdmin`), never from user input.
 */
export async function getTeamOverview(
  { tenantId }: { tenantId: string },
  deps: TeamDeps = {},
): Promise<TeamOverview> {
  const db = deps.db ?? getDb();
  const admin = deps.adminClient ?? createAdminClient();

  const memberRows = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      status: memberships.status,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .where(eq(memberships.tenantId, tenantId))
    .orderBy(memberships.createdAt);

  const members = await Promise.all(
    memberRows.map(async (row): Promise<TeamMember> => {
      const { data } = await admin.auth.admin.getUserById(row.userId);
      return {
        userId: row.userId,
        email: data.user?.email ?? "",
        fullName: (data.user?.user_metadata?.full_name as string | undefined) ?? "",
        role: row.role as InvitationRole,
        status: row.status,
      };
    }),
  );

  const pendingInvitations = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(and(eq(invitations.tenantId, tenantId), isNull(invitations.acceptedAt)))
    .orderBy(invitations.createdAt);

  return {
    members,
    pendingInvitations: pendingInvitations.map((row) => ({
      ...row,
      role: row.role as InvitationRole,
    })),
  };
}
