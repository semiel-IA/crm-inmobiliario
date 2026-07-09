import "dotenv/config";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/server/db/admin";
import {
  contacts,
  leadPreferences,
  memberships,
  properties,
  propertyMedia,
  tenants,
} from "@/server/db/schema";

/**
 * Live RLS isolation suite for `contacts` (T1.6 prerequisite — see ADR-011), `properties`,
 * `property_media` and `property_documents` (T1.6), following the T0.3/T0.4 pattern in
 * `rls-isolation.test.ts` / `invitations-isolation.test.ts`: real Supabase project, throw-away
 * tenants/users, real sign-ins, asserting Postgres RLS itself blocks cross-tenant access.
 *
 * Policy under test: unlike `invitations` (admin-only), ANY authenticated member of the owning
 * tenant may SELECT/INSERT/UPDATE/DELETE these rows (see migration `0005_...rls.sql`).
 */

const env = getEnv();
const TEST_PASSWORD = `Rls-Prop-${randomUUID()}!Aa1`;
const RUN_SUFFIX = randomUUID().slice(0, 8);

type UserFixture = {
  userId: string;
  email: string;
  client: SupabaseClient;
};

let pgClient: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
let admin: SupabaseClient;
let anon: SupabaseClient;

let tenantAId: string;
let tenantBId: string;
let agentA: UserFixture | undefined;
let agentB: UserFixture | undefined;
let ownerContactAId: string;
let ownerContactBId: string;
let propertyAId: string;
let propertyBId: string;
let mediaAId: string;

async function createUserFixture(label: string, tenantId: string): Promise<UserFixture> {
  const email = `rls-prop-${label}+${RUN_SUFFIX}@example.com`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role: "agent" },
  });
  if (userError || !userData.user) {
    throw new Error(`No se pudo crear el usuario de prueba ${email}: ${userError?.message}`);
  }

  await db.insert(memberships).values({
    tenantId,
    userId: userData.user.id,
    role: "agent",
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

  const [tenantA] = await db
    .insert(tenants)
    .values({ name: "RLS properties test A", slug: `rls-prop-a-${RUN_SUFFIX}` })
    .returning({ id: tenants.id });
  const [tenantB] = await db
    .insert(tenants)
    .values({ name: "RLS properties test B", slug: `rls-prop-b-${RUN_SUFFIX}` })
    .returning({ id: tenants.id });
  tenantAId = tenantA.id;
  tenantBId = tenantB.id;

  agentA = await createUserFixture("agent-a", tenantAId);
  agentB = await createUserFixture("agent-b", tenantBId);

  const [ownerA] = await db
    .insert(contacts)
    .values({
      tenantId: tenantAId,
      fullName: "Owner A",
      phone: "+573000000001",
      contactTypes: ["propietario"],
    })
    .returning({ id: contacts.id });
  const [ownerB] = await db
    .insert(contacts)
    .values({
      tenantId: tenantBId,
      fullName: "Owner B",
      phone: "+573000000002",
      contactTypes: ["propietario"],
    })
    .returning({ id: contacts.id });
  ownerContactAId = ownerA.id;
  ownerContactBId = ownerB.id;

  const [propertyA] = await db
    .insert(properties)
    .values({
      tenantId: tenantAId,
      internalCode: `${tenantAId.slice(0, 8)}-0001`,
      propertyType: "apartamento",
      operationType: "venta",
      ownerContactId: ownerContactAId,
      salePriceCop: 100_000_000,
    })
    .returning({ id: properties.id });
  const [propertyB] = await db
    .insert(properties)
    .values({
      tenantId: tenantBId,
      internalCode: `${tenantBId.slice(0, 8)}-0001`,
      propertyType: "casa",
      operationType: "arriendo",
      ownerContactId: ownerContactBId,
      monthlyRentCop: 2_000_000,
    })
    .returning({ id: properties.id });
  propertyAId = propertyA.id;
  propertyBId = propertyB.id;

  const [mediaA] = await db
    .insert(propertyMedia)
    .values({
      tenantId: tenantAId,
      propertyId: propertyAId,
      url: "https://placehold.co/property-photos/a/1.jpg",
      mediaType: "foto",
    })
    .returning({ id: propertyMedia.id });
  mediaAId = mediaA.id;

  await db.insert(leadPreferences).values({
    tenantId: tenantAId,
    contactId: ownerContactAId,
    operationType: "venta",
    propertyTypes: ["apartamento"],
    zones: ["Chapinero"],
    budgetMinCop: 200_000_000,
    budgetMaxCop: 500_000_000,
  });
});

afterAll(async () => {
  for (const fixture of [agentA, agentB]) {
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
      // Cascades to memberships, contacts, properties, property_media, property_documents.
      await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    } catch (error) {
      console.error("No se pudieron borrar los tenants de prueba:", error);
    }
  }

  await pgClient?.end();
});

