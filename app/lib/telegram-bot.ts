type TelegramInlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type SendTelegramMessageParams = {
  chatId: number | string;
  text: string;
  replyMarkup?: {
    inline_keyboard: TelegramInlineKeyboardButton[][];
  };
};

function getTelegramApiBase() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("Не найден TELEGRAM_BOT_TOKEN");
  }

  return `https://api.telegram.org/bot${token}`;
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const response = await fetch(`${getTelegramApiBase()}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.description || `Ошибка Telegram API при вызове ${method}`
    );
  }

  return data;
}

export async function sendTelegramMessage(params: SendTelegramMessageParams) {
  return telegramRequest("sendMessage", {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: "HTML",
    reply_markup: params.replyMarkup,
  });
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string
) {
  return telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}