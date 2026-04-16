import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { FinancialAnalyticsChart } from "./financial-analytics-chart";
import { ExpenseBreakdownDonut } from "./expense-breakdown-donut";
import { parseRubAmount, formatRub } from "../../lib/storage";

import { ensureSystemSettings } from "../../lib/supabase/system-settings";

interface FinancialAnalyticsTabProps {
  expenses: any[];
  payments: any[];
    stableRevenue: number;
  payrollPayouts: any[];
    extraPayments: any[];
    growthBasePeriod: 1 | 3;
  setGrowthBasePeriod: Dispatch<SetStateAction<1 | 3>>;
  revenueDynamics: {
    month: string;
    revenue: number;
    profit: number;
  }[];
  forecastMetrics: {
    avgRevenue: number;
    avgProfit: number;
    realisticRevenue: number;
    realisticProfit: number;
    aggressiveRevenue: number;
    aggressiveProfit: number;
  };
  targetProfit: number;
  setTargetProfit: Dispatch<SetStateAction<number>>;
  targetMetrics: {
    averageRevenuePerClient: number;
    currentMargin: number;
    requiredRevenue: number;
    requiredClients: number;
  };
  growthScenario: {
    clientsDelta: number;
    avgCheckDelta: number;
    expenseDelta: number;
  };
  setGrowthScenario: Dispatch<
    SetStateAction<{
      clientsDelta: number;
      avgCheckDelta: number;
      expenseDelta: number;
    }>
  >;
  growthMetrics: {
    newClients: number;
    newAvgCheck: number;
    newRevenue: number;
    newProfit: number;
  };
  growthInsights: {
    impactClients: number;
    impactCheck: number;
    impactExpenses: number;
  };
  growthPlan: {
    profitGap: number;
    requiredExtraRevenue: number;
    requiredExtraClients: number;
    requiredCheckGrowthPercent: number;
  };
  ceoSummary: {
    mainLever: string;
    mainLeverValue: number;
    firstAction: string;
  };
}

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
};

function StatCard({
  label,
  value,
  hint,
  valueClassName = "text-white",
}: StatCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm text-white/50">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${valueClassName}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-white/50">{hint}</div> : null}
    </div>
  );
}

type SectionCardProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

type ExtraPaymentRow = {
  id: string;
  employee: string;
  employeeId?: string | null;
  reason: string;
  date: string;
  amount: string;
};

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) return value;

  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function getExpenseDate(expense: any) {
  return (
    expense.date ||
    expense.expense_date ||
    expense.payment_date ||
    expense.created_at ||
    null
  );
}

