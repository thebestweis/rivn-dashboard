"use client";

import { useEffect, useMemo, useState } from "react";
import { AvitoChart } from "@/app/components/avito/avito-chart";
import { useAppContextState } from "@/app/providers/app-context-provider";

type AvitoMetric = {
  id: string;
  period_start: string;
  views: number;
  contacts: number;
  favorites: number;
  expenses: number;
  conversion: number;
  cost_per_contact: number;
};

type ProjectOption = {
  id: string;
  name: string;
};

type AvitoAccountForm = {
  accountName: string;
  avitoUserId: string;
  avitoClientId: string;
  avitoClientSecret: string;
  isActive: boolean;
};

type AvitoIntegration = {
  id: string;
  name: string;
  client_code: string | null;
  project_id: string | null;
  telegram_chat_id: string | null;
  is_active: boolean;
  daily_reports_enabled: boolean;
  weekly_reports_enabled: boolean;
  avito_report_accounts?: {
    id: string;
    name: string;
    avito_user_id: string | null;
    avito_client_id?: string | null;
    crm_dialogs_enabled?: boolean | null;
    is_active: boolean;
  }[];
};

type TelegramChat = {
  chatId: string;
  title: string;
  username: string | null;
  type: string;
};

type EditingAccountForm = {
  accountName: string;
  avitoUserId: string;
  avitoClientId: string;
  avitoClientSecret: string;
};

const TELEGRAM_BOT_USERNAME = "stat_rivnos_bot";

function buildTelegramBotLink(clientCode: string) {
  return buildTelegramGroupLink(clientCode);
}

function buildTelegramGroupLink(clientCode: string) {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?startgroup=${encodeURIComponent(
    clientCode
  )}`;
}

function buildTelegramPrivateLink(clientCode: string) {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(
    clientCode
  )}`;
}

function buildTelegramGroupCommand(clientCode: string) {
  return `/link@${TELEGRAM_BOT_USERNAME} ${clientCode}`;
}

function formatNumber(value: number) {
  return Math.round(value || 0).toLocaleString("ru-RU");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} ₽`;
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")}%`;
}

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function getLastDaysRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function readApiResponse(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error:
        "Сервер вернул не API-ответ, а страницу ошибки. Обычно это значит, что запрос попал не в тот адрес или приложение на сервере ещё не обновилось.",
      raw: text.slice(0, 300),
    };
  }
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 text-xs leading-5 text-white/35">{children}</div>;
}

const emptyAccount = (): AvitoAccountForm => ({
  accountName: "Основной аккаунт",
  avitoUserId: "",
  avitoClientId: "",
  avitoClientSecret: "",
  isActive: true,
});

