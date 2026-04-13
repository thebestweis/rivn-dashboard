"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "../components/access/access-denied";
import { AppToast } from "../components/ui/app-toast";
import { EmptyState } from "../components/ui/empty-state";
import { useAppContextState } from "../providers/app-context-provider";
import {
  getBillingPlans,
  getBillingTransactions,
  getWorkspaceBalance,
  type BillingPlan,
  type BillingTransaction,
} from "../lib/supabase/billing";
import { calculatePlanPrice } from "../lib/supabase/billing";

const TELEGRAM_CONTACT = "@thebestweis";
const TELEGRAM_URL = "https://t.me/thebestweis";

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
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
      return "Триал";
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

function getStatusTone(status: string | null | undefined) {
  switch (status) {
    case "trial":
      return "bg-violet-500/15 text-violet-300";
    case "active":
      return "bg-emerald-500/15 text-emerald-300";
    case "past_due":
      return "bg-amber-500/15 text-amber-300";
    case "canceled":
    case "expired":
      return "bg-rose-500/15 text-rose-300";
    default:
      return "bg-white/10 text-white/60";
  }
}

function getTransactionLabel(type: string) {
  switch (type) {
    case "deposit":
      return "Пополнение";
    case "subscription_charge":
      return "Списание за тариф";
    case "manual_adjustment":
      return "Ручная корректировка";
    case "refund":
      return "Возврат";
    default:
      return type;
  }
}

function getPlanActionLabel(params: {
  isCurrentPlan: boolean;
  isReadOnly: boolean;
}) {
  if (params.isCurrentPlan && params.isReadOnly) {
    return "Продлить через Telegram";
  }

  if (params.isCurrentPlan) {
    return "Продление через Telegram";
  }

  return "Подключить через Telegram";
}

