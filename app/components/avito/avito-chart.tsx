"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: any[];
};

function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString("ru-RU")} ₽`;
}

export function AvitoChart({ data }: Props) {
  return (
    <div className="h-[320px] w-full rounded-[24px] border border-white/10 bg-[#0F1524] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />

          <XAxis
            dataKey="period_start"
            stroke="rgba(255,255,255,0.35)"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
          />

          <YAxis
            stroke="rgba(255,255,255,0.35)"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
          />

          <Tooltip
            contentStyle={{
              background: "#121826",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              color: "#fff",
            }}
            formatter={(value, name) => {
  const metricName = String(name || "");

  if (metricName === "expenses") {
    return [formatMoney(Number(value)), "Расходы"];
  }

  if (metricName === "views") {
    return [value, "Просмотры"];
  }

  if (metricName === "contacts") {
    return [value, "Контакты"];
  }

  return [value, metricName];
}}
          />

          <Line
            type="monotone"
            dataKey="views"
            name="Просмотры"
            stroke="#34d399"
            strokeWidth={3}
            dot={{ r: 4 }}
          />

          <Line
            type="monotone"
            dataKey="contacts"
            name="Контакты"
            stroke="#60a5fa"
            strokeWidth={3}
            dot={{ r: 4 }}
          />

          <Line
            type="monotone"
            dataKey="expenses"
            name="Расходы"
            stroke="#fbbf24"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}