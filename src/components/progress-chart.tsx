"use client";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Task } from "@/domain/types";
import { localDay } from "@/lib/utils";
export function ProgressChart({ tasks }: { tasks: Task[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const day = localDay(d);
    return {
      day: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      total: tasks.filter((t) => t.completed_at && localDay(new Date(t.completed_at)) === day)
        .length,
    };
  });
  return (
    <div
      className="h-32 w-full"
      role="img"
      aria-label={`Tarefas concluídas nos últimos sete dias: ${days.map((d) => `${d.day}: ${d.total}`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={days} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
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
            name="Concluídas"
            fill="var(--primary)"
            radius={[3, 3, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
