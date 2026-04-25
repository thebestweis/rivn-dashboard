export type DialogAnalytics = {
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

export const emptyDialogAnalytics: DialogAnalytics = {
  incomingDialogs: 0,
  requestedPhoneDialogs: 0,
  notRequestedPhoneDialogs: 0,
  receivedPhoneDialogs: 0,
  firstReplyWithin30Min: 0,
  firstReplyDialogs: 0,
  averageFirstReplySeconds: 0,
  medianFirstReplySeconds: 0,
  maxFirstReplySeconds: 0,
};

export function percent(value: number, total: number) {
  if (!total) return 0;
  return (value / total) * 100;
}

export function formatPercentRounded(value: number) {
  return `${Math.round(value)}%`;
}

export function formatSeconds(value: number) {
  const seconds = Math.round(value);

  if (seconds <= 0) {
    return "0 мин";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }

  return `${minutes} мин`;
}

export function getMoscowDateRangeUnix(date: string) {
  const start = new Date(`${date}T00:00:00+03:00`);
  const end = new Date(`${date}T23:59:59+03:00`);

  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

export function getMoscowPeriodRangeUnix(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00+03:00`);
  const end = new Date(`${dateTo}T23:59:59+03:00`);

  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
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
  const normalized = text.toLowerCase().replaceAll("ё", "е");
  const phrases = [
    "номер",
    "телефон",
    "тел",
    "контакт",
    "как связаться",
    "оставьте",
    "оставь",
    "напишите номер",
    "пришлите номер",
    "скиньте номер",
    "дайте номер",
    "можно ваш номер",
    "можно номер",
  ];

  return phrases.some((phrase) => normalized.includes(phrase));
}

function hasRussianPhone(text: string) {
  const phoneRegex =
    /(?:\+7|7|8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g;

  return phoneRegex.test(text);
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
        cache: "no-store",
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
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Ошибка получения сообщений: ${JSON.stringify(data)}`);
  }

  return Array.isArray(data.messages) ? (data.messages as AvitoMessage[]) : [];
}

export async function getDialogAnalytics(params: {
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
        message.direction === "out" && message.created >= firstIncoming.created
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

export function mergeDialogAnalytics(items: DialogAnalytics[]): DialogAnalytics {
  if (items.length === 0) {
    return emptyDialogAnalytics;
  }

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

export function buildDialogAnalyticsBlock(analytics: DialogAnalytics) {
  if (analytics.incomingDialogs === 0) {
    return [
      "━━━━━━━━━━━━",
      "<b>Работа с входящими диалогами</b>",
      "",
      "— За период новых входящих диалогов не найдено",
    ].join("\n");
  }

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
  ]
    .filter((line) => line !== null)
    .join("\n");
}
