import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "");

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

    if (!settings?.bot_token || !settings?.chat_id) {
      return NextResponse.json(
        { error: "Сначала заполни bot token и chat_id в настройках" },
        { status: 400 }
      );
    }

    const text =
      "✅ Тестовое сообщение из RIVN Control\n\nTelegram подключен корректно.";

    await sendTelegramMessage({
      botToken: settings.bot_token,
      chatId: settings.chat_id,
      text,
    });

    await supabase.from("notification_logs").insert({
      user_id: user.id,
      channel: "telegram",
      type: "telegram_test",
      entity_type: "system",
      entity_id: "telegram_test",
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