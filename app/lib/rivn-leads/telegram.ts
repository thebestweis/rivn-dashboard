type SendTelegramMessageInput = {
  chatId: string;
  text: string;
  replyMarkup?: unknown;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function htmlAttributeEscape(value: string) {
  return htmlEscape(value).replaceAll('"', "&quot;");
}

function formatSourceChatTitle(title: string, messageLink: string | null) {
  const safeTitle = htmlEscape(title || "Telegram-чат");
  if (!messageLink || !/^https?:\/\//i.test(messageLink)) return safeTitle;
  return `<a href="${htmlAttributeEscape(messageLink)}">${safeTitle}</a>`;
}

function formatOriginalMessageLink(messageLink: string | null) {
  if (!messageLink || !/^https?:\/\//i.test(messageLink)) return null;
  return `<a href="${htmlAttributeEscape(messageLink)}">Открыть исходное сообщение</a>`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatchedKeywords(messageText: string, matchedKeywords: string[]) {
  const keywords = [...new Set(matchedKeywords.map((keyword) => keyword.trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length);

  if (keywords.length === 0) return htmlEscape(messageText);

  const ranges: Array<{ start: number; end: number }> = [];

  for (const keyword of keywords) {
    const pattern = new RegExp(escapeRegExp(keyword).replaceAll("е", "[её]").replaceAll("Е", "[ЕЁ]"), "giu");
    for (const match of messageText.matchAll(pattern)) {
      const start = match.index ?? -1;
      const end = start + match[0].length;
      if (start < 0 || end <= start) continue;
      if (ranges.some((range) => start < range.end && end > range.start)) continue;
      ranges.push({ start, end });
    }
  }

  if (ranges.length === 0) return htmlEscape(messageText);

  ranges.sort((left, right) => left.start - right.start);

  let cursor = 0;
  let result = "";
  for (const range of ranges) {
    result += htmlEscape(messageText.slice(cursor, range.start));
    result += `<b>${htmlEscape(messageText.slice(range.start, range.end))}</b>`;
    cursor = range.end;
  }
  result += htmlEscape(messageText.slice(cursor));

  return result;
}

export function formatRivnLeadTelegramMessage(input: {
  messageText: string;
  authorUsername: string | null;
  sourceChatTitle: string;
  messageLink: string | null;
  matchedKeywords: string[];
}) {
  const contact = input.authorUsername ? `@${input.authorUsername.replace(/^@/, "")}` : "username отсутствует";
  const keywords = input.matchedKeywords.length > 0 ? input.matchedKeywords.join(", ") : "не указаны";
  const originalMessageLink = formatOriginalMessageLink(input.messageLink);

  const lines = [
    "🔥 <b>Потенциальный лид</b>",
    "",
    "<b>Сообщение:</b>",
    `<blockquote>${highlightMatchedKeywords(input.messageText, input.matchedKeywords)}</blockquote>`,
    "",
    "<b>Контакт:</b>",
    htmlEscape(contact),
    "",
    "<b>Источник:</b>",
    formatSourceChatTitle(input.sourceChatTitle, input.messageLink),
    "",
    "<b>Совпадения:</b>",
    htmlEscape(keywords),
  ];

  if (originalMessageLink) {
    lines.push("", originalMessageLink);
  }

  return lines.join("\n");
}

export async function sendRivnLeadTelegramMessage(input: SendTelegramMessageInput) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN не заполнен");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: input.replyMarkup,
    }),
  });

  const payload = (await response.json().catch(() => null)) as TelegramApiResponse<{ message_id: number }> | null;

  if (!response.ok || !payload?.ok || !payload.result) {
    throw new Error(payload?.description || "Telegram не принял сообщение");
  }

  return payload.result;
}