export default function BillingPage() {
  const { role, billing, billingAccess, isLoading: isAppContextLoading } =
    useAppContextState();

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [isLoadingBillingPage, setIsLoadingBillingPage] = useState(true);

  const [selectedExtraMembers, setSelectedExtraMembers] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "info"
  );

  const canViewBilling = role === "owner" || role === "admin";

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (isAppContextLoading) return;

    if (!canViewBilling) {
      setIsLoadingBillingPage(false);
      return;
    }

    let isMounted = true;

    async function loadBillingPage() {
      try {
        setIsLoadingBillingPage(true);

        const [plansData, transactionsData, balanceValue] = await Promise.all([
          getBillingPlans(),
          getBillingTransactions(100),
          getWorkspaceBalance(),
        ]);

        if (!isMounted) return;

        setPlans(plansData);
        setTransactions(transactionsData);
        setBalance(balanceValue);
      } catch (error) {
        console.error("Ошибка загрузки billing page:", error);

        if (!isMounted) return;

        setToastType("error");
        setToastMessage("Не удалось загрузить данные биллинга");
      } finally {
        if (isMounted) {
          setIsLoadingBillingPage(false);
        }
      }
    }

    loadBillingPage();

    return () => {
      isMounted = false;
    };
  }, [isAppContextLoading, canViewBilling]);

  const currentPlanName = useMemo(() => {
    if (!billing?.plan_code) return "—";
    if (billing.plan_code === "trial") return "TRIAL";
    return billing.plan_code.toUpperCase();
  }, [billing]);

  const currentEndDate = useMemo(() => {
    if (!billing) return null;

    if (billing.subscription_status === "trial") {
      return billing.trial_ends_at;
    }

    return billing.subscription_ends_at;
  }, [billing]);

  const selectedTeamPreview = useMemo(() => {
    const currentPlan = plans.find((item) => item.code === "team");
    if (!currentPlan) return null;

    return calculatePlanPrice({
      plan: currentPlan,
      billingPeriod: selectedPeriod,
      extraMembers: selectedExtraMembers,
    });
  }, [plans, selectedPeriod, selectedExtraMembers]);

  if (isAppContextLoading || isLoadingBillingPage) {
    return (
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            Загружаем раздел тарифов...
          </div>
        </div>
      </main>
    );
  }

  if (!canViewBilling) {
    return (
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
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
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-sm text-white/50">Раздел</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
  Тарифы
</h1>
                <p className="mt-2 text-sm text-white/55">
                  Просмотр тарифа, статуса подписки, баланса кабинета и истории
                  операций.
                </p>
              </div>

              <a
  href={TELEGRAM_URL}
  target="_blank"
  rel="noreferrer"
  className="inline-flex items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-200 transition hover:bg-sky-500/15"
>
  Пополнить баланс
</a>
            </div>
          </div>

          {billingAccess?.isReadOnly ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Подписка неактивна. Кабинет работает в режиме только просмотра до
              продления тарифа.
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="text-sm text-white/50">Текущий тариф</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {currentPlanName}
              </div>
              <div className="mt-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs ${getStatusTone(
                    billing?.subscription_status
                  )}`}
                >
                  {getStatusLabel(billing?.subscription_status)}
                </span>
              </div>
              <div className="mt-4 text-sm text-white/60">
                Действует до:{" "}
                <span className="text-white">{formatDate(currentEndDate)}</span>
              </div>
              <div className="mt-2 text-sm text-white/60">
                Период:{" "}
                <span className="text-white">
                  {billing?.billing_period === "yearly"
                    ? "Годовая подписка"
                    : "Месячная подписка"}
                </span>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="text-sm text-white/50">Баланс</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-300">
                {formatMoney(balance)}
              </div>
              <div className="mt-4 text-sm text-white/60">
  Баланс временно пополняется вручную со стороны администрации
  сервиса после подтверждения оплаты.
</div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="text-sm text-white/50">Возможности кабинета</div>
              <div className="mt-4 space-y-2 text-sm text-white/70">
  <div>
    Команда:{" "}
    <span className="text-white">
      {billingAccess?.teamEnabled ? "включена" : "отключена"}
    </span>
  </div>
  <div>
    Доступно мест:{" "}
    <span className="text-white">
      {billingAccess?.totalAllowedMembers ?? 0}
    </span>
  </div>
  <div>
    AI:{" "}
    <span className="text-white">
      {billingAccess?.aiEnabled ? "включён" : "отключён"}
    </span>
  </div>
</div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-sm text-white/50">Тарифы</div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  Выбор и продление подписки
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  На текущем этапе подключение и продление тарифа происходит
                  вручную через Telegram и внутреннюю админку сервиса.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("monthly")}
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    selectedPeriod === "monthly"
                      ? "bg-white text-[#0B0F1A]"
                      : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  За месяц
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPeriod("yearly")}
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    selectedPeriod === "yearly"
                      ? "bg-white text-[#0B0F1A]"
                      : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  За год
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {plans
                .filter((plan) => plan.code !== "trial")
                .map((plan) => {
                  const preview = calculatePlanPrice({
                    plan,
                    billingPeriod: selectedPeriod,
                    extraMembers:
                      plan.code === "team" || plan.code === "strategy"
                        ? selectedExtraMembers
                        : 0,
                  });

                  const isCurrentPlan = billing?.plan_code === plan.code;

                  return (
                    <div
  key={plan.code}
  className={`group relative flex h-full flex-col rounded-[24px] border bg-[#0F1524] p-5 transition-all duration-300 ease-out ${
    isCurrentPlan
      ? "border-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
      : "border-white/10 hover:border-violet-400/35 hover:bg-[#131C2E] hover:shadow-[0_0_0_1px_rgba(123,97,255,0.18),0_20px_60px_rgba(0,0,0,0.35)]"
  }`}
>  <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-white/[0.02] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />  <div className="relative flex items-center justify-between gap-3">
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="text-lg font-semibold text-white transition-colors duration-200 group-hover:text-white">
  {plan.name}
</div>
                        {isCurrentPlan ? (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                            Текущий
                          </span>
                        ) : null}
                      </div>
  </div>
                      <div className="mt-4 text-3xl font-semibold text-white transition-transform duration-200 group-hover:scale-[1.01]">
  {formatMoney(preview.totalPrice)}
</div>

                      <div className="mt-2 text-sm text-white/55">
                        {selectedPeriod === "yearly"
                          ? "за год"
                          : "за месяц"}
                      </div>

                      <div className="relative mt-4 space-y-2 text-sm text-white/70">
                        <div>
                          Включено мест:{" "}
                          <span className="text-white">
                            {plan.included_members}
                          </span>
                        </div>
                        <div>
                          Максимум мест:{" "}
                          <span className="text-white">
                            {plan.max_members ?? "Без лимита"}
                          </span>
                        </div>
                        <div>
                          Команда:{" "}
                          <span className="text-white">
                            {plan.team_enabled ? "да" : "нет"}
                          </span>
                        </div>
                        <div>
                          AI:{" "}
                          <span className="text-white">
                            {plan.ai_enabled ? "да" : "нет"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 h-[92px]">
  {plan.code === "team" || plan.code === "strategy" ? (
    <>
      <div className="mb-2 text-xs text-white/45">
        Дополнительные места
      </div>
      <input
        type="number"
        min={0}
        max={
          plan.max_members
            ? Math.max(0, plan.max_members - plan.included_members)
            : 200
        }
        value={selectedExtraMembers}
        onChange={(e) =>
          setSelectedExtraMembers(
            Math.max(0, Number(e.target.value) || 0)
          )
        }
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
      />
    </>
  ) : (
    <div>
  <div className="mb-2 text-xs text-white/45">
    Дополнительные места
  </div>
  <input
    type="text"
    value="Отсутствуют"
    readOnly
    className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/40 outline-none cursor-not-allowed"
  />
</div>
  )}
</div>

                      <div className="mt-auto pt-6 flex flex-col gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setToastType("info");
                            setToastMessage(
  `Чтобы подключить тариф ${plan.name}, перейди в Telegram: ${TELEGRAM_CONTACT}`
);
                          }}
                          className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition-all duration-300 group-hover:bg-emerald-400/20 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.24)]"
                        >
                          {getPlanActionLabel({
                            isCurrentPlan,
                            isReadOnly: !!billingAccess?.isReadOnly,
                          })}
                        </button>

                        <div className="text-xs text-white/40">
                          Баланс и активация тарифа управляются только через
                          внутреннюю админку сервиса.
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {selectedTeamPreview ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
                Пример расчёта TEAM: база{" "}
                <span className="text-white">
                  {formatMoney(selectedTeamPreview.basePrice)}
                </span>
                , доп. места{" "}
                <span className="text-white">
                  {selectedTeamPreview.extraMembers}
                </span>
                , итог{" "}
                <span className="font-medium text-white">
                  {formatMoney(selectedTeamPreview.totalPrice)}
                </span>
                .
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-white/50">История операций</div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  Транзакции
                </h2>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
              {transactions.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.04] text-white/45">
                    <tr>
                      <th className="px-4 py-3 font-medium">Тип</th>
                      <th className="px-4 py-3 font-medium">Описание</th>
                      <th className="px-4 py-3 font-medium">Дата</th>
                      <th className="px-4 py-3 font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((item) => {
                      const isPositive = item.amount >= 0;

                      return (
                        <tr
                          key={item.id}
                          className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-3 text-white/75">
                            {getTransactionLabel(item.transaction_type)}
                          </td>
                          <td className="px-4 py-3 text-white/75">
                            {item.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-white/75">
                            {formatDate(item.created_at)}
                          </td>
                          <td
                            className={`px-4 py-3 font-medium ${
                              isPositive
                                ? "text-emerald-300"
                                : "text-rose-300"
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
                    description="Когда появятся пополнения и списания, они будут отображаться здесь."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}