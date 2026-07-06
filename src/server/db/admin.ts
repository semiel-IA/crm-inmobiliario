import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Supabase client authenticated with the `service_role` key, which bypasses Row Level Security
 * entirely. Server-only: never import this module from Client Components or any code bundled to
 * the browser. Only use it from Server Components, Server Actions, Route Handlers, or scripts
 * that run exclusively on the server/CLI.
 */
export function createAdminClient() {
  const env = getEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
