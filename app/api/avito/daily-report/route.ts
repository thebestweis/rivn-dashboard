import { createClient } from "@supabase/supabase-js";
import { fetchAvitoSpendings } from "@/app/api/avito/fetch-avito-spendings";
import { parseAvitoSpendings } from "@/app/api/avito/parse-avito-spendings";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

type AvitoAccount = {
  id: string;
  name: string;
  access_token: string | null;
  avito_user_id: string | null;
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

const dailyWishes = [
  "☀️ Доброе утро! Пусть день пройдёт спокойно и приятно.",
  "☀️ Доброе утро! Желаем лёгкого старта дня и хорошего настроения.",
  "👋 Доброе утро! Пусть сегодня всё складывается в твою пользу.",
  "👋 Доброе утро! Желаем продуктивного дня и приятных результатов.",
  "👋 Доброе утро! Пусть сегодня будет хороший настрой и уверенность в действиях.",
  "☀️ Доброе утро! Желаем спокойного дня и нескольких удачных сделок.",
  "👋 Доброе утро! Пусть день пройдёт без лишней суеты и с хорошим результатом.",
  "☀️ Доброе утро! Желаем приятного дня и пару сочных продаж сегодня 😉",
  "☀️ Доброе утро! Пусть сегодня всё идёт ровно и приносит удовольствие.",
  "☀️ Доброе утро! Желаем лёгкого дня и хорошего отклика от работы.",
  "👋 Доброе утро! Пусть сегодня будут хорошие новости и приятные результаты.",
  "👋 Доброе утро! Желаем уверенного дня и стабильного движения вперёд.",
  "👋 Доброе утро! Пусть день будет комфортным и продуктивным.",
  "☀️ Доброе утро! Желаем отличного настроения и приятных диалогов.",
  "☀️ Доброе утро! Пусть сегодня будет больше хороших моментов в работе.",
  "☀️ Доброе утро! Желаем спокойного дня и хорошего результата по итогу.",
  "👋 Доброе утро! Пусть сегодня будет хороший ритм и лёгкая работа.",
  "👋 Доброе утро! Желаем ясной головы и уверенных решений.",
  "👋 Доброе утро! Пусть сегодня всё идёт по плану и даже лучше.",
  "👋 Доброе утро! Желаем приятного дня и хороших продаж.",
  "☀️ Доброе утро! Пусть сегодня будет больше приятных разговоров и закрытых сделок.",
  "👋 Доброе утро! Желаем стабильного дня и хорошего настроения.",
  "👋 Доброе утро! Пусть сегодня всё даётся легко.",
  "👋 Доброе утро! Желаем продуктивного дня и уверенности в каждом шаге.",
  "☀️ Доброе утро! Пусть день принесёт хорошие результаты и спокойствие.",
  "👋 Доброе утро! Желаем отличного дня и пару приятных продаж.",
  "☀️ Доброе утро! Пусть сегодня всё складывается максимально комфортно.",
  "☀️ Доброе утро! Желаем лёгкости в работе и хороших итогов дня.",
  "☀️ Доброе утро! Пусть сегодня будет несколько классных сделок.",
  "👋 Доброе утро! Желаем хорошего дня и приятных результатов.",
  "☀️ Доброе утро! Пусть сегодняшний день приятно удивит результатами.",
];

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getMoscowDate(daysAgo: number) {
  const now = new Date();
  const moscowNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Moscow" })
  );

  moscowNow.setDate(moscowNow.getDate() - daysAgo);

  const year = moscowNow.getFullYear();
  const month = String(moscowNow.getMonth() + 1).padStart(2, "0");
  const day = String(moscowNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  const [, month, day] = date.split("-");
  const year = date.split("-")[0];
  return `${day}.${month}.${year}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatMoney(value: number) {
  return `${formatNumber(value)} ₽`;
}

function formatPercentValue(value: number) {
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

function getDailyWish(date: string) {
  const day = Number(date.split("-")[2]);
  return dailyWishes[(day - 1) % dailyWishes.length];
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
  if (type === "percent") formattedValue = formatPercentValue(current);
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

function buildDailyReport(params: {
  date: string;
  accountBlocks: string[];
  totalCurrent: PeriodStats;
  totalPrevious: PeriodStats;
}) {
  const wish = getDailyWish(params.date);
  const hasMultipleAccounts = params.accountBlocks.length > 1;

  const baseLines = [
    wish,
    "",
    `📊 <b>Ежедневный отчёт за период: ${formatDate(params.date)}</b>`,
    "",
    ...params.accountBlocks,
  ];

  if (!hasMultipleAccounts) {
    return [...baseLines, "", "✅ Аккаунт проверен"].join("\n");
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

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: clients, error: clientsError } = await supabase
      .from("avito_report_clients")
      .select("id, name, telegram_chat_id")
      .eq("is_active", true)
      .not("telegram_chat_id", "is", null);

    if (clientsError) {
      return Response.json(
        {
          ok: false,
          error: `Ошибка получения клиентов: ${clientsError.message}`,
        },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "Активные клиенты с Telegram chat_id не найдены",
        },
        { status: 404 }
      );
    }

    const yesterday = getMoscowDate(1);
    const beforeYesterday = getMoscowDate(2);

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
          .eq("report_type", "daily")
          .eq("period_start", yesterday)
          .eq("period_end", yesterday)
          .eq("status", "success")
          .maybeSingle();

        if (existingLog) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: "skipped",
            accountsCount: 0,
            error: "Daily отчёт уже был отправлен за этот период",
          });

          continue;
        }

        const { data: accounts, error: accountsError } = await supabase
          .from("avito_report_accounts")
          .select("id, name, access_token, avito_user_id")
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

          const accessToken = account.access_token || (await getAvitoAccessToken());
          const itemIds = await getAllItemIds(accessToken);

          const currentStatsRaw = await getStatsForPeriod({
            accessToken,
            avitoUserId: account.avito_user_id,
            itemIds,
            dateFrom: yesterday,
            dateTo: yesterday,
          });

          const previousStatsRaw = await getStatsForPeriod({
            accessToken,
            avitoUserId: account.avito_user_id,
            itemIds,
            dateFrom: beforeYesterday,
            dateTo: beforeYesterday,
          });

          const rawAvitoSpendings = await fetchAvitoSpendings({
            accessToken,
            userId: account.avito_user_id,
            dateFrom: beforeYesterday,
            dateTo: yesterday,
            grouping: "day",
          });

          const currentAvitoSpendings = parseAvitoSpendings(rawAvitoSpendings, {
            dateFrom: yesterday,
            dateTo: yesterday,
          });

          const previousAvitoSpendings = parseAvitoSpendings(rawAvitoSpendings, {
            dateFrom: beforeYesterday,
            dateTo: beforeYesterday,
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

        const reportText = buildDailyReport({
          date: yesterday,
          accountBlocks,
          totalCurrent,
          totalPrevious,
        });

        await sendTelegramMessage(client.telegram_chat_id, reportText);

        await supabase.from("avito_report_logs").insert({
          client_id: client.id,
          telegram_chat_id: client.telegram_chat_id,
          report_type: "daily",
          period_start: yesterday,
          period_end: yesterday,
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
          report_type: "daily",
          period_start: yesterday,
          period_end: yesterday,
          status: "failed",
          message: errorMessage,
        });
      }
    }

    return Response.json({
      ok: true,
      message: "Daily отчёты обработаны по всем активным клиентам",
      yesterday,
      beforeYesterday,
      totalClients: clients.length,
      success: results.filter((item) => item.status === "success").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}