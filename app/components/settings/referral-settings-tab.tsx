"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { AppToast } from "../ui/app-toast";
import { BillingAccessBanner } from "../ui/billing-access-banner";
import { RivnDatePicker } from "../ui/rivn-date-picker";
import {
  createPersonalReferralLink,
  ensureMyStandardReferralLink,
  getMyReferralLinks,
  getMyReferralRewards,
  getMyReferralStats,
  markReferralRewardAsPaid,
  setReferralLinkActiveState,
  updateReferralLinkDetails,
  type ReferralLinkItem,
  type ReferralRewardItem,
  type ReferralStats,
} from "../../lib/supabase/referrals";
import { getBillingErrorMessage } from "../../lib/billing-errors";
import { queryKeys } from "../../lib/query-keys";

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getRewardStatusLabel(status: ReferralRewardItem["status"]) {
  if (status === "approved") return "Начислено";
  if (status === "paid") return "Выплачено";
  if (status === "pending") return "В ожидании";
  if (status === "canceled") return "Отменено";
  return status;
}

function getRewardStatusClasses(status: ReferralRewardItem["status"]) {
  if (status === "approved") {
    return "bg-emerald-500/15 text-emerald-300";
  }

  if (status === "paid") {
    return "bg-sky-500/15 text-sky-300";
  }

  if (status === "pending") {
    return "bg-amber-500/15 text-amber-300";
  }

  if (status === "canceled") {
    return "bg-rose-500/15 text-rose-300";
  }

  return "bg-white/10 text-white/60";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildReferralUrl(code: string) {
  if (typeof window === "undefined") {
    return `/register?ref=${code}`;
  }

  return `${window.location.origin}/register?ref=${code}`;
}

export function ReferralSettingsTab() {
  const queryClient = useQueryClient();

  const {
    billingAccess,
    isLoading: isAppContextLoading,
    isSuperAdmin,
  } = useAppContextState();

  const [creatingPersonalLink, setCreatingPersonalLink] = useState(false);
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);
  const [payingRewardId, setPayingRewardId] = useState<string | null>(null);
  const [personalLinkLabel, setPersonalLinkLabel] = useState("");
  const [personalLinkComment, setPersonalLinkComment] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkLabel, setEditingLinkLabel] = useState("");
  const [editingLinkComment, setEditingLinkComment] = useState("");
  const [savingLinkDetailsId, setSavingLinkDetailsId] = useState<string | null>(
    null
  );
  const [selectedRewardLinkId, setSelectedRewardLinkId] = useState("all");
  const [rewardPeriodFrom, setRewardPeriodFrom] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return formatDateInputValue(date);
  });
  const [rewardPeriodTo, setRewardPeriodTo] = useState(() =>
    formatDateInputValue(new Date())
  );

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;

  const {
    data: links = [],
    isLoading: isLinksLoading,
  } = useQuery<ReferralLinkItem[]>({
    queryKey: queryKeys.referralLinks,
    queryFn: async () => {
      await ensureMyStandardReferralLink();
      return getMyReferralLinks();
    },
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: rewards = [],
    isLoading: isRewardsLoading,
  } = useQuery<ReferralRewardItem[]>({
    queryKey: queryKeys.referralRewards,
    queryFn: getMyReferralRewards,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: stats = null,
    isLoading: isStatsLoading,
  } = useQuery<ReferralStats | null>({
    queryKey: queryKeys.referralStats,
    queryFn: getMyReferralStats,
    staleTime: 1000 * 60 * 5,
  });

  async function refreshReferralData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.referralLinks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.referralRewards }),
      queryClient.invalidateQueries({ queryKey: queryKeys.referralStats }),
    ]);
  }

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const isLoading = isLinksLoading || isRewardsLoading || isStatsLoading;

  const standardLink = useMemo(() => {
    return links.find((item) => item.link_type === "standard_25") ?? null;
  }, [links]);

  const personalLinks = useMemo(() => {
    return links.filter((item) => item.link_type === "personal_50");
  }, [links]);

  const filteredRewards = useMemo(() => {
    const fromTime = rewardPeriodFrom
      ? new Date(`${rewardPeriodFrom}T00:00:00`).getTime()
      : null;
    const toTime = rewardPeriodTo
      ? new Date(`${rewardPeriodTo}T23:59:59`).getTime()
      : null;

    return rewards.filter((reward) => {
      const rewardTime = new Date(reward.created_at).getTime();

      if (selectedRewardLinkId !== "all") {
        if (reward.referral_link_id !== selectedRewardLinkId) {
          return false;
        }
      }

      if (fromTime !== null && rewardTime < fromTime) {
        return false;
      }

      if (toTime !== null && rewardTime > toTime) {
        return false;
      }

      return true;
    });
  }, [rewards, rewardPeriodFrom, rewardPeriodTo, selectedRewardLinkId]);

  const rewardPeriodStats = useMemo(() => {
    return filteredRewards.reduce(
      (acc, reward) => {
        acc.paymentAmount += reward.payment_amount;
        acc.rewardAmount += reward.reward_amount;

        if (reward.status === "approved") {
          acc.approvedAmount += reward.reward_amount;
        }

        if (reward.status === "paid") {
          acc.paidAmount += reward.reward_amount;
        }

        return acc;
      },
      {
        paymentAmount: 0,
        rewardAmount: 0,
        approvedAmount: 0,
        paidAmount: 0,
      }
    );
  }, [filteredRewards]);

  async function handleCopyLink(code: string) {
    try {
      const url = buildReferralUrl(code);
      await navigator.clipboard.writeText(url);
      setToastType("success");
      setToastMessage("Реферальная ссылка скопирована");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось скопировать ссылку");
    }
  }

  async function handleCreatePersonalLink() {
    if (!isSuperAdmin) {
      setToastType("error");
      setToastMessage("Только super admin может создавать персональные ссылки");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    try {
      setCreatingPersonalLink(true);

      await createPersonalReferralLink({
        rewardPercent: 50,
        label: personalLinkLabel,
        comment: personalLinkComment,
      });

      await refreshReferralData();
      setPersonalLinkLabel("");
      setPersonalLinkComment("");

      setToastType("success");
      setToastMessage("Персональная ссылка 50% создана");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setCreatingPersonalLink(false);
    }
  }

  async function handleToggleLink(link: ReferralLinkItem) {
    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    try {
      setTogglingLinkId(link.id);

      await setReferralLinkActiveState({
        linkId: link.id,
        isActive: !link.is_active,
      });

      await refreshReferralData();

      setToastType("success");
      setToastMessage(
        link.is_active ? "Ссылка деактивирована" : "Ссылка активирована"
      );
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setTogglingLinkId(null);
    }
  }

  function startEditingPersonalLink(link: ReferralLinkItem) {
    setEditingLinkId(link.id);
    setEditingLinkLabel(link.label ?? "");
    setEditingLinkComment(link.comment ?? "");
  }

  function cancelEditingPersonalLink() {
    setEditingLinkId(null);
    setEditingLinkLabel("");
    setEditingLinkComment("");
  }

  async function handleSavePersonalLinkDetails(link: ReferralLinkItem) {
    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    try {
      setSavingLinkDetailsId(link.id);

      await updateReferralLinkDetails({
        linkId: link.id,
        label: editingLinkLabel,
        comment: editingLinkComment,
      });

      await refreshReferralData();
      cancelEditingPersonalLink();

      setToastType("success");
      setToastMessage("Описание ссылки обновлено");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setSavingLinkDetailsId(null);
    }
  }

  async function handleMarkRewardAsPaid(reward: ReferralRewardItem) {
    if (!isSuperAdmin) {
      setToastType("error");
      setToastMessage("Только super admin может отмечать выплаты");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    try {
      setPayingRewardId(reward.id);

      await markReferralRewardAsPaid(reward.id);
      await refreshReferralData();

      setToastType("success");
      setToastMessage("Начисление отмечено как выплаченное");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setPayingRewardId(null);
    }
  }

  return (
    <>
      <div className="rivn-card rivn-card-interactive p-5 sm:p-6">
        <BillingAccessBanner
          isLoading={isAppContextLoading}
          isBillingReadOnly={isBillingReadOnly}
          canManage={true}
          readOnlyMessage="Подписка неактивна. Реферальный раздел доступен только в режиме просмотра, пока тариф не будет активирован."
          roleRestrictedMessage=""
          className="mb-5"
        />

        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#43ffc2]">Реферальная система</div>
          <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">Партнёрская программа</h2>
          <div className="mt-2 text-sm text-white/55">
            Приглашай новых пользователей в RIVN OS и получай 25% от всех их
            оплат.
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#7c5cff]/20 bg-[#7c5cff]/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="text-sm font-medium text-white">
            Хочешь лучшие условия по партнёрской программе?
          </div>
          <div className="mt-2 text-sm text-white/70">
            Если у тебя есть аудитория, блог, канал или сильный поток клиентов,
            можем обсудить персональные условия сотрудничества и повышенный
            процент.
          </div>
          <a
            href="https://t.me/thebestweis"
            target="_blank"
            rel="noreferrer"
            className="rivn-button mt-4 px-4 py-2 text-sm"
          >
            Обсудить сотрудничество
          </a>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
            Загружаем реферальные данные...
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-5">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                <div className="text-xs text-white/45">Приглашено</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {stats?.totalReferrals ?? 0}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                <div className="text-xs text-white/45">Оборот оплат</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(stats?.totalRevenueFromReferrals ?? 0)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                <div className="text-xs text-white/45">Начислено</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(stats?.totalApprovedRewards ?? 0)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                <div className="text-xs text-white/45">Выплачено</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(stats?.totalPaidRewards ?? 0)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                <div className="text-xs text-white/45">Доступно к выплате</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(
                    Math.max(
                      (stats?.totalApprovedRewards ?? 0) -
                        (stats?.totalPaidRewards ?? 0),
                      0
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-white/45">Моя основная ссылка</div>
                  <div className="mt-2 text-sm text-white/75">
                    Делись этой ссылкой и получай 25% от всех оплат приглашённых
                    пользователей.
                  </div>
                </div>

                {standardLink ? (
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                    {standardLink.reward_percent}%
                  </span>
                ) : null}
              </div>

              {standardLink ? (
                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                  <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                    {buildReferralUrl(standardLink.code)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(standardLink.code)}
                    className="rivn-button px-4 py-3 text-sm"
                  >
                    Копировать
                  </button>
                </div>
              ) : (
                <div className="mt-4 text-sm text-white/45">
                  Стандартная ссылка ещё не создана
                </div>
              )}
            </div>

            {isSuperAdmin ? (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-white/45">
                        Персональные ссылки
                      </div>
                      <div className="mt-2 text-sm text-white/75">
                        Специальные ссылки с выплатой 50%. Используй их для
                        блогеров, партнёров или отдельных договорённостей.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreatePersonalLink}
                      disabled={creatingPersonalLink || isBillingReadOnly}
                      className="rivn-button rivn-button-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingPersonalLink
                        ? "Создаём..."
                        : "Создать 50% ссылку"}
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                    <div>
                      <label className="mb-2 block text-sm text-white/55">
                        Название ссылки
                      </label>
                      <input
                        type="text"
                        value={personalLinkLabel}
                        onChange={(e) => setPersonalLinkLabel(e.target.value)}
                        placeholder="Например: Иван / YouTube"
                        className="rivn-field placeholder:text-white/30"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-white/55">
                        Комментарий
                      </label>
                      <textarea
                        value={personalLinkComment}
                        onChange={(e) => setPersonalLinkComment(e.target.value)}
                        placeholder="Кому выдана ссылка, где будет размещаться, условия договорённости"
                        rows={2}
                        className="rivn-field rivn-textarea min-h-[70px] placeholder:text-white/30"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {personalLinks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/40">
                      Персональных ссылок пока нет
                    </div>
                  ) : (
                    personalLinks.map((link) => (
                      <div
                        key={link.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]"
                      >
                        {editingLinkId === link.id ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <label className="mb-2 block text-xs text-white/45">
                                  Название ссылки
                                </label>
                                <input
                                  type="text"
                                  value={editingLinkLabel}
                                  onChange={(event) =>
                                    setEditingLinkLabel(event.target.value)
                                  }
                                  className="rivn-field h-[44px] placeholder:text-white/30"
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-xs text-white/45">
                                  Комментарий
                                </label>
                                <textarea
                                  value={editingLinkComment}
                                  onChange={(event) =>
                                    setEditingLinkComment(event.target.value)
                                  }
                                  rows={2}
                                  className="rivn-field rivn-textarea min-h-[70px] placeholder:text-white/30"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleSavePersonalLinkDetails(link)}
                                disabled={savingLinkDetailsId === link.id}
                                className="rivn-button rivn-button-primary px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingLinkDetailsId === link.id
                                  ? "Сохраняем..."
                                  : "Сохранить"}
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditingPersonalLink}
                                className="rivn-button px-3 py-2 text-xs"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-white/40">
                                {link.reward_percent}% •{" "}
                                {link.is_active ? "Активна" : "Неактивна"}
                              </div>

                              <div className="mt-2 text-sm font-medium text-white">
                                {link.label || "Без названия"}
                              </div>

                              {link.comment ? (
                                <div className="mt-1 text-sm text-white/50">
                                  {link.comment}
                                </div>
                              ) : null}

                              <div className="mt-2 break-all text-sm text-white/80">
                                {buildReferralUrl(link.code)}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(link.code)}
                                className="rivn-button px-3 py-2 text-xs"
                              >
                                Копировать
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditingPersonalLink(link)}
                                className="rivn-button px-3 py-2 text-xs"
                              >
                                Редактировать
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleLink(link)}
                                disabled={togglingLinkId === link.id}
                                className="rivn-button px-3 py-2 text-xs disabled:opacity-60"
                              >
                                {togglingLinkId === link.id
                                  ? "Сохраняем..."
                                  : link.is_active
                                  ? "Отключить"
                                  : "Включить"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {isSuperAdmin ? (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-sm text-white/45">
                      Выплаты по конкретной ссылке
                    </div>
                    <div className="mt-1 text-sm text-white/65">
                      Выбери супер-ссылку и период, чтобы быстро увидеть, сколько
                      начислено партнёру.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRewardLinkId("all");
                      const date = new Date();
                      date.setDate(1);
                      setRewardPeriodFrom(formatDateInputValue(date));
                      setRewardPeriodTo(formatDateInputValue(new Date()));
                    }}
                    className="rivn-button w-fit px-3 py-2 text-xs"
                  >
                    Сбросить фильтр
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
                  <label className="space-y-2">
                    <div className="text-xs text-white/45">Ссылка</div>
                    <select
                      value={selectedRewardLinkId}
                      onChange={(event) =>
                        setSelectedRewardLinkId(event.target.value)
                      }
                      className="rivn-field h-[46px]"
                    >
                      <option value="all">Все ссылки</option>
                      {personalLinks.map((link) => (
                        <option key={link.id} value={link.id}>
                          {link.label || link.code} · {link.reward_percent}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <div className="text-xs text-white/45">С даты</div>
                    <RivnDatePicker
                      value={rewardPeriodFrom}
                      onChange={setRewardPeriodFrom}
                      placeholder="Начало периода"
                    />
                  </label>

                  <label className="space-y-2">
                    <div className="text-xs text-white/45">По дату</div>
                    <RivnDatePicker
                      value={rewardPeriodTo}
                      onChange={setRewardPeriodTo}
                      placeholder="Конец периода"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                    <div className="text-xs text-white/45">Оплат по фильтру</div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {filteredRewards.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                    <div className="text-xs text-white/45">Сумма оплат</div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {formatMoney(rewardPeriodStats.paymentAmount)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                    <div className="text-xs text-white/45">Начислено</div>
                    <div className="mt-2 text-lg font-semibold text-emerald-300">
                      {formatMoney(rewardPeriodStats.approvedAmount)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
                    <div className="text-xs text-white/45">Выплачено</div>
                    <div className="mt-2 text-lg font-semibold text-sky-300">
                      {formatMoney(rewardPeriodStats.paidAmount)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rivn-table-wrap mt-6">
              <table className="w-full text-left text-sm">
                <thead className="rivn-table-head">
                  <tr>
                    <th className="px-4 py-3 font-medium">Пользователь</th>
                    <th className="px-4 py-3 font-medium">Дата</th>
                    <th className="px-4 py-3 font-medium">Сумма оплаты</th>
                    <th className="px-4 py-3 font-medium">Процент</th>
                    <th className="px-4 py-3 font-medium">Начисление</th>
                    <th className="px-4 py-3 font-medium">Статус</th>
                    <th className="px-4 py-3 font-medium">Действие</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRewards.length > 0 ? (
                    filteredRewards.map((reward) => (
                      <tr
                        key={reward.id}
                        className="rivn-table-row bg-transparent"
                      >
                        <td className="px-4 py-3 text-white/80">
                          {reward.referred_user_email ||
                            "Неизвестный пользователь"}
                        </td>
                        <td className="px-4 py-3 text-white/60">
                          {formatDate(reward.created_at)}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {formatMoney(reward.payment_amount)}
                        </td>
                        <td className="px-4 py-3 text-white/80">
                          {reward.reward_percent}%
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {formatMoney(reward.reward_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${getRewardStatusClasses(
                              reward.status
                            )}`}
                          >
                            {getRewardStatusLabel(reward.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isSuperAdmin && reward.status === "approved" ? (
                            <button
                              type="button"
                              onClick={() => handleMarkRewardAsPaid(reward)}
                              disabled={payingRewardId === reward.id}
                              className="rivn-button px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {payingRewardId === reward.id
                                ? "Сохраняем..."
                                : "Отметить выплаченным"}
                            </button>
                          ) : (
                            <span className="text-xs text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-white/45"
                      >
                        Начислений пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}
