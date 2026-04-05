import { FinancialAnalyticsChart } from "./financial-analytics-chart";
import { ExpenseBreakdownDonut } from "./expense-breakdown-donut";
import type {
  StoredExpense,
  StoredPayment,
  StoredPayrollPayout,
} from "../../lib/storage";
import { parseRubAmount } from "../../lib/storage";
import { buildFinancialTimeSeries } from "../../lib/analytics";

interface FinancialAnalyticsTabProps {
  expenses: StoredExpense[];
  payments: StoredPayment[];
  payrollPayouts: StoredPayrollPayout[];
}

function parseDateString(value: string) {
  if (!value) return null;

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return null;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const monthNames = [
    "Янв",
    "Фев",
    "Мар",
    "Апр",
    "Май",
    "Июн",
    "Июл",
    "Авг",
    "Сен",
    "Окт",
    "Ноя",
    "Дек",
  ];

  const monthIndex = Number(month) - 1;
  return `${monthNames[monthIndex] ?? month}.${year}`;
}

function formatMoney(value: number) {
  return `₽${Math.round(value).toLocaleString("ru-RU")}`;
}

export function TeamAnalyticsTab({
  expenses,
  payments,
  payrollPayouts,
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
    const key = expense.category;
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
      : [{ name: "no data", value: 0 }];

  const romi =
    totalExpenses > 0 ? Math.round((totalProfit / totalExpenses) * 100) : 0;

  const cac =
    payments.length > 0 ? Math.round(totalExpenses / payments.length) : 0;

  const ltv =
    payments.length > 0 ? Math.round(totalRevenue / payments.length) : 0;

  const monthMap = new Map<
    string,
    {
      revenue: number;
      expenses: number;
      fot: number;
      tax: number;
      profit: number;
    }
  >();

  payments.forEach((payment) => {
    const date = parseDateString(payment.paidAt);
    if (!date) return;

    const key = getMonthKey(date);
    const current = monthMap.get(key) ?? {
      revenue: 0,
      expenses: 0,
      fot: 0,
      tax: 0,
      profit: 0,
    };

    current.revenue += parseRubAmount(payment.amount);
    monthMap.set(key, current);
  });

  expenses.forEach((expense) => {
    const date = parseDateString(expense.date);
    if (!date) return;

    const key = getMonthKey(date);
    const current = monthMap.get(key) ?? {
      revenue: 0,
      expenses: 0,
      fot: 0,
      tax: 0,
      profit: 0,
    };

    current.expenses += parseRubAmount(expense.amount);
    monthMap.set(key, current);
  });

  payrollPayouts.forEach((payout) => {
    const date = parseDateString(payout.date);
    if (!date) return;

    const key = getMonthKey(date);
    const current = monthMap.get(key) ?? {
      revenue: 0,
      expenses: 0,
      fot: 0,
      tax: 0,
      profit: 0,
    };

    current.fot += parseRubAmount(payout.amount);
    monthMap.set(key, current);
  });

  const monthlyRows = Array.from(monthMap.entries())
    .map(([month, values]) => {
      const tax = Math.round(values.revenue * 0.07);
      const profit = values.revenue - values.expenses - values.fot - tax;

      return {
        month,
        label: getMonthLabel(month),
        revenue: values.revenue,
        expenses: values.expenses,
        fot: values.fot,
        tax,
        profit,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const latestMonths = monthlyRows.slice(-6).reverse();

  const currentMonthRow = monthlyRows[monthlyRows.length - 1] ?? null;
  const previousMonthRow =
    monthlyRows.length > 1 ? monthlyRows[monthlyRows.length - 2] : null;

  const revenueDelta =
    currentMonthRow && previousMonthRow
      ? currentMonthRow.revenue - previousMonthRow.revenue
      : 0;

  const profitDelta =
    currentMonthRow && previousMonthRow
      ? currentMonthRow.profit - previousMonthRow.profit
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Выручка по месяцам</div>
          <div className="mt-4 space-y-3">
            {latestMonths.length > 0 ? (
              latestMonths.map((item) => (
                <div
                  key={`revenue-${item.month}`}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                >
                  <div className="text-sm font-medium text-white">
                    {item.label}
                  </div>
                  <div className="text-sm text-white/75">
                    {formatMoney(item.revenue)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">
                Пока недостаточно данных
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Прибыль по месяцам</div>
          <div className="mt-4 space-y-3">
            {latestMonths.length > 0 ? (
              latestMonths.map((item) => (
                <div
                  key={`profit-${item.month}`}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                >
                  <div className="text-sm font-medium text-white">
                    {item.label}
                  </div>
                  <div
                    className={`text-sm ${
                      item.profit >= 0 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {formatMoney(item.profit)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">
                Пока недостаточно данных
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Динамика месяца к месяцу</div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Изменение выручки
              </div>
              <div
                className={`mt-2 text-2xl font-semibold tracking-tight ${
                  revenueDelta >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {revenueDelta >= 0 ? "+" : "-"}
                {formatMoney(Math.abs(revenueDelta))}
              </div>
              <div className="mt-1 text-sm text-white/45">
                Сравнение текущего и прошлого месяца
              </div>
            </div>

            <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Изменение прибыли
              </div>
              <div
                className={`mt-2 text-2xl font-semibold tracking-tight ${
                  profitDelta >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {profitDelta >= 0 ? "+" : "-"}
                {formatMoney(Math.abs(profitDelta))}
              </div>
              <div className="mt-1 text-sm text-white/45">
                Сравнение текущего и прошлого месяца
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Расходы по месяцам</div>
          <div className="mt-4 space-y-3">
            {latestMonths.length > 0 ? (
              latestMonths.map((item) => (
                <div
                  key={`expenses-${item.month}`}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                >
                  <div className="text-sm font-medium text-white">
                    {item.label}
                  </div>
                  <div className="text-sm text-white/75">
                    {formatMoney(item.expenses + item.fot + item.tax)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">
                Пока недостаточно данных
              </div>
            )}
          </div>
        </div>
      </div>

      <FinancialAnalyticsChart data={financialData} />

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Сводка по месяцам</div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Месяц</th>
                <th className="px-4 py-3 font-medium">Выручка</th>
                <th className="px-4 py-3 font-medium">Расходы</th>
                <th className="px-4 py-3 font-medium">ФОТ</th>
                <th className="px-4 py-3 font-medium">Налог</th>
                <th className="px-4 py-3 font-medium">Прибыль</th>
              </tr>
            </thead>

            <tbody>
              {latestMonths.length > 0 ? (
                latestMonths.map((item) => (
                  <tr
                    key={`row-${item.month}`}
                    className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium">{item.label}</td>
                    <td className="px-4 py-3 text-white/75">
                      {formatMoney(item.revenue)}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {formatMoney(item.expenses)}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {formatMoney(item.fot)}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {formatMoney(item.tax)}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        item.profit >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {formatMoney(item.profit)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-white/45"
                  >
                    Пока недостаточно данных для помесячной аналитики
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ExpenseBreakdownDonut data={safeBreakdownData} />

        <div className="grid gap-6">
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="text-sm text-white/50">ROMI</div>
            <div className="mt-3 text-3xl font-semibold text-emerald-300">
              {romi}%
            </div>
            <div className="mt-2 text-sm text-white/50">
              Рассчитано на основе текущих расходов и прибыли
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="text-sm text-white/50">CAC</div>
            <div className="mt-3 text-3xl font-semibold text-violet-300">
              ₽{cac.toLocaleString("ru-RU")}
            </div>
            <div className="mt-2 text-sm text-white/50">
              Средняя стоимость привлечения на одну оплату
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="text-sm text-white/50">LTV</div>
            <div className="mt-3 text-3xl font-semibold text-amber-300">
              ₽{ltv.toLocaleString("ru-RU")}
            </div>
            <div className="mt-2 text-sm text-white/50">
              Средняя выручка на одну оплату
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}