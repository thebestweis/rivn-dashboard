import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

function parseRubAmount(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const normalized = String(value).replace(/[^\d,-]/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

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

function isBetween(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function calcGrowth(current: number, previous: number) {
  if (previous === 0 && current > 0) return 100;
  if (previous === 0 && current === 0) return 0;

  return ((current - previous) / previous) * 100;
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function formatPercent(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function getTrendEmoji(value: number) {
  return value >= 0 ? "✅" : "❌";
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
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
      { data: payments, error: paymentsError },
      { data: expenses, error: expensesError },
      { data: payrollPayouts, error: payrollError },
      { data: telegramUsers, error: telegramUsersError },
      { data: clients, error: clientsError },
    ] = await Promise.all([
      supabase.from("payments").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("payroll_payouts").select("*"),
      supabase
        .from("telegram_settings")
        .select("*")
        .eq("is_enabled", true)
        .eq("reports_enabled", true),
      supabase.from("clients").select("id, name"),
    ]);

    if (paymentsError) {
      return NextResponse.json(
        { error: "Не удалось загрузить payments" },
        { status: 500 }
      );
    }

    if (expensesError) {
      return NextResponse.json(
        { error: "Не удалось загрузить expenses" },
        { status: 500 }
      );
    }

    if (payrollError) {
      return NextResponse.json(
        { error: "Не удалось загрузить payroll_payouts" },
        { status: 500 }
      );
    }

    if (telegramUsersError) {
      return NextResponse.json(
        { error: "Не удалось загрузить telegram_settings" },
        { status: 500 }
      );
    }

    if (clientsError) {
      return NextResponse.json(
        { error: "Не удалось загрузить clients" },
        { status: 500 }
      );
    }

    const now = new Date();

    // Текущий месяц, в котором запускается cron
    const thisMonth = getMonthRange(now);

    // Отчётный месяц = прошлый календарный месяц
    const lastMonthDate = new Date(thisMonth.start.getTime() - 1);
    const lastMonth = getMonthRange(lastMonthDate);

    // Сравнение = месяц до него
    const prevMonthDate = new Date(lastMonth.start.getTime() - 1);
    const prevMonth = getMonthRange(prevMonthDate);

    const currentStart = lastMonth.start;
    const currentEnd = lastMonth.end;
    const prevStart = prevMonth.start;
    const prevEnd = prevMonth.end;

    const clientsMap = new Map(
      (clients ?? []).map((client) => [client.id, client.name || "Без названия"])
    );

    const paidPayments = (payments ?? []).filter((payment) => payment.status === "paid");

    const getPaymentsStats = (start: Date, end: Date) => {
      const filtered = paidPayments.filter((payment) => {
        if (!payment.paid_date) return false;
        const d = startOfDay(new Date(payment.paid_date));
        return isBetween(d, startOfDay(start), startOfDay(end));
      });

      return {
        revenue: filtered.reduce(
          (sum, payment) => sum + parseRubAmount(payment.amount),
          0
        ),
        count: filtered.length,
        items: filtered,
      };
    };

    const getExpensesTotal = (start: Date, end: Date) => {
      return (expenses ?? [])
        .filter((expense) => {
          if (!expense.expense_date) return false;
          const d = startOfDay(new Date(expense.expense_date));
          return isBetween(d, startOfDay(start), startOfDay(end));
        })
        .reduce((sum, expense) => sum + parseRubAmount(expense.amount), 0);
    };

    const getFotTotal = (start: Date, end: Date) => {
      return (payrollPayouts ?? [])
        .filter((payout) => {
          const rawDate = payout.payout_date ?? payout.payoutDate;
          if (!rawDate) return false;
          const d = startOfDay(new Date(rawDate));
          return isBetween(d, startOfDay(start), startOfDay(end));
        })
        .reduce((sum, payout) => sum + parseRubAmount(payout.amount), 0);
    };

    const currentPayments = getPaymentsStats(currentStart, currentEnd);
    const prevPayments = getPaymentsStats(prevStart, prevEnd);

    const currentExpenses = getExpensesTotal(currentStart, currentEnd);
    const prevExpenses = getExpensesTotal(prevStart, prevEnd);

    const currentFot = getFotTotal(currentStart, currentEnd);
    const prevFot = getFotTotal(prevStart, prevEnd);

    const currentProfit =
      currentPayments.revenue - currentExpenses - currentFot;

    const prevProfit =
      prevPayments.revenue - prevExpenses - prevFot;

    const revenueGrowth = calcGrowth(currentPayments.revenue, prevPayments.revenue);
    const profitGrowth = calcGrowth(currentProfit, prevProfit);
    const expensesGrowth = calcGrowth(currentExpenses, prevExpenses);
    const fotGrowth = calcGrowth(currentFot, prevFot);
    const paymentsCountGrowth = calcGrowth(currentPayments.count, prevPayments.count);

    const topClientsMap = currentPayments.items.reduce<Record<string, number>>(
      (acc, payment) => {
        const clientName =
          clientsMap.get(payment.client_id) || "Неизвестный клиент";

        acc[clientName] = (acc[clientName] || 0) + parseRubAmount(payment.amount);
        return acc;
      },
      {}
    );

    const topClients = Object.entries(topClientsMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const periodLabel = formatMonthLabel(currentStart);

    const topClientsBlock =
      topClients.length > 0
        ? `\n\n🏆 <b>Топ клиенты месяца</b>\n` +
          topClients
            .map(
              (client, index) =>
                `${index + 1}. ${client.name} — <b>${formatMoney(client.revenue)}</b>`
            )
            .join("\n")
        : "";

    const text =
      `📊 <b>Месячный отчёт</b>\n` +
      `<b>${periodLabel}</b>\n\n` +
      `${getTrendEmoji(revenueGrowth)} Выручка: <b>${formatMoney(
        currentPayments.revenue
      )}</b> (${formatPercent(revenueGrowth)})\n` +
      `${getTrendEmoji(profitGrowth)} Прибыль: <b>${formatMoney(
        currentProfit
      )}</b> (${formatPercent(profitGrowth)})\n` +
      `${getTrendEmoji(expensesGrowth)} Расходы: <b>${formatMoney(
        currentExpenses
      )}</b> (${formatPercent(expensesGrowth)})\n` +
      `${getTrendEmoji(fotGrowth)} ФОТ: <b>${formatMoney(
        currentFot
      )}</b> (${formatPercent(fotGrowth)})\n` +
      `${getTrendEmoji(paymentsCountGrowth)} Оплаты: <b>${
        currentPayments.count
      }</b> (${formatPercent(paymentsCountGrowth)})` +
      topClientsBlock;

    let sent = 0;
    const monthKey = `${currentStart.getFullYear()}-${String(
      currentStart.getMonth() + 1
    ).padStart(2, "0")}`;

    for (const user of telegramUsers ?? []) {
      if (!user.bot_token || !user.chat_id) continue;

      const entityId = `monthly_report:${monthKey}`;

      const { data: existingLog, error: logCheckError } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("type", "monthly_report")
        .eq("entity_type", "report")
        .eq("entity_id", entityId)
        .maybeSingle();

      if (logCheckError) {
        console.error("Ошибка проверки notification_logs monthly_report:", logCheckError);
        continue;
      }

      if (existingLog) {
        continue;
      }

      try {
        await sendTelegramMessage({
          botToken: user.bot_token,
          chatId: user.chat_id,
          text,
        });

        await supabase.from("notification_logs").insert({
          user_id: user.user_id,
          channel: "telegram",
          type: "monthly_report",
          entity_type: "report",
          entity_id: entityId,
          status: "sent",
          message_preview: text,
        });

        sent += 1;
      } catch (sendError) {
        console.error("Ошибка отправки monthly report:", sendError);

        await supabase.from("notification_logs").insert({
          user_id: user.user_id,
          channel: "telegram",
          type: "monthly_report",
          entity_type: "report",
          entity_id: entityId,
          status: "failed",
          message_preview: text,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      period: {
        currentStart: currentStart.toISOString(),
        currentEnd: currentEnd.toISOString(),
        prevStart: prevStart.toISOString(),
        prevEnd: prevEnd.toISOString(),
      },
      metrics: {
        revenue: currentPayments.revenue,
        profit: currentProfit,
        expenses: currentExpenses,
        fot: currentFot,
        paymentsCount: currentPayments.count,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ошибка monthly report",
      },
      { status: 500 }
    );
  }
}