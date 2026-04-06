"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
import { AnalyticsPageHeader } from "../components/analytics/analytics-page-header";
import { FinancialAnalyticsTab } from "../components/analytics/financial-analytics-tab";
import { PlanFactTab, type PlanFactRow } from "../components/analytics/plan-fact-tab";
import { ClientsAnalyticsTab } from "../components/analytics/clients-analytics-tab";
import {
  getPayrollPayouts,
  parseRubAmount,
  formatRub,
  type StoredClient,
  type StoredExpense,
  type StoredPayment,
  type StoredPayrollPayout,
} from "../lib/storage";
import { fetchClientsFromSupabase } from "../lib/supabase/clients";
import { getExpensesFromSupabase } from "../lib/supabase/expenses";
import { getPaymentsFromSupabase } from "../lib/supabase/payments";
import {
  getMonthlyPlansFromSupabase,
  upsertMonthlyPlanInSupabase,
} from "../lib/supabase/monthly-plans";


type ClientUnitEconomicsRow = {
  clientId: string;
  clientName: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
  paidPaymentsCount: number;
  expenseItemsCount: number;
};

function formatDelta(plan: number, fact: number) {
  const diff = fact - plan;
  const sign = diff >= 0 ? "+" : "-";
  return `${sign}${formatRub(Math.abs(diff))}`;
}

function fromSupabaseDate(value: string | null) {
  if (!value) return "";

  if (value.includes("-")) {
    const [year, month, day] = value.split("-");
    if (!day || !month || !year) return value;
    return `${day}.${month}.${year}`;
  }

  return value;
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

function calculateClientUnitEconomics(params: {
  clients: StoredClient[];
  payments: Array<{
    clientId?: string | null;
    amount: string | number | null;
    status: "paid" | "pending";
  }>;
  expenses: Array<
    StoredExpense & {
      client_id?: string | null;
    }
  >;
}): ClientUnitEconomicsRow[] {
  const { clients, payments, expenses } = params;

  const paidPayments = payments.filter((p) => p.status === "paid");

  return clients
    .map((client) => {
      const clientPayments = paidPayments.filter(
        (p) => p.clientId === client.id
      );

      const clientExpenses = expenses.filter(
        (e) => e.client_id === client.id
      );

      const revenue = clientPayments.reduce(
  (sum, p) => sum + parseRubAmount(String(p.amount ?? "")),
  0
);

      const expensesTotal = clientExpenses.reduce(
        (sum, e) => sum + parseRubAmount(e.amount),
        0
      );

      const profit = revenue - expensesTotal;

      const margin =
        revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : null;

      return {
        clientId: client.id,
        clientName: client.name,
        revenue,
        expenses: expensesTotal,
        profit,
        margin,
        paidPaymentsCount: clientPayments.length,
        expenseItemsCount: clientExpenses.length,
      };
    })
    .filter((row) => row.revenue > 0 || row.expenses > 0)
    .sort((a, b) => b.profit - a.profit);
}

function isCurrentMonth(dateString: string) {
  if (!dateString) return false;

  const date = new Date(dateString);
  const now = new Date();

return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<
    "clients" | "financial" | "planfact" | "team"
  >("financial");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [planFactRangeStartMonth, setPlanFactRangeStartMonth] = useState(() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
});

const [planFactRangeEndMonth, setPlanFactRangeEndMonth] = useState(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});

  const [planEditorMonth, setPlanEditorMonth] = useState(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});
const [planMetric, setPlanMetric] = useState<
  "revenue" | "profit" | "expenses" | "fot"
>("revenue");

  const [targetProfit, setTargetProfit] = useState(300000);

const [monthlyPlans, setMonthlyPlans] = useState<
  Record<
    string,
    {
      revenue: number;
      profit: number;
      expenses: number;
      fot: number;
    }
  >
>({});

  const [growthScenario, setGrowthScenario] = useState({
  clientsDelta: 0,
  avgCheckDelta: 0,
  expenseDelta: 0,
});

