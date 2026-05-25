"use client";

import { useEffect, useMemo, useState } from "react";

type RewardStatus = "all" | "pending" | "approved" | "paid" | "canceled";

type ReferralSummaryPayload = {
  ok: true;
  period: { from: string; to: string };
  links: Array<{
    id: string;
    code: string;
    label: string | null;
    comment: string | null;
    rewardPercent: number;
    isActive: boolean;
  }>;
  totals: {
    rewardsCount: number;
    paymentAmount: number;
    rewardAmount: number;
    paidAmount: number;
    unpaidAmount: number;
  };
  summaryByLink: Array<{
    referralLinkId: string | null;
    partner: string;
    source: string;
    rewardsCount: number;
    paymentAmount: number;
    rewardAmount: number;
    paidAmount: number;
    unpaidAmount: number;
  }>;
  rewards: Array<{
    id: string;
    referralLinkId: string | null;
    linkCode: string;
    partner: string;
    source: string;
    referredUserEmail: string | null;
    paymentAmount: number;
    rewardPercent: number;
    rewardAmount: number;
    status: "pending" | "approved" | "paid" | "canceled";
    createdAt: string;
  }>;
};

const statusLabels: Record<RewardStatus | "pending" | "approved" | "paid" | "canceled", string> = {
  all: "Все",
  pending: "Ожидает",
  approved: "К выплате",
  paid: "Оплачено",
  canceled: "Отменено",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getDefaultFrom() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function toCsvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function AdminReferralPayoutPanel() {
  const [data, setData] = useState<ReferralSummaryPayload | null>(null);
  const [fromDate, setFromDate] = useState(getDefaultFrom);
  const [toDate, setToDate] = useState(getToday);
  const [status, setStatus] = useState<RewardStatus>("all");
  const [linkId, setLinkId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingRewardId, setUpdatingRewardId] = useState("");

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        status,
        linkId,
      });
      const response = await fetch(`/api/admin/referrals/summary?${params}`, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось загрузить реферальные выплаты");
      }

      setData(payload as ReferralSummaryPayload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить реферальные выплаты"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const csvContent = useMemo(() => {
    const rows = data?.rewards ?? [];
    const header = [
      "Дата",
      "Партнёр",
      "Источник",
      "Код ссылки",
      "Клиент",
      "Оплата",
      "Процент",
      "К выплате",
      "Статус",
    ];

    return [
      header.map(toCsvValue).join(","),
      ...rows.map((row) =>
        [
          new Date(row.createdAt).toLocaleDateString("ru-RU"),
          row.partner,
          row.source,
          row.linkCode,
          row.referredUserEmail ?? "",
          row.paymentAmount,
          `${row.rewardPercent}%`,
          row.rewardAmount,
          statusLabels[row.status],
        ]
          .map(toCsvValue)
          .join(",")
      ),
    ].join("\n");
  }, [data?.rewards]);

  function downloadCsv() {
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rivn-referrals-${fromDate}-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function updateRewardStatus(rewardId: string, nextStatus: "paid" | "approved") {
    try {
      setUpdatingRewardId(rewardId);
      const response = await fetch("/api/admin/referrals/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rewardId, status: nextStatus }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось обновить статус выплаты");
      }

      await loadData();
    } catch (updateError) {
      alert(
        updateError instanceof Error
          ? updateError.message
          : "Не удалось обновить статус выплаты"
      );
    } finally {
      setUpdatingRewardId("");
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121826] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-white">
            Реферальные выплаты
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Смотри начисления по партнёрам, источникам и конкретным супер-ссылкам.
            Здесь же можно отметить выплату как оплаченную и выгрузить CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={downloadCsv}
          disabled={!data?.rewards?.length}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          Экспорт CSV
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.5fr_auto]">
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="h-[44px] rounded-xl border border-white/10 bg-[#0F1524] px-3 text-white outline-none"
        />
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="h-[44px] rounded-xl border border-white/10 bg-[#0F1524] px-3 text-white outline-none"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as RewardStatus)}
          className="h-[44px] rounded-xl border border-white/10 bg-[#0F1524] px-3 text-white outline-none"
        >
          {(["all", "approved", "paid", "pending", "canceled"] as RewardStatus[]).map(
            (item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            )
          )}
        </select>
        <select
          value={linkId}
          onChange={(event) => setLinkId(event.target.value)}
          className="h-[44px] rounded-xl border border-white/10 bg-[#0F1524] px-3 text-white outline-none"
        >
          <option value="all">Все ссылки</option>
          {(data?.links ?? []).map((link) => (
            <option key={link.id} value={link.id}>
              {link.label || link.code} · {link.rewardPercent}%
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={isLoading}
          className="h-[44px] rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#06120f] transition hover:bg-emerald-300 disabled:opacity-50"
        >
          {isLoading ? "Загрузка..." : "Показать"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Начислений", data?.totals.rewardsCount ?? 0],
          ["Оплат клиентов", formatMoney(data?.totals.paymentAmount ?? 0)],
          ["К выплате всего", formatMoney(data?.totals.unpaidAmount ?? 0)],
          ["Уже оплачено", formatMoney(data?.totals.paidAmount ?? 0)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-4"
          >
            <div className="text-xs text-white/45">{label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {(data?.summaryByLink ?? []).slice(0, 6).map((item) => (
          <div
            key={item.referralLinkId ?? item.partner}
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-medium text-white">{item.partner}</div>
                <div className="mt-1 text-xs text-white/45">{item.source}</div>
              </div>
              <div className="text-sm font-semibold text-emerald-200">
                {formatMoney(item.unpaidAmount)}
              </div>
            </div>
            <div className="mt-3 text-xs text-white/50">
              Начислений: {item.rewardsCount} · Клиентских оплат:{" "}
              {formatMoney(item.paymentAmount)} · Оплачено: {formatMoney(item.paidAmount)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.08em] text-white/45">
            <tr>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Партнёр / источник</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Оплата</th>
              <th className="px-4 py-3">К выплате</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {(data?.rewards ?? []).length > 0 ? (
              data!.rewards.slice(0, 20).map((reward) => (
                <tr key={reward.id} className="text-white/75">
                  <td className="px-4 py-4">
                    {new Date(reward.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{reward.partner}</div>
                    <div className="mt-1 text-xs text-white/45">{reward.source}</div>
                    <div className="mt-1 text-xs text-white/35">Код: {reward.linkCode}</div>
                  </td>
                  <td className="px-4 py-4">{reward.referredUserEmail || "нет email"}</td>
                  <td className="px-4 py-4">{formatMoney(reward.paymentAmount)}</td>
                  <td className="px-4 py-4">
                    {formatMoney(reward.rewardAmount)} · {reward.rewardPercent}%
                  </td>
                  <td className="px-4 py-4">{statusLabels[reward.status]}</td>
                  <td className="px-4 py-4">
                    {reward.status === "paid" ? (
                      <button
                        type="button"
                        onClick={() => void updateRewardStatus(reward.id, "approved")}
                        disabled={updatingRewardId === reward.id}
                        className="rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.09]"
                      >
                        Вернуть к выплате
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void updateRewardStatus(reward.id, "paid")}
                        disabled={updatingRewardId === reward.id}
                        className="rounded-xl bg-emerald-400/15 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-400/20"
                      >
                        Оплачено
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-white/45" colSpan={7}>
                  За выбранный период начислений пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
