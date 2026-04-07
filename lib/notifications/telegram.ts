export type SendTelegramMessageParams = {
  botToken: string;
  chatId: string;
  text: string;
};

export async function sendTelegramMessage({
  botToken,
  chatId,
  text,
}: SendTelegramMessageParams) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data?.description || "Не удалось отправить сообщение в Telegram");
  }

  return data;
}