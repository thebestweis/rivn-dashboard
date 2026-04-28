"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquareText,
  RefreshCcw,
  Route,
  Search,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { canAccessCrm, isAppRole } from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";

type IntegrationCard = {
  name: string;
  status: string;
  description: string;
  href?: string;
  color: string;
};

type TurboPage = {
  id: number;
  name: string;
  href: string;
};

type YandexStatus = {
  integration: {
    id: string;
    name: string;
    client_login: string | null;
    turbo_page_ids: Array<number | string> | null;
    is_active: boolean;
    last_synced_at: string | null;
    updated_at: string | null;
  } | null;
  importsCount: number;
  lastImportAt: string | null;
  lastLeadSubmittedAt: string | null;
};

const integrationCards: IntegrationCard[] = [
  {
    name: "Avito",
    status: "Работает",
    description:
      "Диалоги и заявки попадают в CRM, создают сделку и сохраняют ссылку на объявление.",
    href: "/avito-reports",
    color:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
  {
    name: "Tilda",
    status: "Готово к подключению",
    description:
      "Форма Tilda может отправлять заявку прямо в CRM. Сделка попадет в первую колонку продаж.",
    color:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100",
  },
  {
    name: "Яндекс Директ",
    status: "Готово к подключению",
    description:
      "Можно принимать рекламные заявки через webhook или автоматически забирать лиды из Direct Leads API.",
    color:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
  },
  {
    name: "Telegram",
    status: "Готово к подключению",
    description:
      "Отдельный CRM webhook принимает сообщения Telegram и создает сделку с диалогом.",
    color:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100",
  },
];

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL || "https://rivn-dashboard.vercel.app";
}

function parseTurboPageIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function formatDateTime(value?: string | null) {
  if (!value) return "ещё не было";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function CrmIntegrationsPage() {
  const { role, isReady, workspace } = useAppContextState();
  const [copied, setCopied] = useState<string | null>(null);
  const [oauthToken, setOauthToken] = useState("");
  const [clientLogin, setClientLogin] = useState("");
  const [manualTurboIds, setManualTurboIds] = useState("");
  const [turboPages, setTurboPages] = useState<TurboPage[]>([]);
  const [selectedTurboIds, setSelectedTurboIds] = useState<number[]>([]);
  const [yandexMessage, setYandexMessage] = useState("");
  const [yandexStatus, setYandexStatus] = useState<YandexStatus | null>(null);
  const [isFindingPages, setIsFindingPages] = useState(false);
  const [isSavingYandex, setIsSavingYandex] = useState(false);
  const [isCheckingYandex, setIsCheckingYandex] = useState(false);
  const [isLoadingYandexStatus, setIsLoadingYandexStatus] = useState(false);

  const currentRole = isAppRole(role) ? role : null;
  const hasAccess = currentRole ? canAccessCrm(currentRole) : false;
  const tildaWebhookUrl = useMemo(() => {
    const workspaceId = workspace?.id ?? "WORKSPACE_ID";
    return `${getBaseUrl()}/api/crm/tilda?workspaceId=${workspaceId}&secret=CRM_WEBHOOK_SECRET`;
  }, [workspace?.id]);
  const telegramWebhookUrl = useMemo(() => {
    const workspaceId = workspace?.id ?? "WORKSPACE_ID";
    return `${getBaseUrl()}/api/crm/telegram?workspaceId=${workspaceId}&secret=CRM_WEBHOOK_SECRET`;
  }, [workspace?.id]);
  const yandexDirectWebhookUrl = useMemo(() => {
    const workspaceId = workspace?.id ?? "WORKSPACE_ID";
    return `${getBaseUrl()}/api/crm/yandex-direct?workspaceId=${workspaceId}&secret=CRM_WEBHOOK_SECRET`;
  }, [workspace?.id]);
  const yandexDirectSyncUrl = useMemo(
    () => `${getBaseUrl()}/api/cron/yandex-direct-leads?secret=CRON_SECRET`,
    []
  );

  async function loadYandexStatus() {
    if (!workspace?.id) return;

    try {
      setIsLoadingYandexStatus(true);
      const response = await fetch(
        `/api/crm/yandex-direct/integrations?workspaceId=${workspace.id}`,
        { cache: "no-store" }
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось загрузить статус Яндекса");
      }

      setYandexStatus({
        integration: result.integration,
        importsCount: result.importsCount ?? 0,
        lastImportAt: result.lastImportAt ?? null,
        lastLeadSubmittedAt: result.lastLeadSubmittedAt ?? null,
      });
    } catch (error) {
      setYandexMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить статус Яндекс Директа"
      );
    } finally {
      setIsLoadingYandexStatus(false);
    }
  }

  useEffect(() => {
    if (isReady && hasAccess && workspace?.id) {
      void loadYandexStatus();
    }
  }, [hasAccess, isReady, workspace?.id]);

  async function copyValue(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  function toggleTurboPage(id: number) {
    setSelectedTurboIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function findTurboPages() {
    try {
      setYandexMessage("");
      setIsFindingPages(true);

      const response = await fetch("/api/crm/yandex-direct/turbo-pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          oauthToken,
          clientLogin,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось получить турбо-страницы");
      }

      setTurboPages(result.turboPages ?? []);
      setSelectedTurboIds(
        (result.turboPages ?? []).map((page: TurboPage) => page.id)
      );
      setYandexMessage(
        (result.turboPages ?? []).length > 0
          ? "Турбо-страницы найдены. Выбери нужные и нажми “Сохранить подключение”."
          : "Яндекс не вернул опубликованные турбо-страницы. Можно указать ID вручную."
      );
    } catch (error) {
      setYandexMessage(
        error instanceof Error
          ? error.message
          : "Ошибка получения турбо-страниц"
      );
    } finally {
      setIsFindingPages(false);
    }
  }

  async function checkYandexIntegration() {
    try {
      setYandexMessage("");
      setIsCheckingYandex(true);

      const response = await fetch("/api/crm/yandex-direct/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось проверить подключение");
      }

      setYandexMessage(
        `Подключение работает. Проверено страниц: ${
          result.turboPageIds?.length ?? 0
        }.`
      );
    } catch (error) {
      setYandexMessage(
        error instanceof Error
          ? error.message
          : "Ошибка проверки подключения Яндекс Директа"
      );
    } finally {
      setIsCheckingYandex(false);
    }
  }

  async function saveYandexIntegration() {
    try {
      setYandexMessage("");
      setIsSavingYandex(true);

      const manualIds = parseTurboPageIds(manualTurboIds);
      const turboPageIds =
        selectedTurboIds.length > 0 ? selectedTurboIds : manualIds;

      const response = await fetch("/api/crm/yandex-direct/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          name: "Яндекс Директ",
          oauthToken,
          clientLogin,
          turboPageIds,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось сохранить интеграцию");
      }

      setYandexMessage(
        "Яндекс Директ подключен. Новые заявки будут попадать в CRM после запуска синхронизации."
      );
      await loadYandexStatus();
    } catch (error) {
      setYandexMessage(
        error instanceof Error
          ? error.message
          : "Ошибка сохранения интеграции"
      );
    } finally {
      setIsSavingYandex(false);
    }
  }

  if (!isReady) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Загружаем интеграции CRM...
          </p>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            CRM
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Нет доступа к интеграциям CRM
          </h1>
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
              Интеграции CRM
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Подключай каналы заявок без SQL. RIVN OS сам подставит текущий
              кабинет, сохранит настройки и будет создавать сделки в CRM.
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
              href="/crm/team"
              className="hidden"
            >
              <Route className="h-4 w-4" />
              Команда
            </Link>
          </div>
        </div>

        <div className="mt-6 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
          <Link
            href="/crm/settings"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
          >
            Распределение
          </Link>
          <Link
            href="/crm?settings=pipelines"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
          >
            Воронки
          </Link>
          <Link
            href="/crm?settings=stages"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
          >
            Этапы
          </Link>
          <Link
            href="/crm/integrations"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-600/20"
          >
            <Settings2 className="h-4 w-4" />
            Интеграции
          </Link>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {integrationCards.map((integration) => (
          <div
            key={integration.name}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200">
                  <MessageSquareText className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold">{integration.name}</h2>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${integration.color}`}
                  >
                    {integration.status}
                  </span>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {integration.description}
            </p>
            {integration.href ? (
              <Link
                href={integration.href}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Открыть подключение
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
              Tilda
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Webhook для заявок с сайта
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Вставь эту ссылку в настройки формы Tilda. После отправки формы
              заявка появится в CRM как новая сделка.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyValue(tildaWebhookUrl, "tilda")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            <Copy className="h-4 w-4" />
            {copied === "tilda" ? "Скопировано" : "Скопировать webhook"}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-slate-200">
          {tildaWebhookUrl}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
              Telegram
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Webhook для CRM-диалогов
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Это отдельная ссылка для CRM. Текущий бот Avito-отчетов эта
              настройка не меняет.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyValue(telegramWebhookUrl, "telegram")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            <Copy className="h-4 w-4" />
            {copied === "telegram" ? "Скопировано" : "Скопировать webhook"}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-slate-200">
          {telegramWebhookUrl}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
              Яндекс Директ
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Заявки из рекламы в CRM
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Введи OAuth-токен Яндекса, найди турбо-страницы автоматически и
              сохрани подключение. Workspace ID система подставляет сама.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyValue(yandexDirectWebhookUrl, "yandex")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-400"
          >
            <Copy className="h-4 w-4" />
            {copied === "yandex" ? "Скопировано" : "Скопировать webhook"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Webhook для внешних форм
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Подходит для квизов, Tilda, Roistat, Albato, Make и любых форм,
              которые умеют отправлять заявку по ссылке.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
              {yandexDirectWebhookUrl}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
              <RefreshCcw className="h-4 w-4" />
              Автосбор через Direct Leads API
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl border border-amber-200 bg-white/70 p-4 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-black/10 dark:text-amber-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {yandexStatus?.integration
                      ? "Интеграция сохранена"
                      : "Интеграция ещё не сохранена"}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-70">
                    {isLoadingYandexStatus
                      ? "Проверяем статус..."
                      : yandexStatus?.integration
                        ? `Страниц: ${
                            yandexStatus.integration.turbo_page_ids?.length ?? 0
                          } · заявок импортировано: ${yandexStatus.importsCount}`
                        : "Сохрани подключение, чтобы RIVN OS начал забирать заявки."}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-70">
                    Последняя синхронизация:{" "}
                    {formatDateTime(yandexStatus?.integration?.last_synced_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={checkYandexIntegration}
                  disabled={isCheckingYandex || !yandexStatus?.integration}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-900 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/20 dark:bg-white/10 dark:text-amber-100 dark:hover:bg-white/15"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isCheckingYandex ? "Проверяем..." : "Проверить подключение"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-100/70">
                OAuth-токен Яндекса
                <input
                  value={oauthToken}
                  onChange={(event) => setOauthToken(event.target.value)}
                  type="password"
                  placeholder="Вставь OAuth-токен"
                  className="mt-2 h-11 w-full rounded-xl border border-amber-200 bg-white px-4 text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-amber-400 dark:border-amber-500/20 dark:bg-black/10 dark:text-white"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-100/70">
                Client-Login, если аккаунт агентский
                <input
                  value={clientLogin}
                  onChange={(event) => setClientLogin(event.target.value)}
                  placeholder="Можно оставить пустым"
                  className="mt-2 h-11 w-full rounded-xl border border-amber-200 bg-white px-4 text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-amber-400 dark:border-amber-500/20 dark:bg-black/10 dark:text-white"
                />
              </label>
              <button
                type="button"
                onClick={findTurboPages}
                disabled={isFindingPages || !oauthToken.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {isFindingPages ? "Ищем..." : "Найти турбо-страницы"}
              </button>
            </div>

            {turboPages.length > 0 ? (
              <div className="mt-4 space-y-2">
                {turboPages.map((page) => (
                  <label
                    key={page.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-black/10 dark:text-amber-100"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTurboIds.includes(page.id)}
                      onChange={() => toggleTurboPage(page.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold">{page.name}</span>
                      <span className="block text-xs opacity-70">
                        ID: {page.id}
                        {page.href ? ` · ${page.href}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-100/70">
                ID турбо-страниц вручную
                <input
                  value={manualTurboIds}
                  onChange={(event) => setManualTurboIds(event.target.value)}
                  placeholder="Например: 123456789, 987654321"
                  className="mt-2 h-11 w-full rounded-xl border border-amber-200 bg-white px-4 text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-amber-400 dark:border-amber-500/20 dark:bg-black/10 dark:text-white"
                />
              </label>
            )}

            <button
              type="button"
              onClick={saveYandexIntegration}
              disabled={
                isSavingYandex ||
                !oauthToken.trim() ||
                (selectedTurboIds.length === 0 && !manualTurboIds.trim())
              }
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              {isSavingYandex ? "Сохраняем..." : "Сохранить подключение"}
            </button>

            <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 font-mono text-xs leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-black/10 dark:text-amber-100">
              {yandexDirectSyncUrl}
            </div>

            {yandexMessage ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-black/10 dark:text-amber-100">
                {yandexMessage}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
