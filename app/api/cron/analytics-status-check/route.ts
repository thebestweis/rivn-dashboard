import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

type AnalyticsHealthStatus = "healthy" | "low_margin" | "problem";

function parseRubAmount(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const normalized = String(value).replace(/[^\d,-]/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toComparableDate(value: string) {
  if (!value) return "";

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return value;
}

function getNextAnalyticsStatus(params: {
  profit: number;
  margin: number | null;
  hasOverduePayment: boolean;
}) {
  if (params.hasOverduePayment || params.profit < 0) {
    return "problem" as AnalyticsHealthStatus;
  }

  if (params.margin !== null && params.margin < 20) {
    return "low_margin" as AnalyticsHealthStatus;
  }

  return "healthy" as AnalyticsHealthStatus;
}

function getStatusLabel(status: AnalyticsHealthStatus | string) {
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

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Не хватает переменных окружения Supabase" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [
      { data: telegramUsers, error: telegramUsersError },
      { data: clients, error: clientsError },
      { data: payments, error: paymentsError },
      { data: expenses, error: expensesError },
    ] = await Promise.all([
      supabase
        .from("telegram_settings")
        .select("*")
        .eq("is_enabled", true)
        .eq("analytics_status_changes_enabled", true),
      supabase.from("clients").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("expenses").select("*"),
    ]);

    if (telegramUsersError) {
      return NextResponse.json(
        { error: "Не удалось загрузить Telegram settings" },
        { status: 500 }
      );
    }

    if (clientsError) {
      return NextResponse.json(
        { error: "Не удалось загрузить клиентов" },
        { status: 500 }
      );
    }

    if (paymentsError) {
      return NextResponse.json(
        { error: "Не удалось загрузить платежи" },
        { status: 500 }
      );
    }

    if (expensesError) {
      return NextResponse.json(
        { error: "Не удалось загрузить расходы" },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        changed: 0,
        sent: 0,
      });
    }

    let changedCount = 0;
    let sentCount = 0;

    for (const client of clients) {
      const clientPayments = (payments ?? []).filter(
        (payment) => payment.client_id === client.id
      );

      const paidPayments = clientPayments.filter(
        (payment) => payment.status === "paid"
      );

      const clientExpenses = (expenses ?? []).filter(
        (expense) => expense.client_id === client.id
      );

      const revenue = paidPayments.reduce(
        (sum, payment) => sum + parseRubAmount(payment.amount),
        0
      );

      const expensesTotal = clientExpenses.reduce(
        (sum, expense) => sum + parseRubAmount(expense.amount),
        0
      );

      const profit = revenue - expensesTotal;
      const margin =
        revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : null;

      const hasOverduePayment = clientPayments.some((payment) => {
        if (payment.status === "paid") return false;
        if (!payment.due_date) return false;

        const normalized = toComparableDate(payment.due_date);
        if (!normalized) return false;

        const today = new Date();
        const due = new Date(normalized);

        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        return due < today;
      });

      const nextStatus = getNextAnalyticsStatus({
        profit,
        margin,
        hasOverduePayment,
      });

      const previousStatus = (client.analytics_status ||
        "healthy") as AnalyticsHealthStatus;

      if (previousStatus === nextStatus) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("clients")
        .update({
          analytics_status: nextStatus,
          analytics_status_updated_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (updateError) {
        console.error(
          "Ошибка обновления analytics_status клиента:",
          client.id,
          updateError
        );
        continue;
      }

      changedCount += 1;

      const dateKey = new Date().toISOString().slice(0, 10);
      const entityId = `${client.id}:${previousStatus}->${nextStatus}:${dateKey}`;

      for (const userSettings of telegramUsers ?? []) {
        if (!userSettings.bot_token || !userSettings.chat_id) {
          continue;
        }

        const { data: existingLog, error: logCheckError } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("user_id", userSettings.user_id)
          .eq("type", "analytics_status_changed")
          .eq("entity_type", "client")
          .eq("entity_id", entityId)
          .maybeSingle();

        if (logCheckError) {
          console.error(
            "Ошибка проверки notification_logs по статусу клиента:",
            logCheckError
          );
          continue;
        }

        if (existingLog) {
          continue;
        }

        const text =
          `📉 <b>Изменился статус клиента</b>\n\n` +
          `Клиент: <b>${client.name || "Без названия"}</b>\n` +
          `Было: <b>${getStatusLabel(previousStatus)}</b>\n` +
          `Стало: <b>${getStatusLabel(nextStatus)}</b>`;

        try {
          await sendTelegramMessage({
            botToken: userSettings.bot_token,
            chatId: userSettings.chat_id,
            text,
          });

          await supabase.from("notification_logs").insert({
            user_id: userSettings.user_id,
            channel: "telegram",
            type: "analytics_status_changed",
            entity_type: "client",
            entity_id: entityId,
            status: "sent",
            message_preview: text,
          });

          sentCount += 1;
        } catch (sendError) {
          console.error(
            "Ошибка отправки Telegram-уведомления по статусу клиента:",
            sendError
          );

          await supabase.from("notification_logs").insert({
            user_id: userSettings.user_id,
            channel: "telegram",
            type: "analytics_status_changed",
            entity_type: "client",
            entity_id: entityId,
            status: "failed",
            message_preview: text,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: clients.length,
      changed: changedCount,
      sent: sentCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}