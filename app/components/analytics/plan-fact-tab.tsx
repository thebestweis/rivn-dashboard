"use client";

import { useEffect, useRef, useState } from "react";

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

export interface PlanFactRow {
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
  isSelected?: boolean;
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
  rangeStartMonth: string;
  setRangeStartMonth: (value: string) => void;
  rangeEndMonth: string;
  setRangeEndMonth: (value: string) => void;
  onPlanChange: (
    key: "revenue" | "profit" | "expenses" | "fot",
    value: number
  ) => void;
  canEditPlan: boolean;
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

function formatMonthLongLabel(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) return value;

  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function buildMonthValue(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
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
  rangeStartMonth,
  setRangeStartMonth,
  rangeEndMonth,
  setRangeEndMonth,
  onPlanChange,
  canEditPlan,
}: PlanFactTabProps) {
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false);
  const [isRangeStartMenuOpen, setIsRangeStartMenuOpen] = useState(false);
  const [isRangeEndMenuOpen, setIsRangeEndMenuOpen] = useState(false);

  const [rangeStartPickerYear, setRangeStartPickerYear] = useState(() => {
    const [year] = rangeStartMonth.split("-");
    return Number(year);
  });

  const [rangeEndPickerYear, setRangeEndPickerYear] = useState(() => {
    const [year] = rangeEndMonth.split("-");
    return Number(year);
  });

  const rangeStartMenuRef = useRef<HTMLDivElement | null>(null);
  const rangeEndMenuRef = useRef<HTMLDivElement | null>(null);

  const [pickerYear, setPickerYear] = useState(() => {
    const [year] = selectedMonth.split("-");
    return Number(year);
  });

  const monthMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedMetricRow =
    rows.find((row) => row.key === selectedMetric) ?? rows[0];

  useEffect(() => {
    const [year] = selectedMonth.split("-");
    if (year) {
      setPickerYear(Number(year));
    }
  }, [selectedMonth]);

  useEffect(() => {
    const [year] = rangeStartMonth.split("-");
    if (year) {
      setRangeStartPickerYear(Number(year));
    }
  }, [rangeStartMonth]);

  useEffect(() => {
    const [year] = rangeEndMonth.split("-");
    if (year) {
      setRangeEndPickerYear(Number(year));
    }
  }, [rangeEndMonth]);

  useEffect(() => {
    if (canEditPlan) return;

    setIsMonthMenuOpen(false);
    setIsRangeStartMenuOpen(false);
    setIsRangeEndMenuOpen(false);
  }, [canEditPlan]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isMonthMenuOpen &&
        monthMenuRef.current &&
        !monthMenuRef.current.contains(event.target as Node)
      ) {
        setIsMonthMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMonthMenuOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isRangeStartMenuOpen &&
        rangeStartMenuRef.current &&
        !rangeStartMenuRef.current.contains(event.target as Node)
      ) {
        setIsRangeStartMenuOpen(false);
      }

      if (
        isRangeEndMenuOpen &&
        rangeEndMenuRef.current &&
        !rangeEndMenuRef.current.contains(event.target as Node)
      ) {
        setIsRangeEndMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRangeStartMenuOpen, isRangeEndMenuOpen]);

  const normalizedRangeStart =
    rangeStartMonth <= rangeEndMonth ? rangeStartMonth : rangeEndMonth;

  const normalizedRangeEnd =
    rangeStartMonth <= rangeEndMonth ? rangeEndMonth : rangeStartMonth;

  const filteredChartData = chartData.filter(
    (item) => item.month >= normalizedRangeStart && item.month <= normalizedRangeEnd
  );

  return (
    <div className="space-y-6">
      {!canEditPlan ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Режим только просмотра. Плановые значения нельзя изменять.
        </div>
      ) : null}

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <h2 className="text-2xl font-semibold text-white">
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
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[4px] bg-violet-400" />
                <span className="text-sm text-white/60">План</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-[2px] w-4 bg-emerald-400" />
                <span className="text-sm text-white/60">Факт</span>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="relative" ref={rangeStartMenuRef}>
                <div className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">
                  С месяца
                </div>

                <button
                  type="button"
                  disabled={!canEditPlan}
                  onClick={() => {
                    if (!canEditPlan) return;
                    setIsRangeStartMenuOpen((prev) => !prev);
                    setIsRangeEndMenuOpen(false);
                    setIsMonthMenuOpen(false);
                  }}
                  className="inline-flex h-[44px] min-w-[170px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-default disabled:opacity-70"
                >
                  <span>{formatMonthLongLabel(rangeStartMonth)}</span>
                  <span className="ml-3 text-white/35">
                    {canEditPlan ? (isRangeStartMenuOpen ? "−" : "+") : "•"}
                  </span>
                </button>

                {isRangeStartMenuOpen ? (
                  <div className="absolute right-0 top-[56px] z-30 w-[280px] rounded-[24px] border border-white/10 bg-[#121826] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:w-[320px]">
                    <div className="mb-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setRangeStartPickerYear((prev) => prev - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                      >
                        ←
                      </button>

                      <div className="text-sm font-semibold text-white">
                        {rangeStartPickerYear}
                      </div>

                      <button
                        type="button"
                        onClick={() => setRangeStartPickerYear((prev) => prev + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                      >
                        →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {monthNamesRu.map((monthName, index) => {
                        const value = buildMonthValue(rangeStartPickerYear, index);
                        const isActive = value === rangeStartMonth;

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setRangeStartMonth(value);
                              setIsRangeStartMenuOpen(false);
                            }}
                            className={`rounded-2xl px-3 py-3 text-left text-sm transition ${
                              isActive
                                ? "bg-violet-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)]"
                                : "bg-black/20 text-white/75 hover:bg-white/[0.05] hover:text-white"
                            }`}
                          >
                            <div className="font-medium leading-none">{monthName}</div>
                            <div className="mt-2 text-xs opacity-80">
                              {rangeStartPickerYear}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative" ref={rangeEndMenuRef}>
                <div className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">
                  По месяц
                </div>

                <button
                  type="button"
                  disabled={!canEditPlan}
                  onClick={() => {
                    if (!canEditPlan) return;
                    setIsRangeEndMenuOpen((prev) => !prev);
                    setIsRangeStartMenuOpen(false);
                    setIsMonthMenuOpen(false);
                  }}
                  className="inline-flex h-[44px] min-w-[170px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-default disabled:opacity-70"
                >
                  <span>{formatMonthLongLabel(rangeEndMonth)}</span>
                  <span className="ml-3 text-white/35">
                    {canEditPlan ? (isRangeEndMenuOpen ? "−" : "+") : "•"}
                  </span>
                </button>

                {isRangeEndMenuOpen ? (
                  <div className="absolute right-0 top-[56px] z-30 w-[280px] rounded-[24px] border border-white/10 bg-[#121826] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:w-[320px]">
                    <div className="mb-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setRangeEndPickerYear((prev) => prev - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                      >
                        ←
                      </button>

                      <div className="text-sm font-semibold text-white">
                        {rangeEndPickerYear}
                      </div>

                      <button
                        type="button"
                        onClick={() => setRangeEndPickerYear((prev) => prev + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                      >
                        →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {monthNamesRu.map((monthName, index) => {
                        const value = buildMonthValue(rangeEndPickerYear, index);
                        const isActive = value === rangeEndMonth;

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setRangeEndMonth(value);
                              setIsRangeEndMenuOpen(false);
                            }}
                            className={`rounded-2xl px-3 py-3 text-left text-sm transition ${
                              isActive
                                ? "bg-violet-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)]"
                                : "bg-black/20 text-white/75 hover:bg-white/[0.05] hover:text-white"
                            }`}
                          >
                            <div className="font-medium leading-none">{monthName}</div>
                            <div className="mt-2 text-xs opacity-80">
                              {rangeEndPickerYear}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredChartData} barGap={10} barCategoryGap="22%">
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
                  formatter={(value, name) => {
                    const labelMap: Record<string, string> = {
                      plan: "План",
                      fact: "Факт",
                    };

                    const numericValue = Number(value ?? 0);
                    const safeName = String(name ?? "");

                    return [
                      `₽${numericValue.toLocaleString("ru-RU")}`,
                      labelMap[safeName] ?? safeName,
                    ];
                  }}
                  labelFormatter={(label) => {
                    return `Период: ${String(label ?? "")}`;
                  }}
                  contentStyle={{
                    background: "#0F1524",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    color: "white",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                />

                <Bar
                  dataKey="plan"
                  name="plan"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={44}
                >
                  {filteredChartData.map((entry) => (
                    <Cell
                      key={`plan-${entry.month}`}
                      fill={
                        entry.isSelected
                          ? "rgba(167,139,250,1)"
                          : "rgba(139,92,246,0.82)"
                      }
                    />
                  ))}
                </Bar>

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Редактирование плана</div>
            <h3 className="mt-1 text-xl font-semibold text-white">
              План на {formatMonthLongLabel(selectedMonth)}
            </h3>
          </div>

          <div className="relative w-fit" ref={monthMenuRef}>
            <div className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">
              Месяц плана
            </div>

            <button
              type="button"
              disabled={!canEditPlan}
              onClick={() => {
                if (!canEditPlan) return;
                setIsMonthMenuOpen((prev) => !prev);
              }}
              className="inline-flex h-[44px] min-w-[190px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-default disabled:opacity-70"
            >
              <span>{formatMonthLongLabel(selectedMonth)}</span>
              <span className="ml-3 text-white/35">
                {canEditPlan ? (isMonthMenuOpen ? "−" : "+") : "•"}
              </span>
            </button>

            {isMonthMenuOpen ? (
              <div className="absolute right-0 top-[56px] z-30 w-[280px] rounded-[24px] border border-white/10 bg-[#121826] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:w-[320px]">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPickerYear((prev) => prev - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    ←
                  </button>

                  <div className="text-sm font-semibold text-white">
                    {pickerYear}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPickerYear((prev) => prev + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {monthNamesRu.map((monthName, index) => {
                    const value = buildMonthValue(pickerYear, index);
                    const isActive = value === selectedMonth;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setSelectedMonth(value);
                          setIsMonthMenuOpen(false);
                        }}
                        className={`rounded-2xl px-3 py-3 text-left text-sm transition ${
                          isActive
                            ? "bg-violet-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)]"
                            : "bg-black/20 text-white/75 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <div className="font-medium leading-none">{monthName}</div>
                        <div className="mt-2 text-xs opacity-80">{pickerYear}</div>
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
                  <td className="px-4 py-3 font-medium text-white">
                    {row.label}
                  </td>

                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={row.planNumber}
                      readOnly={!canEditPlan}
                      onChange={(e) =>
                        onPlanChange(row.key, Number(e.target.value) || 0)
                      }
                      className="h-[42px] w-[160px] rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none read-only:cursor-default read-only:opacity-70"
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