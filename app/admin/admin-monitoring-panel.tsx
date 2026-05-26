"use client";

import { useEffect, useMemo, useState } from "react";

type MonitoringRow = {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string | null;
  registeredAt: string | null;
  lastSeenAt: string | null;
  planCode: string | null;
  billingStatus: string | null;
  trialDaysLeft: number | null;
  clientsCount: number;
  projectsCount: number;
  avitoAccountsCount: number;
  avitoCrmAccountsCount: number;
  dealsCount: number;
  reportErrorsCount: number;
  stuckReason: string;
  segments: string[];
};

type MonitoringPayload = {
  ok: true;
  totals: {
    registeredUsers: number;
    workspaces: number;
    createdClient: number;
    connectedAvito: number;
    activeTariffs: number;
    stuck: number;
    inactive: number;
  };
  segments: Array<{ key: string; label: string; count: number }>;
  rows: MonitoringRow[];
  warnings: string[];
};

const segmentLabels: Record<string, string> = {
  trial_active: "Trial активен",
  trial_ending: "Trial скоро закончится",
  active_plan: "Активный тариф",
  no_avito: "Без Avito",
  crm_no_deals: "CRM без сделок",
  report_errors: "Ошибки отчётов",
  no_clients: "Без клиентов",
  inactive_14d: "Давно не заходил",
};

function formatDate(value: string | null) {
  if (!value) return "нет данных";
  return new Date(value).toLocaleDateString("ru-RU");
}

function getStatusClass(status: string | null) {
  if (status === "active") return "bg-emerald-400/15 text-emerald-200";
  if (status === "trial") return "bg-violet-400/15 text-violet-200";
  if (status === "past_due") return "bg-amber-400/15 text-amber-200";
  if (status === "expired" || status === "canceled") return "bg-rose-400/15 text-rose-200";
  return "bg-white/10 text-white/60";
}

function getStatusLabel(status: string | null) {
  if (status === "active") return "активен";
  if (status === "trial") return "trial";
  if (status === "past_due") return "ждёт продления";
  if (status === "expired") return "истёк";
  if (status === "canceled") return "отменён";
  return "нет статуса";
}

export function AdminMonitoringPanel() {
  const [data, setData] = useState<MonitoringPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [isCollapsed, setIsCollapsed] = useState(false);

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("/api/admin/monitoring", {
        cache: "no-store",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось загрузить мониторинг пользователей");
      }

      setData(payload as MonitoringPayload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить мониторинг пользователей"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const visibleRows = useMemo(() => {
    const rows = data?.rows ?? [];
    if (selectedSegment === "all") return rows.slice(0, 12);
    return rows.filter((row) => row.segments.includes(selectedSegment)).slice(0, 20);
  }, [data?.rows, selectedSegment]);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121826] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-white">
            Мониторинг пользователей
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Здесь видно, кто зарегистрировался, кто дошёл до клиентов, Avito,
            CRM и тарифа. Это помогает быстро понять, кому нужна помощь, а кого
            уже можно вести к оплате.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
          >
            {isCollapsed ? "Развернуть" : "Свернуть"}
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {isLoading ? "Обновляем..." : "Обновить"}
          </button>
        </div>
      </div>

      {isCollapsed ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white/60">
          Блок скрыт. Пользователей: {data?.totals.registeredUsers ?? 0}, кабинетов:{" "}
          {data?.totals.workspaces ?? 0}, застряли: {data?.totals.stuck ?? 0}.
        </div>
      ) : (
        <>
          {error ? (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {[
          ["Пользователей", data?.totals.registeredUsers ?? 0],
          ["Кабинетов", data?.totals.workspaces ?? 0],
          ["Создали клиента", data?.totals.createdClient ?? 0],
          ["Подключили Avito", data?.totals.connectedAvito ?? 0],
          ["Активный тариф", data?.totals.activeTariffs ?? 0],
          ["Застряли", data?.totals.stuck ?? 0],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-4"
          >
            <div className="text-xs text-white/45">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedSegment("all")}
          className={`rounded-full px-3 py-2 text-sm transition ${
            selectedSegment === "all"
              ? "bg-white text-[#0B0F1A]"
              : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
          }`}
        >
          Все
        </button>
        {(data?.segments ?? []).map((segment) => (
          <button
            key={segment.key}
            type="button"
            onClick={() => setSelectedSegment(segment.key)}
            className={`rounded-full px-3 py-2 text-sm transition ${
              selectedSegment === segment.key
                ? "bg-white text-[#0B0F1A]"
                : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
            }`}
          >
            {segment.label}: {segment.count}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.08em] text-white/45">
            <tr>
              <th className="px-4 py-3">Кабинет</th>
              <th className="px-4 py-3">Владелец</th>
              <th className="px-4 py-3">Воронка</th>
              <th className="px-4 py-3">Тариф</th>
              <th className="px-4 py-3">Сегменты</th>
              <th className="px-4 py-3">Что делать</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <tr key={row.workspaceId} className="text-white/75">
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{row.workspaceName}</div>
                    <div className="mt-1 text-xs text-white/40">
                      Регистрация: {formatDate(row.registeredAt)}
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      Был в системе: {formatDate(row.lastSeenAt)}
                    </div>
                  </td>
                  <td className="px-4 py-4">{row.ownerEmail || "нет email"}</td>
                  <td className="px-4 py-4">
                    <div>Клиенты: {row.clientsCount}</div>
                    <div>Проекты: {row.projectsCount}</div>
                    <div>Avito: {row.avitoAccountsCount}</div>
                    <div>Сделки: {row.dealsCount}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${getStatusClass(
                        row.billingStatus
                      )}`}
                    >
                      {getStatusLabel(row.billingStatus)}
                    </span>
                    <div className="mt-2 text-xs text-white/45">
                      {row.planCode || "без тарифа"}
                      {row.trialDaysLeft !== null
                        ? ` · trial ${row.trialDaysLeft} дн.`
                        : ""}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-[260px] flex-wrap gap-1.5">
                      {row.segments.map((segment) => (
                        <span
                          key={segment}
                          className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-white/60"
                        >
                          {segmentLabels[segment] ?? segment}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {row.stuckReason ? (
                      <span className="text-amber-200">{row.stuckReason}</span>
                    ) : row.reportErrorsCount > 0 ? (
                      <span className="text-rose-200">Проверить отчёты</span>
                    ) : (
                      <span className="text-emerald-200">Всё ок</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-white/45" colSpan={6}>
                  Данных по выбранному сегменту пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.warnings?.length ? (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-100">
          Часть данных не удалось прочитать: {data.warnings.join("; ")}
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
