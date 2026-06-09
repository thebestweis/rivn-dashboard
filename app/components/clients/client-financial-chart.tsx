"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SlidersHorizontal } from "lucide-react";

export type ClientMetricKey =
  | "revenue"
  | "profit"
  | "expenses"
  | "fot"
  | "tax"
  | "invoice";

export type ClientMetricSeries = Record<ClientMetricKey, number>;

interface ClientFinancialChartProps {
  data: Array<
    {
      label: string;
    } & ClientMetricSeries
  >;
  totals: ClientMetricSeries;
}

const metricOptions: Array<{
  key: ClientMetricKey;
  label: string;
  color: string;
}> = [
  { key: "revenue", label: "Выручка", color: "#00f5a8" },
  { key: "profit", label: "Прибыль", color: "#7b61ff" },
  { key: "expenses", label: "Расходы", color: "#f2b85b" },
  { key: "fot", label: "ФОТ", color: "#67d5ff" },
  { key: "tax", label: "Налог", color: "#ff7a90" },
  { key: "invoice", label: "Счёт", color: "#ffffff" },
];

function formatCompactRub(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function ClientChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    color?: string;
    value?: number;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#07111f]/95 px-4 py-3 text-sm text-white shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <div className="mb-2 text-xs text-white/45">{label}</div>
      <div className="space-y-1.5">
        {payload.map((item) => {
          const option = metricOptions.find(
            (metric) => metric.key === item.dataKey
          );

          return (
            <div
              key={String(item.dataKey)}
              className="flex min-w-[150px] items-center justify-between gap-5"
            >
              <span className="flex items-center gap-2 text-white/68">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {option?.label ?? item.dataKey}
              </span>
              <span className="font-semibold text-white">
                {formatCompactRub(Number(item.value ?? 0))} ₽
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClientFinancialChart({ data, totals }: ClientFinancialChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<ClientMetricKey[]>([
    "revenue",
    "profit",
  ]);

  const visibleOptions = useMemo(() => {
    return metricOptions.filter((metric) => activeMetrics.includes(metric.key));
  }, [activeMetrics]);

  function toggleMetric(metric: ClientMetricKey) {
    setActiveMetrics((current) => {
      if (current.includes(metric)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== metric);
      }

      return [...current, metric];
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
      <div className="rivn-card rivn-card-interactive p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/38">
              Динамика клиента
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">
              Выбранные показатели
            </h2>
          </div>

          <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
            {metricOptions.map((metric) => {
              const isActive = activeMetrics.includes(metric.key);

              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => toggleMetric(metric.key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition duration-300 active:scale-95 ${
                    isActive
                      ? "bg-[#00f5a8] text-[#06101d] shadow-[0_16px_38px_rgba(0,245,168,0.2)]"
                      : "border border-white/10 bg-white/[0.055] text-white/62 hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-white"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor:
                            metric.key === "revenue" ? "#00f5a8" : metric.color,
                          color:
                            metric.key === "invoice" ? "#06101d" : undefined,
                        }
                      : undefined
                  }
                >
                  {metric.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 18, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={58}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
              />
              <Tooltip
                cursor={{
                  stroke: "rgba(255,255,255,0.12)",
                  strokeWidth: 1,
                }}
                content={<ClientChartTooltip />}
              />
              {visibleOptions.map((metric) => (
                <Line
                  key={metric.key}
                  type="linear"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: metric.color,
                    stroke: "#07111f",
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 7,
                    fill: metric.color,
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rivn-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/38">
              Экономика
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">
              Срез клиента
            </h2>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.08] text-white/72">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {metricOptions.map((metric) => (
            <div
              key={metric.key}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.045] px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm text-white/62">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
                {metric.label}
              </span>
              <span className="text-right text-sm font-semibold text-white">
                {formatCompactRub(totals[metric.key])} ₽
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
