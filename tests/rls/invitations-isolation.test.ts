import "dotenv/config";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/server/db/admin";
import { invitations, memberships, tenants } from "@/server/db/schema";
import { generateInvitationToken, hashInvitationToken } from "@/server/services/auth/helpers";

/**
 * Live RLS isolation suite for `invitations` (T0.4), following the T0.3 pattern in
 * `rls-isolation.test.ts`: real Supabase project, throw-away tenants/users, real sign-ins.
 *
 * Policy under test: only ADMINS of the OWNING tenant may select/insert/update/delete
 * invitations. Cross-tenant admins see nothing; same-tenant agents (non-admin) see nothing.
 */

const env = getEnv();
const TEST_PASSWORD = `Rls-Inv-${randomUUID()}!Aa1`;
const RUN_SUFFIX = randomUUID().slice(0, 8);

type UserFixture = {
  userId: string;
  email: string;
  /** Supabase client already signed in as this user. */
  client: SupabaseClient;
};

let pgClient: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
let admin: SupabaseClient;

let tenantAId: string;
let tenantBId: string;
let adminA: UserFixture | undefined;
let agentA: UserFixture | undefined;
let adminB: UserFixture | undefined;
let invitationAId: string;
let invitationBId: string;

async function createUserFixture(
  label: string,
  tenantId: string,
  role: "admin" | "agent",
): Promise<UserFixture> {
  const email = `rls-inv-${label}+${RUN_SUFFIX}@example.com`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role },
  });
  if (userError || !userData.user) {
    throw new Error(`No se pudo crear el usuario de prueba ${email}: ${userError?.message}`);
  }

  await db.insert(memberships).values({
    tenantId,
    userId: userData.user.id,
    role,
    status: "active",
  });

  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionData, error: sessionError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (sessionError || !sessionData.session) {
    throw new Error(`No se pudo iniciar sesión con ${email}: ${sessionError?.message}`);
  }

  return { userId: userData.user.id, email, client };
}

async function seedInvitation(tenantId: string, label: string): Promise<string> {
  const [row] = await db
    .insert(invitations)
    .values({
      tenantId,
      email: `rls-inv-invited-${label}+${RUN_SUFFIX}@example.com`,
      role: "agent",
      tokenHash: hashInvitationToken(generateInvitationToken()),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: invitations.id });
  return row.id;
}

beforeAll(async () => {
  if (!env.databaseUrlReady || !env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está lista; no se puede correr la suite de aislamiento.");
  }

  pgClient = postgres(env.DATABASE_URL, { max: 1 });
  db = drizzle(pgClient);
  admin = createAdminClient();

  const [tenantA] = await db
    .insert(tenants)
    .values({ name: "RLS invitations test A", slug: `rls-inv-a-${RUN_SUFFIX}` })
    .returning({ id: tenants.id });
  const [tenantB] = await db
    .insert(tenants)
    .values({ name: "RLS invitations test B", slug: `rls-inv-b-${RUN_SUFFIX}` })
    .returning({ id: tenants.id });
  tenantAId = tenantA.id;
  tenantBId = tenantB.id;

  adminA = await createUserFixture("admin-a", tenantAId, "admin");
  agentA = await createUserFixture("agent-a", tenantAId, "agent");
  adminB = await createUserFixture("admin-b", tenantBId, "admin");

  invitationAId = await seedInvitation(tenantAId, "a");
  invitationBId = await seedInvitation(tenantBId, "b");
});

afterAll(async () => {
  for (const fixture of [adminA, agentA, adminB]) {
    if (!fixture) continue;
    try {
      await admin.auth.admin.deleteUser(fixture.userId);
    } catch (error) {
      console.error(`No se pudo borrar el usuario de prueba ${fixture.email}:`, error);
    }
  }

  const tenantIds = [tenantAId, tenantBId].filter((id): id is string => id !== undefined);
  if (tenantIds.length > 0 && db) {
    try {
      // Cascades to memberships, invitations and audit_log via their FKs.
      await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    } catch (error) {
      console.error("No se pudieron borrar los tenants de prueba:", error);
    }
  }

  await pgClient?.end();
});

describe("RLS isolation — invitations", () => {
  it("admin of tenant A sees exactly their own tenant's invitations", async () => {
    const { data, error } = await adminA!.client.from("invitations").select("id, tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === tenantAId)).toBe(true);
    expect(data?.some((row) => row.id === invitationBId)).toBe(false);
  });

  it("admin of tenant B (symmetric check) sees only tenant B's invitations", async () => {
    const { data, error } = await adminB!.client.from("invitations").select("id, tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === tenantBId)).toBe(true);
  });

  it("an agent of tenant A sees ZERO invitations, even from their own tenant", async () => {
    const { data, error } = await agentA!.client.from("invitations").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("admin of tenant A cannot UPDATE tenant B's invitation", async () => {
    const crossUpdate = await adminA!.client
      .from("invitations")
      .update({ email: "hijacked@example.com" })
      .eq("id", invitationBId)
      .select();

    expect(crossUpdate.data).toHaveLength(0);

    // Confirm via the service-role connection that B's row was never touched.
    const [bRow] = await db
      .select({ email: invitations.email })
      .from(invitations)
      .where(eq(invitations.id, invitationBId));
    expect(bRow?.email).not.toBe("hijacked@example.com");
  });

  it("admin of tenant A CAN update their own tenant's invitation", async () => {
    const ownUpdate = await adminA!.client
      .from("invitations")
      .update({ email: `rls-inv-updated+${RUN_SUFFIX}@example.com` })
      .eq("id", invitationAId)
      .select();

    expect(ownUpdate.error).toBeNull();
    expect(ownUpdate.data).toHaveLength(1);
  });

  it("admin of tenant A cannot INSERT an invitation under tenant B's id", async () => {
    const crossInsert = await adminA!.client.from("invitations").insert({
      tenant_id: tenantBId,
      email: `rls-inv-cross+${RUN_SUFFIX}@example.com`,
      role: "agent",
      token_hash: hashInvitationToken(generateInvitationToken()),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(crossInsert.error).not.toBeNull();
  });

  it("an agent of tenant A cannot INSERT an invitation even for their own tenant", async () => {
    const agentInsert = await agentA!.client.from("invitations").insert({
      tenant_id: tenantAId,
      email: `rls-inv-agent+${RUN_SUFFIX}@example.com`,
      role: "agent",
      token_hash: hashInvitationToken(generateInvitationToken()),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(agentInsert.error).not.toBeNull();
  });

  it("admin of tenant A cannot DELETE tenant B's invitation", async () => {
    const crossDelete = await adminA!.client
      .from("invitations")
      .delete()
      .eq("id", invitationBId)
      .select();

    expect(crossDelete.data).toHaveLength(0);

    const [stillThere] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(eq(invitations.id, invitationBId));
    expect(stillThere?.id).toBe(invitationBId);
  });

  it("admin of tenant A CAN insert and delete invitations for their own tenant", async () => {
    const ownInsert = await adminA!.client
      .from("invitations")
      .insert({
        tenant_id: tenantAId,
        email: `rls-inv-own+${RUN_SUFFIX}@example.com`,
        role: "assistant",
        token_hash: hashInvitationToken(generateInvitationToken()),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .select("id");

    expect(ownInsert.error).toBeNull();
    expect(ownInsert.data).toHaveLength(1);

    const ownDelete = await adminA!.client
      .from("invitations")
      .delete()
      .eq("id", ownInsert.data![0].id)
      .select();

    expect(ownDelete.error).toBeNull();
    expect(ownDelete.data).toHaveLength(1);
  });
});
