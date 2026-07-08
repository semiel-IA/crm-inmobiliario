import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/supabase/require-user";
import { RenameTenantForm } from "./rename-tenant-form";

/** Tenant settings (admin only, enforced by proxy + `requireAdmin`). */
export default async function ConfiguracionPage() {
  const { supabase, tenantId } = await requireAdmin();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantId)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Configuración</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle data-testid="tenant-name">{tenant?.name ?? "—"}</CardTitle>
          <CardDescription>Identificador: {tenant?.slug ?? "—"}</CardDescription>
        </CardHeader>
        <CardContent>
          <RenameTenantForm currentName={tenant?.name ?? ""} />
        </CardContent>
      </Card>
    </main>
  );
}
