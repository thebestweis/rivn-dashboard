import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { sendTelegramMessage } from "@/app/lib/notifications/telegram";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = await createClient();

    const today = new Date();
    const todayStr = formatDate(today);

    // 1. Получаем настройки Telegram
    const { data: settings } = await supabase
      .from("telegram_settings")
      .select("*");

    if (!settings || settings.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // 2. Получаем задачи
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*");

    if (error) {
      throw error;
    }

    let sent = 0;

    for (const userSettings of settings) {
      if (!userSettings.bot_token || !userSettings.chat_id) continue;

      const userTasks = tasks?.filter(
        (task) => task.user_id === userSettings.user_id
      );

      if (!userTasks || userTasks.length === 0) continue;

      const todayTasks = userTasks.filter(
        (task) =>
          task.deadline &&
          task.deadline.slice(0, 10) === todayStr &&
          task.status !== "done"
      );

      const overdueTasks = userTasks.filter(
        (task) =>
          task.deadline &&
          task.deadline.slice(0, 10) < todayStr &&
          task.status !== "done"
      );

      if (todayTasks.length === 0 && overdueTasks.length === 0) continue;

      let text = `📅 <b>Задачи на сегодня</b>\n\n`;

      if (todayTasks.length > 0) {
        todayTasks.forEach((task) => {
          text += `— ${task.title}\n`;
        });
      } else {
        text += "Нет задач на сегодня\n";
      }

      if (overdueTasks.length > 0) {
        text += `\n⚠️ <b>Просроченные задачи</b>\n\n`;
        overdueTasks.forEach((task) => {
          text += `— ${task.title}\n`;
        });
      }

      text += `\n👉 <a href="https://rivn-dashboard-rdq6.vercel.app/tasks">Открыть задачи</a>`;

      await sendTelegramMessage({
        botToken: userSettings.bot_token,
        chatId: userSettings.chat_id,
        text,
      });

      sent++;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Ошибка daily tasks" },
      { status: 500 }
    );
  }
}