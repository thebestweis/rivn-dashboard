"use client";

import { useMemo, useState } from "react";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { formatRub } from "../../lib/storage";

interface PlanFactRow {
  key: "revenue" | "profit" | "expenses" | "fot";
  label: string;
  plan: string;
  fact: string;
  delta: string;
  progressLabel: string;
  planNumber: number;
  factNumber: number;
  deltaNumber: number;
  progress: number;
}

interface PlanFactChartRow {
  month: string;
  plan: number;
  fact: number;
}

interface PlanFactTabProps {
  rows: PlanFactRow[];
  chartData: PlanFactChartRow[];
  selectedMetric: "revenue" | "profit" | "expenses" | "fot";
  setSelectedMetric: (
    value: "revenue" | "profit" | "expenses" | "fot"
  ) => void;
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  onPlanChange: (
    key: "revenue" | "profit" | "expenses" | "fot",
    value: number
  ) => void;
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) return value;

  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("ru-RU", {
    month: "short",
    year: "2-digit",
  });
}

const monthNamesRu = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function formatMonthButtonLabel(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) return value;

  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;

  return `${monthNamesRu[monthIndex]} ${year}`;
}

function buildMonthOptions(baseValue: string, count = 12) {
  const [year, month] = baseValue.split("-");
  const startDate = new Date(Number(year), Number(month) - 1, 1);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");

    return {
      value: `${y}-${m}`,
      label: `${monthNamesRu[date.getMonth()]} ${y}`,
    };
  });
}

const metricOptions = [
  { key: "revenue", label: "Выручка" },
  { key: "profit", label: "Прибыль" },
  { key: "expenses", label: "Расходы" },
  { key: "fot", label: "ФОТ" },
] as const;

function getMetricLabel(
  metric: "revenue" | "profit" | "expenses" | "fot"
) {
  const map = {
    revenue: "выручке",
    profit: "прибыли",
    expenses: "расходам",
    fot: "ФОТ",
  };

  return map[metric];
}

export function PlanFactTab({
  rows,
  chartData,
  selectedMetric,
  setSelectedMetric,
  selectedMonth,
  setSelectedMonth,
  onPlanChange,
}: PlanFactTabProps) {

  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);

    const selectedMetricRow =
    rows.find((row) => row.key === selectedMetric) ?? rows[0];

  const monthOptions = useMemo(() => {
    return buildMonthOptions(selectedMonth, 12);
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Plan / Fact</div>
<h2 className="mt-1 text-2xl font-semibold text-white">
  План и факт по {getMetricLabel(selectedMetric)}
</h2>
<div className="mt-2 text-sm text-white/50">
  Сравнивай плановые показатели с фактическими значениями по месяцам и быстро
  оценивай выполнение.
</div>

        
        <div className="mt-5 flex flex-wrap gap-2">
          {metricOptions.map((option) => {
            const isActive = selectedMetric === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedMetric(option.key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  isActive
                    ? "bg-violet-500 text-white shadow-[0_0_24px_rgba(139,92,246,0.35)]"
                    : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-[4px] bg-violet-400" />
              <span className="text-sm text-white/60">План</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-[2px] w-4 bg-emerald-400" />
              <span className="text-sm text-white/60">Факт</span>
            </div>
          </div>

          <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} barGap={10} barCategoryGap="22%">
                            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                stroke="rgba(255,255,255,0.35)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
              />
                            <YAxis
                stroke="rgba(255,255,255,0.22)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                tickFormatter={(value) => `${Math.round(value / 1000)}k`}
              />
              <Tooltip
  formatter={(value: number, name: string) => {
    const labelMap: Record<string, string> = {
      plan: "План",
      fact: "Факт",
    };

    return [formatRub(Number(value)), labelMap[name] ?? name];
  }}
  labelFormatter={(label: string) => {
    const [year, month] = label.split("-");
    if (!year || !month) return label;

    const date = new Date(Number(year), Number(month) - 1, 1);

    return date.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
  }}
  contentStyle={{
    background: "#0F172A",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    color: "#fff",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    padding: "10px 12px",
  }}
  labelStyle={{ color: "#fff", fontWeight: 600 }}
  itemStyle={{ color: "#fff" }}
/>
                            <Bar
                dataKey="plan"
                name="plan"
                radius={[10, 10, 0, 0]}
                fill="rgba(139,92,246,0.82)"
                maxBarSize={44}
              />
                            <Line
                type="monotone"
                dataKey="fact"
                name="fact"
                stroke="rgba(16,185,129,0.95)"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#0B0F1A" }}
                activeDot={{ r: 6 }}
              />
                        </ComposedChart>
                    </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="rounded-[20px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.24)]"
          >
            <div className="text-sm text-white/50">{row.label}</div>
            <div className="mt-4 grid gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                  План
                </div>
                <div className="mt-1 text-lg font-semibold text-violet-300">
                  {row.plan}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                  Факт
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {row.fact}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                  Выполнение
                </div>
                <div className="mt-1 text-lg font-semibold text-emerald-300">
                  {row.progressLabel}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="flex items-end justify-between gap-4">
  <div>
    <div className="text-sm text-white/50">Редактирование плана</div>
    <h3 className="mt-1 text-xl font-semibold text-white">
      План на {formatMonthLabel(selectedMonth)}
    </h3>
  </div>

  <div className="relative w-fit">
  <div className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">
    Месяц плана
  </div>

  <button
    type="button"
    onClick={() => setIsMonthMenuOpen((prev) => !prev)}
    className="inline-flex h-[40px] items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.05]"
  >
    {formatMonthButtonLabel(selectedMonth)}
  </button>

  {isMonthMenuOpen ? (
    <div className="absolute left-0 top-[52px] z-30 w-[220px] rounded-2xl border border-white/10 bg-[#121826] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
      <div className="mb-2 px-2 pt-1 text-xs uppercase tracking-[0.12em] text-white/35">
        Выбери месяц
      </div>

      <div className="grid grid-cols-2 gap-1">
        {monthOptions.map((option) => {
          const isActive = option.value === selectedMonth;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSelectedMonth(option.value);
                setIsMonthMenuOpen(false);
              }}
              className={`rounded-xl px-3 py-2 text-left text-sm transition ${
                isActive
                  ? "bg-violet-500 text-white"
                  : "text-white/70 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  ) : null}
</div>
</div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Показатель</th>
                <th className="px-4 py-3 font-medium">План</th>
                <th className="px-4 py-3 font-medium">Факт</th>
                <th className="px-4 py-3 font-medium">Отклонение</th>
                <th className="px-4 py-3 font-medium">Выполнение</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-medium text-white">{row.label}</td>

                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.planNumber}
                      onChange={(e) =>
                        onPlanChange(row.key, Number(e.target.value) || 0)
                      }
                      className="h-[42px] w-[160px] rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none"
                    />
                  </td>

                  <td className="px-4 py-3 text-white/80">{row.fact}</td>

                  <td
                    className={`px-4 py-3 font-medium ${
                      row.deltaNumber >= 0 ? "text-emerald-300" : "text-amber-300"
                    }`}
                  >
                    {row.delta}
                  </td>

                  <td className="px-4 py-3 font-medium text-white">
                    {row.progressLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}