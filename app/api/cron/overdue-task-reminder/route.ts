import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

function startOfMinute(date: Date) {
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  return copy;
}

function diffInDays(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      { data: tasks, error: tasksError },
      { data: telegramUsers, error: telegramUsersError },
    ] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase
        .from("telegram_settings")
        .select("*")
        .eq("is_enabled", true)
        .eq("task_reminders_enabled", true),
    ]);

    if (tasksError) {
      return NextResponse.json(
        { error: "Не удалось загрузить tasks" },
        { status: 500 }
      );
    }

    if (telegramUsersError) {
      return NextResponse.json(
        { error: "Не удалось загрузить telegram_settings" },
        { status: 500 }
      );
    }

    const now = startOfMinute(new Date());

    const overdueTasks = (tasks ?? []).filter((task) => {
      if (!task.deadline) return false;
      if (task.status === "done") return false;

      const deadline = new Date(task.deadline);
      if (Number.isNaN(deadline.getTime())) return false;

      return deadline < now;
    });

    let sent = 0;

    for (const task of overdueTasks) {
      const deadline = new Date(task.deadline);
      const overdueDays = Math.max(0, diffInDays(deadline, now));
      const entityId = `task_overdue:${task.id}`;

      for (const user of telegramUsers ?? []) {
        if (!user.bot_token || !user.chat_id) continue;

        const { data: existingLog, error: logCheckError } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("user_id", user.user_id)
          .eq("type", "task_overdue")
          .eq("entity_type", "task")
          .eq("entity_id", entityId)
          .maybeSingle();

        if (logCheckError) {
          console.error("Ошибка проверки task_overdue log:", logCheckError);
          continue;
        }

        if (existingLog) {
          continue;
        }

        const text =
          `🚨 <b>Задача просрочена</b>\n\n` +
          `📌 ${task.title}\n` +
          `🕒 Дедлайн: <b>${formatDateTime(deadline)}</b>\n` +
          `⏳ Просрочка: <b>${overdueDays} дн.</b>\n\n` +
          `Проверь задачу и обнови статус в сервисе.`;

        try {
          await sendTelegramMessage({
            botToken: user.bot_token,
            chatId: user.chat_id,
            text,
          });

          await supabase.from("notification_logs").insert({
            user_id: user.user_id,
            type: "task_overdue",
            entity_type: "task",
            entity_id: entityId,
            channel: "telegram",
            status: "sent",
            message_preview: text,
          });

          sent += 1;
        } catch (sendError) {
          console.error("Ошибка отправки task_overdue:", sendError);

          await supabase.from("notification_logs").insert({
            user_id: user.user_id,
            type: "task_overdue",
            entity_type: "task",
            entity_id: entityId,
            channel: "telegram",
            status: "failed",
            message_preview: text,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: overdueTasks.length,
      sent,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ошибка overdue-task-reminder",
      },
      { status: 500 }
    );
  }
}