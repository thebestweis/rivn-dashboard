import { createClient } from "@supabase/supabase-js";

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

type AvitoChat = {
  id: string;
  created: number;
  updated: number;
};

type AvitoMessage = {
  id: string;
  author_id: number;
  direction: "in" | "out";
  created: number;
  type: string;
  content?: {
    text?: string;
  };
};

type PeriodStats = {
  views: number;
  contacts: number;
  favorites: number;
  expenses: number;
  conversion: number;
  costPerContact: number;
};

type DialogAnalytics = {
  incomingDialogs: number;
  requestedPhoneDialogs: number;
  notRequestedPhoneDialogs: number;
  receivedPhoneDialogs: number;
  firstReplyWithin30Min: number;
  firstReplyDialogs: number;
  averageFirstReplySeconds: number;
  medianFirstReplySeconds: number;
  maxFirstReplySeconds: number;
};

const dailyWishes = [
  "☀️ Доброе утро! Пусть день пройдёт спокойно и приятно.",
  "Доброе утро! Желаем лёгкого старта дня и хорошего настроения.",
  "👋 Доброе утро! Пусть сегодня всё складывается в твою пользу.",
  "Доброе утро! Желаем продуктивного дня и приятных результатов.",
  "Доброе утро! Пусть сегодня будет хороший настрой и уверенность в действиях.",
  "Доброе утро! Желаем спокойного дня и нескольких удачных сделок.",
  "Доброе утро! Пусть день пройдёт без лишней суеты и с хорошим результатом.",
  "☀️ Доброе утро! Желаем приятного дня и пару сочных продаж сегодня 😉",
  "Доброе утро! Пусть сегодня всё идёт ровно и приносит удовольствие.",
  "Доброе утро! Желаем лёгкого дня и хорошего отклика от работы.",
  "👋 Доброе утро! Пусть сегодня будут хорошие новости и приятные результаты.",
  "Доброе утро! Желаем уверенного дня и стабильного движения вперёд.",
  "Доброе утро! Пусть день будет комфортным и продуктивным.",
  "Доброе утро! Желаем отличного настроения и приятных диалогов.",
  "Доброе утро! Пусть сегодня будет больше хороших моментов в работе.",
  "☀️ Доброе утро! Желаем спокойного дня и хорошего результата по итогу.",
  "Доброе утро! Пусть сегодня будет хороший ритм и лёгкая работа.",
  "👋 Доброе утро! Желаем ясной головы и уверенных решений.",
  "Доброе утро! Пусть сегодня всё идёт по плану и даже лучше.",
  "Доброе утро! Желаем приятного дня и хороших продаж.",
  "☀️ Доброе утро! Пусть сегодня будет больше приятных разговоров и закрытых сделок.",
  "Доброе утро! Желаем стабильного дня и хорошего настроения.",
  "Доброе утро! Пусть сегодня всё даётся легко.",
  "👋 Доброе утро! Желаем продуктивного дня и уверенности в каждом шаге.",
  "Доброе утро! Пусть день принесёт хорошие результаты и спокойствие.",
  "👋 Доброе утро! Желаем отличного дня и пару приятных продаж.",
  "Доброе утро! Пусть сегодня всё складывается максимально комфортно.",
  "☀️ Доброе утро! Желаем лёгкости в работе и хороших итогов дня.",
  "Доброе утро! Пусть сегодня будет несколько классных сделок.",
  "Доброе утро! Желаем хорошего дня и приятных результатов.",
  "☀️ Доброе утро! Пусть сегодняшний день приятно удивит результатами.",
];

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getLastFullWeekRange() {
  const now = new Date();

  const moscowNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Moscow" })
  );

  const day = moscowNow.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;

  const currentMonday = new Date(moscowNow);
  currentMonday.setDate(moscowNow.getDate() - diffToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(currentMonday);
  lastMonday.setDate(currentMonday.getDate() - 7);

  const lastSunday = new Date(currentMonday);
  lastSunday.setDate(currentMonday.getDate() - 1);

  const previousMonday = new Date(currentMonday);
  previousMonday.setDate(currentMonday.getDate() - 14);

  const previousSunday = new Date(currentMonday);
  previousSunday.setDate(currentMonday.getDate() - 8);

  function toDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayNumber = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${dayNumber}`;
  }

  return {
    currentStart: toDateString(lastMonday),
    currentEnd: toDateString(lastSunday),
    previousStart: toDateString(previousMonday),
    previousEnd: toDateString(previousSunday),
    currentStartUnix: Math.floor(lastMonday.getTime() / 1000),
    currentEndUnix: Math.floor(
      new Date(
        lastSunday.getFullYear(),
        lastSunday.getMonth(),
        lastSunday.getDate(),
        23,
        59,
        59
      ).getTime() / 1000
    ),
  };
}

function formatDateShort(date: string) {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
}

function formatDateRange(start: string, end: string) {
  return `${formatDateShort(start)} — ${formatDateShort(end)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatMoney(value: number) {
  return `${formatNumber(value)} ₽`;
}

function formatPercentValue(value: number) {
  return `${Math.round(value)}%`;
}

function formatChange(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
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

function percent(part: number, total: number) {
  if (total === 0) return 0;
  return (part / total) * 100;
}

function formatPercentRounded(value: number) {
  return `${value.toFixed(0).replace(".", ",")}%`;
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 секунд";

  if (seconds < 60) {
    return `${Math.round(seconds)} секунд`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} минут`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (restMinutes === 0) {
    return `${hours} ч.`;
  }

  return `${hours} ч. ${restMinutes} мин.`;
}

function median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function hasPhoneRequest(text: string) {
  const normalized = text.toLowerCase();

  const phrases = [
    "номер",
    "телефон",
    "контакт",
    "оставьте номер",
    "оставьте контакт",
    "как с вами связаться",
    "куда вам позвонить",
    "по какому номеру",
    "ваш номер",
    "ваш телефон",
    "набрать",
    "созвониться",
  ];

  return phrases.some((phrase) => normalized.includes(phrase));
}

function hasRussianPhone(text: string) {
  const phoneRegex =
    /(?:\+7|7|8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g;

  return phoneRegex.test(text);
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

async function getExpensesForPeriod(params: {
  accountId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("avito_report_expenses")
    .select("amount")
    .eq("account_id", params.accountId)
    .gte("expense_date", params.dateFrom)
    .lte("expense_date", params.dateTo);

  if (error) {
    throw new Error(`Ошибка получения расходов: ${error.message}`);
  }

  return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

async function getChats(params: {
  accessToken: string;
  avitoUserId: string;
  start: number;
  end: number;
}) {
  const allChats: AvitoChat[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const response = await fetch(
      `https://api.avito.ru/messenger/v2/accounts/${params.avitoUserId}/chats?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Ошибка получения чатов: ${JSON.stringify(data)}`);
    }

    const chats = Array.isArray(data.chats) ? data.chats : [];

    const relevantChats = chats.filter((chat: AvitoChat) => {
      return chat.created <= params.end && chat.updated >= params.start;
    });

    allChats.push(...relevantChats);

    if (chats.length < limit) break;

    const oldestUpdated = Math.min(
      ...chats.map((chat: AvitoChat) => Number(chat.updated || 0))
    );

    if (oldestUpdated < params.start) break;

    offset += limit;

    if (offset > 1000) break;
  }

  return allChats;
}

async function getMessages(params: {
  accessToken: string;
  avitoUserId: string;
  chatId: string;
}) {
  const response = await fetch(
    `https://api.avito.ru/messenger/v3/accounts/${params.avitoUserId}/chats/${params.chatId}/messages?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/json",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Ошибка получения сообщений: ${JSON.stringify(data)}`);
  }

  return Array.isArray(data.messages) ? (data.messages as AvitoMessage[]) : [];
}

