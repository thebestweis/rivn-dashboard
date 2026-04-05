"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "./components/layout/app-sidebar";
import { AppTopbar } from "./components/layout/app-topbar";
import { KpiCard } from "./components/dashboard/kpi-card";
import { AlertsPanel } from "./components/dashboard/alerts-panel";
import { UpcomingActions } from "./components/dashboard/upcoming-actions";
import { ClientsTable } from "./components/dashboard/clients-table";
import { QuickActions } from "./components/dashboard/quick-actions";
import { FinancialOverviewChart } from "./components/dashboard/financial-overview-chart";
import { IncomeRatioDonut } from "./components/dashboard/income-ratio-donut";
import {
  getExpenses,
  getPayments,
  getPayrollPayouts,
  parseRubAmount,
  formatRub,
  type StoredClient,
  type StoredExpense,
  type StoredPayment,
  type StoredPayrollPayout,
} from "./lib/storage";
import { fetchClientsFromSupabase } from "./lib/supabase/clients";

export default function Home() {
  const alerts = [
    {
      title: "Сегодня выставить 3 счёта",
      desc: "2 клиента — фикс, 1 клиент — split",
      tone: "warning" as const,
    },
    {
      title: "1 оплата просрочена",
      desc: "Client Alpha · 3 дня",
      tone: "danger" as const,
    },
    {
      title: "Расходы на маркетинг выросли",
      desc: "+28% к прошлой неделе",
      tone: "warning" as const,
    },
    {
      title: "Прибыль ниже плана",
      desc: "Отклонение −14% по текущей неделе",
      tone: "danger" as const,
    },
  ];

  const upcoming = [
    { date: "Сегодня", title: "Счёт · Client Orion", value: "₽30,000" },
    { date: "Завтра", title: "Оплата · Client Nova", value: "₽45,000" },
    { date: "1 мая", title: "Выплата ЗП", value: "₽65,000" },
    { date: "1 мая", title: "Внеплановая выплата", value: "₽10,000" },
  ];

  const quickActions = [
    { label: "Добавить клиента", tone: "emerald" as const },
    { label: "Добавить оплату", tone: "violet" as const },
    { label: "Добавить расход", tone: "rose" as const },
    { label: "Внеплановая выплата", tone: "amber" as const },
  ];

  const [clients, setClients] = useState<StoredClient[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  const [expenses] = useState<StoredExpense[]>(() => getExpenses());
  const [payments] = useState<StoredPayment[]>(() => getPayments());
  const [payrollPayouts] = useState<StoredPayrollPayout[]>(() =>
    getPayrollPayouts()
  );

  useEffect(() => {
    let isMounted = true;

    async function loadClients() {
      try {
        const data = await fetchClientsFromSupabase();
        if (isMounted) {
          setClients(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setIsLoadingClients(false);
        }
      }
    }

    loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeClientsCount = useMemo(() => {
    return clients.filter((client) => client.status === "active").length;
  }, [clients]);

  const dashboardClients = useMemo(() => {
    return clients.slice(0, 4);
  }, [clients]);

  const totalExpenses = useMemo(() => {
    const total = expenses.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );

    return formatRub(total);
  }, [expenses]);

  const totalRevenue = useMemo(() => {
    const total = payments.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );

    return formatRub(total);
  }, [payments]);

  const totalRevenueNumber = useMemo(() => {
    return payments.reduce((sum, item) => sum + parseRubAmount(item.amount), 0);
  }, [payments]);

  const totalExpensesNumber = useMemo(() => {
    return expenses.reduce((sum, item) => sum + parseRubAmount(item.amount), 0);
  }, [expenses]);

  const fotNumber = useMemo(() => {
    return payrollPayouts.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );
  }, [payrollPayouts]);

  const taxNumber = useMemo(() => {
    return totalRevenueNumber * 0.07;
  }, [totalRevenueNumber]);

  const totalProfit = useMemo(() => {
    return formatRub(
      totalRevenueNumber - totalExpensesNumber - fotNumber - taxNumber
    );
  }, [totalRevenueNumber, totalExpensesNumber, taxNumber, fotNumber]);

  const financialChartData = [
    { week: "W1", revenue: 120000, profit: 42000, expenses: 36000, fot: 18000 },
    { week: "W2", revenue: 168000, profit: 59000, expenses: 47000, fot: 20000 },
    { week: "W3", revenue: 142000, profit: 51000, expenses: 41000, fot: 19000 },
    { week: "W4", revenue: 191000, profit: 72000, expenses: 53000, fot: 21000 },
    { week: "W5", revenue: 176000, profit: 65000, expenses: 50000, fot: 20000 },
    { week: "W6", revenue: 228000, profit: 88000, expenses: 61000, fot: 22000 },
  ];

  const kpis = [
    {
      label: "Выручка",
      value: totalRevenue,
      delta: "из localStorage",
      tone: "success" as const,
    },
    {
      label: "Прибыль",
      value: totalProfit,
      delta: "выручка - расходы - ФОТ - 7%",
      tone: "success" as const,
    },
    {
      label: "Расходы",
      value: totalExpenses,
      delta: "из localStorage",
      tone: "warning" as const,
    },
    {
      label: "ФОТ",
      value: formatRub(fotNumber),
      delta: "из payroll",
      tone: "warning" as const,
    },
    {
      label: "Налог 7%",
      value: formatRub(taxNumber),
      delta: "7% от выручки",
      tone: "neutral" as const,
    },
    {
      label: "Активные клиенты",
      value: isLoadingClients ? "..." : String(activeClientsCount),
      delta: "из Supabase",
      tone: "success" as const,
    },
    { label: "Средний чек", value: "₽35,700", delta: "+4.9%", tone: "success" as const },
    { label: "ROMI", value: "243%", delta: "+18%", tone: "success" as const },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <AppTopbar
            title="Dashboard"
            description="Ключевые показатели, действия, сигналы внимания и общая картина по агентству."
          />

          <div className="space-y-6 px-5 py-6 lg:px-8">
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

            <section className="space-y-6">
              <FinancialOverviewChart data={financialChartData} />

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <AlertsPanel alerts={alerts} />
                <UpcomingActions items={upcoming} />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              {isLoadingClients ? (
                <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                  Загрузка клиентов из Supabase...
                </div>
              ) : (
                <ClientsTable clients={dashboardClients} />
              )}

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                <QuickActions actions={quickActions} />
                <IncomeRatioDonut ratio={59} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}