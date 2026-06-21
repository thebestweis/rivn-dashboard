"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, Shield, Sparkles, Users } from "lucide-react";
import { AccessDenied } from "../components/access/access-denied";
import { AppToast } from "../components/ui/app-toast";
import { EmptyState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/skeleton";
import { useAppContextState } from "../providers/app-context-provider";
import {
  useBillingTransactionsQuery,
  useWorkspaceBalanceQuery,
} from "../lib/queries/use-billing-query";

const TELEGRAM_URL = "https://t.me/thebestweis";
const EXTRA_MEMBER_PRICE = 170;

type PlanCode = "base" | "team" | "strategy";

type Tariff = {
  code: PlanCode;
  name: string;
  price: number;
  accent: "emerald" | "violet" | "gold";
  description: string;
  features: string[];
  icon: typeof Shield;
};

const tariffs: Tariff[] = [
  {
    code: "base",
    name: "BASE",
    price: 990,
    accent: "emerald",
    icon: Shield,
    description: "Стартовый тариф для одного владельца или соло-специалиста.",
    features: [
      "1 рабочее место",
      "Основные разделы RIVN OS",
      "Клиенты, проекты, задачи и финансы",
    ],
  },
  {
    code: "team",
    name: "TEAM",
    price: 4990,
    accent: "violet",
    icon: Users,
    description: "Полный доступ к RIVN OS для команды агентства.",
    features: [
      "Включено до 10 человек",
      "Возможность расширения команды до 25 человек",
      `Каждый дополнительный человек: +${EXTRA_MEMBER_PRICE} ₽/мес`,
      "Полный доступ к функционалу",
    ],
  },
  {
    code: "strategy",
    name: "STRATEGY",
    price: 9990,
    accent: "gold",
    icon: Crown,
    description: "Максимальный тариф для масштабирования команды и лидогенерации.",
    features: [
      "Включено 50 рабочих мест",
      "Возможность расширения команды до 250 сотрудников",
      `Каждый дополнительный человек: +${EXTRA_MEMBER_PRICE} ₽/мес`,
      "Модуль RIVN LEADS",
      "Поиск и доставка заявок из Telegram",
    ],
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "trial":
      return "Пробный период";
    case "active":
      return "Активна";
    case "past_due":
      return "Ожидает продления";
    case "canceled":
      return "Отменена";
    case "expired":
      return "Истекла";
    default:
      return "Неизвестно";
  }
}

function getTransactionLabel(type: string) {
  switch (type) {
    case "deposit":
      return "Пополнение";
    case "subscription_charge":
      return "Списание за тариф";
    case "manual_adjustment":
      return "Корректировка";
    case "refund":
      return "Возврат";
    default:
      return type;
  }
}

function getCurrentEndDate(billing: ReturnType<typeof useAppContextState>["billing"]) {
  if (!billing) return null;
  return billing.subscription_status === "trial"
    ? billing.trial_ends_at
    : billing.subscription_ends_at;
}

function getPlanLabel(code: string | null | undefined) {
  if (!code) return "—";
  if (code === "trial") return "TRIAL";
  return code.toUpperCase();
}

function getAccentClasses(accent: Tariff["accent"]) {
  if (accent === "violet") {
    return {
      border: "border-violet-400/24",
      glow: "shadow-[0_0_70px_rgba(123,97,255,0.12)]",
      badge: "bg-violet-400/15 text-violet-200",
      icon: "bg-violet-400/16 text-violet-200",
    };
  }

  if (accent === "gold") {
    return {
      border: "border-amber-300/24",
      glow: "shadow-[0_0_80px_rgba(245,180,72,0.12)]",
      badge: "bg-amber-300/15 text-amber-200",
      icon: "bg-amber-300/16 text-amber-200",
    };
  }

  return {
    border: "border-[#00f5a8]/20",
    glow: "shadow-[0_0_70px_rgba(0,245,168,0.10)]",
    badge: "bg-[#00f5a8]/14 text-[#80ffd5]",
    icon: "bg-[#00f5a8]/14 text-[#80ffd5]",
  };
}

export default function BillingPage() {
  const { role, billing, billingAccess, isLoading: isAppContextLoading } =
    useAppContextState();
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "info"
  );

  const canViewBilling = role === "owner" || role === "admin";
  const canLoadBilling = !isAppContextLoading && canViewBilling;

  const {
    data: transactions = [],
    isLoading: isTransactionsLoading,
    error: transactionsError,
  } = useBillingTransactionsQuery(canLoadBilling, 80);

  const {
    data: balance = 0,
    isLoading: isBalanceLoading,
    error: balanceError,
  } = useWorkspaceBalanceQuery(canLoadBilling);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => setToastMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const error = transactionsError || balanceError;
    if (!error) return;

    console.error(error);
    const timeoutId = window.setTimeout(() => {
      setToastType("error");
    setToastMessage(
      error instanceof Error
        ? error.message
        : "Не удалось загрузить данные биллинга"
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [transactionsError, balanceError]);

  const currentEndDate = useMemo(() => getCurrentEndDate(billing), [billing]);
  const currentPlan = getPlanLabel(billing?.plan_code);
  const currentSeats =
    billingAccess?.totalAllowedMembers ??
    (billing
      ? Number(billing.included_members ?? 0) + Number(billing.extra_members ?? 0)
      : 0);

  const recentTransactions = transactions.slice(0, 8);

  if (isAppContextLoading) {
    return (
      <main className="flex-1 px-5 py-6 lg:px-8">
        <div className="rivn-page-shell space-y-6 p-4 sm:p-5">
          <div className="rivn-card p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-9 w-56" />
            <Skeleton className="mt-4 h-24 w-full rounded-[24px]" />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Skeleton className="h-96 rounded-[28px]" />
            <Skeleton className="h-96 rounded-[28px]" />
            <Skeleton className="h-96 rounded-[28px]" />
          </div>
        </div>
      </main>
    );
  }

  if (!canViewBilling) {
    return (
      <main className="flex-1 px-5 py-6 lg:px-8">
        <div className="rivn-page-shell space-y-6 p-4 sm:p-5">
          <AccessDenied
            title="Нет доступа к тарифам"
            description="Просматривать биллинг кабинета могут только owner и admin."
          />
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 px-5 py-6 lg:px-8">
        <div className="rivn-page-shell space-y-6 p-4 sm:p-5">
          <section className="rivn-card p-5 sm:p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:justify-between">
              <div className="max-w-2xl">
                <div className="text-xs uppercase tracking-[0.24em] text-[#43ffc2]">
                  Биллинг
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Тариф и подписка
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  Управляй текущим тарифом, балансом кабинета и сроком подписки.
                  Подключение и продление проходят через Telegram.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3 xl:min-w-[720px]">
                <div className="rivn-panel-inner p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                    Текущий тариф
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {currentPlan}
                  </div>
                  <div className="mt-3 inline-flex rounded-full bg-[#00f5a8]/12 px-3 py-1 text-xs text-[#80ffd5]">
                    {getStatusLabel(billing?.subscription_status)}
                  </div>
                </div>

                <div className="rivn-panel-inner p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                    Баланс
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[#80ffd5]">
                    {isBalanceLoading ? "..." : formatMoney(balance)}
                  </div>
                  <div className="mt-3 text-xs text-white/45">
                    Доступно для списаний
                  </div>
                </div>

                <div className="rivn-panel-inner p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                    Подписка до
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {formatDate(currentEndDate)}
                  </div>
                  <div className="mt-3 text-xs text-white/45">
                    Мест доступно: {currentSeats || "—"}
                  </div>
                </div>
              </div>
            </div>

            {billingAccess?.isReadOnly ? (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Подписка неактивна. Кабинет работает в режиме просмотра до
                продления тарифа.
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            {tariffs.map((tariff) => {
              const accent = getAccentClasses(tariff.accent);
              const Icon = tariff.icon;
              const isCurrentPlan =
                billing?.plan_code === tariff.code ||
                (billing?.plan_code === "trial" && tariff.code === "base");

              return (
                <article
                  key={tariff.code}
                  className={`rivn-card rivn-card-interactive relative flex h-full min-h-[520px] flex-col overflow-hidden p-5 sm:p-6 ${accent.border} ${accent.glow}`}
                >
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#00f5a8]/10 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent.icon}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {isCurrentPlan ? (
                      <span className={`rounded-full px-3 py-1 text-xs ${accent.badge}`}>
                        Текущий
                      </span>
                    ) : null}
                  </div>

                  <div className="relative mt-5">
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                      {tariff.name}
                    </h2>
                    <p className="mt-2 min-h-[48px] text-sm leading-6 text-white/55">
                      {tariff.description}
                    </p>
                  </div>

                  <div className="relative mt-6 flex items-end gap-2">
                    <div className="text-4xl font-semibold tracking-[-0.05em] text-white">
                      {formatMoney(tariff.price)}
                    </div>
                    <div className="pb-1 text-sm text-white/45">/ месяц</div>
                  </div>

                  <div className="relative mt-5 flex-1 space-y-3">
                    {tariff.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-start gap-3 text-sm leading-5 text-white/70"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00f5a8]/14 text-[#80ffd5]">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      setToastType("info");
                      setToastMessage(`Открываем Telegram для тарифа ${tariff.name}`);
                    }}
                    className="rivn-button-primary relative mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm"
                  >
                    <Sparkles className="h-4 w-4" />
                    Подключить через Telegram
                  </a>
                </article>
              );
            })}
          </section>

          <section className="rivn-card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/35">
                  Операции
                </div>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  История баланса
                </h2>
              </div>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="rivn-button px-4 py-2 text-sm"
              >
                Пополнить баланс
              </a>
            </div>

            <div className="rivn-table-wrap mt-5 overflow-x-auto">
              {isTransactionsLoading && recentTransactions.length === 0 ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                  ))}
                </div>
              ) : recentTransactions.length > 0 ? (
                <table className="w-full min-w-[720px] text-center text-sm">
                  <thead className="rivn-table-head">
                    <tr>
                      <th className="px-4 py-3 font-medium">Тип</th>
                      <th className="px-4 py-3 font-medium">Описание</th>
                      <th className="px-4 py-3 font-medium">Дата</th>
                      <th className="px-4 py-3 font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((item) => {
                      const isPositive = item.amount >= 0;

                      return (
                        <tr key={item.id} className="rivn-table-row bg-transparent">
                          <td className="px-4 py-3 text-white/75">
                            {getTransactionLabel(item.transaction_type)}
                          </td>
                          <td className="px-4 py-3 text-white/65">
                            {item.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-white/65">
                            {formatDate(item.created_at)}
                          </td>
                          <td
                            className={`px-4 py-3 font-medium ${
                              isPositive ? "text-[#80ffd5]" : "text-rose-300"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {formatMoney(item.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="Транзакций пока нет"
                    description="Когда появятся пополнения или списания, они будут отображаться здесь."
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}