async function getDialogAnalytics(params: {
  accessToken: string;
  avitoUserId: string;
  start: number;
  end: number;
}): Promise<DialogAnalytics> {
  const chats = await getChats({
    accessToken: params.accessToken,
    avitoUserId: params.avitoUserId,
    start: params.start,
    end: params.end,
  });

  let incomingDialogs = 0;
  let requestedPhoneDialogs = 0;
  let notRequestedPhoneDialogs = 0;
  let receivedPhoneDialogs = 0;
  let firstReplyWithin30Min = 0;

  const firstReplyTimes: number[] = [];

  for (const chat of chats) {
    const messages = await getMessages({
      accessToken: params.accessToken,
      avitoUserId: params.avitoUserId,
      chatId: chat.id,
    });

    const sortedMessages = messages
      .filter((message) => message.type === "text")
      .sort((a, b) => a.created - b.created);

    const firstIncoming = sortedMessages.find(
      (message) =>
        message.direction === "in" &&
        message.author_id !== 0 &&
        message.created >= params.start &&
        message.created <= params.end
    );

    if (!firstIncoming) continue;

    incomingDialogs += 1;

    const sellerMessagesAfterIncoming = sortedMessages.filter(
      (message) =>
        message.direction === "out" &&
        message.created >= firstIncoming.created
    );

    const firstSellerReply = sellerMessagesAfterIncoming[0];

    if (firstSellerReply) {
      const replyTime = firstSellerReply.created - firstIncoming.created;
      firstReplyTimes.push(replyTime);

      if (replyTime <= 30 * 60) {
        firstReplyWithin30Min += 1;
      }
    }

    const requestedPhone = sellerMessagesAfterIncoming.some((message) =>
      hasPhoneRequest(message.content?.text || "")
    );

    if (requestedPhone) {
      requestedPhoneDialogs += 1;
    } else {
      notRequestedPhoneDialogs += 1;
    }

    const receivedPhone = sortedMessages.some(
      (message) =>
        message.direction === "in" &&
        message.author_id !== 0 &&
        message.created >= firstIncoming.created &&
        hasRussianPhone(message.content?.text || "")
    );

    if (receivedPhone) {
      receivedPhoneDialogs += 1;
    }
  }

  const averageFirstReplySeconds =
    firstReplyTimes.length > 0
      ? firstReplyTimes.reduce((sum, value) => sum + value, 0) /
        firstReplyTimes.length
      : 0;

  return {
    incomingDialogs,
    requestedPhoneDialogs,
    notRequestedPhoneDialogs,
    receivedPhoneDialogs,
    firstReplyWithin30Min,
    firstReplyDialogs: firstReplyTimes.length,
    averageFirstReplySeconds: Math.round(averageFirstReplySeconds),
    medianFirstReplySeconds: Math.round(median(firstReplyTimes)),
    maxFirstReplySeconds:
      firstReplyTimes.length > 0 ? Math.max(...firstReplyTimes) : 0,
  };
}

