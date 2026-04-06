"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface FinancialOverviewChartProps {
  data: {
    label: string;
    revenue: number;
    profit: number;
    expenses: number;
    fot: number;
  }[];
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

export function FinancialOverviewChart({
  data,
}: FinancialOverviewChartProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/50">Финансовая динамика</div>
            <h2 className="mt-1 text-xl font-semibold">Выручка и прибыль</h2>
          </div>

          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-violet-300">
              Выручка
            </span>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">
              Прибыль
            </span>
          </div>
        </div>

        <div className="mt-6 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7B61FF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7B61FF" stopOpacity={0.02} />
                </linearGradient>

                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={72}
                tickFormatter={(value) => formatCompactNumber(Number(value))}
              />
              <Tooltip
                formatter={(value, name) => {
  const labelMap: Record<string, string> = {
    revenue: "Выручка",
    profit: "Прибыль",
  };

  return [formatCurrency(Number(value ?? 0)), labelMap[String(name)] ?? String(name)];
}}

                labelFormatter={(label) => `Период: ${label}`}
                contentStyle={{
                  background: "#0F1524",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  color: "white",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#7B61FF"
                strokeWidth={3}
                fill="url(#revenueGradient)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#10B981"
                strokeWidth={3}
                fill="url(#profitGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/50">Структура затрат</div>
            <h2 className="mt-1 text-xl font-semibold">Расходы и ФОТ</h2>
          </div>

          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-rose-300">
              Расходы
            </span>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-300">
              ФОТ
            </span>
          </div>
        </div>

        <div className="mt-6 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={10}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={72}
                tickFormatter={(value) => formatCompactNumber(Number(value))}
              />
              <Tooltip
                formatter={(value, name) => {
  const labelMap: Record<string, string> = {
    expenses: "Расходы",
    fot: "ФОТ",
  };

  return [formatCurrency(Number(value ?? 0)), labelMap[String(name)] ?? String(name)];
}}
                labelFormatter={(label) => `Период: ${label}`}
                contentStyle={{
                  background: "#0F1524",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  color: "white",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Bar
                dataKey="expenses"
                fill="#F43F5E"
                radius={[10, 10, 0, 0]}
              />
              <Bar
                dataKey="fot"
                fill="#F59E0B"
                radius={[10, 10, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}