const [growthBasePeriod, setGrowthBasePeriod] = useState<1 | 3>(3);


  const [clients, setClients] = useState<StoredClient[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  const [expenses, setExpenses] = useState<StoredExpense[]>([]);
  const [payments, setPayments] = useState<StoredPayment[]>([]);
  const [allPaymentRecords, setAllPaymentRecords] = useState<any[]>([]);
  const [isLoadingFinance, setIsLoadingFinance] = useState(true);

  const [payrollPayouts] = useState<StoredPayrollPayout[]>(() =>
    getPayrollPayouts()
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAnalyticsData() {
      try {
        setIsLoadingClients(true);
        setIsLoadingFinance(true);

        const [clientsData, expensesData, paymentsData, monthlyPlansData] =
  await Promise.all([
    fetchClientsFromSupabase(),
    getExpensesFromSupabase(),
    getPaymentsFromSupabase(),
    getMonthlyPlansFromSupabase(),
  ]);

        if (!isMounted) return;

        setClients(clientsData);

const clientNameMap = new Map(
  clientsData.map((client) => [client.id, client.name])
);

const mappedExpenses = expensesData.map((item) => ({
  id: item.id,
  title: item.title,
  category: item.category as StoredExpense["category"],
  amount: String(item.amount),
  date: fromSupabaseDate(item.expense_date),
  client: item.notes ?? "",
  client_id: item.client_id ?? null,
})) as Array<
  StoredExpense & {
    client_id?: string | null;
  }
>;

const mappedPayments: StoredPayment[] = paymentsData
  .filter((item) => item.status === "paid")
  .map((item) => ({
    id: item.id,
    client: clientNameMap.get(item.client_id) ?? "Неизвестный клиент",
    project: item.period_label ?? "",
    paidAt: fromSupabaseDate(item.paid_date),
    amount: String(item.amount),
    source: item.notes ?? "",
  }));

const mappedAllPayments = paymentsData.map((item) => ({
  id: item.id,
  clientId: item.client_id,
  client: clientNameMap.get(item.client_id) ?? "Неизвестный клиент",
  amount: String(item.amount),
  status: item.status as "paid" | "pending",
  dueDate: fromSupabaseDate(item.due_date),
  paidDate: fromSupabaseDate(item.paid_date),
  project: item.period_label ?? "",
  notes: item.notes ?? "",
}));

setExpenses(mappedExpenses);
setPayments(mappedPayments);
setAllPaymentRecords(mappedAllPayments);
const mappedMonthlyPlans = monthlyPlansData.reduce<
  Record<
    string,
    {
      revenue: number;
      profit: number;
      expenses: number;
      fot: number;
    }
  >
>((acc, item) => {
  acc[item.month] = {
    revenue: Number(item.revenue_plan) || 0,
    profit: Number(item.profit_plan) || 0,
    expenses: Number(item.expenses_plan) || 0,
    fot: Number(item.fot_plan) || 0,
  };

  return acc;
}, {});

setMonthlyPlans(mappedMonthlyPlans);
      } catch (error) {
        console.error("Ошибка загрузки analytics:", error);
      } finally {
        if (isMounted) {
          setIsLoadingClients(false);
          setIsLoadingFinance(false);
        }
      }
    }

    loadAnalyticsData();

    return () => {
      isMounted = false;
    };
  }, []);

const filteredPayments = useMemo(() => {
  return payments.filter((p) => {
    if (!p.paidAt) return false;

    const date = toSupabaseLikeDate(p.paidAt);
    return date.startsWith(selectedMonth);
  });
}, [payments, selectedMonth]);

const planMonthPayments = useMemo(() => {
  return payments.filter((p) => {
    if (!p.paidAt) return false;

    const date = toSupabaseLikeDate(p.paidAt);
    return date.startsWith(planEditorMonth);
  });
}, [payments, planEditorMonth]);

  const totalRevenueNumber = useMemo(() => {
  return filteredPayments.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );
}, [filteredPayments]);

