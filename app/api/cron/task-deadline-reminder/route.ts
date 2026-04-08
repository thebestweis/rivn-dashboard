import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

function isWithinNextHour(date: Date, now: Date) {
  const diff = date.getTime() - now.getTime();
  return diff > 0 && diff <= 60 * 60 * 1000;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [
      { data: tasks },
      { data: users },
    ] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase
        .from("telegram_settings")
        .select("*")
        .eq("is_enabled", true)
        .eq("tasks_enabled", true),
    ]);

    const now = new Date();

    const upcomingTasks = (tasks ?? []).filter((task) => {
      if (!task.deadline) return false;
      if (task.status === "done") return false;

      const deadline = new Date(task.deadline);
      return isWithinNextHour(deadline, now);
    });

    let sent = 0;

    for (const task of upcomingTasks) {
      const deadline = new Date(task.deadline);
      const entityId = `task_deadline:${task.id}`;

      for (const user of users ?? []) {
        if (!user.bot_token || !user.chat_id) continue;

        const { data: existing } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("type", "task_deadline")
          .eq("entity_id", entityId)
          .eq("user_id", user.user_id)
          .maybeSingle();

        if (existing) continue;

        const text =
          `⏰ <b>Скоро дедлайн задачи</b>\n\n` +
          `📌 ${task.title}\n` +
          `🕒 Дедлайн: <b>${formatTime(deadline)}</b>\n\n` +
          `Остался ~1 час`;

        try {
          await sendTelegramMessage({
            botToken: user.bot_token,
            chatId: user.chat_id,
            text,
          });

          await supabase.from("notification_logs").insert({
            user_id: user.user_id,
            type: "task_deadline",
            entity_type: "task",
            entity_id: entityId,
            channel: "telegram",
            status: "sent",
          });

          sent++;
        } catch (e) {
          await supabase.from("notification_logs").insert({
            user_id: user.user_id,
            type: "task_deadline",
            entity_type: "task",
            entity_id: entityId,
            channel: "telegram",
            status: "failed",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: upcomingTasks.length,
      sent,
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Ошибка",
    });
  }
}