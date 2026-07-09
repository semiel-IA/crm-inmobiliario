import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { getEnv } from "../src/lib/env";
import { isValidE164 } from "../src/lib/format";
import {
  contacts,
  leadPreferences,
  propertyDocuments,
  propertyMedia,
  properties,
  plans,
  tenants,
} from "../src/server/db/schema";

/**
 * The three subscription plans from docs/plan-maestro.md §1.3. `priceCop` is a whole-peso
 * integer (no decimals — COP has no minor unit in everyday pricing).
 */
const PLAN_SEEDS: (typeof plans.$inferInsert)[] = [
  {
    name: "Agente",
    priceCop: 69_900,
    maxUsers: 1,
    maxProperties: 40,
    features: {},
  },
  {
    name: "Equipo",
    priceCop: 189_900,
    maxUsers: 5,
    maxProperties: 250,
    features: {},
  },
  {
    name: "Inmobiliaria",
    priceCop: 399_900,
    maxUsers: 15,
    maxProperties: null,
    features: {},
  },
];

type Db = ReturnType<typeof drizzle>;

/**
 * Sample properties for a newly-provisioned tenant (T1.6 DoD: "seeds generan datos: `npm run
 * db:seed` crea 5 propiedades por tenant"). One owner contact per property, matching
 * `docs/plan-fase-1-mvp.md` §T1.6: 2 apartments for sale in Bogotá, 2 houses for rent in
 * Medellín, 1 lot for both operations in Cali.
 *
 * `internalCode` mirrors the format `generatePropertyCode` will implement in T1.7
 * (`${tenantId.slice(0, 8)}-${sequential}`) — this is a seed-local placeholder, not the
 * authoritative generator (which also needs to handle concurrent inserts).
 */
const PROPERTY_SAMPLES = [
  {
    owner: { fullName: "Marta Elena Rodríguez", phone: "+573001112233" },
    property: {
      propertyType: "apartamento",
      operationType: "venta",
      salePriceCop: 450_000_000,
      areaM2: 78,
      bedrooms: 3,
      bathrooms: 2,
      parkingSpots: 1,
      stratum: 5,
      neighborhood: "Chapinero",
      city: "Bogotá",
      department: "Cundinamarca",
      description: "Apartamento luminoso en Chapinero, cerca a parques y transporte público.",
    },
    photoCount: 3,
  },
  {
    owner: { fullName: "Carlos Andrés Gómez", phone: "+573012223344" },
    property: {
      propertyType: "apartamento",
      operationType: "venta",
      salePriceCop: 620_000_000,
      areaM2: 95,
      bedrooms: 3,
      bathrooms: 3,
      parkingSpots: 2,
      stratum: 6,
      neighborhood: "Usaquén",
      city: "Bogotá",
      department: "Cundinamarca",
      description: "Apartamento amplio en Usaquén con vista panorámica y zonas comunes.",
    },
    photoCount: 2,
  },
  {
    owner: { fullName: "Luisa Fernanda Ortiz", phone: "+573023334455" },
    property: {
      propertyType: "casa",
      operationType: "arriendo",
      monthlyRentCop: 3_500_000,
      areaM2: 140,
      bedrooms: 4,
      bathrooms: 3,
      parkingSpots: 2,
      stratum: 5,
      neighborhood: "Laureles",
      city: "Medellín",
      department: "Antioquia",
      description: "Casa familiar en Laureles, patio interior y estudio independiente.",
    },
    photoCount: 3,
  },
  {
    owner: { fullName: "Julián David Restrepo", phone: "+573034445566" },
    property: {
      propertyType: "casa",
      operationType: "arriendo",
      monthlyRentCop: 5_200_000,
      areaM2: 180,
      bedrooms: 4,
      bathrooms: 4,
      parkingSpots: 3,
      stratum: 6,
      neighborhood: "El Poblado",
      city: "Medellín",
      department: "Antioquia",
      description: "Casa moderna en El Poblado con piscina y zona social techada.",
    },
    photoCount: 1,
  },
  {
    owner: { fullName: "Ana María Valencia", phone: "+573045556677" },
    property: {
      propertyType: "lote",
      operationType: "ambas",
      salePriceCop: 890_000_000,
      monthlyRentCop: 4_000_000,
      areaM2: 2500,
      neighborhood: "Pance",
      city: "Cali",
      department: "Valle del Cauca",
      description: "Lote urbanizable en Pance, disponible para venta o arriendo a largo plazo.",
    },
    photoCount: 2,
  },
] as const;

