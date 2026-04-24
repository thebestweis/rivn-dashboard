import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function getLastFullWeekRangeUnix() {
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

  const lastSundayEnd = new Date(currentMonday);
  lastSundayEnd.setSeconds(lastSundayEnd.getSeconds() - 1);

  return {
    start: toUnixSeconds(lastMonday),
    end: toUnixSeconds(lastSundayEnd),
  };
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

function percent(part: number, total: number) {
  if (total === 0) return 0;
  return (part / total) * 100;
}

function formatPercent(value: number) {
  return `${value.toFixed(0).replace(".", ",")}%`;
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

    if (chats.length < limit) {
      break;
    }

    const oldestUpdated = Math.min(
      ...chats.map((chat: AvitoChat) => Number(chat.updated || 0))
    );

    if (oldestUpdated < params.start) {
      break;
    }

    offset += limit;

    if (offset > 1000) {
      break;
    }
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

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: account, error } = await supabase
      .from("avito_report_accounts")
      .select("name, access_token, avito_user_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error || !account) {
      return Response.json({
        ok: false,
        error: error?.message || "Аккаунт Avito не найден",
      });
    }

    if (!account.access_token || !account.avito_user_id) {
      return Response.json({
        ok: false,
        error: "Нет access_token или avito_user_id",
      });
    }

    const range = getLastFullWeekRangeUnix();

    const chats = await getChats({
      accessToken: account.access_token,
      avitoUserId: account.avito_user_id,
      start: range.start,
      end: range.end,
    });

    let incomingDialogs = 0;
    let requestedPhoneDialogs = 0;
    let notRequestedPhoneDialogs = 0;
    let receivedPhoneDialogs = 0;
    let firstReplyWithin30Min = 0;

    const firstReplyTimes: number[] = [];

    for (const chat of chats) {
      const messages = await getMessages({
        accessToken: account.access_token,
        avitoUserId: account.avito_user_id,
        chatId: chat.id,
      });

      const sortedMessages = messages
        .filter((message) => message.type === "text")
        .sort((a, b) => a.created - b.created);

      const firstIncoming = sortedMessages.find(
        (message) =>
          message.direction === "in" &&
          message.author_id !== 0 &&
          message.created >= range.start &&
          message.created <= range.end
      );

      if (!firstIncoming) {
        continue;
      }

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

    const averageFirstReply =
      firstReplyTimes.length > 0
        ? firstReplyTimes.reduce((sum, value) => sum + value, 0) /
          firstReplyTimes.length
        : 0;

    const medianFirstReply = median(firstReplyTimes);
    const maxFirstReply =
      firstReplyTimes.length > 0 ? Math.max(...firstReplyTimes) : 0;

    return Response.json({
      ok: true,
      account: account.name,
      period_unix: range,
      chats_checked: chats.length,
      analytics: {
        incomingDialogs,
        requestedPhoneDialogs,
        requestedPhonePercent: percent(requestedPhoneDialogs, incomingDialogs),
        notRequestedPhoneDialogs,
        notRequestedPhonePercent: percent(notRequestedPhoneDialogs, incomingDialogs),
        receivedPhoneDialogs,
        receivedPhonePercent: percent(receivedPhoneDialogs, incomingDialogs),
        firstReplyWithin30Min,
        firstReplyWithin30MinPercent: percent(firstReplyWithin30Min, firstReplyTimes.length),
        averageFirstReplySeconds: Math.round(averageFirstReply),
        averageFirstReplyText: formatSeconds(averageFirstReply),
        medianFirstReplySeconds: Math.round(medianFirstReply),
        medianFirstReplyText: formatSeconds(medianFirstReply),
        maxFirstReplySeconds: Math.round(maxFirstReply),
        maxFirstReplyText: formatSeconds(maxFirstReply),
      },
      report_block: [
        "Запросы номеров во входящих диалогах:",
        `👉 Мы попросили номер у клиента: ${requestedPhoneDialogs} диалогов из ${incomingDialogs} входящих диалогов (${formatPercent(percent(requestedPhoneDialogs, incomingDialogs))})`,
        `👉 Мы не попросили номер у клиента: ${notRequestedPhoneDialogs} входящих диалогов (${formatPercent(percent(notRequestedPhoneDialogs, incomingDialogs))} от всех диалогов)`,
        `👉 Получен номер: в ${receivedPhoneDialogs} диалогах из ${incomingDialogs} входящих диалогов (${formatPercent(percent(receivedPhoneDialogs, incomingDialogs))})`,
        "— — —",
        "Скорость ответов во входящих диалогах:",
        `👉 Ответили на первое сообщение за полчаса: ${firstReplyWithin30Min} диалогов из ${firstReplyTimes.length} (${formatPercent(percent(firstReplyWithin30Min, firstReplyTimes.length))})`,
        `👉 Среднее время ответа на первое сообщение покупателя: ${formatSeconds(averageFirstReply)}`,
        `👉 Среднее медианное время ответа на первое сообщение покупателя: ${formatSeconds(medianFirstReply)}`,
        `👉 Максимальная пауза перед ответом на первое сообщение покупателя: ${formatSeconds(maxFirstReply)}`,
      ].join("\n"),
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