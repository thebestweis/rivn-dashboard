const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.CRON_ERROR_CHAT_ID;

type SendCronErrorNotificationParams = {
  title: string;
  route: string;
  error: unknown;
};

export async function sendCronErrorNotification({
  title,
  route,
  error,
}: SendCronErrorNotificationParams) {
  if (!telegramToken || !adminChatId) {
    console.error("No TELEGRAM_BOT_TOKEN or CRON_ERROR_CHAT_ID for cron error notification");
    return;
  }

  const errorMessage =
    error instanceof Error ? error.message : JSON.stringify(error);

  const text =
    `🚨 <b>${title}</b>\n\n` +
    `Маршрут: <code>${route}</code>\n\n` +
    `Ошибка:\n<code>${errorMessage}</code>`;

  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: adminChatId,
      text,
      parse_mode: "HTML",
    }),
  });
}