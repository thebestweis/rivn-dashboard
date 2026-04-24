export async function GET(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return Response.json(
      { ok: false, error: "Не найден TELEGRAM_BOT_TOKEN" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chat_id");

  if (!chatId) {
    return Response.json(
      { ok: false, error: "Передай chat_id в адресе" },
      { status: 400 }
    );
  }

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ RIVN Reports Bot подключен. Тестовое сообщение успешно отправлено.",
      }),
    }
  );

  const data = await telegramResponse.json();

  return Response.json(data);
}