describe("RLS isolation — contacts (T1.6 prerequisite, ADR-011)", () => {
  it("agent of tenant A sees only tenant A's contacts", async () => {
    const { data, error } = await agentA!.client.from("contacts").select("id, tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === tenantAId)).toBe(true);
    expect(data?.some((row) => row.id === ownerContactBId)).toBe(false);
  });

  it("an anonymous client sees zero contacts", async () => {
    const { data, error } = await anon.from("contacts").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("RLS isolation — properties", () => {
  it("agent of tenant A sees only tenant A's properties", async () => {
    const { data, error } = await agentA!.client.from("properties").select("id, tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === tenantAId)).toBe(true);
    expect(data?.some((row) => row.id === propertyBId)).toBe(false);
  });

  it("agent of tenant B (symmetric check) sees only tenant B's properties", async () => {
    const { data, error } = await agentB!.client.from("properties").select("id, tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === tenantBId)).toBe(true);
  });

  it("agent of tenant A cannot UPDATE tenant B's property", async () => {
    const crossUpdate = await agentA!.client
      .from("properties")
      .update({ status: "vendida" })
      .eq("id", propertyBId)
      .select();

    expect(crossUpdate.data).toHaveLength(0);

    const [bRow] = await db
      .select({ status: properties.status })
      .from(properties)
      .where(eq(properties.id, propertyBId));
    expect(bRow?.status).toBe("disponible");
  });

  it("agent of tenant A CAN update their own tenant's property", async () => {
    const ownUpdate = await agentA!.client
      .from("properties")
      .update({ status: "reservada" })
      .eq("id", propertyAId)
      .select();

    expect(ownUpdate.error).toBeNull();
    expect(ownUpdate.data).toHaveLength(1);
  });

  it("agent of tenant A cannot INSERT a property under tenant B's id", async () => {
    const crossInsert = await agentA!.client.from("properties").insert({
      tenant_id: tenantBId,
      internal_code: `${tenantBId.slice(0, 8)}-9999`,
      property_type: "local",
      operation_type: "venta",
      owner_contact_id: ownerContactBId,
      sale_price_cop: 1,
    });

    expect(crossInsert.error).not.toBeNull();
  });

  it("agent of tenant A cannot DELETE tenant B's property", async () => {
    const crossDelete = await agentA!.client
      .from("properties")
      .delete()
      .eq("id", propertyBId)
      .select();

    expect(crossDelete.data).toHaveLength(0);

    const [stillThere] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, propertyBId));
    expect(stillThere?.id).toBe(propertyBId);
  });

  it("an anonymous client sees zero properties (public listing goes through service_role, not anon RLS)", async () => {
    const { data, error } = await anon.from("properties").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("RLS isolation — property_media", () => {
  it("agent of tenant A sees only tenant A's media", async () => {
    const { data, error } = await agentA!.client.from("property_media").select("id, tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === tenantAId)).toBe(true);
  });

  it("agent of tenant B sees zero media (tenant B has none yet)", async () => {
    const { data, error } = await agentB!.client.from("property_media").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("single-cover trigger: setting a new cover demotes the previous one", async () => {
    const secondPhoto = await agentA!.client
      .from("property_media")
      .insert({
        tenant_id: tenantAId,
        property_id: propertyAId,
        url: "https://placehold.co/property-photos/a/2.jpg",
        media_type: "foto",
        sort_order: 1,
        is_cover: true,
      })
      .select("id")
      .single();

    expect(secondPhoto.error).toBeNull();

    const [firstPhoto] = await db
      .select({ isCover: propertyMedia.isCover })
      .from(propertyMedia)
      .where(eq(propertyMedia.id, mediaAId));
    expect(firstPhoto?.isCover).toBe(false);

    const [newCover] = await db
      .select({ isCover: propertyMedia.isCover })
      .from(propertyMedia)
      .where(eq(propertyMedia.id, secondPhoto.data!.id));
    expect(newCover?.isCover).toBe(true);
  });

  it("agent of tenant A cannot INSERT media under tenant B's property", async () => {
    const crossInsert = await agentA!.client.from("property_media").insert({
      tenant_id: tenantBId,
      property_id: propertyBId,
      url: "https://placehold.co/property-photos/hijack.jpg",
      media_type: "foto",
    });

    expect(crossInsert.error).not.toBeNull();
  });
});

describe("RLS isolation — lead_preferences (T1.1)", () => {
  it("agent of tenant A sees only tenant A's lead preferences", async () => {
    const { data, error } = await agentA!.client
      .from("lead_preferences")
      .select("id, tenant_id");

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.tenant_id === tenantAId)).toBe(true);
  });

  it("agent of tenant B sees zero lead preferences (tenant B has none)", async () => {
    const { data, error } = await agentB!.client.from("lead_preferences").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("agent of tenant A cannot INSERT a preference under tenant B", async () => {
    const crossInsert = await agentA!.client.from("lead_preferences").insert({
      tenant_id: tenantBId,
      contact_id: ownerContactBId,
      operation_type: "arriendo",
    });

    expect(crossInsert.error).not.toBeNull();
  });

  it("an anonymous client sees zero lead preferences", async () => {
    const { data, error } = await anon.from("lead_preferences").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("RLS isolation — property_documents", () => {
  it("agent of tenant A CAN insert and read a document for their own property", async () => {
    const insertResult = await agentA!.client
      .from("property_documents")
      .insert({
        tenant_id: tenantAId,
        property_id: propertyAId,
        name: "Paz y salvo",
        document_type: "paz_salvos",
        url: "https://placehold.co/property-photos/a/documents/paz-y-salvo.pdf",
      })
      .select("id");

    expect(insertResult.error).toBeNull();
    expect(insertResult.data).toHaveLength(1);

    const { data, error } = await agentA!.client.from("property_documents").select("tenant_id");
    expect(error).toBeNull();
    expect(data?.every((row) => row.tenant_id === tenantAId)).toBe(true);
  });

  it("agent of tenant B sees zero documents (tenant B has none)", async () => {
    const { data, error } = await agentB!.client.from("property_documents").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
