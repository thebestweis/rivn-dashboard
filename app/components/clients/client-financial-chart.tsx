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

interface ClientFinancialChartProps {
  paymentsData: {
    label: string;
    amount: number;
  }[];
  expensesData: {
    label: string;
    amount: number;
  }[];
}

export function ClientFinancialChart({
  paymentsData,
  expensesData,
}: ClientFinancialChartProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/50">Динамика оплат</div>
            <h2 className="mt-1 text-xl font-semibold">Поступления клиента</h2>
          </div>

          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
            Payments
          </span>
        </div>

        <div className="mt-6 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={paymentsData}>
              <defs>
                <linearGradient id="clientPaymentsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.32} />
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
                width={60}
              />
              <Tooltip
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
                dataKey="amount"
                stroke="#10B981"
                strokeWidth={3}
                fill="url(#clientPaymentsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/50">Динамика расходов</div>
            <h2 className="mt-1 text-xl font-semibold">Затраты по клиенту</h2>
          </div>

          <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-300">
            Expenses
          </span>
        </div>

        <div className="mt-6 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expensesData}>
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
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: "#0F1524",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "16px",
                  color: "white",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Bar dataKey="amount" fill="#F43F5E" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}