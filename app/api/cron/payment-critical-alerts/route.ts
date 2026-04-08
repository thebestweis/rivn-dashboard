import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = startOfDay(new Date());

    const [{ data: payments }, { data: telegramUsers }] = await Promise.all([
      supabase.from("payments").select("*"),
      supabase
        .from("telegram_settings")
        .select("*")
        .eq("is_enabled", true),
    ]);

    const overduePayments = (payments ?? []).filter((p) => {
      if (!p.due_date) return false;
      if (p.status === "paid") return false;

      const due = new Date(p.due_date);
      return due < today;
    });

    const alerts = overduePayments
      .map((p) => {
        const due = new Date(p.due_date);
        const diffTime = today.getTime() - due.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (daysOverdue < 3) return null;

        let level: "warning" | "critical" = "warning";

        if (daysOverdue >= 7) {
          level = "critical";
        }

        return {
          ...p,
          daysOverdue,
          level,
        };
      })
      .filter(Boolean) as any[];

    if (alerts.length === 0) {
      return NextResponse.json({ success: true, message: "no alerts" });
    }

    for (const user of telegramUsers ?? []) {
      if (!user.bot_token || !user.chat_id) continue;

      const message =
        `🚨 <b>Критические оплаты</b>\n\n` +
        alerts
          .slice(0, 10)
          .map((p) => {
            const emoji = p.level === "critical" ? "🚨" : "⚠️";

            return `${emoji} <b>${p.client_name ?? "Клиент"}</b>\n` +
              `— ${Math.round(Number(p.amount)).toLocaleString("ru-RU")} ₽\n` +
              `— просрочка: ${p.daysOverdue} дн.`;
          })
          .join("\n\n");

      await sendTelegramMessage({
        botToken: user.bot_token,
        chatId: user.chat_id,
        text: message,
      });
    }

    return NextResponse.json({ success: true, alertsCount: alerts.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}