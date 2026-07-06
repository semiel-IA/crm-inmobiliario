import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// DATABASE_URL may still hold the pending-password placeholder (see docs/estado.md, T0.2) — that
// is fine here because this config is only read when a drizzle-kit command actually runs, which
// is not part of this task. The schema file itself lands in T0.3.
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
