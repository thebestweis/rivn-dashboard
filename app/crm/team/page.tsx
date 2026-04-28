"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, Route, Settings2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  canAccessCrm,
  canViewAllCrmDeals,
  isAppRole,
} from "../../lib/permissions";
import { useCrmBootstrapQuery } from "../../lib/queries/use-crm-query";
import { useActiveWorkspaceMembers } from "../../lib/queries/use-workspace-members-query";
import { getWorkspaceMemberDisplayName } from "../../lib/supabase/workspace-members";
import { useAppContextState } from "../../providers/app-context-provider";

const periodOptions = [
  { value: "month", label: "Текущий месяц" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "all", label: "Всё время" },
] as const;

type PeriodValue = (typeof periodOptions)[number]["value"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function getPeriodStart(period: PeriodValue) {
  const now = new Date();

  if (period === "all") return null;
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const date = new Date(now);
  date.setDate(date.getDate() - Number(period));
  return date;
}

export default function CrmTeamPage() {
  const { role, isReady } = useAppContextState();
  const currentRole = isAppRole(role) ? role : null;
  const hasAccess = currentRole ? canAccessCrm(currentRole) : false;
  const canViewAllDeals = currentRole ? canViewAllCrmDeals(currentRole) : false;
  const [period, setPeriod] = useState<PeriodValue>("month");
  const { data, isLoading } = useCrmBootstrapQuery(isReady && hasAccess, {
    status: "all",
  });
  const { activeMembers = [] } = useActiveWorkspaceMembers(
    isReady && hasAccess
  );

  const periodStart = useMemo(() => getPeriodStart(period), [period]);
  const deals = data?.deals ?? [];
  const teamRows = useMemo(() => {
    const now = new Date();

    return activeMembers
      .map((member) => {
        const memberDeals = deals.filter((deal) =>
          deal.assignees.some(
            (assignee) => assignee.workspace_member_id === member.id
          )
        );
        const periodDeals = periodStart
          ? memberDeals.filter(
              (deal) => new Date(deal.created_at).getTime() >= periodStart.getTime()
            )
          : memberDeals;
        const openDeals = memberDeals.filter((deal) => deal.status === "open");
        const wonDeals = periodDeals.filter((deal) => deal.status === "won");
        const lostDeals = periodDeals.filter((deal) => deal.status === "lost");
        const overdueContacts = openDeals.filter(
          (deal) =>
            deal.next_contact_at &&
            new Date(deal.next_contact_at).getTime() < now.getTime()
        ).length;
        const revenue = wonDeals.reduce(
          (sum, deal) => sum + Number(deal.service_amount ?? 0),
          0
        );
        const conversion =
          periodDeals.length > 0 ? Math.round((wonDeals.length / periodDeals.length) * 100) : 0;

        return {
          member,
          periodDeals,
          openDeals,
          wonDeals,
          lostDeals,
          overdueContacts,
          revenue,
          conversion,
        };
      })
      .sort((left, right) => right.revenue - left.revenue);
  }, [activeMembers, deals, periodStart]);

  const totals = useMemo(
    () => ({
      leads: teamRows.reduce((sum, row) => sum + row.periodDeals.length, 0),
      open: teamRows.reduce((sum, row) => sum + row.openDeals.length, 0),
      won: teamRows.reduce((sum, row) => sum + row.wonDeals.length, 0),
      revenue: teamRows.reduce((sum, row) => sum + row.revenue, 0),
      overdue: teamRows.reduce((sum, row) => sum + row.overdueContacts, 0),
    }),
    [teamRows]
  );

  if (!isReady || isLoading) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Загружаем отчёт по команде CRM...
          </p>
        </div>
      </main>
    );
  }

  if (!hasAccess || !canViewAllDeals) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            CRM
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Нет доступа к отчёту по команде
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Этот раздел нужен руководителю, чтобы видеть работу всех менеджеров.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/crm"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад в CRM
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
              CRM
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Команда продаж
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Отдельный управленческий экран для РОПа: нагрузка, заявки,
              оплаченные сделки, конверсия и просроченные контакты по каждому
              менеджеру.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/crm/settings"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <Settings2 className="h-4 w-4" />
              Настройки
            </Link>
            <Link
              href="/crm/analytics"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <Route className="h-4 w-4" />
              Аналитика
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                period === option.value
                  ? "bg-violet-600 text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-5">
        {[
          ["Заявки", totals.leads],
          ["Открытые", totals.open],
          ["Оплачено", totals.won],
          ["Выручка", formatMoney(totals.revenue)],
          ["Просрочено", totals.overdue],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#121827]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
              Менеджеры
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Эффективность команды</h2>
          </div>
          <Users className="h-6 w-6 text-slate-400" />
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="min-w-[860px]">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.04]">
            <span>Менеджер</span>
            <span>Заявки</span>
            <span>Открыто</span>
            <span>Оплачено</span>
            <span>Выручка</span>
            <span>Конверсия</span>
          </div>

          {teamRows.map((row) => (
            <div
              key={row.member.id}
              className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr_0.8fr] gap-3 border-t border-slate-200 px-4 py-4 text-sm dark:border-white/10"
            >
              <div>
                <p className="font-semibold">
                  {getWorkspaceMemberDisplayName(row.member)}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Просрочено контактов: {row.overdueContacts}
                </p>
              </div>
              <span>{row.periodDeals.length}</span>
              <span>{row.openDeals.length}</span>
              <span>{row.wonDeals.length}</span>
              <span className="font-semibold">{formatMoney(row.revenue)}</span>
              <span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100">
                  {row.conversion}%
                </span>
              </span>
            </div>
          ))}

          {teamRows.length === 0 ? (
            <div className="border-t border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              В кабинете пока нет активных менеджеров.
            </div>
          ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100">
          <p className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4" />
            Как читать этот экран
          </p>
          <p className="mt-2 leading-6">
            Если у менеджера много открытых сделок и просроченных контактов, ему
            лучше временно снизить поток заявок в настройках распределения. Так
            скорость ответа останется высокой, а конверсия не будет проседать.
          </p>
        </div>
      </section>
    </main>
  );
}
