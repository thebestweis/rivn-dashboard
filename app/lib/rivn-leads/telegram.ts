type SendTelegramMessageInput = {
  chatId: string;
  text: string;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export function formatRivnLeadTelegramMessage(input: {
  messageText: string;
  authorUsername: string | null;
  sourceChatTitle: string;
  messageLink: string | null;
  matchedKeywords: string[];
}) {
  const contact = input.authorUsername ? `@${input.authorUsername.replace(/^@/, "")}` : "username отсутствует";
  const link = input.messageLink || "ссылка недоступна";
  const keywords = input.matchedKeywords.length > 0 ? input.matchedKeywords.join(", ") : "не указаны";

  return [
    "🔥 Потенциальный лид",
    "",
    "Сообщение:",
    input.messageText,
    "",
    "Контакт:",
    contact,
    "",
    "Источник:",
    input.sourceChatTitle,
    "",
    "Совпадения:",
    keywords,
    "",
    "Ссылка:",
    link,
  ].join("\n");
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
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json().catch(() => null)) as TelegramApiResponse<{ message_id: number }> | null;

  if (!response.ok || !payload?.ok || !payload.result) {
    throw new Error(payload?.description || "Telegram не принял сообщение");
  }

  return payload.result;
}