const planMonthExpenses = useMemo(() => {
  return expenses.filter((e) => {
    if (!e.date) return false;

    const date = toSupabaseLikeDate(e.date);
    return date.startsWith(planEditorMonth);
  });
}, [expenses, planEditorMonth]);

  const filteredExpenses = useMemo(() => {
  return expenses.filter((e) => {
    if (!e.date) return false;

    const date = toSupabaseLikeDate(e.date);
    return date.startsWith(selectedMonth);
  });
}, [expenses, selectedMonth]);

const totalExpensesNumber = useMemo(() => {
  return filteredExpenses.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );
}, [filteredExpenses]);

  const totalFotNumber = useMemo(() => {
  return payrollPayouts
    .filter((p) => {
      if (!p.payoutDate) return false;
      return normalizePayrollPayoutMonth(p.payoutDate) === selectedMonth;
    })
    .reduce(
      (sum, item) => sum + parseRubAmount(String(item.amount ?? "")),
      0
    );
}, [payrollPayouts, selectedMonth]);

  const totalTaxNumber = useMemo(() => {
    return totalRevenueNumber * 0.07;
  }, [totalRevenueNumber]);

const planMonthRevenueNumber = useMemo(() => {
  return planMonthPayments.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );
}, [planMonthPayments]);

const planMonthExpensesNumber = useMemo(() => {
  return planMonthExpenses.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );
}, [planMonthExpenses]);

const planMonthFotNumber = useMemo(() => {
  return payrollPayouts
    .filter((p) => {
      if (!p.payoutDate) return false;
      return normalizePayrollPayoutMonth(p.payoutDate) === planEditorMonth;
    })
    .reduce(
      (sum, item) => sum + parseRubAmount(String(item.amount ?? "")),
      0
    );
}, [payrollPayouts, planEditorMonth]);

const planMonthTaxNumber = useMemo(() => {
  return planMonthRevenueNumber * 0.07;
}, [planMonthRevenueNumber]);

const planMonthProfitNumber = useMemo(() => {
  return (
    planMonthRevenueNumber -
    planMonthExpensesNumber -
    planMonthFotNumber -
    planMonthTaxNumber
  );
}, [
  planMonthRevenueNumber,
  planMonthExpensesNumber,
  planMonthFotNumber,
  planMonthTaxNumber,
]);

  const totalProfitNumber = useMemo(() => {
    return (
      totalRevenueNumber -
      totalExpensesNumber -
      totalFotNumber -
      totalTaxNumber
    );
  }, [totalRevenueNumber, totalExpensesNumber, totalFotNumber, totalTaxNumber]);

const paidPaymentsCount = useMemo(() => {
  return payments.length;
}, [payments]);

const currentMonthRevenueNumber = useMemo(() => {
  return payments
    .filter((item) => isCurrentMonth(toSupabaseLikeDate(item.paidAt)))
    .reduce((sum, item) => sum + parseRubAmount(item.amount), 0);
}, [payments]);

const averageCheckNumber = useMemo(() => {
  if (paidPaymentsCount === 0) return 0;
  return totalRevenueNumber / paidPaymentsCount;
}, [totalRevenueNumber, paidPaymentsCount]);

const uniquePayingClientsCount = useMemo(() => {
  const uniqueClients = new Set(
    payments
      .map((item) => item.client?.trim())
      .filter((value) => Boolean(value))
  );

  return uniqueClients.size;
}, [payments]);

const revenuePerClientNumber = useMemo(() => {
  if (uniquePayingClientsCount === 0) return 0;
  return totalRevenueNumber / uniquePayingClientsCount;
}, [totalRevenueNumber, uniquePayingClientsCount]);

const clientRevenueMap = useMemo(() => {
  const map = new Map<string, number>();

  payments.forEach((item) => {
    const clientName = item.client?.trim();
    if (!clientName) return;

    const current = map.get(clientName) ?? 0;
    map.set(clientName, current + parseRubAmount(item.amount));
  });

  return map;
}, [payments]);

