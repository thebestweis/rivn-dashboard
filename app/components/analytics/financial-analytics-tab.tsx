import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { FinancialAnalyticsChart } from "./financial-analytics-chart";
import { ExpenseBreakdownDonut } from "./expense-breakdown-donut";
import { parseRubAmount, formatRub } from "../../lib/storage";
import { buildFinancialTimeSeries } from "../../lib/analytics";

interface FinancialAnalyticsTabProps {
  expenses: any[];
  payments: any[];
  payrollPayouts: any[];
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
  const financialData = buildFinancialTimeSeries({
    expenses,
    payments,
    payrollPayouts,
  });

  const [expensePeriod, setExpensePeriod] = useState<"month" | "year">("month");

  const expenseMonths = Array.from(
  new Set(
    expenses
      .map((expense) => {
        const rawDate = getExpenseDate(expense);
        if (!rawDate) return null;

        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) return null;

        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      })
      .filter((value): value is string => Boolean(value))
  )
).sort((a, b) => a.localeCompare(b));

const latestExpenseMonth: string =
  expenseMonths.length > 0
    ? expenseMonths[expenseMonths.length - 1]
    : new Date().toISOString().slice(0, 7);

const [expenseSelectedMonth, setExpenseSelectedMonth] =
  useState<string>(latestExpenseMonth);

  const totalRevenue = payments.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );

  const totalExpenses = expenses.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );

  const totalFot = payrollPayouts.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );

  const totalTax = Math.round(totalRevenue * 0.07);
  const totalProfit = totalRevenue - totalExpenses - totalFot - totalTax;

  const [selectedExpenseYear, selectedExpenseMonth] = expenseSelectedMonth.split("-");

const filteredExpenses = expenses.filter((expense) => {
  const rawDate = getExpenseDate(expense);
  if (!rawDate) return false;

  const expenseDate = new Date(rawDate);
  if (Number.isNaN(expenseDate.getTime())) return false;

  const expenseYear = String(expenseDate.getFullYear());
  const expenseMonth = String(expenseDate.getMonth() + 1).padStart(2, "0");

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
  acc[key] = (acc[key] ?? 0) + parseRubAmount(expense.amount);
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

  const mrr = totalRevenue;
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
      <SectionCard eyebrow="Summary" title="Финансовая сводка">
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
            label="MRR"
            value={formatRub(mrr)}
            hint="Текущая выручка за период"
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

      <SectionCard eyebrow="Графики" title="Динамика выручки, прибыли и расходов">
        <div className="mt-5 space-y-6">
          <FinancialAnalyticsChart
            data={financialData}
            revenueDynamics={revenueDynamics}
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