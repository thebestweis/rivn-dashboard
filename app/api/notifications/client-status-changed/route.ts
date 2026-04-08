import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

type ClientStatusChangedBody = {
  clientId: string;
  clientName: string;
  previousStatus: string;
  nextStatus: string;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "healthy":
      return "Всё хорошо";
    case "low_margin":
      return "Низкомаржинальный";
    case "problem":
      return "Проблемный";
    default:
      return status || "Неизвестно";
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "");
    const body = (await request.json()) as ClientStatusChangedBody;

    if (!body.clientId) {
      return NextResponse.json({ error: "Не передан clientId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Не найдены переменные окружения Supabase" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 401 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("telegram_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settingsError) {
      return NextResponse.json(
        { error: "Не удалось получить настройки Telegram" },
        { status: 500 }
      );
    }

    if (
      !settings?.is_enabled ||
      !settings?.analytics_status_changes_enabled ||
      !settings?.bot_token ||
      !settings?.chat_id
    ) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Уведомления по статусам выключены или Telegram не настроен",
      });
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const entityId = `${body.clientId}:${body.previousStatus}->${body.nextStatus}:${dateKey}`;

    const { data: existingLog, error: logCheckError } = await supabase
      .from("notification_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "analytics_status_changed")
      .eq("entity_type", "client")
      .eq("entity_id", entityId)
      .maybeSingle();

    if (logCheckError) {
      return NextResponse.json(
        { error: "Не удалось проверить лог уведомлений" },
        { status: 500 }
      );
    }

    if (existingLog) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Уведомление уже отправлялось",
      });
    }

    const text =
      `📉 <b>Изменился статус клиента</b>\n\n` +
      `Клиент: <b>${body.clientName}</b>\n` +
      `Было: <b>${getStatusLabel(body.previousStatus)}</b>\n` +
      `Стало: <b>${getStatusLabel(body.nextStatus)}</b>`;

    await sendTelegramMessage({
      botToken: settings.bot_token,
      chatId: settings.chat_id,
      text,
    });

    await supabase.from("notification_logs").insert({
      user_id: user.id,
      channel: "telegram",
      type: "analytics_status_changed",
      entity_type: "client",
      entity_id: entityId,
      status: "sent",
      message_preview: text,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}