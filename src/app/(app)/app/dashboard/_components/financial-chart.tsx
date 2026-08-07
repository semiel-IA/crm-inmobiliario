"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DailyFinancials } from "@/server/services/dashboard/types";

const chartConfig = {
  gains: { label: "Ganancias", color: "var(--chart-3)" },
  losses: { label: "Pérdidas", color: "var(--chart-5)" },
};

/** Evolución diaria de los últimos 30 días. Eje Y en millones para no saturar de ceros. */
export default function FinancialChart({ series }: { series: DailyFinancials[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución de los últimos 30 días</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={series} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => value.slice(8)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="gains"
              type="monotone"
              stroke="var(--color-gains)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="losses"
              type="monotone"
              stroke="var(--color-losses)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
