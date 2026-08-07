"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { getMockMonthlyFinancials } from "@/server/services/dashboard/mock-data";
import type { MonthlyFinancials } from "@/server/services/dashboard/types";

const REFRESH_MS = 5000;

/**
 * Tarjetas de ganancias/pérdidas con refresco "en vivo". Al ser datos de ejemplo, el movimiento se
 * simula en el cliente incrementando la semilla del generador determinista: no hay polling al
 * servidor ni websockets, que serían infraestructura desperdiciada sobre cifras inventadas (y
 * habría que desmontarla al llegar los datos reales de T2.1).
 */
export default function FinancialCards({ initialData }: { initialData: MonthlyFinancials }) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let seed = 1;
    const timer = setInterval(() => {
      seed += 1;
      setData(getMockMonthlyFinancials(seed));
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const isPositive = data.net >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ganancias netas del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-[var(--chart-3)]">{formatCOP(data.netGains)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pérdidas netas del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-[var(--chart-5)]">{formatCOP(data.netLosses)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Neto del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-3xl font-semibold ${
              isPositive ? "text-[var(--chart-3)]" : "text-[var(--chart-5)]"
            }`}
          >
            {formatCOP(data.net)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