/**
 * Seeds contacts + properties + property_media + property_documents for every tenant that has
 * zero properties yet. Idempotent per-tenant (checks `properties` count before inserting), so
 * re-running `npm run db:seed` never duplicates sample data for a tenant that already has it.
 */
async function seedTenantPropertySamples(db: Db): Promise<void> {
  const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);

  if (allTenants.length === 0) {
    console.log("ℹ️  No hay tenants todavía — seed de propiedades omitido.");
    return;
  }

  for (const tenant of allTenants) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.tenantId, tenant.id));

    if (count > 0) {
      console.log(`↷ Tenant "${tenant.name}" ya tiene propiedades (${count}) — se omite.`);
      continue;
    }

    const codePrefix = tenant.id.slice(0, 8);
    let sequential = 1;

    for (const sample of PROPERTY_SAMPLES) {
      const [owner] = await db
        .insert(contacts)
        .values({
          tenantId: tenant.id,
          fullName: sample.owner.fullName,
          phone: sample.owner.phone,
          contactTypes: ["propietario"],
          source: "referido",
        })
        .returning({ id: contacts.id });

      const internalCode = `${codePrefix}-${String(sequential).padStart(4, "0")}`;
      sequential += 1;

      const [property] = await db
        .insert(properties)
        .values({
          tenantId: tenant.id,
          internalCode,
          ownerContactId: owner.id,
          ...sample.property,
        })
        .returning({ id: properties.id });

      for (let i = 0; i < sample.photoCount; i += 1) {
        await db.insert(propertyMedia).values({
          tenantId: tenant.id,
          propertyId: property.id,
          url: `https://placehold.co/property-photos/${tenant.id}/${property.id}/photo-${i + 1}.jpg`,
          mediaType: "foto",
          sortOrder: i,
          isCover: i === 0,
        });
      }

      await db.insert(propertyDocuments).values({
        tenantId: tenant.id,
        propertyId: property.id,
        name: "Paz y salvo de administración",
        documentType: "paz_salvos",
        url: `https://placehold.co/property-photos/${tenant.id}/${property.id}/documents/paz-y-salvo.pdf`,
      });
    }

    console.log(
      `✅ Tenant "${tenant.name}": ${PROPERTY_SAMPLES.length} propiedades de prueba creadas.`,
    );
  }
}

type ContactSample = {
  fullName: string;
  phone: string;
  email?: string;
  contactTypes: ("comprador" | "arrendatario" | "propietario")[];
  source: "portal" | "referido" | "redes" | "fachada" | "whatsapp" | "web";
  leadStatus?: "nuevo" | "contactado" | "calificado" | "inactivo";
  consentAt?: Date;
  consentChannel?: string;
  preferences: Array<{
    operationType: "venta" | "arriendo";
    propertyTypes: string[];
    zones: string[];
    budgetMinCop?: number;
    budgetMaxCop?: number;
    minBedrooms?: number;
    minBathrooms?: number;
    minParkingSpots?: number;
    minStratum?: number;
    maxStratum?: number;
  }>;
};

/**
 * 10 sample leads per tenant (T1.1 DoD: "seeds generan datos: `npm run db:seed` crea 10
 * contactos por tenant"), matching the variety requested by `docs/plan-fase-1-mvp.md` §T1.1: 3
 * buyers with sale preferences, 3 renters with rental preferences, 2 owners with no preferences,
 * and 2 mixed buyer+renter leads with one preference row per operation each — for 10 contacts and
 * 10 `lead_preferences` rows in total. Phone prefixes (31x) are chosen not to collide with the
 * property-owner contacts seeded by `seedTenantPropertySamples` (30x).
 */