export default function AvitoReportsPage() {
  const [data, setData] = useState<AvitoMetric[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstructionOpen, setIsInstructionOpen] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [accounts, setAccounts] = useState<AvitoAccountForm[]>([emptyAccount()]);
  const [isSaving, setIsSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [telegramBotLink, setTelegramBotLink] = useState("");
  const [telegramPrivateLink, setTelegramPrivateLink] = useState("");
  const [createdClientCode, setCreatedClientCode] = useState("");

  const [integrations, setIntegrations] = useState<AvitoIntegration[]>([]);
const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([]);
const [isLoadingChats, setIsLoadingChats] = useState(false);
const [integrationMessage, setIntegrationMessage] = useState("");
const [updatingIntegrationId, setUpdatingIntegrationId] = useState("");
const [selectedAnalyticsClientId, setSelectedAnalyticsClientId] = useState("");
const [metricsMessage, setMetricsMessage] = useState("");
const [metricsPeriod, setMetricsPeriod] = useState(() => getCurrentMonthRange());
const [isConnectFormOpen, setIsConnectFormOpen] = useState(false);
const [isQuickChecklistOpen, setIsQuickChecklistOpen] = useState(false);
const [expandedIntegrationId, setExpandedIntegrationId] = useState("");
const [expandedReportsId, setExpandedReportsId] = useState("");
const [checkingAccountIndex, setCheckingAccountIndex] = useState<number | null>(null);
const [accountCheckMessages, setAccountCheckMessages] = useState<Record<number, string>>({});
const [sendingTestReportId, setSendingTestReportId] = useState("");
const [editingIntegrationId, setEditingIntegrationId] = useState("");
const [editingTelegramChatId, setEditingTelegramChatId] = useState("");
const [editingAccounts, setEditingAccounts] = useState<Record<string, EditingAccountForm>>({});
const [connectingMessengerAccountId, setConnectingMessengerAccountId] = useState("");
const [syncingDialogsAccountId, setSyncingDialogsAccountId] = useState("");

  const { workspace } = useAppContextState();

  useEffect(() => {
    async function load() {
      try {
        if (!workspace?.id) {
  return;
}
        const integrationsResponse = await fetch(`/api/avito/integrations?workspaceId=${workspace?.id ?? ""}`, {
  cache: "no-store",
});

        const integrationsData = await integrationsResponse.json();

        if (integrationsData.ok) {
          setProjects(integrationsData.projects ?? []);
setIntegrations(integrationsData.integrations ?? []);
          setSelectedAnalyticsClientId((current) => {
            if (current) {
              return current;
            }

            return integrationsData.integrations?.[0]?.id ?? "";
          });
        }
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [workspace?.id]);

  useEffect(() => {
    async function loadMetrics() {
      if (!workspace?.id || !selectedAnalyticsClientId) {
        setData([]);
        return;
      }

      try {
        setIsLoading(true);
        setMetricsMessage("");

        const params = new URLSearchParams({
          clientId: selectedAnalyticsClientId,
          workspaceId: workspace.id,
          from: metricsPeriod.from,
          to: metricsPeriod.to,
        });

        const response = await fetch(`/api/avito/metrics?${params.toString()}`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Не удалось загрузить метрики Avito");
        }

        setData(result.metrics as AvitoMetric[]);
      } catch (error) {
        setData([]);
        setMetricsMessage(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить метрики Avito"
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadMetrics();
  }, [metricsPeriod.from, metricsPeriod.to, selectedAnalyticsClientId, workspace?.id]);

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedAnalyticsIntegration = integrations.find(
    (integration) => integration.id === selectedAnalyticsClientId
  );

  const totals = useMemo(() => {
    const views = data.reduce((sum, item) => sum + Number(item.views || 0), 0);
    const contacts = data.reduce((sum, item) => sum + Number(item.contacts || 0), 0);
    const expenses = data.reduce((sum, item) => sum + Number(item.expenses || 0), 0);

    return {
      views,
      contacts,
      expenses,
      conversion: views > 0 ? (contacts / views) * 100 : 0,
      costPerContact: contacts > 0 ? expenses / contacts : 0,
    };
  }, [data]);

  function updateAccount(index: number, patch: Partial<AvitoAccountForm>) {
    setAccounts((prev) =>
      prev.map((account, accountIndex) =>
        accountIndex === index ? { ...account, ...patch } : account
      )
    );
  }

  function addAccount() {
    setAccounts((prev) => [
      ...prev,
      {
        ...emptyAccount(),
        accountName: `Avito аккаунт ${prev.length + 1}`,
      },
    ]);
  }

  function removeAccount(index: number) {
    setAccounts((prev) => prev.filter((_, accountIndex) => accountIndex !== index));
  }

  function startEditingIntegration(integration: AvitoIntegration) {
    setEditingIntegrationId(integration.id);
    setEditingTelegramChatId(integration.telegram_chat_id ?? "");
    setEditingAccounts(
      Object.fromEntries(
        (integration.avito_report_accounts ?? []).map((account) => [
          account.id,
          {
            accountName: account.name,
            avitoUserId: account.avito_user_id ?? "",
            avitoClientId: account.avito_client_id ?? "",
            avitoClientSecret: "",
          },
        ])
      )
    );
  }

  function stopEditingIntegration() {
    setEditingIntegrationId("");
    setEditingTelegramChatId("");
    setEditingAccounts({});
  }

  function updateEditingAccount(
    accountId: string,
    patch: Partial<EditingAccountForm>
  ) {
    setEditingAccounts((current) => ({
      ...current,
      [accountId]: {
        ...current[accountId],
        ...patch,
      },
    }));
  }

  async function checkAvitoConnection(index: number) {
    const account = accounts[index];

    if (!account) {
      return;
    }

    setAccountCheckMessages((current) => ({
      ...current,
      [index]: "",
    }));

    if (
      !account.avitoUserId.trim() ||
      !account.avitoClientId.trim() ||
      !account.avitoClientSecret.trim()
    ) {
      setAccountCheckMessages((current) => ({
        ...current,
        [index]: "Заполни Avito user_id, client_id и client_secret",
      }));
      return;
    }

    try {
      setCheckingAccountIndex(index);

      const response = await fetch("/api/avito/check-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          avitoUserId: account.avitoUserId.trim(),
          avitoClientId: account.avitoClientId.trim(),
          avitoClientSecret: account.avitoClientSecret.trim(),
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result?.ok) {
        throw new Error(result.error || "Avito не принял данные");
      }

      setAccountCheckMessages((current) => ({
        ...current,
        [index]: "Подключение работает. Avito API отвечает.",
      }));
    } catch (error) {
      setAccountCheckMessages((current) => ({
        ...current,
        [index]:
          error instanceof Error
            ? error.message
            : "Не удалось проверить Avito-подключение",
      }));
    } finally {
      setCheckingAccountIndex(null);
    }
  }

  async function handleCreateIntegration() {
    setFormMessage("");
    setTelegramBotLink("");
    setTelegramPrivateLink("");
    setCreatedClientCode("");

    if (!projectId || !selectedProject) {
      setFormMessage("Выбери проект");
      return;
    }

    if (accounts.length === 0) {
      setFormMessage("Добавь хотя бы один Avito-аккаунт");
      return;
    }

    const invalidAccountIndex = accounts.findIndex(
      (account) =>
        !account.avitoUserId.trim() ||
        !account.avitoClientId.trim() ||
        !account.avitoClientSecret.trim()
    );

    if (invalidAccountIndex >= 0) {
      setFormMessage(`Заполни все Avito-данные для аккаунта №${invalidAccountIndex + 1}`);
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch("/api/avito/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          projectId,
          projectName: selectedProject.name,
          telegramChatId: telegramChatId.trim(),
          dailyEnabled,
          weeklyEnabled,
          isActive,
          accounts: accounts.map((account) => ({
            accountName: account.accountName.trim(),
            avitoUserId: account.avitoUserId.trim(),
            avitoClientId: account.avitoClientId.trim(),
            avitoClientSecret: account.avitoClientSecret.trim(),
            isActive: account.isActive,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось создать интеграцию");
      }

      setFormMessage(
        `Проект подключен. Добавлено Avito-аккаунтов: ${result.accountsCount}. Отправь клиенту ссылку для Telegram.`
      );
      setCreatedClientCode(result.clientCode ?? "");
      setTelegramBotLink(result.telegramGroupLink ?? result.telegramBotLink ?? "");
      setTelegramPrivateLink(result.telegramPrivateLink ?? "");

      setProjectId("");
      setTelegramChatId("");
      setDailyEnabled(true);
      setWeeklyEnabled(true);
      setIsActive(true);
      setAccounts([emptyAccount()]);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLoadTelegramChats() {
    try {
      setIsLoadingChats(true);
      setFormMessage("");

      if (!workspace?.id) {
        setFormMessage("Кабинет еще загружается. Подожди пару секунд и попробуй снова.");
        return;
      }

      const response = await fetch(
        `/api/avito/telegram-updates?workspaceId=${encodeURIComponent(
          workspace.id
        )}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось получить chat_id");
      }

      setTelegramChats(result.chats ?? []);

      if ((result.chats ?? []).length === 0) {
        setFormMessage(
          "Бот пока не видит чаты. Попроси клиента открыть @stat_rivnos_bot и нажать Start."
        );
      }
    } catch (error) {
      setFormMessage(
        error instanceof Error ? error.message : "Ошибка получения chat_id"
      );
    } finally {
      setIsLoadingChats(false);
    }
  }

  async function refreshIntegrations() {
    if (!workspace?.id) {
      return;
    }

    const response = await fetch(
      `/api/avito/integrations?workspaceId=${encodeURIComponent(workspace.id)}`,
      {
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Не удалось обновить список проектов");
    }

    setProjects(result.projects ?? []);
    setIntegrations(result.integrations ?? []);
  }

  async function updateIntegration(
    integrationId: string,
    patch: {
      isActive?: boolean;
      dailyEnabled?: boolean;
      weeklyEnabled?: boolean;
    }
  ) {
    try {
      setIntegrationMessage("");
      setUpdatingIntegrationId(integrationId);

      const response = await fetch("/api/avito/integrations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          integrationId,
          patch,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось обновить проект");
      }

      await refreshIntegrations();
      setIntegrationMessage("Настройки проекта обновлены");
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error ? error.message : "Ошибка обновления проекта"
      );
    } finally {
      setUpdatingIntegrationId("");
    }
  }

  async function archiveIntegration(integration: AvitoIntegration) {
    const confirmed = window.confirm(
      `Отправка отчётов по проекту "${integration.name}" будет выключена. История и настройки останутся в системе. Архивировать проект?`
    );

    if (!confirmed) {
      return;
    }

    await updateIntegration(integration.id, {
      isActive: false,
      dailyEnabled: false,
      weeklyEnabled: false,
    });
  }

  async function updateIntegrationAccount(
    accountId: string,
    patch: {
      isActive?: boolean;
      crmDialogsEnabled?: boolean;
    }
  ) {
    try {
      setIntegrationMessage("");
      setUpdatingIntegrationId(accountId);

      const response = await fetch("/api/avito/integrations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          accountId,
          patch,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось обновить Avito-аккаунт");
      }

      await refreshIntegrations();
      setIntegrationMessage("Настройки Avito-аккаунта обновлены");
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error
          ? error.message
          : "Ошибка обновления Avito-аккаунта"
      );
    } finally {
      setUpdatingIntegrationId("");
    }
  }

  async function connectAvitoMessenger(accountId: string) {
    try {
      setIntegrationMessage("");
      setConnectingMessengerAccountId(accountId);

      const response = await fetch("/api/avito/messenger/connect-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          accountId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось подключить Avito-диалоги");
      }

      setIntegrationMessage(
        "Avito-диалоги подключены. Новые сообщения будут попадать в CRM."
      );
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error
          ? error.message
          : "Не удалось подключить Avito-диалоги"
      );
    } finally {
      setConnectingMessengerAccountId("");
    }
  }

  async function syncAvitoDialogs(accountId: string) {
    try {
      setIntegrationMessage("");
      setSyncingDialogsAccountId(accountId);

      const response = await fetch("/api/avito/messenger/sync-dialogs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          accountId,
          days: 14,
          maxChats: 30,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось загрузить Avito-диалоги");
      }

      setIntegrationMessage(
        `Диалоги загружены: чатов ${result.chatsChecked}, сообщений найдено ${
          result.messagesChecked ?? 0
        }, новых ${result.messagesSynced}, дублей ${
          result.duplicateMessages ?? 0
        }, входящих ${result.incomingMessages ?? 0}, исходящих ${
          result.outgoingMessages ?? 0
        }.`
      );
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить Avito-диалоги"
      );
    } finally {
      setSyncingDialogsAccountId("");
    }
  }

  async function saveIntegrationDetails(integration: AvitoIntegration) {
    try {
      setIntegrationMessage("");
      setUpdatingIntegrationId(integration.id);

      const response = await fetch("/api/avito/integrations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          integrationId: integration.id,
          patch: {
            telegramChatId: editingTelegramChatId,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось обновить проект");
      }

      for (const account of integration.avito_report_accounts ?? []) {
        const form = editingAccounts[account.id];

        if (!form) {
          continue;
        }

        const accountResponse = await fetch("/api/avito/integrations", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId: workspace?.id,
            accountId: account.id,
            patch: {
              accountName: form.accountName,
              avitoUserId: form.avitoUserId,
              avitoClientId: form.avitoClientId,
              avitoClientSecret: form.avitoClientSecret,
            },
          }),
        });

        const accountResult = await accountResponse.json();

        if (!accountResponse.ok || !accountResult.ok) {
          throw new Error(
            accountResult.error || `Не удалось обновить аккаунт ${account.name}`
          );
        }
      }

      await refreshIntegrations();
      stopEditingIntegration();
      setIntegrationMessage("Настройки проекта сохранены");
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error
          ? error.message
          : "Ошибка сохранения настроек проекта"
      );
    } finally {
      setUpdatingIntegrationId("");
    }
  }

  async function sendTestReport(integration: AvitoIntegration) {
    const confirmed = window.confirm(
      `Отправить тестовый отчёт по проекту "${integration.name}" в привязанную Telegram-беседу?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIntegrationMessage("");
      setSendingTestReportId(integration.id);

      const response = await fetch("/api/avito/send-test-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: workspace?.id,
          clientId: integration.id,
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result?.ok) {
        throw new Error(result.error || "Не удалось отправить тестовый отчёт");
      }

      setIntegrationMessage(
        result.message ||
          "Тестовый отчёт запущен. Он придёт в Telegram после формирования."
      );
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error
          ? error.message
          : "Ошибка отправки тестового отчёта"
      );
    } finally {
      setSendingTestReportId("");
    }
  }

  const archivedIntegrations = integrations.filter(
    (integration) =>
      !integration.is_active &&
      !integration.daily_reports_enabled &&
      !integration.weekly_reports_enabled
  );
  const activeIntegrations = integrations.filter(
    (integration) =>
      integration.is_active ||
      integration.daily_reports_enabled ||
      integration.weekly_reports_enabled
  );

  return (
    
    <main className="flex-1">
      <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5 lg:space-y-6 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm text-white/45">Авито-аналитика</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Avito Reports
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                Подключай проекты к Avito API, получай ежедневные и еженедельные Telegram-отчёты, сохраняй метрики и смотри динамику в RIVN OS.
              </p>
            </div>

            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={() => setIsInstructionOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
              >
                Инструкция
              </button>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-300">
                Реальные расходы из Avito API
              </div>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto rounded-[24px] border border-white/10 bg-[#121826] p-2 text-sm shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
          {[
            ["#connect-avito", "Подключение"],
            ["#connected-projects", "Проекты"],
            ["#project-analytics", "Аналитика"],
            ["#metrics-dynamics", "Динамика"],
            ["#reports-history", "История"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-2xl border border-transparent bg-white/[0.03] px-4 py-2.5 text-white/65 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <section className="rounded-[28px] border border-emerald-400/15 bg-emerald-400/[0.06] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.18)] sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-emerald-300">
                Быстрый чеклист Avito
              </div>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Как подключить Avito-отчёты
              </h2>
              {!isQuickChecklistOpen ? (
                <p className="mt-1 text-sm text-white/45">
                  Короткая подсказка скрыта, чтобы не занимать место на экране.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setIsQuickChecklistOpen((current) => !current)}
              className="w-fit rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
            >
              {isQuickChecklistOpen ? "Скрыть чеклист" : "Показать чеклист"}
            </button>
          </div>

          {isQuickChecklistOpen ? (
          <>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "1. Выбери проект",
                text: "Проект уже должен быть создан в RIVN OS. Если его нет, сначала добавь его в разделе проектов.",
                href: "/projects",
                label: "Открыть проекты",
              },
              {
                title: "2. Добавь Avito-аккаунт",
                text: "Вставь Avito user_id, client_id и client_secret. Если аккаунтов несколько, добавь каждый.",
                href: "#connect-avito",
                label: "К форме",
              },
              {
                title: "3. Привяжи Telegram",
                text: "После сохранения скопируй ссылку для беседы, добавь бота и отправь команду привязки.",
                href: `https://t.me/${TELEGRAM_BOT_USERNAME}`,
                label: "Открыть бота",
              },
              {
                title: "4. Проверь отчёт",
                text: "В подключённом проекте нажми «Отправить тест», чтобы убедиться, что всё приходит в нужную беседу.",
                href: "#connected-projects",
                label: "К проектам",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/10 bg-[#0F1524]/80 p-4"
              >
                <div className="text-sm font-semibold text-white">
                  {step.title}
                </div>
                <p className="mt-2 min-h-[54px] text-xs leading-5 text-white/50">
                  {step.text}
                </p>
                <a
                  href={step.href}
                  target={step.href.startsWith("http") ? "_blank" : undefined}
                  className="mt-3 inline-flex text-xs font-semibold text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
                >
                  {step.label}
                </a>
              </div>
            ))}
          </div>
          <a
            href="#connect-avito"
            className="mt-4 inline-flex w-fit rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#07120F] transition hover:bg-emerald-300"
          >
            Начать подключение
          </a>
          </>
          ) : null}
        </section>

        <div id="connect-avito" className="rounded-[32px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Подключить проект к Avito</h2>
              <p className="mt-1 max-w-3xl text-sm text-white/45">
                Добавь проект один раз, а дальше RIVN OS будет собирать расходы и отправлять отчёты в Telegram.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/55">
                  1. Проект
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/55">
                  2. Avito API
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/55">
                  3. Telegram
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsConnectFormOpen((current) => !current)}
              className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15 sm:w-auto"
            >
              {isConnectFormOpen ? "Свернуть" : "Подключить проект"}
            </button>
          </div>

          {isConnectFormOpen ? (
            <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-sm text-white/60">Проект</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
              >
                <option value="">Выбери проект</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <FieldHint>
                Здесь выбирается проект, который уже создан в RIVN OS. Один проект может иметь несколько Avito-аккаунтов.
              </FieldHint>
              <div className="mt-3">
  <button
    type="button"
    onClick={handleLoadTelegramChats}
    disabled={isLoadingChats}
    className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
  >
    {isLoadingChats ? "Ищем chat_id..." : "Запасной способ: выбрать chat_id"}
  </button>

  {telegramChats.length > 0 ? (
    <div className="mt-3 space-y-2">
      {telegramChats.map((chat) => (
        <button
          key={chat.chatId}
          type="button"
          onClick={() => setTelegramChatId(chat.chatId)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[0.06]"
        >
          <span>
            {chat.title}
            {chat.username ? ` (@${chat.username})` : ""} · {chat.type}
          </span>
          <span className="text-emerald-300">{chat.chatId}</span>
        </button>
      ))}
    </div>
  ) : null}
</div>
            </div>

            <div>
              <label className="text-sm text-white/60">Telegram chat_id (необязательно)</label>
              <input
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Например: 123456789"
                className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/25"
              />
              <FieldHint>
                Основной способ теперь проще: сохрани проект, скопируй готовую ссылку на бота и отправь её клиенту. Это поле можно оставить пустым. Запасной способ: клиент открывает{" "}
                <a
                  href="https://t.me/stat_rivnos_bot"
                  target="_blank"
                  className="text-emerald-300 underline underline-offset-4"
                >
                  @stat_rivnos_bot
                </a>
                , нажимает Start, а ты выбираешь его chat_id кнопкой слева.
              </FieldHint>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {accounts.map((account, index) => (
              <div
                key={index}
                className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Avito-аккаунт №{index + 1}
                    </h3>
                    <div className="mt-1 text-sm text-white/40">
                      Если у проекта несколько кабинетов Avito — добавь их все.
                    </div>
                  </div>

                  {accounts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeAccount(index)}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/15"
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="text-sm text-white/60">Название аккаунта</label>
                    <input
                      value={account.accountName}
                      onChange={(e) => updateAccount(index, { accountName: e.target.value })}
                      placeholder="Основной аккаунт"
                      className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/25"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/60">Avito user_id</label>
                    <input
                      value={account.avitoUserId}
                      onChange={(e) => updateAccount(index, { avitoUserId: e.target.value })}
                      placeholder="Например: 417285569"
                      className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <FieldHint>
                      Где взять: это ID кабинета Avito. Обычно его видно в личном кабинете или API-кабинете клиента.
                    </FieldHint>
                  </div>

                  <div>
                    <label className="text-sm text-white/60">Avito client_id</label>
                    <input
                      value={account.avitoClientId}
                      onChange={(e) => updateAccount(index, { avitoClientId: e.target.value })}
                      placeholder="Client ID из Avito API"
                      className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <FieldHint>
                      Где взять: авторизуйся в браузере в аккаунте клиента и открой{" "}
                      <a
                        href="https://www.avito.ru/professionals/api"
                        target="_blank"
                        className="text-emerald-300 underline underline-offset-4"
                      >
                        https://www.avito.ru/professionals/api
                      </a>
                      .
                    </FieldHint>
                  </div>

                  <div>
                    <label className="text-sm text-white/60">Avito client_secret</label>
                    <input
                      value={account.avitoClientSecret}
                      onChange={(e) =>
                        updateAccount(index, { avitoClientSecret: e.target.value })
                      }
                      placeholder="Client Secret из Avito API"
                      type="password"
                      className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <FieldHint>
                      Где взять: там же, на странице Avito API. Это секретный ключ, не публикуй его и не отправляй посторонним.
                    </FieldHint>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => checkAvitoConnection(index)}
                    disabled={checkingAccountIndex === index}
                    className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50 sm:w-auto"
                  >
                    {checkingAccountIndex === index
                      ? "Проверяем Avito..."
                      : "Проверить подключение Avito"}
                  </button>

                  {accountCheckMessages[index] ? (
                    <div className="text-sm text-white/55">
                      {accountCheckMessages[index]}
                    </div>
                  ) : null}
                </div>

                <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
                  <span>Аккаунт активен</span>
                  <input
                    type="checkbox"
                    checked={account.isActive}
                    onChange={(e) => updateAccount(index, { isActive: e.target.checked })}
                  />
                </label>
              </div>
            ))}

            <button
              type="button"
              onClick={addAccount}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white sm:w-auto"
            >
              Добавить ещё Avito-аккаунт
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
              <span>Включить daily</span>
              <input
                type="checkbox"
                checked={dailyEnabled}
                onChange={(e) => setDailyEnabled(e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
              <span>Включить weekly</span>
              <input
                type="checkbox"
                checked={weeklyEnabled}
                onChange={(e) => setWeeklyEnabled(e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
              <span>Проект активен</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/45">
              Daily — каждый день. Weekly — раз в неделю. Если проект выключен, отчёты по нему не отправляются.
            </div>

            <button
              type="button"
              onClick={handleCreateIntegration}
              disabled={isSaving}
              className="w-full rounded-2xl bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSaving ? "Сохраняем..." : "Подключить проект"}
            </button>
          </div>

          {formMessage ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
              {formMessage}
            </div>
          ) : null}

          {telegramBotLink ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <div className="text-sm font-medium text-emerald-200">
                Рекомендуется: добавить бота в беседу клиента
              </div>
              <div className="mt-2 text-sm text-white/70">
                Отправь эту ссылку клиенту или нажми сам. Telegram предложит выбрать беседу. После добавления бота отправь в этой беседе команду ниже.
              </div>
              <div className="mt-3 break-all rounded-xl border border-white/10 bg-[#0F1524] px-3 py-2 text-sm text-emerald-300">
                {telegramBotLink}
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-white/35">
                Команда для беседы
              </div>
              <div className="mt-2 break-all rounded-xl border border-white/10 bg-[#0F1524] px-3 py-2 text-sm text-white/80">
                {buildTelegramGroupCommand(createdClientCode)}
              </div>
              {telegramPrivateLink ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                  Запасной вариант для личного чата:{" "}
                  <a
                    href={telegramPrivateLink}
                    target="_blank"
                    className="break-all text-emerald-300 underline underline-offset-4"
                  >
                    {telegramPrivateLink}
                  </a>
                </div>
              ) : null}
              <div className="mt-2 text-xs text-white/45">
                Код привязки: {createdClientCode}
              </div>
            </div>
          ) : null}
            </>
          ) : null}
        </div>

        <div id="connected-projects" className="rounded-[32px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-6">
  <div>
    <h2 className="text-lg font-semibold text-white">Подключённые проекты</h2>
    <div className="mt-1 text-sm text-white/45">
      Здесь отображаются проекты, для которых уже настроены Avito-отчёты.
    </div>
    {integrationMessage ? (
      <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
        {integrationMessage}
      </div>
    ) : null}
  </div>

  <div className="mt-5 space-y-3">
    {activeIntegrations.length > 0 ? (
      activeIntegrations.map((integration) => {
        const integrationAccounts = integration.avito_report_accounts ?? [];
        const isExpanded = expandedIntegrationId === integration.id;
        const isEditing = editingIntegrationId === integration.id;
        const isReportsExpanded = expandedReportsId === integration.id;
        const enabledReportsCount = [
          integration.daily_reports_enabled,
          integration.weekly_reports_enabled,
        ].filter(Boolean).length;
        const isProjectEnabled =
          integration.is_active ||
          integration.daily_reports_enabled ||
          integration.weekly_reports_enabled;

        return (
          <div
            key={integration.id}
            className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-base font-semibold text-white">
                  {integration.name}
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Telegram chat_id: {integration.telegram_chat_id || "не указан"}
                </div>
                {isExpanded && integration.client_code ? (
                  <div className="mt-2 text-xs text-white/45">
                    Ссылка для беседы:{" "}
                    <a
                      href={buildTelegramGroupLink(integration.client_code)}
                      target="_blank"
                      className="break-all text-emerald-300 underline underline-offset-4"
                    >
                      {buildTelegramGroupLink(integration.client_code)}
                    </a>
                    <div className="mt-1">
                      Команда для беседы:{" "}
                      <span className="break-all text-white/70">
                        {buildTelegramGroupCommand(integration.client_code)}
                      </span>
                    </div>
                    <div className="mt-1">
                      Личная ссылка:{" "}
                      <a
                        href={buildTelegramPrivateLink(integration.client_code)}
                        target="_blank"
                        className="break-all text-white/55 underline underline-offset-4 hover:text-emerald-300"
                      >
                        {buildTelegramPrivateLink(integration.client_code)}
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/60">
                  Аккаунтов: {integrationAccounts.length}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    updateIntegration(integration.id, {
                      isActive: !isProjectEnabled,
                      dailyEnabled: !isProjectEnabled,
                      weeklyEnabled: !isProjectEnabled,
                    })
                  }
                  disabled={updatingIntegrationId === integration.id}
                  className={`rounded-full border px-3 py-1 transition disabled:opacity-50 ${
                    isProjectEnabled
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
                      : "border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
                  }`}
                >
                  {isProjectEnabled ? "Активен" : "Выключен"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedReportsId((current) =>
                      current === integration.id ? "" : integration.id
                    )
                  }
                  className={`rounded-full border px-3 py-1 ${
                    enabledReportsCount > 0
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-white/40"
                  }`}
                >
                  Отчёты: {enabledReportsCount}/2
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedIntegrationId((current) =>
                      current === integration.id ? "" : integration.id
                    )
                  }
                  className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-300 transition hover:bg-emerald-400/15"
                >
                  {isExpanded ? "Скрыть детали" : "Подробнее"}
                </button>

                {isExpanded ? (
                  <>
                <button
                  type="button"
                  onClick={() => sendTestReport(integration)}
                  disabled={sendingTestReportId === integration.id}
                  className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
                >
                  {sendingTestReportId === integration.id
                    ? "Отправляем..."
                    : "Отправить тест"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    isEditing
                      ? stopEditingIntegration()
                      : startEditingIntegration(integration)
                  }
                  disabled={updatingIntegrationId === integration.id}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/65 transition hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {isEditing ? "Отменить правки" : "Редактировать"}
                </button>
                  </>
                ) : null}
              </div>
            </div>

            {isReportsExpanded ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Отчёты
                    </div>
                    <div className="text-xs text-white/45">
                      Здесь можно включить или выключить ежедневные и еженедельные отчёты, не трогая заявки в CRM.
                    </div>
                  </div>
                  <div className="text-xs text-white/45">
                    {enabledReportsCount === 2
                      ? "Оба отчёта включены"
                      : enabledReportsCount === 1
                        ? "Включён один отчёт"
                        : "Отчёты выключены"}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateIntegration(integration.id, {
                        dailyEnabled: !integration.daily_reports_enabled,
                      })
                    }
                    disabled={updatingIntegrationId === integration.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-left transition hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Ежедневный отчёт
                      </span>
                      <span className="mt-1 block text-xs text-white/45">
                        Каждый день утром в Telegram-беседу.
                      </span>
                    </span>
                    <span
                      className={`h-6 w-11 rounded-full p-1 transition ${
                        integration.daily_reports_enabled
                          ? "bg-emerald-400/80"
                          : "bg-white/15"
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition ${
                          integration.daily_reports_enabled
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateIntegration(integration.id, {
                        weeklyEnabled: !integration.weekly_reports_enabled,
                      })
                    }
                    disabled={updatingIntegrationId === integration.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-left transition hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Еженедельный отчёт
                      </span>
                      <span className="mt-1 block text-xs text-white/45">
                        Раз в неделю для управленческого контроля.
                      </span>
                    </span>
                    <span
                      className={`h-6 w-11 rounded-full p-1 transition ${
                        integration.weekly_reports_enabled
                          ? "bg-emerald-400/80"
                          : "bg-white/15"
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition ${
                          integration.weekly_reports_enabled
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            {isExpanded && isEditing ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0F1524] p-4">
                <label className="text-sm text-white/60">Telegram chat_id</label>
                <input
                  value={editingTelegramChatId}
                  onChange={(event) =>
                    setEditingTelegramChatId(event.target.value)
                  }
                  placeholder="Например: -1001234567890"
                  className="mt-2 h-[44px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/25"
                />
                <div className="mt-2 text-xs text-white/40">
                  Это чат, куда бот отправляет отчёты. Для беседы обычно начинается с -100. Если оставить пустым, отчёты не будут отправляться, пока беседа не привяжется через бота.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveIntegrationDetails(integration)}
                    disabled={updatingIntegrationId === integration.id}
                    className="rounded-2xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {updatingIntegrationId === integration.id
                      ? "Сохраняем..."
                      : "Сохранить правки"}
                  </button>
                  <button
                    type="button"
                    onClick={stopEditingIntegration}
                    disabled={updatingIntegrationId === integration.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65 transition hover:bg-white/[0.07] disabled:opacity-50"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : null}

            {isExpanded && integrationAccounts.length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {integrationAccounts.map((account) => {
                  const editingAccount = editingAccounts[account.id] ?? {
                    accountName: account.name,
                    avitoUserId: account.avito_user_id ?? "",
                    avitoClientId: account.avito_client_id ?? "",
                    avitoClientSecret: "",
                  };
                  const maskedClientId = account.avito_client_id
                    ? `${account.avito_client_id.slice(0, 6)}...`
                    : "не указан";
                  const isCrmDialogsEnabled =
                    account.crm_dialogs_enabled !== false;

                  return (
                    <div
                      key={account.id}
                      className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white/65"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-white/50">
                              Название аккаунта
                            </label>
                            <input
                              value={editingAccount.accountName}
                              onChange={(event) =>
                                updateEditingAccount(account.id, {
                                  accountName: event.target.value,
                                })
                              }
                              className="mt-1 h-[42px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-white/50">
                              Avito user_id
                            </label>
                            <input
                              value={editingAccount.avitoUserId}
                              onChange={(event) =>
                                updateEditingAccount(account.id, {
                                  avitoUserId: event.target.value,
                                })
                              }
                              className="mt-1 h-[42px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-white/50">
                              Avito client_id
                            </label>
                            <input
                              value={editingAccount.avitoClientId}
                              onChange={(event) =>
                                updateEditingAccount(account.id, {
                                  avitoClientId: event.target.value,
                                })
                              }
                              className="mt-1 h-[42px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-white/50">
                              Новый client_secret
                            </label>
                            <input
                              value={editingAccount.avitoClientSecret}
                              onChange={(event) =>
                                updateEditingAccount(account.id, {
                                  avitoClientSecret: event.target.value,
                                })
                              }
                              placeholder="Оставь пустым, если секрет не меняется"
                              type="password"
                              className="mt-1 h-[42px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/25"
                            />
                            <div className="mt-1 text-xs text-white/35">
                              Старый client_secret не показываем ради безопасности.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-white">
                            {account.name}
                          </div>
                          <div className="mt-1 text-xs text-white/40">
                            Avito user_id:{" "}
                            {account.avito_user_id || "не указан"}
                          </div>
                          <div className="mt-1 text-xs text-white/40">
                            Avito client_id: {maskedClientId}
                          </div>
                          <div className="mt-1 text-xs text-white/40">
                            Отчёты по аккаунту:{" "}
                            {account.is_active ? "включены" : "выключены"}
                          </div>
                          <div className="mt-1 text-xs text-white/40">
                            Заявки в CRM:{" "}
                            {isCrmDialogsEnabled ? "принимаются" : "выключены"}
                          </div>
                        </>
                      )}

                      {!isEditing ? (
                        <>
                        <div className="mt-4 grid gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateIntegrationAccount(account.id, {
                                isActive: !account.is_active,
                              })
                            }
                            disabled={
                              updatingIntegrationId === account.id ||
                              connectingMessengerAccountId === account.id ||
                              syncingDialogsAccountId === account.id
                            }
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.07] disabled:opacity-50"
                          >
                            <span>
                              <span className="block text-xs font-semibold text-white/80">
                                Аккаунт в отчётах
                              </span>
                              <span className="mt-1 block text-[11px] leading-4 text-white/40">
                                Влияет только на ежедневные и еженедельные отчёты.
                              </span>
                            </span>
                            <span
                              className={`h-6 w-11 shrink-0 rounded-full p-1 transition ${
                                account.is_active
                                  ? "bg-emerald-400/80"
                                  : "bg-white/15"
                              }`}
                            >
                              <span
                                className={`block h-4 w-4 rounded-full bg-white transition ${
                                  account.is_active
                                    ? "translate-x-5"
                                    : "translate-x-0"
                                }`}
                              />
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateIntegrationAccount(account.id, {
                                crmDialogsEnabled: !isCrmDialogsEnabled,
                              })
                            }
                            disabled={
                              updatingIntegrationId === account.id ||
                              connectingMessengerAccountId === account.id ||
                              syncingDialogsAccountId === account.id
                            }
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.07] disabled:opacity-50"
                          >
                            <span>
                              <span className="block text-xs font-semibold text-white/80">
                                Заявки в CRM
                              </span>
                              <span className="mt-1 block text-[11px] leading-4 text-white/40">
                                Можно выключить, не отключая отчёты по этому аккаунту.
                              </span>
                            </span>
                            <span
                              className={`h-6 w-11 shrink-0 rounded-full p-1 transition ${
                                isCrmDialogsEnabled
                                  ? "bg-emerald-400/80"
                                  : "bg-white/15"
                              }`}
                            >
                              <span
                                className={`block h-4 w-4 rounded-full bg-white transition ${
                                  isCrmDialogsEnabled
                                    ? "translate-x-5"
                                    : "translate-x-0"
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => connectAvitoMessenger(account.id)}
                          disabled={
                            !account.is_active ||
                            !isCrmDialogsEnabled ||
                            connectingMessengerAccountId === account.id ||
                            syncingDialogsAccountId === account.id ||
                            updatingIntegrationId === account.id
                          }
                          className="ml-2 mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
                        >
                          {connectingMessengerAccountId === account.id
                            ? "Подключаем..."
                            : "Подключить диалоги"}
                        </button>
                        <button
                          type="button"
                          onClick={() => syncAvitoDialogs(account.id)}
                          disabled={
                            !account.is_active ||
                            !isCrmDialogsEnabled ||
                            syncingDialogsAccountId === account.id ||
                            connectingMessengerAccountId === account.id ||
                            updatingIntegrationId === account.id
                          }
                          className="ml-2 mt-3 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-50"
                        >
                          {syncingDialogsAccountId === account.id
                            ? "Загружаем..."
                            : "Загрузить последние диалоги"}
                        </button>
                        </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })
    ) : (
      <>
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6">
        <div className="max-w-2xl">
          <div className="text-base font-semibold text-white">
            {archivedIntegrations.length > 0
              ? "Все Avito-проекты сейчас выключены"
              : "Avito-отчёты пока не подключены"}
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            {archivedIntegrations.length > 0
              ? "Можно вернуть проект в работу из архива ниже. История, настройки и аккаунты сохраняются."
              : "Подключи первый проект, добавь Avito-аккаунт и привяжи Telegram-беседу. После этого ежедневные и еженедельные отчёты будут приходить автоматически."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="#connect-avito"
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#07120F] transition hover:bg-emerald-300"
            >
              Подключить проект
            </a>
            <a
              href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
              target="_blank"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07]"
            >
              Открыть Telegram-бота
            </a>
          </div>
        </div>
      </div>
      <div className="hidden">
        {archivedIntegrations.length > 0
          ? "Все подключённые Avito-проекты сейчас в архиве."
          : "Пока нет подключённых Avito-проектов."}
      </div>
      </>
    )}
  </div>

  {archivedIntegrations.length > 0 ? (
    <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white/80">
            Архивные проекты
          </div>
          <div className="text-xs text-white/40">
            Здесь лежат проекты, по которым отчёты выключены. История и настройки сохранены.
          </div>
        </div>
        <div className="text-xs text-white/35">
          {archivedIntegrations.length} в архиве
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {archivedIntegrations.map((integration) => (
          <div
            key={integration.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="text-sm font-medium text-white/75">
                {integration.name}
              </div>
              <div className="mt-1 text-xs text-white/35">
                Аккаунтов: {integration.avito_report_accounts?.length ?? 0}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                updateIntegration(integration.id, {
                  isActive: true,
                  dailyEnabled: true,
                  weeklyEnabled: true,
                })
              }
              disabled={updatingIntegrationId === integration.id}
              className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
            >
              Вернуть в работу
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : null}
</div>

        <div id="project-analytics" className="rounded-[32px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Аналитика проекта</h2>
              <div className="mt-1 text-sm text-white/45">
                Выбери подключённый Avito-проект и период, чтобы посмотреть сохранённые метрики.
              </div>
            </div>

            <div className="w-full lg:w-[360px]">
              <label className="text-sm text-white/60">Проект для аналитики</label>
              <select
                value={selectedAnalyticsClientId}
                onChange={(event) => setSelectedAnalyticsClientId(event.target.value)}
                className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
              >
                <option value="">Выбери проект</option>
                {integrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="text-sm text-white/60">С даты</label>
              <input
                type="date"
                value={metricsPeriod.from}
                onChange={(event) =>
                  setMetricsPeriod((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-white/60">По дату</label>
              <input
                type="date"
                value={metricsPeriod.to}
                onChange={(event) =>
                  setMetricsPeriod((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                className="mt-2 h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
              />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={() => setMetricsPeriod(getLastDaysRange(7))}
                className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/70 transition hover:bg-white/[0.07]"
              >
                7 дней
              </button>
              <button
                type="button"
                onClick={() => setMetricsPeriod(getLastDaysRange(30))}
                className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/70 transition hover:bg-white/[0.07]"
              >
                30 дней
              </button>
              <button
                type="button"
                onClick={() => setMetricsPeriod(getCurrentMonthRange())}
                className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/70 transition hover:bg-white/[0.07]"
              >
                Месяц
              </button>
            </div>
          </div>

          {selectedAnalyticsIntegration ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/60">
                {selectedAnalyticsIntegration.is_active ? "Проект активен" : "Проект выключен"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/60">
                Daily {selectedAnalyticsIntegration.daily_reports_enabled ? "вкл" : "выкл"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/60">
                Weekly {selectedAnalyticsIntegration.weekly_reports_enabled ? "вкл" : "выкл"}
              </span>
            </div>
          ) : null}

          {metricsMessage ? (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {metricsMessage}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
            <div className="text-sm text-white/45">Просмотры</div>
            <div className="mt-3 text-2xl font-semibold text-white">
              {formatNumber(totals.views)}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
            <div className="text-sm text-white/45">Контакты</div>
            <div className="mt-3 text-2xl font-semibold text-emerald-300">
              {formatNumber(totals.contacts)}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
            <div className="text-sm text-white/45">Расходы</div>
            <div className="mt-3 text-2xl font-semibold text-amber-300">
              {formatMoney(totals.expenses)}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
            <div className="text-sm text-white/45">Конверсия</div>
            <div className="mt-3 text-2xl font-semibold text-violet-300">
              {formatPercent(totals.conversion)}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
            <div className="text-sm text-white/45">Цена контакта</div>
            <div className="mt-3 text-2xl font-semibold text-sky-300">
              {formatMoney(totals.costPerContact)}
            </div>
          </div>
        </div>

        <div id="metrics-dynamics" className="rounded-[32px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Динамика</h2>
              <div className="mt-1 text-sm text-white/45">
                Просмотры, контакты и расходы по дням
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-[320px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] text-white/45">
              Загружаем данные...
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-[320px] flex-col items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] text-center">
              <div className="text-lg font-medium text-white">Метрик пока нет</div>
              <div className="mt-2 max-w-md text-sm text-white/45">
                Данные появятся после первого ежедневного отчёта. Для быстрой проверки можно отправить тестовый отчёт в Telegram.
              </div>
              {selectedAnalyticsIntegration ? (
                <button
                  type="button"
                  onClick={() => sendTestReport(selectedAnalyticsIntegration)}
                  disabled={sendingTestReportId === selectedAnalyticsIntegration.id}
                  className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
                >
                  {sendingTestReportId === selectedAnalyticsIntegration.id
                    ? "Отправляем..."
                    : "Отправить тестовый отчёт"}
                </button>
              ) : null}
            </div>
          ) : (
            <AvitoChart data={data} />
          )}
        </div>

        <div id="reports-history" className="rounded-[32px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-6">
          <h2 className="text-lg font-semibold text-white">История отчётов</h2>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-white/45">
                <tr>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Просмотры</th>
                  <th className="px-4 py-3">Контакты</th>
                  <th className="px-4 py-3">Расходы</th>
                  <th className="px-4 py-3">Конверсия</th>
                  <th className="px-4 py-3">Цена контакта</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {data.map((item) => (
                  <tr key={item.id} className="text-white/75">
                    <td className="px-4 py-3">{item.period_start}</td>
                    <td className="px-4 py-3">{formatNumber(item.views)}</td>
                    <td className="px-4 py-3">{formatNumber(item.contacts)}</td>
                    <td className="px-4 py-3">{formatMoney(item.expenses)}</td>
                    <td className="px-4 py-3">{formatPercent(item.conversion)}</td>
                    <td className="px-4 py-3">{formatMoney(item.cost_per_contact)}</td>
                  </tr>
                ))}

                {!isLoading && data.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-white/45" colSpan={6}>
                      Нет сохранённых метрик за выбранный период
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isInstructionOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#121826] p-4 shadow-[0_24px_100px_rgba(0,0,0,0.6)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm text-white/45">Инструкция</div>
                <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                  Как настроить Avito Reports
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsInstructionOpen(false)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 hover:bg-white/[0.06] sm:w-auto"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 space-y-6 text-sm leading-6 text-white/65">
              <section>
                <h3 className="text-lg font-semibold text-white">Что делает этот раздел</h3>
                <p className="mt-2">
                  Avito Reports автоматически собирает статистику по объявлениям Avito,
                  считает просмотры, контакты, расходы, конверсию и цену контакта.
                  Потом система отправляет отчёты в Telegram и сохраняет метрики в RIVN OS.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">Какие отчёты приходят</h3>
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <b className="text-white">Daily отчёт</b>
                    <p className="mt-1">
                      Приходит каждый день. Показывает статистику за вчера:
                      просмотры, контакты, расходы, конверсию и стоимость одного контакта.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <b className="text-white">Weekly отчёт</b>
                    <p className="mt-1">
                      Приходит раз в неделю. Показывает статистику за прошлую календарную неделю
                      и сравнивает её с предыдущей неделей.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">Как подключить проект</h3>
                <ol className="mt-3 list-decimal space-y-3 pl-5">
                  <li>Сначала создай проект в RIVN OS, если его ещё нет.</li>
                  <li>Открой раздел Avito Reports.</li>
                  <li>В поле “Проект” выбери нужный проект клиента.</li>
                  <li>Заполни Avito user_id, client_id и client_secret.</li>
                  <li>Если у клиента несколько Avito-кабинетов, нажми “Добавить ещё Avito-аккаунт” и заполни данные каждого кабинета.</li>
                  <li>Включи daily и weekly отчёты, если они нужны.</li>
                  <li>Нажми “Подключить проект”.</li>
                  <li>После сохранения появится ссылка “Добавить бота в беседу клиента”.</li>
                  <li>Отправь эту ссылку клиенту или нажми сам, если ты уже состоишь в нужной беседе.</li>
                  <li>В Telegram выбери беседу, где общаются клиент и команда.</li>
                  <li>После добавления бота скопируй команду “/link@stat_rivnos_bot ...” из RIVN OS.</li>
                  <li>Отправь эту команду прямо в беседе. Бот напишет “Готово”.</li>
                  <li>После этого daily и weekly отчёты будут приходить в эту беседу.</li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">Как подключается Telegram</h3>
                <ol className="mt-3 list-decimal space-y-3 pl-5">
                  <li>
                    После нажатия “Подключить проект” RIVN OS создаёт специальную ссылку на бота{" "}
                    <a
                      href="https://t.me/stat_rivnos_bot"
                      target="_blank"
                      className="text-emerald-300 underline underline-offset-4"
                    >
                      @stat_rivnos_bot
                    </a>
                    .
                  </li>
                  <li>В ссылке спрятан уникальный код проекта. Благодаря этому бот понимает, к какому проекту относится беседа.</li>
                  <li>Основная ссылка открывает выбор Telegram-беседы. Это удобно для агентств: отчёты видят клиент, менеджер и команда.</li>
                  <li>Человек, который добавляет бота, должен иметь право добавлять участников в эту беседу.</li>
                  <li>После команды /link бот сохраняет chat_id беседы в RIVN OS. Вручную искать chat_id больше не нужно.</li>
                  <li>Если клиент случайно открыл ссылку в личке, бот не привяжет личный чат. Он подскажет команду, которую нужно отправить в беседе.</li>
                  <li>Если клиент уже написал боту без ссылки, можно использовать запасной способ: нажать “Запасной способ: выбрать chat_id” и выбрать нужный чат из свежих сообщений.</li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">Где взять Avito client_id и client_secret</h3>
                <ol className="mt-3 list-decimal space-y-3 pl-5">
                  <li>Открой браузер.</li>
                  <li>Авторизуйся в аккаунте Avito клиента.</li>
                  <li>
                    Перейди на страницу{" "}
                    <a
                      href="https://www.avito.ru/professionals/api"
                      target="_blank"
                      className="text-emerald-300 underline underline-offset-4"
                    >
                      https://www.avito.ru/professionals/api
                    </a>
                    .
                  </li>
                  <li>Скопируй client_id.</li>
                  <li>Скопируй client_secret.</li>
                  <li>Вставь эти данные в поля Avito Reports.</li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">Что важно помнить</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>client_secret — это секретный ключ, его нельзя публиковать.</li>
                  <li>Telegram-ссылку для беседы можно отправлять только тому клиенту, чей проект ты подключаешь.</li>
                  <li>Лучше добавлять бота именно в рабочую беседу с клиентом, чтобы отчёты видела вся команда.</li>
                  <li>Если проект уже привязан к одному Telegram-чату, бот не заменит чат автоматически. Это защита от случайной отправки отчётов не туда.</li>
                  <li>Если проект выключен, отчёты по нему не отправляются.</li>
                  <li>Если daily выключен, ежедневные отчёты не приходят.</li>
                  <li>Если weekly выключен, еженедельные отчёты не приходят.</li>
                  <li>Один проект может иметь несколько Avito-аккаунтов.</li>
                  <li>Расходы берутся напрямую из Avito API, а не вводятся вручную.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