function mergeDialogAnalytics(items: DialogAnalytics[]): DialogAnalytics {
  const firstReplyDialogs = items.reduce(
    (sum, item) => sum + item.firstReplyDialogs,
    0
  );

  const weightedAverage =
    firstReplyDialogs > 0
      ? items.reduce(
          (sum, item) =>
            sum + item.averageFirstReplySeconds * item.firstReplyDialogs,
          0
        ) / firstReplyDialogs
      : 0;

  return {
    incomingDialogs: items.reduce((sum, item) => sum + item.incomingDialogs, 0),
    requestedPhoneDialogs: items.reduce(
      (sum, item) => sum + item.requestedPhoneDialogs,
      0
    ),
    notRequestedPhoneDialogs: items.reduce(
      (sum, item) => sum + item.notRequestedPhoneDialogs,
      0
    ),
    receivedPhoneDialogs: items.reduce(
      (sum, item) => sum + item.receivedPhoneDialogs,
      0
    ),
    firstReplyWithin30Min: items.reduce(
      (sum, item) => sum + item.firstReplyWithin30Min,
      0
    ),
    firstReplyDialogs,
    averageFirstReplySeconds: Math.round(weightedAverage),
    medianFirstReplySeconds: 0,
    maxFirstReplySeconds:
      items.length > 0
        ? Math.max(...items.map((item) => item.maxFirstReplySeconds))
        : 0,
  };
}

