import { and, eq, gt, isNull } from "drizzle-orm";
import { createAdminClient } from "@/server/db/admin";
import { getDb } from "@/server/db/client";
import { auditLog, invitations, memberships, tenants } from "@/server/db/schema";
import { createDefaultEmailSender, type EmailSender } from "@/server/integrations/email";
import { generateInvitationToken, hashInvitationToken, isInvitationExpired } from "./helpers";

export type InvitationRole = "admin" | "agent" | "assistant";

export type CreateInvitationInput = {
  tenantId: string;
  email: string;
  role: InvitationRole;
  invitedBy: string;
  /** Origin (scheme + host) used to build the invitation URL, e.g. `https://app.example.com`. */
  appOrigin: string;
};

export type CreateInvitationResult = {
  invitationId: string;
  invitationUrl: string;
};

export type AcceptInvitationInput = {
  token: string;
  fullName: string;
  password: string;
};

export type AcceptInvitationResult = {
  tenantId: string;
  userId: string;
  email: string;
  role: InvitationRole;
};

export type InvitationErrorCode =
  | "invalid_token"
  | "expired"
  | "already_accepted"
  | "email_taken"
  | "invitation_pending"
  | "unknown";

/** Typed business error for the invitation flow; `code` drives the UI state shown to the user. */
export class InvitationError extends Error {
  readonly code: InvitationErrorCode;

  constructor(message: string, code: InvitationErrorCode) {
    super(message);
    this.name = "InvitationError";
    this.code = code;
  }
}

type InvitationDeps = {
  db?: ReturnType<typeof getDb>;
  adminClient?: ReturnType<typeof createAdminClient>;
  emailSender?: EmailSender;
};

const INVITATION_DAYS = 7;

/**
 * Creates an invitation for `email` to join `tenantId` as `role`. Stores only the SHA-256 hash of
 * the token; the raw token exists solely inside the returned `invitationUrl` (ADR-005 — the admin
 * copies that link and shares it, typically via WhatsApp). Sending the email is best-effort and
 * decorative for now (console driver): a failure to "send" never fails the invitation.
 *
 * Deduped: if a pending (not accepted, not expired) invitation already exists for this
 * (tenant, email), a typed `invitation_pending` error is thrown instead of creating a second
 * valid token. Expired or already-accepted invitations never block a new invite.
 */
export async function createInvitation(
  input: CreateInvitationInput,
  deps: InvitationDeps = {},
): Promise<CreateInvitationResult> {
  const db = deps.db ?? getDb();
  const emailSender = deps.emailSender ?? createDefaultEmailSender();

  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.tenantId, input.tenantId),
        eq(invitations.email, input.email),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (pending) {
    throw new InvitationError(
      "Ya hay una invitación pendiente para este correo.",
      "invitation_pending",
    );
  }

  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(invitations)
    .values({
      tenantId: input.tenantId,
      email: input.email,
      role: input.role,
      tokenHash: hashInvitationToken(token),
      invitedBy: input.invitedBy,
      expiresAt,
    })
    .returning({ id: invitations.id });

  if (!invitation) {
    throw new InvitationError("No se pudo crear la invitación.", "unknown");
  }

  await db.insert(auditLog).values({
    tenantId: input.tenantId,
    actorUserId: input.invitedBy,
    action: "invitation.created",
    entityType: "invitation",
    entityId: invitation.id,
    payload: { email: input.email, role: input.role },
  });

  const invitationUrl = `${input.appOrigin}/invitacion/${token}`;

  try {
    await emailSender.send({
      to: input.email,
      subject: "Te invitaron a un equipo en CRM Inmobiliario",
      html:
        `<p>Te invitaron a unirte como <strong>${input.role}</strong>.</p>` +
        `<p>Acepta la invitación aquí: <a href="${invitationUrl}">${invitationUrl}</a></p>` +
        `<p>El enlace vence en ${INVITATION_DAYS} días.</p>`,
    });
  } catch (error) {
    // ADR-005: email is a nice-to-have; the copyable link is the real channel.
    console.error("No se pudo enviar el correo de invitación:", error);
  }

  return { invitationId: invitation.id, invitationUrl };
}

export type InvitationPreview = {
  tenantName: string;
  role: InvitationRole;
  email: string;
  status: "valid" | "expired" | "already_accepted";
};

/**
 * Looks up an invitation by its raw token for the public acceptance page (`/invitacion/[token]`).
 * Runs with service_role via `db` (Drizzle connects as the `postgres` role, which bypasses RLS)
 * because the visitor has no session yet. Returns null when the token matches nothing.
 */
