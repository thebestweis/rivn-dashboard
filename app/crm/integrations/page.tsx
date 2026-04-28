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
  Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { canAccessCrm, isAppRole } from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";

type IntegrationCard = {
  name: string;
  status: string;
  description: string;
  href?: string;
  color: string;
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
      "Форма Tilda может отправлять заявку прямо в CRM. Сделка попадет в первую колонку продаж и пройдет через правила распределения.",
    color:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100",
  },
  {
    name: "Яндекс Директ",
    status: "Готово к подключению",
    description:
      "Можно принимать рекламные заявки через webhook или автоматически забирать лиды из Direct Leads API по расписанию.",
    color:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
  },
  {
    name: "Telegram",
    status: "Готово к подключению",
    description:
      "Отдельный CRM webhook принимает сообщения Telegram и создает сделку с диалогом, не трогая текущий бот Avito-отчетов.",
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

export default function CrmIntegrationsPage() {
  const { role, isReady, workspace } = useAppContextState();
  const [copied, setCopied] = useState<string | null>(null);
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

  async function copyValue(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
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
              Здесь подключаются каналы, из которых в CRM приходят заявки и
              диалоги. Менеджер работает в одном окне, а источник заявки
              сохраняется автоматически.
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <Route className="h-4 w-4" />
              Команда
            </Link>
          </div>
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
              Скопируй ссылку, замени `CRM_WEBHOOK_SECRET` на секрет из env и
              вставь ее в настройках формы Tilda. После отправки формы заявка
              появится в CRM как новая сделка.
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
              Это отдельная ссылка для CRM. Ее можно использовать для отдельного
              Telegram-бота продаж или тестового подключения. Текущий бот
              Avito-отчетов эта настройка не меняет.
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
              Есть два сценария: внешний webhook для форм и коннекторов, а
              также автоматический сбор лидов из Direct Leads API каждые 15
              минут. Второй сценарий надежнее, если заявки собираются на
              турбо-страницах Яндекса.
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

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Webhook для заявок
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Подходит для Tilda, квизов, Roistat, Albato, Make и любых форм,
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
            <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-100/80">
              RIVN OS сам опрашивает Директ, забирает новые заявки, проверяет
              дубли и создает сделки. Для подключения нужно добавить токен и ID
              турбо-страниц в таблицу настроек.
            </p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3 font-mono text-xs leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-black/10 dark:text-amber-100">
              {yandexDirectSyncUrl}
            </div>
            <button
              type="button"
              onClick={() => void copyValue(yandexDirectSyncUrl, "yandex-sync")}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-400"
            >
              <Copy className="h-4 w-4" />
              {copied === "yandex-sync" ? "Скопировано" : "Скопировать sync URL"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
