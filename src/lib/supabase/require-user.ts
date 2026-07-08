import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { MemberRole } from "@/lib/roles";
import { createClient } from "./server";

export type AuthContext = {
  supabase: SupabaseClient;
  user: User;
  tenantId: string;
  role: MemberRole;
  fullName: string;
};

/**
 * Server-side auth guard for pages and Server Actions under `/app/**`. Validates the session
 * against Supabase Auth (never trusts the raw cookie) and returns the multi-tenant claims from
 * `app_metadata` (ADR-003). Redirects to `/login` when there is no valid session — the proxy
 * already does this optimistically, but every server entry point re-checks (defense in depth).
 */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const tenantId = user.app_metadata?.tenant_id;
  const role = user.app_metadata?.role;

  if (typeof tenantId !== "string" || typeof role !== "string") {
    // A session without tenant claims cannot use the app (should never happen for users created
    // through registerTenant/acceptInvitation). Sign out to clear the broken session.
    await supabase.auth.signOut();
    redirect("/login");
  }

  return {
    supabase,
    user,
    tenantId,
    role: role as MemberRole,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "",
  };
}

/** Like `requireUser`, but additionally requires the `admin` role; non-admins land on `/app`. */
export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireUser();
  if (context.role !== "admin") {
    redirect("/app?aviso=solo-admin");
  }
  return context;
}
