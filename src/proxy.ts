import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseClientEnv } from "@/lib/env";

/**
 * Session proxy (Next 16's rename of middleware): refreshes the Supabase auth cookies on every
 * matched request (standard `@supabase/ssr` pattern) and applies optimistic route protection:
 *
 * - `/app/**` requires a session → otherwise redirect to `/login`.
 * - `/app/configuracion/**` and `/app/equipo/**` additionally require the `admin` role (read from
 *   the JWT `app_metadata` claim, see ADR-003) → non-admins land on `/app?aviso=solo-admin`.
 * - Everything else (`/`, `/login`, `/registro`, `/invitacion/**`, later `/p/**`) is public.
 *
 * This is the optimistic first line of defense only: pages and Server Actions re-verify session
 * and role server-side, and RLS enforces tenancy at the database.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = parseClientEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Revalidates the token against Supabase Auth and refreshes cookies when needed. Do not
  // replace with `getSession()` — that would trust a possibly-stale cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const isAdminOnlyPath =
      pathname === "/app/configuracion" ||
      pathname.startsWith("/app/configuracion/") ||
      pathname === "/app/equipo" ||
      pathname.startsWith("/app/equipo/");

    if (isAdminOnlyPath && user.app_metadata?.role !== "admin") {
      const homeUrl = new URL("/app", request.url);
      homeUrl.searchParams.set("aviso", "solo-admin");
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static assets (anything with a file extension).
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
