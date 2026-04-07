import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function diffInDays(targetDateString: string, today = new Date()) {
  const target = new Date(targetDateString);
  const safeTarget = startOfDay(target);
  const safeToday = startOfDay(today);

  const diffMs = safeToday.getTime() - safeTarget.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getReminderType(daysFromDueDate: number) {
  if (daysFromDueDate === 0) return "payment_due_0";
  if (daysFromDueDate === 1) return "payment_due_1";
  if (daysFromDueDate === 3) return "payment_due_3";
  if (daysFromDueDate === 7) return "payment_due_7";
  return null;
}

function buildReminderText(params: {
  clientName: string;
  projectName: string;
  amount: number;
  dueDate: string;
  daysFromDueDate: number;
}) {
  const projectLine = params.projectName
    ? `\nПроект: <b>${params.projectName}</b>`
    : "";

  const amountFormatted = `₽${params.amount.toLocaleString("ru-RU")}`;

  if (params.daysFromDueDate === 0) {
    return (
      `📌 <b>Напоминание по оплате</b>\n\n` +
      `Сегодня нужно проверить поступление оплаты.\n\n` +
      `Клиент: <b>${params.clientName}</b>${projectLine}\n` +
      `Сумма: <b>${amountFormatted}</b>\n` +
      `Дата оплаты: <b>${params.dueDate}</b>\n\n` +
      `Если клиент уже оплатил — отметь оплату в сервисе.`
    );
  }

  return (
    `⚠️ <b>Оплата не отмечена</b>\n\n` +
    `Проверь оплату и при необходимости напомни клиенту.\n\n` +
    `Клиент: <b>${params.clientName}</b>${projectLine}\n` +
    `Сумма: <b>${amountFormatted}</b>\n` +
    `Дата оплаты: <b>${params.dueDate}</b>\n` +
    `Просрочка: <b>${params.daysFromDueDate} дн.</b>\n\n` +
    `Если деньги уже пришли — отметь оплату в сервисе.`
  );
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Не хватает переменных окружения Supabase" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: telegramUsers, error: telegramUsersError } = await supabase
      .from("telegram_settings")
      .select("*")
      .eq("is_enabled", true)
      .eq("payment_reminders_enabled", true);

    if (telegramUsersError) {
      return NextResponse.json(
        { error: "Не удалось загрузить Telegram settings" },
        { status: 500 }
      );
    }

    if (!telegramUsers || telegramUsers.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        reason: "Нет пользователей с включёнными напоминаниями",
      });
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, client_id, project_id, due_date, amount, status")
      .neq("status", "paid");

    if (paymentsError) {
      return NextResponse.json(
        { error: "Не удалось загрузить платежи" },
        { status: 500 }
      );
    }

    const clientIds = Array.from(
      new Set((payments ?? []).map((item) => item.client_id).filter(Boolean))
    );

    const projectIds = Array.from(
      new Set((payments ?? []).map((item) => item.project_id).filter(Boolean))
    );

    const [{ data: clients, error: clientsError }, { data: projects, error: projectsError }] =
  await Promise.all([
    clientIds.length > 0
      ? supabase.from("clients").select("*").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

    if (clientsError) {
      return NextResponse.json(
        { error: "Не удалось загрузить клиентов" },
        { status: 500 }
      );
    }

    if (projectsError) {
      return NextResponse.json(
        { error: "Не удалось загрузить проекты" },
        { status: 500 }
      );
    }

    const clientsMap = new Map(
  (clients ?? []).map((client: any) => [
    client.id,
    client.name || client.clientName || client.title || "Без названия",
  ])
);

    const projectsMap = new Map(
      (projects ?? []).map((project: any) => [project.id, project.name || ""])
    );

    let sentCount = 0;
    let processedCount = 0;

    for (const userSettings of telegramUsers) {
      if (!userSettings.bot_token || !userSettings.chat_id) {
        continue;
      }

      for (const payment of payments ?? []) {
        processedCount += 1;

        const daysFromDueDate = diffInDays(payment.due_date);
        const reminderType = getReminderType(daysFromDueDate);

        if (!reminderType) continue;

        const entityId = payment.id;

        const { data: existingLog, error: logCheckError } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("user_id", userSettings.user_id)
          .eq("type", reminderType)
          .eq("entity_type", "payment")
          .eq("entity_id", entityId)
          .maybeSingle();

        if (logCheckError) {
          console.error("Ошибка проверки notification_logs:", logCheckError);
          continue;
        }

        if (existingLog) {
          continue;
        }

        const clientName = clientsMap.get(payment.client_id) ?? "Клиент";
        const projectName = payment.project_id
          ? projectsMap.get(payment.project_id) ?? ""
          : "";

        const text = buildReminderText({
          clientName,
          projectName,
          amount: Number(payment.amount || 0),
          dueDate: payment.due_date,
          daysFromDueDate,
        });

        try {
          await sendTelegramMessage({
            botToken: userSettings.bot_token,
            chatId: userSettings.chat_id,
            text,
          });

          await supabase.from("notification_logs").insert({
            user_id: userSettings.user_id,
            channel: "telegram",
            type: reminderType,
            entity_type: "payment",
            entity_id: entityId,
            status: "sent",
            message_preview: text,
          });

          sentCount += 1;
        } catch (sendError) {
          console.error("Ошибка отправки reminder в Telegram:", sendError);

          await supabase.from("notification_logs").insert({
            user_id: userSettings.user_id,
            channel: "telegram",
            type: reminderType,
            entity_type: "payment",
            entity_id: entityId,
            status: "failed",
            message_preview: text,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      sent: sentCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}