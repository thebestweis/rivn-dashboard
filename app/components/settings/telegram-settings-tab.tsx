"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../../lib/supabase/client";
import {
  defaultTelegramSettings,
  getTelegramSettings,
  saveTelegramSettings,
  sendTelegramTestMessage,
  type TelegramSettings,
} from "@/app/lib/telegram-settings";
import { AppToast } from "../ui/app-toast";
import { queryKeys } from "../../lib/query-keys";

const notificationItems: Array<{
  key: keyof TelegramSettings;
  label: string;
}> = [
  { key: "reports_enabled", label: "Еженедельные и ежемесячные отчёты" },
  { key: "event_notifications_enabled", label: "Событийные уведомления" },
  { key: "payment_reminders_enabled", label: "Напоминания по оплатам" },
  { key: "task_reminders_enabled", label: "Напоминания по дедлайнам задач" },
  { key: "daily_task_digest_enabled", label: "Ежедневный список задач" },
  {
    key: "analytics_status_changes_enabled",
    label: "Изменения статусов клиентов в аналитике",
  },
];

type ChatDiscoveryResult = {
  success?: boolean;
  tokenValid?: boolean;
  botName?: string;
  botUsername?: string;
  botLink?: string;
  chatId?: string;
  chatType?: string;
  chatTitle?: string;
  lastMessageText?: string;
  lastMessageDate?: string | null;
  error?: string;
};

function formatChatType(value: string | undefined) {
  if (value === "private") return "Личный чат";
  if (value === "group") return "Группа";
  if (value === "supergroup") return "Супергруппа";
  if (value === "channel") return "Канал";
  return "Неизвестный тип";
}

function formatLastMessageDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU");
}

