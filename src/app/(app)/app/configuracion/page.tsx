import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/supabase/require-user";

/** Placeholder settings page (admin only). Real settings arrive with later tasks. */
export default async function ConfiguracionPage() {
  const { supabase, tenantId } = await requireAdmin();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/app" className="underline">
            ← Volver al inicio
          </Link>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle data-testid="tenant-name">{tenant?.name ?? "—"}</CardTitle>
          <CardDescription>
            Aquí vivirá la configuración de tu inmobiliaria (logo, ciudad, NIT). Llega en próximas
            versiones.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
