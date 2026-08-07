import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/supabase/require-user";
import { getMockMonthlyFinancials } from "@/server/services/dashboard/mock-data";
import FinancialCards from "./_components/financial-cards";
import FinancialChart from "./_components/financial-chart";

export default async function DashboardPage() {
  await requireUser();
  const data = getMockMonthlyFinancials(1);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Badge variant="secondary">Datos de demostración</Badge>
      </header>
      <p className="text-sm text-muted-foreground">
        Las cifras de esta página son de ejemplo y no reflejan negocios reales. Se conectarán a
        datos reales cuando exista el módulo de negocios.
      </p>
      <FinancialCards initialData={data} />
      <FinancialChart series={data.series} />
    </main>
  );
}