function normalizeDateToMonthKey(value: string) {
  if (!value) return "";

  if (value.includes("-")) {
    return value.slice(0, 7);
  }

  if (value.includes(".")) {
    const parts = value.split(".");

    if (parts.length === 3) {
      const [day, month, year] = parts;
      if (!day || !month || !year) return "";
      return `${year}-${month.padStart(2, "0")}`;
    }

    if (parts.length === 2) {
      const [, month] = parts;
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${month.padStart(2, "0")}`;
    }
  }

  return "";
}

function toSupabaseLikeDate(value: string) {
  if (!value) return "";

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return value;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return value;
}

function normalizePayrollPayoutMonth(value: string) {
  if (!value) return "";

  if (value.includes("-")) {
    return value.slice(0, 7);
  }

  const match = value.match(/^(\d{2})\.(\d{2})$/);
  if (match) {
    const [, , month] = match;
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${month}`;
  }

  const fullMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (fullMatch) {
    const [, , month, year] = fullMatch;
    return `${year}-${month}`;
  }

  return "";
}

function getMonthsForPeriod(
  period: "current_month" | "last_3_months" | "last_6_months" | "all_time"
) {
  if (period === "all_time") return null;

  const now = new Date();
  const monthsCount =
    period === "current_month" ? 1 : period === "last_3_months" ? 3 : 6;

  const result: string[] = [];

  for (let i = 0; i < monthsCount; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return result;
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

function buildMonthValue(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function SectionCard({ eyebrow, title, children }: SectionCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">{eyebrow}</div>
      <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}
export function FinancialAnalyticsTab({
  expenses,
  payments,
  payrollPayouts,
  extraPayments = [],
  stableRevenue,
  revenueDynamics,
  forecastMetrics,
  targetProfit,
  setTargetProfit,
  targetMetrics,
  growthScenario,
  setGrowthScenario,
  growthBasePeriod,
  setGrowthBasePeriod,
  growthMetrics,
  growthInsights,
  growthPlan,
  ceoSummary,
}: FinancialAnalyticsTabProps) {
  const [period, setPeriod] = useState<
    "current_month" | "last_3_months" | "last_6_months" | "all_time"
  >("current_month");

  const [expensePeriod, setExpensePeriod] = useState<"month" | "year">("month");

  const activePeriodMonths = useMemo(() => {
  return getMonthsForPeriod(period);
}, [period]);

const normalizedExpenses = useMemo(() => {
  return expenses
    .map((expense) => {
      const rawDate = getExpenseDate(expense);
      const monthKey = rawDate ? normalizeDateToMonthKey(rawDate) : "";
      const amount = parseRubAmount(String(expense.amount ?? ""));

      return {
        ...expense,
        rawDate,
        monthKey,
        amountNumber: amount,
      };
    })
    .filter((expense) => Boolean(expense.monthKey));
}, [expenses]);

  const expenseMonths = Array.from(
  new Set(
    normalizedExpenses
      .map((expense) => expense.monthKey)
      .filter((value): value is string => Boolean(value))
  )
).sort((a, b) => a.localeCompare(b));

const latestExpenseMonth: string =
  expenseMonths.length > 0
    ? expenseMonths[expenseMonths.length - 1]
    : new Date().toISOString().slice(0, 7);

const [expenseSelectedMonth, setExpenseSelectedMonth] =
  useState<string>(latestExpenseMonth);
  
  const chartMonths = useMemo(() => {
  return revenueDynamics
    .map((item) => item.month)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}, [revenueDynamics]);

const fallbackChartMonth =
  chartMonths.length > 0
    ? chartMonths[chartMonths.length - 1]
    : new Date().toISOString().slice(0, 7);

const [chartRangeStartMonth, setChartRangeStartMonth] = useState<string>(
  chartMonths.length > 0
    ? chartMonths[Math.max(0, chartMonths.length - 6)]
    : fallbackChartMonth
);

const [chartRangeEndMonth, setChartRangeEndMonth] =
  useState<string>(fallbackChartMonth);

const [isChartRangeStartMenuOpen, setIsChartRangeStartMenuOpen] =
  useState(false);
const [isChartRangeEndMenuOpen, setIsChartRangeEndMenuOpen] =
  useState(false);

const [chartRangeStartPickerYear, setChartRangeStartPickerYear] = useState(() => {
  const [year] = fallbackChartMonth.split("-");
  return Number(year);
});

const [chartRangeEndPickerYear, setChartRangeEndPickerYear] = useState(() => {
  const [year] = fallbackChartMonth.split("-");
  return Number(year);
});

const chartRangeStartMenuRef = useRef<HTMLDivElement | null>(null);
const chartRangeEndMenuRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  if (chartMonths.length === 0) return;

  setChartRangeEndMonth((prev) =>
    chartMonths.includes(prev) ? prev : chartMonths[chartMonths.length - 1]
  );

  setChartRangeStartMonth((prev) =>
    chartMonths.includes(prev)
      ? prev
      : chartMonths[Math.max(0, chartMonths.length - 6)]
  );
}, [chartMonths]);

useEffect(() => {
  const [year] = chartRangeStartMonth.split("-");
  if (year) {
    setChartRangeStartPickerYear(Number(year));
  }
}, [chartRangeStartMonth]);

useEffect(() => {
  const [year] = chartRangeEndMonth.split("-");
  if (year) {
    setChartRangeEndPickerYear(Number(year));
  }
}, [chartRangeEndMonth]);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      isChartRangeStartMenuOpen &&
      chartRangeStartMenuRef.current &&
      !chartRangeStartMenuRef.current.contains(event.target as Node)
    ) {
      setIsChartRangeStartMenuOpen(false);
    }

    if (
      isChartRangeEndMenuOpen &&
      chartRangeEndMenuRef.current &&
      !chartRangeEndMenuRef.current.contains(event.target as Node)
    ) {
      setIsChartRangeEndMenuOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [isChartRangeStartMenuOpen, isChartRangeEndMenuOpen]);

const normalizedChartRangeStart =
  chartRangeStartMonth <= chartRangeEndMonth
    ? chartRangeStartMonth
    : chartRangeEndMonth;

const normalizedChartRangeEnd =
  chartRangeStartMonth <= chartRangeEndMonth
    ? chartRangeEndMonth
    : chartRangeStartMonth;

const filteredRevenueDynamics = revenueDynamics.filter(
  (item) =>
    item.month >= normalizedChartRangeStart &&
    item.month <= normalizedChartRangeEnd
);

const filteredFinancialData = useMemo(() => {
  const months: string[] = [];

  const cursor = new Date(
    Number(normalizedChartRangeStart.split("-")[0]),
    Number(normalizedChartRangeStart.split("-")[1]) - 1,
    1
  );

  const end = new Date(
    Number(normalizedChartRangeEnd.split("-")[0]),
    Number(normalizedChartRangeEnd.split("-")[1]) - 1,
    1
  );

  while (cursor <= end) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months.map((month) => {
    const expensesSum = normalizedExpenses
      .filter((item) => item.monthKey === month)
      .reduce((sum, item) => sum + item.amountNumber, 0);

    const safePayrollPayouts = Array.isArray(payrollPayouts) ? payrollPayouts : [];

const payoutsFot = safePayrollPayouts
  .filter((item) => item.status === "paid")
  .filter((item) => normalizePayrollPayoutMonth(item.payoutDate) === month)
  .reduce(
    (sum, item) => sum + parseRubAmount(String(item.amount ?? "")),
    0
  );

    const safeExtraPayments = Array.isArray(extraPayments) ? extraPayments : [];

const extraFot = safeExtraPayments
  .filter((item) => toSupabaseLikeDate(item.date).slice(0, 7) === month)
  .reduce(
    (sum, item) => sum + parseRubAmount(String(item.amount ?? "")),
    0
  );

    const revenueMonth = revenueDynamics.find((item) => item.month === month);

    return {
      period: month,
      revenue: revenueMonth?.revenue ?? 0,
      profit: revenueMonth?.profit ?? 0,
      expenses: expensesSum,
      fot: payoutsFot + extraFot,
    };
  });
}, [
  normalizedChartRangeStart,
  normalizedChartRangeEnd,
  normalizedExpenses,
  payrollPayouts,
  extraPayments,
  revenueDynamics,
]);

  const totalRevenue = payments
  .filter((item) => {
    if (period === "all_time") return true;
    if (!item.paidAt) return false;

    const monthKey = normalizeDateToMonthKey(item.paidAt);
    return activePeriodMonths?.includes(monthKey);
  })
  .reduce((sum, item) => sum + parseRubAmount(item.amount), 0);

  const totalExpenses = normalizedExpenses
  .filter((item) => {
    if (period === "all_time") return true;
    return activePeriodMonths?.includes(item.monthKey);
  })
  .reduce((sum, item) => sum + item.amountNumber, 0);

    const totalFot = (() => {
    const safePayrollPayouts = Array.isArray(payrollPayouts) ? payrollPayouts : [];
    const safeExtraPayments = Array.isArray(extraPayments) ? extraPayments : [];

    const payoutsSum = safePayrollPayouts
      .filter((item) => item.status === "paid")
      .filter((item) => {
        if (period === "all_time") return true;
        if (!item.payoutDate) return false;

        const monthKey = normalizePayrollPayoutMonth(item.payoutDate);
        return activePeriodMonths?.includes(monthKey);
      })
      .reduce((sum, item) => sum + parseRubAmount(String(item.amount ?? "")), 0);

    const extraSum = safeExtraPayments
      .filter((item) => {
        if (period === "all_time") return true;
        if (!item.date) return false;

        const monthKey = toSupabaseLikeDate(item.date).slice(0, 7);
        return activePeriodMonths?.includes(monthKey);
      })
      .reduce((sum, item) => sum + parseRubAmount(String(item.amount ?? "")), 0);

    return payoutsSum + extraSum;
  })();

  const [systemSettings, setSystemSettings] = useState<{
  tax_rate: number;
} | null>(null);

useEffect(() => {
  async function loadSettings() {
    const settings = await ensureSystemSettings();
    setSystemSettings(settings);
  }

  loadSettings();
}, []);

const totalTax = Math.round(
  totalRevenue * ((systemSettings?.tax_rate ?? 7) / 100)
);

  const totalProfit = totalRevenue - totalExpenses - totalFot - totalTax;

  const [selectedExpenseYear, selectedExpenseMonth] = expenseSelectedMonth.split("-");

const filteredExpenses = normalizedExpenses.filter((expense) => {
  const [expenseYear, expenseMonth] = expense.monthKey.split("-");

  if (!expenseYear || !expenseMonth) {
    return false;
  }

  if (expensePeriod === "month") {
    return (
      expenseYear === selectedExpenseYear &&
      expenseMonth === selectedExpenseMonth
    );
  }

  return expenseYear === selectedExpenseYear;
});

const grouped = filteredExpenses.reduce<Record<string, number>>((acc, expense) => {
  const key = expense.category ?? "Без категории";
  acc[key] = (acc[key] ?? 0) + expense.amountNumber;
  return acc;
}, {});

const expenseBreakdownData = Object.entries(grouped).map(([name, value]) => ({
  name,
  value,
}));

  const safeBreakdownData =
    expenseBreakdownData.length > 0
      ? expenseBreakdownData
      : [{ name: "Нет данных", value: 0 }];

      const expensePeriodLabel =
  expensePeriod === "month"
    ? formatMonthLabel(expenseSelectedMonth)
    : `За ${selectedExpenseYear} год`;

  const romi =
    totalExpenses > 0 ? Math.round((totalProfit / totalExpenses) * 100) : 0;

  const uniqueClients = new Set(
    payments.map((payment) => payment.client).filter(Boolean)
  );

  const cac =
    uniqueClients.size > 0 ? Math.round(totalExpenses / uniqueClients.size) : 0;

  const ltv =
    payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0;

  const averageCheck =
    payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0;

  const revenuePerClient =
    uniqueClients.size > 0
      ? Math.round(totalRevenue / uniqueClients.size)
      : 0;

  const paymentsPerClient =
    uniqueClients.size > 0 ? payments.length / uniqueClients.size : 0;

  const ltvAdvanced = Math.round(averageCheck * paymentsPerClient);

  const monthlyTaxRows = [...revenueDynamics]
  .filter((item) => item.revenue > 0)
  .map((item) => ({
    month: item.month,
    revenue: item.revenue,
    tax: Math.round(item.revenue * 0.07),
  }))
  .sort((a, b) => b.month.localeCompare(a.month));

const latestTaxRows = monthlyTaxRows.slice(0, 3);
const olderTaxRows = monthlyTaxRows.slice(3);

const currentYear = new Date().getFullYear();

const taxYTD = monthlyTaxRows
  .filter((item) => {
    const date = new Date(item.month + "-01");
    return date.getFullYear() === currentYear;
  })
  .reduce((sum, item) => sum + item.tax, 0);

  return (
    <div className="space-y-6">
      <SectionCard eyebrow="Сводка" title="Финансовая сводка">
  <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
    <div className="text-xs text-white/40">
      {period === "current_month"
        ? "Показатели за текущий месяц (с 1 числа)"
        : period === "last_3_months"
        ? "Показатели за последние 3 месяца"
        : period === "last_6_months"
        ? "Показатели за последние 6 месяцев"
        : "Показатели за всё время"}
    </div>

    <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
      {[
        { key: "current_month", label: "Месяц" },
        { key: "last_3_months", label: "3 мес" },
        { key: "last_6_months", label: "6 мес" },
        { key: "all_time", label: "Всё" },
      ].map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() =>
            setPeriod(
              item.key as
                | "current_month"
                | "last_3_months"
                | "last_6_months"
                | "all_time"
            )
          }
          className={`rounded-full px-3 py-1 text-xs transition ${
            period === item.key
              ? "bg-violet-500/20 text-violet-300"
              : "text-white/45 hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  </div>

  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Выручка"
            value={formatRub(totalRevenue)}
            hint="Общая сумма всех оплат"
          />
          <StatCard
            label="Прибыль"
            value={formatRub(totalProfit)}
            hint="После расходов, ФОТ и налога"
            valueClassName="text-emerald-300"
          />
          <StatCard
            label="Расходы"
            value={formatRub(totalExpenses)}
            hint="Операционные расходы"
            valueClassName="text-rose-300"
          />
          <StatCard
            label="ФОТ"
            value={formatRub(totalFot)}
            hint="Все выплаты команде"
            valueClassName="text-amber-300"
          />
        </div>
      </SectionCard>

      <SectionCard eyebrow="Базовые метрики" title="Ключевые показатели бизнеса">
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
  label="Стабильная выручка"
  value={formatRub(stableRevenue)}
  hint="Выручка от клиентов, которые платили 2 последних месяца подряд"
/>
          <StatCard
            label="Средний чек"
            value={formatRub(averageCheck)}
            hint="Средняя сумма одной оплаты"
          />
          <StatCard
            label="Средняя выручка"
            value={formatRub(forecastMetrics.avgRevenue)}
            hint="Средняя выручка за месяц"
          />
          <StatCard
            label="Средняя прибыль"
            value={formatRub(forecastMetrics.avgProfit)}
            hint="Средняя прибыль за месяц"
          />
          <StatCard
            label="Доход на клиента"
            value={formatRub(revenuePerClient)}
            hint="Средняя выручка на одного клиента"
          />
          <StatCard
            label="LTV (расширенный)"
            value={formatRub(ltvAdvanced)}
            hint="Lifetime value по фактическим оплатам"
          />
        </div>
      </SectionCard>

      <SectionCard eyebrow="" title="">
  <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-sm text-white/50">Диапазон графиков</div>
        <div className="mt-1 text-xs text-white/35">
          Выбери период, за который нужно показать динамику выручки, прибыли,
          расходов и ФОТ.
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative" ref={chartRangeStartMenuRef}>
          <div className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">
            С месяца
          </div>

          <button
            type="button"
            onClick={() => {
              setIsChartRangeStartMenuOpen((prev) => !prev);
              setIsChartRangeEndMenuOpen(false);
            }}
            className="inline-flex h-[44px] min-w-[180px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            <span>{formatMonthLabel(chartRangeStartMonth)}</span>
            <span className="ml-3 text-white/35">
              {isChartRangeStartMenuOpen ? "−" : "+"}
            </span>
          </button>

          {isChartRangeStartMenuOpen ? (
            <div className="absolute right-0 top-[56px] z-30 w-[280px] rounded-[24px] border border-white/10 bg-[#121826] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:w-[320px]">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setChartRangeStartPickerYear((prev) => prev - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  ←
                </button>

                <div className="text-sm font-semibold text-white">
                  {chartRangeStartPickerYear}
                </div>

                <button
                  type="button"
                  onClick={() => setChartRangeStartPickerYear((prev) => prev + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  →
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {monthNamesRu.map((monthName, index) => {
                  const value = buildMonthValue(chartRangeStartPickerYear, index);
                  const isActive = value === chartRangeStartMonth;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setChartRangeStartMonth(value);
                        setIsChartRangeStartMenuOpen(false);
                      }}
                      className={`rounded-2xl px-3 py-3 text-left text-sm transition ${
                        isActive
                          ? "bg-violet-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)]"
                          : "bg-black/20 text-white/75 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <div className="font-medium leading-none">{monthName}</div>
                      <div className="mt-2 text-xs opacity-80">
                        {chartRangeStartPickerYear}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={chartRangeEndMenuRef}>
          <div className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">
            По месяц
          </div>

          <button
            type="button"
            onClick={() => {
              setIsChartRangeEndMenuOpen((prev) => !prev);
              setIsChartRangeStartMenuOpen(false);
            }}
            className="inline-flex h-[44px] min-w-[180px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            <span>{formatMonthLabel(chartRangeEndMonth)}</span>
            <span className="ml-3 text-white/35">
              {isChartRangeEndMenuOpen ? "−" : "+"}
            </span>
          </button>

          {isChartRangeEndMenuOpen ? (
            <div className="absolute right-0 top-[56px] z-30 w-[280px] rounded-[24px] border border-white/10 bg-[#121826] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:w-[320px]">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setChartRangeEndPickerYear((prev) => prev - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  ←
                </button>

                <div className="text-sm font-semibold text-white">
                  {chartRangeEndPickerYear}
                </div>

                <button
                  type="button"
                  onClick={() => setChartRangeEndPickerYear((prev) => prev + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  →
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {monthNamesRu.map((monthName, index) => {
                  const value = buildMonthValue(chartRangeEndPickerYear, index);
                  const isActive = value === chartRangeEndMonth;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setChartRangeEndMonth(value);
                        setIsChartRangeEndMenuOpen(false);
                      }}
                      className={`rounded-2xl px-3 py-3 text-left text-sm transition ${
                        isActive
                          ? "bg-violet-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)]"
                          : "bg-black/20 text-white/75 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <div className="font-medium leading-none">{monthName}</div>
                      <div className="mt-2 text-xs opacity-80">
                        {chartRangeEndPickerYear}
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

    <FinancialAnalyticsChart
      data={filteredFinancialData}
      revenueDynamics={filteredRevenueDynamics}
    />

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
  <div className="flex items-start justify-between gap-4">
  <div className="flex items-center gap-2">
  <div className="text-sm text-white/50">Структура расходов</div>
  <div className="text-white/20">•</div>
  <div className="text-sm text-white/50">{expensePeriodLabel}</div>
</div>

  <div className="flex items-center gap-3">
    <div className="flex items-center rounded-full border border-white/10 bg-black/20 p-1">
      <button
        type="button"
        onClick={() => {
          const currentIndex = expenseMonths.indexOf(expenseSelectedMonth);
          if (currentIndex > 0) {
            setExpenseSelectedMonth(expenseMonths[currentIndex - 1]);
          }
        }}
        className="rounded-full px-3 py-1 text-xs text-white/45 transition hover:text-white disabled:opacity-30"
        disabled={expenseMonths.indexOf(expenseSelectedMonth) <= 0}
      >
        ←
      </button>

      <div className="px-2 text-xs text-white/60">
        {formatMonthLabel(expenseSelectedMonth)}
      </div>

      <button
        type="button"
        onClick={() => {
          const currentIndex = expenseMonths.indexOf(expenseSelectedMonth);
          if (currentIndex < expenseMonths.length - 1) {
            setExpenseSelectedMonth(expenseMonths[currentIndex + 1]);
          }
        }}
        className="rounded-full px-3 py-1 text-xs text-white/45 transition hover:text-white disabled:opacity-30"
        disabled={expenseMonths.indexOf(expenseSelectedMonth) === expenseMonths.length - 1}
      >
        →
      </button>
    </div>

    <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
      <button
        type="button"
        onClick={() => setExpensePeriod("month")}
        className={`rounded-full px-3 py-1 text-xs transition ${
          expensePeriod === "month"
            ? "bg-violet-500/20 text-violet-300"
            : "text-white/45 hover:text-white"
        }`}
      >
        Месяц
      </button>
      <button
        type="button"
        onClick={() => setExpensePeriod("year")}
        className={`rounded-full px-3 py-1 text-xs transition ${
          expensePeriod === "year"
            ? "bg-violet-500/20 text-violet-300"
            : "text-white/45 hover:text-white"
        }`}
      >
        Год
      </button>
    </div>
  </div>
</div>

  <div className="mt-4">
    <ExpenseBreakdownDonut data={safeBreakdownData} />
  </div>
</div>

            <div className="h-full rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
  <div className="flex h-full flex-col">
    <div>
      <div className="text-sm text-white/50">Налог</div>
      <h3 className="mt-1 text-xl font-semibold text-white">
        Налог 7% по месяцам
      </h3>
      <div className="mt-2 text-sm leading-6 text-white/55">
        Расчёт ведётся по выручке каждого месяца с начала года (YTD).
      </div>
    </div>

    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.16em] text-white/35">
  За весь {currentYear} год накопилось налога на сумму:
</div>
      <div className="mt-2 text-3xl font-semibold text-violet-300">
        {formatRub(taxYTD)}
      </div>
    </div>

    <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
  {monthlyTaxRows.length > 0 ? (
    <>
      {latestTaxRows.map((item) => (
        <div
          key={item.month}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
        >
          <div>
            <div className="text-sm font-medium text-white">
              {formatMonthLabel(item.month)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Выручка: {formatRub(item.revenue)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.12em] text-white/35">
              Налог
            </div>
            <div className="mt-1 text-lg font-semibold text-violet-300">
              {formatRub(item.tax)}
            </div>
          </div>
        </div>
      ))}

      {olderTaxRows.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3 text-xs uppercase tracking-[0.12em] text-white/35">
          История
        </div>
      )}

      {olderTaxRows.map((item) => (
        <div
          key={item.month}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
        >
          <div>
            <div className="text-sm font-medium text-white">
              {formatMonthLabel(item.month)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Выручка: {formatRub(item.revenue)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.12em] text-white/35">
              Налог
            </div>
            <div className="mt-1 text-lg font-semibold text-violet-300">
              {formatRub(item.tax)}
            </div>
          </div>
        </div>
      ))}
    </>
  ) : (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/50">
      Пока нет данных по месяцам
    </div>
  )}
</div>
  </div>
</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
  eyebrow="Эффективность и рост"
  title="Прогнозы и окупаемость"
>
  <div className="mt-5 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
    <div className="space-y-4">
      <StatCard
        label="Текущая маржа"
        value={`${targetMetrics.currentMargin.toFixed(1)}%`}
        hint="Маржинальность бизнеса за выбранный период"
      />
      <StatCard
        label="ROMI"
        value={`${romi}%`}
        hint="Окупаемость маркетинговых расходов"
        valueClassName="text-emerald-300"
      />
      <StatCard
        label="CAC"
        value={formatRub(cac)}
        hint="Стоимость привлечения одного клиента"
        valueClassName="text-violet-300"
      />
    </div>

    <div className="grid gap-4 md:grid-cols-3">
  <div className="h-[374px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] p-5">
    <div className="grid h-full grid-rows-[64px_1fr_148px]">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="text-[13px] font-medium text-white/45">
          Текущий уровень
        </div>
        <div className="mt-2 text-[20px] font-semibold leading-tight text-white">
          Средняя выручка за месяц
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-white">
            {formatRub(forecastMetrics.avgRevenue)}
          </div>
        </div>
      </div>

      <div className="flex h-[148px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-5 text-center">
        <div className="text-[14px] leading-6 text-white/55">
          На основе данных за последние 3 месяца


        </div>
        <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
          Средняя прибыль
        </div>
        <div className="mt-2 text-[26px] font-semibold leading-none text-white/90">
          {formatRub(forecastMetrics.avgProfit)}
        </div>
      </div>
    </div>
  </div>

  <div className="h-[374px] rounded-[24px] border border-violet-400/20 bg-[linear-gradient(180deg,rgba(139,92,246,0.10)_0%,rgba(255,255,255,0.02)_100%)] p-5">
    <div className="grid h-full grid-rows-[64px_1fr_148px]">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="text-[13px] font-medium text-violet-200/75">
          Реалистичный сценарий
        </div>
        <div className="mt-2 text-[20px] font-semibold leading-tight text-white">
          Прогноз выручки на 3 месяца
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-violet-300">
            {formatRub(forecastMetrics.realisticRevenue)}
          </div>
        </div>
      </div>

      <div className="flex h-[140px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-5 text-center">
        <div className="text-[14px] leading-6 text-white/55">
          С сохранением средних показателей за последние 3 месяца
        </div>
        <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
          Прогнозируемая прибыль
        </div>
        <div className="mt-2 text-[26px] font-semibold leading-none text-white/90">
          {formatRub(forecastMetrics.realisticProfit)}
        </div>
      </div>
    </div>
  </div>

  <div className="h-[374px] rounded-[24px] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.10)_0%,rgba(255,255,255,0.02)_100%)] p-5">
    <div className="grid h-full grid-rows-[64px_1fr_148px]">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="text-[13px] font-medium text-emerald-200/75">
          Агрессивный сценарий
        </div>
        <div className="mt-2 text-[20px] font-semibold leading-tight text-white">
          Прогноз выручки на 3 месяца
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-emerald-300">
            {formatRub(forecastMetrics.aggressiveRevenue)}
          </div>
        </div>
      </div>

      <div className="flex h-[140px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-5 text-center">
        <div className="text-[14px] leading-6 text-white/55">
          С текущим темпом роста или падения за последние 3 месяца
        </div>
        <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
          Прогнозируемая прибыль
        </div>
        <div className="mt-2 text-[26px] font-semibold leading-none text-white/90">
          {formatRub(forecastMetrics.aggressiveProfit)}
        </div>
      </div>
    </div>
  </div>
</div>
  </div>
</SectionCard>

<SectionCard
  eyebrow="Калькулятор цели"
  title="Что нужно для достижения нужной прибыли"
>

  <div className="mt-4 space-y-5">
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="mt-2 grid gap-3 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[20px] border border-white/10 bg-black/20 p-3.5">
          <label className="text-sm text-white/50">Цель по прибыли</label>
          <input
            type="number"
            value={targetProfit}
            onChange={(e) => setTargetProfit(Number(e.target.value) || 0)}
            className="mt-2 h-[42px] w-full rounded-xl border border-white/10 bg-[#0B1120] px-4 text-xl font-semibold text-white outline-none"
            placeholder="Например: 300000"
          />
          <div className="mt-2 text-xs leading-5 text-white/40">
  Введи, сколько чистой прибыли хочешь получать за месяц. Справа увидишь,
  чего не хватает до цели. Можно расти за счёт одного сильного рычага или
  улучшать несколько показателей постепенно.
</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/35">
              Не хватает прибыли
            </div>
            <div className="mt-2 text-[30px] font-semibold leading-none text-rose-300">
              {formatRub(growthPlan.profitGap)}
            </div>
            <div className="mt-2 text-xs text-white/40">Дефицит до цели</div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/35">
              Нужная выручка
            </div>
            <div className="mt-2 text-[30px] font-semibold leading-none text-violet-300">
              {formatRub(targetMetrics.requiredRevenue)}
            </div>
            <div className="mt-2 text-xs text-white/40">Чтобы выйти на цель</div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/35">
              Ещё нужно клиентов
            </div>
            <div className="mt-2 text-[30px] font-semibold leading-none text-emerald-300">
              {targetMetrics.requiredClients}
            </div>
            <div className="mt-2 text-xs text-white/40">
              При текущем среднем чеке
            </div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/35">
              Рост чека
            </div>
            <div className="mt-2 text-[30px] font-semibold leading-none text-amber-300">
              {growthPlan.requiredCheckGrowthPercent.toFixed(1)}%
            </div>
            <div className="mt-2 text-xs text-white/40">
              Альтернатива росту клиентов
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
  <div>
    <div className="text-sm text-white/50">Сценарий роста</div>
    <div className="mt-1 text-sm text-white/35">
      Введи, на сколько хочешь увеличить или уменьшить клиентов, средний чек и расходы.
      Ниже увидишь, как изменятся выручка, прибыль и средний чек при таких условиях.
      База расчёта выбирается переключателем справа.
    </div>
  </div>

  <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
    <button
      type="button"
      onClick={() => setGrowthBasePeriod(1)}
      className={`rounded-full px-3 py-1 text-xs transition ${
        growthBasePeriod === 1
          ? "bg-violet-500/20 text-violet-300"
          : "text-white/45 hover:text-white"
      }`}
    >
      1 мес
    </button>
    <button
      type="button"
      onClick={() => setGrowthBasePeriod(3)}
      className={`rounded-full px-3 py-1 text-xs transition ${
        growthBasePeriod === 3
          ? "bg-violet-500/20 text-violet-300"
          : "text-white/45 hover:text-white"
      }`}
    >
      3 мес
    </button>
  </div>
</div>

      <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/35">
              Изменение количества клиентов, ед.
            </label>
            <input
              type="number"
              value={growthScenario.clientsDelta}
              onChange={(e) =>
                setGrowthScenario((prev) => ({
                  ...prev,
                  clientsDelta: Number(e.target.value) || 0,
                }))
              }
              className="h-[52px] w-full rounded-xl border border-white/10 bg-[#0B1120] px-4 text-base font-medium text-white outline-none"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/35">
              Изменение среднего чека, %
            </label>
            <input
              type="number"
              value={growthScenario.avgCheckDelta}
              onChange={(e) =>
                setGrowthScenario((prev) => ({
                  ...prev,
                  avgCheckDelta: Number(e.target.value) || 0,
                }))
              }
              className="h-[52px] w-full rounded-xl border border-white/10 bg-[#0B1120] px-4 text-base font-medium text-white outline-none"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/35">
              Изменение расходов, %
            </label>
            <input
              type="number"
              value={growthScenario.expenseDelta}
              onChange={(e) =>
                setGrowthScenario((prev) => ({
                  ...prev,
                  expenseDelta: Number(e.target.value) || 0,
                }))
              }
              className="h-[52px] w-full rounded-xl border border-white/10 bg-[#0B1120] px-4 text-base font-medium text-white outline-none"
              placeholder="0"
            />
          </div>
        </div>
      </div>


      <div className="mt-4 text-xs text-white/35">
  При нулевых значениях показывается базовый сценарий на основе данных за{" "}
  {growthBasePeriod === 1 ? "последний месяц" : "последние 3 месяца"}:
  выручки, прибыли, среднего чека и числа клиентов.
</div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-[124px] rounded-[18px] border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex h-full flex-col items-center justify-between text-center">
            <div className="text-sm text-white/50">Выручка по сценарию</div>
            <div className="text-[30px] font-semibold leading-none text-violet-300">
              {formatRub(growthMetrics.newRevenue)}
            </div>
            <div className="text-sm text-white/40">
              Итог при текущих настройках
            </div>
          </div>
        </div>

        <div className="h-[124px] rounded-[18px] border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex h-full flex-col items-center justify-between text-center">
            <div className="text-sm text-white/50">Прибыль по сценарию</div>
            <div className="text-[30px] font-semibold leading-none text-emerald-300">
              {formatRub(growthMetrics.newProfit)}
            </div>
            <div className="text-sm text-white/40">
              Итог при текущих настройках
            </div>
          </div>
        </div>

        <div className="h-[124px] rounded-[18px] border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex h-full flex-col items-center justify-between text-center">
            <div className="text-sm text-white/50">
  Средний чек по сценарию
</div>
            <div className="text-[30px] font-semibold leading-none text-amber-300">
              {formatRub(growthMetrics.newAvgCheck)}
            </div>
            <div className="text-sm text-white/40">
              Итог при текущих настройках
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</SectionCard>
    </div>
  );
}