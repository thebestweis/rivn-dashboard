"use client";

import { useEffect, useMemo, useState } from "react";
import { AvitoChart } from "@/app/components/avito/avito-chart";
import { getAvitoMetrics } from "@/app/lib/supabase/avito-metrics";
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
    is_active: boolean;
  }[];
};

type TelegramChat = {
  chatId: string;
  title: string;
  username: string | null;
  type: string;
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

  const { workspace } = useAppContextState();

  useEffect(() => {
    async function load() {
      try {
        if (!workspace?.id) {
  return;
}
        const [metricsResult, integrationsResponse] = await Promise.all([
          getAvitoMetrics({
            clientId: "c72e0d95-b777-47d4-9e60-2dd39865e519",
            from: "2026-04-01",
            to: "2026-04-30",
          }),
          fetch(`/api/avito/integrations?workspaceId=${workspace?.id ?? ""}`, {
  cache: "no-store",
}),
        ]);

        const integrationsData = await integrationsResponse.json();

        setData(metricsResult as AvitoMetric[]);

        if (integrationsData.ok) {
          setProjects(integrationsData.projects ?? []);
setIntegrations(integrationsData.integrations ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [workspace?.id]);

  const selectedProject = projects.find((project) => project.id === projectId);

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

  return (
    
    <main className="flex-1">
      <div className="space-y-6 px-5 py-6 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm text-white/45">Авито-аналитика</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Avito Reports
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                Подключай проекты к Avito API, получай ежедневные и еженедельные Telegram-отчёты, сохраняй метрики и смотри динамику в RIVN OS.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsInstructionOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
              >
                Инструкция
              </button>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                Реальные расходы из Avito API
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-white">Подключить проект к Avito</h2>
            <p className="text-sm text-white/45">
              Выбери проект из RIVN OS и добавь Avito-аккаунты. После сохранения система даст готовую ссылку для Telegram-бота.
            </p>
          </div>

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
                className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-5 flex items-center justify-between gap-3">
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
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white"
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
              className="rounded-2xl bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
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
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
  <div>
    <h2 className="text-lg font-semibold text-white">Подключённые проекты</h2>
    <div className="mt-1 text-sm text-white/45">
      Здесь отображаются проекты, для которых уже настроены Avito-отчёты.
    </div>
  </div>

  <div className="mt-5 space-y-3">
    {integrations.length > 0 ? (
      integrations.map((integration) => {
        const integrationAccounts = integration.avito_report_accounts ?? [];

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
                {integration.client_code ? (
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

                <span
                  className={`rounded-full border px-3 py-1 ${
                    integration.daily_reports_enabled
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-white/40"
                  }`}
                >
                  Daily {integration.daily_reports_enabled ? "вкл" : "выкл"}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 ${
                    integration.weekly_reports_enabled
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.04] text-white/40"
                  }`}
                >
                  Weekly {integration.weekly_reports_enabled ? "вкл" : "выкл"}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 ${
                    integration.is_active
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : "border-rose-400/20 bg-rose-400/10 text-rose-300"
                  }`}
                >
                  {integration.is_active ? "Активен" : "Выключен"}
                </span>
              </div>
            </div>

            {integrationAccounts.length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {integrationAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white/65"
                  >
                    <div className="font-medium text-white">{account.name}</div>
                    <div className="mt-1 text-xs text-white/40">
                      Avito user_id: {account.avito_user_id || "не указан"}
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      {account.is_active ? "Аккаунт активен" : "Аккаунт выключен"}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })
    ) : (
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45">
        Пока нет подключённых Avito-проектов.
      </div>
    )}
  </div>
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

        <div className="rounded-[32px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
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
              <div className="text-lg font-medium text-white">Данных пока нет</div>
              <div className="mt-2 max-w-md text-sm text-white/45">
                Запусти daily-report за период или проверь, что записи появились в avito_report_metrics.
              </div>
            </div>
          ) : (
            <AvitoChart data={data} />
          )}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
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
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#121826] p-6 shadow-[0_24px_100px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-white/45">Инструкция</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Как настроить Avito Reports
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsInstructionOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 hover:bg-white/[0.06]"
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