function buildDialogAnalyticsBlock(analytics: DialogAnalytics) {
    return [
    "━━━━━━━━━━━━",
    "<b>Работа с входящими диалогами</b>",
    "",
    "<b>Скорость первого ответа</b>",
    `— До 30 минут: ${analytics.firstReplyWithin30Min} из ${analytics.firstReplyDialogs} диалогов (${formatPercentRounded(
      percent(analytics.firstReplyWithin30Min, analytics.firstReplyDialogs)
    )})`,
    `— Среднее время: ${formatSeconds(analytics.averageFirstReplySeconds)}`,
    analytics.medianFirstReplySeconds > 0
      ? `— Медианное время: ${formatSeconds(analytics.medianFirstReplySeconds)}`
      : null,
    `— Максимальная пауза: ${formatSeconds(analytics.maxFirstReplySeconds)}`,
    "",
    "<b>Работа с номерами</b>",
    `— Попросили номер: ${analytics.requestedPhoneDialogs} из ${analytics.incomingDialogs} диалогов (${formatPercentRounded(
      percent(analytics.requestedPhoneDialogs, analytics.incomingDialogs)
    )})`,
    `— Не попросили номер: ${analytics.notRequestedPhoneDialogs} из ${analytics.incomingDialogs} диалогов (${formatPercentRounded(
      percent(analytics.notRequestedPhoneDialogs, analytics.incomingDialogs)
    )})`,
    `— Получили номер: ${analytics.receivedPhoneDialogs} из ${analytics.incomingDialogs} диалогов (${formatPercentRounded(
      percent(analytics.receivedPhoneDialogs, analytics.incomingDialogs)
    )})`,
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
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
    buildMetricLine(
      "Расходы",
      params.current.expenses,
      params.previous.expenses,
      "money"
    ),
    buildMetricLine(
      "Просмотры",
      params.current.views,
      params.previous.views,
      "number"
    ),
    buildMetricLine(
      "Конверсия",
      params.current.conversion,
      params.previous.conversion,
      "percent"
    ),
    buildMetricLine(
      "Контакты",
      params.current.contacts,
      params.previous.contacts,
      "number"
    ),
    buildMetricLine(
      "Стоимость 1 контакта",
      params.current.costPerContact,
      params.previous.costPerContact,
      "money"
    ),
  ].join("\n");
}

