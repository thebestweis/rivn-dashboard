"use client";

import { useEffect, useMemo, useState } from "react";
import { AppTopbar } from "../components/layout/app-topbar";
import { KpiCard } from "../components/dashboard/kpi-card";
import { AlertsPanel } from "../components/dashboard/alerts-panel";
import { ClientsTable } from "../components/dashboard/clients-table";
import { QuickActions } from "../components/dashboard/quick-actions";
import { FinancialOverviewChart } from "../components/dashboard/financial-overview-chart";
import { IncomeRatioDonut } from "../components/dashboard/income-ratio-donut";
import { PlanFactPanel } from "../components/dashboard/plan-fact-panel";
import { AccessDenied } from "../components/access/access-denied";
import { Skeleton } from "../components/ui/skeleton";
import { formatRub, type StoredClient } from "../lib/storage";
import {
  type SupabaseMonthlyPlan,
} from "../lib/supabase/clients";
import { createClient } from "../lib/supabase/client";
import {
  canManageFinance,
  isAppRole,
  type AppRole,
} from "../lib/permissions";
import { useAppContextState } from "../providers/app-context-provider";
import { usePageAccess } from "../lib/use-page-access";
import { useClientsQuery } from "../lib/queries/use-clients-query";
import { usePaymentsQuery } from "../lib/queries/use-payments-query";
import { useExpensesQuery } from "../lib/queries/use-expenses-query";
import {
  usePayrollExtraPaymentsQuery,
  usePayrollPayoutsQuery,
} from "../lib/queries/use-payroll-query";
import { useMonthlyPlansQuery } from "../lib/queries/use-monthly-plans-query";

type SupabasePaymentItem = {
  id: string;
  client_id: string | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  period_label: string | null;
  notes: string | null;
};

type SupabaseExpenseItem = {
  id: string;
  title: string;
  amount: number;
  expense_date: string;
  client_id: string | null;
  notes?: string | null;
};

type SupabasePayrollPayoutItem = {
  id: string;
  employee: string;
  employeeId?: string | null;
  payoutDate: string;
  amount: string;
  month: string;
  status: "scheduled" | "paid";
};

type SupabasePayrollExtraPaymentItem = {
  id: string;
  employee: string;
  employeeId?: string | null;
  reason: string;
  date: string;
  amount: string;
};

function parseDisplayDateToDate(value: string) {
  if (!value) return null;

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return null;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  if (value.includes("-")) {
    const [year, month, day] = value.split("-");
    if (!day || !month || !year) return null;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  return null;
}

function formatSupabaseDateToDisplay(value: string | null) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  if (!day || !month || !year) return value;

  return `${day}.${month}.${year}`;
}

function parseRubString(value: string) {
  if (!value) return 0;
  return Number(String(value).replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthShortLabel(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    month: "short",
  });
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;

  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function isWithinLastDays(value: string, days: number) {
  const targetDate = parseDisplayDateToDate(value);
  if (!targetDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));

  return targetDate >= start && targetDate <= today;
}

function isWithinSelectedDashboardPeriod(
  value: string,
  period: "30d" | "90d" | "all"
) {
  if (period === "all") return true;

  const days = period === "30d" ? 30 : 90;
  return isWithinLastDays(value, days);
}

function DashboardHeroSkeleton() {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.96),rgba(13,18,30,0.96))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-80" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>
    </section>
  );
}

function KpiGridSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-8 w-32" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </section>
  );
}

