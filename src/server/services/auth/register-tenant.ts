import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { createAdminClient } from "@/server/db/admin";
import { getDb } from "@/server/db/client";
import { auditLog, memberships, tenants } from "@/server/db/schema";
import { buildSlug } from "./helpers";

export type RegisterTenantInput = {
  tenantName: string;
  fullName: string;
  email: string;
  password: string;
};

export type RegisterTenantResult = {
  tenantId: string;
  userId: string;
  slug: string;
};

export type RegisterTenantErrorCode = "email_taken" | "unknown";

/** Typed business error for `registerTenant`, distinguishing "email already registered" from
 * unexpected failures so the Server Action can show a clear message in each case. */
export class RegisterTenantError extends Error {
  readonly code: RegisterTenantErrorCode;

  constructor(message: string, code: RegisterTenantErrorCode) {
    super(message);
    this.name = "RegisterTenantError";
    this.code = code;
  }
}

type RegisterTenantDeps = {
  db?: ReturnType<typeof getDb>;
  adminClient?: ReturnType<typeof createAdminClient>;
};

const TRIAL_DAYS = 14;
const MAX_SLUG_ATTEMPTS = 5;

function isDuplicateEmailError(error: { code?: string; status?: number; message?: string }) {
  return (
    error.code === "email_exists" ||
    error.status === 422 ||
    (error.message ?? "").toLowerCase().includes("already been registered")
  );
}

/**
 * Registers a new tenant (real-estate agency) and its first user as an active admin. Order of
 * operations matters: the tenant row is created first (it needs no external dependency), then the
 * Supabase Auth user (Admin API, `email_confirm: true` per ADR-006), then the membership, then the
 * audit trail entry. If anything after user creation fails, both the auth user and the tenant row
 * are deleted best-effort (compensation) so a failed signup doesn't leave an orphaned, confirmed
 * auth user (which would permanently block that email from re-registering) or an orphaned tenant.
 */
export async function registerTenant(
  input: RegisterTenantInput,
  deps: RegisterTenantDeps = {},
): Promise<RegisterTenantResult> {
  const db = deps.db ?? getDb();
  const admin = deps.adminClient ?? createAdminClient();

  const slug = await buildUniqueSlug(db, input.tenantName);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const [tenant] = await db
    .insert(tenants)
    .values({ name: input.tenantName, slug, status: "trial", trialEndsAt })
    .returning({ id: tenants.id });

  if (!tenant) {
    throw new RegisterTenantError("No se pudo crear la inmobiliaria.", "unknown");
  }

  let createdUserId: string | undefined;

  try {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { tenant_id: tenant.id, role: "admin" },
      user_metadata: { full_name: input.fullName },
    });

    if (userError || !userData.user) {
      if (userError && isDuplicateEmailError(userError)) {
        throw new RegisterTenantError("Este correo ya está registrado.", "email_taken");
      }
      throw new RegisterTenantError(
        userError?.message ?? "No se pudo crear el usuario.",
        "unknown",
      );
    }

    createdUserId = userData.user.id;

    await db.insert(memberships).values({
      tenantId: tenant.id,
      userId: userData.user.id,
      role: "admin",
      status: "active",
    });

    await db.insert(auditLog).values({
      tenantId: tenant.id,
      actorUserId: userData.user.id,
      action: "tenant.registered",
      entityType: "tenant",
      entityId: tenant.id,
    });

    return { tenantId: tenant.id, userId: userData.user.id, slug };
  } catch (error) {
    if (createdUserId) {
      try {
        await admin.auth.admin.deleteUser(createdUserId);
      } catch (cleanupError) {
        console.error(
          `No se pudo revertir el usuario de auth ${createdUserId} tras un registro fallido:`,
          cleanupError,
        );
      }
    }
    try {
      await db.delete(tenants).where(eq(tenants.id, tenant.id));
    } catch (cleanupError) {
      console.error(
        `No se pudo revertir el tenant ${tenant.id} tras un registro fallido:`,
        cleanupError,
      );
    }
    throw error;
  }
}

async function buildUniqueSlug(db: ReturnType<typeof getDb>, name: string): Promise<string> {
  const base = buildSlug(name);
  let candidate = base;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, candidate))
      .limit(1);

    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${randomBytes(3).toString("hex")}`;
  }

  throw new RegisterTenantError(
    "No se pudo generar un identificador único para la inmobiliaria.",
    "unknown",
  );
}
