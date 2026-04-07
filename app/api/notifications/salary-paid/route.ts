import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

type SalaryPaidBody = {
  payoutId: string;
  employeeName: string;
  amount: string;
  payoutDate: string;
  monthLabel: string;
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "");
    const body = (await request.json()) as SalaryPaidBody;

    if (!body.payoutId) {
      return NextResponse.json({ error: "Не передан payoutId" }, { status: 400 });
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

    const { data: existingLog, error: logCheckError } = await supabase
      .from("notification_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "salary_paid")
      .eq("entity_type", "payroll_payout")
      .eq("entity_id", body.payoutId)
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
      `💰 <b>Выплачена зарплата</b>\n\n` +
      `Сотрудник: <b>${body.employeeName}</b>\n` +
      `Сумма: <b>${body.amount}</b>\n` +
      `Дата выплаты: <b>${body.payoutDate}</b>\n` +
      `Период: <b>${body.monthLabel}</b>`;

    await sendTelegramMessage({
      botToken: settings.bot_token,
      chatId: settings.chat_id,
      text,
    });

    await supabase.from("notification_logs").insert({
      user_id: user.id,
      channel: "telegram",
      type: "salary_paid",
      entity_type: "payroll_payout",
      entity_id: body.payoutId,
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