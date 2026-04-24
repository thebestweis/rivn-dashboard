import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAvitoSpendings } from "@/app/api/avito/fetch-avito-spendings";
import { parseAvitoSpendings } from "@/app/api/avito/parse-avito-spendings";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";

import { verifyCronSecret } from "../verify-cron-secret";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

type AvitoAccount = {
  id: string;
  name: string;
  access_token: string | null;
  avito_user_id: string | null;
  avito_client_id: string | null;
  avito_client_secret: string | null;
};

type AvitoStatPoint = {
  uniqViews?: number;
  uniqContacts?: number;
  uniqFavorites?: number;
};

type AvitoStatsItem = {
  itemId: number;
  stats?: AvitoStatPoint[];
};

type PeriodStats = {
  views: number;
  contacts: number;
  favorites: number;
  expenses: number;
  conversion: number;
  costPerContact: number;
};

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatMoney(value: number) {
  return `${formatNumber(value)} ₽`;
}

function formatPercent(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function formatChange(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")}%`;
}

function getChangePercent(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;

  return ((current - previous) / previous) * 100;
}

function chunkArray<T>(array: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

function buildStats(params: {
  views: number;
  contacts: number;
  favorites: number;
  expenses?: number;
}): PeriodStats {
  const expenses = params.expenses || 0;

  return {
    views: params.views,
    contacts: params.contacts,
    favorites: params.favorites,
    expenses,
    conversion: params.views > 0 ? (params.contacts / params.views) * 100 : 0,
    costPerContact: params.contacts > 0 ? expenses / params.contacts : 0,
  };
}

function buildMetricLine(
  label: string,
  current: number,
  previous: number,
  type: "number" | "money" | "percent"
) {
  const change = getChangePercent(current, previous);

  let formattedValue = "";

  if (type === "money") formattedValue = formatMoney(current);
  if (type === "percent") formattedValue = formatPercent(current);
  if (type === "number") formattedValue = formatNumber(current);

  return `— ${label}: ${formattedValue} (${formatChange(change)})`;
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!telegramToken) {
    throw new Error("Не найден TELEGRAM_BOT_TOKEN");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function getAllItemIds(accessToken: string) {
  const allItems: { id: number }[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.avito.ru/core/v1/items?page=${page}&per_page=${perPage}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Ошибка получения объявлений: ${JSON.stringify(data)}`);
    }

    const resources = Array.isArray(data.resources) ? data.resources : [];
    allItems.push(...resources);

    if (resources.length < perPage) break;

    page += 1;

    if (page > 50) break;
  }

  return allItems.map((item) => item.id).filter(Boolean);
}

async function getStatsForPeriod(params: {
  accessToken: string;
  avitoUserId: string;
  itemIds: number[];
  dateFrom: string;
  dateTo: string;
}) {
  const chunks = chunkArray(params.itemIds, 200);

  let views = 0;
  let contacts = 0;
  let favorites = 0;

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.avito.ru/stats/v1/accounts/${params.avitoUserId}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          itemIds: chunk,
          periodGrouping: "day",
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Ошибка получения статистики: ${JSON.stringify(data)}`);
    }

    const items = (data?.result?.items || []) as AvitoStatsItem[];

    for (const item of items) {
      for (const stat of item.stats || []) {
        views += Number(stat.uniqViews || 0);
        contacts += Number(stat.uniqContacts || 0);
        favorites += Number(stat.uniqFavorites || 0);
      }
    }
  }

  return buildStats({
    views,
    contacts,
    favorites,
    expenses: 0,
  });
}

function buildAccountBlock(params: {
  accountName: string;
  current: PeriodStats;
  previous: PeriodStats;
}) {
  return [
    "━━━━━━━━━━━━",
    `Аккаунт: <b>${params.accountName}</b>`,
    "",
    buildMetricLine("Просмотры", params.current.views, params.previous.views, "number"),
    buildMetricLine("Контакты", params.current.contacts, params.previous.contacts, "number"),
    buildMetricLine("Расходы", params.current.expenses, params.previous.expenses, "money"),
    buildMetricLine("Конверсия", params.current.conversion, params.previous.conversion, "percent"),
    buildMetricLine("Стоимость 1 контакта", params.current.costPerContact, params.previous.costPerContact, "money"),
  ].join("\n");
}

function buildWeeklyReport(params: {
  clientName: string;
  periodLabel: string;
  accountBlocks: string[];
  totalCurrent: PeriodStats;
  totalPrevious: PeriodStats;
}) {
  const hasMultipleAccounts = params.accountBlocks.length > 1;

  const baseLines = [
    `📊 <b>Еженедельный Avito-отчёт</b>`,
    `<b>${params.periodLabel}</b>`,
    "",
    ...params.accountBlocks,
  ];

  if (!hasMultipleAccounts) {
    return [
      ...baseLines,
      "",
      "✅ Аккаунт проверен",
    ].join("\n");
  }

  return [
    ...baseLines,
    "",
    "━━━━━━━━━━━━",
    "<b>Итого по всем аккаунтам</b>",
    "",
    buildMetricLine("Просмотры", params.totalCurrent.views, params.totalPrevious.views, "number"),
    buildMetricLine("Контакты", params.totalCurrent.contacts, params.totalPrevious.contacts, "number"),
    buildMetricLine("Расходы", params.totalCurrent.expenses, params.totalPrevious.expenses, "money"),
    buildMetricLine("Конверсия", params.totalCurrent.conversion, params.totalPrevious.conversion, "percent"),
    buildMetricLine("Стоимость 1 контакта", params.totalCurrent.costPerContact, params.totalPrevious.costPerContact, "money"),
    "",
    "✅ Аккаунты проверены",
  ].join("\n");
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabase();

    const { data: clients, error: clientsError } = await supabase
      .from("avito_report_clients")
      .select("id, name, telegram_chat_id")
      .eq("weekly_reports_enabled", true)

    if (clientsError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Ошибка получения клиентов: ${clientsError.message}`,
        },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Активные клиенты с Telegram chat_id не найдены",
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const thisWeek = getWeekRange(now);
    const lastWeek = getWeekRange(new Date(thisWeek.start.getTime() - 1));
    const prevWeek = getWeekRange(new Date(lastWeek.start.getTime() - 1));

    const currentStart = lastWeek.start;
    const currentEnd = lastWeek.end;
    const prevStart = prevWeek.start;
    const prevEnd = prevWeek.end;

    const currentStartDate = toDateOnly(currentStart);
    const currentEndDate = toDateOnly(currentEnd);
    const prevStartDate = toDateOnly(prevStart);
    const prevEndDate = toDateOnly(prevEnd);

    const periodLabel = `${formatDate(currentStart)} — ${formatDate(currentEnd)}`;
    const weekKey = `${currentStartDate}_${currentEndDate}`;

    const results: {
      clientId: string;
      clientName: string;
      status: "success" | "failed" | "skipped";
      accountsCount: number;
      error?: string;
    }[] = [];

    for (const client of clients) {
      try {
        const { data: existingLog } = await supabase
          .from("avito_report_logs")
          .select("id")
          .eq("client_id", client.id)
          .eq("report_type", "weekly")
          .eq("period_start", currentStartDate)
          .eq("period_end", currentEndDate)
          .eq("status", "success")
          .maybeSingle();

        if (existingLog) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: "skipped",
            accountsCount: 0,
            error: "Weekly отчёт уже был отправлен за этот период",
          });

          continue;
        }

        const { data: accounts, error: accountsError } = await supabase
          .from("avito_report_accounts")
          .select("id, name, access_token, avito_user_id, avito_client_id, avito_client_secret")
          .eq("client_id", client.id)
          .eq("is_active", true);

        if (accountsError) {
          throw new Error(`Ошибка получения аккаунтов: ${accountsError.message}`);
        }

        if (!accounts || accounts.length === 0) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: "skipped",
            accountsCount: 0,
            error: "Активные Avito-аккаунты клиента не найдены",
          });

          continue;
        }

        const accountBlocks: string[] = [];

        const totalCurrentRaw = {
          views: 0,
          contacts: 0,
          favorites: 0,
          expenses: 0,
        };

        const totalPreviousRaw = {
          views: 0,
          contacts: 0,
          favorites: 0,
          expenses: 0,
        };

        for (const account of accounts as AvitoAccount[]) {
          if (!account.avito_user_id) {
            accountBlocks.push(
              [
                "━━━━━━━━━━━━",
                `Аккаунт: <b>${account.name}</b>`,
                "",
                "⚠️ Аккаунт не проверен: нет avito_user_id.",
              ].join("\n")
            );

            continue;
          }

          const accessToken =
  account.access_token ||
  (await getAvitoAccessToken({
    clientId: account.avito_client_id,
    clientSecret: account.avito_client_secret,
  }));
          const itemIds = await getAllItemIds(accessToken);

          const currentStatsRaw = await getStatsForPeriod({
            accessToken,
            avitoUserId: account.avito_user_id,
            itemIds,
            dateFrom: currentStartDate,
            dateTo: currentEndDate,
          });

          const previousStatsRaw = await getStatsForPeriod({
            accessToken,
            avitoUserId: account.avito_user_id,
            itemIds,
            dateFrom: prevStartDate,
            dateTo: prevEndDate,
          });

          const rawAvitoSpendings = await fetchAvitoSpendings({
            accessToken,
            userId: account.avito_user_id,
            dateFrom: prevStartDate,
            dateTo: currentEndDate,
            grouping: "day",
          });

          const currentAvitoSpendings = parseAvitoSpendings(rawAvitoSpendings, {
            dateFrom: currentStartDate,
            dateTo: currentEndDate,
          });

          const previousAvitoSpendings = parseAvitoSpendings(rawAvitoSpendings, {
            dateFrom: prevStartDate,
            dateTo: prevEndDate,
          });

          const currentStats = buildStats({
            ...currentStatsRaw,
            expenses: currentAvitoSpendings.total,
          });

          const previousStats = buildStats({
            ...previousStatsRaw,
            expenses: previousAvitoSpendings.total,
          });

          totalCurrentRaw.views += currentStats.views;
          totalCurrentRaw.contacts += currentStats.contacts;
          totalCurrentRaw.favorites += currentStats.favorites;
          totalCurrentRaw.expenses += currentStats.expenses;

          totalPreviousRaw.views += previousStats.views;
          totalPreviousRaw.contacts += previousStats.contacts;
          totalPreviousRaw.favorites += previousStats.favorites;
          totalPreviousRaw.expenses += previousStats.expenses;

          accountBlocks.push(
            buildAccountBlock({
              accountName: account.name,
              current: currentStats,
              previous: previousStats,
            })
          );
        }

        const totalCurrent = buildStats(totalCurrentRaw);
        const totalPrevious = buildStats(totalPreviousRaw);

        const reportText = buildWeeklyReport({
          clientName: client.name,
          periodLabel,
          accountBlocks,
          totalCurrent,
          totalPrevious,
        });

        await sendTelegramMessage(client.telegram_chat_id, reportText);

        await supabase.from("avito_report_logs").insert({
          client_id: client.id,
          telegram_chat_id: client.telegram_chat_id,
          report_type: "weekly",
          period_start: currentStartDate,
          period_end: currentEndDate,
          status: "success",
          message: reportText,
        });

        results.push({
          clientId: client.id,
          clientName: client.name,
          status: "success",
          accountsCount: accounts.length,
        });
      } catch (clientError) {
        const errorMessage =
          clientError instanceof Error
            ? clientError.message
            : "Неизвестная ошибка клиента";

        results.push({
          clientId: client.id,
          clientName: client.name,
          status: "failed",
          accountsCount: 0,
          error: errorMessage,
        });

        await supabase.from("avito_report_logs").insert({
          client_id: client.id,
          telegram_chat_id: client.telegram_chat_id,
          report_type: "weekly",
          period_start: currentStartDate,
          period_end: currentEndDate,
          status: "failed",
          message: errorMessage,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Weekly Avito-отчёты обработаны по всем активным клиентам",
      period: {
        currentStart: currentStartDate,
        currentEnd: currentEndDate,
        prevStart: prevStartDate,
        prevEnd: prevEndDate,
      },
      totalClients: clients.length,
      success: results.filter((item) => item.status === "success").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ошибка weekly report",
      },
      { status: 500 }
    );
  }
}