export async function getInvitationByToken(
  token: string,
  deps: Pick<InvitationDeps, "db"> = {},
): Promise<InvitationPreview | null> {
  const db = deps.db ?? getDb();

  const [row] = await db
    .select({
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      tenantName: tenants.name,
    })
    .from(invitations)
    .innerJoin(tenants, eq(invitations.tenantId, tenants.id))
    .where(eq(invitations.tokenHash, hashInvitationToken(token)))
    .limit(1);

  if (!row) {
    return null;
  }

  const status = row.acceptedAt
    ? "already_accepted"
    : isInvitationExpired(row.expiresAt)
      ? "expired"
      : "valid";

  return {
    tenantName: row.tenantName,
    role: row.role as InvitationRole,
    email: row.email,
    status,
  };
}

/**
 * Accepts an invitation: validates hash + expiry + not-yet-accepted, creates the Supabase Auth
 * user with the invited tenant/role in `app_metadata` (ADR-003), creates the active membership,
 * appends to the audit log and finally marks the invitation accepted (last, so a partial failure
 * never strands the invitation as `already_accepted`). Server-side only (service_role) —
 * the invitee has no session while this runs. If anything after user creation fails, the auth
 * user is deleted best-effort (compensation) so a failed accept doesn't leave an orphaned,
 * confirmed auth user behind — which would otherwise permanently block every future accept
 * attempt for this invitation with "este correo ya tiene una cuenta".
 */
export async function acceptInvitation(
  input: AcceptInvitationInput,
  deps: InvitationDeps = {},
): Promise<AcceptInvitationResult> {
  const db = deps.db ?? getDb();
  const admin = deps.adminClient ?? createAdminClient();

  const [invitation] = await db
    .select({
      id: invitations.id,
      tenantId: invitations.tenantId,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
    })
    .from(invitations)
    .where(eq(invitations.tokenHash, hashInvitationToken(input.token)))
    .limit(1);

  if (!invitation) {
    throw new InvitationError("La invitación no existe.", "invalid_token");
  }
  if (invitation.acceptedAt) {
    throw new InvitationError("La invitación ya fue usada.", "already_accepted");
  }
  if (isInvitationExpired(invitation.expiresAt)) {
    throw new InvitationError("La invitación venció.", "expired");
  }

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { tenant_id: invitation.tenantId, role: invitation.role },
    user_metadata: { full_name: input.fullName },
  });

  if (userError || !userData.user) {
    if (userError?.code === "email_exists" || userError?.status === 422) {
      throw new InvitationError("Este correo ya está registrado.", "email_taken");
    }
    throw new InvitationError(userError?.message ?? "No se pudo crear el usuario.", "unknown");
  }

  const userId = userData.user.id;

  try {
    await db.insert(memberships).values({
      tenantId: invitation.tenantId,
      userId,
      role: invitation.role,
      status: "active",
    });

    await db.insert(auditLog).values({
      tenantId: invitation.tenantId,
      actorUserId: userId,
      action: "invitation.accepted",
      entityType: "invitation",
      entityId: invitation.id,
      payload: { email: invitation.email, role: invitation.role },
    });

    // Marked accepted LAST: if any earlier step fails, the compensation below deletes the auth
    // user and the invitation is still usable — never left permanently `already_accepted` with no
    // user behind it. Guard `accepted_at is null` so two simultaneous accepts can't both "win".
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(and(eq(invitations.id, invitation.id), isNull(invitations.acceptedAt)));

    return {
      tenantId: invitation.tenantId,
      userId,
      email: invitation.email,
      role: invitation.role as InvitationRole,
    };
  } catch (error) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (cleanupError) {
      console.error(
        `No se pudo revertir el usuario de auth ${userId} tras un accept fallido:`,
        cleanupError,
      );
    }
    throw error;
  }
}

export type RevokeInvitationInput = {
  invitationId: string;
  tenantId: string;
  revokedBy: string;
};

/**
 * Revokes (deletes) a pending invitation. Admin-only, tenant-scoped: the query filters by both
 * `invitationId` and `tenantId` so an admin can never revoke another tenant's invitation even
 * though this runs with the service-role `db` (bypasses RLS) — the tenant scoping here is the
 * actual enforcement, mirroring `getTeamOverview`. Throws `invalid_token` when no matching row
 * exists (already revoked/accepted, or belongs to a different tenant).
 */
export async function revokeInvitation(
  input: RevokeInvitationInput,
  deps: Pick<InvitationDeps, "db"> = {},
): Promise<void> {
  const db = deps.db ?? getDb();

  const [deleted] = await db
    .delete(invitations)
    .where(and(eq(invitations.id, input.invitationId), eq(invitations.tenantId, input.tenantId)))
    .returning({ id: invitations.id, email: invitations.email, role: invitations.role });

  if (!deleted) {
    throw new InvitationError("La invitación no existe.", "invalid_token");
  }

  await db.insert(auditLog).values({
    tenantId: input.tenantId,
    actorUserId: input.revokedBy,
    action: "invitation.revoked",
    entityType: "invitation",
    entityId: input.invitationId,
    payload: { email: deleted.email, role: deleted.role },
  });
}
