import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

type SalaryAccruedBody = {
  accrualMonth: string;
  employeesCount: number;
  totalAmount: string;
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "");
    const body = (await request.json()) as SalaryAccruedBody;

    if (!body.accrualMonth) {
      return NextResponse.json(
        { error: "Не передан accrualMonth" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 401 }
      );
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
      !settings?.event_notifications_enabled ||
      !settings?.bot_token ||
      !settings?.chat_id
    ) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Telegram выключен или не настроен",
      });
    }

    const entityId = `salary_accrued:${body.accrualMonth}`;

    const { data: existingLog, error: logCheckError } = await supabase
      .from("notification_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "salary_accrued")
      .eq("entity_type", "payroll")
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
      `💼 <b>Начислены оклады</b>\n\n` +
      `Месяц: <b>${body.accrualMonth}</b>\n` +
      `Сотрудников: <b>${body.employeesCount}</b>\n` +
      `Общая сумма: <b>${body.totalAmount}</b>`;

    await sendTelegramMessage({
      botToken: settings.bot_token,
      chatId: settings.chat_id,
      text,
    });

    await supabase.from("notification_logs").insert({
      user_id: user.id,
      channel: "telegram",
      type: "salary_accrued",
      entity_type: "payroll",
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