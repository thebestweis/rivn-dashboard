"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  PlayCircle,
  RefreshCcw,
  Route,
  Settings2,
  ShieldCheck,
  Webhook,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { canAccessCrm, isAppRole } from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";

type IntegrationSourceKind = "avito" | "tilda" | "telegram" | "yandex_direct";
const PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://rivnos.ru";

type IntegrationCard = {
  name: string;
  title: string;
  description: string;
  sourceKind: IntegrationSourceKind;
  accentClassName: string;
  href?: string;
  setupLabel: string;
  setupDescription: string;
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

type AvitoProject = {
  id: string;
  name: string;
};

type AvitoAccount = {
  id: string;
  name: string;
  avito_user_id: string | number | null;
  avito_client_id: string | null;
  crm_dialogs_enabled: boolean | null;
  is_active: boolean | null;
};

type AvitoIntegration = {
  id: string;
  name: string | null;
  project_id: string | null;
  is_active: boolean | null;
  avito_report_accounts?: AvitoAccount[] | null;
};

const integrationCards: IntegrationCard[] = [
  {
    name: "Avito",
    title: "Авито",
    sourceKind: "avito",
    accentClassName: "from-[#00f5a8] to-[#65d6ff]",
    description:
      "Диалоги и заявки попадают в CRM, создают сделку и сохраняют связь с клиентом.",
    setupLabel: "Подключение Avito к CRM",
    setupDescription:
      "Добавь данные Avito API, проверь доступ и включи диалоги для сделок в CRM.",
  },
  {
    name: "Tilda",
    title: "Tilda",
    sourceKind: "tilda",
    accentClassName: "from-[#8f7bff] to-[#00f5a8]",
    description:
      "Формы сайта могут отправлять заявки прямо в CRM без ручного копирования.",
    setupLabel: "Webhook для формы",
    setupDescription:
      "Скопируй ссылку и вставь ее в настройках формы Tilda в блоке Webhook.",
  },
  {
    name: "Яндекс Директ",
    title: "Яндекс Директ",
    sourceKind: "yandex_direct",
    accentClassName: "from-[#ffb45c] to-[#8f7bff]",
    description:
      "Заявки можно принимать через webhook или забирать из Direct Leads API.",
    setupLabel: "Webhook и Direct Leads API",
    setupDescription:
      "Для простого сценария достаточно webhook. Для автосбора из Яндекса открой расширенные настройки ниже.",
  },
  {
    name: "Telegram",
    title: "Telegram",
    sourceKind: "telegram",
    accentClassName: "from-[#65d6ff] to-[#8f7bff]",
    description:
      "Сообщения из Telegram можно превращать в сделки и вести их в общей CRM.",
    setupLabel: "Webhook для Telegram",
    setupDescription:
      "Подходит для связок через Make, Albato или собственного Telegram-бота.",
  },
];

function parseTurboPageIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function formatDateTime(value?: string | null) {
  if (!value) return "еще не было";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readApiJson(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text().catch(() => "");

  return {
    ok: false,
    error: text.trim().startsWith("<")
      ? "Сервер вернул HTML вместо JSON. Обнови страницу и попробуй снова."
      : text || `Сервер вернул ответ ${response.status}`,
  };
}

function getBrandLogo(sourceKind: IntegrationSourceKind) {
  if (sourceKind === "avito") return "A";
  if (sourceKind === "tilda") return "T";
  if (sourceKind === "yandex_direct") return "Я";
  return "Tg";
}

export default function CrmIntegrationsPage() {
  const { role, isReady, workspace } = useAppContextState();
  const [selectedSourceKind, setSelectedSourceKind] =
    useState<IntegrationSourceKind>("avito");
  const [copied, setCopied] = useState<string | null>(null);
  const [oauthToken, setOauthToken] = useState("");
  const [clientLogin, setClientLogin] = useState("");
  const [manualTurboIds, setManualTurboIds] = useState("");
  const [turboPages, setTurboPages] = useState<TurboPage[]>([]);
  const [selectedTurboIds, setSelectedTurboIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [yandexStatus, setYandexStatus] = useState<YandexStatus | null>(null);
  const [isFindingPages, setIsFindingPages] = useState(false);
  const [isSavingYandex, setIsSavingYandex] = useState(false);
  const [isCheckingYandex, setIsCheckingYandex] = useState(false);
  const [isLoadingYandexStatus, setIsLoadingYandexStatus] = useState(false);
  const [isRunningYandexSync, setIsRunningYandexSync] = useState(false);
  const [isAvitoConnected, setIsAvitoConnected] = useState(false);
  const [avitoProjects, setAvitoProjects] = useState<AvitoProject[]>([]);
  const [avitoIntegrations, setAvitoIntegrations] = useState<
    AvitoIntegration[]
  >([]);
  const [avitoForm, setAvitoForm] = useState({
    projectId: "",
    accountName: "",
    avitoUserId: "",
    avitoClientId: "",
    avitoClientSecret: "",
  });
  const [isCheckingAvito, setIsCheckingAvito] = useState(false);
  const [isSavingAvito, setIsSavingAvito] = useState(false);
  const [avitoAccountAction, setAvitoAccountAction] = useState("");
  const [testingIntegration, setTestingIntegration] = useState("");
  const [leadIngestionSettings, setLeadIngestionSettings] = useState<
    Record<IntegrationSourceKind, boolean>
  >({
    avito: true,
    tilda: true,
    telegram: true,
    yandex_direct: true,
  });
  const [updatingLeadIngestion, setUpdatingLeadIngestion] = useState("");

  const currentRole = isAppRole(role) ? role : null;
  const hasAccess = currentRole ? canAccessCrm(currentRole) : false;
  const selectedIntegration =
    integrationCards.find((item) => item.sourceKind === selectedSourceKind) ??
    integrationCards[0];

  const tildaWebhookUrl = useMemo(() => {
    const workspaceId = workspace?.id ?? "WORKSPACE_ID";
    return `${PUBLIC_APP_URL}/api/crm/tilda?workspaceId=${workspaceId}&secret=CRM_WEBHOOK_SECRET`;
  }, [workspace?.id]);

  const telegramWebhookUrl = useMemo(() => {
    const workspaceId = workspace?.id ?? "WORKSPACE_ID";
    return `${PUBLIC_APP_URL}/api/crm/telegram?workspaceId=${workspaceId}&secret=CRM_WEBHOOK_SECRET`;
  }, [workspace?.id]);

  const yandexDirectWebhookUrl = useMemo(() => {
    const workspaceId = workspace?.id ?? "WORKSPACE_ID";
    return `${PUBLIC_APP_URL}/api/crm/yandex-direct?workspaceId=${workspaceId}&secret=CRM_WEBHOOK_SECRET`;
  }, [workspace?.id]);

  const yandexDirectSyncUrl = useMemo(
    () => `${PUBLIC_APP_URL}/api/cron/yandex-direct-leads?secret=CRON_SECRET`,
    []
  );

  const selectedWebhookUrl =
    selectedSourceKind === "tilda"
      ? tildaWebhookUrl
      : selectedSourceKind === "telegram"
        ? telegramWebhookUrl
        : selectedSourceKind === "yandex_direct"
          ? yandexDirectWebhookUrl
          : "";

  const connectedSources = integrationCards.filter((integration) =>
    isIntegrationConnected(integration)
  ).length;

  const avitoAccounts = useMemo(
    () =>
      avitoIntegrations.flatMap(
        (integration) => integration.avito_report_accounts ?? []
      ),
    [avitoIntegrations]
  );

  useEffect(() => {
    if (isReady && hasAccess && workspace?.id) {
      void loadYandexStatus();
      void loadIntegrationSettings();
      void loadAvitoStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isReady, workspace?.id]);

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
      setMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить статус Яндекс Директа"
      );
    } finally {
      setIsLoadingYandexStatus(false);
    }
  }

  async function loadAvitoStatus() {
    if (!workspace?.id) return;

    try {
      const response = await fetch(
        `/api/avito/integrations?workspaceId=${workspace.id}`,
        { cache: "no-store" }
      );
      const result = await readApiJson(response);

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось загрузить Avito");
      }

      const projects = (result.projects ?? []) as AvitoProject[];
      const integrations = (result.integrations ?? []) as AvitoIntegration[];

      setAvitoProjects(projects);
      setAvitoIntegrations(integrations);
      setIsAvitoConnected(integrations.length > 0);
      setAvitoForm((current) =>
        current.projectId || !projects[0]?.id
          ? current
          : { ...current, projectId: projects[0].id }
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить подключение Avito"
      );
    }
  }

  async function loadIntegrationSettings() {
    if (!workspace?.id) return;

    const response = await fetch(
      `/api/crm/integration-settings?workspaceId=${workspace.id}`,
      { cache: "no-store" }
    );
    const result = await response.json();

    if (response.ok && result.ok) {
      setLeadIngestionSettings((current) => ({
        ...current,
        ...(result.settings ?? {}),
      }));
    }
  }

  async function toggleLeadIngestion(sourceKind: IntegrationSourceKind) {
    if (!workspace?.id) return;

    const nextValue = !leadIngestionSettings[sourceKind];

    try {
      setUpdatingLeadIngestion(sourceKind);
      const response = await fetch("/api/crm/integration-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          sourceKind,
          isLeadIngestionEnabled: nextValue,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось обновить настройку");
      }

      setLeadIngestionSettings((current) => ({
        ...current,
        [sourceKind]: nextValue,
      }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обновить настройку интеграции"
      );
    } finally {
      setUpdatingLeadIngestion("");
    }
  }

  function updateAvitoForm(
    field: keyof typeof avitoForm,
    value: string
  ) {
    setAvitoForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function checkAvitoConnection() {
    if (!workspace?.id) return;

    try {
      setMessage("");
      setIsCheckingAvito(true);

      const response = await fetch("/api/avito/check-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          avitoUserId: avitoForm.avitoUserId,
          avitoClientId: avitoForm.avitoClientId,
          avitoClientSecret: avitoForm.avitoClientSecret,
        }),
      });
      const result = await readApiJson(response);

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Avito не принял данные подключения");
      }

      setMessage("Avito подключение проверено. Можно сохранять интеграцию.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Не удалось проверить Avito подключение"
      );
    } finally {
      setIsCheckingAvito(false);
    }
  }

  async function saveAvitoIntegration() {
    if (!workspace?.id) return;

    try {
      setMessage("");
      setIsSavingAvito(true);

      const response = await fetch("/api/avito/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          projectId: avitoForm.projectId,
          dailyEnabled: false,
          weeklyEnabled: false,
          isActive: true,
          accounts: [
            {
              accountName: avitoForm.accountName || "Avito аккаунт",
              avitoUserId: avitoForm.avitoUserId,
              avitoClientId: avitoForm.avitoClientId,
              avitoClientSecret: avitoForm.avitoClientSecret,
              crmDialogsEnabled: true,
              isActive: true,
            },
          ],
        }),
      });
      const result = await readApiJson(response);

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось сохранить Avito");
      }

      setAvitoForm((current) => ({
        ...current,
        accountName: "",
        avitoUserId: "",
        avitoClientId: "",
        avitoClientSecret: "",
      }));
      setMessage("Avito сохранён. Теперь можно подключить диалоги.");
      await loadAvitoStatus();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить Avito"
      );
    } finally {
      setIsSavingAvito(false);
    }
  }

  async function runAvitoAccountAction(
    accountId: string,
    action: "connect" | "sync"
  ) {
    if (!workspace?.id) return;

    try {
      setMessage("");
      setAvitoAccountAction(`${action}:${accountId}`);

      const response = await fetch(
        action === "connect"
          ? "/api/avito/messenger/connect-webhook"
          : "/api/avito/messenger/sync-dialogs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId: workspace.id,
            accountId,
            days: 14,
            maxChats: 30,
          }),
        }
      );
      const result = await readApiJson(response);

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error ||
            (action === "connect"
              ? "Не удалось подключить Avito webhook"
              : "Не удалось синхронизировать диалоги")
        );
      }

      setMessage(
        action === "connect"
          ? "Avito webhook подключён. Новые диалоги будут попадать в CRM."
          : `Диалоги синхронизированы. Новых сообщений: ${
              result.messagesSynced ?? 0
            }.`
      );
      await loadAvitoStatus();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить действие Avito"
      );
    } finally {
      setAvitoAccountAction("");
    }
  }

  async function sendIntegrationTest(
    sourceKind: Exclude<IntegrationSourceKind, "avito">
  ) {
    if (!workspace?.id) return;

    try {
      setMessage("");
      setTestingIntegration(sourceKind);

      const response = await fetch("/api/crm/integration-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          sourceKind,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Тестовая заявка не дошла до CRM");
      }

      setMessage(
        `Тестовая заявка создана в CRM. Сделка: ${result.dealId ?? "создана"}.`
      );

      if (sourceKind === "yandex_direct") {
        await loadYandexStatus();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Ошибка проверки интеграции"
      );
    } finally {
      setTestingIntegration("");
    }
  }

  function isIntegrationConnected(integration: IntegrationCard) {
    if (integration.sourceKind === "avito") {
      return isAvitoConnected;
    }

    if (integration.sourceKind === "yandex_direct") {
      return yandexStatus?.integration?.is_active === true;
    }

    return Boolean(workspace?.id);
  }

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
      setMessage("");
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
      setMessage(
        (result.turboPages ?? []).length > 0
          ? "Турбо-страницы найдены. Выбери нужные и сохрани подключение."
          : "Яндекс не вернул опубликованные турбо-страницы. Можно указать ID вручную."
      );
    } catch (error) {
      setMessage(
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
      setMessage("");
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

      setMessage(
        `Подключение работает. Проверено страниц: ${
          result.turboPageIds?.length ?? 0
        }.`
      );
    } catch (error) {
      setMessage(
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
      setMessage("");
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

      setMessage(
        "Яндекс Директ подключен. Новые заявки будут попадать в CRM после запуска синхронизации."
      );
      await loadYandexStatus();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ошибка сохранения интеграции"
      );
    } finally {
      setIsSavingYandex(false);
    }
  }

  async function runYandexSyncNow() {
    try {
      setMessage("");
      setIsRunningYandexSync(true);

      const response = await fetch(yandexDirectSyncUrl, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || "Синхронизация Яндекс Директа не прошла"
        );
      }

      setMessage(
        `Синхронизация завершена. Создано сделок: ${result.createdDeals ?? 0}, дублей пропущено: ${result.skippedDuplicates ?? 0}.`
      );
      await loadYandexStatus();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ошибка запуска синхронизации Яндекс Директа"
      );
    } finally {
      setIsRunningYandexSync(false);
    }
  }

  if (!isReady) {
    return (
      <main className="rivn-scope min-h-screen px-5 py-6 text-slate-950 dark:text-white lg:px-8">
        <div className="rivn-card rivn-card-flat p-8">
          <p className="text-sm text-white/55">Загружаем интеграции CRM...</p>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="rivn-scope min-h-screen px-5 py-6 text-slate-950 dark:text-white lg:px-8">
        <div className="rivn-card rivn-card-flat p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00f5a8]">
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
    <main className="rivn-scope min-h-screen px-5 py-6 text-slate-950 dark:text-white lg:px-8">
      <section className="rivn-card overflow-hidden p-0">
        <div className="relative p-6 lg:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-56 w-72 rounded-full bg-[#00f5a8]/12 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 h-72 w-72 rounded-full bg-[#7c5cff]/18 blur-3xl"
          />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link
                href="/crm"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Назад в CRM
              </Link>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#00f5a8]">
                CRM integrations
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                Центр подключений
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
                Выбери канал, включи прием заявок и проверь тестовую сделку.
                Вся сложная техническая часть спрятана в один понятный сценарий.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/crm/settings"
                className="rivn-pill justify-center px-4 py-3 text-sm font-semibold"
              >
                <Route className="h-4 w-4" />
                Распределение
              </Link>
              <Link
                href="/crm"
                className="rivn-pill justify-center px-4 py-3 text-sm font-semibold"
              >
                <Settings2 className="h-4 w-4" />
                Открыть CRM
              </Link>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap items-stretch gap-2">
            {[
              {
                label: "Каналов",
                value: integrationCards.length,
                hint: "готовы к работе",
                icon: Webhook,
              },
              {
                label: "Подключено",
                value: connectedSources,
                hint: "активных источников",
                icon: CheckCircle2,
              },
              {
                label: "Прием заявок",
                value: Object.values(leadIngestionSettings).filter(Boolean)
                  .length,
                hint: "каналов включено",
                icon: Zap,
              },
              {
                label: "Состояние",
                value: "OK",
                hint: "рисков не найдено",
                icon: ShieldCheck,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="min-w-[170px] flex-1 rounded-[18px] border border-white/10 bg-white/[0.055] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:flex-none"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                      {item.label}
                    </p>
                    <Icon className="h-4 w-4 text-[#00f5a8]" />
                  </div>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {item.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    {item.hint}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rivn-card rivn-card-flat h-fit overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
              Источники
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Откуда приходят заявки
            </h2>
          </div>

          <div className="p-3">
            {integrationCards.map((integration) => {
              const isSelected =
                integration.sourceKind === selectedIntegration.sourceKind;
              const isConnected = isIntegrationConnected(integration);
              const isEnabled = leadIngestionSettings[integration.sourceKind];

              return (
                <button
                  key={integration.sourceKind}
                  type="button"
                  onClick={() => setSelectedSourceKind(integration.sourceKind)}
                  className={`group mb-2 w-full rounded-[22px] border p-4 text-left transition duration-300 last:mb-0 active:scale-[0.99] ${
                    isSelected
                      ? "border-[#00f5a8]/35 bg-[#00f5a8]/12 shadow-[0_18px_50px_rgba(0,245,168,0.10)]"
                      : "border-white/10 bg-white/[0.035] hover:border-white/16 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-slate-950 shadow-[0_16px_36px_rgba(0,0,0,0.24)] ${integration.accentClassName}`}
                    >
                      {getBrandLogo(integration.sourceKind)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {integration.title}
                        </span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isEnabled ? "bg-[#00f5a8]" : "bg-white/25"
                          }`}
                        />
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-white/45">
                        {integration.description}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isConnected
                              ? "bg-[#00f5a8]/12 text-[#9fffe3]"
                              : "bg-white/[0.055] text-white/42"
                          }`}
                        >
                          {isConnected ? "готово" : "требует настройки"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isEnabled
                              ? "bg-[#7c5cff]/16 text-[#c7bcff]"
                              : "bg-white/[0.055] text-white/42"
                          }`}
                        >
                          {isEnabled ? "прием включен" : "прием выключен"}
                        </span>
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rivn-card overflow-hidden p-0">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <span
                    className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br text-base font-black text-slate-950 shadow-[0_20px_45px_rgba(0,0,0,0.28)] ${selectedIntegration.accentClassName}`}
                  >
                    {getBrandLogo(selectedIntegration.sourceKind)}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00f5a8]">
                      Настройка канала
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">
                      {selectedIntegration.title}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-white/48">
                      {selectedIntegration.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void toggleLeadIngestion(selectedIntegration.sourceKind)
                  }
                  disabled={
                    updatingLeadIngestion === selectedIntegration.sourceKind
                  }
                  className={`inline-flex h-12 items-center gap-3 rounded-full border px-3 pl-4 text-sm font-semibold transition disabled:opacity-50 ${
                    leadIngestionSettings[selectedIntegration.sourceKind]
                      ? "border-[#00f5a8]/25 bg-[#00f5a8]/12 text-[#9fffe3]"
                      : "border-white/10 bg-white/[0.055] text-white/55"
                  }`}
                >
                  Принимать заявки
                  <span
                    className={`relative h-7 w-12 rounded-full p-1 transition ${
                      leadIngestionSettings[selectedIntegration.sourceKind]
                        ? "bg-[#00f5a8]"
                        : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        leadIngestionSettings[selectedIntegration.sourceKind]
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00f5a8]/12 text-[#00f5a8]">
                    <Webhook className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedIntegration.setupLabel}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      {selectedIntegration.setupDescription}
                    </p>
                  </div>
                </div>

                {selectedIntegration.sourceKind === "avito" ? (
                  <div className="mt-5 space-y-3">
                    <select
                      value={avitoForm.projectId}
                      onChange={(event) =>
                        updateAvitoForm("projectId", event.target.value)
                      }
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#08111f]/90 px-4 text-sm text-white outline-none transition focus:border-[#00f5a8]/40"
                    >
                      <option value="">Выбери проект</option>
                      {avitoProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={avitoForm.accountName}
                      onChange={(event) =>
                        updateAvitoForm("accountName", event.target.value)
                      }
                      placeholder="Название аккаунта"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00f5a8]/40"
                    />
                    <input
                      value={avitoForm.avitoUserId}
                      onChange={(event) =>
                        updateAvitoForm("avitoUserId", event.target.value)
                      }
                      placeholder="Avito user_id"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00f5a8]/40"
                    />
                    <input
                      value={avitoForm.avitoClientId}
                      onChange={(event) =>
                        updateAvitoForm("avitoClientId", event.target.value)
                      }
                      placeholder="Avito client_id"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00f5a8]/40"
                    />
                    <input
                      value={avitoForm.avitoClientSecret}
                      onChange={(event) =>
                        updateAvitoForm(
                          "avitoClientSecret",
                          event.target.value
                        )
                      }
                      type="password"
                      placeholder="Avito client_secret"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00f5a8]/40"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={checkAvitoConnection}
                        disabled={
                          isCheckingAvito ||
                          !avitoForm.avitoUserId.trim() ||
                          !avitoForm.avitoClientId.trim() ||
                          !avitoForm.avitoClientSecret.trim()
                        }
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white/78 transition hover:border-[#00f5a8]/28 hover:bg-[#00f5a8]/10 hover:text-white disabled:opacity-45"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {isCheckingAvito ? "Проверяем..." : "Проверить"}
                      </button>
                      <button
                        type="button"
                        onClick={saveAvitoIntegration}
                        disabled={
                          isSavingAvito ||
                          !avitoForm.projectId ||
                          !avitoForm.avitoUserId.trim() ||
                          !avitoForm.avitoClientId.trim() ||
                          !avitoForm.avitoClientSecret.trim()
                        }
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#00f5a8] px-4 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(0,245,168,0.20)] transition hover:-translate-y-0.5 hover:bg-[#2fffc0] disabled:translate-y-0 disabled:opacity-50"
                      >
                        {isSavingAvito ? "Сохраняем..." : "Подключить Avito"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 rounded-2xl border border-white/10 bg-[#08111f]/75 p-3 font-mono text-xs leading-6 text-white/72">
                      {selectedWebhookUrl}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void copyValue(
                            selectedWebhookUrl,
                            selectedIntegration.sourceKind
                          )
                        }
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white/78 transition hover:border-[#00f5a8]/28 hover:bg-[#00f5a8]/10 hover:text-white"
                      >
                        <Copy className="h-4 w-4" />
                        {copied === selectedIntegration.sourceKind
                          ? "Скопировано"
                          : "Скопировать ссылку"}
                      </button>
                      {selectedIntegration.sourceKind === "telegram" ? (
                        <a
                          href="https://t.me/BotFather"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#65d6ff]/20 bg-[#65d6ff]/10 px-4 text-sm font-semibold text-[#b9efff] transition hover:border-[#65d6ff]/40 hover:bg-[#65d6ff]/14"
                        >
                          Открыть BotFather
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                    {selectedIntegration.sourceKind === "telegram" ? (
                      <div className="mt-4 rounded-2xl border border-[#65d6ff]/18 bg-[#65d6ff]/8 p-4 text-xs leading-5 text-white/58">
                        <p className="font-semibold text-white">
                          Как подключить Telegram
                        </p>
                        <ol className="mt-2 space-y-1">
                          <li>1. Создай или открой бота через BotFather.</li>
                          <li>
                            2. Вставь ссылку webhook в свой обработчик бота,
                            Make или Albato.
                          </li>
                          <li>
                            3. Передавай в webhook текст сообщения, chat id и
                            username отправителя.
                          </li>
                        </ol>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#7c5cff]/16 text-[#c7bcff]">
                    <PlayCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Проверка без риска
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      Создай тестовую заявку и проверь, что она появляется в CRM
                      с нужным источником.
                    </p>
                  </div>
                </div>

                {selectedIntegration.sourceKind === "avito" ? (
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-[#00f5a8]/20 bg-[#00f5a8]/10 p-4 text-sm leading-6 text-[#9fffe3]">
                      {avitoAccounts.length > 0
                        ? `Подключено аккаунтов: ${avitoAccounts.length}.`
                        : "Аккаунты Avito пока не добавлены."}
                    </div>

                    {avitoAccounts.length > 0 ? (
                      <div className="space-y-2">
                        {avitoAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                  {account.name || "Avito аккаунт"}
                                </p>
                                <p className="mt-1 text-xs text-white/42">
                                  user_id: {account.avito_user_id || "не указан"}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  account.crm_dialogs_enabled
                                    ? "bg-[#00f5a8]/12 text-[#9fffe3]"
                                    : "bg-white/[0.055] text-white/45"
                                }`}
                              >
                                {account.crm_dialogs_enabled
                                  ? "CRM включена"
                                  : "CRM выключена"}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void runAvitoAccountAction(
                                    account.id,
                                    "connect"
                                  )
                                }
                                disabled={
                                  avitoAccountAction ===
                                  `connect:${account.id}`
                                }
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#00f5a8]/20 bg-[#00f5a8]/10 px-3 text-xs font-semibold text-[#9fffe3] transition hover:border-[#00f5a8]/35 hover:bg-[#00f5a8]/14 disabled:opacity-45"
                              >
                                <Webhook className="h-4 w-4" />
                                {avitoAccountAction ===
                                `connect:${account.id}`
                                  ? "Подключаем..."
                                  : "Подключить диалоги"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void runAvitoAccountAction(
                                    account.id,
                                    "sync"
                                  )
                                }
                                disabled={
                                  avitoAccountAction === `sync:${account.id}`
                                }
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-45"
                              >
                                <RefreshCcw className="h-4 w-4" />
                                {avitoAccountAction === `sync:${account.id}`
                                  ? "Собираем..."
                                  : "Синхронизировать"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void sendIntegrationTest(
                        selectedIntegration.sourceKind as Exclude<
                          IntegrationSourceKind,
                          "avito"
                        >
                      )
                    }
                    disabled={
                      testingIntegration === selectedIntegration.sourceKind ||
                      !leadIngestionSettings[selectedIntegration.sourceKind]
                    }
                    className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7c5cff] px-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(124,92,255,0.22)] transition hover:-translate-y-0.5 hover:bg-[#9177ff] disabled:translate-y-0 disabled:opacity-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {testingIntegration === selectedIntegration.sourceKind
                      ? "Проверяем..."
                      : "Создать тестовую заявку"}
                  </button>
                )}
              </div>
            </div>
          </section>

          {selectedIntegration.sourceKind === "yandex_direct" ? (
            <section className="rivn-card rivn-card-flat p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffcf8a]">
                    Direct Leads API
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    Расширенная настройка Яндекса
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
                    Нужна только если заявки надо автоматически забирать из
                    турбо-страниц Яндекс Директа без внешнего webhook.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={checkYandexIntegration}
                  disabled={isCheckingYandex || !yandexStatus?.integration}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white/72 transition hover:border-[#ffcf8a]/35 hover:text-white disabled:opacity-45"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isCheckingYandex ? "Проверяем..." : "Проверить"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      value={oauthToken}
                      onChange={(event) => setOauthToken(event.target.value)}
                      type="password"
                      placeholder="OAuth-токен Яндекса"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00f5a8]/40"
                    />
                    <a
                      href="https://yandex.ru/dev/direct/doc/start/token.html"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#ffcf8a]/22 bg-[#ffcf8a]/10 px-4 text-sm font-semibold text-[#ffe0ac] transition hover:border-[#ffcf8a]/40 hover:bg-[#ffcf8a]/14"
                    >
                      Где взять
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      value={clientLogin}
                      onChange={(event) => setClientLogin(event.target.value)}
                      placeholder="Client-Login, если аккаунт агентский"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00f5a8]/40"
                    />
                    <a
                      href="https://yandex.ru/support/direct/ru/agency/clients"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white/68 transition hover:border-white/20 hover:text-white"
                    >
                      Про Client-Login
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={findTurboPages}
                      disabled={isFindingPages || !oauthToken.trim()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ffb45c] px-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-[#ffc986] disabled:translate-y-0 disabled:opacity-50"
                    >
                      <Route className="h-4 w-4" />
                      {isFindingPages ? "Ищем..." : "Найти страницы"}
                    </button>
                    <button
                      type="button"
                      onClick={saveYandexIntegration}
                      disabled={
                        isSavingYandex ||
                        !oauthToken.trim() ||
                        (selectedTurboIds.length === 0 &&
                          !manualTurboIds.trim())
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#00f5a8] px-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-[#2fffc0] disabled:translate-y-0 disabled:opacity-50"
                    >
                      {isSavingYandex ? "Сохраняем..." : "Сохранить"}
                    </button>
                  </div>

                  {turboPages.length > 0 ? (
                    <div className="grid gap-2">
                      {turboPages.map((page) => (
                        <label
                          key={page.id}
                          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm text-white/78 transition hover:bg-white/[0.065]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTurboIds.includes(page.id)}
                            onChange={() => toggleTurboPage(page.id)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-semibold">
                              {page.name}
                            </span>
                            <span className="block text-xs text-white/42">
                              ID: {page.id}
                              {page.href ? ` · ${page.href}` : ""}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        value={manualTurboIds}
                        onChange={(event) =>
                          setManualTurboIds(event.target.value)
                        }
                        placeholder="ID турбо-страниц вручную: 123456789, 987654321"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00f5a8]/40"
                      />
                      <a
                        href="https://yandex.ru/support/direct/ru/efficiency/turbo-pages"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white/68 transition hover:border-white/20 hover:text-white"
                      >
                        Про страницы
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                  <p className="text-sm font-semibold text-white">
                    Статус подключения
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-white/55">
                    <div className="flex justify-between gap-4">
                      <span>Интеграция</span>
                      <span className="font-semibold text-white">
                        {yandexStatus?.integration ? "сохранена" : "не настроена"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Страниц</span>
                      <span className="font-semibold text-white">
                        {yandexStatus?.integration?.turbo_page_ids?.length ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Импортировано</span>
                      <span className="font-semibold text-white">
                        {yandexStatus?.importsCount ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="block">Последняя синхронизация</span>
                      <span className="mt-1 block font-semibold text-white">
                        {isLoadingYandexStatus
                          ? "проверяем..."
                          : formatDateTime(
                              yandexStatus?.integration?.last_synced_at
                            )}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={runYandexSyncNow}
                    disabled={
                      isRunningYandexSync || !yandexStatus?.integration
                    }
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white/72 transition hover:border-[#ffcf8a]/35 hover:text-white disabled:opacity-45"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {isRunningYandexSync ? "Запускаем..." : "Запустить сбор"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void copyValue(yandexDirectSyncUrl, "yandex-sync")
                    }
                    className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                    {copied === "yandex-sync"
                      ? "Скопировано"
                      : "Скопировать cron-ссылку"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {message ? (
            <div className="rivn-card rivn-card-flat border-[#00f5a8]/20 bg-[#00f5a8]/10 p-4 text-sm leading-6 text-[#9fffe3]">
              {message}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
