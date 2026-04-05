"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface ExpenseBreakdownItem {
  name: string;
  value: number;
}

interface ExpenseBreakdownDonutProps {
  data: ExpenseBreakdownItem[];
}

const COLORS = ["#7B61FF", "#F59E0B", "#0EA5E9", "#F43F5E", "#10B981"];

export function ExpenseBreakdownDonut({
  data,
}: ExpenseBreakdownDonutProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/50">Expense breakdown</div>
          <h2 className="mt-1 text-xl font-semibold">Структура расходов</h2>
        </div>

        <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-300">
          Categories
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[220px_1fr] xl:items-center">
        <div className="relative h-[220px] w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={92}
                stroke="none"
                paddingAngle={3}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0F1524",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  color: "white",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                formatter={(value: number) =>
                  `₽${value.toLocaleString("ru-RU")}`
                }
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-semibold tracking-tight">
              ₽{total.toLocaleString("ru-RU")}
            </div>
            <div className="mt-1 text-sm text-white/45">total expenses</div>
          </div>
        </div>

        <div className="space-y-3">
          {data.map((item, index) => {
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-white/80">{item.name}</span>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    ₽{item.value.toLocaleString("ru-RU")}
                  </div>
                  <div className="text-xs text-white/45">{percent}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}