function DashboardBottomSkeleton() {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <Skeleton className="h-5 w-40" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-5 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mx-auto mt-6 h-36 w-36 rounded-full" />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { role, isLoading: isAppContextLoading } = useAppContextState();
  const { isLoading: isAccessLoading, hasAccess } = usePageAccess("dashboard");

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageDashboardFinance = currentRole
    ? canManageFinance(currentRole)
    : false;

  const [dashboardPeriod, setDashboardPeriod] = useState<"30d" | "90d" | "all">(
    "30d"
  );

  const [planFactStartMonth, setPlanFactStartMonth] = useState(getCurrentMonthValue);
  const [planFactEndMonth, setPlanFactEndMonth] = useState(getCurrentMonthValue);

  const {
    data: clients = [],
    isLoading: isClientsLoading,
  } = useClientsQuery(hasAccess);

  const {
    data: payments = [],
    isLoading: isPaymentsLoading,
  } = usePaymentsQuery(hasAccess);

  const {
    data: expenses = [],
    isLoading: isExpensesLoading,
  } = useExpensesQuery(hasAccess);

  const {
    data: payrollPayouts = [],
    isLoading: isPayrollPayoutsLoading,
  } = usePayrollPayoutsQuery(hasAccess);

  const {
    data: payrollExtraPayments = [],
    isLoading: isPayrollExtraPaymentsLoading,
  } = usePayrollExtraPaymentsQuery(hasAccess);

  const {
    data: monthlyPlans = [],
    isLoading: isMonthlyPlansLoading,
  } = useMonthlyPlansQuery(hasAccess);

  const isLoadingDashboard =
    isClientsLoading ||
    isPaymentsLoading ||
    isExpensesLoading ||
    isPayrollPayoutsLoading ||
    isPayrollExtraPaymentsLoading ||
    isMonthlyPlansLoading;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const periodLabel =
    dashboardPeriod === "30d"
      ? "за 30 дней"
      : dashboardPeriod === "90d"
      ? "за 90 дней"
      : "за всё время";

  const paidPayments = useMemo(() => {
    return (payments as SupabasePaymentItem[]).filter((item) => item.status === "paid");
  }, [payments]);

  const pendingPayments = useMemo(() => {
    return (payments as SupabasePaymentItem[]).filter((item) => item.status !== "paid");
  }, [payments]);

  const periodPaidPayments = useMemo(() => {
    return paidPayments.filter((item) =>
      isWithinSelectedDashboardPeriod(
        formatSupabaseDateToDisplay(item.paid_date),
        dashboardPeriod
      )
    );
  }, [paidPayments, dashboardPeriod]);

  const periodExpenses = useMemo(() => {
    return (expenses as SupabaseExpenseItem[]).filter((item) =>
      isWithinSelectedDashboardPeriod(
        formatSupabaseDateToDisplay(item.expense_date),
        dashboardPeriod
      )
    );
  }, [expenses, dashboardPeriod]);

  const periodPayrollPayouts = useMemo(() => {
    return (payrollPayouts as SupabasePayrollPayoutItem[])
      .filter((item) => item.status === "paid")
      .filter((item) =>
        isWithinSelectedDashboardPeriod(item.payoutDate, dashboardPeriod)
      );
  }, [payrollPayouts, dashboardPeriod]);

  const periodPayrollExtraPayments = useMemo(() => {
    return (payrollExtraPayments as SupabasePayrollExtraPaymentItem[]).filter((item) =>
      isWithinSelectedDashboardPeriod(item.date, dashboardPeriod)
    );
  }, [payrollExtraPayments, dashboardPeriod]);

  const activeClientsCount = useMemo(() => {
    return (clients as StoredClient[]).filter((client) => client.status === "active").length;
  }, [clients]);

  const problemClients = useMemo(() => {
    return (clients as StoredClient[]).filter((client) => client.status === "problem");
  }, [clients]);

  const dashboardClients = useMemo(() => {
    return (clients as StoredClient[]).slice(0, 4);
  }, [clients]);

  const totalRevenueNumber = useMemo(() => {
    return periodPaidPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [periodPaidPayments]);

  const totalExpensesNumber = useMemo(() => {
    return periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [periodExpenses]);

  const paidPayrollNumber = useMemo(() => {
    return periodPayrollPayouts.reduce(
      (sum, item) => sum + parseRubString(item.amount),
      0
    );
  }, [periodPayrollPayouts]);

  const extraPayrollNumber = useMemo(() => {
    return periodPayrollExtraPayments.reduce(
      (sum, item) => sum + parseRubString(item.amount),
      0
    );
  }, [periodPayrollExtraPayments]);

  const totalFotNumber = useMemo(() => {
    return paidPayrollNumber + extraPayrollNumber;
  }, [paidPayrollNumber, extraPayrollNumber]);

  const taxNumber = useMemo(() => {
    return totalRevenueNumber * 0.07;
  }, [totalRevenueNumber]);

  const totalProfitNumber = useMemo(() => {
    return totalRevenueNumber - totalExpensesNumber - totalFotNumber - taxNumber;
  }, [totalRevenueNumber, totalExpensesNumber, totalFotNumber, taxNumber]);

  const averageCheckNumber = useMemo(() => {
    if (periodPaidPayments.length === 0) return 0;
    return totalRevenueNumber / periodPaidPayments.length;
  }, [periodPaidPayments, totalRevenueNumber]);

  const profitMarginRatio = useMemo(() => {
    if (totalRevenueNumber <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((totalProfitNumber / totalRevenueNumber) * 100))
    );
  }, [totalProfitNumber, totalRevenueNumber]);

  const overdueInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return pendingPayments.filter((item) => {
      const dueDate = parseDisplayDateToDate(
        formatSupabaseDateToDisplay(item.due_date)
      );
      if (!dueDate) return false;
      return dueDate < today;
    });
  }, [pendingPayments]);

  const overdueInvoicesTotal = useMemo(() => {
    return overdueInvoices.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
  }, [overdueInvoices]);

  const expenseSharePercent = useMemo(() => {
    if (totalRevenueNumber <= 0) return 0;
    return Math.round((totalExpensesNumber / totalRevenueNumber) * 100);
  }, [totalExpensesNumber, totalRevenueNumber]);

  const fotSharePercent = useMemo(() => {
    if (totalRevenueNumber <= 0) return 0;
    return Math.round((totalFotNumber / totalRevenueNumber) * 100);
  }, [totalFotNumber, totalRevenueNumber]);

  const financialChartData = useMemo(() => {
    const today = new Date();
    const months: {
      key: string;
      label: string;
      revenue: number;
      expenses: number;
      fot: number;
      profit: number;
    }[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        key: getMonthKey(date),
        label: getMonthShortLabel(date),
        revenue: 0,
        expenses: 0,
        fot: 0,
        profit: 0,
      });
    }

    const monthMap = new Map(months.map((item) => [item.key, item]));

    periodPaidPayments.forEach((payment) => {
      const date = parseDisplayDateToDate(
        formatSupabaseDateToDisplay(payment.paid_date)
      );
      if (!date) return;

      const key = getMonthKey(date);
      const target = monthMap.get(key);
      if (!target) return;

      target.revenue += Number(payment.amount || 0);
    });

    periodExpenses.forEach((expense) => {
      const date = parseDisplayDateToDate(
        formatSupabaseDateToDisplay(expense.expense_date)
      );
      if (!date) return;

      const key = getMonthKey(date);
      const target = monthMap.get(key);
      if (!target) return;

      target.expenses += Number(expense.amount || 0);
    });

    periodPayrollPayouts.forEach((item) => {
      const date = parseDisplayDateToDate(item.payoutDate);
      if (!date) return;

      const key = getMonthKey(date);
      const target = monthMap.get(key);
      if (!target) return;

      target.fot += parseRubString(item.amount);
    });

    periodPayrollExtraPayments.forEach((item) => {
      const date = parseDisplayDateToDate(item.date);
      if (!date) return;

      const key = getMonthKey(date);
      const target = monthMap.get(key);
      if (!target) return;

      target.fot += parseRubString(item.amount);
    });

    months.forEach((item) => {
      const tax = item.revenue * 0.07;
      item.profit = item.revenue - item.expenses - item.fot - tax;
    });

    return months.map(({ label, revenue, expenses, fot, profit }) => ({
      label,
      revenue,
      expenses,
      fot,
      profit,
    }));
  }, [
    periodPaidPayments,
    periodExpenses,
    periodPayrollPayouts,
    periodPayrollExtraPayments,
  ]);

  const availablePlanMonths = useMemo(() => {
    const months = Array.from(
      new Set((monthlyPlans as SupabaseMonthlyPlan[]).map((item) => item.month))
    ).sort();

    if (months.length === 0) {
      return [getCurrentMonthValue()];
    }

    return months;
  }, [monthlyPlans]);

  useEffect(() => {
    if (!availablePlanMonths.includes(planFactStartMonth)) {
      setPlanFactStartMonth(availablePlanMonths[0]);
    }

    if (!availablePlanMonths.includes(planFactEndMonth)) {
      setPlanFactEndMonth(availablePlanMonths[0]);
    }
  }, [availablePlanMonths, planFactStartMonth, planFactEndMonth]);

  const selectedPlanMonthKeys = useMemo(() => {
    if (!planFactStartMonth || !planFactEndMonth) {
      return new Set<string>();
    }

    const start = new Date(
      Number(planFactStartMonth.split("-")[0]),
      Number(planFactStartMonth.split("-")[1]) - 1,
      1
    );

    const end = new Date(
      Number(planFactEndMonth.split("-")[0]),
      Number(planFactEndMonth.split("-")[1]) - 1,
      1
    );

    const startDate = start <= end ? start : end;
    const endDate = start <= end ? end : start;

    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const keys: string[] = [];

    while (cursor <= endDate) {
      keys.push(getMonthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return new Set(keys);
  }, [planFactStartMonth, planFactEndMonth]);

  const periodPlans = useMemo(() => {
    return (monthlyPlans as SupabaseMonthlyPlan[]).filter((item) =>
      selectedPlanMonthKeys.has(item.month)
    );
  }, [monthlyPlans, selectedPlanMonthKeys]);

  const revenuePlanNumber = useMemo(() => {
    return periodPlans.reduce((sum, item) => sum + Number(item.revenue_plan || 0), 0);
  }, [periodPlans]);

  const profitPlanNumber = useMemo(() => {
    return periodPlans.reduce((sum, item) => sum + Number(item.profit_plan || 0), 0);
  }, [periodPlans]);

  const expensesPlanNumber = useMemo(() => {
    return periodPlans.reduce((sum, item) => sum + Number(item.expenses_plan || 0), 0);
  }, [periodPlans]);

  const fotPlanNumber = useMemo(() => {
    return periodPlans.reduce((sum, item) => sum + Number(item.fot_plan || 0), 0);
  }, [periodPlans]);

  const alerts = useMemo(() => {
    const nextAlerts: {
      title: string;
      desc: string;
      tone: "warning" | "danger" | "success";
      href?: string;
    }[] = [];

    if (overdueInvoices.length > 0) {
      nextAlerts.push({
        title: `Просрочено ${overdueInvoices.length} счет(ов)`,
        desc: `На сумму ${formatRub(overdueInvoicesTotal)}. Нужно вернуться к оплатам.`,
        tone: "danger",
        href: "/payments",
      });
    }

    if (problemClients.length > 0) {
      const preview = problemClients
        .slice(0, 3)
        .map((client) => client.name)
        .join(", ");

      nextAlerts.push({
        title: `Проблемных клиентов: ${problemClients.length}`,
        desc:
          problemClients.length <= 3
            ? preview
            : `${preview} и ещё ${problemClients.length - 3}`,
        tone: "warning",
        href: "/clients",
      });
    }

    if (totalProfitNumber < 0) {
      nextAlerts.push({
        title: "Бизнес в минусе",
        desc: `Текущая прибыль ${formatRub(totalProfitNumber)} ${periodLabel}.`,
        tone: "danger",
        href: "/analytics",
      });
    }

    if (fotSharePercent >= 35 && totalRevenueNumber > 0) {
      nextAlerts.push({
        title: "Высокая доля ФОТ",
        desc: `ФОТ съедает ${fotSharePercent}% выручки ${periodLabel}.`,
        tone: "warning",
        href: "/payroll",
      });
    }

    if (expenseSharePercent >= 45 && totalRevenueNumber > 0) {
      nextAlerts.push({
        title: "Высокая доля расходов",
        desc: `Расходы составляют ${expenseSharePercent}% выручки ${periodLabel}.`,
        tone: "warning",
        href: "/expenses",
      });
    }

    if (nextAlerts.length === 0) {
      nextAlerts.push({
        title: "Критичных сигналов нет",
        desc: "Просрочек нет, прибыль положительная, структура затрат выглядит нормально.",
        tone: "success",
      });
    }

    return nextAlerts.slice(0, 4);
  }, [
    overdueInvoices,
    overdueInvoicesTotal,
    problemClients,
    totalProfitNumber,
    fotSharePercent,
    expenseSharePercent,
    totalRevenueNumber,
    periodLabel,
  ]);

  const quickActions = [
    { label: "Добавить клиента", tone: "emerald" as const, href: "/clients" },
    ...(canManageDashboardFinance
      ? [
          {
            label: "Добавить оплату",
            tone: "violet" as const,
            href: "/payments",
          },
          {
            label: "Добавить расход",
            tone: "rose" as const,
            href: "/expenses",
          },
          {
            label: "Внеплановая выплата",
            tone: "amber" as const,
            href: "/payroll",
          },
        ]
      : []),
  ];

  const kpis = [
    {
      label: "Выручка",
      value: formatRub(totalRevenueNumber),
      delta: periodLabel,
      tone: "success" as const,
    },
    {
      label: "Прибыль",
      value: formatRub(totalProfitNumber),
      delta: "выручка - расходы - ФОТ - 7%",
      tone: totalProfitNumber >= 0 ? ("success" as const) : ("warning" as const),
    },
    {
      label: "Расходы",
      value: formatRub(totalExpensesNumber),
      delta: periodLabel,
      tone: "warning" as const,
    },
    {
      label: "ФОТ",
      value: formatRub(totalFotNumber),
      delta: periodLabel,
      tone: "warning" as const,
    },
    {
      label: "Налог 7%",
      value: formatRub(taxNumber),
      delta: periodLabel,
      tone: "neutral" as const,
    },
    {
      label: "Активные клиенты",
      value: isLoadingDashboard ? "..." : String(activeClientsCount),
      delta: "из раздела клиенты",
      tone: "success" as const,
    },
    {
      label: "Средний чек",
      value: formatRub(averageCheckNumber),
      delta: "по оплаченным счетам",
      tone: "success" as const,
    },
    {
      label: "Маржа",
      value: `${profitMarginRatio}%`,
      delta: "доля прибыли",
      tone: profitMarginRatio >= 20 ? ("success" as const) : ("warning" as const),
    },
  ];

  const planFactPeriodLabel = useMemo(() => {
    if (!planFactStartMonth || !planFactEndMonth) {
      return "Период не выбран";
    }

    if (planFactStartMonth === planFactEndMonth) {
      return formatMonthLabel(planFactStartMonth);
    }

    return `${formatMonthLabel(planFactStartMonth)} — ${formatMonthLabel(
      planFactEndMonth
    )}`;
  }, [planFactStartMonth, planFactEndMonth]);

  if (!isAccessLoading && !hasAccess) {
    return (
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <AccessDenied
            title="Нет доступа к дашборду"
            description="У тебя нет прав для просмотра этого раздела."
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <AppTopbar
        title="Дашборд"
        description="Ключевые показатели, сигналы внимания и общая картина по агентству."
        showSearch={false}
        showPeriodTabs={false}
        showThemeToggle={false}
        customActions={
          <>
            <a
              href="https://t.me/weismakeleadgen"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
            >
              TG основателя
            </a>

            <a
              href="https://t.me/thebestweis"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-emerald-400/15 bg-emerald-400/12 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.14)] transition hover:bg-emerald-400/18 hover:shadow-[0_0_30px_rgba(16,185,129,0.18)]"
            >
              Техническая поддержка
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
            >
              Выйти
            </button>
          </>
        }
      />

      <div className="space-y-6 px-5 py-5 lg:px-8">
        {!isAppContextLoading && !canManageDashboardFinance ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            У тебя ограниченный режим дашборда. Финансовые быстрые действия скрыты.
          </div>
        ) : null}

        {isLoadingDashboard ? (
          <DashboardHeroSkeleton />
        ) : (
          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.96),rgba(13,18,30,0.96))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-white/45">Период дашборда</div>
                <div className="mt-1 text-base font-medium text-white">
                  Все ключевые показатели и графики считаются {periodLabel}
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Можно быстро переключаться между коротким, длинным и полным периодом.
                </div>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <button
                  type="button"
                  onClick={() => setDashboardPeriod("30d")}
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    dashboardPeriod === "30d"
                      ? "bg-gradient-to-r from-[#6F5AFF] to-[#8B7BFF] text-white shadow-[0_0_24px_rgba(111,90,255,0.30)]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  30 дней
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardPeriod("90d")}
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    dashboardPeriod === "90d"
                      ? "bg-gradient-to-r from-[#6F5AFF] to-[#8B7BFF] text-white shadow-[0_0_24px_rgba(111,90,255,0.30)]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  90 дней
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardPeriod("all")}
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    dashboardPeriod === "all"
                      ? "bg-gradient-to-r from-[#6F5AFF] to-[#8B7BFF] text-white shadow-[0_0_24px_rgba(111,90,255,0.30)]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Всё время
                </button>
              </div>
            </div>
          </section>
        )}

        {isLoadingDashboard ? (
          <KpiGridSkeleton />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            {kpis.map((item) => (
              <KpiCard
                key={item.label}
                label={item.label}
                value={item.value}
                delta={item.delta}
                tone={item.tone}
              />
            ))}
          </section>
        )}

        <section className="space-y-6">
          <FinancialOverviewChart data={financialChartData} />

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <AlertsPanel alerts={alerts} />

            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <div className="flex-1">
                    <div className="text-sm text-white/50">Период план / факт</div>
                    <div className="mt-1 text-sm text-white/70">
                      Можно выбрать один месяц или диапазон месяцев
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <div className="text-xs text-white/45">С месяца</div>
                      <select
                        value={planFactStartMonth}
                        onChange={(e) => setPlanFactStartMonth(e.target.value)}
                        className="h-[44px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                      >
                        {availablePlanMonths.map((month) => (
                          <option key={month} value={month}>
                            {formatMonthLabel(month)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <div className="text-xs text-white/45">По месяц</div>
                      <select
                        value={planFactEndMonth}
                        onChange={(e) => setPlanFactEndMonth(e.target.value)}
                        className="h-[44px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                      >
                        {availablePlanMonths.map((month) => (
                          <option key={month} value={month}>
                            {formatMonthLabel(month)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <PlanFactPanel
                periodLabel={planFactPeriodLabel}
                revenuePlan={revenuePlanNumber}
                revenueFact={totalRevenueNumber}
                profitPlan={profitPlanNumber}
                profitFact={totalProfitNumber}
                expensesPlan={expensesPlanNumber}
                expensesFact={totalExpensesNumber}
                fotPlan={fotPlanNumber}
                fotFact={totalFotNumber}
              />
            </div>
          </div>
        </section>

        {isLoadingDashboard ? (
          <DashboardBottomSkeleton />
        ) : (
          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <ClientsTable clients={dashboardClients} />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
              <QuickActions actions={quickActions} />
              <IncomeRatioDonut ratio={profitMarginRatio} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}