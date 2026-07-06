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

  const client = postgres(env.DATABASE_URL);
  cachedDb = drizzle(client);
  return cachedDb;
}
