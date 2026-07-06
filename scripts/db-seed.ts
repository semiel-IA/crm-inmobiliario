import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { getEnv } from "../src/lib/env";
import { plans } from "../src/server/db/schema";

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
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("❌ Seed de planes falló:", error);
  process.exitCode = 1;
});
