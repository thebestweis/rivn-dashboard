"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useProjectsQuery } from "../lib/queries/use-projects-query";
import { useTasksQuery } from "../lib/queries/use-tasks-query";
import { useWorkspaceMembersQuery } from "../lib/queries/use-workspace-members-query";
import { type Task } from "../lib/supabase/tasks";
import {
  ArrowUpRight,
  CalendarDays,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react";

import Link from "next/link";

type OverviewVisualTier = "minimal" | "middle" | "max";
type OverviewMetricKey =
  | "revenue"
  | "activeProjects"
  | "revenuePerClient"
  | "stableRevenue"
  | "ltv"
  | "averageCheck"
  | "profit"
  | "expenses"
  | "fot"
  | "tax"
  | "margin";

type OverviewBubble = {
  left: number;
  top: number;
  size: number;
  color: string;
  opacity: number;
  depth: number;
};

type DashboardMetricKey =
  | "revenue"
  | "profit"
  | "expenses"
  | "fot"
  | "tax"
  | "averageCheck"
  | "revenuePerClient";

type PlanMetricKey = "revenue" | "profit" | "expenses" | "fot";

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
function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getDefaultCustomStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  date.setHours(0, 0, 0, 0);
  return formatDateInputValue(date);
}

function getDefaultCustomEndDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return formatDateInputValue(date);
}

function getDateFromInputValue(value: string) {
  const parsed = parseDisplayDateToDate(value);
  return parsed ?? getDayStart(new Date());
}

function formatCalendarMonthTitle(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function formatShortDisplayDate(value: string) {
  const date = parseDisplayDateToDate(value);
  if (!date) return value;

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
  period: "30d" | "90d" | "all" | "custom",
  customStartDate?: string,
  customEndDate?: string
) {
  if (period === "all") return true;

  if (period === "custom") {
    const targetDate = parseDisplayDateToDate(value);
    const startDate = customStartDate ? parseDisplayDateToDate(customStartDate) : null;
    const endDate = customEndDate ? parseDisplayDateToDate(customEndDate) : null;

    if (!targetDate || !startDate || !endDate) return false;

    return targetDate >= startDate && targetDate <= endDate;
  }

  const days = period === "30d" ? 30 : 90;
  return isWithinLastDays(value, days);
}

function getDashboardPeriodRange(
  period: "30d" | "90d" | "all" | "custom",
  customStartDate?: string,
  customEndDate?: string
) {
  const today = getDayStart(new Date());

  if (period === "all") return null;

  if (period === "custom") {
    const startDate = customStartDate ? parseDisplayDateToDate(customStartDate) : null;
    const endDate = customEndDate ? parseDisplayDateToDate(customEndDate) : null;

    if (!startDate || !endDate) return null;

    return {
      start: startDate <= endDate ? startDate : endDate,
      end: startDate <= endDate ? endDate : startDate,
    };
  }

  const days = period === "30d" ? 30 : 90;
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));

  return { start, end: today };
}

function getPreviousDashboardPeriodRange(range: { start: Date; end: Date } | null) {
  if (!range) return null;

  const days =
    Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
  const end = new Date(range.start);
  end.setDate(range.start.getDate() - 1);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  return { start, end };
}

function getInclusiveDays(start: Date, end: Date) {
  return Math.max(
    0,
    Math.round((getDayStart(end).getTime() - getDayStart(start).getTime()) / 86_400_000) + 1
  );
}

function getPlanMetricValue(plan: SupabaseMonthlyPlan, key: PlanMetricKey) {
  if (key === "revenue") return Number(plan.revenue_plan || 0);
  if (key === "profit") return Number(plan.profit_plan || 0);
  if (key === "expenses") return Number(plan.expenses_plan || 0);
  return Number(plan.fot_plan || 0);
}

function getProratedMonthlyPlanTotal(
  plans: SupabaseMonthlyPlan[],
  range: { start: Date; end: Date } | null,
  key: PlanMetricKey
) {
  return plans.reduce((sum, plan) => {
    const [year, month] = plan.month.split("-").map(Number);
    if (!year || !month) return sum;

    const monthStart = getDayStart(new Date(year, month - 1, 1));
    const monthEnd = getDayStart(new Date(year, month, 0));
    const monthPlan = getPlanMetricValue(plan, key);

    if (!range) return sum + monthPlan;

    const overlapStart = monthStart > range.start ? monthStart : range.start;
    const overlapEnd = monthEnd < range.end ? monthEnd : range.end;
    const overlapDays = getInclusiveDays(overlapStart, overlapEnd);
    if (overlapDays <= 0) return sum;

    const monthDays = getInclusiveDays(monthStart, monthEnd);
    return sum + (monthPlan / monthDays) * overlapDays;
  }, 0);
}

function isWithinDateRange(value: string, range: { start: Date; end: Date } | null) {
  if (!range) return false;

  const targetDate = parseDisplayDateToDate(value);
  if (!targetDate) return false;

  return targetDate >= range.start && targetDate <= range.end;
}

function getPeriodChangePercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getShortDateLabel(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getDayStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isTaskDueOn(task: Task, date: Date) {
  if (!task.deadline_at) return false;
  return isSameCalendarDay(new Date(task.deadline_at), date);
}

function wasTaskChangedOn(task: Task, date: Date) {
  return isSameCalendarDay(new Date(task.updated_at), date);
}

function DashboardHeroSkeleton() {
  return (
    <section className="rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4">
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
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[18px] border border-[#2D342A] bg-[#11130F] p-4"
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
    <section className="grid gap-4 2xl:grid-cols-[1.45fr_0.95fr]">
      <div className="rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4">
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

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-1">
        <div className="rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        <div className="rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mx-auto mt-6 h-36 w-36 rounded-full" />
        </div>
      </div>
    </section>
  );
}

type OnboardingStep = {
  title: string;
  description: string;
  href: string;
  isDone: boolean;
};

function OnboardingChecklist({
  steps,
  onDismiss,
}: {
  steps: OnboardingStep[];
  onDismiss: () => void;
}) {
  const completedSteps = steps.filter((step) => step.isDone).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return (
    <section className="rounded-[28px] border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.10)_0%,rgba(123,97,255,0.08)_55%,rgba(255,255,255,0.03)_100%)] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Быстрый старт
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            Настрой RIVN OS так, чтобы сервис сразу начал приносить пользу
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Этот чеклист помогает быстро собрать базу: настройки, клиенты, проекты,
            платежи, расходы и план. Чем больше пунктов закрыто, тем точнее данные,
            аналитика и управленческие отчёты.
          </p>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Полный гид по быстрым стартам и основным механизмам сервиса можно
            найти{" "}
            <Link
              href="/guide"
              className="font-semibold text-emerald-300 underline decoration-emerald-300/35 underline-offset-4 transition hover:text-emerald-200"
            >
              здесь
            </Link>
            .
          </p>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 xl:min-w-[220px]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Готовность</span>
            <span className="font-semibold text-emerald-300">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          >
            Скрыть подсказку
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <Link
            key={step.title}
            href={step.href}
            className={`rounded-2xl border px-4 py-4 transition ${
              step.isDone
                ? "border-emerald-400/20 bg-emerald-400/10"
                : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  step.isDone
                    ? "bg-emerald-400 text-[#07131F]"
                    : "bg-white/10 text-white/55"
                }`}
              >
                {step.isDone ? "✓" : index + 1}
              </div>
              <div>
                <div className="font-medium text-white">{step.title}</div>
                <div className="mt-1 text-sm leading-5 text-white/45">
                  {step.description}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const {
    role,
    isLoading: isAppContextLoading,
    user,
    profile,
    workspace,
    membership,
    billingAccess,
  } = useAppContextState();
  const { isLoading: isAccessLoading, hasAccess } = usePageAccess("dashboard");

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageDashboardFinance = currentRole
    ? canManageFinance(currentRole)
    : false;

  const [dashboardPeriod, setDashboardPeriod] = useState<"30d" | "90d" | "all" | "custom">(
    "30d"
  );
  const [selectedChartMetricKeys, setSelectedChartMetricKeys] = useState<
    DashboardMetricKey[]
  >(["revenue", "profit"]);
  const [isFinancialChartSettingsOpen, setIsFinancialChartSettingsOpen] =
    useState(false);
  const [selectedTaskMemberId, setSelectedTaskMemberId] = useState("all");
  const [isTaskWidgetSettingsOpen, setIsTaskWidgetSettingsOpen] =
    useState(false);
  const [isOverviewSettingsOpen, setIsOverviewSettingsOpen] = useState(false);
  const [overviewMetricKeys, setOverviewMetricKeys] = useState<
    OverviewMetricKey[]
  >(["revenue", "activeProjects"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarSelectionAnchor, setCalendarSelectionAnchor] = useState<string | null>(
    null
  );
  const [isMetricWidgetSettingsOpen, setIsMetricWidgetSettingsOpen] =
    useState(false);
  const [selectedMetricWidgetKey, setSelectedMetricWidgetKey] =
    useState<DashboardMetricKey>("expenses");
  const [customPeriodStartDate, setCustomPeriodStartDate] = useState(
    getDefaultCustomStartDate
  );
  const [customPeriodEndDate, setCustomPeriodEndDate] = useState(
    getDefaultCustomEndDate
  );
  const [calendarMonthDate, setCalendarMonthDate] = useState(() =>
    getDateFromInputValue(getDefaultCustomEndDate())
  );
  const [planFactStartMonth, setPlanFactStartMonth] = useState(getCurrentMonthValue);
  const [planFactEndMonth, setPlanFactEndMonth] = useState(getCurrentMonthValue);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);

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

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
  } = useProjectsQuery(hasAccess);

  const {
    data: tasks = [],
    isLoading: isTasksLoading,
  } = useTasksQuery(hasAccess);

  const {
    data: workspaceMembers = [],
    isLoading: isWorkspaceMembersLoading,
  } = useWorkspaceMembersQuery(hasAccess);

    const isLoadingDashboardShell =
    isAppContextLoading ||
    isAccessLoading;

    const isLoadingDashboardKpis =
    isLoadingDashboardShell ||
    isClientsLoading ||
    isProjectsLoading ||
    isPaymentsLoading ||
    isExpensesLoading ||
    isPayrollPayoutsLoading ||
    isPayrollExtraPaymentsLoading ||
    isTasksLoading ||
    isWorkspaceMembersLoading;

    const isLoadingPlanFact =
    isLoadingDashboardKpis || isMonthlyPlansLoading;

    const isLoadingDashboardBottom =
    isLoadingDashboardShell || isClientsLoading || isProjectsLoading || isTasksLoading;

  useEffect(() => {
    setIsOnboardingDismissed(
      window.localStorage.getItem("rivn-dashboard-onboarding-dismissed") === "1"
    );
  }, []);

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
      : dashboardPeriod === "custom"
      ? "за выбранный период"
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
        dashboardPeriod,
        customPeriodStartDate,
        customPeriodEndDate
      )
    );
  }, [paidPayments, dashboardPeriod, customPeriodStartDate, customPeriodEndDate]);

  const periodExpenses = useMemo(() => {
    return (expenses as SupabaseExpenseItem[]).filter((item) =>
      isWithinSelectedDashboardPeriod(
        formatSupabaseDateToDisplay(item.expense_date),
        dashboardPeriod,
        customPeriodStartDate,
        customPeriodEndDate
      )
    );
  }, [expenses, dashboardPeriod, customPeriodStartDate, customPeriodEndDate]);

  const periodPayrollPayouts = useMemo(() => {
    return (payrollPayouts as SupabasePayrollPayoutItem[])
      .filter((item) => item.status === "paid")
      .filter((item) =>
        isWithinSelectedDashboardPeriod(
          item.payoutDate,
          dashboardPeriod,
          customPeriodStartDate,
          customPeriodEndDate
        )
      );
  }, [payrollPayouts, dashboardPeriod, customPeriodStartDate, customPeriodEndDate]);

  const periodPayrollExtraPayments = useMemo(() => {
    return (payrollExtraPayments as SupabasePayrollExtraPaymentItem[]).filter((item) =>
      isWithinSelectedDashboardPeriod(
        item.date,
        dashboardPeriod,
        customPeriodStartDate,
        customPeriodEndDate
      )
    );
  }, [payrollExtraPayments, dashboardPeriod, customPeriodStartDate, customPeriodEndDate]);

  const previousDashboardPeriodRange = useMemo(() => {
    return getPreviousDashboardPeriodRange(
      getDashboardPeriodRange(dashboardPeriod, customPeriodStartDate, customPeriodEndDate)
    );
  }, [dashboardPeriod, customPeriodStartDate, customPeriodEndDate]);

  const previousPeriodPaidPayments = useMemo(() => {
    return paidPayments.filter((item) =>
      isWithinDateRange(
        formatSupabaseDateToDisplay(item.paid_date),
        previousDashboardPeriodRange
      )
    );
  }, [paidPayments, previousDashboardPeriodRange]);

  const previousPeriodExpenses = useMemo(() => {
    return (expenses as SupabaseExpenseItem[]).filter((item) =>
      isWithinDateRange(
        formatSupabaseDateToDisplay(item.expense_date),
        previousDashboardPeriodRange
      )
    );
  }, [expenses, previousDashboardPeriodRange]);

  const previousPeriodPayrollPayouts = useMemo(() => {
    return (payrollPayouts as SupabasePayrollPayoutItem[])
      .filter((item) => item.status === "paid")
      .filter((item) => isWithinDateRange(item.payoutDate, previousDashboardPeriodRange));
  }, [payrollPayouts, previousDashboardPeriodRange]);

  const previousPeriodPayrollExtraPayments = useMemo(() => {
    return (payrollExtraPayments as SupabasePayrollExtraPaymentItem[]).filter((item) =>
      isWithinDateRange(item.date, previousDashboardPeriodRange)
    );
  }, [payrollExtraPayments, previousDashboardPeriodRange]);

  const activeClientsCount = useMemo(() => {
    return (clients as StoredClient[]).filter((client) => client.status === "active").length;
  }, [clients]);

  const activeProjectsCount = useMemo(() => {
    return projects.filter((project) => project.status === "active").length;
  }, [projects]);

  const activeMembersCount = useMemo(() => {
    return workspaceMembers.filter((member) => member.status === "active").length;
  }, [workspaceMembers]);

  const taskMembers = useMemo(() => {
    const membersById = new Map<
      string,
      {
        id: string;
        name: string;
      }
    >();

    workspaceMembers
      .filter((member) => member.status === "active")
      .forEach((member) => {
        membersById.set(member.id, {
          id: member.id,
          name: member.display_name || member.email || "Сотрудник",
        });
      });

    (tasks as Task[]).forEach((task) => {
      task.assignees?.forEach((assignee) => {
        const memberId = assignee.workspace_member_id;
        if (membersById.has(memberId)) return;

        membersById.set(memberId, {
          id: memberId,
          name:
            assignee.workspace_member?.name ||
            assignee.workspace_member?.email ||
            "Сотрудник",
        });
      });
    });

    return Array.from(membersById.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ru")
    );
  }, [tasks, workspaceMembers]);

  const filteredRootTasks = useMemo(() => {
    return (tasks as Task[]).filter((task) => {
      if (task.parent_task_id !== null || task.is_archived) return false;
      if (selectedTaskMemberId === "all") return true;

      return task.assignees?.some(
        (assignee) => assignee.workspace_member_id === selectedTaskMemberId
      );
    });
  }, [tasks, selectedTaskMemberId]);

  const activeTasks = useMemo(() => {
    return filteredRootTasks.filter((task) => task.status !== "done");
  }, [filteredRootTasks]);

  const todayTasks = useMemo(() => {
    const today = getDayStart(new Date());
    return filteredRootTasks.filter((task) => isTaskDueOn(task, today));
  }, [filteredRootTasks]);

  const taskActivityChart = useMemo(() => {
    const today = getDayStart(new Date());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dueTasks = filteredRootTasks.filter((task) => isTaskDueOn(task, date));
      const doneTasks = dueTasks.filter((task) => task.status === "done");
      const doneRatio =
        dueTasks.length > 0 ? Math.round((doneTasks.length / dueTasks.length) * 100) : 0;

      return {
        key: date.toISOString(),
        label: date.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", ""),
        fullLabel: date.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          weekday: "long",
        }),
        isToday: isSameCalendarDay(date, today),
        dueCount: dueTasks.length,
        doneCount: doneTasks.length,
        doneRatio,
      };
    });

    const maxValue = Math.max(1, ...days.map((day) => day.dueCount));

    return days.map((day, index) => ({
      ...day,
      height: day.dueCount > 0 ? Math.max(24, Math.round((day.dueCount / maxValue) * 100)) : 0,
      tooltipAlign:
        index === 0 ? ("left" as const) : index === 6 ? ("right" as const) : ("center" as const),
    }));
  }, [filteredRootTasks]);

  const selectedTaskMemberName = useMemo(() => {
    if (selectedTaskMemberId === "all") return "Все агентство";
    return (
      taskMembers.find((member) => member.id === selectedTaskMemberId)?.name ??
      "Сотрудник"
    );
  }, [selectedTaskMemberId, taskMembers]);

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

  const previousRevenueNumber = useMemo(() => {
    return previousPeriodPaidPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [previousPeriodPaidPayments]);

  const previousExpensesNumber = useMemo(() => {
    return previousPeriodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [previousPeriodExpenses]);

  const previousFotNumber = useMemo(() => {
    const paidPayroll = previousPeriodPayrollPayouts.reduce(
      (sum, item) => sum + parseRubString(item.amount),
      0
    );
    const extraPayroll = previousPeriodPayrollExtraPayments.reduce(
      (sum, item) => sum + parseRubString(item.amount),
      0
    );

    return paidPayroll + extraPayroll;
  }, [previousPeriodPayrollPayouts, previousPeriodPayrollExtraPayments]);

  const previousProfitNumber = useMemo(() => {
    const previousTax = previousRevenueNumber * 0.07;
    return previousRevenueNumber - previousExpensesNumber - previousFotNumber - previousTax;
  }, [previousRevenueNumber, previousExpensesNumber, previousFotNumber]);

  const revenuePeriodChangePercent = useMemo(() => {
    return getPeriodChangePercent(totalRevenueNumber, previousRevenueNumber);
  }, [totalRevenueNumber, previousRevenueNumber]);

  const profitPeriodChangePercent = useMemo(() => {
    return getPeriodChangePercent(totalProfitNumber, previousProfitNumber);
  }, [totalProfitNumber, previousProfitNumber]);

  const overviewPeriodBars = useMemo(() => {
    const makeChangeLabel = (value: number) => (value >= 0 ? "рост" : "падение");

    return [
      {
        key: "revenue-value",
        type: "value" as const,
        value: formatRub(totalRevenueNumber),
        label: "выручка",
        isPositive: revenuePeriodChangePercent >= 0,
        height: "144px",
        align: "end" as const,
      },
      {
        key: "revenue-change",
        type: "change" as const,
        value: `${Math.abs(revenuePeriodChangePercent)}%`,
        label: makeChangeLabel(revenuePeriodChangePercent),
        isPositive: true,
        height: "82px",
        align: "end" as const,
      },
      {
        key: "profit-value",
        type: "value" as const,
        value: formatRub(totalProfitNumber),
        label: "прибыль",
        isPositive: profitPeriodChangePercent >= 0,
        height: "118px",
        align: "end" as const,
      },
      {
        key: "profit-change",
        type: "change" as const,
        value: `${Math.abs(profitPeriodChangePercent)}%`,
        label: makeChangeLabel(profitPeriodChangePercent),
        isPositive: true,
        height: "74px",
        align: "start" as const,
      },
    ];
  }, [
    totalRevenueNumber,
    totalProfitNumber,
    revenuePeriodChangePercent,
    profitPeriodChangePercent,
  ]);

  const averageCheckNumber = useMemo(() => {
    if (periodPaidPayments.length === 0) return 0;
    return totalRevenueNumber / periodPaidPayments.length;
  }, [periodPaidPayments, totalRevenueNumber]);

  const periodPayingClientsCount = useMemo(() => {
    const uniqueClients = new Set(
      periodPaidPayments
        .map((payment) => payment.client_id)
        .filter((value): value is string => Boolean(value))
    );

    return uniqueClients.size;
  }, [periodPaidPayments]);

  const revenuePerClientNumber = useMemo(() => {
    if (periodPayingClientsCount === 0) return 0;
    return totalRevenueNumber / periodPayingClientsCount;
  }, [periodPayingClientsCount, totalRevenueNumber]);

  const factualLtvNumber = useMemo(() => {
    const allPaidClientIds = new Set(
      paidPayments
        .map((payment) => payment.client_id)
        .filter((value): value is string => Boolean(value))
    );

    if (allPaidClientIds.size === 0) return 0;

    const allPaidRevenue = paidPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    return allPaidRevenue / allPaidClientIds.size;
  }, [paidPayments]);

  const stableRevenueNumber = useMemo(() => {
    const paidByMonth = new Map<
      string,
      Map<string, number>
    >();

    paidPayments.forEach((payment) => {
      if (!payment.paid_date || !payment.client_id) return;

      const month = payment.paid_date.slice(0, 7);
      if (!paidByMonth.has(month)) {
        paidByMonth.set(month, new Map());
      }

      const monthClients = paidByMonth.get(month)!;
      monthClients.set(
        payment.client_id,
        (monthClients.get(payment.client_id) ?? 0) + Number(payment.amount || 0)
      );
    });

    const sortedMonths = Array.from(paidByMonth.keys()).sort();
    if (sortedMonths.length < 2) return 0;

    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const previousMonth = sortedMonths[sortedMonths.length - 2];
    const lastMonthClients = paidByMonth.get(lastMonth);
    const previousMonthClients = paidByMonth.get(previousMonth);
    if (!lastMonthClients || !previousMonthClients) return 0;

    let total = 0;
    lastMonthClients.forEach((revenue, clientId) => {
      if (previousMonthClients.has(clientId)) {
        total += revenue;
      }
    });

    return total;
  }, [paidPayments]);

  const profitMarginRatio = useMemo(() => {
    if (totalRevenueNumber <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((totalProfitNumber / totalRevenueNumber) * 100))
    );
  }, [totalProfitNumber, totalRevenueNumber]);

  const overviewVisualTier = useMemo<OverviewVisualTier>(() => {
    const planCode = billingAccess?.currentPlanCode;

    if (planCode === "strategy") return "max";
    if (planCode === "team") return "middle";

    return "minimal";
  }, [billingAccess?.currentPlanCode]);

  const overviewBubbles = useMemo<OverviewBubble[]>(() => {
    const palette = [
      "var(--rivn-bubble-a)",
      "var(--rivn-bubble-b)",
      "var(--rivn-bubble-c)",
      "var(--rivn-bubble-d)",
      "var(--rivn-bubble-e)",
    ];
    const particles: OverviewBubble[] = [];

    const addParticle = (
      left: number,
      top: number,
      size: number,
      index: number,
      depth = 1
    ) => {
      particles.push({
        left,
        top,
        size,
        color: palette[index % palette.length],
        opacity: Math.min(0.98, 0.58 + depth * 0.28),
        depth,
      });
    };

    const wallRows = [
      [214, 24, 8],
      [188, 54, 10],
      [166, 88, 11],
      [144, 124, 10],
      [126, 162, 9],
      [106, 202, 8],
    ];

    wallRows.forEach(([startX, startY, count], row) => {
      Array.from({ length: count }).forEach((_, col) => {
        const index = row * 13 + col;
        const pressure = Math.sin((row + 1) * 0.9 + col * 0.72);
        const depth = 0.72 + ((row + col) % 5) * 0.08;
        addParticle(
          startX + col * 24 + pressure * 9 - row * 8,
          startY + col * 4 + Math.cos(col * 0.8) * 12 + row * 2,
          (10 + ((index * 7) % 24)) * depth,
          index,
          depth
        );
      });
    });

    Array.from({ length: 42 }).forEach((_, index) => {
      const ring = index / 42;
      const angle = index * 2.399;
      const depth = 0.84 + (index % 7) * 0.035;
      const radiusX = 102 + Math.sin(index * 0.37) * 28;
      const radiusY = 78 + Math.cos(index * 0.42) * 20;
      addParticle(
        282 + Math.cos(angle) * radiusX + Math.sin(index * 1.1) * 12,
        132 + Math.sin(angle) * radiusY + ring * 34,
        (14 + ((index * 11) % 34)) * depth,
        index + 80,
        depth
      );
    });

    Array.from({ length: 38 }).forEach((_, index) => {
      const t = index / 37;
      const arc = Math.sin(t * Math.PI * 1.22);
      const depth = 0.54 + (index % 6) * 0.055;
      addParticle(
        -34 + t * 238 + Math.sin(index * 1.7) * 14,
        268 - arc * 76 + Math.cos(index * 0.9) * 10,
        (5 + ((index * 5) % 18)) * depth,
        index + 140,
        depth
      );
    });

    Array.from({ length: 22 }).forEach((_, index) => {
      const angle = index * 2.17;
      const depth = 0.88 + (index % 5) * 0.035;
      particles.push({
        left: 72 + Math.cos(angle) * (62 + (index % 4) * 7) + Math.sin(index * 0.8) * 10,
        top: 264 + Math.sin(angle) * 28 + Math.cos(index * 1.4) * 7,
        size: (12 + ((index * 9) % 24)) * depth,
        color:
          index % 4 === 0
            ? "var(--rivn-bubble-e)"
            : index % 3 === 0
              ? "var(--rivn-bubble-f)"
              : "var(--rivn-bubble-g)",
        opacity: 0.78 + (index % 4) * 0.04,
        depth: depth + 0.08,
      });
    });

    return particles;
  }, []);

  const overviewMetrics = useMemo<
    Array<{ key: OverviewMetricKey; label: string; value: string }>
  >(
    () => [
      {
        key: "revenue",
        label: "Выручка",
        value: formatRub(totalRevenueNumber),
      },
      {
        key: "activeProjects",
        label: "Активные проекты",
        value: isLoadingDashboardKpis ? "..." : String(activeProjectsCount),
      },
      {
        key: "revenuePerClient",
        label: "Выручка на клиента",
        value: formatRub(revenuePerClientNumber),
      },
      {
        key: "stableRevenue",
        label: "Стабильная выручка",
        value: formatRub(stableRevenueNumber),
      },
      {
        key: "ltv",
        label: "LTV факт",
        value: formatRub(factualLtvNumber),
      },
      {
        key: "averageCheck",
        label: "Средний чек",
        value: formatRub(averageCheckNumber),
      },
      {
        key: "profit",
        label: "Прибыль",
        value: formatRub(totalProfitNumber),
      },
      {
        key: "expenses",
        label: "Расходы",
        value: formatRub(totalExpensesNumber),
      },
      {
        key: "fot",
        label: "ФОТ",
        value: formatRub(totalFotNumber),
      },
      {
        key: "tax",
        label: "Налог",
        value: formatRub(taxNumber),
      },
      {
        key: "margin",
        label: "Маржинальность",
        value: `${profitMarginRatio}%`,
      },
    ],
    [
      activeProjectsCount,
      averageCheckNumber,
      factualLtvNumber,
      isLoadingDashboardKpis,
      profitMarginRatio,
      revenuePerClientNumber,
      stableRevenueNumber,
      taxNumber,
      totalExpensesNumber,
      totalFotNumber,
      totalProfitNumber,
      totalRevenueNumber,
    ]
  );

  const selectedOverviewMetrics = useMemo(() => {
    return overviewMetricKeys
      .map((key) => overviewMetrics.find((metric) => metric.key === key))
      .filter((metric): metric is { key: OverviewMetricKey; label: string; value: string } =>
        Boolean(metric)
      );
  }, [overviewMetricKeys, overviewMetrics]);

  const dashboardMetricOptions = useMemo<
    Array<{
      key: DashboardMetricKey;
      label: string;
      value: string;
      hint: string;
      tone: string;
    }>
  >(
    () => [
      {
        key: "revenue",
        label: "Выручка",
        value: formatRub(totalRevenueNumber),
        hint: "поступления за период",
        tone: "#00f5a8",
      },
      {
        key: "profit",
        label: "Прибыль",
        value: formatRub(totalProfitNumber),
        hint: "после расходов, ФОТ и налога",
        tone: "#7c5cff",
      },
      {
        key: "expenses",
        label: "Расходы",
        value: formatRub(totalExpensesNumber),
        hint: "операционные затраты",
        tone: "#ffbf69",
      },
      {
        key: "fot",
        label: "ФОТ",
        value: formatRub(totalFotNumber),
        hint: "зарплаты и выплаты",
        tone: "#43ffc2",
      },
      {
        key: "tax",
        label: "Налог",
        value: formatRub(taxNumber),
        hint: "7% от выручки периода",
        tone: "#f87171",
      },
      {
        key: "averageCheck",
        label: "Средний чек",
        value: formatRub(averageCheckNumber),
        hint: "средняя сумма одной оплаты",
        tone: "#38bdf8",
      },
      {
        key: "revenuePerClient",
        label: "Выручка на клиента",
        value: formatRub(revenuePerClientNumber),
        hint: "выручка на платящего клиента",
        tone: "#c084fc",
      },
    ],
    [
      averageCheckNumber,
      revenuePerClientNumber,
      taxNumber,
      totalExpensesNumber,
      totalFotNumber,
      totalProfitNumber,
      totalRevenueNumber,
    ]
  );

  const selectedMetricWidget = useMemo(() => {
    return (
      dashboardMetricOptions.find((metric) => metric.key === selectedMetricWidgetKey) ??
      dashboardMetricOptions[0]
    );
  }, [dashboardMetricOptions, selectedMetricWidgetKey]);

  const calendarDays = useMemo(() => {
    const monthStart = new Date(
      calendarMonthDate.getFullYear(),
      calendarMonthDate.getMonth(),
      1
    );
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));

    const rangeStart = getDateFromInputValue(customPeriodStartDate);
    const rangeEnd = getDateFromInputValue(customPeriodEndDate);

    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const value = formatDateInputValue(date);
      const isCurrentMonth = date.getMonth() === calendarMonthDate.getMonth();
      const isRangeStart = isSameCalendarDay(date, rangeStart);
      const isRangeEnd = isSameCalendarDay(date, rangeEnd);
      const isInRange = date >= rangeStart && date <= rangeEnd;

      return {
        date,
        value,
        day: date.getDate(),
        isCurrentMonth,
        isRangeStart,
        isRangeEnd,
        isInRange,
        isToday: isSameCalendarDay(date, new Date()),
      };
    });
  }, [calendarMonthDate, customPeriodEndDate, customPeriodStartDate]);

  function toggleOverviewMetric(key: OverviewMetricKey) {
    setOverviewMetricKeys((current) => {
      if (current.includes(key)) {
        return current.length > 1 ? current.filter((item) => item !== key) : current;
      }

      if (current.length >= 2) {
        return [current[1], key];
      }

      return [...current, key];
    });
  }

  function toggleFinancialChartMetric(key: DashboardMetricKey) {
    setSelectedChartMetricKeys((current) => {
      if (current.includes(key)) {
        return current.length > 1 ? current.filter((item) => item !== key) : current;
      }

      if (current.length >= 4) {
        return [...current.slice(1), key];
      }

      return [...current, key];
    });
  }

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
    const selectedRange = getDashboardPeriodRange(
      dashboardPeriod,
      customPeriodStartDate,
      customPeriodEndDate
    );
    const today = getDayStart(new Date());
    const fallbackStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const range = selectedRange ?? { start: fallbackStart, end: today };
    const daysCount =
      Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
    const bucketMode =
      daysCount <= 120 ? "day" : daysCount <= 240 ? "week" : "month";
    const buckets: {
      key: string;
      label: string;
      fullLabel: string;
      start: Date;
      end: Date;
      revenue: number;
      expenses: number;
      fot: number;
      tax: number;
      profit: number;
      averageCheck: number;
      revenuePerClient: number;
      paymentCount: number;
      clientIds: Set<string>;
    }[] = [];

    const createEmptyBucketMetrics = () => ({
      revenue: 0,
      expenses: 0,
      fot: 0,
      tax: 0,
      profit: 0,
      averageCheck: 0,
      revenuePerClient: 0,
      paymentCount: 0,
      clientIds: new Set<string>(),
    });

    if (bucketMode === "day") {
      for (let cursor = new Date(range.start); cursor <= range.end; cursor = addDays(cursor, 1)) {
        buckets.push({
          key: formatDateInputValue(cursor),
          label: getShortDateLabel(cursor),
          fullLabel: cursor.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
          }),
          start: new Date(cursor),
          end: new Date(cursor),
          ...createEmptyBucketMetrics(),
        });
      }
    } else if (bucketMode === "week") {
      let cursor = new Date(range.start);
      let weekIndex = 1;

      while (cursor <= range.end) {
        const start = new Date(cursor);
        const end = addDays(start, 6);
        if (end > range.end) end.setTime(range.end.getTime());

        buckets.push({
          key: `${formatDateInputValue(start)}-${formatDateInputValue(end)}`,
          label: `${weekIndex} нед.`,
          fullLabel: `${getShortDateLabel(start)} — ${getShortDateLabel(end)}`,
          start,
          end,
          ...createEmptyBucketMetrics(),
        });

        cursor = addDays(end, 1);
        weekIndex += 1;
      }
    } else {
      const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);

      while (cursor <= range.end) {
        const start = new Date(cursor);
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

        buckets.push({
          key: getMonthKey(cursor),
          label: getMonthShortLabel(cursor),
          fullLabel: formatMonthLabel(getMonthKey(cursor)),
          start,
          end,
          ...createEmptyBucketMetrics(),
        });

        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const findBucket = (date: Date) =>
      buckets.find((bucket) => date >= bucket.start && date <= bucket.end);

    periodPaidPayments.forEach((payment) => {
      const date = parseDisplayDateToDate(
        formatSupabaseDateToDisplay(payment.paid_date)
      );
      if (!date) return;

      const target = findBucket(date);
      if (!target) return;

      target.revenue += Number(payment.amount || 0);
      target.paymentCount += 1;
      if (payment.client_id) {
        target.clientIds.add(payment.client_id);
      }
    });

    periodExpenses.forEach((expense) => {
      const date = parseDisplayDateToDate(
        formatSupabaseDateToDisplay(expense.expense_date)
      );
      if (!date) return;

      const target = findBucket(date);
      if (!target) return;

      target.expenses += Number(expense.amount || 0);
    });

    periodPayrollPayouts.forEach((item) => {
      const date = parseDisplayDateToDate(item.payoutDate);
      if (!date) return;

      const target = findBucket(date);
      if (!target) return;

      target.fot += parseRubString(item.amount);
    });

    periodPayrollExtraPayments.forEach((item) => {
      const date = parseDisplayDateToDate(item.date);
      if (!date) return;

      const target = findBucket(date);
      if (!target) return;

      target.fot += parseRubString(item.amount);
    });

    buckets.forEach((item) => {
      const tax = item.revenue * 0.07;
      item.tax = tax;
      item.profit = item.revenue - item.expenses - item.fot - tax;
      item.averageCheck =
        item.paymentCount > 0 ? item.revenue / item.paymentCount : 0;
      item.revenuePerClient =
        item.clientIds.size > 0 ? item.revenue / item.clientIds.size : 0;
    });

    return buckets.map(({ label, fullLabel, revenue, expenses, fot, tax, profit, averageCheck, revenuePerClient }) => ({
      label,
      fullLabel,
      revenue,
      expenses,
      fot,
      tax,
      profit,
      averageCheck,
      revenuePerClient,
    }));
  }, [
    dashboardPeriod,
    customPeriodStartDate,
    customPeriodEndDate,
    periodPaidPayments,
    periodExpenses,
    periodPayrollPayouts,
    periodPayrollExtraPayments,
  ]);

  const chartPaths = useMemo(() => {
    const width = 540;
    const top = 16;
    const bottom = 132;
    const values = financialChartData.flatMap((item) =>
      selectedChartMetricKeys.map((key) =>
        key === "profit" ? Math.max(0, item[key]) : item[key]
      )
    );
    const maxValue = Math.max(1, ...values);

    const makePoints = (key: DashboardMetricKey) =>
      financialChartData.map((item, index) => {
        const x = 10 + (index * width) / Math.max(1, financialChartData.length - 1);
        const rawValue = key === "profit" ? Math.max(0, item[key]) : item[key];
        const y = bottom - (rawValue / maxValue) * (bottom - top);
        return {
          x,
          y,
          label: item.label,
          fullLabel: item.fullLabel,
          value: item[key],
        };
      });

    const makePath = (points: Array<{ x: number; y: number }>) =>
      points
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(" ");

    const points = Object.fromEntries(
      dashboardMetricOptions.map((metric) => [metric.key, makePoints(metric.key)])
    ) as Record<DashboardMetricKey, ReturnType<typeof makePoints>>;
    const paths = Object.fromEntries(
      dashboardMetricOptions.map((metric) => [metric.key, makePath(points[metric.key])])
    ) as Record<DashboardMetricKey, string>;
    const firstMetric = selectedChartMetricKeys[0] ?? "revenue";
    const secondMetric = selectedChartMetricKeys[1];
    const labelStep = Math.max(1, Math.ceil(financialChartData.length / 7));

    return {
      paths,
      area:
        secondMetric
          ? `${paths[firstMetric]} ` +
        `${points[secondMetric]
          .slice()
          .reverse()
          .map((point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
          .join(" ")} Z`
          : "",
      metric: (key: DashboardMetricKey) => paths[key],
      points,
      metricPoints: (key: DashboardMetricKey) => points[key],
      labels: financialChartData.map((item, index) => ({
        label: item.label,
        x: 10 + (index * width) / Math.max(1, financialChartData.length - 1),
        isVisible:
          index === 0 ||
          index === financialChartData.length - 1 ||
          index % labelStep === 0,
      })),
    };
  }, [dashboardMetricOptions, financialChartData, selectedChartMetricKeys]);

  const financialChartHeading = useMemo(() => {
    return (
      dashboardMetricOptions.find((metric) => metric.key === selectedChartMetricKeys[0])
        ?.label ?? "Выручка"
    );
  }, [dashboardMetricOptions, selectedChartMetricKeys]);

  const financialChartMainValue = useMemo(() => {
    return (
      dashboardMetricOptions.find((metric) => metric.key === selectedChartMetricKeys[0])
        ?.value ?? formatRub(totalRevenueNumber)
    );
  }, [dashboardMetricOptions, selectedChartMetricKeys, totalRevenueNumber]);

  const dashboardPlanRange = useMemo(() => {
    return getDashboardPeriodRange(
      dashboardPeriod,
      customPeriodStartDate,
      customPeriodEndDate
    );
  }, [dashboardPeriod, customPeriodStartDate, customPeriodEndDate]);

  const dashboardPeriodPlans = useMemo(() => {
    return monthlyPlans as SupabaseMonthlyPlan[];
  }, [monthlyPlans]);

  const planProgressItems = useMemo(() => {
    const revenuePlan = getProratedMonthlyPlanTotal(
      dashboardPeriodPlans,
      dashboardPlanRange,
      "revenue"
    );
    const profitPlan = getProratedMonthlyPlanTotal(
      dashboardPeriodPlans,
      dashboardPlanRange,
      "profit"
    );
    const expensesPlan = getProratedMonthlyPlanTotal(
      dashboardPeriodPlans,
      dashboardPlanRange,
      "expenses"
    );
    const fotPlan = getProratedMonthlyPlanTotal(
      dashboardPeriodPlans,
      dashboardPlanRange,
      "fot"
    );

    return [
      {
        label: "Выручка",
        value: totalRevenueNumber,
        plan: revenuePlan,
      },
      {
        label: "Прибыль",
        value: Math.max(0, totalProfitNumber),
        plan: profitPlan,
      },
      {
        label: "Расходы",
        value: totalExpensesNumber,
        plan: expensesPlan,
      },
      {
        label: "ФОТ",
        value: totalFotNumber,
        plan: fotPlan,
      },
    ]
      .filter((item) => item.plan > 0)
      .map((item) => ({
        ...item,
        progress: Math.min(
          100,
          Math.round((Number(item.value) / Number(item.plan)) * 100)
        ),
      }));
  }, [
    dashboardPeriodPlans,
    dashboardPlanRange,
    totalExpensesNumber,
    totalFotNumber,
    totalProfitNumber,
    totalRevenueNumber,
  ]);

  const planProgressAverage = useMemo(() => {
    if (planProgressItems.length === 0) return 0;
    return Math.round(
      planProgressItems.reduce((sum, item) => sum + item.progress, 0) /
        planProgressItems.length
    );
  }, [planProgressItems]);

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
        title: `Просрочено ${overdueInvoices.length} счёт(ов)`,
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
      value: isLoadingDashboardKpis ? "..." : String(activeClientsCount),
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

  const dashboardSummary = useMemo(() => {
    const hasRevenue = totalRevenueNumber > 0;
    const profitLabel = totalProfitNumber >= 0 ? "в плюсе" : "в минусе";
    const overdueLabel =
      overdueInvoices.length > 0
        ? `${overdueInvoices.length} просроч.`
        : "просрочек нет";
    const costLabel =
      expenseSharePercent >= 45 || fotSharePercent >= 35
        ? "затраты требуют внимания"
        : "затраты в норме";

    if (!hasRevenue) {
      return "Пока мало финансовых данных. Добавь оплаты, расходы и план, чтобы дашборд стал управленческой картиной.";
    }

    return `Бизнес ${profitLabel}: маржа ${profitMarginRatio}%, ${overdueLabel}, ${costLabel}.`;
  }, [
    totalRevenueNumber,
    totalProfitNumber,
    overdueInvoices.length,
    expenseSharePercent,
    fotSharePercent,
    profitMarginRatio,
  ]);

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

  const isBasicSettingsConfigured = Boolean(
    workspace?.id &&
      String(workspace?.name ?? "").trim() &&
      membership?.role &&
      (profile?.email || user?.email)
  );

  const onboardingSteps = useMemo<OnboardingStep[]>(() => {
    return [
      {
        title: "Заполнить настройки",
        description:
          "Выставь свои значения по важным параметрам, добавь сотрудников и распредели роли.",
        href: "/settings",
        isDone: isBasicSettingsConfigured,
      },
      {
        title: "Добавить клиентов",
        description: "Клиенты нужны, чтобы видеть выручку, LTV и риски.",
        href: "/clients",
        isDone: (clients as StoredClient[]).length > 0,
      },
      {
        title: "Создать проекты",
        description: "Проекты связывают клиентов, задачи, деньги и команду.",
        href: "/projects",
        isDone: projects.length > 0,
      },
      {
        title: "Зафиксировать оплаты",
        description: "После оплат дашборд начинает показывать реальную выручку.",
        href: "/payments",
        isDone: paidPayments.length > 0,
      },
      {
        title: "Внести расходы",
        description: "Расходы нужны для честной прибыли и P&L.",
        href: "/expenses",
        isDone: (expenses as SupabaseExpenseItem[]).length > 0,
      },
      {
        title: "Заполнить план",
        description: "План / факт покажет, идёшь ли ты к цели месяца.",
        href: "/analytics?tab=planfact",
        isDone: monthlyPlans.length > 0,
      },
    ];
  }, [
    clients,
    projects,
    paidPayments,
    expenses,
    monthlyPlans,
    isBasicSettingsConfigured,
  ]);

  const shouldShowOnboarding =
    !isLoadingDashboardKpis &&
    !isOnboardingDismissed &&
    onboardingSteps.some((step) => !step.isDone);
  const shouldShowOnboardingLauncher =
    !isLoadingDashboardKpis &&
    isOnboardingDismissed &&
    onboardingSteps.some((step) => !step.isDone);

  function dismissOnboarding() {
    setIsOnboardingDismissed(true);
    window.localStorage.setItem("rivn-dashboard-onboarding-dismissed", "1");
  }

  function showOnboarding() {
    setIsOnboardingDismissed(false);
    window.localStorage.removeItem("rivn-dashboard-onboarding-dismissed");
  }

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
    <main className="dashboard-theme-root relative flex-1 overflow-hidden bg-[#07111f] text-[#101827]">
      <div
        aria-hidden="true"
        className="dashboard-theme-backdrop pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(0,245,168,0.22),transparent_30%),radial-gradient(circle_at_76%_0%,rgba(124,92,255,0.24),transparent_34%),radial-gradient(circle_at_50%_90%,rgba(14,165,233,0.16),transparent_38%),linear-gradient(180deg,#07111f_0%,#0a1525_42%,#101827_100%)]"
      />
      <div
        aria-hidden="true"
        className="dashboard-theme-aura pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#7c5cff]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:84px_84px] opacity-45"
      />

      <div className="relative z-10">
        <div className="mx-auto w-full max-w-none space-y-4 px-3 py-3 sm:px-4 lg:px-5">
          <div className="flex flex-col gap-3 rounded-[28px] border border-white/12 bg-white/[0.08] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 px-1">
              <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-white/42" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по клиентам, проектам, расходам и задачам"
                className="h-12 w-full rounded-full border border-white/10 bg-white/[0.07] py-3 pl-12 pr-5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] outline-none placeholder:text-white/36 focus:border-[#00f5a8]/45 focus:bg-white/[0.10]"
              />
              {searchQuery.trim() ? (
                <div className="absolute left-1 right-1 top-[58px] z-50 rounded-[26px] border border-white/12 bg-[#08111f]/96 p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
                  <div className="px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/38">
                    Быстрый поиск
                  </div>
                  <div className="grid gap-2">
                    {[
                      `${activeClientsCount} клиентов в базе`,
                      `${activeProjectsCount} активных проектов`,
                      `${filteredRootTasks.length} задач в работе`,
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/76 ring-1 ring-white/8"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/guide"
                className="flex h-12 items-center rounded-full bg-white/10 px-5 text-sm font-medium text-white/86 shadow-[0_14px_34px_rgba(0,0,0,0.14)] ring-1 ring-white/10 transition hover:bg-white/16"
              >
                Инструкция
              </Link>

              <a
                href="https://t.me/thebestweis"
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center rounded-full bg-white/10 px-5 text-sm font-medium text-white/86 shadow-[0_14px_34px_rgba(0,0,0,0.14)] ring-1 ring-white/10 transition hover:bg-white/16"
              >
                TG основателя
              </a>

              <a
                href="https://t.me/thebestweis"
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center rounded-full bg-[#00f5a8] px-5 text-sm font-medium text-[#06101d] shadow-[0_14px_34px_rgba(0,245,168,0.28)] transition hover:bg-[#43ffc2]"
              >
                Поддержка
              </a>

              <button
                type="button"
                onClick={handleLogout}
                className="flex h-12 items-center rounded-full bg-white/10 px-5 text-sm font-medium text-white/86 shadow-[0_14px_34px_rgba(0,0,0,0.14)] ring-1 ring-white/10 transition hover:bg-white/16"
              >
                Выйти
              </button>
            </div>
          </div>
        {!isAppContextLoading && !canManageDashboardFinance ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            У тебя ограниченный режим дашборда. Финансовые быстрые действия скрыты.
          </div>
        ) : null}

        {shouldShowOnboarding ? (
          <OnboardingChecklist
            steps={onboardingSteps}
            onDismiss={dismissOnboarding}
          />
        ) : null}

        {shouldShowOnboardingLauncher ? (
          <button
            type="button"
            onClick={showOnboarding}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
          >
            Показать быстрый старт
          </button>
        ) : null}

        <section className="dashboard-content-shell relative min-h-[calc(100vh-108px)] overflow-hidden rounded-[46px] border border-white/12 bg-[#0b1422]/82 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-6">
          <div className="min-w-0">
              <div className="flex justify-end">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarSelectionAnchor(null);
                        setIsCalendarOpen((value) => !value);
                      }}
                      className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition ${
                        isCalendarOpen || dashboardPeriod === "custom"
                          ? "bg-[#00f5a8] text-[#06101d]"
                          : "bg-[#08111f] text-white"
                      }`}
                      aria-label="Выбрать период"
                    >
                      <CalendarDays className="h-5 w-5" />
                    </button>
                    {isCalendarOpen ? (
                      <div className="absolute right-0 top-[64px] z-50 w-[430px] max-w-[calc(100vw-40px)] rounded-[30px] border border-white/12 bg-[#08111f]/96 p-4 text-white shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                        <div className="grid grid-cols-5 gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
                          {[
                            ["30d", "Месяц"],
                            ["90d", "Квартал"],
                            ["custom", "Полгода"],
                            ["year", "Год"],
                            ["all", "Все"],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                if (value === "year") {
                                  const end = new Date();
                                  const start = new Date();
                                  start.setFullYear(end.getFullYear() - 1);
                                  setCustomPeriodStartDate(formatDateInputValue(start));
                                  setCustomPeriodEndDate(formatDateInputValue(end));
                                  setCalendarSelectionAnchor(null);
                                  setDashboardPeriod("custom");
                                  return;
                                }

                                if (value === "custom") {
                                  const end = new Date();
                                  const start = new Date();
                                  start.setMonth(end.getMonth() - 6);
                                  setCustomPeriodStartDate(formatDateInputValue(start));
                                  setCustomPeriodEndDate(formatDateInputValue(end));
                                  setCalendarSelectionAnchor(null);
                                  setDashboardPeriod("custom");
                                  return;
                                }

                                setCalendarSelectionAnchor(null);
                                setDashboardPeriod(value as "30d" | "90d" | "all");
                              }}
                              className={`h-10 rounded-full text-sm font-medium transition ${
                                (value === dashboardPeriod || (value === "year" && dashboardPeriod === "custom"))
                                  ? "bg-[#00f5a8] text-[#06101d] shadow-[0_10px_24px_rgba(0,245,168,0.18)]"
                                  : "text-white/62 hover:bg-white/[0.08] hover:text-white"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {[
                            ["С", customPeriodStartDate],
                            ["По", customPeriodEndDate],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-[20px] border border-white/10 bg-white/[0.055] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                            >
                              <div className="text-xs uppercase tracking-[0.14em] text-white/36">{label}</div>
                              <div className="mt-2 text-base font-medium text-white">{formatShortDisplayDate(String(value))}</div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Date(calendarMonthDate);
                              next.setMonth(next.getMonth() - 1);
                              setCalendarMonthDate(next);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-xl text-white/72 ring-1 ring-white/10 transition hover:bg-white/[0.12]"
                            aria-label="Предыдущий месяц"
                          >
                            ‹
                          </button>
                          <div className="text-base font-semibold capitalize tracking-[-0.02em]">
                            {formatCalendarMonthTitle(calendarMonthDate)}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Date(calendarMonthDate);
                              next.setMonth(next.getMonth() + 1);
                              setCalendarMonthDate(next);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-xl text-white/72 ring-1 ring-white/10 transition hover:bg-white/[0.12]"
                            aria-label="Следующий месяц"
                          >
                            ›
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-white/38">
                          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                            <div key={day}>{day}</div>
                          ))}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-2">
                          {calendarDays.map((day) => (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => {
                                const clicked = getDateFromInputValue(day.value);
                                const anchorValue = calendarSelectionAnchor;

                                if (!anchorValue) {
                                  setCustomPeriodStartDate(day.value);
                                  setCustomPeriodEndDate(day.value);
                                  setCalendarSelectionAnchor(day.value);
                                  return;
                                }

                                const anchor = getDateFromInputValue(anchorValue);

                                if (clicked < anchor) {
                                  setCustomPeriodStartDate(day.value);
                                  setCustomPeriodEndDate(anchorValue);
                                } else {
                                  setCustomPeriodStartDate(anchorValue);
                                  setCustomPeriodEndDate(day.value);
                                }

                                setCalendarSelectionAnchor(null);
                              }}
                              className={`relative h-10 rounded-2xl text-sm font-medium transition ${
                                day.isRangeStart || day.isRangeEnd
                                  ? "bg-[#00f5a8] text-[#06101d] shadow-[0_10px_24px_rgba(0,245,168,0.18)]"
                                  : day.isInRange
                                  ? "bg-[#00f5a8]/22 text-[#b8ffe8] ring-1 ring-[#00f5a8]/14"
                                  : day.isCurrentMonth
                                  ? "bg-white/[0.055] text-white/74 hover:bg-white/[0.10]"
                                  : "text-white/20 hover:bg-white/[0.04]"
                              }`}
                            >
                              {day.day}
                              {day.isToday ? (
                                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" />
                              ) : null}
                            </button>
                          ))}
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPeriodStartDate(getDefaultCustomStartDate());
                              setCustomPeriodEndDate(getDefaultCustomEndDate());
                              setCalendarSelectionAnchor(null);
                              setCalendarMonthDate(getDateFromInputValue(getDefaultCustomEndDate()));
                            }}
                            className="h-11 rounded-full bg-white/[0.07] text-sm text-white/70 ring-1 ring-white/10 transition hover:bg-white/[0.11]"
                          >
                            Сбросить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCalendarSelectionAnchor(null);
                              setIsCalendarOpen(false);
                            }}
                            className="h-11 rounded-full bg-white/[0.07] text-sm text-white/70 ring-1 ring-white/10 transition hover:bg-white/[0.11]"
                          >
                            Отменить
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDashboardPeriod("custom");
                              setCalendarSelectionAnchor(null);
                              setIsCalendarOpen(false);
                            }}
                            className="h-11 rounded-full bg-[#00f5a8] text-sm font-medium text-[#06101d] shadow-[0_14px_30px_rgba(0,245,168,0.22)] transition hover:bg-[#43ffc2]"
                          >
                            Показать
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {[
                    ["30d", "30 дней"],
                    ["90d", "90 дней"],
                    ["all", "Всё"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDashboardPeriod(value as "30d" | "90d" | "all")}
                      className={`h-14 rounded-full px-6 text-sm font-medium shadow-[0_16px_40px_rgba(0,0,0,0.07)] transition ${
                        dashboardPeriod === value
                          ? "bg-[#00f5a8] text-[#06101d] shadow-[0_16px_40px_rgba(0,245,168,0.20)]"
                          : "bg-white/10 text-white/78 ring-1 ring-white/10 backdrop-blur-xl hover:bg-white/14"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-[0.95fr_1fr_1fr] lg:grid-rows-[350px_350px]">
                <div
                  className="dashboard-overview-card group/overview relative h-full min-h-[720px] w-full overflow-hidden rounded-[34px] border border-[#00f5a8]/18 bg-[linear-gradient(145deg,#0d1a2a_0%,#101827_46%,#07111f_100%)] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,245,168,0.08),0_28px_84px_rgba(0,0,0,0.34)] transition-all duration-700 ease-out hover:-translate-y-1 hover:border-[#00f5a8]/32 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,245,168,0.12),0_36px_110px_rgba(0,245,168,0.13),0_34px_90px_rgba(0,0,0,0.36)] lg:col-start-1 lg:row-span-2 lg:row-start-1"
                  onMouseMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const x = (event.clientX - rect.left) / rect.width - 0.5;
                    const y = (event.clientY - rect.top) / rect.height - 0.5;

                    event.currentTarget.style.setProperty("--overview-x", x.toFixed(3));
                    event.currentTarget.style.setProperty("--overview-y", y.toFixed(3));
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.setProperty("--overview-x", "0");
                    event.currentTarget.style.setProperty("--overview-y", "0");
                  }}
                >
                  <div className="relative z-[80] flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-medium tracking-[-0.04em] text-white">Ключевые показатели</h2>
                      <div className="mt-1 text-xs text-white/45">Состояние бизнеса за период</div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsOverviewSettingsOpen((value) => !value)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-[26px] font-light leading-none text-white shadow-[0_14px_30px_rgba(0,0,0,0.20)] ring-1 ring-white/12 backdrop-blur-xl transition hover:bg-white/18"
                        aria-label="Настроить обзор"
                      >
                        <Settings className="h-5 w-5" />
                      </button>
                      {isOverviewSettingsOpen ? (
                        <div className="absolute right-0 top-[56px] z-[90] max-h-[320px] w-72 overflow-auto rounded-[24px] border border-white/12 bg-[#08111f]/96 p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                          <div className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-white/42">
                            Выбери 2 показателя
                          </div>
                          <div className="grid gap-1">
                            {overviewMetrics.map((metric) => {
                              const isChecked = overviewMetricKeys.includes(metric.key);

                              return (
                                <button
                                  key={metric.key}
                                  type="button"
                                  onClick={() => toggleOverviewMetric(metric.key)}
                                  className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                                    isChecked
                                      ? "bg-[#00f5a8] text-[#06101d]"
                                      : "text-white/72 hover:bg-white/8"
                                  }`}
                                >
                                  <span>{metric.label}</span>
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-md border text-[10px] ${
                                      isChecked
                                        ? "border-[#06101d]/20 bg-[#06101d]/10"
                                        : "border-white/18"
                                    }`}
                                  >
                                    {isChecked ? "✓" : ""}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div aria-hidden="true" className="dashboard-overview-orb-left absolute -left-24 top-[150px] h-[330px] w-[330px] rounded-full bg-[#00f5a8]/22 transition-transform duration-1000 ease-out group-hover/overview:-translate-x-3 group-hover/overview:translate-y-4 group-hover/overview:scale-105" />
                  <div aria-hidden="true" className="dashboard-overview-orb-right absolute right-2 top-12 h-[250px] w-[250px] rounded-full bg-[#7c5cff]/18 transition-transform duration-1000 ease-out group-hover/overview:translate-x-4 group-hover/overview:-translate-y-3 group-hover/overview:scale-110" />
                  <div aria-hidden="true" className="absolute left-[18px] top-[28px] z-10 h-[340px] w-[390px] origin-top-left scale-[1.16] transition-transform duration-700 ease-out group-hover/overview:translate-x-2 group-hover/overview:-translate-y-3 group-hover/overview:scale-[1.19] 2xl:scale-[1.24] 2xl:group-hover/overview:scale-[1.27]">
                    {overviewBubbles.map(({ left, top, size, color, opacity, depth }, index) => (
                      <span
                        key={`${left}-${top}-${size}-${index}`}
                        className="absolute rounded-full transition-transform duration-500 ease-out group-hover/overview:scale-[1.04]"
                        style={{
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${size}px`,
                          height: `${size}px`,
                          transform: `translate3d(calc(var(--overview-x, 0) * ${Math.round(depth * 34)}px), calc(var(--overview-y, 0) * ${Math.round(depth * 34)}px), 0)`,
                          opacity: Number(opacity),
                          zIndex: Math.round(depth * 100),
                          filter: depth < 0.68 ? "blur(0.45px)" : "none",
                          background: `radial-gradient(circle at 30% 30%, rgba(222,255,244,0.96) 0%, ${color} 42%, #075e54 100%)`,
                          boxShadow:
                            "inset -6px -8px 14px rgba(0,0,0,0.16), inset 5px 6px 12px rgba(255,255,255,0.32), 0 8px 18px rgba(0,245,168,0.18)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="dashboard-overview-glass absolute bottom-[13px] left-[7px] right-[7px] top-[300px] z-30 overflow-hidden rounded-[28px] border border-white/24 bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(255,255,255,0.15)_48%,rgba(0,245,168,0.18)_100%)] p-[22px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(255,255,255,0.12),0_22px_56px_rgba(0,0,0,0.24)] backdrop-blur-[30px] transition-all duration-700 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.42),transparent_34%),radial-gradient(circle_at_48%_0%,rgba(0,245,168,0.24),transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.16),transparent_48%)] group-hover/overview:border-white/34 group-hover/overview:bg-[linear-gradient(135deg,rgba(255,255,255,0.40),rgba(255,255,255,0.18)_48%,rgba(0,245,168,0.22)_100%)] group-hover/overview:shadow-[inset_0_1px_0_rgba(255,255,255,0.50),inset_0_-1px_0_rgba(255,255,255,0.15),0_28px_70px_rgba(0,245,168,0.12),0_22px_56px_rgba(0,0,0,0.24)]">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.30)_0%,rgba(118,102,255,0.18)_36%,rgba(0,245,168,0.08)_66%,transparent_100%)] backdrop-blur-[18px] [mask-image:linear-gradient(180deg,#000_0%,rgba(0,0,0,0.82)_42%,transparent_100%)]"
                    />
                    <div className="relative z-10 flex items-start justify-end">
                      <Link href="/analytics" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/14 shadow-[0_12px_30px_rgba(0,0,0,0.18)] ring-1 ring-white/12 backdrop-blur-xl transition hover:bg-[#00f5a8] hover:text-[#06101d]">
                        <ArrowUpRight className="h-5 w-5" />
                      </Link>
                    </div>
                    <div className="relative z-10 mt-[58px] grid grid-cols-2 border-b border-white/[0.08] pb-[30px]">
                      {selectedOverviewMetrics.map((metric, index) => (
                        <div
                          key={metric.key}
                          className={index === 0 ? "border-r border-white/[0.08] pr-6" : "pl-9"}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[38px] font-light leading-none tracking-[-0.085em]">
                              {metric.value}
                            </div>
                            <div className="mt-2 truncate text-sm text-white/52">{metric.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="relative z-10 grid h-[166px] grid-cols-4 items-end gap-4 pt-[22px]">
                      {overviewPeriodBars.map((bar) => {
                        const isValue = bar.type === "value";
                        const isPositive = isValue ? bar.isPositive : true;

                        return (
                          <div
                            key={bar.key}
                            className={`flex h-full flex-col ${
                              bar.align === "start" ? "justify-start pt-5" : "justify-end"
                            }`}
                          >
                            <div
                              className={`flex flex-col px-3 ${
                                isValue ? "justify-start py-4 text-[#06101d]" : "justify-center text-white"
                              } ${
                                bar.align === "start" ? "rounded-[17px]" : "rounded-t-[17px]"
                              } ${
                                isValue
                                  ? isPositive
                                    ? "bg-[linear-gradient(180deg,#43ffc2_0%,#00f5a8_58%,#02c98b_100%)] shadow-[0_14px_30px_rgba(0,245,168,0.26)]"
                                    : "bg-[linear-gradient(180deg,#a78bfa_0%,#7c5cff_58%,#5b45d9_100%)] text-white shadow-[0_14px_30px_rgba(124,92,255,0.26)]"
                                  : "bg-white/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.20)] ring-1 ring-white/8"
                              }`}
                              style={{ height: bar.height }}
                            >
                              <span className="truncate text-[17px] font-light tracking-[-0.06em]">
                                {bar.value}
                              </span>
                              <span
                                className={`mt-1 truncate text-xs ${
                                  isValue
                                    ? isPositive
                                      ? "text-[#06101d]/58"
                                      : "text-white/68"
                                    : "text-white/42"
                                }`}
                              >
                                {bar.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="contents">
                <div className="relative flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-[#00f5a8]/18 bg-[linear-gradient(145deg,rgba(0,245,168,0.16),rgba(255,255,255,0.045)_48%,rgba(124,92,255,0.10))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_24px_70px_rgba(0,245,168,0.10)] backdrop-blur-xl">
                  <div aria-hidden="true" className="absolute -right-20 -top-16 h-44 w-44 rounded-full bg-[#00f5a8]/18 blur-3xl" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-medium tracking-[-0.04em]">Активные задачи</h2>
                      <div className="mt-1 text-xs text-white/45">{selectedTaskMemberName}</div>
                    </div>
                    <div className="relative flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsTaskWidgetSettingsOpen((value) => !value)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/9 text-white/82 ring-1 ring-white/10 transition hover:bg-white/14"
                        aria-label="Настроить блок активных задач"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                      <Link
                        href="/tasks"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/9 text-white/82 ring-1 ring-white/10 transition hover:bg-[#00f5a8] hover:text-[#06101d]"
                        aria-label="Открыть все задачи"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      {isTaskWidgetSettingsOpen ? (
                        <div className="absolute right-0 top-[52px] z-30 w-64 rounded-[22px] border border-white/12 bg-[#08111f]/96 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTaskMemberId("all");
                              setIsTaskWidgetSettingsOpen(false);
                            }}
                            className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                              selectedTaskMemberId === "all"
                                ? "bg-[#00f5a8] text-[#06101d]"
                                : "text-white/72 hover:bg-white/8"
                            }`}
                          >
                            Все агентство
                          </button>
                          {taskMembers.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                setSelectedTaskMemberId(member.id);
                                setIsTaskWidgetSettingsOpen(false);
                              }}
                              className={`mt-1 w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                                selectedTaskMemberId === member.id
                                  ? "bg-[#00f5a8] text-[#06101d]"
                                  : "text-white/72 hover:bg-white/8"
                              }`}
                            >
                              {member.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="relative z-10 mt-5 grid grid-cols-[1fr_auto] items-end gap-5">
                    <div>
                      <div className="text-sm text-white/48">На сегодня</div>
                      <div className="text-5xl font-light tracking-[-0.07em]">{todayTasks.length}</div>
                      <div className="mt-2 text-sm text-white/48">Всего задач: {filteredRootTasks.length}</div>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                      <div className="text-3xl font-light tracking-[-0.06em]">{activeTasks.length}</div>
                      <div className="text-xs text-white/44">активных</div>
                    </div>
                  </div>
                  <div className="relative z-10 mt-auto flex h-32 items-end gap-3 pt-5">
                    {taskActivityChart.map((day) => (
                      <div key={day.key} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-3">
                        <div
                          className={`pointer-events-none absolute bottom-[calc(100%+10px)] z-40 w-[168px] rounded-2xl border border-white/12 bg-[#08111f]/96 px-3 py-2 text-center text-xs text-white/78 opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl transition group-hover:opacity-100 ${
                            day.tooltipAlign === "left"
                              ? "left-0"
                              : day.tooltipAlign === "right"
                              ? "right-0"
                              : "left-1/2 -translate-x-1/2"
                          }`}
                        >
                          <div className="font-medium text-white">{day.fullLabel}</div>
                          <div className="mt-1">Задач: {day.dueCount}</div>
                          <div>Закрыто: {day.doneCount}</div>
                          <div className="text-[#43ffc2]">{day.doneRatio}% выполнено</div>
                        </div>
                        <div className="relative flex h-full w-full items-end justify-center">
                          <div
                            className={`absolute bottom-0 h-px w-full rounded-full bg-white/12 transition ${
                              day.isToday ? "bg-[#00f5a8]/32" : "group-hover:bg-white/20"
                            }`}
                          />
                          <div
                            className={`relative w-[72%] overflow-hidden rounded-[18px] transition ${
                              day.dueCount > 0
                                ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.055))] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-18px_34px_rgba(2,8,23,0.20)] ring-1"
                                : "bg-transparent ring-0"
                            } ${
                              day.isToday
                                ? "ring-[#00f5a8]/38 shadow-[0_0_32px_rgba(0,245,168,0.16),inset_0_1px_0_rgba(255,255,255,0.16)]"
                                : "ring-white/10 group-hover:ring-white/22"
                            }`}
                            style={{ height: `${day.height}%` }}
                          >
                            {day.dueCount > 0 ? (
                              <div
                                className="absolute bottom-0 left-0 right-0 rounded-[18px] bg-[linear-gradient(180deg,#5fffd2_0%,#19eeb2_58%,#00c997_100%)] shadow-[0_0_18px_rgba(0,245,168,0.20),inset_0_1px_0_rgba(255,255,255,0.32)] transition-all"
                                style={{ height: `${day.doneRatio}%` }}
                              />
                            ) : null}
                            {day.isToday ? (
                              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.42)_0_2px,transparent_2px_7px)]" />
                            ) : null}
                          </div>
                        </div>
                        <div className="text-xs text-white/42">{day.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="relative z-10 mt-4 flex items-center justify-between text-xs text-white/42">
                    <span>Высота — задач на день</span>
                    <span>Заливка — закрыто</span>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col rounded-[30px] border border-[#7c5cff]/22 bg-[linear-gradient(145deg,rgba(124,92,255,0.16),rgba(255,255,255,0.045)_52%,rgba(0,245,168,0.06))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_24px_70px_rgba(124,92,255,0.10)] backdrop-blur-xl">
                  <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-medium tracking-[-0.04em]">Финансовая динамика</h2>
                      <div className="mt-6 text-sm text-white/48">{financialChartHeading}</div>
                      <div className="text-5xl font-light tracking-[-0.07em]">
                        {financialChartMainValue}
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsFinancialChartSettingsOpen((value) => !value)}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/9 text-white/82 ring-1 ring-white/10 transition hover:bg-white/14"
                        aria-label="Настроить график"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                      {isFinancialChartSettingsOpen ? (
                        <div className="absolute right-0 top-[56px] z-50 w-64 rounded-[22px] border border-white/12 bg-[#08111f]/96 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                          <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                            Выбери до 4 линий
                          </div>
                          {dashboardMetricOptions.map((metric) => {
                            const isSelected = selectedChartMetricKeys.includes(metric.key);

                            return (
                              <button
                                key={metric.key}
                                type="button"
                                onClick={() => toggleFinancialChartMetric(metric.key)}
                                className={`mb-1 flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                                  isSelected
                                    ? "bg-[#00f5a8] text-[#06101d]"
                                    : "text-white/72 hover:bg-white/8"
                                }`}
                              >
                                <span>{metric.label}</span>
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                                    isSelected
                                      ? "border-[#06101d]/20 bg-[#06101d]/10"
                                      : "border-white/18"
                                  }`}
                                >
                                  {isSelected ? "✓" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="relative mt-auto h-32">
                    <svg viewBox="0 0 560 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                      {selectedChartMetricKeys.map((key) => {
                        const metric = dashboardMetricOptions.find((item) => item.key === key);

                        return (
                          <path
                            key={key}
                            d={chartPaths.paths[key]}
                            fill="none"
                            stroke={metric?.tone ?? "#4ff4c0"}
                            strokeWidth="3"
                            strokeLinejoin="miter"
                            opacity="0.78"
                          />
                        );
                      })}
                      <path d={chartPaths.area} fill="url(#lines)" opacity={selectedChartMetricKeys.length > 1 ? "0.55" : "0"} />
                      {chartPaths.labels
                        .filter((item) => item.isVisible)
                        .map((item) => (
                          <text key={`${item.label}-${item.x}`} x={item.x} y="148" textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="11">
                            {item.label}
                          </text>
                        ))}
                      <defs>
                        <pattern id="lines" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                          <line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff" strokeWidth="3" opacity="0.26" />
                        </pattern>
                      </defs>
                    </svg>
                    {[
                      ...selectedChartMetricKeys.map((key) => {
                        const metric = dashboardMetricOptions.find((item) => item.key === key);

                        return {
                          key,
                          label: metric?.label ?? key,
                          color: metric?.tone ?? "#4ff4c0",
                          points: chartPaths.points[key],
                        };
                      }),
                    ]
                      .filter(Boolean)
                      .flatMap((series) =>
                        series!.points.map((point) => (
                          <div
                            key={`${series!.key}-${point.fullLabel}`}
                            className="group absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-default"
                            style={{
                              left: `${(point.x / 560) * 100}%`,
                              top: `${(point.y / 150) * 100}%`,
                            }}
                          >
                            <div
                              className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 shadow-[0_0_18px_rgba(0,245,168,0.18)] opacity-0 transition group-hover:opacity-100"
                              style={{ backgroundColor: series!.color }}
                            />
                            <div className="pointer-events-none absolute bottom-[30px] left-1/2 z-30 w-40 -translate-x-1/2 rounded-2xl border border-white/12 bg-[#08111f]/96 px-3 py-2 text-xs text-white/76 opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl transition group-hover:opacity-100">
                              <div className="font-medium text-white">{series!.label}</div>
                              <div className="mt-1">{point.fullLabel}</div>
                              <div className="mt-1 text-[#43ffc2]">{formatRub(point.value)}</div>
                            </div>
                          </div>
                        ))
                      )}
                  </div>
                </div>
                </div>

              <div className="contents">
                <div className="flex min-h-0 flex-col rounded-[30px] border border-[#ffbf69]/18 bg-[linear-gradient(145deg,rgba(255,191,105,0.14),rgba(255,255,255,0.045)_48%,rgba(255,120,120,0.07))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_24px_70px_rgba(255,191,105,0.08)] backdrop-blur-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-medium tracking-[-0.04em]">{selectedMetricWidget.label}</h2>
                      <div className="mt-7 text-sm text-white/48">{selectedMetricWidget.hint}</div>
                      <div className="text-5xl font-light tracking-[-0.07em]">{selectedMetricWidget.value}</div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsMetricWidgetSettingsOpen((value) => !value)}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/9 text-white/82 ring-1 ring-white/10 transition hover:bg-white/14"
                        aria-label="Настроить показатель"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                      {isMetricWidgetSettingsOpen ? (
                        <div className="absolute right-0 top-[56px] z-40 w-56 rounded-[22px] border border-white/12 bg-[#08111f]/96 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                          {dashboardMetricOptions.map((metric) => (
                            <button
                              key={metric.key}
                              type="button"
                              onClick={() => {
                                setSelectedMetricWidgetKey(metric.key);
                                setIsMetricWidgetSettingsOpen(false);
                              }}
                              className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                                selectedMetricWidgetKey === metric.key
                                  ? "bg-[#00f5a8] text-[#06101d]"
                                  : "text-white/72 hover:bg-white/8"
                              }`}
                            >
                              {metric.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-auto grid gap-6 pt-5 md:grid-cols-[150px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/72 ring-1 ring-white/8">{activeClientsCount} клиентов</div>
                      <div className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/72 ring-1 ring-white/8">{activeMembersCount} сотрудников</div>
                    </div>
                    <div className="relative h-32">
                      <svg viewBox="0 0 560 170" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                        <path
                          d={chartPaths.metric(selectedMetricWidgetKey)}
                          fill="none"
                          stroke={selectedMetricWidget.tone}
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.68"
                        />
                        {chartPaths.metricPoints(selectedMetricWidgetKey).map((point) => (
                          <circle
                            key={point.fullLabel}
                            cx={point.x}
                            cy={point.y}
                            r="4.5"
                            fill={selectedMetricWidget.tone}
                            opacity="0.86"
                          />
                        ))}
                      </svg>
                      {chartPaths.metricPoints(selectedMetricWidgetKey).map((point) => (
                        <div
                          key={`metric-tooltip-${point.fullLabel}`}
                          className="group absolute z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-default"
                          style={{
                            left: `${(point.x / 560) * 100}%`,
                            top: `${(point.y / 170) * 100}%`,
                          }}
                        >
                          <div
                            className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/38 opacity-0 shadow-[0_0_18px_rgba(255,191,105,0.18)] transition group-hover:opacity-100"
                            style={{ backgroundColor: selectedMetricWidget.tone }}
                          />
                          <div className="pointer-events-none absolute bottom-[30px] left-1/2 z-30 w-40 -translate-x-1/2 rounded-2xl border border-white/12 bg-[#08111f]/96 px-3 py-2 text-xs text-white/76 opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl transition group-hover:opacity-100">
                            <div className="font-medium text-white">{selectedMetricWidget.label}</div>
                            <div className="mt-1">{point.fullLabel}</div>
                            <div className="mt-1 text-[#ffbf69]">{formatRub(point.value)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col rounded-[30px] border border-[#38bdf8]/18 bg-[linear-gradient(145deg,rgba(56,189,248,0.14),rgba(255,255,255,0.045)_48%,rgba(0,245,168,0.06))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_24px_70px_rgba(56,189,248,0.08)] backdrop-blur-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-medium tracking-[-0.04em]">Выполнение плана</h2>
                      <div className="mt-2 text-sm text-white/48">План / факт</div>
                    </div>
                    <div className="rounded-full bg-[#00f5a8] px-4 py-2 text-xs font-semibold text-[#06101d]">
                      {planProgressAverage}%
                    </div>
                  </div>
                  <div className="mt-auto space-y-5 pt-6">
                    {planProgressItems.length === 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white/58">
                        План на выбранный период не задан. Заполни месячный план в аналитике,
                        и здесь появится корректный план / факт с учётом выбранных дат.
                      </div>
                    ) : (
                      planProgressItems.map((item) => (
                        <div key={item.label}>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-white/72">{item.label}</span>
                            <span className="text-white/44">{item.progress}%</span>
                          </div>
                          <div className="h-4 overflow-hidden rounded-full bg-white/8 ring-1 ring-white/8">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#00f5a8,#43ffc2_55%,#7c5cff)] shadow-[0_0_24px_rgba(0,245,168,0.24)]"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
