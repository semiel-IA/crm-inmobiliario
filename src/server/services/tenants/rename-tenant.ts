import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { auditLog, tenants } from "@/server/db/schema";

export type RenameTenantInput = {
  tenantId: string;
  name: string;
  actorUserId: string;
};

export type RenameTenantResult = {
  name: string;
};

export type RenameTenantErrorCode = "not_found";

/** Typed business error for `renameTenant`. */
export class RenameTenantError extends Error {
  readonly code: RenameTenantErrorCode;

  constructor(message: string, code: RenameTenantErrorCode) {
    super(message);
    this.name = "RenameTenantError";
    this.code = code;
  }
}

type RenameTenantDeps = {
  db?: ReturnType<typeof getDb>;
};

/**
 * Renames a tenant (agency name shown across the app). Runs with the service-role `db` (bypasses
 * RLS), so `tenantId` MUST come from verified JWT claims (`requireAdmin`), never from user input —
 * the query is scoped by `id = tenantId` so this can never touch a different tenant, mirroring
 * `revokeInvitation`'s tenant scoping (defense in depth on top of the `tenants_update_own_admin`
 * RLS policy, which this service bypasses). Appends an audit log entry with the previous and new
 * name.
 */
export async function renameTenant(
  input: RenameTenantInput,
  deps: RenameTenantDeps = {},
): Promise<RenameTenantResult> {
  const db = deps.db ?? getDb();

  const [existing] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!existing) {
    throw new RenameTenantError("La inmobiliaria no existe.", "not_found");
  }

  const [updated] = await db
    .update(tenants)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(tenants.id, input.tenantId))
    .returning({ name: tenants.name });

  if (!updated) {
    throw new RenameTenantError("La inmobiliaria no existe.", "not_found");
  }

  await db.insert(auditLog).values({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "tenant.renamed",
    entityType: "tenant",
    entityId: input.tenantId,
    payload: { previousName: existing.name, name: updated.name },
  });

  return { name: updated.name };
}
