import { Alert, AlertTitle } from "@/components/ui/alert";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/lib/supabase/require-user";

/**
 * Authenticated home: greeting, tenant name and role. Navigation and sign-out live in the shared
 * app shell (`layout.tsx`/`nav.tsx`, T0.5). Also surfaces the "solo admins" notice when the proxy
 * bounced a non-admin from an admin-only section (`?aviso=solo-admin`).
 */
export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const [{ supabase, tenantId, role, fullName }, { aviso }] = await Promise.all([
    requireUser(),
    searchParams,
  ]);

  // RLS-scoped read: the member can only ever see their own tenant's row.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      {aviso === "solo-admin" && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Solo los administradores pueden acceder a esa sección.</AlertTitle>
        </Alert>
      )}

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Hola, {fullName}</h1>
        <p className="text-muted-foreground" data-testid="tenant-name">
          {tenant?.name ?? "—"}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="member-role">
          Rol: {ROLE_LABELS[role]}
        </p>
      </header>
    </main>
  );
}
