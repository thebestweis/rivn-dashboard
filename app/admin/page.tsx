"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContextState } from "../providers/app-context-provider";
import {
  addManualBalanceAdjustmentAction,
  activatePlanFromBalanceAction,
  forceSetWorkspaceBillingStatusAction,
  getAdminOverviewAction,
} from "./actions";
import type {
  AdminWorkspaceRow,
  AdminActionLogRow,
} from "../lib/supabase/admin";

type AdminPlanCode = "base" | "team" | "strategy";
type BillingPeriod = "monthly" | "yearly";
type StatusFilter = "all" | "trial" | "active" | "past_due" | "expired";
type PlanFilter = "all" | "trial" | "base" | "team" | "strategy";
type LogTypeFilter =
  | "all"
  | "manual_balance_adjustment"
  | "activate_plan_from_balance"
  | "force_billing_status";

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function getPlanLabel(planCode: string | null | undefined) {
  if (!planCode) return "—";
  if (planCode === "trial") return "TRIAL";
  return planCode.toUpperCase();
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
      return "—";
  }
}

function getStatusClasses(status: string | null | undefined) {
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

function isPlanWithExtraMembers(planCode: AdminPlanCode) {
  return planCode === "team" || planCode === "strategy";
}

function getActionLabel(actionType: string) {
  switch (actionType) {
    case "manual_balance_adjustment":
      return "Корректировка баланса";
    case "activate_plan_from_balance":
      return "Активация / продление тарифа";
    case "force_billing_status":
      return "Принудительная смена статуса";
    default:
      return actionType;
  }
}

function getActionBadgeClass(actionType: string) {
  switch (actionType) {
    case "manual_balance_adjustment":
      return "bg-emerald-500/15 text-emerald-300";
    case "activate_plan_from_balance":
      return "bg-violet-500/15 text-violet-300";
    case "force_billing_status":
      return "bg-amber-500/15 text-amber-300";
    default:
      return "bg-white/10 text-white/60";
  }
}

function getLogSummary(log: AdminActionLogRow) {
  const payload = log.action_payload ?? {};

  if (log.action_type === "manual_balance_adjustment") {
    const amount = Number(payload.amount ?? 0);
    const description = String(payload.description ?? "");
    return {
      title:
        amount >= 0
          ? `Пополнение на ${formatMoney(amount)}`
          : `Списание на ${formatMoney(Math.abs(amount))}`,
      description: description || "Без комментария",
    };
  }

  if (log.action_type === "activate_plan_from_balance") {
    const planCode = String(payload.planCode ?? "");
    const billingPeriod = String(payload.billingPeriod ?? "");
    const extraMembers = Number(payload.extraMembers ?? 0);
    const chargedAmount = Number(payload.chargedAmount ?? 0);
    const description = String(payload.description ?? "");

    const periodLabel =
      billingPeriod === "yearly"
        ? "год"
        : billingPeriod === "monthly"
        ? "месяц"
        : "период не указан";

    return {
      title: `${getPlanLabel(planCode)} • ${periodLabel} • ${formatMoney(
        chargedAmount
      )}`,
      description:
        extraMembers > 0
          ? `Доп. мест: ${extraMembers}${
              description ? ` • ${description}` : ""
            }`
          : description || "Без комментария",
    };
  }

  if (log.action_type === "force_billing_status") {
    const previousStatus = String(payload.previousStatus ?? "");
    const nextStatus = String(payload.nextStatus ?? "");
    const description = String(payload.description ?? "");

    return {
      title: `${getStatusLabel(previousStatus)} → ${getStatusLabel(nextStatus)}`,
      description: description || "Статус подписки изменён вручную",
    };
  }

  return {
    title: getActionLabel(log.action_type),
    description: "Служебное действие",
  };
}

export default function AdminPage() {
  const { profile, isLoading } = useAppContextState();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminActionLogRow[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<AdminWorkspaceRow | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [onlyLowBalance, setOnlyLowBalance] = useState(false);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isLoadingBalanceAction, setIsLoadingBalanceAction] = useState(false);

  const [selectedPlanCode, setSelectedPlanCode] =
    useState<AdminPlanCode>("base");
  const [selectedBillingPeriod, setSelectedBillingPeriod] =
    useState<BillingPeriod>("monthly");
  const [selectedExtraMembers, setSelectedExtraMembers] = useState(0);
  const [isLoadingPlanAction, setIsLoadingPlanAction] = useState(false);
  const [isLoadingStatusAction, setIsLoadingStatusAction] = useState(false);

  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;

    if (profile?.platform_role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [mounted, profile, isLoading, router]);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const overview = await getAdminOverviewAction();

        setWorkspaces(overview.workspaces ?? []);
        setAdminLogs((overview.logs ?? []).slice(0, 30));
      } catch (error) {
  console.error("Ошибка загрузки admin данных:", error);
  alert(
    error instanceof Error
      ? error.message
      : "Не удалось загрузить admin данные"
  );
  setWorkspaces([]);
  setAdminLogs([]);
}
    }

    if (mounted && profile?.platform_role === "super_admin") {
      void loadAdminData();
    }
  }, [mounted, profile]);

  useEffect(() => {
    if (!selectedWorkspace) return;

    const currentPlan = selectedWorkspace.billing?.plan_code;

    if (
      currentPlan === "base" ||
      currentPlan === "team" ||
      currentPlan === "strategy"
    ) {
      setSelectedPlanCode(currentPlan);
    } else {
      setSelectedPlanCode("base");
    }

    const currentPeriod = selectedWorkspace.billing?.billing_period;
    if (currentPeriod === "monthly" || currentPeriod === "yearly") {
      setSelectedBillingPeriod(currentPeriod);
    } else {
      setSelectedBillingPeriod("monthly");
    }

    setSelectedExtraMembers(0);
  }, [selectedWorkspace]);

  const filteredWorkspaces = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return workspaces.filter((ws) => {
      const name = (ws.name || "").toLowerCase();
      const slug = (ws.slug || "").toLowerCase();
      const id = (ws.id || "").toLowerCase();

      const matchesSearch =
        !normalized ||
        name.includes(normalized) ||
        slug.includes(normalized) ||
        id.includes(normalized);

      const workspaceStatus = ws.billing?.subscription_status ?? null;
      const matchesStatus =
        statusFilter === "all" ? true : workspaceStatus === statusFilter;

      const workspacePlan = ws.billing?.plan_code ?? null;
      const matchesPlan =
        planFilter === "all" ? true : workspacePlan === planFilter;

      const balanceValue = Number(ws.balance?.balance ?? 0);
      const matchesLowBalance = onlyLowBalance ? balanceValue <= 0 : true;

      return (
        matchesSearch && matchesStatus && matchesPlan && matchesLowBalance
      );
    });
  }, [workspaces, search, statusFilter, planFilter, onlyLowBalance]);

  const filteredLogs = useMemo(() => {
    const normalized = logSearch.trim().toLowerCase();

    return adminLogs.filter((log) => {
      const workspaceId = String(log.workspace_id ?? "").toLowerCase();
      const adminUserId = String(log.admin_user_id ?? "").toLowerCase();
      const actionType = String(log.action_type ?? "").toLowerCase();
      const payload = JSON.stringify(log.action_payload ?? {}).toLowerCase();

      const matchesSearch =
        !normalized ||
        workspaceId.includes(normalized) ||
        adminUserId.includes(normalized) ||
        actionType.includes(normalized) ||
        payload.includes(normalized);

      const matchesType =
        logTypeFilter === "all" ? true : log.action_type === logTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [adminLogs, logSearch, logTypeFilter]);

  const selectedWorkspaceBalance = useMemo(() => {
    return selectedWorkspace?.balance?.balance ?? 0;
  }, [selectedWorkspace]);

  async function reloadWorkspaces(keepSelectedWorkspaceId?: string) {
    const overview = await getAdminOverviewAction();

    setWorkspaces(overview.workspaces ?? []);
    setAdminLogs((overview.logs ?? []).slice(0, 30));

    if (keepSelectedWorkspaceId) {
      const fresh = (overview.workspaces ?? []).find(
        (w) => w.id === keepSelectedWorkspaceId
      );
      setSelectedWorkspace(fresh ?? null);
    }
  }

  async function handleBalanceChange() {
    if (!selectedWorkspace) return;

    const parsedAmount = Number(amount.replace(",", "."));

    if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
      alert("Введите корректную сумму");
      return;
    }

    try {
      setIsLoadingBalanceAction(true);

      await addManualBalanceAdjustmentAction({
        workspaceId: selectedWorkspace.id,
        amount: parsedAmount,
        description: description || "Admin adjustment",
      });

      await reloadWorkspaces(selectedWorkspace.id);

      setAmount("");
      setDescription("");

      alert("Баланс обновлён");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ошибка при изменении баланса"
      );
    } finally {
      setIsLoadingBalanceAction(false);
    }
  }

  async function handlePlanActivation(params: { isRenewal: boolean }) {
    if (!selectedWorkspace) return;

    try {
      setIsLoadingPlanAction(true);

      await activatePlanFromBalanceAction({
        workspaceId: selectedWorkspace.id,
        planCode: selectedPlanCode,
        billingPeriod: selectedBillingPeriod,
        extraMembers: isPlanWithExtraMembers(selectedPlanCode)
          ? selectedExtraMembers
          : 0,
        description: params.isRenewal
          ? "Продление тарифа через admin panel"
          : "Активация тарифа через admin panel",
      });

      await reloadWorkspaces(selectedWorkspace.id);

      alert(
        params.isRenewal
          ? "Тариф успешно продлён"
          : "Тариф успешно активирован"
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ошибка при активации / продлении тарифа"
      );
    } finally {
      setIsLoadingPlanAction(false);
    }
  }

  async function handleForceStatus(
    nextStatus: "active" | "past_due" | "expired"
  ) {
    if (!selectedWorkspace) return;

    try {
      setIsLoadingStatusAction(true);

      await forceSetWorkspaceBillingStatusAction({
        workspaceId: selectedWorkspace.id,
        nextStatus,
        description: "Изменение статуса через admin panel",
      });

      await reloadWorkspaces(selectedWorkspace.id);

      alert("Статус подписки обновлён");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Ошибка при изменении статуса подписки"
      );
    } finally {
      setIsLoadingStatusAction(false);
    }
  }

  if (!mounted || isLoading) {
    return <div className="p-6 text-white/60">Проверка доступа...</div>;
  }

  if (profile?.platform_role !== "super_admin") {
    return <div className="p-6 text-white/60">Проверка доступа...</div>;
  }

  return (
    <main className="flex-1 p-6 space-y-6">
      <div className="text-2xl font-semibold text-white">Admin Panel</div>

      <div className="text-white/60">
        Здесь ты управляешь балансами, тарифами и подписками пользователей.
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
        <div className="mb-3 text-sm text-white/50">Workspaces</div>

        <div className="mb-4 space-y-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, slug или id кабинета"
            className="h-[48px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none placeholder:text-white/35"
          />

          <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
            <div>
              <div className="mb-2 text-xs text-white/45">Фильтр по статусу</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Все" },
                  { value: "trial", label: "Триал" },
                  { value: "active", label: "Активные" },
                  { value: "past_due", label: "Past due" },
                  { value: "expired", label: "Истекшие" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatusFilter(item.value as StatusFilter)}
                    className={`rounded-xl px-3 py-2 text-sm transition ${
                      statusFilter === item.value
                        ? "bg-white text-[#0B0F1A]"
                        : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs text-white/45">Фильтр по тарифу</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "Все" },
                  { value: "trial", label: "TRIAL" },
                  { value: "base", label: "BASE" },
                  { value: "team", label: "TEAM" },
                  { value: "strategy", label: "STRATEGY" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPlanFilter(item.value as PlanFilter)}
                    className={`rounded-xl px-3 py-2 text-sm transition ${
                      planFilter === item.value
                        ? "bg-white text-[#0B0F1A]"
                        : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setOnlyLowBalance((prev) => !prev)}
                className={`h-[40px] rounded-xl px-3 py-2 text-sm transition ${
                  onlyLowBalance
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Нулевой / минус баланс
              </button>
            </div>
          </div>

          <div className="text-sm text-white/45">
            Найдено кабинетов:{" "}
            <span className="font-medium text-white">
              {filteredWorkspaces.length}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {filteredWorkspaces.length > 0 ? (
            filteredWorkspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => setSelectedWorkspace(ws)}
                className={`cursor-pointer rounded-xl px-4 py-4 transition ${
                  selectedWorkspace?.id === ws.id
                    ? "border border-emerald-500/30 bg-emerald-500/10"
                    : "bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="text-base font-medium text-white">
                      {ws.name || "Без названия"}
                    </div>
                    <div className="mt-1 text-xs text-white/40">ID: {ws.id}</div>
                    <div className="mt-1 text-xs text-white/40">
                      Slug: {ws.slug || "—"}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                    <div className="rounded-xl border border-white/10 bg-[#0F1524] px-3 py-3">
                      <div className="text-xs text-white/45">Баланс</div>
                      <div className="mt-1 text-sm font-medium text-emerald-300">
                        {formatMoney(ws.balance?.balance)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0F1524] px-3 py-3">
                      <div className="text-xs text-white/45">Тариф</div>
                      <div className="mt-1 text-sm font-medium text-white">
                        {getPlanLabel(ws.billing?.plan_code)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0F1524] px-3 py-3">
                      <div className="text-xs text-white/45">Статус</div>
                      <div className="mt-1">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${getStatusClasses(
                            ws.billing?.subscription_status
                          )}`}
                        >
                          {getStatusLabel(ws.billing?.subscription_status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-white/40">
              {search.trim() ||
              statusFilter !== "all" ||
              planFilter !== "all" ||
              onlyLowBalance
                ? "По заданным фильтрам кабинеты не найдены"
                : "Нет доступных workspace"}
            </div>
          )}
        </div>
      </div>

      {selectedWorkspace ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
            <div className="text-lg font-semibold text-white">
              Управление балансом
            </div>

            <div className="mt-2 text-sm text-white/50">
              {selectedWorkspace.name} ({selectedWorkspace.id})
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-[#0F1524] px-4 py-3">
              <div className="text-xs text-white/45">Текущий баланс</div>
              <div className="mt-1 text-lg font-medium text-emerald-300">
                {formatMoney(selectedWorkspaceBalance)}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Сумма (например 5000 или -1000)"
                className="h-[48px] rounded-xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none"
              />

              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Комментарий"
                className="h-[48px] rounded-xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none"
              />
            </div>

            <button
              onClick={handleBalanceChange}
              disabled={isLoadingBalanceAction}
              className="mt-4 rounded-xl bg-emerald-400/15 px-4 py-3 text-sm text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"
            >
              {isLoadingBalanceAction ? "Применяем..." : "Изменить баланс"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
            <div className="text-lg font-semibold text-white">
              Управление тарифом
            </div>

            <div className="mt-2 text-sm text-white/50">
              Текущий тариф: {getPlanLabel(selectedWorkspace.billing?.plan_code)} •{" "}
              {getStatusLabel(selectedWorkspace.billing?.subscription_status)}
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <div className="mb-2 text-xs text-white/45">Тариф</div>
                <select
                  value={selectedPlanCode}
                  onChange={(e) =>
                    setSelectedPlanCode(e.target.value as AdminPlanCode)
                  }
                  className="h-[48px] w-full rounded-xl border border-white/10 bg-[#0F1524] px-4 text-white outline-none"
                >
                  <option value="base">BASE</option>
                  <option value="team">TEAM</option>
                  <option value="strategy">STRATEGY</option>
                </select>
              </div>

              <div>
                <div className="mb-2 text-xs text-white/45">Период</div>
                <select
                  value={selectedBillingPeriod}
                  onChange={(e) =>
                    setSelectedBillingPeriod(e.target.value as BillingPeriod)
                  }
                  className="h-[48px] w-full rounded-xl border border-white/10 bg-[#0F1524] px-4 text-white outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {isPlanWithExtraMembers(selectedPlanCode) ? (
                <div>
                  <div className="mb-2 text-xs text-white/45">
                    Дополнительные места
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={selectedExtraMembers}
                    onChange={(e) =>
                      setSelectedExtraMembers(
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="h-[48px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none"
                  />
                </div>
              ) : null}

              <div className="rounded-xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white/65">
                Из баланса будет произведено списание и активирован либо продлён
                выбранный тариф.
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => handlePlanActivation({ isRenewal: false })}
                disabled={isLoadingPlanAction}
                className="rounded-xl bg-violet-500/15 px-4 py-3 text-sm text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                {isLoadingPlanAction ? "Обрабатываем..." : "Активировать тариф"}
              </button>

              <button
                onClick={() => handlePlanActivation({ isRenewal: true })}
                disabled={isLoadingPlanAction}
                className="rounded-xl bg-emerald-400/15 px-4 py-3 text-sm text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"
              >
                {isLoadingPlanAction ? "Обрабатываем..." : "Продлить тариф"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121826] p-5">
            <div className="text-lg font-semibold text-white">
              Быстрые действия
            </div>

            <div className="mt-2 text-sm text-white/50">
              Принудительное изменение статуса подписки
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => handleForceStatus("active")}
                disabled={isLoadingStatusAction}
                className="w-full rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {isLoadingStatusAction ? "Обрабатываем..." : "Сделать ACTIVE"}
              </button>

              <button
                onClick={() => handleForceStatus("past_due")}
                disabled={isLoadingStatusAction}
                className="w-full rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
              >
                {isLoadingStatusAction ? "Обрабатываем..." : "Сделать PAST_DUE"}
              </button>

              <button
                onClick={() => handleForceStatus("expired")}
                disabled={isLoadingStatusAction}
                className="w-full rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
              >
                {isLoadingStatusAction ? "Обрабатываем..." : "Сделать EXPIRED"}
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white/60">
              Используй эти действия аккуратно. Они меняют статус подписки напрямую
              и логируются в admin logs.
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
        <div className="mb-3 text-sm text-white/50">Admin action logs</div>

        <div className="mb-4 space-y-4">
          <input
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            placeholder="Поиск по workspace id, admin id, типу действия или payload"
            className="h-[48px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none placeholder:text-white/35"
          />

          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "Все" },
              { value: "manual_balance_adjustment", label: "Баланс" },
              { value: "activate_plan_from_balance", label: "Тарифы" },
              { value: "force_billing_status", label: "Статусы" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setLogTypeFilter(item.value as LogTypeFilter)}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  logTypeFilter === item.value
                    ? "bg-white text-[#0B0F1A]"
                    : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="text-sm text-white/45">
            Найдено логов:{" "}
            <span className="font-medium text-white">{filteredLogs.length}</span>
          </div>
        </div>

        <div className="space-y-3">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              const summary = getLogSummary(log);

              return (
                <div
                  key={log.id}
                  className="rounded-xl bg-white/[0.03] px-4 py-4"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${getActionBadgeClass(
                            log.action_type
                          )}`}
                        >
                          {getActionLabel(log.action_type)}
                        </span>
                      </div>

                      <div className="mt-3 text-sm font-medium text-white">
                        {summary.title}
                      </div>

                      <div className="mt-1 text-sm text-white/60">
                        {summary.description}
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-white/40">
                        <div>Workspace: {log.workspace_id || "—"}</div>
                        <div>Admin: {log.admin_user_id}</div>
                      </div>
                    </div>

                    <div className="shrink-0 text-xs text-white/45">
                      {new Date(log.created_at).toLocaleString("ru-RU")}
                    </div>
                  </div>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs text-white/45 hover:text-white/70">
                      Показать payload
                    </summary>
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#0F1524] p-3 text-xs text-white/65">
{JSON.stringify(log.action_payload, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-white/40">
              По заданным фильтрам логи не найдены
            </div>
          )}
        </div>
      </div>
    </main>
  );
}