import { createClient } from "@/app/lib/supabase/client";

export type TelegramSettings = {
  bot_token: string;
  chat_id: string;
  is_enabled: boolean;
  reports_enabled: boolean;
  event_notifications_enabled: boolean;
  payment_reminders_enabled: boolean;
  task_reminders_enabled: boolean;
  daily_task_digest_enabled: boolean;
  analytics_status_changes_enabled: boolean;
};

export const defaultTelegramSettings: TelegramSettings = {
  bot_token: "",
  chat_id: "",
  is_enabled: false,
  reports_enabled: true,
  event_notifications_enabled: true,
  payment_reminders_enabled: true,
  task_reminders_enabled: true,
  daily_task_digest_enabled: true,
  analytics_status_changes_enabled: true,
};

export async function getTelegramSettings() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const { data, error } = await supabase
    .from("telegram_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Не удалось загрузить настройки Telegram");
  }

  if (!data) {
    return defaultTelegramSettings;
  }

  return {
    bot_token: data.bot_token ?? "",
    chat_id: data.chat_id ?? "",
    is_enabled: data.is_enabled ?? false,
    reports_enabled: data.reports_enabled ?? true,
    event_notifications_enabled: data.event_notifications_enabled ?? true,
    payment_reminders_enabled: data.payment_reminders_enabled ?? true,
    task_reminders_enabled: data.task_reminders_enabled ?? true,
    daily_task_digest_enabled: data.daily_task_digest_enabled ?? true,
    analytics_status_changes_enabled: data.analytics_status_changes_enabled ?? true,
  };
}

export async function saveTelegramSettings(settings: TelegramSettings) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const { error } = await supabase.from("telegram_settings").upsert(
    {
      user_id: user.id,
      ...settings,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw new Error(error.message || "Не удалось сохранить настройки Telegram");
  }
}

export async function sendTelegramTestMessage() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Нет access token");
  }

  const response = await fetch("/api/telegram/test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Не удалось отправить тестовое сообщение");
  }

  return data;
}