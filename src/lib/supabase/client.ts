import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

/**
 * Supabase client for use in the browser (Client Components). Uses the public anon key, which is
 * safe to expose — access is governed by Row Level Security policies (added in T0.3).
 */
export function createClient() {
  const env = getEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
