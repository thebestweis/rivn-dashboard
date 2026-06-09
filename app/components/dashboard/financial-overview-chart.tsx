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
    <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
      <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#99D32A]/50 via-[#70855C]/25 to-transparent" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AEAFB2]/70">Финансовая динамика</div>
            <h2 className="mt-1 text-lg font-semibold text-[#F4F5F1]">Выручка и прибыль</h2>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[#99D32A]/25 bg-[#99D32A]/10 px-3 py-1 text-[#B7EA55]">
              Выручка
            </span>
            <span className="rounded-full border border-[#70855C]/35 bg-[#70855C]/12 px-3 py-1 text-[#CECED0]">
              Прибыль
            </span>
          </div>
        </div>

        <div className="mt-4 h-[220px] min-w-0 sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#99D32A" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#99D32A" stopOpacity={0.02} />
                </linearGradient>

                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#70855C" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#70855C" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="rgba(206,206,208,0.07)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#AEAFB2", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#AEAFB2", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={52}
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
                  background: "#11130F",
                  border: "1px solid #2D342A",
                  borderRadius: "16px",
                  color: "white",
                }}
                labelStyle={{ color: "#AEAFB2" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#99D32A"
                strokeWidth={3}
                fill="url(#revenueGradient)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#70855C"
                strokeWidth={3}
                fill="url(#profitGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#70855C]/45 via-[#99D32A]/20 to-transparent" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AEAFB2]/70">Структура затрат</div>
            <h2 className="mt-1 text-lg font-semibold text-[#F4F5F1]">Расходы и ФОТ</h2>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[#E87979]/25 bg-[#E87979]/10 px-3 py-1 text-[#F39B9B]">
              Расходы
            </span>
            <span className="rounded-full border border-[#D8C45E]/25 bg-[#D8C45E]/10 px-3 py-1 text-[#E3D47C]">
              ФОТ
            </span>
          </div>
        </div>

        <div className="mt-4 h-[220px] min-w-0 sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={10}>
              <CartesianGrid stroke="rgba(206,206,208,0.07)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#AEAFB2", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#AEAFB2", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={52}
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
                  background: "#11130F",
                  border: "1px solid #2D342A",
                  borderRadius: "16px",
                  color: "white",
                }}
                labelStyle={{ color: "#AEAFB2" }}
              />
              <Bar
                dataKey="expenses"
                fill="#E87979"
                radius={[10, 10, 0, 0]}
              />
              <Bar
                dataKey="fot"
                fill="#D8C45E"
                radius={[10, 10, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
