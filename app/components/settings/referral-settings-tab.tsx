"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppContextState } from "../../providers/app-context-provider";
import { AppToast } from "../ui/app-toast";
import { BillingAccessBanner } from "../ui/billing-access-banner";
import {
    createPersonalReferralLink,
  ensureMyStandardReferralLink,
  getMyReferralLinks,
  getMyReferralRewards,
  getMyReferralStats,
  markReferralRewardAsPaid,
  setReferralLinkActiveState,
  type ReferralLinkItem,
  type ReferralRewardItem,
  type ReferralStats,
} from "../../lib/supabase/referrals";
import { getBillingErrorMessage } from "../../lib/billing-errors";

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

function buildReferralUrl(code: string) {
  if (typeof window === "undefined") {
    return `/register?ref=${code}`;
  }

  return `${window.location.origin}/register?ref=${code}`;
}

export function ReferralSettingsTab() {
  const {
    billingAccess,
    isLoading: isAppContextLoading,
    isSuperAdmin,
  } = useAppContextState();

  const [isLoading, setIsLoading] = useState(true);
  const [links, setLinks] = useState<ReferralLinkItem[]>([]);
  const [rewards, setRewards] = useState<ReferralRewardItem[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);

    const [creatingPersonalLink, setCreatingPersonalLink] = useState(false);
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);
  const [payingRewardId, setPayingRewardId] = useState<string | null>(null);
  const [personalLinkLabel, setPersonalLinkLabel] = useState("");

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;

  async function loadReferralData() {
    try {
      setIsLoading(true);

      await ensureMyStandardReferralLink();

      const [linksData, rewardsData, statsData] = await Promise.all([
        getMyReferralLinks(),
        getMyReferralRewards(),
        getMyReferralStats(),
      ]);

      setLinks(linksData);
      setRewards(rewardsData);
      setStats(statsData);
    } catch (error) {
      console.error("Ошибка загрузки реферальных данных:", error);
      setToastType("error");
      setToastMessage("Не удалось загрузить данные реферальной системы");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReferralData();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const standardLink = useMemo(() => {
    return links.find((item) => item.link_type === "standard_25") ?? null;
  }, [links]);

  const personalLinks = useMemo(() => {
    return links.filter((item) => item.link_type === "personal_50");
  }, [links]);

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
      });

      await loadReferralData();
      setPersonalLinkLabel("");
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

      await loadReferralData();
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
      await loadReferralData();

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
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <BillingAccessBanner
          isLoading={isAppContextLoading}
          isBillingReadOnly={isBillingReadOnly}
          canManage={true}
          readOnlyMessage="Подписка неактивна. Реферальный раздел доступен только в режиме просмотра, пока тариф не будет активирован."
          roleRestrictedMessage=""
          className="mb-5"
        />

        <div>
          <div className="text-sm text-white/50">Реферальная система</div>
          <h2 className="mt-1 text-xl font-semibold">Партнёрская программа</h2>
          <div className="mt-2 text-sm text-white/55">
            Приглашай новых пользователей в RIVN OS и получай 25% от всех их
            оплат.
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#7B61FF]/20 bg-[#7B61FF]/10 p-4">
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
            className="mt-4 inline-flex rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/85 transition hover:bg-white/[0.1] hover:text-white"
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
            <div className="mt-6 grid grid-cols-5 gap-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs text-white/45">Приглашено</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {stats?.totalReferrals ?? 0}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs text-white/45">Оборот оплат</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(stats?.totalRevenueFromReferrals ?? 0)}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs text-white/45">Начислено</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(stats?.totalApprovedRewards ?? 0)}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs text-white/45">Выплачено</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatMoney(stats?.totalPaidRewards ?? 0)}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
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

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
                  <div className="flex-1 rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white/80">
                    {buildReferralUrl(standardLink.code)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(standardLink.code)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
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
              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingPersonalLink
                        ? "Создаём..."
                        : "Создать 50% ссылку"}
                    </button>
                  </div>

                  <div className="max-w-[420px]">
                    <label className="mb-2 block text-sm text-white/55">
                      Название / пометка для ссылки
                    </label>
                    <input
                      type="text"
                      value={personalLinkLabel}
                      onChange={(e) => setPersonalLinkLabel(e.target.value)}
                      placeholder="Например: Иван / YouTube, Telegram канал, блогер №1"
                      className="h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none placeholder:text-white/30"
                    />
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
                        className="rounded-2xl border border-white/10 bg-[#0F1524] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-white/40">
                              {link.reward_percent}% •{" "}
                              {link.is_active ? "Активна" : "Неактивна"}
                            </div>

                            {link.label ? (
                              <div className="mt-2 text-sm font-medium text-white">
                                {link.label}
                              </div>
                            ) : null}

                            <div className="mt-2 break-all text-sm text-white/80">
                              {buildReferralUrl(link.code)}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(link.code)}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white"
                            >
                              Копировать
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleLink(link)}
                              disabled={togglingLinkId === link.id}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white disabled:opacity-60"
                            >
                              {togglingLinkId === link.id
                                ? "Сохраняем..."
                                : link.is_active
                                  ? "Отключить"
                                  : "Включить"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/8">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-white/45">
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
                  {rewards.length > 0 ? (
                    rewards.map((reward) => (
                                            <tr
                        key={reward.id}
                        className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
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
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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