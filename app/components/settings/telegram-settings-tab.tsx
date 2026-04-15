"use client";

import { useEffect, useState } from "react";
import {
  defaultTelegramSettings,
  getTelegramSettings,
  saveTelegramSettings,
  sendTelegramTestMessage,
  type TelegramSettings,
} from "@/app/lib/telegram-settings";
import { AppToast } from "../ui/app-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

const telegramSettingsQueryKey = ["telegram-settings"] as const;

export function TelegramSettingsTab() {
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<TelegramSettings>(
    defaultTelegramSettings
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const {
    data,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: telegramSettingsQueryKey,
    queryFn: getTelegramSettings,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data) return;
    setSettings(data);
    setHasLocalChanges(false);
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
    setHasLocalChanges(true);
  }

  async function handleSave() {
    try {
      setIsSaving(true);

      await saveTelegramSettings(settings);

      queryClient.setQueryData(telegramSettingsQueryKey, settings);
      setHasLocalChanges(false);

      setToastType("success");
      setToastMessage("Настройки Telegram сохранены");
    } catch (error) {
      setToastType("error");
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить настройки"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTest() {
    try {
      setIsSendingTest(true);

      await saveTelegramSettings(settings);
      queryClient.setQueryData(telegramSettingsQueryKey, settings);
      setHasLocalChanges(false);

      await sendTelegramTestMessage();

      setToastType("success");
      setToastMessage("Тестовое сообщение отправлено в Telegram");
    } catch (error) {
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

  const isBusy = isLoading || isSaving || isSendingTest;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-white/50">Telegram bot</div>
              <h2 className="mt-1 text-xl font-semibold">Интеграция Telegram</h2>
            </div>

            {isFetching && !isLoading ? (
              <div className="text-xs text-white/35">Обновляем данные...</div>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <label className="text-sm text-white/50">Bot token</label>
              <input
                type="password"
                value={settings.bot_token}
                onChange={(event) => updateField("bot_token", event.target.value)}
                placeholder="Вставь токен бота"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                disabled={isBusy}
              />
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-4">
              <label className="text-sm text-white/50">Chat ID</label>
              <input
                type="text"
                value={settings.chat_id}
                onChange={(event) => updateField("chat_id", event.target.value)}
                placeholder="Например: 511872773"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                disabled={isBusy}
              />
              <p className="mt-2 text-xs text-white/40">
                Для личного Telegram чата используй chat_id, который ты получил
                через getUpdates.
              </p>
            </div>

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
                  onClick={() => updateField("is_enabled", !settings.is_enabled)}
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
                disabled={isBusy || !hasLocalChanges}
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

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}