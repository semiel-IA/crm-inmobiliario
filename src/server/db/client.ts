import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";

type Db = ReturnType<typeof drizzle>;

let cachedDb: Db | undefined;

/**
 * Lazily creates (and memoizes) the Drizzle client backed by a `postgres` connection. Throws a
 * clear error instead of connecting when `DATABASE_URL` is not ready yet (missing or still the
 * pending-password placeholder — see docs/estado.md, T0.2). Nothing runs at import time, so
 * importing this module is always safe even before the database password is available.
 */
export function getDb(): Db {
  if (cachedDb) {
    return cachedDb;
  }

  const env = getEnv();
  if (!env.databaseUrlReady || !env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está lista: falta la contraseña de la base de datos de Supabase " +
        "(ver docs/estado.md, T0.2). Configura DATABASE_URL en .env antes de usar la base de datos.",
    );
  }

  // Tuned for serverless (Vercel), where every warm lambda keeps its own pool:
  //   · `max: 1` — postgres.js defaults to 10 per instance, and Supabase's free tier allows 15
  //     connections in total, so a handful of concurrent lambdas exhausts the pool and every
  //     request fails with `EMAXCONNSESSION: max clients reached`.
  //   · `prepare: false` — required by Supabase's transaction pooler (pgbouncer, port 6543), the
  //     only connection mode that is both IPv4-reachable and safe for serverless. It multiplexes
  //     connections across clients, so server-side prepared statements cannot be relied upon.
  // Both settings are harmless for local development against a direct connection.
  const client = postgres(env.DATABASE_URL, { max: 1, prepare: false, idle_timeout: 20 });
  cachedDb = drizzle(client);
  return cachedDb;
}
