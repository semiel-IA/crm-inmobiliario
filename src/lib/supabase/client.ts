import { createBrowserClient } from "@supabase/ssr";
import { parseClientEnv } from "@/lib/env";

/**
 * Supabase client for use in the browser (Client Components). Uses the public anon key, which is
 * safe to expose — access is governed by Row Level Security policies (added in T0.3).
 *
 * The two variables are read as literal `process.env.NEXT_PUBLIC_*` expressions on purpose:
 * Next.js only inlines env vars into the client bundle when they appear as those exact tokens in
 * the source. Do not refactor this into a dynamic lookup or a whole-`process.env` pass — it
 * would break in the browser.
 */
export function createClient() {
  const env = parseClientEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
