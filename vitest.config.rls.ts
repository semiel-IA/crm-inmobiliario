import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Separate Vitest project for the RLS isolation suite (`npm run test:rls`). This suite hits the
 * real Supabase project over the network (creates/deletes real auth users and rows), so it is
 * deliberately excluded from `npm test` (`vitest.config.ts`), which must stay fast and
 * network-free.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
