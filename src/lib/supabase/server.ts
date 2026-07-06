import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers. Reads/writes auth
 * cookies through Next.js' `cookies()` API. Must be created per-request (do not cache/reuse the
 * returned client across requests).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render — safe to ignore as long as middleware
          // (added when auth lands in T0.4) refreshes the user session.
        }
      },
    },
  });
}