const topClientsByRevenue = useMemo(() => {
  return Array.from(clientRevenueMap.entries())
    .map(([client, revenue]) => ({
      client,
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}, [clientRevenueMap]);

    const totalExpenses = useMemo(() => {
    return formatRub(totalExpensesNumber);
  }, [totalExpensesNumber]);

  const totalFot = useMemo(() => {
    return formatRub(totalFotNumber);
  }, [totalFotNumber]);

  const clientUnitEconomics = useMemo(() => {
    return calculateClientUnitEconomics({
      clients,
      payments: allPaymentRecords,
      expenses: expenses as Array<
        StoredExpense & {
          client_id?: string | null;
        }
      >,
    });
  }, [clients, allPaymentRecords, expenses]);

  const topClientsByProfit = useMemo(() => {
    return clientUnitEconomics.slice(0, 10);
  }, [clientUnitEconomics]);

  const lossMakingClients = useMemo(() => {
    return clientUnitEconomics.filter((client) => client.profit < 0);
  }, [clientUnitEconomics]);

  const lowMarginClients = useMemo(() => {
  return clientUnitEconomics.filter(
    (client) => client.margin !== null && client.margin < 20
  );
}, [clientUnitEconomics]);

const clientRiskList = useMemo(() => {
  return clientUnitEconomics.map((client) => {
    let risk = 0;

    if (client.profit < 0) risk += 2;
    if (client.margin !== null && client.margin < 20) risk += 1;
    if (client.revenue === 0) risk += 1;

    return {
      ...client,
      risk,
    };
  });
}, [clientUnitEconomics]);

const highRiskClients = useMemo(() => {
  return clientRiskList
    .filter((client) => client.risk >= 2)
    .sort((a, b) => b.risk - a.risk);
}, [clientRiskList]);

const revenueDynamics = useMemo(() => {
  const map = new Map<
    string,
    { revenue: number; expenses: number; fot: number }
  >();

  payments.forEach((p) => {
    if (!p.paidAt) return;

    const date = toSupabaseLikeDate(p.paidAt);
    const month = date.slice(0, 7);

    const current = map.get(month) || { revenue: 0, expenses: 0, fot: 0 };

    current.revenue += parseRubAmount(p.amount);
    map.set(month, current);
  });

  expenses.forEach((e) => {
    if (!e.date) return;

    const date = toSupabaseLikeDate(e.date);
    const month = date.slice(0, 7);

    const current = map.get(month) || { revenue: 0, expenses: 0, fot: 0 };

    current.expenses += parseRubAmount(e.amount);
    map.set(month, current);
  });

  payrollPayouts.forEach((p) => {
    if (!p.payoutDate) return;

    const month = normalizePayrollPayoutMonth(p.payoutDate);
    if (!month) return;

    const current = map.get(month) || { revenue: 0, expenses: 0, fot: 0 };

    current.fot += parseRubAmount(String(p.amount ?? ""));
    map.set(month, current);
  });

  return Array.from(map.entries())
    .map(([month, data]) => {
      const tax = data.revenue * 0.07;
      const profit = data.revenue - data.expenses - data.fot - tax;

      return {
        month,
        revenue: data.revenue,
        profit,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}, [payments, expenses, payrollPayouts]);

const stableRevenue = useMemo(() => {
  const sortedMonths = revenueDynamics
    .map((item) => item.month)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (sortedMonths.length < 2) return 0;

  const lastMonth = sortedMonths[sortedMonths.length - 1];
  const previousMonth = sortedMonths[sortedMonths.length - 2];

  const clientMonthsMap = new Map<string, Set<string>>();
  const clientRevenueLastMonth = new Map<string, number>();

  payments.forEach((payment) => {
    if (!payment.paidAt || !payment.client) return;

    const monthKey = toSupabaseLikeDate(payment.paidAt).slice(0, 7);
    const clientName = payment.client.trim();
    if (!clientName) return;

    if (!clientMonthsMap.has(clientName)) {
      clientMonthsMap.set(clientName, new Set());
    }

    clientMonthsMap.get(clientName)!.add(monthKey);

    if (monthKey === lastMonth) {
      const current = clientRevenueLastMonth.get(clientName) ?? 0;
      clientRevenueLastMonth.set(
        clientName,
        current + parseRubAmount(payment.amount)
      );
    }
  });

  let total = 0;

  clientMonthsMap.forEach((months, clientName) => {
    if (months.has(lastMonth) && months.has(previousMonth)) {
      total += clientRevenueLastMonth.get(clientName) ?? 0;
    }
  });

  return total;
}, [payments, revenueDynamics]);

const forecastMetrics = useMemo(() => {
  if (revenueDynamics.length < 2) {
    return {
      avgRevenue: 0,
      avgProfit: 0,
      realisticRevenue: 0,
      realisticProfit: 0,
      aggressiveRevenue: 0,
      aggressiveProfit: 0,
    };
  }

  const lastMonths = revenueDynamics.slice(-3);

  const avgRevenue =
    lastMonths.reduce((sum, item) => sum + item.revenue, 0) /
    lastMonths.length;

  const avgProfit =
    lastMonths.reduce((sum, item) => sum + item.profit, 0) /
    lastMonths.length;

  // считаем рост
  const growthRates = [];
  for (let i = 1; i < lastMonths.length; i++) {
    const prev = lastMonths[i - 1].revenue;
    const curr = lastMonths[i].revenue;

    if (prev > 0) {
      growthRates.push((curr - prev) / prev);
    }
  }

  const avgGrowth =
    growthRates.length > 0
      ? growthRates.reduce((sum, g) => sum + g, 0) / growthRates.length
      : 0;

  const aggressiveGrowth = avgGrowth * 1.5;

  const lastRevenue = lastMonths[lastMonths.length - 1].revenue;
  const lastProfit = lastMonths[lastMonths.length - 1].profit;

  let realisticRevenue = lastRevenue;
  let aggressiveRevenue = lastRevenue;

  for (let i = 0; i < 3; i++) {
    realisticRevenue += realisticRevenue * avgGrowth;
    aggressiveRevenue += aggressiveRevenue * aggressiveGrowth;
  }

  const realisticProfit =
    avgRevenue > 0 ? (realisticRevenue / avgRevenue) * avgProfit : 0;

  const aggressiveProfit =
    avgRevenue > 0 ? (aggressiveRevenue / avgRevenue) * avgProfit : 0;

  return {
    avgRevenue,
    avgProfit,
    realisticRevenue,
    realisticProfit,
    aggressiveRevenue,
    aggressiveProfit,
  };
}, [revenueDynamics]);

const targetMetrics = useMemo(() => {
  const averageRevenuePerClient =
    uniquePayingClientsCount > 0
      ? totalRevenueNumber / uniquePayingClientsCount
      : 0;

  const currentMargin =
    totalRevenueNumber > 0 ? totalProfitNumber / totalRevenueNumber : 0;

  const requiredRevenue =
    currentMargin > 0 ? targetProfit / currentMargin : 0;

  const requiredClients =
    averageRevenuePerClient > 0
      ? Math.ceil(requiredRevenue / averageRevenuePerClient)
      : 0;

  return {
    averageRevenuePerClient,
    currentMargin,
    requiredRevenue,
    requiredClients,
  };
}, [
  uniquePayingClientsCount,
  totalRevenueNumber,
  totalProfitNumber,
  targetProfit,
]);

const growthMetrics = useMemo(() => {
  const monthsToUse = growthBasePeriod === 1 ? 1 : 3;
  const recentMonths = revenueDynamics
    .slice(-monthsToUse)
    .map((item) => item.month);

  const recentRevenue = revenueDynamics.slice(-monthsToUse);

  const baseRevenue =
    recentRevenue.length > 0
      ? recentRevenue.reduce((sum, item) => sum + item.revenue, 0) /
        recentRevenue.length
      : 0;

  const baseProfit =
    recentRevenue.length > 0
      ? recentRevenue.reduce((sum, item) => sum + item.profit, 0) /
        recentRevenue.length
      : 0;

  const recentPayments = payments.filter((payment) => {
    if (!payment?.paidAt) return false;

    const monthKey = toSupabaseLikeDate(payment.paidAt).slice(0, 7);
    return recentMonths.includes(monthKey);
  });

  const recentPaymentsCount = recentPayments.length;

  const baseAvgCheck =
    recentPaymentsCount > 0
      ? recentPayments.reduce(
          (sum, payment) => sum + parseRubAmount(payment.amount),
          0
        ) / recentPaymentsCount
      : 0;

  const recentClients = new Set(
    recentPayments.map((payment) => payment.client).filter(Boolean)
  );

  const baseClients = recentClients.size;

  const baseExpenses = Math.max(
    0,
    baseRevenue - baseProfit - baseRevenue * 0.07
  );

  const newClients = Math.max(
    0,
    baseClients + growthScenario.clientsDelta
  );

  const newAvgCheck = Math.max(
    0,
    baseAvgCheck * (1 + growthScenario.avgCheckDelta / 100)
  );

  const newRevenue = newClients * newAvgCheck;

  const newExpenses = Math.max(
    0,
    baseExpenses * (1 + growthScenario.expenseDelta / 100)
  );

  const newProfit = newRevenue - newExpenses - newRevenue * 0.07;

  return {
    newClients,
    newAvgCheck,
    newRevenue,
    newProfit,
  };
}, [growthScenario, growthBasePeriod, revenueDynamics, payments]);

const growthInsights = useMemo(() => {
  const baseRevenue = totalRevenueNumber;

  const impactClients =
    growthMetrics.newClients * averageCheckNumber - baseRevenue;

  const impactCheck =
    uniquePayingClientsCount * growthMetrics.newAvgCheck - baseRevenue;

  const impactExpenses =
    totalExpensesNumber - totalExpensesNumber * (1 + growthScenario.expenseDelta / 100);

  return {
    impactClients,
    impactCheck,
    impactExpenses,
  };
}, [
  growthMetrics,
  averageCheckNumber,
  uniquePayingClientsCount,
  totalRevenueNumber,
  totalExpensesNumber,
  growthScenario,
]);

const ceoSummary = useMemo(() => {
  const impacts = [
    {
      key: "clients",
      label: "Увеличение количества клиентов",
      value: growthInsights?.impactClients ?? 0,
    },
    {
      key: "check",
      label: "Рост среднего чека",
      value: growthInsights?.impactCheck ?? 0,
    },
    {
      key: "expenses",
      label: "Снижение расходов",
      value: growthInsights?.impactExpenses ?? 0,
    },
  ];

  const sorted = impacts.sort((a, b) => b.value - a.value);
  const best = sorted[0];

  return {
    mainLever: best?.label ?? "Недостаточно данных",
    mainLeverValue: best?.value ?? 0,
    firstAction:
      best?.key === "clients"
        ? "Увеличить поток заявок"
        : best?.key === "check"
        ? "Поднять средний чек"
        : best?.key === "expenses"
        ? "Снизить расходы"
        : "Нет рекомендаций",
  };
}, [growthInsights]);

const growthPlan = useMemo(() => {
  const profitGap = Math.max(targetProfit - totalProfitNumber, 0);

  const currentMargin =
    totalRevenueNumber > 0 ? totalProfitNumber / totalRevenueNumber : 0;

  const requiredExtraRevenue =
    currentMargin > 0 ? profitGap / currentMargin : 0;

  const avgRevenuePerClient =
    uniquePayingClientsCount > 0
      ? totalRevenueNumber / uniquePayingClientsCount
      : 0;

  const requiredExtraClients =
    avgRevenuePerClient > 0
      ? Math.ceil(requiredExtraRevenue / avgRevenuePerClient)
      : 0;

  const requiredCheckGrowthPercent =
    totalRevenueNumber > 0
      ? (requiredExtraRevenue / totalRevenueNumber) * 100
      : 0;

  return {
    profitGap,
    requiredExtraRevenue,
    requiredExtraClients,
    requiredCheckGrowthPercent,
  };
}, [
  targetProfit,
  totalProfitNumber,
  totalRevenueNumber,
  uniquePayingClientsCount,
]);

const clientRecommendations = useMemo(() => {
  return clientUnitEconomics.map((client) => {
    const recommendations: { text: string; tone: "good" | "warn" | "danger" }[] = [];

    if (client.profit < 0) {
      recommendations.push({
        text: "Клиент убыточный — проверить расходы и пересобрать условия",
        tone: "danger",
      });
    }

    if (client.margin !== null && client.margin < 20) {
      recommendations.push({
        text: "Низкая маржа — подумать о повышении чека",
        tone: "warn",
      });
    }

    if (client.expenses > client.revenue * 0.7 && client.revenue > 0) {
      recommendations.push({
        text: "Слишком высокая доля расходов — снизить себестоимость",
        tone: "warn",
      });
    }

    const overdueClient = allPaymentRecords.some(
      (payment) =>
        payment.clientId === client.clientId &&
        payment.status === "pending" &&
        payment.dueDate
    );

    if (overdueClient) {
      recommendations.push({
        text: "Есть неоплаченные счета — взять клиента на контроль",
        tone: "danger",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        text: "Клиент в норме — можно масштабировать",
        tone: "good",
      });
    }

    return {
      ...client,
      recommendations,
    };
  });
}, [clientUnitEconomics, allPaymentRecords]);

const currentMonthPlan = useMemo(() => {
  return (
    monthlyPlans[planEditorMonth] ?? {
      revenue: 500000,
      profit: 220000,
      expenses: 140000,
      fot: 60000,
    }
  );
}, [monthlyPlans, planEditorMonth]);

const planFactRows = useMemo<PlanFactRow[]>(() => {
  const rows: Array<{
    key: PlanFactRow["key"];
    label: string;
    planNumber: number;
    factNumber: number;
  }> = [
    {
      key: "revenue",
      label: "Выручка",
      planNumber: currentMonthPlan.revenue,
      factNumber: planMonthRevenueNumber,
    },
    {
      key: "profit",
      label: "Прибыль",
      planNumber: currentMonthPlan.profit,
      factNumber: planMonthProfitNumber,
    },
    {
      key: "expenses",
      label: "Расходы",
      planNumber: currentMonthPlan.expenses,
      factNumber: planMonthExpensesNumber,
    },
    {
      key: "fot",
      label: "ФОТ",
      planNumber: currentMonthPlan.fot,
      factNumber: planMonthFotNumber,
    },
  ];

  return rows.map((row) => {
    const progress =
      row.planNumber > 0 ? (row.factNumber / row.planNumber) * 100 : 0;

    return {
      key: row.key,
      label: row.label,
      planNumber: row.planNumber,
      factNumber: row.factNumber,
      deltaNumber: row.factNumber - row.planNumber,
      progress,
      plan: formatRub(row.planNumber),
      fact: formatRub(row.factNumber),
      delta: formatDelta(row.planNumber, row.factNumber),
      progressLabel: `${Math.round(progress)}%`,
    };
  });
}, [
  currentMonthPlan,
  planMonthRevenueNumber,
  planMonthProfitNumber,
  planMonthExpensesNumber,
  planMonthFotNumber,
]);

const planFactChartData = useMemo(() => {
  const factMap = new Map<
    string,
    {
      revenue: number;
      profit: number;
      expenses: number;
      fot: number;
    }
  >();

  revenueDynamics.forEach((item) => {
    const monthExpenses = expenses
      .filter((expense) => {
        if (!expense.date) return false;
        return toSupabaseLikeDate(expense.date).startsWith(item.month);
      })
      .reduce((sum, expense) => sum + parseRubAmount(expense.amount), 0);

    const monthFot = payrollPayouts
      .filter((payout) => payout.payoutDate?.startsWith(item.month))
      .reduce((sum, payout) => sum + parseRubAmount(String(payout.amount ?? "")), 0);

    factMap.set(item.month, {
      revenue: item.revenue,
      profit: item.profit,
      expenses: monthExpenses,
      fot: monthFot,
    });
  });

  const allMonths = Array.from(
    new Set([...Object.keys(monthlyPlans), ...Array.from(factMap.keys())])
  ).sort((a, b) => a.localeCompare(b));

  return allMonths.map((month) => {
    const fact =
      factMap.get(month) ?? {
        revenue: 0,
        profit: 0,
        expenses: 0,
        fot: 0,
      };

    const plan =
      monthlyPlans[month] ?? {
        revenue: 0,
        profit: 0,
        expenses: 0,
        fot: 0,
      };

    return {
  month,
  plan: plan[planMetric],
  fact: fact[planMetric],
  isSelected: month === planEditorMonth,
};
  });
}, [
  revenueDynamics,
  expenses,
  payrollPayouts,
  monthlyPlans,
  planMetric,
  planEditorMonth,
]);

async function updateCurrentMonthPlan(
  key: "revenue" | "profit" | "expenses" | "fot",
  value: number
) {
    console.log("SAVE PLAN START", {
  planEditorMonth,
  key,
  value,
});
  const current = monthlyPlans[planEditorMonth] ?? {
    revenue: 500000,
    profit: 220000,
    expenses: 140000,
    fot: 60000,
  };

  const nextPlan = {
    ...current,
    [key]: value,
  };

  setMonthlyPlans((prev) => ({
    ...prev,
    [planEditorMonth]: nextPlan,
  }));

  try {
    await upsertMonthlyPlanInSupabase({
      month: planEditorMonth,
      revenue: nextPlan.revenue,
      profit: nextPlan.profit,
      expenses: nextPlan.expenses,
      fot: nextPlan.fot,
    });
  } catch (error) {
    console.error("Ошибка сохранения monthly plan:", error);
  }
}

return (  

  <div className="min-h-screen bg-[#0B0F1A] text-white">
    <div className="flex min-h-screen">
      <AppSidebar />

      <main className="flex-1">

        <div className="space-y-6 px-5 py-6 lg:px-8">
          <AnalyticsPageHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

{activeTab === "financial" ? (
  isLoadingFinance ? (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      Загрузка финансовых данных...
    </div>
  ) : (
    <FinancialAnalyticsTab
      expenses={expenses}
      payments={payments}
      payrollPayouts={payrollPayouts}
      revenueDynamics={revenueDynamics}
      forecastMetrics={forecastMetrics}
      targetProfit={targetProfit}
      setTargetProfit={setTargetProfit}
      targetMetrics={targetMetrics}
      growthScenario={growthScenario}
      setGrowthScenario={setGrowthScenario}
      growthMetrics={growthMetrics}
      growthInsights={growthInsights}
      growthPlan={growthPlan}
      ceoSummary={ceoSummary}
      growthBasePeriod={growthBasePeriod}
      setGrowthBasePeriod={setGrowthBasePeriod}
      stableRevenue={stableRevenue}
    />
  )
) : activeTab === "planfact" ? (
  <PlanFactTab
    rows={planFactRows}
    chartData={planFactChartData}
    selectedMetric={planMetric}
    setSelectedMetric={setPlanMetric}
    selectedMonth={planEditorMonth}
    setSelectedMonth={setPlanEditorMonth}
    onPlanChange={updateCurrentMonthPlan}
    rangeStartMonth={planFactRangeStartMonth}
    setRangeStartMonth={setPlanFactRangeStartMonth}
    rangeEndMonth={planFactRangeEndMonth}
    setRangeEndMonth={setPlanFactRangeEndMonth}
  />
) : isLoadingClients ? (
  <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
    Загрузка клиентов...
  </div>
) : (
  <ClientsAnalyticsTab
    clients={clients}
    payments={payments}
    allPaymentRecords={allPaymentRecords}
    clientUnitEconomics={clientUnitEconomics}
    topClientsByProfit={topClientsByProfit}
    lossMakingClients={lossMakingClients}
    lowMarginClients={lowMarginClients}
    highRiskClients={highRiskClients}
    clientRecommendations={clientRecommendations}
  />
)}
        </div>
      </main>
    </div>
  </div>
);
}