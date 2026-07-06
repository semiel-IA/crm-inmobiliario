import "dotenv/config";
import { getEnv } from "../src/lib/env";

async function pingRest(env: ReturnType<typeof getEnv>): Promise<boolean> {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`;

  try {
    const response = await fetch(url, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    });

    if (response.ok) {
      console.log(`✅ REST (Supabase Auth health): OK (status ${response.status})`);
      return true;
    }

    console.error(`❌ REST (Supabase Auth health): falló (status ${response.status})`);
    return false;
  } catch (error) {
    console.error(
      `❌ REST (Supabase Auth health): falló — ${error instanceof Error ? error.message : error}`,
    );
    return false;
  }
}

async function pingPostgres(env: ReturnType<typeof getEnv>): Promise<boolean> {
  if (!env.databaseUrlReady || !env.DATABASE_URL) {
    console.log("⚠️  Postgres: DATABASE_URL pendiente de contraseña de BD — ping Postgres omitido");
    return true;
  }

  const { default: postgres } = await import("postgres");
  const sql = postgres(env.DATABASE_URL, { max: 1 });

  try {
    await sql`select 1`;
    console.log("✅ Postgres: conexión OK");
    return true;
  } catch (error) {
    console.error(
      `❌ Postgres: falló la conexión — ${error instanceof Error ? error.message : error}`,
    );
    return false;
  } finally {
    await sql.end();
  }
}

async function main() {
  const env = getEnv();

  const restOk = await pingRest(env);
  const postgresOk = await pingPostgres(env);

  if (!restOk || !postgresOk) {
    process.exitCode = 1;
  }
}

main();
