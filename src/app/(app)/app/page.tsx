import Link from "next/link";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/lib/supabase/require-user";
import { signOut } from "./actions";

/**
 * Minimal authenticated home (the real app layout arrives in T0.5): greeting, tenant name, role
 * and sign-out. Also surfaces the "solo admins" notice when the proxy bounced a non-admin from
 * an admin-only section (`?aviso=solo-admin`).
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

      <nav className="flex flex-wrap gap-3">
        {role === "admin" && (
          <>
            <Link href="/app/equipo" className={buttonVariants({ variant: "outline" })}>
              Equipo
            </Link>
            <Link href="/app/configuracion" className={buttonVariants({ variant: "outline" })}>
              Configuración
            </Link>
          </>
        )}
      </nav>

      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
