"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, type FinanceData } from "@/domain/finances";

export function FinanceCharts({ data, month }: { data: FinanceData; month: string }) {
  const [year, number] = month.split("-").map(Number);
  const days = Array.from({ length: new Date(year, number, 0).getDate() }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return { day, total: data.days.find((d) => d.day === `${month}-${day}`)?.total_cents || 0 };
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <section className="panel min-w-0 p-5">
        <h2 className="text-sm font-semibold">Gastos ao longo do mês</h2>
        <p className="mb-5 mt-1 text-xs text-muted-foreground">
          Cada dia, um pouco mais de clareza.
        </p>
        <div
          className="h-56"
          role="img"
          aria-label={`Gastos por dia: ${
            days
              .filter((d) => d.total)
              .map((d) => `dia ${d.day}: ${money(d.total)}`)
              .join("; ") || "Nenhum gasto"
          }`}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={days} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                interval={4}
              />
              <YAxis
                width={52}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(v) => String(Number(v) / 100)}
              />
              <Tooltip
                formatter={(value) => money(Number(value))}
                labelFormatter={(label) => `Dia ${label}`}
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="total"
                name="Gastos"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Valores em reais (R$).</p>
      </section>
      <section className="panel p-5">
        <h2 className="mb-5 text-sm font-semibold">Para onde foi seu dinheiro</h2>
        <div className="space-y-4">
          {data.categories.map((c) => (
            <div key={c.category}>
              <div className="mb-2 flex justify-between gap-3 text-xs">
                <span>{c.category}</span>
                <span className="font-medium tabular-nums">{money(c.total_cents)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${data.month_cents ? (c.total_cents / data.month_cents) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {!data.categories.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Seus gastos por categoria aparecerão aqui.
          </p>
        )}
      </section>
    </div>
  );
}
