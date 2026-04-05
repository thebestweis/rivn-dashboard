import type { Dispatch, ReactNode, SetStateAction } from "react";
import { FinancialAnalyticsChart } from "./financial-analytics-chart";
import { ExpenseBreakdownDonut } from "./expense-breakdown-donut";
import { parseRubAmount, formatRub } from "../../lib/storage";
import { buildFinancialTimeSeries } from "../../lib/analytics";

interface FinancialAnalyticsTabProps {
  expenses: any[];
  payments: any[];
  payrollPayouts: any[];
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

function SectionCard({ eyebrow, title, children }: SectionCardProps) {
    function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) return value;

  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}
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

  const grouped = expenses.reduce<Record<string, number>>((acc, expense) => {
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

const totalTaxForMonths = monthlyTaxRows.reduce(
  (sum, item) => sum + item.tax,
  0
);

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
              <div className="text-sm text-white/50">Структура расходов</div>
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
        Расчёт ведётся отдельно по выручке каждого месяца.
      </div>
    </div>

    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.16em] text-white/35">
        Общая сумма
      </div>
      <div className="mt-2 text-3xl font-semibold text-violet-300">
        {formatRub(totalTaxForMonths)}
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
  <div className="mt-2 text-sm text-white/50">
    Задай цель по прибыли и сразу увидишь, сколько нужно выручки, клиентов и
    что даст рост.
  </div>

  <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
    <div className="space-y-4">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
        <label className="text-sm text-white/50">Цель по прибыли</label>
        <input
          type="number"
          value={targetProfit}
          onChange={(e) => setTargetProfit(Number(e.target.value) || 0)}
          className="mt-3 h-[56px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-2xl font-semibold text-white outline-none"
          placeholder="Например: 300000"
        />
      </div>

      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
        <div className="text-sm text-white/50">Сценарий роста</div>
        <div className="mt-1 text-sm text-white/35">
          Измени параметры и сразу посмотри, как меняется результат
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/35">
              + клиентов
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
              className="h-[52px] w-full rounded-xl border border-white/10 bg-black/20 px-4 text-base font-medium text-white outline-none"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/35">
              % к чеку
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
              className="h-[52px] w-full rounded-xl border border-white/10 bg-black/20 px-4 text-base font-medium text-white outline-none"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.12em] text-white/35">
              % к расходам
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
              className="h-[52px] w-full rounded-xl border border-white/10 bg-black/20 px-4 text-base font-medium text-white outline-none"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-[148px] rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex h-full flex-col justify-between">
            <div className="text-sm text-white/50">Выручка при сценарии роста</div>
            <div className="text-[36px] font-semibold leading-none text-violet-300">
              {formatRub(growthMetrics.newRevenue)}
            </div>
            <div className="text-sm text-white/40">
              Результат по текущим настройкам сценария
            </div>
          </div>
        </div>

        <div className="h-[148px] rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex h-full flex-col justify-between">
            <div className="text-sm text-white/50">Прибыль при сценарии роста</div>
            <div className="text-[36px] font-semibold leading-none text-emerald-300">
              {formatRub(growthMetrics.newProfit)}
            </div>
            <div className="text-sm text-white/40">
              Результат по текущим настройкам сценария
            </div>
          </div>
        </div>

        <div className="h-[148px] rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex h-full flex-col justify-between">
            <div className="text-sm text-white/50">
              Средний чек при сценарии роста
            </div>
            <div className="text-[36px] font-semibold leading-none text-amber-300">
              {formatRub(growthMetrics.newAvgCheck)}
            </div>
            <div className="text-sm text-white/40">
              Результат по текущим настройкам сценария
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="grid h-full gap-4 md:grid-cols-2 xl:grid-cols-2">
  <div className="min-h-[170px] rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-sm text-white/50">Не хватает прибыли</div>
      <div className="mt-5 text-[42px] font-semibold leading-none text-rose-300">
        {formatRub(growthPlan.profitGap)}
      </div>
      <div className="mt-4 text-sm text-white/35">
        Дефицит до целевой прибыли
      </div>
    </div>
  </div>

  <div className="min-h-[170px] rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-sm text-white/50">Нужная выручка</div>
      <div className="mt-5 text-[42px] font-semibold leading-none text-violet-300">
        {formatRub(targetMetrics.requiredRevenue)}
      </div>
      <div className="mt-4 text-sm text-white/35">
        Требуемый объём выручки
      </div>
    </div>
  </div>

  <div className="min-h-[170px] rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-sm text-white/50">Нужно клиентов</div>
      <div className="mt-5 text-[42px] font-semibold leading-none text-emerald-300">
        {targetMetrics.requiredClients}
      </div>
      <div className="mt-4 text-sm text-white/35">
        Чтобы выйти на цель
      </div>
    </div>
  </div>

  <div className="min-h-[170px] rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-sm text-white/50">Или поднять чек</div>
      <div className="mt-5 text-[42px] font-semibold leading-none text-amber-300">
        {growthPlan.requiredCheckGrowthPercent.toFixed(1)}%
      </div>
      <div className="mt-4 text-sm text-white/35">
        Если идти через рост среднего чека
      </div>
    </div>
  </div>
</div>
  </div>
</SectionCard>
    </div>
  );
}