function buildWeeklyReport(params: {
  date: string;
  accountBlocks: string[];
  totalCurrent: PeriodStats;
  totalPrevious: PeriodStats;
  dialogAnalyticsBlock: string;
}) {
  const hasMultipleAccounts = params.accountBlocks.length > 1;

  const baseLines = [
    `📊 <b>Еженедельный отчёт за период: ${params.date}</b>`,
    "",
    ...params.accountBlocks,
  ];

  if (!hasMultipleAccounts) {
    return [
      ...baseLines,
      "",
      params.dialogAnalyticsBlock,
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
    buildMetricLine(
      "Расходы",
      params.totalCurrent.expenses,
      params.totalPrevious.expenses,
      "money"
    ),
    buildMetricLine(
      "Просмотры",
      params.totalCurrent.views,
      params.totalPrevious.views,
      "number"
    ),
    buildMetricLine(
      "Конверсия",
      params.totalCurrent.conversion,
      params.totalPrevious.conversion,
      "percent"
    ),
    buildMetricLine(
      "Контакты",
      params.totalCurrent.contacts,
      params.totalPrevious.contacts,
      "number"
    ),
    buildMetricLine(
      "Стоимость 1 контакта",
      params.totalCurrent.costPerContact,
      params.totalPrevious.costPerContact,
      "money"
    ),
    "",
    params.dialogAnalyticsBlock,
    "",
    "✅ Аккаунты проверены",
  ].join("\n");
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const weekRange = getLastFullWeekRange();

    const currentPeriodStart = weekRange.currentStart;
    const currentPeriodEnd = weekRange.currentEnd;

    const previousPeriodStart = weekRange.previousStart;
    const previousPeriodEnd = weekRange.previousEnd;

    const { data: clients, error: clientsError } = await supabase
      .from("avito_report_clients")
      .select("id, telegram_chat_id")
      .eq("is_active", true)
      .not("telegram_chat_id", "is", null);

    if (clientsError || !clients || clients.length === 0) {
      return Response.json(
        {
          ok: false,
          error:
            clientsError?.message || "Нет активных клиентов с Telegram chat_id",
        },
        { status: 404 }
      );
    }

    const results = [];

    for (const client of clients) {
      try {
        const { data: existing } = await supabase
          .from("avito_report_logs")
          .select("id")
          .eq("client_id", client.id)
          .eq("report_type", "weekly")
          .eq("period_start", currentPeriodStart)
          .eq("period_end", currentPeriodEnd)
          .eq("status", "success")
          .maybeSingle();

        if (existing) {
          results.push({
            client_id: client.id,
            status: "skipped_duplicate",
          });

          continue;
        }

        const { data: accounts, error: accountsError } = await supabase
          .from("avito_report_accounts")
          .select("id, name, access_token, avito_user_id")
          .eq("client_id", client.id)
          .eq("is_active", true);

        if (accountsError || !accounts || accounts.length === 0) {
          results.push({
            client_id: client.id,
            status: "no_accounts",
            error: accountsError?.message || null,
          });

          continue;
        }

        const accountBlocks: string[] = [];
        const dialogAnalyticsItems: DialogAnalytics[] = [];

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
          if (!account.access_token || !account.avito_user_id) {
            accountBlocks.push(
              [
                "━━━━━━━━━━━━",
                `Аккаунт: <b>${account.name}</b>`,
                "",
                "⚠️ Аккаунт не проверен: нет access_token или avito_user_id.",
              ].join("\n")
            );

            continue;
          }

          const itemIds = await getAllItemIds(account.access_token);

          const currentStatsRaw = await getStatsForPeriod({
  accessToken: account.access_token,
  avitoUserId: account.avito_user_id,
  itemIds,
  dateFrom: currentPeriodStart,
  dateTo: currentPeriodEnd,
});

const currentExpenses = await getExpensesForPeriod({
  accountId: account.id,
  dateFrom: currentPeriodStart,
  dateTo: currentPeriodEnd,
});

const currentStats = buildStats({
  ...currentStatsRaw,
  expenses: currentExpenses,
});

          const previousStatsRaw = await getStatsForPeriod({
  accessToken: account.access_token,
  avitoUserId: account.avito_user_id,
  itemIds,
  dateFrom: previousPeriodStart,
  dateTo: previousPeriodEnd,
});

const previousExpenses = await getExpensesForPeriod({
  accountId: account.id,
  dateFrom: previousPeriodStart,
  dateTo: previousPeriodEnd,
});

const previousStats = buildStats({
  ...previousStatsRaw,
  expenses: previousExpenses,
});

          const dialogAnalytics = await getDialogAnalytics({
            accessToken: account.access_token,
            avitoUserId: account.avito_user_id,
            start: weekRange.currentStartUnix,
            end: weekRange.currentEndUnix,
          });

          dialogAnalyticsItems.push(dialogAnalytics);

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

        const mergedDialogAnalytics = mergeDialogAnalytics(dialogAnalyticsItems);
        const dialogAnalyticsBlock =
          buildDialogAnalyticsBlock(mergedDialogAnalytics);

        const reportText = buildWeeklyReport({
          date: formatDateRange(currentPeriodStart, currentPeriodEnd),
          accountBlocks,
          totalCurrent,
          totalPrevious,
          dialogAnalyticsBlock,
        });

        await sendTelegramMessage(client.telegram_chat_id, reportText);

        await supabase.from("avito_report_logs").insert({
          client_id: client.id,
          telegram_chat_id: client.telegram_chat_id,
          report_type: "weekly",
          period_start: currentPeriodStart,
          period_end: currentPeriodEnd,
          status: "success",
          message: reportText,
        });

        results.push({
          client_id: client.id,
          status: "sent",
        });
      } catch (error) {
        await supabase.from("avito_report_logs").insert({
          client_id: client.id,
          telegram_chat_id: client.telegram_chat_id,
          report_type: "weekly",
          period_start: currentPeriodStart,
          period_end: currentPeriodEnd,
          status: "error",
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        });

        results.push({
          client_id: client.id,
          status: "error",
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        });
      }
    }

    return Response.json({
      ok: true,
      report_type: "weekly",
      period_start: currentPeriodStart,
      period_end: currentPeriodEnd,
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
