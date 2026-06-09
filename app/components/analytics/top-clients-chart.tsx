"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TopClientsChartProps {
  data: {
    name: string;
    revenue: number;
    profit: number;
  }[];
}

export function TopClientsChart({ data }: TopClientsChartProps) {
  return (
    <div className="rivn-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mt-1 text-xl font-semibold">Выручка и прибыль по клиентам</h2>
        </div>

        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-[#7B61FF]/15 px-3 py-1 text-[#b8adff]">
            Выручка
          </span>
          <span className="rounded-full bg-[#00f5a8]/15 px-3 py-1 text-[#43ffc2]">
            Прибыль
          </span>
        </div>
      </div>

      <div className="mt-6 h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barGap={12}>
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              type="number"
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              formatter={(value, name) => [
                value,
                name === "revenue" ? "Выручка" : name === "profit" ? "Прибыль" : name,
              ]}
              contentStyle={{
                background: "#0F1524",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                color: "white",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.6)" }}
            />
            <Bar dataKey="revenue" fill="#7B61FF" radius={[0, 10, 10, 0]} />
            <Bar dataKey="profit" fill="#10B981" radius={[0, 10, 10, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
