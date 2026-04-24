import { createClient } from "@supabase/supabase-js";

type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: {
      id: number;
      title?: string;
      type: string;
    };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase или SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!telegramToken) {
    throw new Error("Не найден TELEGRAM_BOT_TOKEN");
  }

  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
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
}

async function saveTelegramChatFromUpdate(update: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  const message =
    update.message ||
    update.edited_message ||
    update.channel_post ||
    update.my_chat_member;

  const chat = message?.chat;
  const from = message?.from;

  if (!chat?.id) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase.from("telegram_bot_chats").upsert(
    {
      chat_id: String(chat.id),
      title:
        chat.title ||
        [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
        [from?.first_name, from?.last_name].filter(Boolean).join(" ") ||
        chat.username ||
        from?.username ||
        "Без названия",
      username: chat.username || from?.username || null,
      type: chat.type || null,
      last_message_text: message?.text || null,
      last_seen_at: new Date().toISOString(),
      raw: update,
    },
    {
      onConflict: "chat_id",
    }
  );

  if (error) {
    console.error("Ошибка сохранения telegram_bot_chats:", error);
  }
}

async function isChatAdmin(chatId: number, userId: number) {
  if (!telegramToken) {
    return false;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`
  );

  const data = await response.json();

  const status = data?.result?.status;

  return status === "creator" || status === "administrator";
}

async function linkChatToClientCode(params: {
  clientCode: string;
  chatId: number;
  chatTitle: string;
  fromId: number | null;
  fromUsername: string | null;
}) {
  const supabase = getSupabase();
  const clientCode = params.clientCode.trim();

  const { data: client, error: clientError } = await supabase
    .from("avito_report_clients")
    .select("id, name, client_code, telegram_chat_id")
    .eq("client_code", clientCode)
    .eq("is_active", true)
    .maybeSingle();

  if (clientError || !client) {
    await sendTelegramMessage(
      params.chatId,
      `❌ Код "${clientCode}" не найден. Проверь ссылку или попроси менеджера RIVN OS отправить новую.`
    );

    return;
  }

  const chatId = String(params.chatId);

  const { data: existingChatLink, error: existingChatLinkError } =
    await supabase
      .from("avito_report_chat_links")
      .select("client_id")
      .eq("telegram_chat_id", chatId)
      .eq("is_active", true)
      .maybeSingle();

  if (existingChatLinkError) {
    await sendTelegramMessage(
      params.chatId,
      `❌ Не удалось проверить привязку чата: ${existingChatLinkError.message}`
    );

    return;
  }

  if (existingChatLink && existingChatLink.client_id !== client.id) {
    await sendTelegramMessage(
      params.chatId,
      "⚠️ Этот Telegram-чат уже привязан к другому проекту. Чтобы не отправить отчёты не туда, я не буду менять привязку автоматически."
    );

    return;
  }

  if (client.telegram_chat_id && String(client.telegram_chat_id) !== chatId) {
    await sendTelegramMessage(
      params.chatId,
      "⚠️ Этот проект уже привязан к другому Telegram-чату. Если нужно заменить чат, сначала отключи старую привязку в RIVN OS."
    );

    return;
  }

  const { error: updateClientError } = await supabase
    .from("avito_report_clients")
    .update({
      telegram_chat_id: chatId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (updateClientError) {
    await sendTelegramMessage(
      params.chatId,
      `❌ Ошибка при сохранении chat_id: ${updateClientError.message}`
    );

    return;
  }

  const { error: linkError } = await supabase
    .from("avito_report_chat_links")
    .upsert(
      {
        client_id: client.id,
        telegram_chat_id: chatId,
        telegram_chat_title: params.chatTitle,
        linked_by_telegram_id: params.fromId ? String(params.fromId) : null,
        linked_by_username: params.fromUsername,
        is_active: true,
      },
      {
        onConflict: "telegram_chat_id",
      }
    );

  if (linkError) {
    await sendTelegramMessage(
      params.chatId,
      `❌ Ошибка при привязке чата: ${linkError.message}`
    );

    return;
  }

  await sendTelegramMessage(
    params.chatId,
    [
      "✅ <b>Готово! Чат привязан к Avito Reports</b>",
      "",
      `Проект: ${client.name}`,
      `Код привязки: ${client.client_code}`,
      "",
      "Теперь daily и weekly отчёты будут приходить в этот чат, если они включены в RIVN OS.",
    ].join("\n")
  );
}

export async function POST(req: Request) {
  try {
    const update = (await req.json()) as TelegramUpdate;
    await saveTelegramChatFromUpdate(update);

    const message = update.message;
    const text = message?.text?.trim();

    if (!message || !text) {
      return Response.json({ ok: true });
    }

    const chatId = message.chat.id;
    const chatTitle = message.chat.title || "Личный чат";
    const chatType = message.chat.type;
    const fromId = message.from?.id;
    const fromUsername = message.from?.username || null;
    const [commandRaw = "", commandPayload = ""] = text.split(/\s+/);
    const command = commandRaw.split("@")[0].toLowerCase();

    if (command === "/start") {
      if (commandPayload) {
        if (chatType === "private") {
          await sendTelegramMessage(
            chatId,
            [
              "✅ <b>Код проекта получен</b>",
              "",
              "Чтобы отчёты приходили в рабочую беседу с клиентом:",
              "",
              "1. Добавь меня в нужную беседу.",
              "2. Отправь в этой беседе команду:",
              "",
              `<code>/link@stat_rivnos_bot ${commandPayload}</code>`,
              "",
              "После этого я привяжу именно беседу, а не личный чат.",
            ].join("\n")
          );

          return Response.json({ ok: true });
        }

        await linkChatToClientCode({
          clientCode: commandPayload,
          chatId,
          chatTitle,
          fromId: fromId ?? null,
          fromUsername,
        });

        return Response.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        [
          "👋 <b>Привет! Это бот RIVN OS для Avito Reports.</b>",
          "",
          chatType === "private"
            ? "Чтобы подключить отчёты, открой специальную ссылку из RIVN OS."
            : "Чтобы привязать эту беседу к проекту, добавь бота по специальной ссылке из RIVN OS.",
          "Ссылка выглядит примерно так:",
          "",
          "https://t.me/stat_rivnos_bot?startgroup=rivn-xxxxxxx",
          "",
          "Если я уже добавлен в беседу, отправь сюда команду привязки из RIVN OS:",
          "",
          "<code>/link@stat_rivnos_bot rivn-xxxxxxx</code>",
        ].join("\n")
      );

      return Response.json({ ok: true });
    }

    if (text === "/help" || text.startsWith("/help@")) {
      await sendTelegramMessage(
        chatId,
        [
          "🤖 <b>RIVN Reports Bot</b>",
          "",
          "Я отправляю отчёты по статистике Avito.",
          "",
          "<b>Команды:</b>",
          "/help — помощь",
          "/status — проверить привязку чата",
          "/link client-code — привязать чат к клиенту",
          "",
          "<b>Метрики:</b>",
          "Просмотры — уникальные просмотры объявлений.",
          "Контакты — сумма всех обращений.",
          "Расходы — расходы из Avito.",
          "Конверсия = Контакты / Просмотры × 100%.",
          "Стоимость контакта = Расходы / Контакты.",
        ].join("\n")
      );

      return Response.json({ ok: true });
    }

    if (text === "/status" || text.startsWith("/status@")) {
      const supabase = getSupabase();

      const { data: link } = await supabase
        .from("avito_report_chat_links")
        .select("client_id, telegram_chat_id, is_active, avito_report_clients(name, client_code)")
        .eq("telegram_chat_id", String(chatId))
        .maybeSingle();

      if (!link) {
        await sendTelegramMessage(
          chatId,
          "⚠️ Этот чат пока не привязан к клиенту. Используй команду:\n\n/link client-code"
        );

        return Response.json({ ok: true });
      }

      const client = Array.isArray(link.avito_report_clients)
        ? link.avito_report_clients[0]
        : link.avito_report_clients;

      await sendTelegramMessage(
        chatId,
        [
          "✅ <b>Чат привязан</b>",
          "",
          `Клиент: ${client?.name || "Не найден"}`,
          `Код клиента: ${client?.client_code || "Не найден"}`,
          `Chat ID: ${chatId}`,
        ].join("\n")
      );

      return Response.json({ ok: true });
    }

    if (text.startsWith("/link")) {
      if (!fromId) {
        await sendTelegramMessage(chatId, "❌ Не удалось определить пользователя.");
        return Response.json({ ok: true });
      }

      const parts = text.split(" ");
      const clientCode = parts[1]?.trim();

      if (!clientCode) {
        await sendTelegramMessage(
          chatId,
          "⚠️ Укажи код клиента. Пример:\n\n/link test-client"
        );

        return Response.json({ ok: true });
      }

      await linkChatToClientCode({
        clientCode,
        chatId,
        chatTitle,
        fromId,
        fromUsername,
      });

      return Response.json({ ok: true });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);

    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "Telegram webhook работает",
  });
}
