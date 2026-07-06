import "dotenv/config";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/server/db/admin";
import { memberships, tenants } from "@/server/db/schema";

/**
 * Live multi-tenant isolation suite. Runs against the real Supabase project configured in
 * `.env`: creates two throw-away tenants/users via the admin API and a direct Postgres
 * connection, signs in as each, and asserts Postgres RLS actually blocks cross-tenant access —
 * not just that the app "remembers" to filter by tenant.
 *
 * This suite is intentionally excluded from `npm test` (see `vitest.config.rls.ts`): it needs
 * network access and mutates real (if disposable) rows/users, so it runs only via
 * `npm run test:rls`.
 */

const env = getEnv();
const TEST_PASSWORD = `Rls-Test-${randomUUID()}!Aa1`;
const RUN_SUFFIX = randomUUID().slice(0, 8);

type TenantFixture = {
  tenantId: string;
  slug: string;
  userId: string;
  email: string;
  /** Supabase client already signed in as this tenant's admin user. */
  client: SupabaseClient;
};

let pgClient: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
let admin: SupabaseClient;
let anon: SupabaseClient;

let fixtureA: TenantFixture | undefined;
let fixtureB: TenantFixture | undefined;

async function createTenantFixture(label: "a" | "b"): Promise<TenantFixture> {
  const slug = `rls-${label}-${RUN_SUFFIX}`;
  const email = `rls-${label}+${RUN_SUFFIX}@example.com`;

  const [tenant] = await db
    .insert(tenants)
    .values({ name: `RLS isolation test ${label.toUpperCase()}`, slug })
    .returning({ id: tenants.id });

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: { tenant_id: tenant.id, role: "admin" },
  });
  if (userError || !userData.user) {
    throw new Error(`No se pudo crear el usuario de prueba ${email}: ${userError?.message}`);
  }

  await db.insert(memberships).values({
    tenantId: tenant.id,
    userId: userData.user.id,
    role: "admin",
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

  return { tenantId: tenant.id, slug, userId: userData.user.id, email, client };
}

beforeAll(async () => {
  if (!env.databaseUrlReady || !env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está lista; no se puede correr la suite de aislamiento.");
  }

  pgClient = postgres(env.DATABASE_URL, { max: 1 });
  db = drizzle(pgClient);
  admin = createAdminClient();
  anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  fixtureA = await createTenantFixture("a");
  fixtureB = await createTenantFixture("b");
});

afterAll(async () => {
  // Best-effort teardown: each deletion is isolated so one failure doesn't skip the rest, and the
  // suite can be re-run repeatedly without leaving orphaned users/tenants behind.
  for (const fixture of [fixtureA, fixtureB]) {
    if (!fixture) continue;
    try {
      await admin.auth.admin.deleteUser(fixture.userId);
    } catch (error) {
      console.error(`No se pudo borrar el usuario de prueba ${fixture.email}:`, error);
    }
  }

  const tenantIds = [fixtureA?.tenantId, fixtureB?.tenantId].filter(
    (id): id is string => id !== undefined,
  );
  if (tenantIds.length > 0 && db) {
    try {
      // Cascades to memberships and audit_log via their FKs.
      await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    } catch (error) {
      console.error("No se pudieron borrar los tenants de prueba:", error);
    }
  }

  await pgClient?.end();
});

describe("RLS isolation — tenant A vs tenant B", () => {
  it("tenant A sees exactly its own tenant row via SELECT", async () => {
    const { data, error } = await fixtureA!.client.from("tenants").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(fixtureA!.tenantId);
  });

  it("tenant B (symmetric check) also sees exactly its own tenant row", async () => {
    const { data, error } = await fixtureB!.client.from("tenants").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(fixtureB!.tenantId);
  });

  it("tenant A sees only its own membership rows", async () => {
    const { data, error } = await fixtureA!.client.from("memberships").select("tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === fixtureA!.tenantId)).toBe(true);
  });

  it("tenant A cannot UPDATE tenant B's row, but can update its own", async () => {
    const crossUpdate = await fixtureA!.client
      .from("tenants")
      .update({ name: "hijacked by A" })
      .eq("id", fixtureB!.tenantId)
      .select();

    expect(crossUpdate.data).toHaveLength(0);

    const ownUpdate = await fixtureA!.client
      .from("tenants")
      .update({ name: "Updated by A itself" })
      .eq("id", fixtureA!.tenantId)
      .select();

    expect(ownUpdate.error).toBeNull();
    expect(ownUpdate.data).toHaveLength(1);

    // Confirm via the admin connection that B's row was never touched.
    const [bRow] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(inArray(tenants.id, [fixtureB!.tenantId]));
    expect(bRow?.name).not.toBe("hijacked by A");
  });

  it("tenant A cannot INSERT into audit_log under tenant B's id, but can under its own", async () => {
    const crossInsert = await fixtureA!.client
      .from("audit_log")
      .insert({ tenant_id: fixtureB!.tenantId, action: "rls_test_cross_tenant" });

    expect(crossInsert.error).not.toBeNull();

    const ownInsert = await fixtureA!.client
      .from("audit_log")
      .insert({ tenant_id: fixtureA!.tenantId, action: "rls_test_own_tenant" })
      .select();

    expect(ownInsert.error).toBeNull();
    expect(ownInsert.data).toHaveLength(1);
  });

  it("tenant A's audit_log SELECT never includes tenant B's entries", async () => {
    // Give tenant B its own audit entry so the isolation check is meaningful, not vacuous.
    await fixtureB!.client
      .from("audit_log")
      .insert({ tenant_id: fixtureB!.tenantId, action: "rls_test_b_own_tenant" });

    const { data, error } = await fixtureA!.client.from("audit_log").select("tenant_id, action");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === fixtureA!.tenantId)).toBe(true);
  });

  it("plans are publicly readable and the 3 seeded plans exist", async () => {
    const { data, error } = await fixtureA!.client.from("plans").select("name");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThanOrEqual(3);
  });

  it("an anonymous client with no session sees zero tenant rows", async () => {
    const { data, error } = await anon.from("tenants").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