export function TelegramSettingsTab() {
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<TelegramSettings>(
    defaultTelegramSettings
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isDiscoveringChat, setIsDiscoveringChat] = useState(false);

  const [discoveryResult, setDiscoveryResult] =
    useState<ChatDiscoveryResult | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.telegramSettings,
    queryFn: getTelegramSettings,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  function updateField<K extends keyof TelegramSettings>(
    key: K,
    value: TelegramSettings[K]
  ) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function refreshTelegramSettings() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.telegramSettings,
    });
  }

  async function handleSave() {
    try {
      setIsSaving(true);

      await saveTelegramSettings(settings);
      await refreshTelegramSettings();

      setToastType("success");
      setToastMessage("Настройки Telegram успешно сохранены");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(
        error instanceof Error ? error.message : "Не удалось сохранить настройки"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTest() {
    try {
      setIsSendingTest(true);

      await saveTelegramSettings(settings);
      await sendTelegramTestMessage();
      await refreshTelegramSettings();

      setToastType("success");
      setToastMessage("Telegram полностью подключён");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Не удалось отправить тестовое сообщение"
      );
    } finally {
      setIsSendingTest(false);
    }
  }

  async function handleDiscoverChatId() {
    const botToken = settings.bot_token.trim();

    if (!botToken) {
      setToastType("error");
      setToastMessage("Сначала вставь bot token");
      return;
    }

    try {
      setIsDiscoveringChat(true);
      setDiscoveryResult(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Не удалось получить сессию пользователя");
      }

      const response = await fetch("/api/telegram/discover-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          botToken,
        }),
      });

      const result = (await response.json()) as ChatDiscoveryResult;

      setDiscoveryResult(result);

      if (!response.ok) {
        throw new Error(
          result.error || "Не удалось автоматически получить chat_id"
        );
      }

      const nextChatId = String(result.chatId ?? "").trim();

      if (!nextChatId) {
        throw new Error("Сервис не вернул chat_id");
      }

      setSettings((prev) => ({
        ...prev,
        chat_id: nextChatId,
      }));

      const nextSettings = {
        ...settings,
        chat_id: nextChatId,
      };

      await saveTelegramSettings(nextSettings);
      await refreshTelegramSettings();

      setToastType("success");
      setToastMessage("chat_id успешно найден, подставлен и сохранён");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Не удалось автоматически получить chat_id"
      );
    } finally {
      setIsDiscoveringChat(false);
    }
  }

  async function handleCopyBotLink() {
    const botLink = discoveryResult?.botLink?.trim();

    if (!botLink) {
      setToastType("error");
      setToastMessage("Ссылка на бота пока недоступна");
      return;
    }

    try {
      await navigator.clipboard.writeText(botLink);
      setToastType("success");
      setToastMessage("Ссылка на бота скопирована");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось скопировать ссылку");
    }
  }

  const isBusy = isLoading || isSaving || isSendingTest || isDiscoveringChat;
  const trimmedBotToken = settings.bot_token.trim();

  const canOpenBot = useMemo(() => {
    return Boolean(discoveryResult?.botLink);
  }, [discoveryResult]);

  const connectionStatus = useMemo(() => {
    if (!trimmedBotToken) {
      return {
        label: "Бот ещё не настроен",
        className: "bg-white/10 text-white/50",
      };
    }

    if (discoveryResult?.tokenValid && settings.chat_id.trim()) {
      return {
        label: "Telegram подключён",
        className: "bg-emerald-500/20 text-emerald-200",
      };
    }

    if (discoveryResult?.tokenValid) {
      return {
        label: "Токен валиден, нужен chat_id",
        className: "bg-violet-500/15 text-violet-200",
      };
    }

    return {
      label: "Нужно проверить подключение",
      className: "bg-amber-500/15 text-amber-300",
    };
  }, [trimmedBotToken, discoveryResult, settings.chat_id]);

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-white/50">Telegram bot</div>
              <h2 className="mt-1 text-xl font-semibold">
                Интеграция Telegram
              </h2>
            </div>

            <div
              className={`rounded-full px-3 py-1 text-xs font-medium ${connectionStatus.className}`}
            >
              {connectionStatus.label}
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-violet-400/15 bg-violet-500/[0.08] p-4">
            <div className="text-sm font-medium text-violet-200">
              Быстрое подключение
            </div>

            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/70">
              <li>
                Создай нового бота через{" "}
                <span className="text-white">@BotFather</span> и скопируй его{" "}
                <span className="text-white">bot token</span>.
              </li>
              <li>Вставь bot token в поле ниже.</li>
              <li>
                Нажми{" "}
                <span className="text-white">
                  «Получить chat_id автоматически»
                </span>
                .
              </li>
              <li>
                Если бот уже определится, открой его в Telegram, нажми{" "}
                <span className="text-white">Start</span> или отправь любое
                сообщение.
              </li>
              <li>
                Вернись сюда и ещё раз нажми{" "}
                <span className="text-white">
                  «Получить chat_id автоматически»
                </span>
                .
              </li>
              <li>После этого можно сразу отправить тест.</li>
            </ol>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <label className="text-sm text-white/50">Bot token</label>
              <input
                type="password"
                value={settings.bot_token}
                onChange={(event) =>
                  updateField("bot_token", event.target.value)
                }
                placeholder="Вставь токен бота из BotFather"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                disabled={isBusy}
              />

              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                >
                  Открыть BotFather
                </a>

                <button
                  type="button"
                  onClick={handleDiscoverChatId}
                  disabled={isBusy || !trimmedBotToken}
                  className="rounded-2xl border border-violet-400/20 bg-violet-500/15 px-4 py-3 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDiscoveringChat
                    ? "Проверяем бота и ищем chat_id..."
                    : "Получить chat_id автоматически"}
                </button>

                {canOpenBot ? (
                  <>
                    <a
                      href={discoveryResult?.botLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/18"
                    >
                      Открыть бота в Telegram
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyBotLink}
                      disabled={isBusy}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Скопировать ссылку
                    </button>
                  </>
                ) : null}
              </div>

              <p className="mt-3 text-xs leading-5 text-white/40">
                Система сначала проверит токен бота, а затем попробует найти
                chat_id по последнему сообщению, которое пришло этому боту.
              </p>
            </div>

            {discoveryResult?.tokenValid ? (
              <div className="rounded-2xl border border-violet-400/10 bg-violet-500/[0.05] p-4">
                <div className="text-sm font-medium text-violet-200">
                  Информация о боте
                </div>

                <div className="mt-3 grid gap-3 text-sm text-white/75 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                      Имя бота
                    </div>
                    <div className="mt-1">{discoveryResult.botName || "—"}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                      Username
                    </div>
                    <div className="mt-1">
                      {discoveryResult.botUsername
                        ? `@${discoveryResult.botUsername}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!discoveryResult?.chatId && discoveryResult?.tokenValid ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">
                Открой бота и отправь ему любое сообщение, например{" "}
                <span className="text-white">start</span>, затем нажми кнопку
                получения chat_id ещё раз.
              </div>
            ) : null}

            <details className="rounded-2xl bg-white/[0.04] p-4">
              <summary className="cursor-pointer text-sm text-white/60">
                Расширенные настройки (chat_id)
              </summary>

              <div className="mt-4">
                <label className="text-sm text-white/50">Chat ID</label>
                <input
                  type="text"
                  value={settings.chat_id}
                  onChange={(event) =>
                    updateField("chat_id", event.target.value)
                  }
                  placeholder="Например: 511872773"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                  disabled={isBusy}
                />

                <p className="mt-2 text-xs text-white/40">
                  Обычно поле заполняется автоматически. Вручную вводить нужно
                  только в редких случаях.
                </p>
              </div>
            </details>

            {discoveryResult?.chatId ? (
              <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.06] p-4">
                <div className="text-sm font-medium text-emerald-200">
                  Найденный чат
                </div>

                <div className="mt-3 grid gap-3 text-sm text-white/75 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                      Чат
                    </div>
                    <div className="mt-1">
                      {discoveryResult.chatTitle || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                      Тип
                    </div>
                    <div className="mt-1">
                      {formatChatType(discoveryResult.chatType)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                      chat_id
                    </div>
                    <div className="mt-1 break-all">
                      {discoveryResult.chatId || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                      Последнее сообщение
                    </div>
                    <div className="mt-1">
                      {formatLastMessageDate(discoveryResult.lastMessageDate)}
                    </div>
                  </div>
                </div>

                {discoveryResult.lastMessageText ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/65">
                    {discoveryResult.lastMessageText}
                  </div>
                ) : null}
              </div>
            ) : null}

            {discoveryResult?.error && !discoveryResult.chatId ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200">
                {discoveryResult.error}
              </div>
            ) : null}

            <div className="rounded-2xl bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-white/80">
                    Включить Telegram уведомления
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Главный переключатель для всех Telegram уведомлений
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateField("is_enabled", !settings.is_enabled)
                  }
                  disabled={isBusy}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                    settings.is_enabled
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {settings.is_enabled ? "Включено" : "Выключено"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isBusy}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-5 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>

              <button
                type="button"
                onClick={handleSendTest}
                disabled={isBusy}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingTest ? "Отправляем..." : "Отправить тест"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Notifications</div>
          <h2 className="mt-1 text-xl font-semibold">Типы уведомлений</h2>

          <div className="mt-5 space-y-3">
            {notificationItems.map((item) => {
              const enabled = Boolean(settings[item.key]);

              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
                >
                  <span className="max-w-[70%] text-sm text-white/80">
                    {item.label}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      updateField(
                        item.key,
                        (!enabled) as TelegramSettings[typeof item.key]
                      )
                    }
                    disabled={isBusy}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      enabled
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {enabled ? "on" : "off"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toastMessage ? (
        <AppToast message={toastMessage} type={toastType} />
      ) : null}
    </>
  );
}