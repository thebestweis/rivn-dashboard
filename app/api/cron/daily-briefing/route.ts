import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toISO(date: Date) {
  return date.toISOString();
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [
      { data: tasks },
      { data: payments },
      { data: telegramUsers },
    ] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("payments").select("*"),
      supabase
        .from("telegram_settings")
        .select("*")
        .eq("is_enabled", true),
    ]);

    // --- TASKS ---
    const todayTasks = (tasks ?? []).filter((task) => {
      if (!task.deadline) return false;
      const d = new Date(task.deadline);
      return d >= todayStart && d <= todayEnd && task.status !== "done";
    });

    const overdueTasks = (tasks ?? []).filter((task) => {
      if (!task.deadline) return false;
      const d = new Date(task.deadline);
      return d < todayStart && task.status !== "done";
    });

    // --- PAYMENTS ---
    const todayPayments = (payments ?? []).filter((p) => {
      if (!p.due_date) return false;
      const d = new Date(p.due_date);
      return d >= todayStart && d <= todayEnd;
    });

    const overduePayments = (payments ?? []).filter((p) => {
      if (!p.due_date) return false;
      if (p.status === "paid") return false;
      const d = new Date(p.due_date);
      return d < todayStart;
    });

    // --- TOP PROBLEMS ---
    const topDebtors = overduePayments
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 2);

    for (const user of telegramUsers ?? []) {
      if (!user.bot_token || !user.chat_id) continue;

            const todayTasksBlock =
        todayTasks.length > 0
          ? todayTasks
              .map((task) => `— ${task.title || "Без названия"}`)
              .join("\n")
          : "— На сегодня задач нет";

      const overdueTasksBlock =
        overdueTasks.length > 0
          ? overdueTasks
              .slice(0, 10)
              .map((task) => `— ${task.title || "Без названия"}`)
              .join("\n")
          : "— Просроченных задач нет";

      const text =
        `🌅 <b>Утренний отчёт</b>\n\n` +
        `📅 <b>Сегодня:</b>\n` +
        `— задачи: <b>${todayTasks.length}</b>\n` +
        `— просрочено: <b>${overdueTasks.length}</b>\n\n` +
        `📝 <b>Текущие задачи:</b>\n` +
        `${todayTasksBlock}\n\n` +
        `🚨 <b>Просроченные задачи:</b>\n` +
        `${overdueTasksBlock}\n\n` +
        `💰 <b>Финансы:</b>\n` +
        `— оплаты сегодня: <b>${todayPayments.length}</b>\n` +
        `— просрочено оплат: <b>${overduePayments.length}</b>\n\n` +
                `🔥 <b>Фокус:</b>\n` +
        (topDebtors.length > 0
          ? topDebtors
              .map(
                (d) =>
                  `— ${d.client_name ?? "Клиент"} (${Math.round(
                    Number(d.amount)
                  ).toLocaleString("ru-RU")} ₽)`
              )
              .join("\n")
          : "— критичных зон нет") +
        `\n\n` +
        `👉 <a href="https://rivn-dashboard-rdq6.vercel.app/tasks">Открыть задачи</a>` +
        `\n\nПоехали работать 👊`;

      await sendTelegramMessage({
        botToken: user.bot_token,
        chatId: user.chat_id,
        text,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}