const CONTACT_SAMPLES: ContactSample[] = [
  {
    fullName: "Daniela Sánchez Peña",
    phone: "+573101234501",
    email: "daniela.sanchez@example.com",
    contactTypes: ["comprador"],
    source: "portal",
    consentAt: new Date("2026-06-01T10:00:00Z"),
    consentChannel: "formulario_web",
    preferences: [
      {
        operationType: "venta",
        propertyTypes: ["apartamento", "casa"],
        zones: ["Chapinero", "Usaquén"],
        budgetMinCop: 300_000_000,
        budgetMaxCop: 600_000_000,
        minBedrooms: 2,
        minBathrooms: 2,
        minParkingSpots: 1,
        minStratum: 4,
        maxStratum: 6,
      },
    ],
  },
  {
    fullName: "Andrés Felipe Cárdenas",
    phone: "+573102234502",
    contactTypes: ["comprador"],
    source: "referido",
    leadStatus: "contactado",
    preferences: [
      {
        operationType: "venta",
        propertyTypes: ["apartamento"],
        zones: ["El Poblado", "Laureles"],
        budgetMinCop: 400_000_000,
        budgetMaxCop: 700_000_000,
        minBedrooms: 3,
        minStratum: 5,
        maxStratum: 6,
      },
    ],
  },
  {
    fullName: "Camila Andrea Rojas",
    phone: "+573103234503",
    email: "camila.rojas@example.com",
    contactTypes: ["comprador"],
    source: "web",
    preferences: [
      {
        operationType: "venta",
        propertyTypes: ["casa", "lote"],
        zones: ["Pance", "Ciudad Jardín"],
        budgetMinCop: 500_000_000,
        budgetMaxCop: 900_000_000,
        minBedrooms: 4,
        minParkingSpots: 2,
        minStratum: 4,
        maxStratum: 6,
      },
    ],
  },
  {
    fullName: "Juan Pablo Herrera",
    phone: "+573114234504",
    contactTypes: ["arrendatario"],
    source: "whatsapp",
    consentAt: new Date("2026-06-10T15:30:00Z"),
    consentChannel: "whatsapp",
    preferences: [
      {
        operationType: "arriendo",
        propertyTypes: ["apartamento"],
        zones: ["Chapinero"],
        budgetMinCop: 1_500_000,
        budgetMaxCop: 2_500_000,
        minBedrooms: 1,
        minStratum: 3,
        maxStratum: 5,
      },
    ],
  },
  {
    fullName: "Valentina Muñoz Díaz",
    phone: "+573115234505",
    email: "valentina.munoz@example.com",
    contactTypes: ["arrendatario"],
    source: "redes",
    leadStatus: "calificado",
    preferences: [
      {
        operationType: "arriendo",
        propertyTypes: ["apartamento", "oficina"],
        zones: ["Usaquén", "Cedritos"],
        budgetMinCop: 2_000_000,
        budgetMaxCop: 3_500_000,
        minBedrooms: 2,
        minBathrooms: 2,
      },
    ],
  },
  {
    fullName: "Sebastián Torres Lozano",
    phone: "+573116234506",
    contactTypes: ["arrendatario"],
    source: "portal",
    preferences: [
      {
        operationType: "arriendo",
        propertyTypes: ["casa"],
        zones: ["Laureles"],
        budgetMinCop: 3_000_000,
        budgetMaxCop: 5_000_000,
        minBedrooms: 3,
        minParkingSpots: 1,
        minStratum: 4,
        maxStratum: 6,
      },
    ],
  },
  {
    fullName: "Rosa Elvira Guzmán",
    phone: "+573127234507",
    contactTypes: ["propietario"],
    source: "referido",
    consentAt: new Date("2026-05-20T09:00:00Z"),
    consentChannel: "presencial",
    preferences: [],
  },
  {
    fullName: "Hernán Darío Peláez",
    phone: "+573128234508",
    contactTypes: ["propietario"],
    source: "fachada",
    preferences: [],
  },
  {
    fullName: "Laura Ximena Cortés",
    phone: "+573139234509",
    email: "laura.cortes@example.com",
    contactTypes: ["comprador", "arrendatario"],
    source: "web",
    leadStatus: "nuevo",
    preferences: [
      {
        operationType: "venta",
        propertyTypes: ["apartamento"],
        zones: ["Chapinero"],
        budgetMinCop: 350_000_000,
        budgetMaxCop: 550_000_000,
        minBedrooms: 2,
      },
      {
        operationType: "arriendo",
        propertyTypes: ["apartamento"],
        zones: ["Chapinero"],
        budgetMinCop: 1_800_000,
        budgetMaxCop: 2_800_000,
        minBedrooms: 2,
      },
    ],
  },
  {
    fullName: "Mateo Alejandro Vargas",
    phone: "+573140234510",
    contactTypes: ["comprador", "arrendatario"],
    source: "whatsapp",
    preferences: [
      {
        operationType: "venta",
        propertyTypes: ["casa", "lote"],
        zones: ["Pance"],
        budgetMinCop: 600_000_000,
        budgetMaxCop: 1_000_000_000,
      },
      {
        operationType: "arriendo",
        propertyTypes: ["casa"],
        zones: ["Pance"],
        budgetMinCop: 3_000_000,
        budgetMaxCop: 4_500_000,
      },
    ],
  },
];

