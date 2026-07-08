import { requireUser } from "@/lib/supabase/require-user";
import { signOut } from "./actions";
import { AppNav } from "./nav";

/**
 * Persistent app shell for everything under `/app/**`: sidebar/top-bar navigation (role-filtered,
 * see `AppNav`) wrapping whatever page renders as `children`. Every page under this layout still
 * calls `requireUser`/`requireAdmin` itself — this layout's own call is for the nav's tenant
 * name/role/full name, not the sole guard (defense in depth, same pattern as the rest of the app).
 */
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { supabase, tenantId, role, fullName } = await requireUser();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <AppNav
        role={role}
        tenantName={tenant?.name ?? "—"}
        fullName={fullName}
        signOutAction={signOut}
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