/**
 * Seeds 10 sample leads (+ their `lead_preferences`) per tenant. Idempotent per-tenant: uses the
 * presence of any `lead_preferences` row for the tenant as the "already seeded" marker rather
 * than counting `contacts` directly, since `seedTenantPropertySamples` also creates contacts
 * (property owners) for the same tenant and would otherwise make this check always skip.
 */
async function seedTenantContactSamples(db: Db): Promise<void> {
  for (const sample of CONTACT_SAMPLES) {
    if (!isValidE164(sample.phone)) {
      throw new Error(`Seed inválido: el teléfono "${sample.phone}" no es E.164 válido.`);
    }
  }

  const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);

  if (allTenants.length === 0) {
    console.log("ℹ️  No hay tenants todavía — seed de contactos omitido.");
    return;
  }

  for (const tenant of allTenants) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leadPreferences)
      .where(eq(leadPreferences.tenantId, tenant.id));

    if (count > 0) {
      console.log(`↷ Tenant "${tenant.name}" ya tiene leads de prueba — se omite.`);
      continue;
    }

    for (const sample of CONTACT_SAMPLES) {
      const [contact] = await db
        .insert(contacts)
        .values({
          tenantId: tenant.id,
          fullName: sample.fullName,
          phone: sample.phone,
          email: sample.email,
          contactTypes: sample.contactTypes,
          source: sample.source,
          leadStatus: sample.leadStatus ?? "nuevo",
          consentAt: sample.consentAt,
          consentChannel: sample.consentChannel,
        })
        .returning({ id: contacts.id });

      for (const preference of sample.preferences) {
        await db.insert(leadPreferences).values({
          tenantId: tenant.id,
          contactId: contact.id,
          ...preference,
        });
      }
    }

    console.log(
      `✅ Tenant "${tenant.name}": ${CONTACT_SAMPLES.length} contactos de prueba creados.`,
    );
  }
}

async function main() {
  const env = getEnv();
  if (!env.databaseUrlReady || !env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está lista: falta la contraseña de la base de datos de Supabase.",
    );
  }

  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    for (const plan of PLAN_SEEDS) {
      await db
        .insert(plans)
        .values(plan)
        .onConflictDoUpdate({
          target: plans.name,
          set: {
            priceCop: plan.priceCop,
            maxUsers: plan.maxUsers,
            maxProperties: plan.maxProperties,
            features: plan.features,
            updatedAt: sql`now()`,
          },
        });
      console.log(`✅ Plan "${plan.name}" listo (upsert)`);
    }

    const count = await db.select({ name: plans.name }).from(plans);
    console.log(`Total de planes en la BD: ${count.length}`);

    await seedTenantPropertySamples(db);
    await seedTenantContactSamples(db);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("❌ Seed de planes falló:", error);
  process.exitCode = 1;
});
